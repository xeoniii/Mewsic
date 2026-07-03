// store/index.ts
// single zustand store for the entire application.
// separated into three slices: player, library, ui.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type {
  Track,
  Playlist,
  AccentPreset,
  ViewId,
  AppSettings,
  Notification,
  ShortcutMap,
  AudioPreset,
} from "../types";
import { shuffleArray } from "../utils/helpers";

// ── Player Slice ─────────────────────────────────────────────────────────────

interface PlayerSlice {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queueSourceId: string | null;

  setCurrentTrack: (track: Track) => void;
  setQueue: (tracks: Track[], startIndex?: number, sourceId?: string | null) => void;
  setIsPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  playNext: () => void;
  playPrev: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  syncQueue: (tracks: Track[], sourceId: string) => void;

  seekRequest: number | null;
  requestSeek: (t: number) => void;
  clearSeekRequest: () => void;
}

// ── Library Slice ────────────────────────────────────────────────────────────

interface LibrarySlice {
  tracks: Track[];
  virtualTracks: Track[];
  playlists: Playlist[];
  isScanning: boolean;
  scanProgress: number;
  musicDir: string;
  playlistsDir: string;
  coversDir: string;
  discordCoverCache: Record<string, string>;

  setTracks: (tracks: Track[]) => void;
  updateTrack: (updated: Track) => void;
  addTracks: (tracks: Track[]) => void;
  addVirtualTrack: (track: Track) => void;
  removeVirtualTrack: (trackId: string) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  addPlaylist: (p: Playlist) => void;
  updatePlaylist: (p: Playlist) => void;
  removePlaylist: (id: string) => void;
  setScanning: (v: boolean, progress?: number) => void;
  setMusicDir: (dir: string) => void;
  setPlaylistsDir: (dir: string) => void;
  setCoversDir: (dir: string) => void;
  setDiscordCoverCache: (id: string, url: string) => void;
  removeTrack: (id: string) => void;
  purgeVirtualTracks: () => void;
}

// ── UI / Settings Slice ──────────────────────────────────────────────────────

interface UISlice {
  activeView: ViewId;
  activePlaylistId: string | null;
  searchQuery: string;
  accentColor: AccentPreset;
  customAccentColor: string;
  customColorHistory: string[];
  volume: number;
  repeatMode: "off" | "one" | "all";
  shuffleEnabled: boolean;
  guiScale: number;
  trayEnabled: boolean;
  lastVolume: number;
  libraryViewMode: "grid" | "list";
  homeViewMode: "grid" | "list";
  playlistViewMode: "grid" | "list";
  theme: "dark" | "light";
  showAbout: boolean;
  editTrack: Track | null;
  addTrack: Track | null;
  deleteTrack: Track | null;
  sharePlaylist: Playlist | null;
  history: { view: ViewId; playlistId: string | null }[];
  historyIndex: number;
  roundedCorners: boolean;
  customTitlebar: boolean;
  isFullscreen: boolean;
  discordEnabled: boolean;
  systemNotifications: boolean;
  lowEndMode: boolean;
  safeAudioMode: boolean;
  shortcuts: ShortcutMap;
  showImportPlaylist: boolean;
  showCreatePlaylist: boolean;
  showCyberdeck: boolean;
  isDemoMode: boolean;
  isDevMode: boolean;
  reverbEnabled: boolean;
  reverbStrength: number;
  playbackSpeed: number;
  bassBoost: number;
  volumeBoost: number;
  eqGains: number[];
  panX: number;
  panY: number;
  panAuto: boolean;
  audioPresets: AudioPreset[];
  activePresetId: string | null;
  renamePresetId: string | null;
  playlistScrollOffsets: Record<string, number>;
  smoothScrollEnabled: boolean;
  minecraftIntegrationEnabled: boolean;
  mewsifyIntegrationEnabled: boolean;
  sharonMode: boolean;
  sidebarCollapsed: boolean;

