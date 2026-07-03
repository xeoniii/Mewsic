import React, { useState, useEffect, useRef } from "react";
import {
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Play,
  Square,
  ExternalLink,
  Info,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Save,
  Pencil,
  Trash2,
  PlusCircle,
  MinusCircle,
  Share2
} from "lucide-react";
import { toggleFullscreen } from "../../utils/tauriApi";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useLibrary } from "../../hooks/useLibrary";
import type { Track, AudioPreset } from "../../types";
import { EditPlaylistModal } from "../Library/EditPlaylistModal";

interface ContextMenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

function ContextMenuItem({ icon, label, onClick, disabled, danger }: ContextMenuItemProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${disabled
          ? "opacity-40 cursor-not-allowed text-text-muted"
          : danger
            ? "text-red-400 hover:bg-red-500/10 hover:scale-[1.02]"
            : "text-text-secondary hover:bg-accent-muted hover:text-text-accent hover:scale-[1.02]"
        }
      `}
    >
      <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="my-1.5 mx-1 h-px bg-border-subtle" />;
}

export function ContextMenu() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [canCopy, setCanCopy] = useState(false);
  const [canPaste, setCanPaste] = useState(false);
  const [contextTrack, setContextTrack] = useState<Track | null>(null);
  const [contextPresetId, setContextPresetId] = useState<string | null>(null);
  const [contextPlaylistId, setContextPlaylistId] = useState<string | null>(null);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [contextType, setContextType] = useState<"library" | "playlist" | "audio-preset" | "playlist-item" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    isPlaying, setIsPlaying, playNext, playPrev, requestSeek, currentTrack,
    setShowAbout, tracks, setAddTrack, setEditTrack, setDeleteTrack,
    activePlaylistId, playlists, goBack, goForward, historyIndex, history,
    deletePreset, updatePresetSettings, setRenamePresetId, addNotification, setQueue,
    setSharePlaylist
  } = useStore(useShallow((s) => ({
    isPlaying: s.isPlaying, setIsPlaying: s.setIsPlaying, playNext: s.playNext,
    playPrev: s.playPrev, requestSeek: s.requestSeek, currentTrack: s.currentTrack,
    setShowAbout: s.setShowAbout, tracks: s.tracks, setAddTrack: s.setAddTrack,
    setEditTrack: s.setEditTrack, setDeleteTrack: s.setDeleteTrack,
    activePlaylistId: s.activePlaylistId, playlists: s.playlists,
    goBack: s.goBack, goForward: s.goForward, historyIndex: s.historyIndex, history: s.history,
    deletePreset: s.deletePreset, updatePresetSettings: s.updatePresetSettings, setRenamePresetId: s.setRenamePresetId,
    addNotification: s.addNotification, setQueue: s.setQueue,
    setSharePlaylist: s.setSharePlaylist
  })));

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const { removeTrackFromPlaylist, removePlaylistData } = useLibrary();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      const selection = window.getSelection()?.toString();
      const target = e.target as HTMLElement;
      const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      const trackEl = target.closest("[data-track-id]");
      if (trackEl) {
        const trackId = trackEl.getAttribute("data-track-id");
        const context = trackEl.getAttribute("data-context") as "library" | "playlist";
        let track = tracks.find(t => t.id === trackId);
        if (!track && activePlaylistId) {
          const activePl = playlists.find(p => p.id === activePlaylistId);
          if (activePl && activePl.tracks) {
            track = activePl.tracks.find(t => t.id === trackId);
          }
        }
        setContextTrack(track || null);
        setContextType(context);
      } else {
        setContextTrack(null);

        const presetEl = target.closest("[data-preset-id]");
        if (presetEl) {
          setContextPresetId(presetEl.getAttribute("data-preset-id"));
          setContextType("audio-preset");
          setContextPlaylistId(null);
        } else {
          setContextPresetId(null);
          
          const playlistEl = target.closest("[data-playlist-id]");
          if (playlistEl) {
            setContextPlaylistId(playlistEl.getAttribute("data-playlist-id"));
            setContextType("playlist-item");
          } else {
            setContextPlaylistId(null);
            setContextType(null);
          }
        }
      }

      setCanCopy(!!selection || isInput);
      setCanPaste(isInput);

      setPosition({ x: e.clientX, y: e.clientY });
      setVisible(true);
    };

    const handleClick = () => setVisible(false);
    const handleScroll = () => setVisible(false);

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [tracks]);

  useEffect(() => {
    if (visible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      let { x, y } = position;

      if (x + rect.width > screenWidth) {
        x = x - rect.width;
      }
      if (y + rect.height > screenHeight) {
        y = y - rect.height;
      }

      x = Math.max(8, x);
      y = Math.max(8, y);

      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    }
  }, [visible, position]);

  if (!visible && !editingPlaylistId) return null;

  const handleRestart = () => {
    if (currentTrack) requestSeek(0);
  };

  const handleTogglePlay = () => {
    if (currentTrack) setIsPlaying(!isPlaying);
  };

  const handleCopy = () => document.execCommand("copy");
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
        const start = activeEl.selectionStart || 0;
        const end = activeEl.selectionEnd || 0;
        const val = activeEl.value;
        activeEl.value = val.substring(0, start) + text + val.substring(end);
      }
    } catch (err) {
      console.error("Paste failed", err);
    }
  };

  const handleToggleFullscreen = async () => {
    setVisible(false);
    await toggleFullscreen();
  };

  const handlePlayPlaylist = () => {
    if (!contextPlaylistId) return;
    const pl = playlists.find(p => p.id === contextPlaylistId);
    if (!pl) return;
    const trackMap = new Map(tracks.map(t => [t.id, t]));
    const plTracks = pl.trackIds.map(id => trackMap.get(id)).filter(Boolean) as Track[];
    if (plTracks.length > 0) {
      setQueue(plTracks, 0, pl.id);
      setIsPlaying(true);
    }
    setVisible(false);
  };

  const handleDeletePlaylist = async () => {
    if (!contextPlaylistId) return;
    const pl = playlists.find(p => p.id === contextPlaylistId);
    if (!pl) return;
    if (confirm(`Delete playlist "${pl.name}"?`)) {
      await removePlaylistData(pl);
    }
    setVisible(false);
  };
  const handleSharePlaylist = () => {
    if (!contextPlaylistId) return;
    const pl = playlists.find(p => p.id === contextPlaylistId);
    if (pl) {
      setSharePlaylist(pl);
    }
    setVisible(false);
  };
  const handleRemoveFromPlaylist = async () => {
    if (!contextTrack || !activePlaylistId) return;
    const playlist = playlists.find(p => p.id === activePlaylistId);
    if (playlist && confirm(`Remove "${contextTrack.title}" from this playlist?`)) {
      await removeTrackFromPlaylist(playlist, contextTrack.id);
      setVisible(false);
    }
  };

  return (
    <>
      {visible && (
        <div
          ref={menuRef}
      className="fixed z-[9999] min-w-[240px] glass-heavy p-1.5 rounded-2xl border border-border-glass shadow-[0_20px_50px_rgba(0,0,0,0.4)] animate-scale-in"
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: "auto",
        transformOrigin: "top left",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col">
        {
  // This is the playback controls grid part
}
        <div className="grid grid-cols-4 gap-1 mb-1 px-1">
          <button
            onClick={playPrev}
            className="btn-icon p-2 hover:bg-accent-muted"
            title="Previous"
            disabled={!currentTrack}
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={handleTogglePlay}
            className="btn-icon p-2 hover:bg-accent-muted"
            title={isPlaying ? "Stop" : "Play"}
            disabled={!currentTrack}
          >
            {isPlaying ? <Square size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={playNext}
            className="btn-icon p-2 hover:bg-accent-muted"
            title="Next"
            disabled={!currentTrack}
          >
            <SkipForward size={16} />
          </button>
          <button
            onClick={handleRestart}
            className="btn-icon p-2 hover:bg-accent-muted"
            title="Restart Song"
            disabled={!currentTrack}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <Divider />

        {contextTrack ? (
          <>
            <ContextMenuItem
              icon={<Pencil size={16} />}
              label="Edit Metadata"
              onClick={() => { setEditTrack(contextTrack); setVisible(false); }}
            />
            {contextType === "playlist" ? (
              <ContextMenuItem
                icon={<MinusCircle size={16} />}
                label="Remove from Playlist"
                onClick={handleRemoveFromPlaylist}
                danger
              />
            ) : (
              <ContextMenuItem
                icon={<PlusCircle size={16} />}
                label="Add to Playlist"
                onClick={() => { setAddTrack(contextTrack); setVisible(false); }}
              />
            )}

            {!contextTrack.isVirtual && (
              <ContextMenuItem
                icon={<Trash2 size={16} />}
                label="Delete from Disk"
                onClick={() => { setDeleteTrack(contextTrack); setVisible(false); }}
                danger
              />
            )}
            <Divider />
          </>
        ) : contextType === "playlist-item" && contextPlaylistId ? (
          <>
            <ContextMenuItem
              icon={<Play size={16} />}
              label="Play Playlist"
              onClick={handlePlayPlaylist}
            />
            <ContextMenuItem
              icon={<Pencil size={16} />}
              label="Edit Playlist"
              onClick={() => { setEditingPlaylistId(contextPlaylistId); setVisible(false); }}
            />
            <ContextMenuItem
              icon={<Share2 size={16} />}
              label="Share Playlist"
              onClick={handleSharePlaylist}
            />
            <Divider />
            <ContextMenuItem
              icon={<Trash2 size={16} />}
              label="Delete Playlist"
              onClick={handleDeletePlaylist}
              danger
            />
            <Divider />
          </>
        ) : contextType === "audio-preset" && contextPresetId ? (
          <>
            {contextPresetId !== "flat" && (
              <ContextMenuItem
                icon={<Pencil size={16} />}
                label="Rename Preset"
                onClick={() => { setRenamePresetId(contextPresetId); setVisible(false); }}
              />
            )}
            <ContextMenuItem
              icon={<Save size={16} />}
              label="Save Current Settings"
              onClick={() => { updatePresetSettings(contextPresetId); addNotification?.("Settings saved to preset", "success"); setVisible(false); }}
            />
            {contextPresetId !== "flat" && (
              <>
                <Divider />
                <ContextMenuItem
                  icon={<Trash2 size={16} />}
                  label="Delete Preset"
                  onClick={() => { deletePreset(contextPresetId); setVisible(false); }}
                  danger
                />
              </>
            )}
            <Divider />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 mb-1 px-1">
              <button
                onClick={() => { goBack(); setVisible(false); }}
                className={`nav-item justify-center gap-2 py-2 ${!canGoBack ? 'opacity-30 cursor-not-allowed' : ''}`}
                title="Back"
                disabled={!canGoBack}
              >
                <ArrowLeft size={14} /> <span className="text-xs">Back</span>
              </button>
              <button
                onClick={() => { goForward(); setVisible(false); }}
                className={`nav-item justify-center gap-2 py-2 ${!canGoForward ? 'opacity-30 cursor-not-allowed' : ''}`}
                title="Forward"
                disabled={!canGoForward}
              >
                <span className="text-xs">Forward</span> <ArrowRight size={14} />
              </button>
            </div>
            <Divider />
          </>
        )}

        {(canCopy || canPaste) && (
          <>
            {canCopy && <ContextMenuItem icon={<ExternalLink size={16} />} label="Copy" onClick={handleCopy} />}
            {canPaste && <ContextMenuItem icon={<ExternalLink size={16} />} label="Paste" onClick={handlePaste} />}
            <Divider />
          </>
        )}

        <ContextMenuItem
          icon={<Maximize2 size={16} />}
          label="Toggle Fullscreen"
          onClick={handleToggleFullscreen}
        />

        <Divider />


        <ContextMenuItem
          icon={<Info size={16} />}
          label="About Mewsic"
          onClick={() => {
            setVisible(false);
            setShowAbout(true);
          }}
        />
      </div>
    </div>
      )}
      {editingPlaylistId && (
        <EditPlaylistModal
          playlist={playlists.find(p => p.id === editingPlaylistId)!}
          onClose={() => setEditingPlaylistId(null)}
        />
      )}
    </>
  );
}
