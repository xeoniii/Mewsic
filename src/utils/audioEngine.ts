import { useStore } from "../store";

let audioInstance: HTMLAudioElement;
let audioCtx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;

let eqFilters: BiquadFilterNode[] = [];
let bassFilter: BiquadFilterNode | null = null;
let reverbNode: ConvolverNode | null = null;
let dryGain: GainNode | null = null;
let wetGain: GainNode | null = null;
let boostGain: GainNode | null = null;
let masterGain: GainNode | null = null;
let pannerNode: PannerNode | null = null;

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

let currentBassBoost = 0;
let currentVolumeBoost = 1.0;
let currentReverbEnabled = false;
let currentReverbStrength = 0.5;
let currentVolume = 1.0;
let isLowEndMode = false;
let currentPanX = 0;
let currentPanY = 0;
let currentPanAuto = false;
let autoPanInterval: ReturnType<typeof setInterval> | null = null;
let autoPanAngle = 0;

try {
  audioInstance = new Audio();
  audioInstance.preload = "auto";
  audioInstance.style.display = "none";
  audioInstance.crossOrigin = "anonymous";

  if (typeof document !== "undefined") {
    const appendAudio = () => {
      if (document.body) {
        document.body.appendChild(audioInstance);
      } else {
        setTimeout(appendAudio, 50);
      }
    };
    appendAudio();
  }

  // ramp masterGain on pause/play to avoid clicks when the Web Audio graph is active
  audioInstance.addEventListener("pause", () => {
    if (audioCtx && masterGain) {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.02);
    }
  });

  audioInstance.addEventListener("play", () => {
    if (audioCtx && masterGain) {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setTargetAtTime(currentVolume, audioCtx.currentTime, 0.02);
    }
  });
} catch (err) {
  console.error("AudioEngine: failed to create audio element", err);
  audioInstance = {
    play: () => Promise.resolve(),
    pause: () => { },
    addEventListener: () => { },
    removeEventListener: () => { },
    setAttribute: () => { },
    removeAttribute: () => { },
    playbackRate: 1.0,
    volume: 1.0,
  } as any;
}

export const audio = audioInstance;

function createImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function safeSetGain(param: AudioParam, value: number, ctx: AudioContext, immediate = false) {
  const t = ctx.currentTime;
  param.cancelScheduledValues(t);
  if (immediate) {
    param.setValueAtTime(value, t);
  } else {
    param.setTargetAtTime(value, t, 0.01);
  }
}

// full sync — only called once during graph init
function syncEngineState() {
  if (!audioCtx || !source) return;

  // when the web audio graph is active, the element volume must stay at 1
  // otherwise you get double attenuation (element × masterGain)
  audioInstance.volume = 1.0;

  if (bassFilter) safeSetGain(bassFilter.gain, currentBassBoost, audioCtx);
  if (boostGain) safeSetGain(boostGain.gain, currentVolumeBoost, audioCtx);
  if (masterGain) safeSetGain(masterGain.gain, currentVolume, audioCtx);

  // Sync EQ gains from the store
  const state = useStore.getState();
  const eqGains = state.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  eqFilters.forEach((filter, i) => {
    if (filter) {
      filter.gain.cancelScheduledValues(audioCtx!.currentTime);
      filter.gain.setValueAtTime(eqGains[i] ?? 0, audioCtx!.currentTime);
    }
  });

  syncReverb();
  setSpatialPan(state.panX, state.panY);
  setPanAuto(state.panAuto || false);
}

function syncReverb() {
  if (!audioCtx || !dryGain || !wetGain) return;
  const reverbActive = currentReverbEnabled;

  // Transition wet/dry gains smoothly to avoid audio pops/clicks
  const targetDry = reverbActive ? 0.6 : 1.0;
  const targetWet = reverbActive ? currentReverbStrength : 0.0;

  safeSetGain(dryGain.gain, targetDry, audioCtx);
  safeSetGain(wetGain.gain, targetWet, audioCtx);
}

export function initAudioContext() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => { });
    return;
  }

  try {
    const ContextClass: typeof AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!ContextClass) return;

    audioCtx = new ContextClass();
    const nyquist = audioCtx.sampleRate / 2;

    source = audioCtx.createMediaElementSource(audio);

    // 10-band EQ — frequencies clamped below nyquist to avoid crashes on
    // bluetooth headsets running at 8kHz (HSP/HFP profile)
    eqFilters = EQ_FREQUENCIES.map((freq) => {
      const f = audioCtx!.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = Math.min(freq, nyquist * 0.9);
      f.Q.value = 1.4;
      f.gain.value = 0;
      return f;
    });

    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 200;

    const impulseBuffer = createImpulseResponse(audioCtx, 2.5, 2.5);
    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = impulseBuffer;
    dryGain = audioCtx.createGain();
    wetGain = audioCtx.createGain();

    boostGain = audioCtx.createGain();
    masterGain = audioCtx.createGain();
    pannerNode = audioCtx.createPanner();
    pannerNode.panningModel = 'HRTF';
    pannerNode.distanceModel = 'inverse';

    const listener = audioCtx.listener;
    if (listener.positionX) {
      listener.positionX.value = 0;
      listener.positionY.value = 0;
      listener.positionZ.value = 0;
      listener.forwardX.value = 0;
      listener.forwardY.value = 0;
      listener.forwardZ.value = -1;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else {
      listener.setPosition(0, 0, 0);
      listener.setOrientation(0, 0, -1, 0, 1, 0);
    }

    // Setup initial static connection topology
    source.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    eqFilters[eqFilters.length - 1].connect(bassFilter);

    bassFilter.connect(dryGain);
    bassFilter.connect(reverbNode);
    reverbNode.connect(wetGain);
    dryGain.connect(boostGain);
    wetGain.connect(boostGain);
    boostGain.connect(masterGain);
    masterGain.connect(pannerNode);
    pannerNode.connect(audioCtx.destination);

    // Resume automatically after device switches (e.g. Bluetooth reconnect)
    audioCtx.addEventListener("statechange", () => {
      if (audioCtx?.state === "suspended" || audioCtx?.state === "interrupted") {
        audioCtx.resume().catch(() => { });
      }
    });

    syncEngineState();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => { });
  } catch (err) {
    console.error("AudioEngine: web audio init failed", err);
    audioCtx = null;
  }
}

