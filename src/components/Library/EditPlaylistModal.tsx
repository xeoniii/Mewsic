import React, { useState, useCallback, useRef } from "react";
import { X, Save, ListMusic, ImageIcon, Upload } from "lucide-react";
import { useLibrary } from "../../hooks/useLibrary";
import type { Playlist } from "../../types";
import { getCoverArtSync } from "../../utils/tauriApi";

interface EditPlaylistModalProps {
  playlist: Playlist;
  onClose: () => void;
}

export function EditPlaylistModal({ playlist, onClose }: EditPlaylistModalProps) {
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
      let activePlaylist = { ...playlist };
      
      if (name.trim() !== playlist.name) {
        // Name changed, use renamePlaylist which handles the file move
        // Capture the updated playlist object (with new name and filePath)
        activePlaylist = await renamePlaylist(playlist, name.trim());
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
  }, [playlist, name, coverArt, renamePlaylist, updatePlaylistData, onClose]);

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
                    {coverArt ? (
                        <img src={coverArt} alt="Playlist cover" className="w-full h-full object-cover" />
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
                {playlist.tracks && playlist.tracks.length > 0 && (
                  <div className="w-full flex flex-col items-center gap-2 mt-2">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Or choose from playlist tracks:</p>
                    <div className="flex items-center justify-center gap-2 flex-wrap w-full max-h-[80px] overflow-y-auto overflow-x-hidden scrollbar-thin">
                      {playlist.tracks.map((track) => (
                        <button
                          key={track.id}
                          className="w-10 h-10 rounded-lg bg-surface-overlay flex-shrink-0 overflow-hidden border border-border-subtle hover:border-accent transition-colors focus:outline-none focus:border-accent"
                          onClick={() => {
                            const url = getCoverArtSync(track.filePath, 256);
                            if (url) {
                              const img = new Image();
                              img.crossOrigin = "anonymous";
                              img.onload = () => {
                                const canvas = document.createElement("canvas");
                                canvas.width = 300;
                                canvas.height = 300;
                                const ctx = canvas.getContext("2d");
                                ctx?.drawImage(img, 0, 0, 300, 300);
                                setCoverArt(canvas.toDataURL("image/jpeg", 0.8));
                              };
                              img.src = url;
                            }
                          }}
                        >
                          <img src={getCoverArtSync(track.filePath, 64) || undefined} alt="Track cover" className="w-full h-full object-cover" loading="lazy" />
                        </button>
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
