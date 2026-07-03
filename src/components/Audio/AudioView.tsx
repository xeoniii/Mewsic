import React, { useState, useEffect, useRef } from "react";
import {
  Volume2, Zap, Sliders, AudioWaveform, Radio, Headphones,
  AlertTriangle, RotateCcw, Activity, Music, Bookmark, Plus, Crosshair
} from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { ThemedSlider } from "../UI/ThemedSlider";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import { SpatialPanner } from "./SpatialPanner";

// Sub-components mapped to individual store slices to prevent global re-renders

function MasterVolumeCard() {
  const { volume, setVolume } = useStore(useShallow(s => ({ volume: s.volume ?? 0.8, setVolume: s.setVolume })));
  return (
    <div className="glass lg:col-span-3 rounded-[1.5rem] p-6 border border-border-subtle relative overflow-hidden shadow-xl flex flex-col">
      <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
        <Volume2 size={200} className="text-accent" />
      </div>
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
          <Volume2 size={16} />
        </div>
        <div>
          <h3 className="font-bold text-base tracking-tight">Master Volume</h3>
          <p className="text-[9px] text-text-muted uppercase tracking-widest font-black">Gain Controller</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center relative z-10">
        <div className="text-5xl font-black text-accent tracking-tighter tabular-nums mb-8">
          {Math.round(volume * 100)}<span className="text-2xl text-accent/50 ml-1">%</span>
        </div>
        <div className="w-full px-2">
          <ThemedSlider
            min={0} max={1} step={0.01} value={volume} onChange={setVolume}
            formatTooltip={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      </div>
      <div className="flex items-center justify-between mt-8 border-t border-white/5 pt-4">
        <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">Rate: <span className="text-text-primary ml-1">48kHz</span></div>
        <button onClick={() => setVolume(0.8)} className="p-1.5 rounded-lg bg-surface-raised border border-white/5 text-text-muted hover:text-accent hover:border-white/10 transition-all active:scale-90" title="Reset to 80%">
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}

function SpatialPannerCard() {
  const { panX, panY, panAuto, setSpatialPan, setPanAuto } = useStore(useShallow(s => ({ panX: s.panX ?? 0, panY: s.panY ?? 0, panAuto: !!s.panAuto, setSpatialPan: s.setSpatialPan || (() => { }), setPanAuto: s.setPanAuto || (() => { }) })));
  return (
    <div className="glass lg:col-span-4 rounded-[1.5rem] p-6 border border-border-subtle relative overflow-hidden shadow-xl flex flex-col items-center">
      <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
        <Crosshair size={200} className="text-accent" />
      </div>
      <div className="w-full flex items-center gap-3 mb-4 relative z-10">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
          <Activity size={16} />
        </div>
        <div>
          <h3 className="font-bold text-base tracking-tight">8D Spatial Audio</h3>
          <p className="text-[9px] text-text-muted uppercase tracking-widest font-black">HRTF Panner</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center w-full relative z-10 py-4">
        <SpatialPanner x={panX} y={panY} autoPan={panAuto} onChange={setSpatialPan} onToggleAuto={setPanAuto} />
      </div>
    </div>
  );
}

function EqCard() {
  const { eqGains, setEqGain, resetEq } = useStore(useShallow(s => ({ eqGains: s.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], setEqGain: s.setEqGain || (() => { }), resetEq: s.resetEq || (() => { }) })));
  return (
    <div className="glass lg:col-span-5 rounded-[1.5rem] p-6 border border-border-subtle relative overflow-hidden shadow-xl flex flex-col">
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            <Sliders size={16} />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight">Parametric EQ</h3>
            <p className="text-[9px] text-text-muted uppercase tracking-widest font-black text-accent">10-Band Graphic</p>
          </div>
        </div>
        <button onClick={resetEq} className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-accent/10 border border-white/5 hover:border-accent/30 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">
          Flat
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-end bg-white/[0.02] border border-white/5 rounded-xl p-4 relative z-10">
        <div className="w-full grid grid-cols-10 gap-1 sm:gap-2 h-40">
          {["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"].map((freq, i) => (
            <div key={freq} className="flex flex-col items-center gap-2">
              <div className="flex-1 relative w-full flex justify-center items-center">
                <input
                  type="range" min="-12" max="12" step="0.5"
                  value={eqGains[i] ?? 0}
                  onChange={(e) => setEqGain(i, parseFloat(e.target.value))}
                  className="absolute eq-fader w-[110px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90"
                />
              </div>
              <div className="text-center h-8 flex flex-col justify-end">
                <p className={`text-[9px] font-bold tabular-nums ${(eqGains[i] ?? 0) !== 0 ? 'text-accent' : 'text-text-primary'}`}>
                  {(eqGains[i] ?? 0) > 0 ? `+${eqGains[i]}` : (eqGains[i] ?? 0)}
                </p>
                <p className="text-[8px] text-text-muted font-black uppercase tracking-tighter opacity-60">{freq}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PresetsRow() {
  const { audioPresets, activePresetId, renamePresetId, setRenamePresetId, applyPreset, savePreset, updatePresetName, addNotification } = useStore(useShallow(s => ({
    audioPresets: s.audioPresets || [], activePresetId: s.activePresetId, renamePresetId: s.renamePresetId, setRenamePresetId: s.setRenamePresetId, applyPreset: s.applyPreset, savePreset: s.savePreset, updatePresetName: s.updatePresetName, addNotification: s.addNotification
  })));
  const [presetName, setPresetName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (renamePresetId) {
      const p = audioPresets.find(p => p.id === renamePresetId);
      if (p) setRenameValue(p.name);
    }
  }, [renamePresetId, audioPresets]);

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    setPresetName("");
    setShowSaveDialog(false);
    addNotification?.("Preset created successfully", "success");
  };

  const handleRenamePreset = () => {
    if (!renameValue.trim() || !renamePresetId) return;
    updatePresetName(renamePresetId, renameValue.trim());
    setRenamePresetId(null);
    setRenameValue("");
    addNotification?.("Preset renamed successfully", "success");
  };

  return (
    <section className="glass rounded-[1.5rem] p-6 border border-border-subtle shadow-xl animate-slide-up" style={{ animationDelay: '0.15s' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            <Bookmark size={16} />
          </div>
          <div><h3 className="font-bold text-base tracking-tight">Audio Presets</h3></div>
        </div>
        <button onClick={() => setShowSaveDialog(true)} className="btn-accent h-8 px-4 text-[10px]">
          <Plus size={14} /> <span>New Preset</span>
        </button>
      </div>

      {showSaveDialog && (
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Preset name..." autoFocus value={presetName} onChange={(e) => setPresetName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-accent/50 outline-none" />
          <div className="flex gap-2">
            <button onClick={handleSavePreset} className="btn-accent px-6">Save</button>
            <button onClick={() => setShowSaveDialog(false)} className="px-4 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10">Cancel</button>
          </div>
        </div>
      )}

      {renamePresetId && (
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="New name..." autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenamePreset()} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-accent/50 outline-none" />
          <div className="flex gap-2">
            <button onClick={handleRenamePreset} className="btn-accent px-6">Rename</button>
            <button onClick={() => setRenamePresetId(null)} className="px-4 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {audioPresets.map((preset) => (
          <div key={preset.id} data-preset-id={preset.id} onClick={() => applyPreset(preset.id)} className={`group flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer min-w-[140px] max-w-[200px] ${activePresetId === preset.id ? 'bg-accent/10 border-white/10 shadow-md shadow-accent/5' : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]'}`}>
            <Music size={14} className={activePresetId === preset.id ? 'text-accent' : 'text-text-muted'} />
            <span className={`font-bold text-xs truncate ${activePresetId === preset.id ? 'text-accent' : 'text-text-primary'}`}>{preset.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReverbCard() {
  const { reverbEnabled, setReverbEnabled, reverbStrength, setReverbStrength } = useStore(useShallow(s => ({ reverbEnabled: !!s.reverbEnabled, setReverbEnabled: s.setReverbEnabled, reverbStrength: s.reverbStrength ?? 0.5, setReverbStrength: s.setReverbStrength })));
  return (
    <div className="glass rounded-[1.5rem] p-6 border border-border-subtle flex flex-col group shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent"><Zap size={16} /></div>
          <h3 className="font-bold text-sm truncate">Reverb</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={reverbEnabled} onChange={() => setReverbEnabled(!reverbEnabled)} />
          <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
        </label>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-4">
        <div className="flex justify-between items-end">
          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Wet Mix</p>
          <span className="font-mono text-accent font-bold text-xs">{(reverbStrength * 100).toFixed(0)}%</span>
        </div>
        <ThemedSlider min={0} max={1.5} step={0.05} value={reverbStrength} onChange={setReverbStrength} />
        <button onClick={() => setReverbStrength(0.5)} className="w-full py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-accent hover:border-white/10 transition-all">Reset</button>
      </div>
    </div>
  );
}

function BassCard() {
  const { bassBoost, setBassBoost } = useStore(useShallow(s => ({ bassBoost: s.bassBoost ?? 0, setBassBoost: s.setBassBoost })));
  return (
    <div className="glass rounded-[1.5rem] p-6 border border-border-subtle flex flex-col group shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent"><Radio size={16} /></div>
          <h3 className="font-bold text-sm truncate">Bass Boost</h3>
        </div>
        <span className="text-sm font-black text-accent tabular-nums leading-none">+{bassBoost}dB</span>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-4">
        <ThemedSlider min={0} max={20} step={1} value={bassBoost} onChange={setBassBoost} />
        <button onClick={() => setBassBoost(0)} className="w-full py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-accent hover:border-white/10 transition-all">Reset</button>
      </div>
    </div>
  );
}

function SpeedCard() {
  const { playbackSpeed, setPlaybackSpeed } = useStore(useShallow(s => ({ playbackSpeed: s.playbackSpeed ?? 1.0, setPlaybackSpeed: s.setPlaybackSpeed })));
  return (
    <div className="glass rounded-[1.5rem] p-6 border border-border-subtle flex flex-col group shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent"><Sliders size={16} /></div>
          <h3 className="font-bold text-sm truncate">Speed</h3>
        </div>
        <span className="text-sm font-black text-accent tabular-nums leading-none">{playbackSpeed.toFixed(2)}x</span>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-4">
        <ThemedSlider min={0.5} max={2.0} step={0.05} value={playbackSpeed} onChange={setPlaybackSpeed} />
        <div className="flex justify-between gap-1">
          {[0.5, 1.0, 2.0].map((v) => (
            <button key={v} onClick={() => setPlaybackSpeed(v)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${Math.abs(playbackSpeed - v) < 0.01 ? "bg-accent/10 text-accent border-white/10" : "bg-white/5 text-text-muted border-white/5 hover:bg-white/10"}`}>
              {v === 1.0 ? "Norm" : `${v}x`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoostCard() {
  const { volumeBoost, setVolumeBoost } = useStore(useShallow(s => ({ volumeBoost: s.volumeBoost ?? 1.0, setVolumeBoost: s.setVolumeBoost })));
  return (
    <div className="glass rounded-[1.5rem] p-6 border border-border-subtle flex flex-col group shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent"><Headphones size={16} /></div>
          <h3 className="font-bold text-sm truncate">Overdrive</h3>
        </div>
        <span className="text-sm font-black text-accent tabular-nums leading-none">{(volumeBoost * 100).toFixed(0)}%</span>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-4">
        <ThemedSlider min={1.0} max={2.0} step={0.05} value={volumeBoost} onChange={setVolumeBoost} />
        <button onClick={() => setVolumeBoost(1.0)} className="w-full py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-accent hover:border-white/10 transition-all">Reset</button>
      </div>
    </div>
  );
}

export function AudioView() {
  const { resetAudioEffects, lowEndMode, safeAudioMode, setSafeAudioMode } = useStore(useShallow(s => ({
    resetAudioEffects: s.resetAudioEffects,
    lowEndMode: !!s.lowEndMode,
    safeAudioMode: !!s.safeAudioMode,
    setSafeAudioMode: s.setSafeAudioMode
  })));

  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base text-text-primary overflow-hidden page">
      {
  // This is the header section
}
      <header className="p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-subtle bg-surface-base/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center text-accent flex-shrink-0 border border-white/5">
            <AudioWaveform size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Mewsic Audio Engine</h1>
            <p className="text-xs md:text-sm text-text-muted truncate">V3 | High-fidelity dashboard interface</p>
          </div>
        </div>
        <button
          onClick={resetAudioEffects}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-red-500 transition-all active:scale-95 w-full sm:w-auto flex-shrink-0"
        >
          Reset Engine
        </button>
      </header>

      {
  // This is the scrollable content part
}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-6 animate-fade-in">

          {
  // This is the top row part
}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <MasterVolumeCard />
            <SpatialPannerCard />
            <EqCard />
          </div>

          <PresetsRow />

          {
  // This is the bottom row part
}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <ReverbCard />
            <BassCard />
            <SpeedCard />
            <BoostCard />
          </div>

          <div className="p-4 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-between gap-4 mt-2 animate-slide-up shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <AlertTriangle size={16} className="text-text-muted flex-shrink-0" />
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-text-primary">Safe Audio / Direct Mode</h4>
                <p className="text-[10px] text-text-muted truncate">Bypasses advanced DSP (EQ/Reverb/8D) to fix headset crashes.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input type="checkbox" className="sr-only peer" checked={safeAudioMode} onChange={() => setSafeAudioMode(!safeAudioMode)} />
              <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
            </label>
          </div>

        </div>
      </div>
    </div>
  );
}
