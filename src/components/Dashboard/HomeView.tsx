import React, { useMemo, useCallback, useRef } from "react";
import { Play, Music2, Disc3, Clock, FolderOpen, Shuffle, ChevronRight, List, LayoutGrid } from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { MusicCard } from "./MusicCard";
import { formatDuration, formatPreciseDuration, pluralize, shuffleArray } from "../../utils/helpers";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="glass rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center gap-2.5 md:gap-3">
      <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-accent-muted flex items-center justify-center flex-shrink-0">
        <span className="text-accent">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base md:text-lg font-display font-bold text-text-primary leading-none truncate">
          {value}
        </p>
        <p className="text-[10px] md:text-xs text-text-muted mt-0.5 md:mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

import { useDisplayData } from "../../hooks/useDisplayData";

export function HomeView() {
  const { isScanning, setQueue, setIsPlaying, shuffleEnabled, toggleShuffle, homeViewMode, setHomeViewMode, sharonMode } =
    useStore(useShallow((s) => ({
      isScanning: s.isScanning,
      setQueue: s.setQueue,
      setIsPlaying: s.setIsPlaying,
      shuffleEnabled: s.shuffleEnabled,
      toggleShuffle: s.toggleShuffle,
      homeViewMode: s.homeViewMode,
      setHomeViewMode: s.setHomeViewMode,
      sharonMode: s.sharonMode,
    })));

  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  const { displayTracks, demoTrackCount, demoPlaytime } = useDisplayData();

  const recentTracks = useMemo(() => {
    return [...displayTracks]
      .sort((a, b) => b.dateAdded - a.dateAdded)
      .slice(0, 10);
  }, [displayTracks]);

  const totalDuration = useMemo(
    () => displayTracks.reduce((acc, t) => acc + t.duration, 0),
    [displayTracks]
  );

  const uniqueArtists = useMemo(
    () => new Set(displayTracks.map((t) => t.artist)).size,
    [displayTracks]
  );

  const uniqueAlbums = useMemo(
    () => new Set(displayTracks.map((t) => t.album)).size,
    [displayTracks]
  );

  const handlePlayAll = () => {
    if (!displayTracks.length) return;
    setQueue(displayTracks, 0);
    setIsPlaying(true);
  };

  const handleShuffleAll = useCallback(() => {
    if (!displayTracks.length) return;
    setQueue(shuffleArray(displayTracks), 0);
    setIsPlaying(true);
  }, [displayTracks.length]);

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div
          className="w-16 h-16 rounded-full border-2 border-accent border-t-transparent animate-spin"
          style={{ boxShadow: "0 0 24px var(--accent-glow)" }}
        />
        <p className="text-text-secondary text-sm font-medium">
          Scanning your music library…
        </p>
      </div>
    );
  }

  if (!displayTracks.length) {
    return (
      <div className="empty-state h-full">
        <div
          className="w-20 h-20 rounded-3xl bg-accent-muted flex items-center justify-center"
          style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          <Music2 size={36} className="text-accent" />
        </div>
        <div>
          <p className="text-text-primary font-display font-semibold text-lg">
            No music found
          </p>
          <p className="text-text-muted text-sm mt-1">
            Add tracks to your{" "}
            <span className="font-mono text-accent">music/</span> folder or add a
            directory in Settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-y-auto page">
      <div className="flex flex-col gap-8 p-8 pb-4">
        {
  // This is the dashboard header part
}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h2 className="font-display font-black text-3xl md:text-4xl tracking-tight text-text-primary">
              {sharonMode ? "Welcome to Shitville!" : "Welcome back!"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayAll}
              className="btn-accent h-9 px-4 text-xs font-bold"
            >
              <Play size={14} fill="currentColor" />
              Play All
            </button>
            <button
              onClick={handleShuffleAll}
              className="btn-accent bg-accent-muted text-accent border-accent/20 h-9 px-4 text-xs font-bold"
            >
              <Shuffle size={14} />
              Shuffle
            </button>
          </div>
        </div>

        {
  // This is the stats row part
}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={<Music2 size={18} />} label="Total Tracks" value={demoTrackCount} />
          <StatCard icon={<Disc3 size={18} />} label="Unique Artists" value={uniqueArtists} />
          <StatCard icon={<FolderOpen size={18} />} label="Total Albums" value={uniqueAlbums} />
          <StatCard
            icon={<Clock size={18} />}
            label="Playback Time"
            value={formatPreciseDuration(demoPlaytime)}
          />
        </div>
      </div>

      {
  // This is the recently added part
}
      <div className="px-8 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display font-bold text-xl text-text-primary">
              Recently Added
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Your latest discoveries</p>
          </div>
          <div className="flex items-center gap-4">
            {
  // This is the view toggle part
}
            <div className="flex items-center gap-1 bg-surface-raised border border-border-subtle rounded-xl p-1 hidden sm:flex">
              <button
                onClick={() => setHomeViewMode("list")}
                className={`btn-icon ${homeViewMode === "list" ? "bg-surface-overlay text-accent shadow-sm" : ""}`}
                title="List view"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setHomeViewMode("grid")}
                className={`btn-icon ${homeViewMode === "grid" ? "bg-surface-overlay text-accent shadow-sm" : ""}`}
                title="Grid view"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
            <button
              onClick={() => useStore.getState().setActiveView("library")}
              className="group flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-bright transition-colors"
            >
              Explore Library
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {homeViewMode === "grid" ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {recentTracks.map((track, i) => (
              <MusicCard
                key={track.id}
                track={track}
                allTracks={recentTracks}
                trackIndex={i}
                viewMode="grid"
              />
            ))}
          </div>
        ) : (
          <div className="music-list">
            {recentTracks.map((track, i) => (
              <MusicCard
                key={track.id}
                track={track}
                allTracks={recentTracks}
                trackIndex={i}
                viewMode="list"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
