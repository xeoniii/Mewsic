import React, { useState, useEffect, useRef } from "react";
import {
  Palette, FolderOpen, RefreshCw, Trash2, Check, RotateCcw,
  Info, Music2, Volume2, FolderInput, Sun, Moon, Keyboard, Monitor, Share2, MessageSquare, Bell, Zap, FileUp, FolderPlus, Database, Power,
  Inbox, PanelTop, Image as ImageIcon, ArrowUpCircle, DownloadCloud, Wrench, ShieldAlert, Terminal, LayoutGrid, List, Sliders, Puzzle, Crop, SidebarClose
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useLibrary } from "../../hooks/useLibrary";
import { clearImageCache, getOSName } from "../../utils/tauriApi";
import { ACCENT_PRESETS } from "../../utils/helpers";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import { ConfirmationModal } from "../UI/ConfirmationModal";
import { UpdateModal } from "../UI/UpdateModal";

import { ThemedSlider } from "../UI/ThemedSlider";
import { ColorPickerModal } from "./ColorPickerModal";
import type { ShortcutMap, Shortcut } from "../../types";

function Section({
  icon,
  title,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass rounded-xl p-5 flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <span className="text-accent">{icon}</span>
        <h2 className="font-display font-semibold text-sm text-text-primary">
          {title}
        </h2>
      </div>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </section>
  );
}

import { useDisplayData } from "../../hooks/useDisplayData";