  setActiveView: (v: ViewId, skipHistory?: boolean) => void;
  setSharonMode: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setPlaylistScrollOffset: (playlistId: string, offset: number) => void;
  setActivePlaylist: (id: string | null, skipHistory?: boolean) => void;
  setSearchQuery: (q: string) => void;
  setAccentColor: (c: AccentPreset) => void;
  setCustomAccentColor: (c: string) => void;
  addCustomColorToHistory: (c: string) => void;
  setVolume: (v: number) => void;
  setRepeatMode: (m: "off" | "one" | "all") => void;
  toggleShuffle: () => void;
  setGuiScale: (s: number) => void;
  setTrayEnabled: (t: boolean) => void;
  setRoundedCorners: (v: boolean) => void;
  setCustomTitlebar: (v: boolean) => void;
  setFullscreen: (v: boolean) => void;
  setDiscordEnabled: (v: boolean) => void;
  setSystemNotifications: (v: boolean) => void;
  setLowEndMode: (v: boolean) => void;
  setSafeAudioMode: (v: boolean) => void;
  clearDiscordCoverCache: () => void;
  toggleMute: () => void;
  setLibraryViewMode: (m: "grid" | "list") => void;
  setHomeViewMode: (m: "grid" | "list") => void;
  setPlaylistViewMode: (m: "grid" | "list") => void;
  setTheme: (t: "dark" | "light") => void;
  setShowAbout: (v: boolean) => void;
  setEditTrack: (t: Track | null) => void;
  setAddTrack: (t: Track | null) => void;
  setDeleteTrack: (t: Track | null) => void;
  setSharePlaylist: (p: Playlist | null) => void;
  setShowImportPlaylist: (v: boolean) => void;
  setShowCreatePlaylist: (v: boolean) => void;
  setShowCyberdeck: (v: boolean) => void;
  setRenamePresetId: (id: string | null) => void;
  setDemoMode: (v: boolean) => void;
  setDevMode: (v: boolean) => void;
  setReverbEnabled: (v: boolean) => void;
  setReverbStrength: (v: number) => void;
  setPlaybackSpeed: (v: number) => void;
  setBassBoost: (v: number) => void;
  setVolumeBoost: (v: number) => void;
  applyPreset: (id: string) => void;
  savePreset: (name: string) => void;
  deletePreset: (id: string) => void;
  updatePresetName: (id: string, name: string) => void;
  updatePresetSettings: (id: string) => void;
  setEqGain: (index: number, gain: number) => void;
  resetEq: () => void;
  setSpatialPan: (x: number, y: number) => void;
  setPanAuto: (v: boolean) => void;
  resetAudioEffects: () => void;
  setShortcut: (action: keyof ShortcutMap, key: string, ctrl?: boolean, shift?: boolean, alt?: boolean) => void;
  resetShortcuts: () => void;
  goBack: () => void;
  goForward: () => void;
  setSmoothScrollEnabled: (v: boolean) => void;
  setMinecraftIntegrationEnabled: (v: boolean) => void;
  setMewsifyIntegrationEnabled: (v: boolean) => void;



  notifications: Notification[];
  addNotification: (message: string, type?: "info" | "success" | "error", duration?: number, loading?: boolean, title?: string) => string;
  updateNotification: (id: string, updates: Partial<Omit<Notification, "id">>) => void;
  removeNotification: (id: string) => void;
}

// ── Combined Store ────────────────────────────────────────────────────────────

