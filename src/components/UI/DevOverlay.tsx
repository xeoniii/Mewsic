import React, { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../../store";
import { useLibrary } from "../../hooks/useLibrary";
import { toggleFullscreen } from "../../utils/tauriApi";
import type { AccentPreset, ViewId, Track, Playlist } from "../../types";

import { ConfirmationModal } from "./ConfirmationModal";
import { ColorPickerModal } from "../Settings/ColorPickerModal";
import { ManagePlaylistTracksModal } from "../Library/ManagePlaylistTracksModal";
import { EditPlaylistModal } from "../Library/EditPlaylistModal";

interface AppStats {
  cpu: number;
  memory: number;
}

export function DevOverlay() {
  const isDevMode = useStore((s) => s.isDevMode);

  // System Stats
  const [stats, setStats] = useState<AppStats | null>(null);
  const [fps, setFps] = useState<number>(60);
  const [frameTime, setFrameTime] = useState<number>(16.6);

  // Dev Control Window State
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "modals" | "events" | "audio" | "visuals" | "statistics" | "log"
  >("modals");
  const [showBanner, setShowBanner] = useState(true);

  // Position and Dragging (Top-Left by default)
  const [pos, setPos] = useState({ x: 12, y: 12 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  // Local Modal Previews triggered from Dev Control
  const [localConfirmModal, setLocalConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
  } | null>(null);
  const [showLocalColorPicker, setShowLocalColorPicker] = useState(false);
  const [showLocalManageTracks, setShowLocalManageTracks] = useState(false);
  const [showLocalEditPlaylist, setShowLocalEditPlaylist] = useState(false);

  // Trigger values & Inputs
  const [mockVersion, setMockVersion] = useState("1.0.1");
  const [toastMsg, setToastMsg] = useState("Mewsic Dev Control test notification");
  const [customDialogTitle, setCustomDialogTitle] = useState("Confirm Action");
  const [customDialogMessage, setCustomDialogMessage] = useState("Are you sure you want to proceed with this test operation?");
  const [customDialogVariant, setCustomDialogVariant] = useState<"danger" | "warning" | "info">("danger");

  // Filter input
  const [filterText, setFilterText] = useState("");

  // Event Log
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Mewsic Dev Control v1.0 initialized`,
    `[${new Date().toLocaleTimeString()}] Dev subsystem attached. Press HOME to toggle control panel.`,
  ]);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 100)]);
  };

  // Store bindings
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    playNext,
    playPrev,
    skipForward,
    skipBackward,
    queue,
    tracks,
    playlists,
    activeView,
    setActiveView,
    addNotification,
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    customAccentColor,
    setCustomAccentColor,
    lowEndMode,
    setLowEndMode,
    guiScale,
    setGuiScale,
    customTitlebar,
    setCustomTitlebar,
    reverbEnabled,
    setReverbEnabled,
    reverbStrength,
    setReverbStrength,
    playbackSpeed,
    setPlaybackSpeed,
    bassBoost,
    setBassBoost,
    volumeBoost,
    setVolumeBoost,
    panAuto,
    setPanAuto,
    safeAudioMode,
    setSafeAudioMode,
    volume,
    setVolume,
    toggleMute,
    shuffleEnabled,
    toggleShuffle,
    repeatMode,
    setRepeatMode,
    isDemoMode,
    setDemoMode,
    purgeVirtualTracks,
    setShowAbout,
    setEditTrack,
    setAddTrack,
    setDeleteTrack,
    setSharePlaylist,
    setShowImportPlaylist,
    setShowCreatePlaylist,
    showCyberdeck,
    setShowCyberdeck,
    setShowUpdatePrompt,
    setPendingUpdateVersion,
    setShowUpdateModal,
    setShowSplashScreen,
  } = useStore();

  const { rescanDirectory } = useLibrary();

  // Hide startup banner after 6 seconds
  useEffect(() => {
    if (!isDevMode) return;
    const timer = setTimeout(() => setShowBanner(false), 6000);
    return () => clearTimeout(timer);
  }, [isDevMode]);

  // Telemetry listener and FPS counter
  useEffect(() => {
    if (!isDevMode) {
      setStats(null);
      return;
    }

    const unlisten = listen<AppStats>("app-stats", (event) => {
      setStats(event.payload);
    });

    let frameCount = 0;
    let lastTime = performance.now();
    let rAF: number;

    const loop = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        setFrameTime(parseFloat((1000 / (frameCount || 1)).toFixed(1)));
        frameCount = 0;
        lastTime = now;
      }
      rAF = requestAnimationFrame(loop);
    };
    rAF = requestAnimationFrame(loop);

    return () => {
      unlisten.then((f) => f());
      cancelAnimationFrame(rAF);
    };
  }, [isDevMode]);

  // HOTKEY: Home key exclusively toggles Mewsic Dev Control (strictly when dev mode is active)
  useEffect(() => {
    if (!isDevMode) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Home") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setShowBanner(false);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isDevMode, isOpen]);

  // Drag listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 440, dragRef.current.initX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.initY + dy)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const startDrag = (e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    };
    setIsDragging(true);
  };

  // Sine test beep
  const playTestTone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      addLog("Audio DSP: Played 440Hz A4 test sine tone");
    } catch (e: any) {
      addLog(`Audio DSP error: ${e?.message || e}`);
    }
  };

  // MUST NOT WORK WITHOUT DEVMODE
  if (!isDevMode) return null;

  const memMB = stats ? (stats.memory / (1024 * 1024)).toFixed(1) : "0.0";
  const cpuPercent = stats ? stats.cpu.toFixed(1) : "0.0";

  // Mock track & playlist for testing modals
  const sampleTrack: Track = currentTrack || (tracks && tracks.length > 0 ? tracks[0] : {
    id: "mock-track-dev",
    title: "Resonance",
    artist: "HOME",
    album: "Odyssey",
    albumArtist: "HOME",
    duration: 212,
    filePath: "C:\\Music\\HOME - Resonance.mp3",
    fileName: "HOME - Resonance.mp3",
    fileSize: 8450123,
    format: "mp3",
    dateAdded: Date.now(),
    year: 2014,
    genre: "Synthwave",
    provider: "local",
  });

  const samplePlaylist: Playlist = (playlists && playlists.length > 0 ? playlists[0] : {
    id: "mock-playlist-dev",
    name: "Night Drive Favorites",
    filePath: "C:\\Playlists\\NightDrive.json",
    trackIds: [sampleTrack.id],
    tracks: [sampleTrack],
    createdAt: Date.now(),
  });

  const ACCENTS: AccentPreset[] = [
    "mint",
    "sapphire",
    "violet",
    "rose",
    "amber",
    "cyan",
    "orange",
    "fuchsia",
    "emerald",
  ];

  const VIEWS: { id: ViewId; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "library", label: "Library" },
    { id: "playlist", label: "Playlist" },
    { id: "player", label: "Lyrics" },
    { id: "queue", label: "Queue" },
    { id: "harbour", label: "Harbour" },
    { id: "audio", label: "Audio DSP" },
    { id: "plugins", label: "Plugins" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      {/* ── 1. Restored Original CPU, RAM & FPS HUD Overlay (Bottom-Left) ── */}
      <div className="fixed bottom-32 left-10 z-[9999] pointer-events-none select-none">
        <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 flex flex-col gap-1 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">CPU</span>
            <span className={`text-xs font-mono font-bold ${stats && stats.cpu > 50 ? "text-red-400" : "text-accent"}`}>
              {cpuPercent}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">FPS</span>
            <span className={`text-xs font-mono font-bold ${fps < 30 ? "text-red-400" : fps < 50 ? "text-yellow-400" : "text-accent"}`}>
              {fps}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">RAM</span>
            <span className="text-xs font-mono font-bold text-accent">
              {memMB} MB
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Top-Left Startup Notification Banner ── */}
      {showBanner && !isOpen && (
        <div
          style={{
            position: "fixed",
            top: 10,
            left: 10,
            zIndex: 999999,
            pointerEvents: "none",
            userSelect: "none",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Consolas, monospace',
            fontSize: "12px",
            lineHeight: 1.4,
            backgroundColor: "rgba(22, 26, 32, 0.94)",
            border: "1px solid #364150",
            color: "#d8dee9",
            padding: "8px 12px",
            boxShadow: "0 6px 16px rgba(0, 0, 0, 0.8), 0 0 1px 1px #252d38",
            borderRadius: 0,
            maxWidth: "460px",
          }}
        >
          <div style={{ color: "#88c0d0", fontWeight: "bold", fontSize: "12px" }}>
            Mewsic Dev Control
          </div>
          <div style={{ color: "#d8dee9", marginTop: "2px" }}>
            Press <span style={{ color: "#ebcb8b", fontWeight: "bold" }}>Home</span> to toggle developer control panel.
          </div>
          <div style={{ color: "#616e85", fontSize: "10px", marginTop: "2px" }}>
            Dev Mode Active (Ctrl + Shift + D to toggle)
          </div>
        </div>
      )}

      {/* ── 3. Mewsic Dev Control Window (Dear ImGui Slate Style, Zero Rounded Corners) ── */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            zIndex: 999999,
            width: "560px",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1b1f26",
            border: "1px solid #364152",
            boxShadow: "0 14px 40px rgba(0, 0, 0, 0.95), 0 0 1px 1px #29323f",
            color: "#d8dee9",
            userSelect: "none",
            fontSize: "12px",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Consolas, monospace',
            borderRadius: 0,
          }}
        >
          {/* ImGui TitleBar */}
          <div
            onMouseDown={startDrag}
            style={{
              padding: "5px 8px",
              backgroundColor: "#1e334a",
              borderBottom: "1px solid #364152",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "move",
              color: "#ffffff",
              fontWeight: "bold",
              borderRadius: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#88c0d0" }}>Mewsic Dev Control</span>
              <span style={{ color: "#4c566a" }}>|</span>
              <span style={{ color: "#e5e9f0", fontWeight: "normal" }}>Runtime Inspector</span>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowSplashScreen(true);
                  addLog("Triggered Animated Loading Screen from titlebar");
                }}
                title="Trigger Animated Loading Screen"
                style={{
                  backgroundColor: "#243c57",
                  border: "1px solid #3d6490",
                  color: "#88c0d0",
                  fontSize: "10px",
                  padding: "1px 7px",
                  cursor: "pointer",
                  borderRadius: 0,
                  outline: "none",
                  fontWeight: "bold",
                }}
              >
                ▶ Trigger Loading Screen
              </button>
              <span style={{ fontSize: "10px", color: "#88c0d0", fontWeight: "normal" }}>
                [HOME to close]
              </span>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: "#bf616a",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: "bold",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 0,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* ImGui Menu Tabs Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#15181e",
              borderBottom: "1px solid #2e3542",
              fontSize: "11px",
              padding: "0 4px",
              overflowX: "auto",
            }}
          >
            {[
              { id: "modals", label: "Popups & Modals" },
              { id: "events", label: "Events & Toasts" },
              { id: "audio", label: "Audio & DSP" },
              { id: "visuals", label: "Views & Visuals" },
              { id: "statistics", label: "Statistics" },
              { id: "log", label: "Log" },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: "6px 10px",
                    fontWeight: 500,
                    borderTop: active ? "2px solid #88c0d0" : "2px solid transparent",
                    borderRight: "1px solid #2e3542",
                    borderBottom: "none",
                    borderLeft: "none",
                    cursor: "pointer",
                    backgroundColor: active ? "#25374c" : "#171a21",
                    color: active ? "#ffffff" : "#707b8c",
                    borderRadius: 0,
                    fontFamily: "inherit",
                    outline: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Window Body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px",
              backgroundColor: "#1b1f26",
              color: "#d8dee9",
              maxHeight: "72vh",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {/* ══════════════════════════════════════════════════════════════════
                TAB 1: POPUPS & MODALS (EVERY SINGLE POPUP IN THE APP TRIGGERABLE)
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "modals" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Search / Filter for Modals */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center", backgroundColor: "#15181e", padding: "4px 8px", border: "1px solid #2e3542" }}>
                  <span style={{ color: "#707b8c", fontSize: "11px" }}>Filter:</span>
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search popups and modals..."
                    style={{ flex: 1, backgroundColor: "#0e1115", border: "1px solid #2e3542", color: "#fff", fontSize: "11px", padding: "2px 6px", outline: "none", borderRadius: 0 }}
                  />
                  {filterText && (
                    <button onClick={() => setFilterText("")} style={{ background: "none", border: "none", color: "#bf616a", cursor: "pointer", fontSize: "11px" }}>✕</button>
                  )}
                </div>

                {/* 0. Featured: Animated Loading Screen */}
                <div style={{ ...imguiBoxStyle, backgroundColor: "#15222e", borderColor: "#2b4c73" }}>
                  <div style={{ ...imguiHeaderStyle, backgroundColor: "#1e3752", color: "#88c0d0" }}>
                    <span>★ Animated Loading Sequence</span>
                    <span style={{ color: "#ebcb8b", fontSize: "10px" }}>Brand Intro Animation</span>
                  </div>
                  <div style={{ padding: "8px", display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => {
                        setShowSplashScreen(true);
                        addLog("Triggered Animated Loading Screen (Logo pop-in & slide-right reveal)");
                      }}
                      style={{
                        ...imguiBtnStyle,
                        flex: 1,
                        backgroundColor: "#2b4c73",
                        borderColor: "#4a7bb5",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "7px 12px",
                        fontSize: "12px",
                      }}
                    >
                      ▶ Trigger Animated Loading Screen (Logo & Slide Right)
                    </button>
                  </div>
                </div>

                {/* 1. Updater Modals */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Update System Dialogs</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#a3be8c", width: "110px" }}>Target Version:</span>
                      <input
                        type="text"
                        value={mockVersion}
                        onChange={(e) => setMockVersion(e.target.value)}
                        style={{ backgroundColor: "#0e1115", border: "1px solid #2e3542", color: "#fff", padding: "2px 6px", width: "80px", outline: "none", borderRadius: 0 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => {
                          setPendingUpdateVersion(mockVersion);
                          setShowUpdatePrompt(true);
                          addLog(`Triggered UpdatePromptModal for v${mockVersion} (Update Now / Nah)`);
                        }}
                        style={{ ...imguiBtnStyle, flex: 1, backgroundColor: "#2b4c73", borderColor: "#3d6799", color: "#fff", fontWeight: "bold" }}
                      >
                        Trigger Update Prompt (Nah / Update)
                      </button>
                      <button
                        onClick={() => {
                          setPendingUpdateVersion(mockVersion);
                          setShowUpdateModal(true);
                          addLog(`Triggered full UpdateModal for v${mockVersion}`);
                        }}
                        style={{ ...imguiBtnStyle, backgroundColor: "#202c3a", borderColor: "#2e3f52", color: "#88c0d0" }}
                      >
                        Open Full Update Modal
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Track & Library Modals */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Track & Library Modals</div>
                  <div style={{ padding: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
                    <button
                      onClick={() => {
                        setEditTrack(sampleTrack);
                        addLog(`Opened EditMetadataModal for "${sampleTrack.title}"`);
                      }}
                      style={imguiBtnStyle}
                    >
                      Open EditMetadataModal
                    </button>

                    <button
                      onClick={() => {
                        setAddTrack(sampleTrack);
                        addLog(`Opened AddToPlaylistModal for "${sampleTrack.title}"`);
                      }}
                      style={imguiBtnStyle}
                    >
                      Open AddToPlaylistModal
                    </button>

                    <button
                      onClick={() => {
                        setDeleteTrack({ ...sampleTrack, isVirtual: false, provider: "local" });
                        addLog(`Opened ConfirmationModal (Delete Local Track)`);
                      }}
                      style={{ ...imguiBtnStyle, color: "#bf616a", borderColor: "#5e2d33" }}
                    >
                      Delete Track Modal (Danger)
                    </button>

                    <button
                      onClick={() => {
                        setDeleteTrack({ ...sampleTrack, isVirtual: true, provider: "virtual" });
                        addLog(`Opened ConfirmationModal (Remove Virtual Track)`);
                      }}
                      style={{ ...imguiBtnStyle, color: "#ebcb8b", borderColor: "#61502b" }}
                    >
                      Remove Virtual Track (Warning)
                    </button>
                  </div>
                </div>

                {/* 3. Playlist Modals */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Playlist Operations & Modals</div>
                  <div style={{ padding: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
                    <button
                      onClick={() => {
                        setShowCreatePlaylist(true);
                        addLog("Opened CreatePlaylistModal");
                      }}
                      style={imguiBtnStyle}
                    >
                      CreatePlaylistModal
                    </button>

                    <button
                      onClick={() => {
                        setShowImportPlaylist(true);
                        addLog("Opened ImportPlaylistModal");
                      }}
                      style={imguiBtnStyle}
                    >
                      ImportPlaylistModal
                    </button>

                    <button
                      onClick={() => {
                        setSharePlaylist(samplePlaylist);
                        addLog(`Opened SharePlaylistModal for "${samplePlaylist.name}"`);
                      }}
                      style={imguiBtnStyle}
                    >
                      SharePlaylistModal
                    </button>

                    <button
                      onClick={() => {
                        setShowLocalEditPlaylist(true);
                        addLog(`Opened EditPlaylistModal for "${samplePlaylist.name}"`);
                      }}
                      style={imguiBtnStyle}
                    >
                      EditPlaylistModal
                    </button>

                    <button
                      onClick={() => {
                        setShowLocalManageTracks(true);
                        addLog(`Opened ManagePlaylistTracksModal for "${samplePlaylist.name}"`);
                      }}
                      style={{ ...imguiBtnStyle, gridColumn: "span 2" }}
                    >
                      ManagePlaylistTracksModal
                    </button>
                  </div>
                </div>

                {/* 4. System Dialogs & Terminals */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>System Popups & Tools</div>
                  <div style={{ padding: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
                    <button
                      onClick={() => {
                        setShowAbout(true);
                        addLog("Opened AboutModal");
                      }}
                      style={imguiBtnStyle}
                    >
                      AboutModal
                    </button>

                    <button
                      onClick={() => {
                        setShowLocalColorPicker(true);
                        addLog("Opened ColorPickerModal");
                      }}
                      style={imguiBtnStyle}
                    >
                      ColorPickerModal
                    </button>

                    <button
                      onClick={() => {
                        setShowCyberdeck(!showCyberdeck);
                        addLog(`Toggled Cyberdeck Terminal -> ${!showCyberdeck}`);
                      }}
                      style={{ ...imguiBtnStyle, color: "#a3be8c", borderColor: "#3a5737" }}
                    >
                      Toggle Cyberdeck Terminal
                    </button>

                    <button
                      onClick={() => {
                        window.dispatchEvent(
                          new MouseEvent("contextmenu", {
                            clientX: window.innerWidth / 2,
                            clientY: window.innerHeight / 2,
                            bubbles: true,
                          })
                        );
                        addLog("Triggered ContextMenu at screen center");
                      }}
                      style={imguiBtnStyle}
                    >
                      Trigger ContextMenu
                    </button>

                    <button
                      onClick={() => {
                        setShowSplashScreen(true);
                        addLog("Triggered Animated Splash Screen replay");
                      }}
                      style={{ ...imguiBtnStyle, color: "#88c0d0", borderColor: "#33557a", gridColumn: "span 2", padding: "6px" }}
                    >
                      ▶ Replay Animated Loading Screen (Logo & Slide)
                    </button>
                  </div>
                </div>

                {/* 5. Custom Confirmation Dialog Builder */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Custom Confirmation Dialog Builder</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ width: "70px", color: "#88c0d0" }}>Title:</span>
                      <input
                        type="text"
                        value={customDialogTitle}
                        onChange={(e) => setCustomDialogTitle(e.target.value)}
                        style={{ flex: 1, backgroundColor: "#0e1115", border: "1px solid #2e3542", color: "#fff", padding: "2px 6px", outline: "none", borderRadius: 0 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ width: "70px", color: "#88c0d0" }}>Message:</span>
                      <input
                        type="text"
                        value={customDialogMessage}
                        onChange={(e) => setCustomDialogMessage(e.target.value)}
                        style={{ flex: 1, backgroundColor: "#0e1115", border: "1px solid #2e3542", color: "#fff", padding: "2px 6px", outline: "none", borderRadius: 0 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ width: "70px", color: "#88c0d0" }}>Variant:</span>
                      {(["danger", "warning", "info"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCustomDialogVariant(v)}
                          style={{
                            ...imguiBtnStyle,
                            backgroundColor: customDialogVariant === v ? "#2b4c73" : "#171a21",
                            borderColor: customDialogVariant === v ? "#88c0d0" : "#2e3542",
                            textTransform: "capitalize",
                          }}
                        >
                          {v}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setLocalConfirmModal({
                            title: customDialogTitle,
                            message: customDialogMessage,
                            variant: customDialogVariant,
                            confirmLabel: "Confirm",
                            cancelLabel: "Dismiss",
                          });
                          addLog(`Triggered custom confirmation dialog: "${customDialogTitle}"`);
                        }}
                        style={{ ...imguiBtnStyle, marginLeft: "auto", backgroundColor: "#2b4c73", color: "#fff", fontWeight: "bold" }}
                      >
                        Show Dialog
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 2: EVENTS & TOASTS (NOTIFICATIONS, LIFE-CYCLE, TELEMETRY)
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "events" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Notification Emitter</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#a3be8c", width: "70px" }}>Message:</span>
                      <input
                        type="text"
                        value={toastMsg}
                        onChange={(e) => setToastMsg(e.target.value)}
                        style={{ flex: 1, backgroundColor: "#0e1115", border: "1px solid #2e3542", color: "#fff", padding: "2px 6px", outline: "none", borderRadius: 0 }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => {
                          addNotification(toastMsg, "success", 4000);
                          addLog(`Spawned SUCCESS toast: "${toastMsg}"`);
                        }}
                        style={{ ...imguiBtnStyle, flex: 1, backgroundColor: "#25482e", color: "#a3be8c", borderColor: "#33613e" }}
                      >
                        Success
                      </button>
                      <button
                        onClick={() => {
                          addNotification(toastMsg, "info", 4000);
                          addLog(`Spawned INFO toast: "${toastMsg}"`);
                        }}
                        style={{ ...imguiBtnStyle, flex: 1, backgroundColor: "#253c52", color: "#88c0d0", borderColor: "#345371" }}
                      >
                        Info
                      </button>
                      <button
                        onClick={() => {
                          addNotification(`[Warning] ${toastMsg}`, "info", 4000);
                          addLog(`Spawned WARNING toast: "${toastMsg}"`);
                        }}
                        style={{ ...imguiBtnStyle, flex: 1, backgroundColor: "#4f4121", color: "#ebcb8b", borderColor: "#66542a" }}
                      >
                        Warning
                      </button>
                      <button
                        onClick={() => {
                          addNotification(toastMsg, "error", 4000);
                          addLog(`Spawned ERROR toast: "${toastMsg}"`);
                        }}
                        style={{ ...imguiBtnStyle, flex: 1, backgroundColor: "#52252c", color: "#bf616a", borderColor: "#6e333c" }}
                      >
                        Error
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        ["Scan started...", "Indexed 140 songs", "Audio DSP online", "Plugin sync finished", "Ready"].forEach(
                          (msg, i) => setTimeout(() => addNotification(msg, "info", 3000), i * 300)
                        );
                        addLog("Spawned rapid batch of 5 toasts");
                      }}
                      style={{ ...imguiBtnStyle, width: "100%", padding: "4px" }}
                    >
                      Rapid 5-Toast Burst Test
                    </button>
                  </div>
                </div>

                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>App Lifecycle & System Actions</div>
                  <div style={{ padding: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <button
                      onClick={() => {
                        toggleFullscreen().catch(() => {});
                        addLog("Invoked toggleFullscreen()");
                      }}
                      style={imguiBtnStyle}
                    >
                      Toggle Fullscreen
                    </button>

                    <button
                      onClick={() => {
                        addLog("Reloading WebKit UI...");
                        window.location.reload();
                      }}
                      style={imguiBtnStyle}
                    >
                      Reload WebKit UI (Ctrl+Shift+R)
                    </button>

                    <button
                      onClick={() => {
                        setDemoMode(!isDemoMode);
                        addLog(`Toggled Demo/Privacy Mode -> ${!isDemoMode}`);
                      }}
                      style={imguiBtnStyle}
                    >
                      Toggle Demo Mode ({isDemoMode ? "ON" : "OFF"})
                    </button>

                    <button
                      onClick={() => {
                        rescanDirectory();
                        addLog("Triggered rescanDirectory()");
                      }}
                      style={imguiBtnStyle}
                    >
                      Trigger Library Rescan
                    </button>

                    <button
                      onClick={() => {
                        purgeVirtualTracks();
                        addLog("Triggered purgeVirtualTracks()");
                      }}
                      style={{ ...imguiBtnStyle, color: "#ebcb8b" }}
                    >
                      Purge Virtual Tracks
                    </button>

                    <button
                      onClick={() => {
                        setShowSplashScreen(true);
                        addLog("Triggered Animated Loading Screen from system actions");
                      }}
                      style={{ ...imguiBtnStyle, color: "#88c0d0", borderColor: "#33557a" }}
                    >
                      Trigger Loading Animation
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 3: AUDIO & DSP (FULL AUDIO PIPELINE MANIPULATION)
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "audio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
                {/* Transport Controls */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>
                    <span>Media Transport</span>
                    <span style={{ color: isPlaying ? "#a3be8c" : "#bf616a", fontSize: "10px" }}>
                      {isPlaying ? "PLAYING" : "PAUSED"}
                    </span>
                  </div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => { playPrev(); addLog("Transport: Prev"); }} style={{ ...imguiBtnStyle, flex: 1 }}>|◀ Prev</button>
                      <button
                        onClick={() => { setIsPlaying(!isPlaying); addLog(`Transport: Play/Pause (${!isPlaying})`); }}
                        style={{ ...imguiBtnStyle, flex: 1.2, backgroundColor: "#2b4c73", color: "#fff", fontWeight: "bold" }}
                      >
                        {isPlaying ? "❚❚ Pause" : "▶ Play"}
                      </button>
                      <button onClick={() => { playNext(); addLog("Transport: Next"); }} style={{ ...imguiBtnStyle, flex: 1 }}>Next ▶|</button>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => { skipBackward(); addLog("Transport: -10s"); }} style={{ ...imguiBtnStyle, flex: 1 }}>-10s</button>
                      <button onClick={() => { skipForward(); addLog("Transport: +10s"); }} style={{ ...imguiBtnStyle, flex: 1 }}>+10s</button>
                      <button onClick={playTestTone} style={{ ...imguiBtnStyle, flex: 1.2, backgroundColor: "#4f4121", color: "#ebcb8b" }}>
                        440Hz Sine Beep
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "6px", paddingTop: "4px" }}>
                      <button
                        onClick={() => { toggleShuffle(); addLog(`Shuffle -> ${!shuffleEnabled}`); }}
                        style={{ ...imguiBtnStyle, flex: 1, backgroundColor: shuffleEnabled ? "#2b4c73" : "#171a21", color: shuffleEnabled ? "#fff" : "#707b8c" }}
                      >
                        Shuffle: {shuffleEnabled ? "ON" : "OFF"}
                      </button>
                      <button
                        onClick={() => {
                          const next = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
                          setRepeatMode(next);
                          addLog(`Repeat -> ${next}`);
                        }}
                        style={{ ...imguiBtnStyle, flex: 1, textTransform: "capitalize" }}
                      >
                        Repeat: {repeatMode}
                      </button>
                      <button onClick={() => { toggleMute(); addLog("Toggled mute"); }} style={imguiBtnStyle}>
                        Mute Toggle
                      </button>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#88c0d0" }}>
                        <span>Master Volume</span>
                        <span>{Math.round(volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        style={{ width: "100%", accentColor: "#88c0d0", cursor: "pointer" }}
                      />
                    </div>
                  </div>
                </div>

                {/* DSP Sliders */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>WebAudio DSP Filters</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#88c0d0" }}>
                        <span>Playback Speed</span>
                        <span style={{ color: "#fff", fontWeight: "bold" }}>{playbackSpeed.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                        style={{ width: "100%", accentColor: "#88c0d0", cursor: "pointer" }}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={reverbEnabled}
                          onChange={(e) => setReverbEnabled(e.target.checked)}
                          style={{ accentColor: "#88c0d0" }}
                        />
                        <span style={{ color: "#88c0d0", fontWeight: "bold" }}>bEnableReverb</span>
                      </label>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#a3be8c" }}>
                        <span>Reverb Strength</span>
                        <span>{Math.round(reverbStrength * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={reverbStrength}
                        disabled={!reverbEnabled}
                        onChange={(e) => setReverbStrength(parseFloat(e.target.value))}
                        style={{ width: "100%", accentColor: "#88c0d0", cursor: "pointer", opacity: reverbEnabled ? 1 : 0.4 }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#88c0d0" }}>
                        <span>Bass Boost</span>
                        <span style={{ color: "#fff", fontWeight: "bold" }}>+{bassBoost} dB</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        step="1"
                        value={bassBoost}
                        onChange={(e) => setBassBoost(parseInt(e.target.value))}
                        style={{ width: "100%", accentColor: "#88c0d0", cursor: "pointer" }}
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#88c0d0" }}>
                        <span>Volume Overdrive Multiplier</span>
                        <span style={{ color: "#fff", fontWeight: "bold" }}>{volumeBoost.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="2.5"
                        step="0.1"
                        value={volumeBoost}
                        onChange={(e) => setVolumeBoost(parseFloat(e.target.value))}
                        style={{ width: "100%", accentColor: "#88c0d0", cursor: "pointer" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "12px", paddingTop: "4px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={panAuto}
                          onChange={(e) => setPanAuto(e.target.checked)}
                          style={{ accentColor: "#88c0d0" }}
                        />
                        <span>bSpatialAutoPan</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={safeAudioMode}
                          onChange={(e) => setSafeAudioMode(e.target.checked)}
                          style={{ accentColor: "#88c0d0" }}
                        />
                        <span>bSafeLimiter</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 4: VIEWS & VISUALS (VIEW SWITCHER, THEMES, ACCENTS, ZOOM)
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "visuals" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
                {/* View Switcher */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>
                    <span>Direct View Navigation</span>
                    <span style={{ color: "#ebcb8b", fontSize: "10px" }}>{activeView}</span>
                  </div>
                  <div style={{ padding: "8px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
                    {VIEWS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setActiveView(v.id);
                          addLog(`Navigated view -> ${v.id}`);
                        }}
                        style={{
                          ...imguiBtnStyle,
                          backgroundColor: activeView === v.id ? "#2b4c73" : "#171a21",
                          borderColor: activeView === v.id ? "#88c0d0" : "#2e3542",
                          color: activeView === v.id ? "#fff" : "#707b8c",
                          fontWeight: activeView === v.id ? "bold" : "normal",
                          padding: "4px 6px",
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme & Visual Options */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Themes & Rendering</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={theme === "dark"}
                        onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
                        style={{ accentColor: "#88c0d0" }}
                      />
                      <span>bDarkThemeEnabled ({theme})</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={lowEndMode}
                        onChange={(e) => setLowEndMode(e.target.checked)}
                        style={{ accentColor: "#88c0d0" }}
                      />
                      <span>bLowEndGPUMode (Disables Backdrop Blur)</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={customTitlebar}
                        onChange={(e) => setCustomTitlebar(e.target.checked)}
                        style={{ accentColor: "#88c0d0" }}
                      />
                      <span>bCustomFramelessTitlebar</span>
                    </label>
                  </div>
                </div>

                {/* Accent Color Presets */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Accent Color Presets</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
                      {ACCENTS.map((col) => (
                        <button
                          key={col}
                          onClick={() => {
                            setAccentColor(col);
                            addLog(`Changed accent -> ${col}`);
                          }}
                          style={{
                            ...imguiBtnStyle,
                            backgroundColor: accentColor === col ? "#2b4c73" : "#171a21",
                            borderColor: accentColor === col ? "#88c0d0" : "#2e3542",
                            color: accentColor === col ? "#fff" : "#707b8c",
                            textTransform: "capitalize",
                            padding: "3px 6px",
                          }}
                        >
                          {col}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingTop: "4px", borderTop: "1px solid #2e3542" }}>
                      <span style={{ color: "#a3be8c" }}>Custom Hex:</span>
                      <input
                        type="color"
                        value={customAccentColor || "#1bd96a"}
                        onChange={(e) => {
                          setCustomAccentColor(e.target.value);
                          setAccentColor("custom");
                        }}
                        style={{ width: "20px", height: "20px", border: "1px solid #364152", background: "none", cursor: "pointer" }}
                      />
                      <input
                        type="text"
                        value={customAccentColor}
                        onChange={(e) => {
                          setCustomAccentColor(e.target.value);
                          setAccentColor("custom");
                        }}
                        placeholder="#1bd96a"
                        style={{ flex: 1, backgroundColor: "#0e1115", border: "1px solid #2e3542", color: "#fff", padding: "2px 6px", outline: "none", borderRadius: 0 }}
                      />
                    </div>
                  </div>
                </div>

                {/* GUI Scale */}
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>GUI Scale Zoom Factor</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#88c0d0" }}>
                      <span>Scale Factor</span>
                      <span style={{ color: "#fff", fontWeight: "bold" }}>{Math.round(guiScale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.75"
                      max="1.35"
                      step="0.05"
                      value={guiScale}
                      onChange={(e) => setGuiScale(parseFloat(e.target.value))}
                      style={{ width: "100%", accentColor: "#88c0d0", cursor: "pointer" }}
                    />
                    <button
                      onClick={() => setGuiScale(1.0)}
                      style={{ ...imguiBtnStyle, alignSelf: "flex-start", marginTop: "2px" }}
                    >
                      Reset to 100%
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 5: STATISTICS (REALTIME TELEMETRY)
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "statistics" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Render Pipeline</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ color: "#ffffff", fontWeight: "bold" }}>
                      Renderer: Microsoft Edge WebView2 / WebKit
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#a3be8c" }}>Framerate:</span>
                      <span style={{ fontWeight: "bold", color: fps < 30 ? "#bf616a" : "#a3be8c" }}>
                        {fps} FPS ({frameTime} ms)
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#a3be8c" }}>Process CPU:</span>
                      <span style={{ fontWeight: "bold", color: Number(cpuPercent) > 50 ? "#bf616a" : "#ffffff" }}>
                        {cpuPercent}%
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#a3be8c" }}>Memory Working Set (RSS):</span>
                      <span style={{ fontWeight: "bold", color: "#ffffff" }}>{memMB} MB</span>
                    </div>
                  </div>
                </div>

                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Audio Subsystem</div>
                  <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px" }}>
                    <div>AudioContext: <span style={{ color: "#a3be8c", fontWeight: "bold" }}>RUNNING</span></div>
                    <div>Source File: <span style={{ color: "#ffffff", wordBreak: "break-all" }}>{currentTrack?.filePath || "none"}</span></div>
                    <div>Queue Count: <span style={{ color: "#ffffff" }}>{queue.length} items</span></div>
                  </div>
                </div>

                <div style={imguiBoxStyle}>
                  <div style={imguiHeaderStyle}>Overlay Window Coordinates</div>
                  <div style={{ padding: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#616e85" }}>X: {pos.x}px | Y: {pos.y}px</span>
                    <button
                      onClick={() => { setPos({ x: 12, y: 12 }); addLog("Reset overlay position to (12, 12)"); }}
                      style={imguiBtnStyle}
                    >
                      Reset to (12, 12)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 6: LOG (LIVE ROLLING EVENT LOGGER)
                ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "log" && (
              <div
                style={{
                  backgroundColor: "#0d0f13",
                  border: "1px solid #2e3542",
                  padding: "8px",
                  maxHeight: "65vh",
                  overflowY: "auto",
                  fontFamily: "Consolas, monospace",
                  fontSize: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  color: "#a9b1d6",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #2e3542", paddingBottom: "4px", color: "#7aa2f7" }}>
                  <span>Mewsic Dev Control Event Log</span>
                  <button onClick={() => setLogs([])} style={{ background: "none", border: "none", color: "#bf616a", cursor: "pointer", fontSize: "10px" }}>
                    Clear Log
                  </button>
                </div>
                {logs.map((log, i) => (
                  <div key={i} style={{ lineHeight: 1.3 }}>{log}</div>
                ))}
              </div>
            )}
          </div>

          {/* ImGui Status Bar */}
          <div
            style={{
              padding: "4px 8px",
              backgroundColor: "#15181e",
              borderTop: "1px solid #2e3542",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#5b677a",
            }}
          >
            <span>{fps} FPS | {frameTime} ms | {memMB} MB RAM | {cpuPercent}% CPU</span>
            <span style={{ color: "#88c0d0" }}>Press HOME to close</span>
          </div>
        </div>
      )}

      {/* ── 4. Local Modal Previews Triggered From Dev Control ── */}
      {localConfirmModal && (
        <ConfirmationModal
          title={localConfirmModal.title}
          message={localConfirmModal.message}
          variant={localConfirmModal.variant}
          confirmLabel={localConfirmModal.confirmLabel}
          cancelLabel={localConfirmModal.cancelLabel}
          onConfirm={() => {
            addLog(`Confirmed dialog: "${localConfirmModal.title}"`);
            setLocalConfirmModal(null);
          }}
          onCancel={() => {
            addLog(`Cancelled dialog: "${localConfirmModal.title}"`);
            setLocalConfirmModal(null);
          }}
        />
      )}

      {showLocalColorPicker && (
        <ColorPickerModal onClose={() => setShowLocalColorPicker(false)} />
      )}

      {showLocalManageTracks && (
        <ManagePlaylistTracksModal
          playlist={samplePlaylist}
          onClose={() => setShowLocalManageTracks(false)}
        />
      )}

      {showLocalEditPlaylist && (
        <EditPlaylistModal
          playlist={samplePlaylist}
          onClose={() => setShowLocalEditPlaylist(false)}
        />
      )}
    </>
  );
}

// ── Dear ImGui Classic / Slate Styling Objects ──
const imguiBoxStyle: React.CSSProperties = {
  backgroundColor: "#16191f",
  border: "1px solid #2e3542",
  borderRadius: 0,
};

const imguiHeaderStyle: React.CSSProperties = {
  padding: "4px 8px",
  backgroundColor: "#202631",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  color: "#88c0d0",
  fontWeight: "bold",
  fontSize: "11px",
  borderRadius: 0,
  userSelect: "none",
};

const imguiBtnStyle: React.CSSProperties = {
  backgroundColor: "#22354a",
  border: "1px solid #334e6d",
  color: "#d8dee9",
  fontSize: "11px",
  padding: "4px 8px",
  cursor: "pointer",
  borderRadius: 0,
  fontFamily: "inherit",
  outline: "none",
  textAlign: "center",
};
