import React, { useState, useEffect, memo } from "react";
import { Play, PlusCircle, MinusCircle, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { formatDuration, stringToColor } from "../../utils/helpers";
import { getCoverArt } from "../../utils/tauriApi";
import type { Track } from "../../types";

interface MusicCardProps {
  track: Track;
  allTracks: Track[];
  trackIndex: number;
  viewMode?: "grid" | "list";
  onAddToPlaylist?: (track: Track) => void;
  onRemoveFromPlaylist?: (track: Track) => void;
  onEditMetadata?: (track: Track) => void;
  onDelete?: (track: Track) => void;
  dragHandleProps?: any;
  sourceId?: string | null;
}

const CoverArt = memo(function CoverArt({
  track,
  size = 256,
  className = "",
}: {
  track: Track;
  size?: number;
  className?: string;
}) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const lowEndMode = useStore(s => s.lowEndMode);
  
  useEffect(() => {
    if (track.coverArt && (track.coverArt.startsWith("http://") || track.coverArt.startsWith("https://") || track.coverArt.startsWith("data:"))) {
      setCoverUrl(track.coverArt);
      return;
    }

    let cancelled = false;
    getCoverArt(track.filePath, size, lowEndMode).then((url) => {
      if (!cancelled) setCoverUrl(url);
    });
    return () => { cancelled = true; };
  }, [track.filePath, track.coverArt, size, lowEndMode]);

  if (coverUrl && !imgError) {
    return (
      <img
        src={coverUrl}
        alt={track.album}
        className={`w-full h-full object-cover ${className}`}
        onError={() => setImgError(true)}
        draggable={false}
        loading="lazy"
      />
    );
  }

  const initials = (track.artist[0] ?? "?").toUpperCase();
  const bg = stringToColor(track.artist + track.album);

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ background: bg }}
    >
      <span
        className="font-display font-bold select-none"
        style={{
          fontSize: size < 300 ? "1rem" : "2rem",
          color: "rgba(255,255,255,0.85)",
        }}
      >
        {initials}
      </span>
    </div>
  );
});

export const SortableMusicCard = memo(function SortableMusicCard(props: MusicCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <MusicCard
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
});

export { CoverArt };

export const MusicCard = memo(function MusicCard({
  track,
  allTracks,
  trackIndex,
  viewMode = "grid",
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onEditMetadata,
  onDelete,
  dragHandleProps,
  sourceId = null,
}: MusicCardProps) {
  const isActive = useStore(s => s.currentTrack?.id === track.id);
  const isPlaying = useStore(s => s.isPlaying);
  const setQueue = useStore(s => s.setQueue);
  const setIsPlaying = useStore(s => s.setIsPlaying);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) {
      setIsPlaying(!isPlaying);
    } else {
      setQueue(allTracks, trackIndex, sourceId);
      setIsPlaying(true);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        onClick={handlePlay}
        data-track-id={track.id}
        data-context={onRemoveFromPlaylist ? "playlist" : "library"}
        className={`group flex items-center gap-4 px-4 py-2 rounded-lg cursor-pointer transition-colors w-full h-full
          ${isActive ? "bg-accent/10" : "hover:bg-surface-overlay"}`}
      >
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary transition-colors flex flex-col gap-1 pr-1 opacity-0 group-hover:opacity-100"
          >
            <div className="w-3.5 h-0.5 bg-current rounded-full opacity-60" />
            <div className="w-3.5 h-0.5 bg-current rounded-full opacity-60" />
          </div>
        )}

        <div className="w-8 flex justify-end flex-shrink-0 text-text-muted relative h-full items-center">
          {isActive && isPlaying ? (
            <div className="flex gap-0.5 items-end h-4 mx-auto text-accent">
              <div className="eq-bar !bg-accent" />
              <div className="eq-bar !bg-accent" />
              <div className="eq-bar !bg-accent" />
            </div>
          ) : (
            <>
              <span className={`text-sm ${isActive ? "text-accent opacity-100 group-hover:opacity-0" : "group-hover:opacity-0 opacity-100"}`}>
                {trackIndex + 1}
              </span>
              <div className="absolute inset-0 flex items-center justify-end opacity-0 group-hover:opacity-100">
                <Play size={14} fill="currentColor" className="text-text-primary" />
              </div>
            </>
          )}
        </div>

        <div className="w-10 h-10 flex-shrink-0 rounded shadow-sm overflow-hidden bg-surface-base">
          <CoverArt track={track} size={128} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${isActive ? "text-accent" : "text-text-primary"}`}>
              {track.title}
            </span>
            {(track.isVirtual || track.provider === "virtual") && (
              <span className="text-[9px] font-semibold tracking-wider uppercase bg-accent/15 border border-accent/30 text-accent px-1.5 py-0.5 rounded flex-shrink-0">
                Virtual
              </span>
            )}
          </div>
          <span className="text-xs text-text-secondary truncate mt-0.5">
            {track.artist}
          </span>
        </div>

        <div className="hidden md:flex flex-1 min-w-0 text-sm text-text-secondary truncate">
          <span className="truncate">{track.album}</span>
        </div>

        <div className="w-12 flex-shrink-0 text-right text-xs text-text-muted font-mono pr-2">
          {formatDuration(track.duration)}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`music-card group ${isActive ? "playing" : ""}`}
      onClick={handlePlay}
      data-track-id={track.id}
      data-context={onRemoveFromPlaylist ? "playlist" : "library"}
    >
      <div className="relative aspect-square overflow-hidden">
        <CoverArt track={track} size={400} />

        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${
            isActive && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isActive && isPlaying ? (
            <div className="flex gap-1 items-end h-6 pb-0.5">
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shadow-accent"
              style={{ boxShadow: "0 0 20px var(--accent-glow)" }}
            >
              <Play size={18} fill="#000" color="#000" style={{ marginLeft: 2 }} />
            </div>
          )}
        </div>
      </div>

      <div className="p-3 flex flex-col min-w-0 gap-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <p
            className={`font-medium text-sm leading-tight truncate ${
              isActive ? "text-accent" : "text-text-primary"
            }`}
            title={track.title}
          >
            {track.title}
          </p>
          {(track.isVirtual || track.provider === "virtual") && (
            <span className="text-[9px] font-semibold tracking-wider uppercase bg-accent/15 border border-accent/30 text-accent px-1.2 py-0.5 rounded flex-shrink-0">
              Virtual
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary truncate" title={track.artist}>
          {track.artist}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-text-muted font-mono">
            {formatDuration(track.duration)}
          </span>
        </div>
      </div>
    </div>
  );
});