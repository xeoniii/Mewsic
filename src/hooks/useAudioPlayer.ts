import { useCallback, useEffect, useRef } from "react";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import {
  readAudioFile,
  updateDiscordRpc,
  clearDiscordRpc,
  fetchTrackMetadata,
  resolveStreamMetadata,
} from "../utils/tauriApi";
import {
  audio,
  initAudioContext,
  setReverbEnabled,
  setPlaybackSpeed,
  setBassBoost,
  setVolumeBoost,
  setEngineVolume,
  setReverbStrength,
  setLowEndMode,
  setEqGain,
  setSpatialPan,
  setPanAuto,
} from "../utils/audioEngine";

// how often to push currentTime into the store — 50ms is smooth enough for the progress bar
const TIME_UPDATE_INTERVAL = 50;
const RPC_DEBOUNCE_MS = 300;

function isDirectMediaUrl(url: string): boolean {
  const clean = url.split("?")[0].split("#")[0];
  const ext = clean.split(".").pop()?.toLowerCase();
  return ["mp3", "wav", "ogg", "flac", "m4a", "aac", "mp4"].includes(ext ?? "");
}

export function useAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    addNotification,
    discordEnabled,
    systemNotifications,
    reverbEnabled,
    reverbStrength,
    playbackSpeed,
    bassBoost,
    volumeBoost,
    eqGains,
    lowEndMode,
    panX,
    panY,
    panAuto,
  } = useStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      volume: s.volume,
      setIsPlaying: s.setIsPlaying,
      setCurrentTime: s.setCurrentTime,
      setDuration: s.setDuration,
      addNotification: s.addNotification,
      discordEnabled: s.discordEnabled,
      systemNotifications: s.systemNotifications,
      reverbEnabled: s.reverbEnabled,
      reverbStrength: s.reverbStrength,
      playbackSpeed: s.playbackSpeed,
      bassBoost: s.bassBoost,
      volumeBoost: s.volumeBoost,
      eqGains: s.eqGains,
      lowEndMode: s.lowEndMode,
      panX: s.panX,
      panY: s.panY,
      panAuto: s.panAuto,
    }))
  );

  const loadAbortRef = useRef<number>(0);
  // true while a native seek is in flight — blocks onTimeUpdate from overwriting the target
  const isSeekingRef = useRef<boolean>(false);
  // the position we ultimately want to land on, updated immediately on every skip
  const targetSeekTimeRef = useRef<number | null>(null);
  // prevents onpause from flipping store state during track switches
  const isSwitchingTrackRef = useRef<boolean>(false);
  const currentCoverUrlRef = useRef<string | undefined>(undefined);
  const lastTrackIdRef = useRef<string | null>(null);
  const rpcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load and play a track whenever currentTrack.id changes
  useEffect(() => {
    if (!currentTrack) {
      audio.pause();
      audio.src = "";
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const loadId = ++loadAbortRef.current;

    const loadAndPlay = async () => {
      try {
        isSwitchingTrackRef.current = true;
        isSeekingRef.current = false;
        targetSeekTimeRef.current = null;
        audio.pause();

        let targetPath = currentTrack.filePath;

        // if the track is virtual, try to find a local copy first to avoid resolving
        if (currentTrack.isVirtual || targetPath.startsWith("ytsearch:")) {
          const title = currentTrack.title?.toLowerCase().trim();
          const artist = currentTrack.artist?.toLowerCase().trim();
          if (title && artist) {
            const localMatch = useStore.getState().tracks.find(
              (t) =>
                !t.isVirtual &&
                !t.filePath.startsWith("ytsearch:") &&
                t.title?.toLowerCase().trim() === title &&
                t.artist?.toLowerCase().trim() === artist
            );
            if (localMatch) targetPath = localMatch.filePath;
          }
        }

        let fileUrl = readAudioFile(targetPath);

        if (
          targetPath.startsWith("http://") ||
          targetPath.startsWith("https://") ||
          targetPath.startsWith("ytsearch:")
        ) {
          if (!targetPath.startsWith("http://127.0.0.1:1422/")) {
            if (!isDirectMediaUrl(targetPath)) {
              let resolved: { url: string; title?: string; artist?: string; duration?: number; coverArt?: string } | null = null;

              // plugin resolvers get first crack at stream resolution
              if (window.Mewsic?.player?._resolvers) {
                for (const resolver of window.Mewsic.player._resolvers) {
                  try {
                    const result = await resolver(targetPath);
                    if (result?.url) {
                      resolved = {
                        url: result.url,
                        title: result.title || currentTrack.title,
                        artist: result.artist || currentTrack.artist,
                        duration: result.duration || currentTrack.duration,
                        coverArt: result.coverArt || currentTrack.coverArt || "",
                      };
                      break;
                    }
                  } catch (e) {
                    console.error("Plugin resolver failed:", e);
                  }
                }
              }

              if (!resolved) resolved = await resolveStreamMetadata(targetPath);

              fileUrl = resolved.url;

              // only backfill missing fields — never overwrite existing title/artist
              const updates: Record<string, unknown> = {};
              if (!currentTrack.duration && resolved.duration) updates.duration = resolved.duration;
              if (!currentTrack.coverArt && resolved.coverArt) updates.coverArt = resolved.coverArt;
              if (Object.keys(updates).length > 0) {
                useStore.getState().updateTrack({ ...currentTrack, ...updates });
              }
            }
            fileUrl = `http://127.0.0.1:1422/proxy?url=${encodeURIComponent(fileUrl)}`;
          }
        }

        if (loadId !== loadAbortRef.current) return;

        audio.crossOrigin = "anonymous";
        audio.src = fileUrl;
        audio.currentTime = 0;

        // read isPlaying from store here — the render value can be stale after async resolution
        if (useStore.getState().isPlaying) {
          if (!useStore.getState().safeAudioMode) initAudioContext();
          audio.play().catch((err) => console.warn("Autoplay blocked:", err));
        }
      } catch (err) {
        if (loadId !== loadAbortRef.current) return;
        console.error("Failed to load track:", err);
        addNotification(`Failed to load: ${err}`, "error");
      }
    };

    loadAndPlay();
  }, [currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      if (audio.paused) {
        if (!useStore.getState().safeAudioMode) initAudioContext();
        audio.play().catch(() => {});
      }
    } else {
      // clear the switching flag so onPause can always update the store
      isSwitchingTrackRef.current = false;
      audio.pause();
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  const seekRequest = useStore((s) => s.seekRequest);
  useEffect(() => {
    if (seekRequest === null) return;
    setCurrentTime(seekRequest);
    targetSeekTimeRef.current = seekRequest;
    isSeekingRef.current = true;
    audio.currentTime = seekRequest;
    
    const target = seekRequest;
    setTimeout(() => {
      if (useStore.getState().seekRequest === target) {
        useStore.getState().clearSeekRequest();
      }
    }, 50);
  }, [seekRequest]); // setCurrentTime is a stable zustand action, not a real dep

  useEffect(() => { setEngineVolume(volume); }, [volume]);

  useEffect(() => {
    setReverbEnabled(reverbEnabled);
    setReverbStrength(reverbStrength);
    setPlaybackSpeed(playbackSpeed);
    setBassBoost(bassBoost);
    setVolumeBoost(volumeBoost);
    setSpatialPan(panX, panY);
    setPanAuto(panAuto);
  }, [reverbEnabled, reverbStrength, playbackSpeed, bassBoost, volumeBoost, panX, panY, panAuto, currentTrack?.id]);

  useEffect(() => { setLowEndMode(lowEndMode); }, [lowEndMode]);

  useEffect(() => {
    if (Array.isArray(eqGains)) eqGains.forEach((gain, i) => setEqGain(i, gain));
  }, [eqGains]);

  // discord RPC updates — debounced to avoid spamming on rapid track changes
  useEffect(() => {
    if (rpcTimeoutRef.current) clearTimeout(rpcTimeoutRef.current);

    const updatePresence = async () => {
      const state = useStore.getState();

      if (!currentTrack) {
        lastTrackIdRef.current = null;
        currentCoverUrlRef.current = undefined;
        if (state.discordEnabled) {
          updateDiscordRpc("Idle", "Nothing playing", false, 0, 0, "Mewsic").catch(() => {});
        } else {
          clearDiscordRpc().catch(() => {});
        }
        return;
      }

      let playlistName = "Mewsic";
      if (state.activePlaylistId) {
        const pl = state.playlists.find((p) => p.id === state.activePlaylistId);
        if (pl) playlistName = pl.name;
      }

      if (lastTrackIdRef.current !== currentTrack.id) {
        lastTrackIdRef.current = currentTrack.id;

        const cached = state.discordCoverCache[currentTrack.id];
        if (cached) {
          currentCoverUrlRef.current = cached === "none" ? undefined : cached;
        } else {
          currentCoverUrlRef.current = undefined;
          fetchTrackMetadata(`${currentTrack.title} ${currentTrack.artist}`)
            .then((metadata) => {
              if (metadata.coverArt) {
                useStore.getState().setDiscordCoverCache(currentTrack.id, metadata.coverArt);
                if (useStore.getState().currentTrack?.id === currentTrack.id) {
                  currentCoverUrlRef.current = metadata.coverArt;
                  updateDiscordRpc(
                    currentTrack.title,
                    currentTrack.artist,
                    useStore.getState().isPlaying,
                    audio.currentTime,
                    currentTrack.duration || audio.duration || 0,
                    playlistName,
                    metadata.coverArt
                  ).catch(() => {});
                }
              } else {
                useStore.getState().setDiscordCoverCache(currentTrack.id, "none");
              }
            })
            .catch(() => {});
        }

        if (state.systemNotifications) {
          try {
            const { isPermissionGranted, requestPermission, sendNotification } =
              await import("@tauri-apps/plugin-notification");
            let hasPermission = await isPermissionGranted();
            if (!hasPermission) hasPermission = (await requestPermission()) === "granted";
            if (hasPermission) {
              sendNotification({
                title: `Now Playing: ${currentTrack.title}`,
                body: `${currentTrack.artist} — ${currentTrack.album}`,
                icon: currentCoverUrlRef.current,
              });
            }
          } catch (err) {
            console.warn("System notification failed:", err);
          }
        }
      }

      if (state.discordEnabled) {
        updateDiscordRpc(
          currentTrack.title,
          currentTrack.artist,
          isPlaying,
          audio.currentTime,
          currentTrack.duration || audio.duration || 0,
          playlistName,
          currentCoverUrlRef.current
        ).catch(() => {});
      } else {
        clearDiscordRpc().catch(() => {});
      }
    };

    rpcTimeoutRef.current = setTimeout(updatePresence, RPC_DEBOUNCE_MS);
    return () => { if (rpcTimeoutRef.current) clearTimeout(rpcTimeoutRef.current); };
  }, [currentTrack?.id, isPlaying, discordEnabled, systemNotifications]);

  // audio element events — intentionally empty deps so listeners are only registered once.
  // all dynamic state is read from refs or the store directly.
  useEffect(() => {
    let lastTimeWrite = 0;

    const onTimeUpdate = () => {
      // while seeking, we already pushed the target into the store — don't overwrite it
      if (isSeekingRef.current) return;
      
      // Prevent GStreamer clock latency/stale events from overwriting the seek target in the store
      if (targetSeekTimeRef.current !== null) {
        const diff = Math.abs(audio.currentTime - targetSeekTimeRef.current);
        if (diff > 2.0) return;
        targetSeekTimeRef.current = null;
      }

      const now = performance.now();
      const interval = useStore.getState().lowEndMode ? 250 : TIME_UPDATE_INTERVAL;
      if (now - lastTimeWrite >= interval) {
        lastTimeWrite = now;
        setCurrentTime(audio.currentTime);
      }
    };

    const onDurationChange = () => {
      const d = isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : useStore.getState().currentTrack?.duration ?? 0;
      setDuration(d);
    };

    const onEnded = () => {
      // read from store directly to avoid stale closure on repeatMode
      const { repeatMode } = useStore.getState();
      if (repeatMode === "one") {
        audio.currentTime = 0;
        if (!useStore.getState().safeAudioMode) initAudioContext();
        audio.play().catch(() => {});
      } else {
        setTimeout(() => useStore.getState().playNext(), 100);
      }
    };

    const onPlay = () => {
      isSwitchingTrackRef.current = false;
      setIsPlaying(true);
    };

    const onPause = () => {
      if (isSwitchingTrackRef.current) return;
      setIsPlaying(false);
    };

    const onError = (e: Event) => console.error("Audio error:", e);

    const onSeeking = () => {
      isSeekingRef.current = true;
    };

    const onSeeked = () => {
      isSeekingRef.current = false;
      
      // Clear targetSeekTimeRef if the engine reports it has successfully landed near the target
      if (targetSeekTimeRef.current !== null) {
        const diff = Math.abs(audio.currentTime - targetSeekTimeRef.current);
        if (diff <= 2.0) {
          targetSeekTimeRef.current = null;
        }
      }
      
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("seeking", onSeeking);
    audio.addEventListener("seeked", onSeeked);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("seeking", onSeeking);
      audio.removeEventListener("seeked", onSeeked);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = useCallback((time: number) => {
    setCurrentTime(time);
    targetSeekTimeRef.current = time;
    isSeekingRef.current = true;
    audio.currentTime = time;

    // update discord position immediately on manual seek
    const state = useStore.getState();
    const track = state.currentTrack;
    if (track && state.discordEnabled) {
      let playlistName = "Mewsic";
      if (state.activePlaylistId) {
        const pl = state.playlists.find((p) => p.id === state.activePlaylistId);
        if (pl) playlistName = pl.name;
      }
      updateDiscordRpc(
        track.title,
        track.artist,
        state.isPlaying,
        time,
        track.duration || audio.duration || 0,
        playlistName,
        currentCoverUrlRef.current
      ).catch(() => {});
    }
  }, [setCurrentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => setIsPlaying(!isPlaying);

  // called by the seek bar while dragging to suppress onTimeUpdate fighting the drag
  const setSeeking = useCallback((active: boolean) => {
    isSeekingRef.current = active;
  }, []);

  return { seek, togglePlay, setSeeking, audioElement: audio };
}