import React, { useMemo, useRef, useCallback, useState, useEffect, memo } from "react";
import {
  Play,
  Pause,
  Shuffle,
  Music2,
  Disc3,
  Clock,
  FolderOpen,
  ListMusic,
  Plus,
  ArrowRight,
  LayoutGrid,
  List,
  Globe,
} from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import { useDisplayData } from "../../hooks/useDisplayData";
import { useLibrary } from "../../hooks/useLibrary";
import { formatPreciseDuration, shuffleArray } from "../../utils/helpers";
import { getCoverArt } from "../../utils/tauriApi";
import { MusicCard } from "./MusicCard";
import type { Track, Playlist } from "../../types";

export function StatCard({
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

// Deterministic fast hash for 24-hour daily randomness
function getDailyRandom(seedStr: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 1000000) / 1000000;
}

// Rock-solid, GPU-isolated playlist card: no bounding box translation, no subpixel jitter
const HomePlaylistCard = memo(function HomePlaylistCard({
  playlist,
  displayTracks,
  onOpen,
  onPlay,
}: {
  playlist: Playlist;
  displayTracks: Track[];
  onOpen: (id: string) => void;
  onPlay: (playlist: Playlist) => void;
}) {
  const [coverUrl, setCoverUrl] = useState<string | null>(playlist.coverArt || null);
  const [imgError, setImgError] = useState(false);
  const lowEndMode = useStore((s) => s.lowEndMode);
  const isPlaying = useStore((s) => s.isPlaying);
  const queueSourceId = useStore((s) => s.queueSourceId);

  const isThisActive = queueSourceId === playlist.id;
  const isThisPlaying = isThisActive && isPlaying;

  const firstTrack = useMemo(() => {
    if (playlist.tracks && playlist.tracks.length > 0) return playlist.tracks[0];
    const firstId = playlist.trackIds?.[0];
    if (firstId) return displayTracks.find((t) => t.id === firstId);
    return null;
  }, [playlist, displayTracks]);

  useEffect(() => {
    setImgError(false);
    if (playlist.coverArt) {
      setCoverUrl(playlist.coverArt);
      return;
    }
    if (firstTrack) {
      if (firstTrack.coverArt && (firstTrack.coverArt.startsWith("http") || firstTrack.coverArt.startsWith("data:"))) {
        setCoverUrl(firstTrack.coverArt);
        return;
      }
      let cancelled = false;
      getCoverArt(firstTrack.filePath, 300, lowEndMode).then((url) => {
        if (!cancelled && url) {
          setCoverUrl(url);
          setImgError(false);
        }
      });
      return () => { cancelled = true; };
    } else {
      setCoverUrl(null);
    }
  }, [playlist.coverArt, firstTrack, lowEndMode]);

  return (
    <div
      onClick={() => onOpen(playlist.id)}
      className={`group relative rounded-2xl p-3 flex flex-col gap-3 cursor-pointer select-none border transition-colors duration-200 transform-gpu ${isThisActive
        ? "bg-surface-raised border-accent shadow-md shadow-accent/5"
        : "bg-surface-raised/40 hover:bg-surface-raised border-border-subtle hover:border-accent/40 shadow-sm hover:shadow-md"
        }`}
      style={{
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="w-full aspect-square rounded-xl bg-surface-overlay flex items-center justify-center relative overflow-hidden flex-shrink-0">
        {coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={playlist.name}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            draggable={false}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-text-muted bg-surface-raised/50 gap-1 group-hover:bg-accent/10 transition-colors">
            <ListMusic size={32} className="text-accent/60 group-hover:text-accent transition-colors" />
          </div>
        )}

        {/* Hover / Active Play Button Overlay */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 flex items-center justify-center ${isThisPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(playlist);
            }}
            className="w-11 h-11 rounded-full bg-accent text-black flex items-center justify-center shadow-accent scale-95 group-hover:scale-100 active:scale-90 transition-transform duration-150 hover:brightness-110"
            style={{ boxShadow: "0 0 24px var(--accent-glow)" }}
            title={isThisPlaying ? `Pause ${playlist.name}` : `Play ${playlist.name}`}
          >
            {isThisPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>
      </div>

      <div className="min-w-0 flex flex-col justify-between flex-1">
        <h3
          className={`font-bold text-xs truncate transition-colors ${isThisActive ? "text-accent" : "text-text-primary group-hover:text-accent"
            }`}
          title={playlist.name}
        >
          {playlist.name}
        </h3>
        <p className="text-[11px] text-text-muted truncate mt-0.5">
          {playlist.trackIds?.length || 0} tracks
        </p>
      </div>
    </div>
  );
});

export function HomeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  const {
    isScanning,
    playlists,
    guiScale,
    trackListenDurations,
    homeViewMode,
    setHomeViewMode,
    setQueue,
    setIsPlaying,
    isPlaying,
    queueSourceId,
    setActiveView,
    setActivePlaylist,
    setShowCreatePlaylist,
  } = useStore(
    useShallow((s) => ({
      isScanning: s.isScanning,
      playlists: s.playlists,
      guiScale: s.guiScale,
      trackListenDurations: s.trackListenDurations,
      homeViewMode: s.homeViewMode,
      setHomeViewMode: s.setHomeViewMode,
      setQueue: s.setQueue,
      setIsPlaying: s.setIsPlaying,
      isPlaying: s.isPlaying,
      queueSourceId: s.queueSourceId,
      setActiveView: s.setActiveView,
      setActivePlaylist: s.setActivePlaylist,
      setShowCreatePlaylist: s.setShowCreatePlaylist,
    }))
  );

  const { importSongs } = useLibrary();
  const { displayTracks, demoTrackCount, demoPlaytime } = useDisplayData();

  // Stats calculation
  const uniqueArtists = useMemo(
    () => new Set(displayTracks.map((t) => t.artist)).size,
    [displayTracks]
  );

  const uniqueAlbums = useMemo(
    () => new Set(displayTracks.map((t) => t.album)).size,
    [displayTracks]
  );

  const handlePlayAll = useCallback(() => {
    if (!displayTracks.length) return;
    setQueue(displayTracks, 0);
    setIsPlaying(true);
  }, [displayTracks, setQueue, setIsPlaying]);

  const handleShuffleAll = useCallback(() => {
    if (!displayTracks.length) return;
    setQueue(shuffleArray(displayTracks), 0);
    setIsPlaying(true);
  }, [displayTracks, setQueue, setIsPlaying]);

  const handleOpenPlaylist = useCallback((playlistId: string) => {
    setActivePlaylist(playlistId);
    setActiveView("playlist");
  }, [setActivePlaylist, setActiveView]);

  const handlePlayPlaylist = useCallback((playlist: Playlist) => {
    if (queueSourceId === playlist.id) {
      setIsPlaying(!isPlaying);
      return;
    }
    const pTracks = playlist.tracks || displayTracks.filter((t) => playlist.trackIds.includes(t.id));
    if (pTracks.length) {
      setQueue(pTracks, 0, playlist.id);
      setIsPlaying(true);
    } else {
      setActivePlaylist(playlist.id);
      setActiveView("playlist");
    }
  }, [queueSourceId, isPlaying, displayTracks, setQueue, setIsPlaying, setActivePlaylist, setActiveView]);

  // Target card count based on interface scale:
  // 6 cards for 1.65x and above, 8 cards for 0.9x and below, 7 cards for default
  const targetCount = useMemo(() => {
    if (guiScale >= 1.65) return 6;
    if (guiScale <= 0.9) return 8;
    return 7;
  }, [guiScale]);

  // ── "Recommended for you" Daily 4 AM Algorithm ──
  // Changes every day at 4:00 AM local time.
  const libraryTracks = useMemo(() => {
    if (!displayTracks.length) return [];

    const now = Date.now();
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const shiftedDate = new Date(now - FOUR_HOURS_MS);
    const dayKey = `${shiftedDate.getFullYear()}-${shiftedDate.getMonth() + 1}-${shiftedDate.getDate()}`;

    const scored = displayTracks.map((track) => {
      const listenDurationSec = (trackListenDurations && trackListenDurations[track.id]) || 0;
      const durationWeight = 1.0 + Math.sqrt(listenDurationSec / 30.0);

      const addedMs = (track.dateAdded && track.dateAdded < 10_000_000_000 ? track.dateAdded * 1000 : track.dateAdded) || now;
      const ageDays = Math.max(0, (now - addedMs) / (1000 * 60 * 60 * 24));
      const recencyBonus = Math.max(0, 1.0 - (ageDays / 45.0));
      const dateWeight = 1.0 + (recencyBonus * 0.75);

      const totalWeight = Math.max(0.1, durationWeight * dateWeight);

      const rawDailyRand = getDailyRandom(`${dayKey}:${track.id}`);
      const rand = Math.max(0.0001, Math.min(0.9999, rawDailyRand));
      const key = Math.pow(rand, 1.0 / totalWeight);

      return { track, key };
    });

    return scored
      .sort((a, b) => b.key - a.key)
      .slice(0, targetCount)
      .map((item) => item.track);
  }, [displayTracks, trackListenDurations, targetCount]);

  // ── "Recent discoveries" (Recently Added) ──
  const recentDiscoveries = useMemo(() => {
    return [...displayTracks]
      .sort((a, b) => {
        const timeA = (a.dateAdded && a.dateAdded < 10_000_000_000 ? a.dateAdded * 1000 : a.dateAdded) || 0;
        const timeB = (b.dateAdded && b.dateAdded < 10_000_000_000 ? b.dateAdded * 1000 : b.dateAdded) || 0;
        return timeB - timeA;
      })
      .slice(0, targetCount);
  }, [displayTracks, targetCount]);

  // Playlists to show: targetCount - 1 slots for playlists + 1 slot for "New Playlist" card
  const visiblePlaylists = useMemo(() => {
    return playlists.slice(0, Math.max(1, targetCount - 1));
  }, [playlists, targetCount]);

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
      <div className="empty-state h-full flex flex-col items-center justify-center p-8 text-center">
        <div
          className="w-20 h-20 rounded-3xl bg-accent-muted flex items-center justify-center mb-6"
          style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          <Music2 size={36} className="text-accent" />
        </div>
        <div className="max-w-md">
          <p className="text-text-primary font-display font-semibold text-xl">
            No music found
          </p>
          <p className="text-text-muted text-sm mt-2 leading-relaxed">
            Your library is empty. Import audio files from your computer or explore Harbour to download and stream music.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <button
            onClick={importSongs}
            className="btn-accent h-10 px-5 flex items-center gap-2 text-sm font-semibold rounded-xl shadow-accent hover:scale-[1.02] active:scale-[0.98] transition-all"
            title="Import audio files from your computer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Import Songs</span>
          </button>
          <button
            onClick={() => setActiveView("harbour")}
            className="h-10 px-5 flex items-center gap-2 text-sm font-semibold rounded-xl bg-surface-raised hover:bg-surface-overlay border border-border-subtle hover:border-accent/40 text-text-primary hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
            title="Go to Harbour to find and download music"
          >
            <Globe size={16} className="text-accent" />
            <span>Download Songs</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-y-auto page select-none">
      <div className="flex flex-col gap-10 p-8 pb-12 w-full">

        {/* ── TOP HEADER (Welcome Back + Global Play/Shuffle + View Toggle) ── */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight text-text-primary">
                Welcome back!
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayAll}
                className="btn-accent h-9 px-4 text-xs font-bold"
                title="Play all tracks in library"
              >
                <Play size={14} fill="currentColor" />
                Play All
              </button>
              <button
                onClick={handleShuffleAll}
                className="btn-accent bg-accent-muted text-accent border-accent/20 h-9 px-4 text-xs font-bold"
                title="Shuffle all tracks in library"
              >
                <Shuffle size={14} />
                Shuffle
              </button>
              <button
                onClick={() => setHomeViewMode("grid")}
                className={`btn-icon h-7 w-7 ${homeViewMode === "grid" ? "bg-surface-overlay text-accent shadow-sm" : ""}`}
                title="Grid view"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setHomeViewMode("list")}
                className={`btn-icon h-7 w-7 ${homeViewMode === "list" ? "bg-surface-overlay text-accent shadow-sm" : ""}`}
                title="List view"
              >
                <List size={13} />
              </button>
            </div>
          </div>

          {/* ── STATS ROW (Total Tracks, Unique Artists, Total Albums, Playback Time) ── */}
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

        {/* ── SECTION 1: RECOMMENDED FOR YOU (DAILY 4 AM ARRANGEMENT) ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                Curated Daily For you
              </p>
              <h2 className="font-display font-black text-2xl md:text-3xl text-text-primary tracking-tight mt-0.5">
                Recommended for you
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveView("library")}
                className="group flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-bright transition-colors"
              >
                Explore Library
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Actual Tracks Rendered in Grid or List Mode */}
          {libraryTracks.length > 0 ? (
            homeViewMode === "grid" ? (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${targetCount}, minmax(0, 1fr))`
                }}
              >
                {libraryTracks.map((track, i) => (
                  <MusicCard
                    key={track.id}
                    track={track}
                    allTracks={libraryTracks}
                    trackIndex={i}
                    viewMode="grid"
                  />
                ))}
              </div>
            ) : (
              <div className="music-list">
                {libraryTracks.map((track, i) => (
                  <MusicCard
                    key={track.id}
                    track={track}
                    allTracks={libraryTracks}
                    trackIndex={i}
                    viewMode="list"
                  />
                ))}
              </div>
            )
          ) : (
            <div className="p-8 rounded-2xl bg-surface-raised/20 border border-border-subtle text-center text-text-muted text-xs">
              No tracks found in your library. Add some music files to listen to them here!
            </div>
          )}
        </section>

        {/* ── SECTION 2: RECENT DISCOVERIES (RECENTLY ADDED TRACKS) ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                Recently Added
              </p>
              <h2 className="font-display font-black text-2xl md:text-3xl text-text-primary tracking-tight mt-0.5">
                Recent discoveries
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveView("library")}
                className="group flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-bright transition-colors"
              >
                View All
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {recentDiscoveries.length > 0 ? (
            homeViewMode === "grid" ? (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${targetCount}, minmax(0, 1fr))`
                }}
              >
                {recentDiscoveries.map((track, i) => (
                  <MusicCard
                    key={track.id}
                    track={track}
                    allTracks={recentDiscoveries}
                    trackIndex={i}
                    viewMode="grid"
                  />
                ))}
              </div>
            ) : (
              <div className="music-list">
                {recentDiscoveries.map((track, i) => (
                  <MusicCard
                    key={track.id}
                    track={track}
                    allTracks={recentDiscoveries}
                    trackIndex={i}
                    viewMode="list"
                  />
                ))}
              </div>
            )
          ) : (
            <div className="p-8 rounded-2xl bg-surface-raised/20 border border-border-subtle text-center text-text-muted text-xs">
              No recent discoveries found.
            </div>
          )}
        </section>

        {/* ── SECTION 3: YOUR PLAYLISTS ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                Your personal collection
              </p>
              <h2 className="font-display font-black text-2xl md:text-3xl text-text-primary tracking-tight mt-0.5">
                Your playlists
              </h2>
            </div>
            <button
              onClick={() => setActiveView("playlist")}
              className="group flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-bright transition-colors"
            >
              All Playlists
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${targetCount}, minmax(0, 1fr))` }}
          >
            {visiblePlaylists.map((playlist) => (
              <HomePlaylistCard
                key={playlist.id}
                playlist={playlist}
                displayTracks={displayTracks}
                onOpen={handleOpenPlaylist}
                onPlay={handlePlayPlaylist}
              />
            ))}

            {/* Create Playlist Quick Card (completes the row with identical proportions) */}
            <div
              onClick={() => setShowCreatePlaylist(true)}
              className="group relative bg-surface-raised/20 hover:bg-surface-raised/40 border-2 border-dashed border-border-subtle hover:border-accent/60 rounded-2xl p-3 flex flex-col gap-3 transition-colors duration-200 cursor-pointer shadow-sm select-none transform-gpu"
              style={{
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
              }}
              title="Create a new playlist"
            >
              <div className="w-full aspect-square rounded-xl bg-surface-overlay/50 group-hover:bg-accent/10 flex items-center justify-center relative overflow-hidden flex-shrink-0 transition-colors">
                <div className="w-11 h-11 rounded-full bg-surface-raised group-hover:bg-accent text-text-muted group-hover:text-black flex items-center justify-center transition-all duration-200 shadow-sm group-hover:scale-110">
                  <Plus size={20} strokeWidth={2.5} />
                </div>
              </div>
              <div className="min-w-0 flex flex-col justify-between flex-1">
                <h3 className="font-bold text-xs text-text-muted group-hover:text-text-primary truncate transition-colors text-center">
                  New Playlist
                </h3>
                <p className="text-[11px] text-text-muted/60 truncate text-center mt-0.5">
                  Create a collection
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
