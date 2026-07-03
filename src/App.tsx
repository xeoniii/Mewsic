import React, { useEffect } from "react";
import { useStore } from "./store";
import { useShallow } from "zustand/react/shallow";
import { useLibrary } from "./hooks/useLibrary";
import { useMediaControls } from "./hooks/useMediaControls";
import { usePlugins } from "./hooks/usePlugins";
import { getAppPaths, setTrayEnabled, toggleFullscreen, forceQuit } from "./utils/tauriApi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch, exit } from "@tauri-apps/plugin-process";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { PlayerBar } from "./components/Player/PlayerBar";
import { HomeView } from "./components/Dashboard/HomeView";
import { LibraryView } from "./components/Library/LibraryView";
import { PlaylistView } from "./components/Library/PlaylistView";
import { LyricsView } from "./components/Player/LyricsView";
import HarbourView from "./components/Harbour/HarbourView";
import { AudioView } from "./components/Audio/AudioView";
import { QueueView } from "./components/Player/QueueView";
import { SettingsView } from "./components/Settings/SettingsView";
import { PluginsView } from "./components/Plugins/PluginsView";
import { ToastContainer } from "./components/UI/Toast";
import { ContextMenu } from "./components/UI/ContextMenu";
import { AboutModal } from "./components/UI/AboutModal";
import { EditMetadataModal } from "./components/Library/EditMetadataModal";
import { AddToPlaylistModal } from "./components/Library/AddToPlaylistModal";
import { ImportPlaylistModal } from "./components/Library/ImportPlaylistModal";
import { CreatePlaylistModal } from "./components/Library/CreatePlaylistModal";
import { SharePlaylistModal } from "./components/Library/SharePlaylistModal";
import { ConfirmationModal } from "./components/UI/ConfirmationModal";
import { deleteTrack } from "./utils/tauriApi";
import { TitleBar } from "./components/UI/TitleBar";
import { Cyberdeck } from "./components/UI/Cyberdeck";
import { DevOverlay } from "./components/UI/DevOverlay";
import { GlobalTooltip } from "./components/UI/GlobalTooltip";
import { PluginView } from "./components/UI/PluginView";

function ViewRouter() {
  const { activeView } = useStore(useShallow((s) => ({ activeView: s.activeView })));

  if (activeView && activeView.startsWith("plugin:")) {
    return <PluginView viewId={activeView} />;
  }

  switch (activeView) {
    case "home":     return <HomeView />;
    case "library":  return <LibraryView />;
    case "playlist": return <PlaylistView />;
    case "player":   return <LyricsView />;
    case "queue":    return <QueueView />;
    case "harbour":  return <HarbourView />;
    case "audio":    return <AudioView />;
    case "plugins":  return <PluginsView />;
    case "settings": return <SettingsView />;
    default:         return <HomeView />;
  }
}
const lastKeyTime: Record<string, number> = {};

