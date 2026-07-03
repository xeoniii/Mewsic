import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { X, Search, CheckCircle2, Circle, Music2 } from "lucide-react";
import { List as VList } from "react-window";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useLibrary } from "../../hooks/useLibrary";
import type { Track, Playlist } from "../../types";

interface ManagePlaylistTracksModalProps {
  playlist: Playlist;
  onClose: () => void;
}

export function ManagePlaylistTracksModal({
  playlist,
  onClose,
}: ManagePlaylistTracksModalProps) {
  const { tracks, updatePlaylist } = useStore(useShallow((s) => ({ tracks: s.tracks, updatePlaylist: s.updatePlaylist })));
  const { updatePlaylistData } = useLibrary();
  
  const [localSearch, setLocalSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(localSearch);
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch]);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setListHeight(el.clientHeight || 400);
    return () => ro.disconnect();
  }, []);

  const currentIds = useMemo(
    () => new Set(playlist.trackIds || []),
    [playlist.trackIds]
  );

  const filtered = useMemo(() => {
    const s = debouncedSearch.toLowerCase();
    if (!s) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(s) ||
        t.artist.toLowerCase().includes(s) ||
        t.album.toLowerCase().includes(s)
    );
  }, [tracks, debouncedSearch]);

  const toggleTrack = useCallback(async (trackId: string) => {
    const newIds = new Set(playlist.trackIds || []);
    if (newIds.has(trackId)) {
      newIds.delete(trackId);
    } else {
      newIds.add(trackId);
    }

    const updated = {
      ...playlist,
      trackIds: Array.from(newIds),
    };
    updatePlaylist(updated);
    await updatePlaylistData(updated);
  }, [playlist, updatePlaylist, updatePlaylistData]);

  const RowComponent = useCallback(
    (props: { index: number; style: React.CSSProperties }) => {
      const track = filtered[props.index];
      if (!track) return null;
      const isSelected = currentIds.has(track.id);
      return (
        <div style={props.style} className="px-2 py-0.5">
          <button
            onClick={() => toggleTrack(track.id)}
            className={`w-full flex items-center gap-4 px-4 py-2 rounded-2xl transition-all duration-150 group h-[52px]
              ${
                isSelected
                  ? "bg-accent-muted/50 text-accent"
                  : "hover:bg-surface-overlay text-text-primary"
              }`}
          >
            <div className="w-9 h-9 rounded-lg bg-surface-raised overflow-hidden flex-shrink-0 flex items-center justify-center">
              <Music2 size={15} className={isSelected ? "text-accent" : "text-text-muted"} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className={`text-sm font-medium truncate ${isSelected ? "text-accent" : "text-text-primary"}`}>
                {track.title}
              </p>
              <p className="text-xs text-text-secondary truncate">
                {track.artist} · {track.album}
              </p>
            </div>
            <div className={`transition-colors ${isSelected ? "text-accent" : "text-text-muted group-hover:text-text-secondary"}`}>
              {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </div>
          </button>
        </div>
      );
    },
    [filtered, currentIds, toggleTrack]
  );

  const VListElement = VList as any;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-elevated w-full max-w-2xl h-[80vh] rounded-3xl border border-border-glass shadow-2xl flex flex-col overflow-hidden">
        {
  // This is the header section
}
        <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-display font-bold text-text-primary">
              Add songs to "{playlist.name}"
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Select tracks from your library
            </p>
          </div>
          <button onClick={onClose} className="btn-icon p-2">
            <X size={20} />
          </button>
        </div>

        {
  // This is the search part
}
        <div className="px-6 py-4 bg-surface-overlay border-b border-border-subtle flex-shrink-0">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              size={16}
            />
            <input
              autoFocus
              type="text"
              placeholder="Search library tracks…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full h-11 bg-surface-raised border border-border-subtle rounded-xl pl-10 pr-4 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        {
  // This is the list part
}
        <div ref={listContainerRef} className="flex-1 px-2 py-2 min-h-0">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-60">
              <Music2 size={40} className="mb-2" />
              <p>No tracks found</p>
            </div>
          ) : (
            <VListElement
              style={{ height: listHeight, width: "100%" }}
              rowComponent={RowComponent as any}
              rowCount={filtered.length}
              rowHeight={56}
              rowProps={{} as any}
              overscanCount={8}
            />
          )}
        </div>

        {
  // This is the footer section
}
        <div className="px-6 py-4 border-t border-border-subtle bg-surface-overlay flex justify-end flex-shrink-0">
          <button onClick={onClose} className="btn-accent px-8">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