export function SettingsView() {
  const {
    accentColor,
    customAccentColor,
    volume,
    setAccentColor,
    setCustomAccentColor,
    setVolume,
    guiScale,
    setGuiScale,
    trayEnabled,
    setTrayEnabled,
    theme,
    setTheme,
    customTitlebar,
    setCustomTitlebar,
    roundedCorners,
    setRoundedCorners,
    sidebarCollapsed,
    setSidebarCollapsed,
    shortcuts,
    setShortcut,
    resetShortcuts,
    discordEnabled,
    setDiscordEnabled,
    systemNotifications,
    setSystemNotifications,
    lowEndMode,
    setLowEndMode,
    clearDiscordCoverCache,
    libraryViewMode,
    setLibraryViewMode,
    homeViewMode,
    setHomeViewMode,
    playlistViewMode,
    setPlaylistViewMode,
    smoothScrollEnabled = true,
    setSmoothScrollEnabled,
    minecraftIntegrationEnabled,
    setMinecraftIntegrationEnabled,
    sharonMode,
  } = useStore(useShallow((s) => ({
    accentColor: s.accentColor,
    customAccentColor: s.customAccentColor,
    volume: s.volume,
    setAccentColor: s.setAccentColor,
    setCustomAccentColor: s.setCustomAccentColor,
    setVolume: s.setVolume,
    guiScale: s.guiScale,
    setGuiScale: s.setGuiScale,
    trayEnabled: s.trayEnabled,
    setTrayEnabled: s.setTrayEnabled,
    theme: s.theme,
    setTheme: s.setTheme,
    customTitlebar: s.customTitlebar,
    setCustomTitlebar: s.setCustomTitlebar,
    roundedCorners: s.roundedCorners,
    setRoundedCorners: s.setRoundedCorners,
    sidebarCollapsed: s.sidebarCollapsed,
    setSidebarCollapsed: s.setSidebarCollapsed,
    shortcuts: s.shortcuts,
    setShortcut: s.setShortcut,
    resetShortcuts: s.resetShortcuts,
    discordEnabled: s.discordEnabled,
    setDiscordEnabled: s.setDiscordEnabled,
    systemNotifications: s.systemNotifications,
    setSystemNotifications: s.setSystemNotifications,
    lowEndMode: s.lowEndMode,
    setLowEndMode: s.setLowEndMode,
    clearDiscordCoverCache: s.clearDiscordCoverCache,
    libraryViewMode: s.libraryViewMode,
    setLibraryViewMode: s.setLibraryViewMode,
    homeViewMode: s.homeViewMode,
    setHomeViewMode: s.setHomeViewMode,
    playlistViewMode: s.playlistViewMode,
    setPlaylistViewMode: s.setPlaylistViewMode,
    smoothScrollEnabled: s.smoothScrollEnabled,
    setSmoothScrollEnabled: s.setSmoothScrollEnabled,
    minecraftIntegrationEnabled: s.minecraftIntegrationEnabled,
    setMinecraftIntegrationEnabled: s.setMinecraftIntegrationEnabled,
    sharonMode: s.sharonMode,
  })));

  const { displayTracks, displayMusicDir, displayPlaylistsDir } = useDisplayData();
  const {
    changeMusicDirectory,
    changePlaylistsDirectory,
    rescanDirectory,
    importSongs,
    importPlaylist,
    refreshPlaylists
  } = useLibrary();


  const [scanning, setScanning] = useState(false);
  const [refreshingPlaylists, setRefreshingPlaylists] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [clearingDiscord, setClearingDiscord] = useState(false);
  const [showFlashbangWarning, setShowFlashbangWarning] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("0.8.4");
  const [localGuiScale, setLocalGuiScale] = useState(guiScale);

  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  useEffect(() => {
    const mock = localStorage.getItem("mewsic-mock-version");
    if (mock) {
      setAppVersion(mock);
    } else {
      getVersion().then(setAppVersion).catch(() => { });
    }
  }, []);

  const handleCheckForUpdates = () => {
    setShowUpdateModal(true);
  };

  useEffect(() => {
    setLocalGuiScale(guiScale);
  }, [guiScale]);

  const handleRescan = async () => {
    setScanning(true);
    await rescanDirectory();
    setScanning(false);
  };

  const handleRefreshPlaylists = async () => {
    setRefreshingPlaylists(true);
    await refreshPlaylists();
    setRefreshingPlaylists(false);
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await clearImageCache();
      await rescanDirectory();
    } catch (err) {
      console.error("Clear cache error:", err);
    } finally {
      setClearingCache(false);
    }
  };

  const handleClearDiscordCache = () => {
    setClearingDiscord(true);
    clearDiscordCoverCache();
    setTimeout(() => setClearingDiscord(false), 600);
  };

  const handleReloadApp = () => {
    localStorage.setItem("returnToSettings", "true");
    window.location.reload();
  };

  const getBuildId = () => {
    const vParts = appVersion.split('.');
    if (vParts.length < 3) return "00000000000";

    const now = new Date();
    const yearStr = now.getFullYear().toString(); // 2026
    const y1 = yearStr.slice(0, 2); // 20
    const y2 = yearStr.slice(2, 4); // 26
    const mm = (now.getMonth() + 1).toString().padStart(2, '0'); // 05
    const dd = now.getDate().toString().padStart(2, '0'); // 06

    return `${y1}${vParts[0]}${y2}${vParts[1]}${mm}${vParts[2]}${dd}`;
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-y-auto">
      <div className="px-8 py-6 border-b border-border-subtle flex-shrink-0">
        <h1 className="font-display font-bold text-2xl text-text-primary">
          {sharonMode ? "Shittings" : "Settings"}
        </h1>
        <p className="text-text-muted text-sm mt-1">
          {sharonMode ? "My name is Ander Dinngus. Ooooh Shittings" : "Customize Mewsic to your taste"}
        </p>
      </div>

      <div className="p-6 space-y-5">
        {
          // This is row 1: preferences & shortcuts
        }
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <Section icon={<Palette size={16} />} title="Preferences">
            <div className="space-y-8">
              {
                // This is the theme mode part
              }
              <div>
                <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 opacity-80">Theme Mode</p>
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle">
                  <div>
                    <p className="text-sm font-medium text-text-primary capitalize">{theme} Mode</p>
                    <p className="text-[10px] text-text-muted italic">Switch between light and dark</p>
                  </div>
                  <div className="flex gap-2 p-1 bg-surface-raised rounded-lg border border-border-subtle">
                    <button onClick={() => setTheme("dark")} className={`p-2 rounded-md transition-all ${theme === "dark" ? "bg-accent text-black shadow-accent" : "text-text-muted hover:text-text-primary"}`}>
                      <Moon size={16} />
                    </button>
                    <button onClick={() => theme === "dark" ? setShowFlashbangWarning(true) : setTheme("dark")} className={`p-2 rounded-md transition-all ${theme === "light" ? "bg-accent text-black shadow-accent" : "text-text-muted hover:text-text-primary"}`}>
                      <Sun size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {
                // This is the accent color part
              }
              <div>
                <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 opacity-80">Accent Color</p>
                <div className="grid grid-cols-5 gap-y-6 mb-8">
                  {ACCENT_PRESETS.map((preset) => {
                    const isActive = accentColor === preset.id;
                    const hexColor = preset.id === "custom" ? customAccentColor : preset.hex;
                    return (
                      <div key={preset.id} className="flex flex-col items-center gap-2 group relative">
                        <button
                          onClick={() => {
                            setAccentColor(preset.id as any);
                            if (preset.id === "custom") setShowColorPicker(true);
                          }}
                          className={`relative w-8 h-8 rounded-full transition-all duration-300 ${isActive ? "scale-110 shadow-lg" : "hover:scale-105"}`}
                          style={{ backgroundColor: hexColor, boxShadow: isActive ? `0 0 15px ${hexColor}80` : 'none', border: isActive ? `2px solid white` : '1px solid rgba(255,255,255,0.1)' }}>
                          {isActive && <div className="absolute inset-0 rounded-full border-2 border-black/20" />}
                        </button>
                        <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors text-center ${isActive ? "text-accent" : "text-text-muted group-hover:text-text-primary"}`}>
                          {preset.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="p-4 rounded-[24px] bg-surface-overlay border border-border-subtle relative overflow-hidden" style={{ background: `linear-gradient(145deg, var(--surface-overlay), rgba(var(--accent-rgb), 0.05))` }}>
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-accent">
                      <Music2 size={20} color="#000" />
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 w-full bg-surface-raised rounded-full overflow-hidden mb-2">
                        <div className="h-full w-2/3 bg-accent" />
                      </div>
                      <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Preview</span>
                    </div>
                  </div>
                </div>
              </div>

              {
                // This is the interface scale part
              }
              <div>
                <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 opacity-80">Interface Scale</p>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-text-muted font-mono">0.8</span>
                  <ThemedSlider min={0.8} max={2} step={0.05} value={localGuiScale} onChange={setLocalGuiScale} formatTooltip={(v: number) => `${v.toFixed(2)}x`} />
                  <span className="text-xs text-text-muted font-mono">2</span>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[10px] text-text-muted uppercase tracking-widest">
                    Scaling: <span className="text-accent font-black">{localGuiScale.toFixed(2)}x</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setGuiScale(1.15); setLocalGuiScale(1.15); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-raised border border-border-subtle text-[10px] font-black text-text-muted hover:text-accent hover:border-accent transition-all uppercase tracking-widest"
                    >
                      <RotateCcw size={10} />
                      Reset
                    </button>
                    <button
                      onClick={() => setGuiScale(localGuiScale)}
                      disabled={localGuiScale === guiScale}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent text-black text-[10px] font-black hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest disabled:opacity-30 disabled:grayscale disabled:scale-100"
                    >
                      <Check size={10} strokeWidth={3} />
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section icon={<Keyboard size={16} />} title="Shortcuts">
            <div className="flex flex-col h-full">
              <div className="space-y-2 pb-2.5">
                <ShortcutRow label="Play / Pause" action="togglePlay" shortcut={shortcuts.togglePlay} onSet={setShortcut} />
                <ShortcutRow label="Skip Forward" action="skipForward" shortcut={shortcuts.skipForward} onSet={setShortcut} />
                <ShortcutRow label="Skip Backward" action="skipBackward" shortcut={shortcuts.skipBackward} onSet={setShortcut} />
                <ShortcutRow label="Next Track" action="playNext" shortcut={shortcuts.playNext} onSet={setShortcut} />
                <ShortcutRow label="Previous Track" action="playPrev" shortcut={shortcuts.playPrev} onSet={setShortcut} />
                <ShortcutRow label="Volume Up" action="volumeUp" shortcut={shortcuts.volumeUp} onSet={setShortcut} />
                <ShortcutRow label="Volume Down" action="volumeDown" shortcut={shortcuts.volumeDown} onSet={setShortcut} />
              </div>
              <button
                onClick={resetShortcuts}
                className="w-full mt-auto py-2 rounded-lg bg-surface-raised border border-border-subtle text-[10px] font-black text-text-muted hover:text-accent hover:border-accent transition-all uppercase tracking-[0.2em]"
              >
                Restore Defaults
              </button>
            </div>
          </Section>
        </div>

        {
          // This is row 2: storage & maintenance & system & audio
        }
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <Section icon={<FolderOpen size={16} />} title="Storage & Maintenance">
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Music</span>
                  <div className="flex items-center gap-2">
                    <button onClick={importSongs} title="Import Songs" className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle hover:border-accent hover:text-accent transition-all">
                      <FileUp size={14} />
                    </button>
                    <button onClick={handleRescan} disabled={scanning || !displayMusicDir} title="Rescan Library" className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle hover:border-accent hover:text-accent transition-all disabled:opacity-30">
                      <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
                    </button>
                    <button onClick={changeMusicDirectory} title="Change Folder" className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle hover:border-accent hover:text-accent transition-all">
                      <FolderInput size={14} />
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-surface-overlay border border-border-subtle overflow-hidden">
                  <p className="text-[10px] text-text-muted font-mono truncate">{displayMusicDir || "None selected"}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Playlists</span>
                  <div className="flex items-center gap-2">
                    <button onClick={importPlaylist} title="Import Playlist" className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle hover:border-accent hover:text-accent transition-all">
                      <FolderPlus size={14} />
                    </button>
                    <button onClick={handleRefreshPlaylists} disabled={refreshingPlaylists || !displayPlaylistsDir} title="Refresh Playlists" className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle hover:border-accent hover:text-accent transition-all disabled:opacity-30">
                      <RefreshCw size={14} className={refreshingPlaylists ? "animate-spin" : ""} />
                    </button>
                    <button onClick={changePlaylistsDirectory} title="Change Folder" className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle hover:border-accent hover:text-accent transition-all">
                      <FolderInput size={14} />
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-surface-overlay border border-border-subtle overflow-hidden">
                  <p className="text-[10px] text-text-muted font-mono truncate">{displayPlaylistsDir || "None selected"}</p>
                </div>
              </div>

              {
                // This is the maintenance section part
              }
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Maintenance</span>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle group hover:border-accent/30 transition-all">
                    <div className="flex items-center gap-3">
                      <ImageIcon size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                      <div>
                        <p className="text-[13px] font-medium text-text-primary leading-none">Image Cache</p>
                        <p className="text-[9px] text-text-muted mt-1 italic">Clear generated cover thumbnails</p>
                      </div>
                    </div>
                    <button
                      onClick={handleClearCache}
                      disabled={clearingCache}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised border border-border-subtle text-[10px] font-bold text-text-muted hover:text-red-400 hover:border-red-400/30 transition-all uppercase tracking-wider"
                    >
                      {clearingCache ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {clearingCache ? "Clearing..." : "Clear Cache"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle group hover:border-accent/30 transition-all">
                    <div className="flex items-center gap-3">
                      <Database size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                      <div>
                        <p className="text-[13px] font-medium text-text-primary leading-none">Discord Cache</p>
                        <p className="text-[9px] text-text-muted mt-1 italic">Reset rich presence cover history</p>
                      </div>
                    </div>
                    <button
                      onClick={handleClearDiscordCache}
                      disabled={clearingDiscord}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised border border-border-subtle text-[10px] font-bold text-text-muted hover:text-accent hover:border-accent/30 transition-all uppercase tracking-wider"
                    >
                      {clearingDiscord ? <RefreshCw size={12} className="animate-spin" /> : <Database size={12} />}
                      {clearingDiscord ? "Clearing..." : "Reset Data"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle group hover:border-accent/30 transition-all">
                    <div className="flex items-center gap-3">
                      <Power size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                      <div>
                        <p className="text-[13px] font-medium text-text-primary leading-none">App Memory</p>
                        <p className="text-[9px] text-text-muted mt-1 italic">Flush RAM & reload interface</p>
                      </div>
                    </div>
                    <button
                      onClick={handleReloadApp}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised border border-border-subtle text-[10px] font-bold text-text-muted hover:text-accent hover:border-accent/30 transition-all uppercase tracking-wider"
                    >
                      <Power size={12} />
                      Reload App
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section icon={<Monitor size={16} />} title="System & Audio">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 opacity-80">Volume</p>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-overlay border border-border-subtle">
                  <Volume2 size={14} className="text-text-muted" />
                  <ThemedSlider min={0} max={1} step={0.01} value={volume} onChange={setVolume} formatTooltip={(v: number) => `${Math.round(v * 100)}%`} />
                  <span className="text-xs text-text-muted font-mono w-10 text-right">{Math.round(volume * 100)}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-overlay border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <Zap size={14} className={lowEndMode ? "text-accent" : "text-text-muted"} />
                    <div>
                      <p className="text-[13px] font-medium text-text-primary leading-none">Low-End Mode</p>
                      <p className="text-[9px] text-text-muted mt-1">Disables blurs & limits res (75%)</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={lowEndMode} onChange={(e) => setLowEndMode(e.target.checked)} />
                    <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-overlay border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <Bell size={14} className={systemNotifications ? "text-accent" : "text-text-muted"} />
                    <div>
                      <p className="text-[13px] font-medium text-text-primary leading-none">Notifications</p>
                      <p className="text-[9px] text-text-muted mt-1">Desktop alerts on song change</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={systemNotifications} onChange={(e) => setSystemNotifications(e.target.checked)} />
                    <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-overlay border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <Inbox size={14} className={trayEnabled ? "text-accent" : "text-text-muted"} />
                    <div>
                      <p className="text-[13px] font-medium text-text-primary leading-none">Tray Icon</p>
                      <p className="text-[9px] text-text-muted mt-1">Keep app running in tray</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={trayEnabled} onChange={(e) => setTrayEnabled(e.target.checked)} />
                    <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-overlay border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <PanelTop size={14} className={customTitlebar ? "text-accent" : "text-text-muted"} />
                    <div>
                      <p className="text-[13px] font-medium text-text-primary leading-none">Themed Titlebar</p>
                      <p className="text-[9px] text-text-muted mt-1">Modern integrated header</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={customTitlebar} onChange={(e) => { setCustomTitlebar(e.target.checked); setShowRestartModal(true); }} />
                    <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-overlay border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <Sliders size={14} className={smoothScrollEnabled ? "text-accent" : "text-text-muted"} />
                    <div>
                      <p className="text-[13px] font-medium text-text-primary leading-none">Smooth Scrolling</p>
                      <p className="text-[9px] text-text-muted mt-1">Silky inertia scrolling on pages</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={smoothScrollEnabled} onChange={(e) => setSmoothScrollEnabled(e.target.checked)} />
                    <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-overlay border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <Crop size={14} className={roundedCorners ? "text-accent" : "text-text-muted"} />
                    <div>
                      <p className="text-[13px] font-medium text-text-primary leading-none">Rounded Corners</p>
                      <p className="text-[9px] text-text-muted mt-1">Applies radius to the window borders</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={roundedCorners} onChange={(e) => setRoundedCorners(e.target.checked)} />
                    <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
                  </label>
                </div>


              </div>
            </div>
          </Section>

          {
            // This is the default layouts part
          }
          <Section icon={<LayoutGrid size={16} />} title="Default Layouts">
            <div className="space-y-4 h-full flex flex-col">
              <div className="grid grid-cols-1 gap-2">

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle group hover:border-accent/30 transition-all">
                  <div>
                    <p className="text-[13px] font-medium text-text-primary leading-none">Home View</p>
                    <p className="text-[9px] text-text-muted mt-1">Dashboard presentation</p>
                  </div>
                  <div className="flex gap-1 p-1 bg-surface-raised rounded-lg border border-border-subtle">
                    <button onClick={() => setHomeViewMode("grid")} className={`p-1.5 rounded-md transition-all ${homeViewMode === "grid" ? "bg-accent text-black shadow-accent" : "text-text-muted hover:text-text-primary"}`}>
                      <LayoutGrid size={14} />
                    </button>
                    <button onClick={() => setHomeViewMode("list")} className={`p-1.5 rounded-md transition-all ${homeViewMode === "list" ? "bg-accent text-black shadow-accent" : "text-text-muted hover:text-text-primary"}`}>
                      <List size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle group hover:border-accent/30 transition-all">
                  <div>
                    <p className="text-[13px] font-medium text-text-primary leading-none">Library View</p>
                    <p className="text-[9px] text-text-muted mt-1">Local tracks presentation</p>
                  </div>
                  <div className="flex gap-1 p-1 bg-surface-raised rounded-lg border border-border-subtle">
                    <button onClick={() => setLibraryViewMode("grid")} className={`p-1.5 rounded-md transition-all ${libraryViewMode === "grid" ? "bg-accent text-black shadow-accent" : "text-text-muted hover:text-text-primary"}`}>
                      <LayoutGrid size={14} />
                    </button>
                    <button onClick={() => setLibraryViewMode("list")} className={`p-1.5 rounded-md transition-all ${libraryViewMode === "list" ? "bg-accent text-black shadow-accent" : "text-text-muted hover:text-text-primary"}`}>
                      <List size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle group hover:border-accent/30 transition-all">
                  <div>
                    <p className="text-[13px] font-medium text-text-primary leading-none">Playlist View</p>
                    <p className="text-[9px] text-text-muted mt-1">Collection presentation</p>
                  </div>
                  <div className="flex gap-1 p-1 bg-surface-raised rounded-lg border border-border-subtle">
                    <button onClick={() => setPlaylistViewMode("grid")} className={`p-1.5 rounded-md transition-all ${playlistViewMode === "grid" ? "bg-accent text-black shadow-accent" : "text-text-muted hover:text-text-primary"}`}>
                      <LayoutGrid size={14} />
                    </button>
                    <button onClick={() => setPlaylistViewMode("list")} className={`p-1.5 rounded-md transition-all ${playlistViewMode === "list" ? "bg-accent text-black shadow-accent" : "text-text-muted hover:text-text-primary"}`}>
                      <List size={14} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </Section>

          {
            // This is the library info part
          }
          <Section icon={<Info size={16} />} title="Library Info">
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Tracks", displayTracks.length],
                ["Artists", new Set(displayTracks.map((t) => t.artist)).size],
                ["Albums", new Set(displayTracks.map((t) => t.album)).size],
                ["Formats", [...new Set(displayTracks.map((t) => t.format))].join(", ") || "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="p-3 rounded-xl bg-surface-overlay border border-border-subtle">
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest block mb-1">{label}</span>
                  <span className="text-lg font-display font-black text-text-primary">{value}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {
          // This is row 4: software info — full width
        }
        <div className="grid grid-cols-1 gap-5">
          <Section icon={<ArrowUpCircle size={16} />} title="Software Info" className="lg:col-span-2">
            <div className="flex flex-col p-5 rounded-xl bg-surface-overlay border border-border-subtle gap-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 shadow-sm flex items-center justify-center flex-shrink-0">
                    <Music2 size={24} className="text-accent" />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-display font-black text-xl text-text-primary tracking-tight">Mewsic <span className="text-accent text-sm ml-1">v{appVersion}</span></p>
                    <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest font-bold">Crafted with love for high-quality audio.</p>
                  </div>
                </div>
                <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-3">
                  <div className="flex flex-col sm:items-end">
                    <p className="text-[9px] text-text-muted/60 font-mono uppercase tracking-[0.2em]">Build: {getBuildId()}</p>
                    <p className="text-[9px] text-text-muted/60 font-mono uppercase tracking-[0.2em] mt-0.5">{getOSName()}</p>
                  </div>
                  <button
                    onClick={handleCheckForUpdates}
                    className="bg-surface-raised border border-border-subtle text-text-primary px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-accent hover:text-accent transition-all flex items-center gap-2 shadow-sm"
                  >
                    <RefreshCw size={14} />
                    Check for Updates
                  </button>
                </div>
              </div>

              <div className="pt-5 border-t border-border-subtle">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest">What's New in v{appVersion}</span>
                  <a href="https://xeoniii.github.io/updates" target="_blank" rel="noreferrer" className="text-[9px] text-accent hover:underline uppercase tracking-wider font-bold">View All</a>
                </div>
                <ul className="space-y-2.5 text-xs text-text-muted">
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>Fixed a bug where songs with special characters like # or ? would cause the app to panic.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>Collapsible sidebar. This was already a feature on smaller window sizes, but now you can toggle it manually!</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>The Queue system is finally exposed! You can now access it via the queue button next to the mute toggle on the player bar.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>All music cards now use the updated style as part of the new UI changes.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>Auto Updater now works perfectly (was broken due to a change in v1.0.0-2).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>Fixed a queue system bug that caused the loop-all function to stay on at all times.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>Added Custom Idle Discord-RPC.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>Under the hood changes to coverart loading to reduce RAM usage and CPU stress, while keeping good quality of course.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-accent mt-0.5 font-bold">•</span>
                    <span>Changes and Addition to how how playlist icons work. Use them to find out!</span>
                  </li>
                </ul>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {showFlashbangWarning && (
        <ConfirmationModal title="Warning" message="This will switch to light mode. Are you sure?" confirmLabel="Yes" cancelLabel="No" onConfirm={() => { setTheme("light"); setShowFlashbangWarning(false); }} onCancel={() => setShowFlashbangWarning(false)} />
      )}

      {showRestartModal && (
        <ConfirmationModal title="Restart" message="Titlebar changes require a restart. Save?" confirmLabel="Save" cancelLabel="Discard" onConfirm={() => setShowRestartModal(false)} onCancel={() => { setCustomTitlebar(!customTitlebar); setShowRestartModal(false); }} />
      )}

      {showUpdateModal && (
        <UpdateModal onClose={() => setShowUpdateModal(false)} />
      )}


      {showColorPicker && (
        <ColorPickerModal onClose={() => setShowColorPicker(false)} />
      )}
    </div>
  );
}

function ShortcutRow({ label, action, shortcut, onSet }: {
  label: string;
  action: keyof ShortcutMap;
  shortcut: Shortcut;
  onSet: (action: keyof ShortcutMap, key: string, ctrl?: boolean, shift?: boolean, alt?: boolean) => void;
}) {
  const [isRecording, setIsRecording] = React.useState(false);

  React.useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      e.preventDefault();
      e.stopPropagation();

      // Don't register if it's just a modifier key alone
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      onSet(action, e.key === " " ? "Space" : e.key, e.ctrlKey, e.shiftKey, e.altKey);
      setIsRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isRecording, action, onSet]);

  const displayKey = () => {
    const parts = [];
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.shift) parts.push("Shift");
    if (shortcut.alt) parts.push("Alt");
    parts.push(shortcut.key);
    return parts.join(" + ");
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <button
        onClick={() => setIsRecording(true)}
        className={`px-4 py-1.5 rounded-lg border text-[10px] font-black transition-all min-w-[140px] text-center uppercase tracking-wider ${isRecording
          ? "bg-accent text-black border-accent animate-pulse"
          : "bg-surface-raised text-text-muted border-border-subtle hover:border-accent hover:text-accent"
          }`}
      >
        {isRecording ? "Press a key..." : displayKey()}
      </button>
    </div>
  );
}
