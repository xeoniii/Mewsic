import React, { useState, useEffect } from "react";
import { X, Clipboard, FileJson, Music, Loader2, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { Playlist, Track } from "../../types";
import { useLibrary } from "../../hooks/useLibrary";
import { useStore } from "../../store";

interface ImportPlaylistModalProps {
  onClose: () => void;
}

export function ImportPlaylistModal({ onClose }: ImportPlaylistModalProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [preview, setPreview] = useState<Playlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const { rehydratePlaylist } = useLibrary();
  const { addNotification, allTracks } = useStore(state => ({
    addNotification: state.addNotification,
    allTracks: state.tracks
  }));

  const resolvedTracks = React.useMemo(() => {
    if (!preview) return [];
    if (preview.tracks && preview.tracks.length > 0) return preview.tracks;
    return preview.trackIds.map(id => {
      const found = allTracks.find(t => t.id === id);
      if (found) return found;
      return {
        id,
        title: "Unknown Track",
        artist: `ID: ${id.substring(0, 8)}...`,
        album: "",
        filePath: "",
        dateAdded: 0
      } as Track;
    });
  }, [preview, allTracks]);

  useEffect(() => {
    if (!jsonInput.trim()) {
      setPreview(null);
      setError(null);
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput.trim());
      // Normalize snake_case to camelCase
      const normalized: Playlist = {
        id: parsed.id || "",
        name: parsed.name || "Untitled Playlist",
        filePath: parsed.filePath || parsed.file_path || "",
        trackIds: parsed.trackIds || parsed.track_ids || [],
        createdAt: parsed.createdAt || parsed.created_at || Date.now(),
        tracks: parsed.tracks || [],
        coverArt: parsed.coverArt || parsed.cover_art || undefined
      };

      if (!normalized.id || (normalized.trackIds.length === 0 && (normalized.tracks || []).length === 0)) {
        throw new Error("Invalid playlist format. Missing ID or tracks.");
      }
      setPreview(normalized);
      setError(null);
    } catch (err: any) {
      setPreview(null);
      setError(err.message.includes("JSON") ? "Invalid JSON syntax" : err.message);
    }
  }, [jsonInput]);

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        filters: [{ name: "Playlist", extensions: ["json"] }],
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        const bytes = await readFile(selected);
        const content = new TextDecoder().decode(bytes);
        setJsonInput(content);
      }
    } catch (err) {
      setError("Failed to read file");
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setIsImporting(true);
    try {
      await rehydratePlaylist(preview);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to import playlist");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-fade-in backdrop-blur-md bg-black/60">
      <div className="w-full max-w-2xl bg-surface-base border border-border-glass shadow-2xl rounded-3xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">

        {
  // This is the header section
}
        <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-raised/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Download size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">Import Playlist</h2>
              <p className="text-xs text-text-muted">Paste code or select a JSON file</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {
  // This is the input area part
}
          <div className="grid grid-cols-1 gap-4">
            <div className="relative group">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste playlist JSON code here..."
                className="w-full h-32 bg-black/20 border border-border-subtle rounded-2xl p-4 text-xs font-mono text-text-secondary focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all resize-none scrollbar-thin"
              />
              <div className="absolute right-3 bottom-3 flex gap-2">
                <button 
                  onClick={handleFileSelect}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised border border-border-subtle hover:border-accent/40 transition-all text-[10px] font-bold text-text-muted hover:text-accent"
                >
                  <FileJson size={14} />
                  SELECT FILE
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/5 p-3 rounded-xl border border-red-400/20 animate-shake">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {
  // This is the preview section part
}
          {preview && (
            <div className="bg-surface-raised/50 border border-border-subtle rounded-2xl p-6 space-y-4 animate-slide-up">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-black/40 border border-border-subtle overflow-hidden flex-shrink-0 flex items-center justify-center shadow-lg">
                  {preview.coverArt ? (
                    <img src={preview.coverArt} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <Music size={32} className="text-text-muted/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-text-primary truncate">{preview.name || "Untitled Playlist"}</h3>
                  <p className="text-sm text-text-muted">
                    {(preview.trackIds?.length || (preview.tracks?.length || 0))} tracks found in code
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent uppercase tracking-wider">
                      Ready to Import
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-thin border-t border-border-subtle pt-4">
                {resolvedTracks.slice(0, 10).map((t: Track, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-text-secondary group">
                    <span className="text-text-muted font-mono w-4">{i + 1}.</span>
                    <span className="truncate group-hover:text-text-primary transition-colors">{t.title}</span>
                    <span className="text-text-muted mx-1">/</span>
                    <span className="truncate text-text-muted italic">{t.artist}</span>
                  </div>
                ))}
                {(resolvedTracks.length || 0) > 10 && (
                  <p className="text-[10px] text-text-muted italic pt-1 pl-7">
                    + {resolvedTracks.length - 10} more tracks
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {
  // This is the footer section
}
        <div className="p-6 bg-surface-raised/50 border-t border-border-subtle flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!preview || isImporting}
            className="px-8 py-2.5 rounded-xl bg-accent hover:bg-accent/80 disabled:opacity-30 text-black font-bold text-sm transition-all shadow-lg shadow-accent/10 flex items-center gap-2 active:scale-95"
          >
            {isImporting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Confirm Import</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
