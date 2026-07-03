import React, { useState, useMemo } from "react";
import { X, Copy, Check, Share2, Info, FolderOpen, Download } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { downloadDir, join } from "@tauri-apps/api/path";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Playlist, Track } from "../../types";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";

interface SharePlaylistModalProps {
  playlist: Playlist;
  onClose: () => void;
}

export function SharePlaylistModal({ playlist, onClose }: SharePlaylistModalProps) {
  const { tracks, playlistsDir, addNotification } = useStore(
    useShallow((s) => ({
      tracks: s.tracks,
      playlistsDir: s.playlistsDir,
      addNotification: s.addNotification
    }))
  );
  const [copied, setCopied] = useState(false);

  const handleCopyToDownloads = async () => {
    try {
      const dir = await downloadDir();
      const safeName = playlist.name.replace(/[<>:"/\\|?*]/g, "").trim() || "playlist";
      const targetPath = await join(dir, `${safeName}.json`);
      
      await writeTextFile(targetPath, jsonContent);
      addNotification(`Playlist copied to Downloads as "${safeName}.json"!`, "success", 4000);
    } catch (err) {
      console.error("Failed to copy to downloads:", err);
      addNotification("Failed to copy playlist to downloads", "error", 4000);
    }
  };

  const jsonContent = useMemo(() => {
    // Hydrate playlist with full metadata for sharing
    const hydratedTracks = playlist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter(Boolean) as Track[];
    
    const exportData = {
      ...playlist,
      tracks: hydratedTracks,
    };

    return JSON.stringify(exportData, null, 2);
  }, [playlist, tracks]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-xl mx-4 overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2 text-text-primary">
            <Share2 size={18} className="text-accent" />
            <h2 className="font-display font-semibold">Share Playlist</h2>
          </div>
          <button onClick={onClose} className="btn-icon p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {
  // This is the instructions part
}
          <div className="flex gap-4 p-4 rounded-xl bg-accent/5 border border-accent/10">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent flex-shrink-0">
              <Info size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">How to share</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Copy the code below and send it to a friend. They can paste it directly into the 
                <span className="text-accent font-bold"> Harbour search bar</span> to import this playlist and all its tracks automatically!
              </p>
            </div>
          </div>

          {
  // This is the code view part
}
          <div className="relative group">
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                onClick={handleCopy}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  copied ? 'bg-green-500 text-white' : 'bg-accent text-black hover:opacity-90'
                }`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>
            <textarea
              readOnly
              value={jsonContent}
              className="w-full h-64 px-4 py-4 rounded-xl bg-surface-overlay border border-border-subtle text-[10px] font-mono text-text-muted outline-none scrollbar-hide resize-none leading-normal"
            />
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                onClick={async () => {
                  if (playlistsDir) {
                    try {
                      await invoke("show_in_folder", { path: playlistsDir });
                    } catch (e) {
                      console.error("Failed to open playlists folder:", e);
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-raised border border-border-glass text-xs font-bold text-text-primary hover:bg-white/5 transition-all justify-center group"
              >
                <FolderOpen size={16} className="text-accent group-hover:scale-110 transition-transform" />
                Open Playlists Folder
              </button>
              <button
                onClick={handleCopyToDownloads}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-accent/80 text-xs font-bold text-black transition-all justify-center group shadow-lg shadow-accent/10 active:scale-95"
              >
                <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
                Copy to Downloads
              </button>
            </div>
            
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
              Shared as Mewsic Code (JSON)
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-border-subtle bg-white/2">
          <button onClick={onClose} className="btn-accent px-8">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