type Store = PlayerSlice & LibrarySlice & UISlice;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // ── Player ──────────────────────────────────────────────────────────────
      currentTrack: null,
      queue: [],
      originalQueue: [],
      queueIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queueSourceId: null,
      seekRequest: null,

      requestSeek: (t) => set({ seekRequest: t }),
      clearSeekRequest: () => set({ seekRequest: null }),

      setCurrentTrack: (track) =>
        set({ currentTrack: track, currentTime: 0 }),

      setQueue: (tracks, startIndex = 0, sourceId = null) => {
        const { shuffleEnabled } = get();
        let finalTracks = [...tracks];
        let finalIndex = startIndex;

        if (shuffleEnabled && tracks.length > 0) {
          const first = tracks[startIndex];
          const rest = tracks.filter((_, i) => i !== startIndex);
          finalTracks = [first, ...shuffleArray(rest)];
          finalIndex = 0;
        }

        set({
          originalQueue: [...tracks],
          queue: finalTracks,
          queueIndex: finalIndex,
          currentTrack: finalTracks[finalIndex] ?? null,
          currentTime: 0,
          queueSourceId: sourceId,
        });
      },

      setIsPlaying: (v) => set({ isPlaying: v }),
      setCurrentTime: (t) => set({ currentTime: t }),
      setDuration: (d) => set({ duration: d }),

      playNext: () => {
        const { queue, queueIndex, repeatMode } = get();
        if (!queue.length) return;

        if (queueIndex < queue.length - 1) {
          const nextIndex = queueIndex + 1;
          set({
            queueIndex: nextIndex,
            currentTrack: queue[nextIndex],
            currentTime: 0,
            isPlaying: true,
          });
        } else {
          if (repeatMode === "all") {
            set({
              queueIndex: 0,
              currentTrack: queue[0],
              currentTime: 0,
              isPlaying: true,
            });
          } else {
            set({ 
              queue: [],
              originalQueue: [],
              queueIndex: 0,
              currentTrack: null,
              currentTime: 0,
              isPlaying: false,
              queueSourceId: null
            });
          }
        }
      },

      playPrev: () => {
        const { queue, queueIndex, currentTime, isPlaying, requestSeek } = get();
        if (!queue.length) return;

        // If past 3s, restart current track
        if (currentTime > 3) {
          set({ currentTime: 0 });
          requestSeek(0);
          return;
        }

        // If at the beginning of hte first track, wrap to the end of the queue
        let prevIndex: number;
        if (queueIndex > 0) {
          prevIndex = queueIndex - 1;
        } else {
          prevIndex = queue.length - 1;
        }

        set({
          queueIndex: prevIndex,
          currentTrack: queue[prevIndex],
          currentTime: 0,
          isPlaying: isPlaying,
        });
      },

      skipForward: () => {
        const { currentTime, duration, requestSeek } = get();
        const nextTime = Math.min(currentTime + 5, duration);
        set({ currentTime: nextTime });
        requestSeek(nextTime);
      },

      skipBackward: () => {
        const { currentTime, requestSeek } = get();
        const nextTime = Math.max(currentTime - 5, 0);
        set({ currentTime: nextTime });
        requestSeek(nextTime);
      },

      syncQueue: (tracks, sourceId) => {
        const { queueSourceId, currentTrack, shuffleEnabled } = get();
        if (queueSourceId !== sourceId) return;

        const newIndex = tracks.findIndex((t) => t.id === currentTrack?.id);

        if (shuffleEnabled) {
          set({ originalQueue: tracks });
        } else {
          set({
            originalQueue: tracks,
            queue: tracks,
            queueIndex: newIndex !== -1 ? newIndex : 0,
          });
        }
      },

      // ── Library ─────────────────────────────────────────────────────────────
      tracks: [],
      virtualTracks: [],
      playlists: [],
      isScanning: false,
      scanProgress: 0,
      musicDir: "",
      playlistsDir: "",
      coversDir: "",
      discordCoverCache: {},

      setTracks: (tracks) =>
        set((s) => {
          const virtuals = s.virtualTracks || [];
          const virtualIds = new Set(virtuals.map((t) => t.id));
          const filteredScanned = tracks.filter((t) => !virtualIds.has(t.id));
          return { tracks: [...filteredScanned, ...virtuals] };
        }),
      updateTrack: (updated: Track) =>
        set((s) => ({
          tracks: s.tracks.map((t) => (t.id === updated.id ? updated : t)),
          virtualTracks: (s.virtualTracks || []).map((t) => (t.id === updated.id ? updated : t)),
          currentTrack: s.currentTrack?.id === updated.id ? updated : s.currentTrack,
          queue: s.queue.map((t) => (t.id === updated.id ? updated : t)),
          originalQueue: s.originalQueue.map((t) => (t.id === updated.id ? updated : t)),
        })),
      addTracks: (incoming) => {
        const existing = get().tracks;
        const ids = new Set(existing.map((t) => t.id));
        const mergedScanned = [...existing, ...incoming.filter((t) => !ids.has(t.id))];

        const virtuals = get().virtualTracks || [];
        const virtualIds = new Set(virtuals.map((t) => t.id));
        const filteredMerged = mergedScanned.filter((t) => !virtualIds.has(t.id));
        set({ tracks: [...filteredMerged, ...virtuals] });
      },
      addVirtualTrack: (track) =>
        set((s) => {
          const virtualTrack = { ...track, provider: "virtual", isVirtual: true };
          const exists = (s.virtualTracks || []).some((t) => t.id === virtualTrack.id);
          const newVirtuals = exists
            ? s.virtualTracks.map((t) => (t.id === virtualTrack.id ? virtualTrack : t))
            : [...(s.virtualTracks || []), virtualTrack];

          const tracksExists = s.tracks.some((t) => t.id === virtualTrack.id);
          const newTracks = tracksExists
            ? s.tracks.map((t) => (t.id === virtualTrack.id ? virtualTrack : t))
            : [...s.tracks, virtualTrack];

          return { virtualTracks: newVirtuals, tracks: newTracks };
        }),
      removeVirtualTrack: (trackId) =>
        set((s) => ({
          virtualTracks: (s.virtualTracks || []).filter((t) => t.id !== trackId),
          tracks: s.tracks.filter((t) => t.id !== trackId),
        })),
      setPlaylists: (incoming) => set((s) => {
        // Keep virtual playlists that don't have a file path
        const virtuals = s.playlists.filter(p => !p.filePath);
        const incomingIds = new Set(incoming.map(p => p.id));
        const filteredVirtuals = virtuals.filter(v => !incomingIds.has(v.id));
        return { playlists: [...incoming, ...filteredVirtuals] };
      }),
      addPlaylist: (p) =>
        set((s) => {
          const exists = s.playlists.some((pl) => pl.id === p.id);
          if (exists) {
            return {
              playlists: s.playlists.map((pl) => (pl.id === p.id ? p : pl)),
            };
          }
          return { playlists: [...s.playlists, p] };
        }),
      updatePlaylist: (p) =>
        set((s) => ({
          playlists: s.playlists.map((pl) => (pl.id === p.id ? p : pl)),
        })),
      removePlaylist: (id) =>
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
      setScanning: (v, progress = 0) =>
        set({ isScanning: v, scanProgress: progress }),
      setMusicDir: (dir) => set({ musicDir: dir }),
      setPlaylistsDir: (dir) => set({ playlistsDir: dir }),
      setCoversDir: (dir) => set({ coversDir: dir }),
      setDiscordCoverCache: (id, url) => set((s) => ({ discordCoverCache: { ...s.discordCoverCache, [id]: url } })),
      removeTrack: (id) => {
        const { tracks, playlists, currentTrack, queue, originalQueue, queueIndex, virtualTracks } = get();

        // Remove from playlists
        const updatedPlaylists = playlists.map(pl => ({
          ...pl,
          trackIds: pl.trackIds.filter(tid => tid !== id)
        }));

        // Remove from queue
        const updatedQueue = queue.filter(t => t.id !== id);
        const updatedOriginalQueue = originalQueue.filter(t => t.id !== id);
        let newIndex = queueIndex;
        let newCurrent = currentTrack;

        if (currentTrack?.id === id) {
          if (updatedQueue.length > 0) {
            newIndex = Math.min(queueIndex, updatedQueue.length - 1);
            newCurrent = updatedQueue[newIndex];
          } else {
            newIndex = -1;
            newCurrent = null;
          }
        } else {
          // Adjust index if an earlier track was removed
          const oldIdx = queue.findIndex(t => t.id === id);
          if (oldIdx !== -1 && oldIdx < queueIndex) {
            newIndex = queueIndex - 1;
          }
        }

        set({
          tracks: tracks.filter(t => t.id !== id),
          virtualTracks: (virtualTracks || []).filter(t => t.id !== id),
          playlists: updatedPlaylists,
          queue: updatedQueue,
          originalQueue: updatedOriginalQueue,
          queueIndex: newIndex,
          currentTrack: newCurrent,
        });
      },
      purgeVirtualTracks: () => {
        const { tracks, playlists, currentTrack, queue, originalQueue, queueIndex } = get();

        // Identify all virtual track IDs
        const virtualTrackIds = new Set(
          tracks
            .filter((t) => t.isVirtual || t.provider === "virtual")
            .map((t) => t.id)
        );

        if (virtualTrackIds.size === 0) return;

        // Remove from playlists
        const updatedPlaylists = playlists.map(pl => ({
          ...pl,
          trackIds: pl.trackIds.filter(tid => !virtualTrackIds.has(tid))
        }));

        // Remove from queue
        const updatedQueue = queue.filter(t => !virtualTrackIds.has(t.id));
        const updatedOriginalQueue = originalQueue.filter(t => !virtualTrackIds.has(t.id));
        let newIndex = queueIndex;
        let newCurrent = currentTrack;

        if (currentTrack && virtualTrackIds.has(currentTrack.id)) {
          if (updatedQueue.length > 0) {
            newIndex = Math.min(queueIndex, updatedQueue.length - 1);
            newCurrent = updatedQueue[newIndex];
          } else {
            newIndex = -1;
            newCurrent = null;
          }
        } else if (currentTrack) {
          // Recalculate current queue index of the playing track in the new queue
          const newIdx = updatedQueue.findIndex(t => t.id === currentTrack.id);
          newIndex = newIdx !== -1 ? newIdx : -1;
        }

        set({
          tracks: tracks.filter(t => !virtualTrackIds.has(t.id)),
          virtualTracks: [],
          playlists: updatedPlaylists,
          queue: updatedQueue,
          originalQueue: updatedOriginalQueue,
          queueIndex: newIndex,
          currentTrack: newCurrent,
        });
      },

      // ── UI ──────────────────────────────────────────────────────────────────
      activeView: "home",
      activePlaylistId: null,
      searchQuery: "",
      accentColor: "mint",
      customAccentColor: "#808080",
      customColorHistory: [],
      volume: 0.8,
      repeatMode: "off",
      shuffleEnabled: false,
      guiScale: 1.15,
      trayEnabled: true,
      libraryViewMode: "list",
      homeViewMode: "list",
      playlistViewMode: "list",
      theme: "dark",
      showAbout: false,
      editTrack: null,
      addTrack: null,
      deleteTrack: null,
      sharePlaylist: null,
      history: [{ view: "home", playlistId: null }],
      historyIndex: 0,
      roundedCorners: true,
      customTitlebar: true,
      isFullscreen: false,
      discordEnabled: true,
      systemNotifications: true,
      lowEndMode: false,
      safeAudioMode: false,
      showImportPlaylist: false,
      showCreatePlaylist: false,
      showCyberdeck: false,
      renamePresetId: null,
      isDemoMode: false,
      isDevMode: false,
      reverbEnabled: false,
      reverbStrength: 0.5,
      playbackSpeed: 1.0,
      bassBoost: 0,
      volumeBoost: 1.0,
      eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      panX: 0,
      panY: 0,
      panAuto: false,
      audioPresets: [
        {
          id: "flat",
          name: "Flat (Default)",
          reverbEnabled: false,
          reverbStrength: 0.5,
          playbackSpeed: 1.0,
          bassBoost: 0,
          volumeBoost: 1.0,
          eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          panX: 0,
          panY: 0,
          panAuto: false
        }
      ],
      activePresetId: "flat",
      playlistScrollOffsets: {},
      smoothScrollEnabled: true,
      minecraftIntegrationEnabled: true,
      mewsifyIntegrationEnabled: false,
      sharonMode: false,
      sidebarCollapsed: false,

      setActiveView: (v, skipHistory = false) => {
        const { history, historyIndex } = get();
        if (!skipHistory) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push({ view: v, playlistId: null });
          set({ history: newHistory, historyIndex: newHistory.length - 1 });
        }
        set({ activeView: v, activePlaylistId: null, searchQuery: "" });
      },

      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setSharonMode: (v) => set({ sharonMode: v }),

      setActivePlaylist: (id, skipHistory = false) => {
        const { history, historyIndex } = get();
        const v = id ? "playlist" : "library" as ViewId;
        if (!skipHistory) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push({ view: v, playlistId: id });
          set({ history: newHistory, historyIndex: newHistory.length - 1 });
        }
        set({ activePlaylistId: id, activeView: v, searchQuery: "" });
      },

      setSearchQuery: (q) => set({ searchQuery: q }),
      setAccentColor: (c) => {
        document.documentElement.dataset.accent = c;
        set({ accentColor: c });
      },
      setCustomAccentColor: (c) => set({ customAccentColor: c }),
      addCustomColorToHistory: (c) => set((s) => {
        const h = [c, ...s.customColorHistory.filter(color => color !== c)].slice(0, 5);
        return { customColorHistory: h };
      }),
      setVolume: (v) => set({ volume: v }),
      setRepeatMode: (m) => set({ repeatMode: m }),
      toggleShuffle: () => {
        const { shuffleEnabled, queue, queueIndex, originalQueue, currentTrack } = get();
        const nextShuffle = !shuffleEnabled;

        if (nextShuffle && queue.length > 0) {
          // Shuffle the part of the queue that hasn't played yet
          const played = queue.slice(0, queueIndex + 1);
          const remaining = queue.slice(queueIndex + 1);
          const shuffled = [...played, ...shuffleArray(remaining)];
          set({ queue: shuffled, shuffleEnabled: nextShuffle });
        } else {
          if (originalQueue.length > 0) {
            const newIndex = originalQueue.findIndex(t => t.id === currentTrack?.id);
            set({
              queue: [...originalQueue],
              queueIndex: newIndex !== -1 ? newIndex : 0,
              shuffleEnabled: nextShuffle
            });
          } else {
            set({ shuffleEnabled: nextShuffle });
          }
        }
      },
      setGuiScale: (s) => set({ guiScale: s }),
      setTrayEnabled: (t) => set({ trayEnabled: t }),
      setRoundedCorners: (v) => set({ roundedCorners: v }),
      setCustomTitlebar: (v) => set({ customTitlebar: v }),
      setFullscreen: (v) => set({ isFullscreen: v }),
      setDiscordEnabled: (v) => set({ discordEnabled: v }),
      setSystemNotifications: (v) => set({ systemNotifications: v }),
      setLowEndMode: (v) => set({ lowEndMode: v }),
      setSafeAudioMode: (v) => {
        set({ safeAudioMode: v });
        get().addNotification(
          "Safe Audio Mode changed. Please press Ctrl+Shift+R to reload the app and apply changes.",
          "info",
          5000,
          false,
          "Audio Engine Restart Required"
        );
      },
      clearDiscordCoverCache: () => set({ discordCoverCache: {} }),
      setSmoothScrollEnabled: (v) => set({ smoothScrollEnabled: v }),
      setMinecraftIntegrationEnabled: (v) => {
        set({ minecraftIntegrationEnabled: v });
        get().addNotification(
          "Plugin settings changed. Please press Ctrl+Shift+R to reload the app.",
          "info",
          5000,
          false,
          "Reload Required"
        );
      },
      setMewsifyIntegrationEnabled: (v) => {
        set({ mewsifyIntegrationEnabled: v });
        get().addNotification(
          "Plugin settings changed. Please press Ctrl+Shift+R to reload the app.",
          "info",
          5000,
          false,
          "Reload Required"
        );
      },

      shortcuts: {
        togglePlay: { key: "Space", ctrl: false, shift: false, alt: false },
        skipForward: { key: "ArrowRight", ctrl: false, shift: false, alt: false },
        skipBackward: { key: "ArrowLeft", ctrl: false, shift: false, alt: false },
        playNext: { key: "ArrowRight", ctrl: true, shift: false, alt: false },
        playPrev: { key: "ArrowLeft", ctrl: true, shift: false, alt: false },
        volumeUp: { key: "ArrowUp", ctrl: false, shift: false, alt: false },
        volumeDown: { key: "ArrowDown", ctrl: false, shift: false, alt: false },
      },

      setShortcut: (action, key, ctrl = false, shift = false, alt = false) => {
        set((s) => ({
          shortcuts: {
            ...s.shortcuts,
            [action]: { key, ctrl, shift, alt },
          },
        }));
      },

      resetShortcuts: () => {
        set({
          shortcuts: {
            togglePlay: { key: "Space", ctrl: false, shift: false, alt: false },
            skipForward: { key: "ArrowRight", ctrl: false, shift: false, alt: false },
            skipBackward: { key: "ArrowLeft", ctrl: false, shift: false, alt: false },
            playNext: { key: "ArrowRight", ctrl: true, shift: false, alt: false },
            playPrev: { key: "ArrowLeft", ctrl: true, shift: false, alt: false },
            volumeUp: { key: "ArrowUp", ctrl: false, shift: false, alt: false },
            volumeDown: { key: "ArrowDown", ctrl: false, shift: false, alt: false },
          },
        });
      },
      lastVolume: 0.8,
      toggleMute: () => {
        const { volume, lastVolume } = get();
        if (volume > 0) {
          set({ lastVolume: volume, volume: 0 });
        } else {
          set({ volume: lastVolume > 0 ? lastVolume : 0.7 });
        }
      },
      setLibraryViewMode: (m) => set({ libraryViewMode: m }),
      setHomeViewMode: (m) => set({ homeViewMode: m }),
      setPlaylistViewMode: (m) => set({ playlistViewMode: m }),
      setPlaylistScrollOffset: (playlistId, offset) => set((s) => ({
        playlistScrollOffsets: { ...s.playlistScrollOffsets, [playlistId]: offset }
      })),
      setTheme: (t) => set({ theme: t }),
      setShowAbout: (v) => set({ showAbout: v }),
      setEditTrack: (t) => set({ editTrack: t }),
      setAddTrack: (t) => set({ addTrack: t }),
      setDeleteTrack: (t) => set({ deleteTrack: t }),
      setSharePlaylist: (p) => set({ sharePlaylist: p }),
      setShowImportPlaylist: (v) => set({ showImportPlaylist: v }),
      setShowCreatePlaylist: (v) => set({ showCreatePlaylist: v }),
      setShowCyberdeck: (v) => set({ showCyberdeck: v }),
      setRenamePresetId: (id) => set({ renamePresetId: id }),
      setDemoMode: (v) => set({ isDemoMode: v }),
      setDevMode: (v) => {
        invoke("set_dev_mode", { enabled: v }).catch(() => { });
        set({ isDevMode: v });
      },
      setReverbEnabled: (v) => set({ reverbEnabled: v }),
      setReverbStrength: (v) => set({ reverbStrength: v }),
      setPlaybackSpeed: (v) => set({ playbackSpeed: Math.max(0.5, Math.min(v, 2.0)) }),
      setBassBoost: (v) => set({ bassBoost: v }),
      setVolumeBoost: (v) => set({ volumeBoost: v }),
      applyPreset: (id) => set((s) => {
        const preset = s.audioPresets.find(p => p.id === id);
        if (!preset) return s;
        return {
          activePresetId: id,
          reverbEnabled: preset.reverbEnabled,
          reverbStrength: preset.reverbStrength,
          playbackSpeed: preset.playbackSpeed,
          bassBoost: preset.bassBoost,
          volumeBoost: preset.volumeBoost,
          eqGains: [...preset.eqGains],
          panX: preset.panX ?? 0,
          panY: preset.panY ?? 0,
          panAuto: preset.panAuto ?? false,
        };
      }),
      savePreset: (name) => set((s) => {
        const id = `preset-${Date.now()}`;
        const newPreset: AudioPreset = {
          id,
          name,
          reverbEnabled: s.reverbEnabled,
          reverbStrength: s.reverbStrength,
          playbackSpeed: s.playbackSpeed,
          bassBoost: s.bassBoost,
          volumeBoost: s.volumeBoost,
          eqGains: [...s.eqGains],
          panX: s.panX,
          panY: s.panY,
          panAuto: s.panAuto,
        };
        return {
          audioPresets: [...s.audioPresets, newPreset],
          activePresetId: id
        };
      }),
      deletePreset: (id) => set((s) => ({
        audioPresets: s.audioPresets.filter(p => p.id !== id),
        activePresetId: s.activePresetId === id ? null : s.activePresetId
      })),
      updatePresetName: (id, name) => set((s) => ({
        audioPresets: s.audioPresets.map(p => p.id === id ? { ...p, name } : p)
      })),
      updatePresetSettings: (id) => set((s) => ({
        audioPresets: s.audioPresets.map(p => p.id === id ? {
          ...p,
          reverbEnabled: s.reverbEnabled,
          reverbStrength: s.reverbStrength,
          playbackSpeed: s.playbackSpeed,
          bassBoost: s.bassBoost,
          volumeBoost: s.volumeBoost,
          eqGains: [...s.eqGains],
          panX: s.panX,
          panY: s.panY,
          panAuto: s.panAuto,
        } : p)
      })),
      setEqGain: (index, gain) => set((s) => {
        const next = [...(s.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])];
        next[index] = gain;
        return { eqGains: next };
      }),
      resetEq: () => set({ eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }),
      resetAudioEffects: () => set({
        volume: 0.8,
        reverbEnabled: false,
        reverbStrength: 0.5,
        playbackSpeed: 1.0,
        bassBoost: 0,
        volumeBoost: 1.0,
        eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        panX: 0,
        panY: 0,
        panAuto: false
      }),
      setSpatialPan: (x, y) => set({ panX: x, panY: y }),
      setPanAuto: (v) => set({ panAuto: v }),
      goBack: () => {
        const { history, historyIndex, setActiveView, setActivePlaylist } = get();
        if (historyIndex > 0) {
          const prev = history[historyIndex - 1];
          set({ historyIndex: historyIndex - 1 });
          if (prev.view === "playlist") {
            setActivePlaylist(prev.playlistId, true);
          } else {
            setActiveView(prev.view, true);
          }
        }
      },
      goForward: () => {
        const { history, historyIndex, setActiveView, setActivePlaylist } = get();
        if (historyIndex < history.length - 1) {
          const next = history[historyIndex + 1];
          set({ historyIndex: historyIndex + 1 });
          if (next.view === "playlist") {
            setActivePlaylist(next.playlistId, true);
          } else {
            setActiveView(next.view, true);
          }
        }
      },


      notifications: [],
      addNotification: (message, type = "info", duration = 5000, loading = false, title) => {
        const id = Math.random().toString(36).substring(7);
        set((s) => ({
          notifications: [...s.notifications, { id, message, type, loading, title }],
        }));
        if (duration > 0) {
          setTimeout(() => get().removeNotification(id), duration);
        }
        return id;
      },
      updateNotification: (id, updates) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, ...updates } : n
          ),
        })),
      removeNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),
    }),
    {
      name: "mewsic-storage",
      // Only persist settings & library dirs, not the full track list
      partialize: (s) => ({
        tracks: s.tracks,
        playlists: s.playlists,
        accentColor: s.accentColor,
        volume: s.volume,
        repeatMode: s.repeatMode,
        shuffleEnabled: s.shuffleEnabled,
        musicDir: s.musicDir,
        playlistsDir: s.playlistsDir,
        coversDir: s.coversDir,
        virtualTracks: s.virtualTracks,
        guiScale: s.guiScale,
        trayEnabled: s.trayEnabled,
        libraryViewMode: s.libraryViewMode,
        homeViewMode: s.homeViewMode,
        playlistViewMode: s.playlistViewMode,
        theme: s.theme,
        roundedCorners: s.roundedCorners,
        customTitlebar: s.customTitlebar,
        discordEnabled: s.discordEnabled,
        systemNotifications: s.systemNotifications,
        lowEndMode: s.lowEndMode,
        safeAudioMode: s.safeAudioMode,
        discordCoverCache: s.discordCoverCache,
        shortcuts: s.shortcuts,
        reverbEnabled: s.reverbEnabled,
        reverbStrength: s.reverbStrength,
        playbackSpeed: s.playbackSpeed,
        bassBoost: s.bassBoost,
        volumeBoost: s.volumeBoost,
        eqGains: s.eqGains,
        audioPresets: s.audioPresets,
        activePresetId: s.activePresetId,
        playlistScrollOffsets: s.playlistScrollOffsets,
        smoothScrollEnabled: s.smoothScrollEnabled,
        minecraftIntegrationEnabled: s.minecraftIntegrationEnabled,
        mewsifyIntegrationEnabled: s.mewsifyIntegrationEnabled,
      }),
    }
  )
);
