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

export const StatCard = memo(function StatCard({
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
});

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
  viewMode = "grid",
}: {
  playlist: Playlist;
  displayTracks: Track[];
  onOpen: (id: string) => void;
  onPlay: (playlist: Playlist) => void;
  viewMode?: "grid" | "list";
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

  if (viewMode === "list") {
    return (
      <div
        onClick={() => onOpen(playlist.id)}
        className={`group flex items-center gap-4 px-4 py-2.5 rounded-xl cursor-pointer transition-colors w-full border ${
          isThisActive
            ? "bg-surface-raised border-accent shadow-sm"
            : "bg-surface-raised/40 hover:bg-surface-raised border-border-subtle hover:border-accent/30 shadow-none"
        }`}
      >
        <div className="w-10 h-10 rounded-lg bg-surface-overlay flex items-center justify-center relative overflow-hidden flex-shrink-0">
          {coverUrl && !imgError ? (
            <img
              src={coverUrl}
              alt={playlist.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              draggable={false}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted bg-surface-raised/50">
              <ListMusic size={20} className="text-accent/60 group-hover:text-accent transition-colors" />
            </div>
          )}

          {/* Hover / Active Play Button Overlay on Thumbnail */}
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 flex items-center justify-center ${
              isThisPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(playlist);
              }}
              className="w-7 h-7 rounded-full bg-accent text-black flex items-center justify-center shadow-accent scale-95 group-hover:scale-100 active:scale-90 transition-transform duration-150 hover:brightness-110"
              title={isThisPlaying ? `Pause ${playlist.name}` : `Play ${playlist.name}`}
            >
              {isThisPlaying ? (
                <Pause size={12} fill="currentColor" />
              ) : (
                <Play size={12} fill="currentColor" className="ml-0.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold truncate transition-colors ${
                isThisActive ? "text-accent" : "text-text-primary group-hover:text-accent"
              }`}
              title={playlist.name}
            >
              {playlist.name}
            </span>
            {!playlist.filePath && (
              <span className="text-[9px] font-semibold tracking-wider uppercase bg-accent/15 border border-accent/30 text-accent px-1.5 py-0.5 rounded flex-shrink-0">
                Virtual
              </span>
            )}
          </div>
          <span className="text-xs text-text-secondary truncate mt-0.5">
            {playlist.trackIds?.length || 0} tracks
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isThisPlaying && (
            <div className="flex gap-1 items-end h-4 pb-0.5 mr-1">
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(playlist);
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              isThisActive
                ? "text-accent hover:bg-accent/10"
                : "text-text-muted hover:text-accent hover:bg-surface-overlay opacity-0 group-hover:opacity-100"
            }`}
            title={isThisPlaying ? `Pause ${playlist.name}` : `Play ${playlist.name}`}
          >
            {isThisPlaying ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(playlist.id);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-overlay transition-colors"
            title={`Open ${playlist.name}`}
          >
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

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
    favorites,
    isFavorite,
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
      favorites: s.favorites,
      isFavorite: s.isFavorite,
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

  const calcColumns = useCallback((width: number) => {
    const GRID_GAP = 16;
    const MIN_CARD_WIDTH = 180;
    const availableWidth = Math.max(300, width - 64);
    return Math.max(1, Math.floor((availableWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)));
  }, []);

  // Store targetCount directly so React ONLY re-renders when column count actually changes (not on every pixel)
  const [targetCount, setTargetCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const w = Math.max(300, window.innerWidth - 240);
      return Math.max(1, Math.floor((w - 64 + 16) / (180 + 16)));
    }
    return 6;
  });

  // RAF-throttled ResizeObserver: prevents jank and prevents re-rendering when column count remains the same
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const updateColumns = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        if (width > 0) {
          const nextCols = calcColumns(width);
          setTargetCount((prev) => (prev !== nextCols ? nextCols : prev));
        }
      });
    };

    updateColumns();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          updateColumns();
        }
      }
    });

    ro.observe(el);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [calcColumns, guiScale]);

  const tracksLimit = homeViewMode === "grid" ? targetCount : Math.max(8, targetCount);

  // ── "Recommended for you" Daily 4 AM Algorithm ──
  // Pre-sort tracks: heavy scoring runs ONLY when library, favorites, or listen stats change (NEVER during resize!)
  const sortedRecommendedTracks = useMemo(() => {
    if (!displayTracks.length) return [];

    const now = Date.now();
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const shiftedDate = new Date(now - FOUR_HOURS_MS);
    const dayKey = `${shiftedDate.getFullYear()}-${shiftedDate.getMonth() + 1}-${shiftedDate.getDate()}`;

    // Compute favorite counts per artist & genre to boost related recommendations
    const favoriteArtistsCount: Record<string, number> = {};
    const favoriteGenresCount: Record<string, number> = {};
    displayTracks.forEach((t) => {
      if (isFavorite(t)) {
        const normA = (t.artist || "").toLowerCase().trim();
        if (normA) favoriteArtistsCount[normA] = (favoriteArtistsCount[normA] || 0) + 1;
        const normG = (t.genre || "").toLowerCase().trim();
        if (normG) favoriteGenresCount[normG] = (favoriteGenresCount[normG] || 0) + 1;
      }
    });

    const scored = displayTracks.map((track) => {
      const listenDurationSec = (trackListenDurations && trackListenDurations[track.id]) || 0;
      const durationWeight = 1.0 + Math.sqrt(listenDurationSec / 30.0);

      const addedMs = (track.dateAdded && track.dateAdded < 10_000_000_000 ? track.dateAdded * 1000 : track.dateAdded) || now;
      const ageDays = Math.max(0, (now - addedMs) / (1000 * 60 * 60 * 24));
      const recencyBonus = Math.max(0, 1.0 - (ageDays / 45.0));
      const dateWeight = 1.0 + (recencyBonus * 0.75);

      // ── Favorites Impact ──
      // 1. Direct song favorite boost: 4x multiplier
      const isFav = isFavorite(track);
      const directFavBonus = isFav ? 4.0 : 1.0;

      // 2. Artist affinity boost: +50% per favorited song by this artist (up to 3x)
      const normA = (track.artist || "").toLowerCase().trim();
      const artistFavCount = favoriteArtistsCount[normA] || 0;
      const artistFavBonus = 1.0 + Math.min(2.0, artistFavCount * 0.5);

      // 3. Genre affinity boost: +25% per favorited song in this genre (up to 2x)
      const normG = (track.genre || "").toLowerCase().trim();
      const genreFavCount = favoriteGenresCount[normG] || 0;
      const genreFavBonus = 1.0 + Math.min(1.0, genreFavCount * 0.25);

      const totalWeight = Math.max(
        0.1,
        durationWeight * dateWeight * directFavBonus * artistFavBonus * genreFavBonus
      );

      const rawDailyRand = getDailyRandom(`${dayKey}:${track.id}`);
      const rand = Math.max(0.0001, Math.min(0.9999, rawDailyRand));
      const key = Math.pow(rand, 1.0 / totalWeight);

      return { track, key };
    });

    return scored
      .sort((a, b) => b.key - a.key)
      .map((item) => item.track);
  }, [displayTracks, trackListenDurations, favorites, isFavorite]);

  // Fast O(1) slice for display
  const libraryTracks = useMemo(() => {
    return sortedRecommendedTracks.slice(0, tracksLimit);
  }, [sortedRecommendedTracks, tracksLimit]);

  // ── "Recent discoveries" (Recently Added) ──
  // Pre-sort once when displayTracks changes (NEVER during resize!)
  const sortedRecentDiscoveries = useMemo(() => {
    return [...displayTracks].sort((a, b) => {
      const timeA = (a.dateAdded && a.dateAdded < 10_000_000_000 ? a.dateAdded * 1000 : a.dateAdded) || 0;
      const timeB = (b.dateAdded && b.dateAdded < 10_000_000_000 ? b.dateAdded * 1000 : b.dateAdded) || 0;
      return timeB - timeA;
    });
  }, [displayTracks]);

  // Fast O(1) slice for display
  const recentDiscoveries = useMemo(() => {
    return sortedRecentDiscoveries.slice(0, tracksLimit);
  }, [sortedRecentDiscoveries, tracksLimit]);

  // Playlists to show:
  // In grid mode: targetCount - 1 slots for playlists + 1 slot for "New Playlist" card
  // In list mode: up to Math.max(6, targetCount) playlists
  const visiblePlaylists = useMemo(() => {
    if (homeViewMode === "list") {
      return playlists.slice(0, Math.max(6, targetCount));
    }
    return playlists.slice(0, Math.max(1, targetCount - 1));
  }, [playlists, targetCount, homeViewMode]);

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

          {homeViewMode === "grid" ? (
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
                  viewMode="grid"
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
          ) : (
            <div className="music-list gap-2">
              {visiblePlaylists.map((playlist) => (
                <HomePlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  displayTracks={displayTracks}
                  onOpen={handleOpenPlaylist}
                  onPlay={handlePlayPlaylist}
                  viewMode="list"
                />
              ))}

              {/* New Playlist Row in List Mode */}
              <div
                onClick={() => setShowCreatePlaylist(true)}
                className="group flex items-center gap-4 px-4 py-2.5 rounded-xl cursor-pointer border border-dashed border-border-subtle hover:border-accent/60 bg-surface-raised/20 hover:bg-surface-raised/40 transition-colors w-full"
                title="Create a new playlist"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-overlay/50 group-hover:bg-accent/10 flex items-center justify-center flex-shrink-0 text-text-muted group-hover:text-accent transition-colors">
                  <Plus size={18} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-text-muted group-hover:text-text-primary transition-colors">
                    New Playlist
                  </span>
                  <span className="text-xs text-text-muted/60 mt-0.5">
                    Create a personal collection
                  </span>
                </div>
                <div className="text-xs text-accent font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Create <ArrowRight size={13} />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
