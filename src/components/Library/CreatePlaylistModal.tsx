import React, { useState } from "react";
import { X, Plus, Music, Loader2, CheckCircle2 } from "lucide-react";
import { useLibrary } from "../../hooks/useLibrary";
import { useStore } from "../../store";

interface CreatePlaylistModalProps {
  onClose: () => void;
}

export function CreatePlaylistModal({ onClose }: CreatePlaylistModalProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const { createNewPlaylist } = useLibrary();
  const { setActivePlaylist } = useStore(state => ({
    setActivePlaylist: state.setActivePlaylist
  }));

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isCreating) return;

    setIsCreating(true);
    try {
      const pl = await createNewPlaylist(trimmedName);
      if (pl) {
        setActivePlaylist(pl.id);
        onClose();
      }
    } catch (err) {
      console.error("Failed to create playlist:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-fade-in backdrop-blur-md bg-black/60">
      <div className="w-full max-w-md bg-surface-base border border-border-glass shadow-2xl rounded-3xl overflow-hidden animate-scale-in flex flex-col">
        {
  // This is the header section
}
        <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-raised/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Plus size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">New Playlist</h2>
              <p className="text-xs text-text-muted">Create a fresh collection</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
              Playlist Name
            </label>
            <div className="relative group">
              <Music className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={18} />
              <input 
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Mix..."
                className="w-full bg-black/20 border border-border-subtle rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all text-sm font-medium text-text-primary placeholder:text-text-muted"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-accent-muted/5 border border-white/5 flex items-start gap-3">
            <CheckCircle2 size={16} className="text-accent mt-0.5" />
            <p className="text-[11px] text-text-secondary leading-relaxed">
              New playlists are saved as .json files in your library folder and can be shared with friends!
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border border-border-subtle text-xs font-bold text-text-muted hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="flex-[2] bg-accent hover:bg-accent/80 disabled:opacity-30 text-black font-black text-xs uppercase tracking-[0.1em] py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent/10 active:scale-95"
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Create Playlist</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