export default function App() {
  const {
    activeView, accentColor, customAccentColor, theme, musicDir, playlistsDir, coversDir,
    setMusicDir, setPlaylistsDir, setCoversDir, guiScale, showAbout,
    editTrack, addTrack, deleteTrackRequest, setEditTrack, setAddTrack,
    setDeleteTrack, removeTrack, addNotification, roundedCorners, customTitlebar,
    setFullscreen, isFullscreen, lowEndMode, shortcuts,
    showImportPlaylist, setShowImportPlaylist,
    showCreatePlaylist, setShowCreatePlaylist,
    showCyberdeck, setShowCyberdeck, setShowAbout,
    sharePlaylist, setSharePlaylist
  } = useStore(useShallow((s) => ({
    activeView: s.activeView,
    accentColor: s.accentColor,
    customAccentColor: s.customAccentColor,
    theme: s.theme,
    musicDir: s.musicDir,
    playlistsDir: s.playlistsDir,
    coversDir: s.coversDir,
    setMusicDir: s.setMusicDir,
    setPlaylistsDir: s.setPlaylistsDir,
    setCoversDir: s.setCoversDir,
    guiScale: s.guiScale,
    showAbout: s.showAbout,
    editTrack: s.editTrack,
    addTrack: s.addTrack,
    deleteTrackRequest: s.deleteTrack,
    setEditTrack: s.setEditTrack,
    setAddTrack: s.setAddTrack,
    setDeleteTrack: s.setDeleteTrack,
    removeTrack: s.removeTrack,
    addNotification: s.addNotification,
    roundedCorners: s.roundedCorners,
    customTitlebar: s.customTitlebar,
    setFullscreen: s.setFullscreen,
    isFullscreen: s.isFullscreen,
    lowEndMode: s.lowEndMode,
    shortcuts: s.shortcuts,
    showImportPlaylist: s.showImportPlaylist,
    setShowImportPlaylist: s.setShowImportPlaylist,
    showCreatePlaylist: s.showCreatePlaylist,
    setShowCreatePlaylist: s.setShowCreatePlaylist,
    showCyberdeck: s.showCyberdeck,
    setShowCyberdeck: s.setShowCyberdeck,
    setShowAbout: s.setShowAbout,
    sharePlaylist: s.sharePlaylist,
    setSharePlaylist: s.setSharePlaylist,
  })));


  const { initialize } = useLibrary();

  // Load plugins
  usePlugins(true);

  // OS media controls (MPRIS / SMTC / Now Playing)
  useMediaControls(); // Sync with OS Media Controls Interface

  useEffect(() => {
    document.documentElement.dataset.accent = accentColor;
    if (accentColor === "custom") {
      const hex = customAccentColor;
      
      // Convert hex to rgb
      const r = parseInt(hex.slice(1, 3), 16) || 255;
      const g = parseInt(hex.slice(3, 5), 16) || 255;
      const b = parseInt(hex.slice(5, 7), 16) || 255;
      const rgb = `${r}, ${g}, ${b}`;

      document.documentElement.style.setProperty("--accent", hex);
      document.documentElement.style.setProperty("--text-accent", hex);
      document.documentElement.style.setProperty("--accent-rgb", rgb);
      document.documentElement.style.setProperty("--accent-muted", `rgba(${rgb}, 0.15)`);
      document.documentElement.style.setProperty("--accent-glow", `rgba(${rgb}, 0.35)`);
      document.documentElement.style.setProperty("--accent-dim", hex);
      document.documentElement.style.setProperty("--accent-bright", hex);
    } else {
      document.documentElement.style.removeProperty("--accent");
      document.documentElement.style.removeProperty("--text-accent");
      document.documentElement.style.removeProperty("--accent-rgb");
      document.documentElement.style.removeProperty("--accent-muted");
      document.documentElement.style.removeProperty("--accent-glow");
      document.documentElement.style.removeProperty("--accent-dim");
      document.documentElement.style.removeProperty("--accent-bright");
    }
  }, [accentColor, customAccentColor]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.lowend = String(lowEndMode);
  }, [lowEndMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      invoke("set_window_decorations", { decorations: !customTitlebar }).catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${guiScale * 14}px`;
  }, [guiScale]);

  useEffect(() => {
    const updateFullscreen = async () => {
      const win = getCurrentWindow();
      const full = await win.isFullscreen();
      setFullscreen(full);
    };

    updateFullscreen();
    
    const unlistenEvent = listen<boolean>("fullscreen-changed", (event) => {
      setFullscreen(event.payload);
    });

    const unlistenResize = getCurrentWindow().onResized(() => {
      updateFullscreen();
    });

    // DOM resize listener
    window.addEventListener("resize", updateFullscreen);

    return () => {
      unlistenEvent.then((fn) => fn());
      unlistenResize.then((fn) => fn());
      window.removeEventListener("resize", updateFullscreen);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.fullscreen = isFullscreen.toString();
  }, [isFullscreen]);

  useEffect(() => {
    async function bootstrap() {
      // Sync initial tray state
      setTrayEnabled(useStore.getState().trayEnabled).catch(() => {});

      // Sync initial dev mode state with Rust backend to sleep telemetry when not in use
      invoke("set_dev_mode", { enabled: useStore.getState().isDevMode }).catch(() => {});

      if (!musicDir || !playlistsDir || !coversDir) {
        const paths = await getAppPaths();
        if (!musicDir) setMusicDir(paths.musicDir);
        if (!playlistsDir) setPlaylistsDir(paths.playlistsDir);
        if (!coversDir) setCoversDir(paths.coversDir);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await check();
        if (update?.available) {
          addNotification(
            `Mewsic v${update.version} is available.`,
            "info",
            0,
            false,
            "Update Available"
          );
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
      }
    }
    const timer = setTimeout(checkForUpdates, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const AUDIO_EXTENSIONS = new Set(["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "aiff", "aif", "wma"]);

    const unlisten = listen<string>("open-file", async (event) => {
      const filePath = event.payload;
      if (!filePath) return;

      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

      if (ext === "mewsic") {
        // Plugin install — copy the folder to the plugins dir and prompt a reload
        try {
          await invoke("install_plugin_from_path", { path: filePath });
          addNotification(
            "Plugin installed. Reload Mewsic to activate it.",
            "success",
            0,
            false,
            "Plugin Installed"
          );
        } catch (e) {
          addNotification(`Failed to install plugin: ${e}`, "error");
        }
        return;
      }

      if (AUDIO_EXTENSIONS.has(ext)) {
        const name = filePath.split(/[\\/]/).pop() ?? filePath;
        const title = name.replace(/\.[^.]+$/, "");
        const track: any = {
          id: `file-open-${Date.now()}`,
          title,
          artist: "Unknown Artist",
          album: "Unknown Album",
          albumArtist: "Unknown Artist",
          genre: "Unknown",
          duration: 0,
          filePath,
          fileName: title,
          fileSize: 0,
          format: "Unknown",
          dateAdded: Math.floor(Date.now() / 1000),
          coverArt: "",
        };
        useStore.getState().setQueue([track], 0, "file-open");
        useStore.getState().setIsPlaying(true);
        useStore.getState().setActiveView("home");
      }
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    if (musicDir && playlistsDir) {
      initialize();
    }
  }, [musicDir, playlistsDir]);

  useEffect(() => {
    const shouldReturnToSettings = localStorage.getItem("returnToSettings");
    if (shouldReturnToSettings === "true") {
      localStorage.removeItem("returnToSettings");
      useStore.getState().setActiveView("settings");
    }

    const shouldReturnToPlugins = localStorage.getItem("returnToPlugins");
    if (shouldReturnToPlugins === "true") {
      localStorage.removeItem("returnToPlugins");
      useStore.getState().setActiveView("plugins");
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const {
        isPlaying, setIsPlaying, currentTrack,
        skipForward, skipBackward, playNext, playPrev,
        volume, setVolume, shortcuts
      } = useStore.getState();

      const matches = (s: { key: string, ctrl: boolean, shift: boolean, alt: boolean }) => {
        const keyMatch = e.key === s.key || (s.key === "Space" && e.code === "Space");
        return keyMatch && e.ctrlKey === s.ctrl && e.shiftKey === s.shift && e.altKey === s.alt;
      };

      const rateLimitRepeat = (code: string) => {
        if (!e.repeat) {
          lastKeyTime[code] = Date.now();
          return true;
        }
        const now = Date.now();
        if (now - (lastKeyTime[code] || 0) < 500) return false;
        lastKeyTime[code] = now;
        return true;
      };

      if (matches(shortcuts.togglePlay)) {
        if (!rateLimitRepeat(e.code)) return;
        e.preventDefault();
        if (!currentTrack) return;
        setIsPlaying(!isPlaying);
      } else if (matches(shortcuts.skipForward)) {
        if (!rateLimitRepeat(e.code)) return;
        e.preventDefault();
        if (!currentTrack) return;
        skipForward();
      } else if (matches(shortcuts.skipBackward)) {
        if (!rateLimitRepeat(e.code)) return;
        e.preventDefault();
        if (!currentTrack) return;
        skipBackward();
      } else if (matches(shortcuts.playNext)) {
        if (!rateLimitRepeat(e.code)) return;
        e.preventDefault();
        playNext();
      } else if (matches(shortcuts.playPrev)) {
        if (!rateLimitRepeat(e.code)) return;
        e.preventDefault();
        playPrev();
      } else if (matches(shortcuts.volumeUp)) {
        e.preventDefault();
        setVolume(Math.min(volume + 0.02, 1));
      } else if (matches(shortcuts.volumeDown)) {
        e.preventDefault();
        setVolume(Math.max(volume - 0.02, 0));
      }
    };
    const onGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        if (e.repeat) return;
        e.preventDefault();
        toggleFullscreen().catch(() => {});
      } else if (e.ctrlKey && e.shiftKey && e.code === "Backquote") {
        if (e.repeat) return;
        e.preventDefault();
        setShowCyberdeck(!showCyberdeck);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyQ") {
        if (e.repeat) return;
        e.preventDefault();
        forceQuit();
      } else if (e.ctrlKey && e.shiftKey && e.code === "KeyR") {
        if (e.repeat) return;
        e.preventDefault();
        window.location.reload();
      } else if (e.ctrlKey && e.shiftKey && e.code === "KeyD") {
        if (e.repeat) return;
        e.preventDefault();
        const { isDevMode, setDevMode, addNotification } = useStore.getState();
        const newState = !isDevMode;
        setDevMode(newState);
        addNotification(`Developer Mode: ${newState ? 'ON' : 'OFF'}`, newState ? "success" : "info");
      } else if (e.key === "Escape") {
        if (e.repeat) return;
        // Close any open modals
        if (showAbout) setShowAbout(false);
        if (editTrack) setEditTrack(null);
        if (addTrack) setAddTrack(null);
        if (deleteTrackRequest) setDeleteTrack(null);
        if (showImportPlaylist) setShowImportPlaylist(false);
        if (showCreatePlaylist) setShowCreatePlaylist(false);
        if (showCyberdeck) setShowCyberdeck(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onGlobalShortcuts);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onGlobalShortcuts);
    };
  }, [showAbout, editTrack, addTrack, deleteTrackRequest, showImportPlaylist, showCreatePlaylist, showCyberdeck]);

  const handleDeleteConfirm = async () => {
    if (!deleteTrackRequest) return;
    try {
      const isVirtual = deleteTrackRequest.isVirtual || deleteTrackRequest.provider === "virtual";
      if (!isVirtual) {
        await deleteTrack(deleteTrackRequest.filePath);
        addNotification(`Deleted "${deleteTrackRequest.title}" from disk`, "info");
      } else {
        addNotification(`Removed "${deleteTrackRequest.title}" from library`, "info");
      }
      removeTrack(deleteTrackRequest.id);
    } catch (err: any) {
      addNotification(`Failed to delete: ${err.message}`, "error");
    } finally {
      setDeleteTrack(null);
    }
  };
  const showPlayerBar = activeView !== "player";

  return (
    <div
      className={`flex flex-col ${roundedCorners && !isFullscreen ? "rounded-xl overflow-hidden" : ""}`}
      style={{
        height: "100vh",
        background: "var(--surface-base)",
      }}
    >
      <DevOverlay />
      <TitleBar />
      {
  // This is the main workspace part
}
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-hidden relative">
          <ViewRouter />
        </main>
      </div>

      {
  // This is the persistent player bar part
}
      <PlayerBar />

      {
  // This is the global notifications part
}
      <ToastContainer />

      {
  // This is the custom context menu part
}
      <ContextMenu />

      {
  // This is the global modals part
}
      {showAbout && <AboutModal />}

      {editTrack && (
        <EditMetadataModal
          track={editTrack}
          onClose={() => setEditTrack(null)}
        />
      )}

      {addTrack && (
        <AddToPlaylistModal
          track={addTrack}
          onClose={() => setAddTrack(null)}
        />
      )}

      {deleteTrackRequest && (
        <ConfirmationModal
          title={deleteTrackRequest.isVirtual || deleteTrackRequest.provider === "virtual" ? "Remove Track?" : "Delete Track?"}
          message={deleteTrackRequest.isVirtual || deleteTrackRequest.provider === "virtual" 
            ? `Are you sure you want to remove "${deleteTrackRequest.title}" from your library?`
            : `Are you sure you want to permanently delete "${deleteTrackRequest.title}"? This cannot be undone.`}
          confirmLabel={deleteTrackRequest.isVirtual || deleteTrackRequest.provider === "virtual" ? "Remove" : "Delete"}
          cancelLabel="Cancel"
          variant={deleteTrackRequest.isVirtual || deleteTrackRequest.provider === "virtual" ? "warning" : "danger"}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTrack(null)}
        />
      )}
      
      {showImportPlaylist && (
        <ImportPlaylistModal 
          onClose={() => setShowImportPlaylist(false)} 
        />
      )}

      {showCreatePlaylist && (
        <CreatePlaylistModal 
          onClose={() => setShowCreatePlaylist(false)} 
        />
      )}

      {showCyberdeck && (
        <Cyberdeck onClose={() => setShowCyberdeck(false)} />
      )}

      {sharePlaylist && (
        <SharePlaylistModal
          playlist={sharePlaylist}
          onClose={() => setSharePlaylist(null)}
        />
      )}

      {
  // This is the custom global tooltip overlay part
}
      <GlobalTooltip />
    </div>
  );
}