export function setEngineVolume(vol: number) {
  currentVolume = Math.max(0, Math.min(1, vol));
  if (audioCtx && masterGain) {
    if (!audioInstance.paused) {
      safeSetGain(masterGain.gain, currentVolume, audioCtx);
    }
    audioInstance.volume = 1.0;
  } else {
    audioInstance.volume = currentVolume;
  }
}

export function setReverbEnabled(enabled: boolean) {
  currentReverbEnabled = enabled;
  syncReverb();
}

export function setReverbStrength(strength: number) {
  currentReverbStrength = strength;
  syncReverb();
}

export function setPlaybackSpeed(speed: number) {
  audioInstance.playbackRate = Math.max(0.25, Math.min(4.0, speed));
}

export function setBassBoost(db: number) {
  currentBassBoost = db;
  if (bassFilter && audioCtx) safeSetGain(bassFilter.gain, currentBassBoost, audioCtx);
}

export function setVolumeBoost(multiplier: number) {
  currentVolumeBoost = Math.max(0, multiplier);
  if (boostGain && audioCtx) safeSetGain(boostGain.gain, currentVolumeBoost, audioCtx);
}

export function setEqGain(index: number, gain: number) {
  if (!eqFilters[index] || !audioCtx) return;
  const smoothing = isLowEndMode ? 0.05 : 0.01;
  const param = eqFilters[index].gain;
  param.cancelScheduledValues(audioCtx.currentTime);
  param.setTargetAtTime(gain, audioCtx.currentTime, smoothing);
}

export function setLowEndMode(enabled: boolean) {
  isLowEndMode = enabled;
  syncReverb();
}

export function setSpatialPan(x: number, y: number) {
  currentPanX = x;
  currentPanY = y;
  if (!pannerNode || !audioCtx || currentPanAuto) return;

  const radius = 10;
  const posX = x * radius;
  const posY = 0;
  const posZ = -y * radius;

  if (pannerNode.positionX) {
    const t = audioCtx.currentTime;
    pannerNode.positionX.cancelScheduledValues(t);
    pannerNode.positionX.setTargetAtTime(posX, t, 0.1);
    pannerNode.positionY.cancelScheduledValues(t);
    pannerNode.positionY.setTargetAtTime(posY, t, 0.1);
    pannerNode.positionZ.cancelScheduledValues(t);
    pannerNode.positionZ.setTargetAtTime(posZ, t, 0.1);
  } else {
    pannerNode.setPosition(posX, posY, posZ);
  }
}

export function setPanAuto(enabled: boolean) {
  currentPanAuto = enabled;
  if (!pannerNode || !audioCtx) return;

  if (enabled) {
    if (autoPanInterval) clearInterval(autoPanInterval);
    autoPanAngle = 0;
    autoPanInterval = setInterval(() => {
      autoPanAngle += 0.04; // Synchronized orbit speed (7.85s)
      
      // Use an elliptical orbit instead of a perfect circle.
      // Standard HRTF often causes the "Cone of Confusion" on the pure Z axis,
      // making front/back sound like top/bottom (elevation).
      // Squashing the Z radius keeps it wider on the ears and reduces the illusion.
      const radiusX = 4.5;
      const radiusZ = 2.0; 
      
      const posX = Math.cos(autoPanAngle) * radiusX;
      const posZ = Math.sin(autoPanAngle) * radiusZ;

      if (pannerNode && audioCtx) {
        const t = audioCtx.currentTime;
        if (pannerNode.positionX) {
          pannerNode.positionX.setTargetAtTime(posX, t, 0.05);
          pannerNode.positionZ.setTargetAtTime(posZ, t, 0.05);
        } else {
          pannerNode.setPosition(posX, 0, posZ);
        }
      }
    }, 50); // 20fps is enough with setTargetAtTime smoothing
  } else {
    if (autoPanInterval) {
      clearInterval(autoPanInterval);
      autoPanInterval = null;
    }
    // Restore manual panX/panY
    setSpatialPan(currentPanX, currentPanY);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    () => {
      if (!useStore.getState().safeAudioMode) {
        initAudioContext();
      } else if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => { });
      }
    },
    { capture: true }
  );
}
