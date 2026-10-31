import React, { useState, useCallback, useRef, useEffect } from "react";
import { X, Save, ImageIcon, Upload, Music } from "lucide-react";
import { useLibrary } from "../../hooks/useLibrary";
import { useStore } from "../../store";
import type { Playlist, Track } from "../../types";
import { getCoverArt, getCoverArtSync } from "../../utils/tauriApi";

interface EditPlaylistModalProps {
  playlist: Playlist;
  onClose: () => void;
}

interface TrackCoverOptionProps {
  track: Track;
  isSelected: boolean;
  onSelect: (dataUrl: string) => void;
}

function TrackCoverOption({ track, isSelected, onSelect }: TrackCoverOptionProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(() => {
    if (track.coverArt && (track.coverArt.startsWith("http") || track.coverArt.startsWith("data:"))) {
      return track.coverArt;
    }
    return getCoverArtSync(track.filePath, 128);
  });
  const [loading, setLoading] = useState(!coverUrl);

  useEffect(() => {
    let cancelled = false;
    if (!coverUrl) {
      setLoading(true);
      getCoverArt(track.filePath, 128)
        .then((url) => {
          if (!cancelled) {
            setCoverUrl(url);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [track.filePath, coverUrl]);

  const handleChoose = async () => {
    let url = coverUrl;
    if (!url) {
      url = await getCoverArt(track.filePath, 300);
    }
    if (!url) return;

    if (url.startsWith("data:")) {
      onSelect(url);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 300;
        let width = img.width || MAX_SIZE;
        let height = img.height || MAX_SIZE;
        if (width > height && width > MAX_SIZE) {
          height = (height * MAX_SIZE) / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width = (width * MAX_SIZE) / height;
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        onSelect(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        onSelect(url!);
      }
    };
    img.onerror = () => {
      onSelect(url!);
    };
    img.src = url;
  };

  return (
    <button
      type="button"
      onClick={handleChoose}
      className={`w-11 h-11 rounded-xl bg-surface-overlay flex-shrink-0 overflow-hidden border transition-all hover:scale-105 active:scale-95 relative group flex items-center justify-center ${
        isSelected ? "border-accent ring-2 ring-accent/50 shadow-md scale-105" : "border-border-subtle hover:border-accent"
      }`}
      title={`${track.title} - ${track.artist || "Unknown"}`}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={track.title}
          className="w-full h-full object-cover pointer-events-none"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-raised text-text-muted group-hover:text-accent">
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : (
            <Music size={16} />
          )}
        </div>
      )}
    </button>
  );
}

export function EditPlaylistModal({ playlist, onClose }: EditPlaylistModalProps) {
  const allTracks = useStore((s) => s.tracks);
  const livePlaylist = useStore((s) => s.playlists.find((p) => p.id === playlist.id)) || playlist;
  const { renamePlaylist, updatePlaylistData } = useLibrary();
  const [name, setName] = useState(playlist.name);
  const [coverArt, setCoverArt] = useState<string | null>(playlist.coverArt || null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Export as compressed JPEG for maximum space saving in JSON
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setCoverArt(dataUrl);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      let activePlaylist = { ...livePlaylist };
      
      if (name.trim() !== livePlaylist.name) {
        // Name changed, use renamePlaylist which handles the file move
        // Capture the updated playlist object (with new name and filePath)
        activePlaylist = await renamePlaylist(livePlaylist, name.trim());
      }
      
      // Update other metadata (coverArt) using the correctly-pathed playlist
      const updated = {
        ...activePlaylist,
        coverArt: coverArt || undefined
      };
      await updatePlaylistData(updated);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [livePlaylist, name, coverArt, renamePlaylist, updatePlaylistData, onClose]);

  // Dynamically resolve tracks from live playlist and store tracks
  const tracksList = React.useMemo(() => {
    const existing = livePlaylist.tracks || [];
    const idSet = new Set(existing.map((t) => t.id));
    const fromLibrary = (livePlaylist.trackIds || [])
      .filter((id) => !idSet.has(id))
      .map((id) => allTracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t);

    return [...existing, ...fromLibrary].slice(0, 30);
  }, [livePlaylist.tracks, livePlaylist.trackIds, allTracks]);

  const [firstTrackCover, setFirstTrackCover] = useState<string | null>(null);
  useEffect(() => {
    if (coverArt) return;
    const firstTrack = tracksList[0];
    if (!firstTrack) {
      setFirstTrackCover(null);
      return;
    }
    if (firstTrack.coverArt && (firstTrack.coverArt.startsWith("http") || firstTrack.coverArt.startsWith("data:"))) {
      setFirstTrackCover(firstTrack.coverArt);
      return;
    }
    let cancelled = false;
    getCoverArt(firstTrack.filePath, 256).then((url) => {
      if (!cancelled && url) setFirstTrackCover(url);
    });
    return () => {
      cancelled = true;
    };
  }, [coverArt, tracksList]);

  const previewCover = coverArt || firstTrackCover;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="font-display font-semibold text-text-primary">Edit Playlist</h2>
          <button onClick={onClose} className="btn-icon p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
                <div 
                    className="w-32 h-32 rounded-2xl bg-surface-overlay border-2 border-dashed border-border-subtle flex items-center justify-center overflow-hidden cursor-pointer hover:border-accent group transition-all relative"
                    onClick={() => fileInputRef.current?.click()}
                >
                    {previewCover ? (
                        <img src={previewCover} alt="Playlist cover" className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-text-muted group-hover:text-accent">
                            <ImageIcon size={32} />
                            <span className="text-[10px] uppercase tracking-wider font-bold">Pick Icon</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Upload size={24} className="text-white" />
                    </div>
                </div>
                <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                />
                <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Recommended: 512x512 PNG/JPG</p>
                {tracksList.length > 0 && (
                  <div className="w-full flex flex-col items-center gap-2 mt-2">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Or choose from playlist tracks:</p>
                    <div className="flex items-center justify-center gap-2.5 flex-wrap w-full max-h-[110px] p-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
                      {tracksList.map((track) => (
                        <TrackCoverOption
                          key={track.id}
                          track={track}
                          isSelected={coverArt !== null && (track.coverArt === coverArt)}
                          onSelect={(newCover) => setCoverArt(newCover)}
                        />
                      ))}
                    </div>
                  </div>
                )}
            </div>
            
            <div>
                <label className="text-xs text-text-muted mb-1 block">Playlist Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
                  placeholder="Enter playlist name..."
                />
            </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle">
          <button onClick={onClose} className="btn-accent bg-surface-overlay text-text-secondary hover:opacity-80">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-accent">
            <Save size={14} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
