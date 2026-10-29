import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  Download,
  Music,
  ArrowRight,
  Loader2,
  Play,
  Pause,
  RefreshCw,
  Check,
  X,
  Headphones,
  Compass,
  ChevronDown,
  Trash2,
  RotateCcw,
  Clock,
  Heart,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import { useDisplayData } from "../../hooks/useDisplayData";
import { useLibrary } from "../../hooks/useLibrary";
import { formatDuration } from "../../utils/helpers";
import { deleteTrack } from "../../utils/tauriApi";
import {
  getSimilarArtists,
  filterAndDiversifyRecommendations,
} from "../../utils/musicTasteGraph";
import type { Track } from "../../types";

export interface HarbourSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_art: string;
  url: string;
  preview_url?: string;
  year?: number;
  genre?: string;
}

export interface DownloadHistoryItem {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  coverArt?: string;
  url?: string;
  provider?: string;
  genre?: string;
  year?: number;
  duration?: number;
  timestamp: number;
  filePath?: string;
  status: "downloading" | "done" | "deleted" | "error";
  progress?: number;
}

const DOWNLOAD_HISTORY_STORAGE_KEY = "mewsic_harbour_downloads_7d";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function loadDownloadHistory(): DownloadHistoryItem[] {
  try {
    const raw = localStorage.getItem(DOWNLOAD_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: DownloadHistoryItem[] = JSON.parse(raw);
    const now = Date.now();
    return parsed.filter((item) => now - item.timestamp <= SEVEN_DAYS_MS);
  } catch {
    return [];
  }
}

function saveDownloadHistory(items: DownloadHistoryItem[]) {
  try {
    const now = Date.now();
    const filtered = items.filter((item) => now - item.timestamp <= SEVEN_DAYS_MS);
    localStorage.setItem(DOWNLOAD_HISTORY_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to save download history:", e);
  }
}

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) {
    return "just now";
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr} ${diffHr === 1 ? "hour" : "hours"} ago`;
  }
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}

// In-memory & session cache to prevent redundant network requests and avoid layout flicker
let cachedPersonalRecs: HarbourSearchResult[] = (() => {
  try {
    const saved = sessionStorage.getItem("mewsic_harbour_recs");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { }
  return [];
})();

const FALLBACK_SEEDS = [
  "The Weeknd",
  "Daft Punk",
  "Dua Lipa",
  "Arctic Monkeys",
  "Kendrick Lamar",
  "Tame Impala",
  "Billie Eilish",
  "Post Malone",
  "Coldplay",
  "Gorillaz",
  "Clairo",
  "Vacations",
  "Dominic Fike",
  "Foster The People",
  "Joji",
  "Lorde",
  "Steve Lacy",
  "Frank Ocean",
  "Mac DeMarco",
  "Rex Orange County",
  "Cage The Elephant",
  "Glass Animals",
  "Tyler, The Creator",
  "SZA",
  "Childish Gambino",
  "Phoebe Bridgers",
  "Wallows",
  "Dayglow",
  "Men I Trust",
  "The Neighbourhood",
];

export function HarbourView() {

  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  const {
    guiScale,
    musicDir,
    addNotification,
    updateNotification,
    removeNotification,
    setQueue,
    setIsPlaying,
    volume,
    trackListenDurations,
    removeTrack,
    favorites,
    isFavorite,
    toggleFavorite,
  } = useStore(
    useShallow((s) => ({
      guiScale: s.guiScale,
      musicDir: s.musicDir,
      addNotification: s.addNotification,
      updateNotification: s.updateNotification,
      removeNotification: s.removeNotification,
      setQueue: s.setQueue,
      setIsPlaying: s.setIsPlaying,
      volume: s.volume,
      trackListenDurations: s.trackListenDurations,
      removeTrack: s.removeTrack,
      favorites: s.favorites,
      isFavorite: s.isFavorite,
      toggleFavorite: s.toggleFavorite,
    }))
  );

  const { displayTracks } = useDisplayData();
  const { rescanDirectory } = useLibrary();

  // Dynamic card count based on interface scale:
  // 6 cards for 1.65x and above, 7 cards for below, 8 cards for 0.9x and below
  const targetCount = useMemo(() => {
    if (guiScale >= 1.65) return 6;
    if (guiScale <= 0.9) return 8;
    return 7;
  }, [guiScale]);

  // Tab & Search State
  const [activeTab, setActiveTab] = useState<"discover" | "downloads">("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProvider, setSearchProvider] = useState(() => {
    return localStorage.getItem("mewsic-harbour-provider") || "itunes";
  });
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<HarbourSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Recommendations State
  const [personalRecs, setPersonalRecs] = useState<HarbourSearchResult[]>(() => cachedPersonalRecs);
  const [personalRecsLoading, setPersonalRecsLoading] = useState(false);


  // Audio Preview & Download State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  // Download history (past 7 days) with persistent state
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>(loadDownloadHistory);

  // Persist download history changes to localStorage
  useEffect(() => {
    saveDownloadHistory(downloadHistory);
  }, [downloadHistory]);

  // Providers list
  const providers = [
    { id: "itunes", name: "iTunes" },
    { id: "jiosaavn", name: "JioSaavn" },
    { id: "youtube", name: "YouTube" },
    { id: "soundcloud", name: "SoundCloud" },
  ];

  // Set of titles currently in the user's local library
  const libraryTitlesSet = useMemo(() => {
    const set = new Set<string>();
    displayTracks.forEach((t) => {
      if (t.title) set.add(t.title.toLowerCase().trim());
    });
    return set;
  }, [displayTracks]);

  // Compute top artist seeds based on total listen duration + recency + FAVORITES!
  const topArtists = useMemo(() => {
    const scores: Record<string, number> = {};
    displayTracks.forEach((t) => {
      if (!t.artist || t.artist === "Unknown Artist") return;
      const durationSec = (trackListenDurations && trackListenDurations[t.id]) || 0;
      const isFav = isFavorite(t);
      // Songs the user favorited give a massive +120 priority score to that artist!
      const favBonus = isFav ? 120 : 0;
      scores[t.artist] = (scores[t.artist] || 0) + 15 + Math.sqrt(durationSec) + favBonus;
    });

    // Also include any artists from favorited tracks even if not in local library displayTracks (e.g. favorited from Harbour)
    Object.keys(favorites).forEach((key) => {
      if (key.includes(":::")) {
        const parts = key.split(":::");
        const artist = parts[1];
        if (artist && artist.trim()) {
          const normArt = artist.trim();
          scores[normArt] = (scores[normArt] || 0) + 120;
        }
      }
    });

    return Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  }, [displayTracks, trackListenDurations, favorites, isFavorite]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Sync preview audio volume with app volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // Listen for download progress events
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    listen<{ id: string; progress: number }>("download-progress", (event) => {
      const { id, progress } = event.payload;
      updateNotification(id, {
        progress,
        message: `Downloading... ${progress.toFixed(0)}%`,
        loading: true,
      });
      setDownloadHistory((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx !== -1) {
          const updated = [...prev];
          const newProgress = Math.max(updated[idx].progress || 0, progress);
          updated[idx] = {
            ...updated[idx],
            progress: newProgress,
            status: newProgress >= 100 ? "done" : "downloading",
          };
          return updated;
        }
        return prev;
      });
    }).then((un) => {
      unlistenProgress = un;
    });

    return () => {
      if (unlistenProgress) unlistenProgress();
    };
  }, [updateNotification]);

  // Smooth progressive ticker for active downloading transfers to ensure uniform increasing progress
  useEffect(() => {
    const hasDownloading = downloadHistory.some((t) => t.status === "downloading");
    if (!hasDownloading) return;

    const interval = setInterval(() => {
      setDownloadHistory((prev) =>
        prev.map((t) => {
          if (t.status !== "downloading") return t;
          const current = t.progress || 6;
          if (current < 92) {
            const step = current < 25 ? 0.8 : current < 60 ? 0.5 : 0.25;
            const nextProgress = Math.min(92, +(current + step).toFixed(1));
            updateNotification(t.id, {
              progress: nextProgress,
              message: `Downloading... ${nextProgress.toFixed(0)}%`,
              loading: true,
            });
            return { ...t, progress: nextProgress };
          }
          return t;
        })
      );
    }, 250);

    return () => clearInterval(interval);
  }, [downloadHistory, updateNotification]);

  // ── 1. Fetch Personalized Taste-Based Recommendations with Similar Artists ──
  const fetchPersonalRecommendations = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && cachedPersonalRecs.length > 0) {
        setPersonalRecs(cachedPersonalRecs);
        return;
      }

      setPersonalRecsLoading(true);
      try {
        const userArtists = topArtists.filter(
          (a) => a && a !== "Unknown Artist" && a.trim().length > 0
        );

        // Find SIMILAR artists via our music taste graph
        const similarArtistsSet = new Set<string>();
        for (const userArt of userArtists.slice(0, 10)) {
          const sims = getSimilarArtists(userArt);
          sims.forEach((s) => similarArtistsSet.add(s));
        }

        // Fallback seeds if user has few artists in library
        if (similarArtistsSet.size < 20) {
          FALLBACK_SEEDS.forEach((s) => similarArtistsSet.add(s));
        }

        const similarList = Array.from(similarArtistsSet);
        const shuffledSims = [...similarList].sort(() => 0.5 - Math.random());

        // Mix: up to 3 top artists from user + up to 16 similar artists
        const queryArtists: string[] = [];
        if (userArtists.length > 0) {
          const shuffledUser = [...userArtists].sort(() => 0.5 - Math.random());
          queryArtists.push(...shuffledUser.slice(0, 3));
        }

        for (const sim of shuffledSims) {
          if (queryArtists.length >= 18) break;
          if (!queryArtists.includes(sim)) {
            queryArtists.push(sim);
          }
        }

        // Fetch candidate songs concurrently in parallel across all query artists
        const candidateBatches = await Promise.all(
          queryArtists.map(async (artist) => {
            try {
              const results = await invoke<HarbourSearchResult[]>("harbour_search", {
                query: artist,
                provider: "itunes",
              });
              if (Array.isArray(results)) {
                return results.slice(0, 4).map((track) => ({ queryArtist: artist, track }));
              }
            } catch (e) {
              console.warn(`Failed search for artist ${artist}:`, e);
            }
            return [];
          })
        );

        const rawCandidates = candidateBatches.flat();

        // Filter out junk variants, songs by other artists matching the name,
        // songs already in user's library, and enforce 1 track per artist diversity across 3 rows!
        const existingTitles = new Set(
          displayTracks.map((t) => t.title).filter(Boolean)
        );

        const diversified = filterAndDiversifyRecommendations(
          rawCandidates,
          existingTitles,
          targetCount * 3
        );

        setPersonalRecs(diversified);
        cachedPersonalRecs = diversified;
        try {
          sessionStorage.setItem("mewsic_harbour_recs", JSON.stringify(diversified));
        } catch { }
      } catch (err) {
        console.error("Personal recommendations failed:", err);
      } finally {
        setPersonalRecsLoading(false);
      }
    },
    [topArtists, displayTracks, targetCount]
  );

  useEffect(() => {
    fetchPersonalRecommendations();
  }, [fetchPersonalRecommendations]);

  // When favorites change, clear cache and re-fetch recommendations to immediately reflect taste
  const prevFavsRef = useRef(favorites);
  useEffect(() => {
    if (prevFavsRef.current !== favorites) {
      prevFavsRef.current = favorites;
      cachedPersonalRecs = [];
      try {
        sessionStorage.removeItem("mewsic_harbour_recs");
      } catch { }
      fetchPersonalRecommendations(true);
    }
  }, [favorites, fetchPersonalRecommendations]);



  // ── 3. Handle Universal Search ──
  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const q = searchQuery.trim();
      if (!q) {
        setIsSearchActive(false);
        setSearchResults([]);
        return;
      }

      setIsSearchActive(true);
      setSearchLoading(true);
      setSearchError(null);

      try {
        const results = await invoke<HarbourSearchResult[]>("harbour_search", {
          query: q,
          provider: searchProvider,
        });

        if (Array.isArray(results)) {
          setSearchResults(results);
          if (results.length === 0) {
            setSearchError(`No results found for "${q}". Try another provider or query.`);
          }
        }
      } catch (err: any) {
        setSearchError(err?.toString() || "Search failed.");
      } finally {
        setSearchLoading(false);
      }
    },
    [searchQuery, searchProvider]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setIsSearchActive(false);
    setSearchResults([]);
    setSearchError(null);
  }, []);

  // ── 4. Audio Preview Toggle ──
  const togglePreview = useCallback(
    (track: HarbourSearchResult) => {
      if (playingTrackId === track.id) {
        audioRef.current?.pause();
        setPlayingTrackId(null);
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      if (track.preview_url) {
        const audio = new Audio(track.preview_url);
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.play().catch((err) => console.warn("Preview playback failed:", err));
        audio.onended = () => setPlayingTrackId(null);
        audio.onerror = () => setPlayingTrackId(null);
        audioRef.current = audio;
        setPlayingTrackId(track.id);
      } else {
        handlePlayInPlayer(track);
      }
    },
    [playingTrackId, volume] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── 5. Play in Mewsic Main Player (Virtual Track) ──
  const handlePlayInPlayer = useCallback(
    (track: HarbourSearchResult) => {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingTrackId(null);
      }

      const virtualTrack: Track = {
        id: `harbour-${track.id}`,
        title: track.title,
        artist: track.artist,
        album: track.album || "Harbour Online",
        albumArtist: track.artist,
        genre: track.genre || "Online Discovery",
        year: track.year,
        duration: track.duration,
        filePath: track.preview_url || track.url,
        fileName: `${track.title}.m4a`,
        fileSize: 0,
        format: "m4a",
        dateAdded: Date.now(),
        isVirtual: true,
        coverArt: track.cover_art,
      };

      setQueue([virtualTrack], 0);
      setIsPlaying(true);
    },
    [setQueue, setIsPlaying]
  );

  // Check if track is currently in the user's library
  const isTrackSavedOnDisk = useCallback(
    (item: DownloadHistoryItem) => {
      if (item.status === "deleted") return false;
      if (item.filePath) {
        const found = displayTracks.some((t) => t.filePath === item.filePath);
        if (found) return true;
      }
      return displayTracks.some(
        (t) =>
          t.title.toLowerCase().trim() === item.title.toLowerCase().trim() &&
          t.artist.toLowerCase().trim() === item.artist.toLowerCase().trim()
      );
    },
    [displayTracks]
  );

  // Delete downloaded track from disk and library, keeping record in history with restore option
  const handleDeleteDownloadedTrack = useCallback(
    async (item: DownloadHistoryItem) => {
      try {
        const matching = displayTracks.find(
          (t) =>
            (item.filePath && t.filePath === item.filePath) ||
            (t.title.toLowerCase().trim() === item.title.toLowerCase().trim() &&
              t.artist.toLowerCase().trim() === item.artist.toLowerCase().trim())
        );

        const pathToDelete = matching?.filePath || item.filePath;
        if (pathToDelete) {
          await deleteTrack(pathToDelete);
        }
        if (matching?.id) {
          removeTrack(matching.id);
        }

        // Remove from downloadedIds so restore can re-download it
        setDownloadedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.trackId);
          return next;
        });

        setDownloadHistory((prev) =>
          prev.map((h) =>
            h.id === item.id ||
            (h.title.toLowerCase() === item.title.toLowerCase() &&
              h.artist.toLowerCase() === item.artist.toLowerCase())
              ? { ...h, status: "deleted" as const }
              : h
          )
        );

        rescanDirectory();
        addNotification(`Deleted "${item.title}" from library`, "info");
      } catch (err: any) {
        console.error("Failed to delete track:", err);
        addNotification(`Failed to delete: ${err?.message || err}`, "error");
      }
    },
    [displayTracks, removeTrack, rescanDirectory, addNotification]
  );

  // Play a history item in player (either local file or virtual online track)
  const handlePlayHistoryItem = useCallback(
    (item: DownloadHistoryItem) => {
      const matching = displayTracks.find(
        (t) =>
          (item.filePath && t.filePath === item.filePath) ||
          (t.title.toLowerCase().trim() === item.title.toLowerCase().trim() &&
            t.artist.toLowerCase().trim() === item.artist.toLowerCase().trim())
      );
      if (matching) {
        setQueue([matching], 0);
        setIsPlaying(true);
      } else {
        const pseudoTrack: HarbourSearchResult = {
          id: item.trackId,
          title: item.title,
          artist: item.artist,
          album: item.album || "",
          duration: item.duration || 0,
          cover_art: item.coverArt || "",
          url: item.url || "",
          genre: item.genre,
          year: item.year,
        };
        handlePlayInPlayer(pseudoTrack);
      }
    },
    [displayTracks, setQueue, setIsPlaying, handlePlayInPlayer]
  );

  // Remove single item from download history list
  const handleRemoveFromHistory = useCallback((id: string) => {
    setDownloadHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // Clear all non-downloading items from history
  const handleClearHistory = useCallback(() => {
    setDownloadHistory((prev) => prev.filter((h) => h.status === "downloading"));
  }, []);

  // ── 7. Direct One-Click Download Track ──
  const handleDownloadTrack = useCallback(
    async (track: HarbourSearchResult, providerOverride?: string) => {
      if (downloadingIds.has(track.id)) return;

      // Allow restore / re-download: clear from downloadedIds so it can be re-fetched
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });

      setDownloadingIds((prev) => new Set(prev).add(track.id));
      const notifId = addNotification("Downloading...", "info", 0, true, track.title);
      updateNotification(notifId, { progress: 6, loading: true });

      const historyEntry: DownloadHistoryItem = {
        id: notifId,
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album || "",
        coverArt: track.cover_art || "",
        url: track.url || "",
        provider: providerOverride || searchProvider || "itunes",
        genre: track.genre,
        year: track.year,
        duration: track.duration,
        timestamp: Date.now(),
        status: "downloading",
        progress: 6,
      };

      setDownloadHistory((prev) => [
        historyEntry,
        ...prev.filter((h) => h.trackId !== track.id && h.id !== notifId),
      ]);

      let unlisten: (() => void) | undefined;
      try {
        unlisten = await listen<{ id: string; progress: number }>("download-progress", (event) => {
          if (event.payload.id === notifId) {
            updateNotification(notifId, {
              progress: event.payload.progress,
              message: `Downloading... ${event.payload.progress.toFixed(0)}%`,
              loading: true,
            });
          }
        });

        const savedFilePath = await invoke<string>("download_track", {
          musicDir,
          title: track.title,
          artist: track.artist,
          album: track.album || "",
          coverArt: track.cover_art || "",
          downloadId: notifId,
          provider: providerOverride || searchProvider || "itunes",
          url: track.url || "",
          trackId: track.id,
          genre: track.genre,
          year: track.year,
        });

        setDownloadHistory((prev) =>
          prev.map((t) =>
            t.id === notifId
              ? { ...t, progress: 100, status: "done", filePath: savedFilePath }
              : t
          )
        );

        updateNotification(notifId, {
          message: `Saved "${track.title}" to library!`,
          type: "success",
          loading: false,
          progress: undefined,
        });
        setTimeout(() => removeNotification(notifId), 3500);

        setDownloadedIds((prev) => new Set(prev).add(track.id));
        rescanDirectory();
      } catch (err: any) {
        console.error("Download failed:", err);
        setDownloadHistory((prev) =>
          prev.map((t) => (t.id === notifId ? { ...t, status: "error" } : t))
        );
        updateNotification(notifId, {
          message: "Download failed: " + (err?.toString() || "Unknown error"),
          type: "error",
          loading: false,
          progress: undefined,
        });
        setTimeout(() => removeNotification(notifId), 5000);
      } finally {
        if (unlisten) unlisten();
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(track.id);
          return next;
        });
      }
    },
    [
      downloadingIds,
      musicDir,
      addNotification,
      updateNotification,
      removeNotification,
      searchProvider,
      rescanDirectory,
    ]
  );

  // Re-download / restore track that was previously deleted
  const handleRestoreTrack = useCallback(
    (item: DownloadHistoryItem) => {
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.trackId);
        return next;
      });

      const pseudoTrack: HarbourSearchResult = {
        id: item.trackId,
        title: item.title,
        artist: item.artist,
        album: item.album || "",
        duration: item.duration || 0,
        cover_art: item.coverArt || "",
        url: item.url || "",
        genre: item.genre,
        year: item.year,
      };
      handleDownloadTrack(pseudoTrack, item.provider);
    },
    [handleDownloadTrack]
  );



  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-y-auto page select-none">
      <div className="flex flex-col gap-8 p-8 pb-16 w-full">

        {/* ── HERO & SEARCH SECTION ── */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight text-text-primary">
              Harbour
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Explore song recommendations tailored to your taste, browse topic collections, or search global music networks.
            </p>
          </div>

          {/* Unified Universal Search Bar */}
          <form onSubmit={handleSearch} className="relative w-full flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any artist, song, album, or genre..."
                className="w-full h-12 pl-12 pr-10 rounded-2xl bg-surface-raised border border-border-subtle focus:border-accent focus:outline-none text-text-primary placeholder:text-text-muted text-sm shadow-inner transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary rounded-lg transition-colors"
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Custom Provider Switcher Dropdown */}
            <ProviderDropdown
              providers={providers}
              selectedProvider={searchProvider}
              onSelect={(id) => {
                setSearchProvider(id);
                localStorage.setItem("mewsic-harbour-provider", id);
              }}
            />

            <button
              type="submit"
              disabled={searchLoading}
              className="btn-accent h-12 px-5 text-xs font-bold flex items-center gap-1.5 shadow-sm rounded-2xl shrink-0"
            >
              {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {/* ── TWO MAIN TABS: DISCOVERY & DOWNLOADS ── */}
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("discover");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "discover"
                ? "bg-accent text-black shadow-sm"
                : "bg-surface-raised/50 hover:bg-surface-raised text-text-muted hover:text-text-primary border border-border-subtle"
                }`}
            >
              <Compass size={14} />
              <span>Discovery</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("downloads");
                setIsSearchActive(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${activeTab === "downloads"
                ? "bg-accent text-black shadow-sm"
                : "bg-surface-raised/50 hover:bg-surface-raised text-text-muted hover:text-text-primary border border-border-subtle"
                }`}
            >
              <Download size={14} />
              <span>Downloads</span>
              {downloadHistory.filter((t) => t.status === "downloading").length > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* ── SEARCH RESULTS (WHEN USER SEARCHES IN DISCOVER) ── */}
        {activeTab === "discover" && isSearchActive && (
          <section className="flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                  Search Results
                </p>
                <h2 className="font-display font-black text-2xl tracking-tight text-text-primary mt-0.5">
                  Results for &ldquo;{searchQuery}&rdquo;
                </h2>
              </div>
              <button
                onClick={clearSearch}
                className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-bright transition-colors"
              >
                Back to Discover
                <ArrowRight size={14} />
              </button>
            </div>

            {searchLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
                <Loader2 size={36} className="animate-spin text-accent" />
                <p className="text-xs font-medium">Searching {searchProvider}...</p>
              </div>
            ) : searchError ? (
              <div className="p-8 rounded-2xl bg-surface-raised/30 border border-border-subtle text-center text-text-muted text-xs">
                {searchError}
              </div>
            ) : searchResults.length > 0 ? (
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${targetCount}, minmax(0, 1fr))` }}
              >
                {searchResults.map((track) => (
                  <HarbourTrackCard
                    key={track.id}
                    track={track}
                    onPlayPreview={togglePreview}
                    onPlayInPlayer={handlePlayInPlayer}
                    onDownload={handleDownloadTrack}
                    isPlayingPreview={playingTrackId === track.id}
                    isDownloading={downloadingIds.has(track.id)}
                    isDownloaded={
                      downloadedIds.has(track.id) ||
                      libraryTitlesSet.has(track.title.toLowerCase().trim())
                    }
                  />
                ))}
              </div>
            ) : null}
          </section>
        )}

        {/* ── DISCOVERY & TOPICS (DEFAULT VIEW) ── */}
        {activeTab === "discover" && !isSearchActive && (
          <div className="flex flex-col gap-10">
            {/* ── SECTION 1: PERSONALIZED RECOMMENDATIONS ── */}
            <section className="flex flex-col gap-4">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-display font-black text-2xl md:text-3xl text-text-primary tracking-tight mt-0.5">
                    Songs you might love
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    find some new tracks to add to your library
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchPersonalRecommendations(true)}
                    disabled={personalRecsLoading}
                    className="btn-accent h-8 px-3 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    title="Get new recommendations"
                  >
                    <RefreshCw
                      size={13}
                      className={`text-black ${personalRecsLoading ? "animate-spin" : ""}`}
                    />
                    <span className="text-black">Refresh</span>
                  </button>
                </div>
              </div>

              {personalRecsLoading && personalRecs.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-text-muted">
                  <Loader2 size={32} className="animate-spin text-accent" />
                  <p className="text-xs font-medium">Curating diverse recommendations...</p>
                </div>
              ) : personalRecs.length > 0 ? (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${targetCount}, minmax(0, 1fr))` }}
                >
                  {personalRecs.slice(0, targetCount * 3).map((track) => (
                    <HarbourTrackCard
                      key={track.id}
                      track={track}
                      onPlayPreview={togglePreview}
                      onPlayInPlayer={handlePlayInPlayer}
                      onDownload={handleDownloadTrack}
                      isPlayingPreview={playingTrackId === track.id}
                      isDownloading={downloadingIds.has(track.id)}
                      isDownloaded={
                        downloadedIds.has(track.id) ||
                        libraryTitlesSet.has(track.title.toLowerCase().trim())
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-surface-raised/20 border border-border-subtle text-center text-text-muted text-xs">
                  No recommendations found yet. Click &ldquo;Refresh&rdquo; above!
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── TAB: DOWNLOADS (PAST 7 DAYS & ACTIVE TRANSFERS) ── */}
        {activeTab === "downloads" && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display font-black text-2xl md:text-3xl text-text-primary tracking-tight">
                  Downloads &amp; Transfers
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  History of music downloaded in the past 7 days. Deleted files stay here so you can restore them anytime.
                </p>
              </div>

              {downloadHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-3 py-1.5 rounded-xl border border-border-subtle hover:border-red-500/40 text-text-muted hover:text-red-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Clear non-active downloads from history"
                >
                  <Trash2 size={13} />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {downloadHistory.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {downloadHistory.map((item) => {
                  const isDownloading = item.status === "downloading";
                  const isDeleted = item.status === "deleted" || (!isDownloading && !isTrackSavedOnDisk(item));
                  const isSaved = !isDownloading && !isDeleted;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-overlay/80 hover:bg-surface-overlay transition-all gap-4 group"
                    >
                      {/* Left Side: Thumbnail & Metadata */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-surface-raised overflow-hidden flex items-center justify-center shrink-0 relative">
                          {item.coverArt ? (
                            <img
                              src={item.coverArt}
                              alt={item.title}
                              className={`w-full h-full object-cover transition-opacity ${
                                isDeleted ? "opacity-40 grayscale" : "opacity-100"
                              }`}
                            />
                          ) : (
                            <Music size={20} className={isDeleted ? "text-text-muted/40" : "text-accent/60"} />
                          )}
                          {isDownloading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 size={18} className="animate-spin text-accent" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-xs font-bold truncate ${
                                isDeleted
                                  ? "text-text-muted line-through"
                                  : "text-text-primary"
                              }`}
                              title={item.title}
                            >
                              {item.title}
                            </p>
                            {/* Status Badge */}
                            {isDownloading ? (
                              <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                                Downloading {item.progress?.toFixed(0)}%
                              </span>
                            ) : isDeleted ? (
                              <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                <Trash2 size={10} />
                                <span>Deleted from disk</span>
                              </span>
                            ) : null}
                          </div>

                          <p className="text-[11px] text-text-muted truncate mt-0.5">
                            {item.artist} {item.album ? `• ${item.album}` : ""}
                          </p>

                          <p className="mt-1 text-[10px] text-text-muted/70">
                            {formatTimeAgo(item.timestamp)}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Progress Bar or Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isDownloading ? (
                          <div className="w-28 sm:w-36 h-2 bg-surface-raised rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent transition-all duration-300"
                              style={{ width: `${item.progress || 0}%` }}
                            />
                          </div>
                        ) : isSaved ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleFavorite(item)}
                              className={`w-8 h-8 rounded-xl hover:bg-surface-raised flex items-center justify-center transition-colors ${
                                isFavorite(item) ? "text-rose-500" : "text-text-muted hover:text-rose-400"
                              }`}
                              title={isFavorite(item) ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              <Heart size={15} fill={isFavorite(item) ? "currentColor" : "none"} />
                            </button>
                            <button
                              onClick={() => handlePlayHistoryItem(item)}
                              className="w-8 h-8 rounded-xl hover:bg-surface-raised text-text-muted hover:text-accent flex items-center justify-center transition-colors"
                              title="Play in Mewsic"
                            >
                              <Play size={14} fill="currentColor" className="ml-0.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDownloadedTrack(item)}
                              className="w-8 h-8 rounded-xl hover:bg-red-500/10 text-text-muted hover:text-red-400 flex items-center justify-center transition-colors"
                              title="Delete from library &amp; disk"
                            >
                              <Trash2 size={15} />
                            </button>
                            <button
                              onClick={() => handleRemoveFromHistory(item.id)}
                              className="w-8 h-8 rounded-xl hover:bg-surface-raised text-text-muted/50 hover:text-text-primary flex items-center justify-center transition-colors"
                              title="Remove from list"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleRestoreTrack(item)}
                              className="btn-accent h-7 px-3 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                              title="Re-download and restore to library"
                            >
                              <RotateCcw size={12} />
                              <span>Restore</span>
                            </button>
                            <button
                              onClick={() => handleRemoveFromHistory(item.id)}
                              className="w-8 h-8 rounded-xl hover:bg-surface-raised text-text-muted/50 hover:text-text-primary flex items-center justify-center transition-colors"
                              title="Remove from list"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-text-muted text-center">
                <Clock size={40} className="text-accent/60 mb-1" />
                <p className="text-sm font-semibold text-text-primary">No Downloads in Past 7 Days</p>
                <p className="text-xs text-text-muted max-w-sm">
                  Songs downloaded from Discovery or Search will appear here for 7 days with quick restore and deletion options.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Interactive Track Card Component ──
interface HarbourTrackCardProps {
  track: HarbourSearchResult;
  onPlayPreview: (t: HarbourSearchResult) => void;
  onPlayInPlayer: (t: HarbourSearchResult) => void;
  onDownload: (t: HarbourSearchResult) => void;
  isPlayingPreview: boolean;
  isDownloading: boolean;
  isDownloaded: boolean;
}

function HarbourTrackCard({
  track,
  onPlayPreview,
  onPlayInPlayer,
  onDownload,
  isPlayingPreview,
  isDownloading,
  isDownloaded,
}: HarbourTrackCardProps) {
  const isFavorite = useStore((s) => s.isFavorite);
  const toggleFavorite = useStore((s) => s.toggleFavorite);

  return (
    <div
      onClick={() => onPlayPreview(track)}
      className="group relative bg-surface-raised/40 hover:bg-surface-raised rounded-2xl p-3 flex flex-col gap-2.5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1"
    >
      {/* Cover Image & Overlay Play */}
      <div className="w-full aspect-square rounded-xl bg-surface-overlay flex items-center justify-center relative overflow-hidden group/art">
        {track.cover_art ? (
          <img
            src={track.cover_art}
            alt={track.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).parentElement
                ?.querySelector(".fallback-icon")
                ?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={`fallback-icon ${track.cover_art ? "hidden" : ""
            } w-full h-full flex items-center justify-center text-text-muted bg-surface-raised/50`}
        >
          <Music size={32} className="text-accent/60" />
        </div>

        {/* Hover / Active Play Button Overlay */}
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity flex items-center justify-center ${isPlayingPreview ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayPreview(track);
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform ${isPlayingPreview
              ? "bg-accent text-black scale-100"
              : "bg-accent text-black hover:scale-110"
              }`}
            title={isPlayingPreview ? "Pause Preview" : "Play 30s Preview"}
          >
            {isPlayingPreview ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>


        {/* Saved Badge */}
        {isDownloaded && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
            <Check size={11} strokeWidth={3} />
            <span>Saved</span>
          </div>
        )}
      </div>

      {/* Track Metadata */}
      <div className="min-w-0 flex flex-col">
        <h3 className="font-bold text-xs text-text-primary truncate" title={track.title}>
          {track.title}
        </h3>
        <p className="text-[11px] text-text-muted truncate mt-0.5" title={track.artist}>
          {track.artist}
        </p>
        {(track.genre || track.year) && (
          <p className="text-[10px] text-accent/80 font-medium truncate mt-0.5">
            {[track.genre, track.year].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between pt-1 mt-auto">
        <span className="text-[10px] font-bold text-text-muted/70 bg-surface-overlay/80 px-1.5 py-0.5 rounded">
          {formatDuration(track.duration)}
        </span>

        <div className="flex items-center gap-1">
          {/* Favorite track */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(track);
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              isFavorite(track)
                ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 scale-105"
                : "text-text-muted hover:text-rose-400 hover:bg-surface-overlay"
            }`}
            title={isFavorite(track) ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Heart size={13} fill={isFavorite(track) ? "currentColor" : "none"} />
          </button>

          {/* Play in main Mewsic player */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayInPlayer(track);
            }}
            className="w-7 h-7 rounded-lg hover:bg-surface-overlay text-text-muted hover:text-accent flex items-center justify-center transition-colors"
            title="Stream in Mewsic Player"
          >
            <Headphones size={13} />
          </button>

          {/* Download to library */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(track);
            }}
            disabled={isDownloading || isDownloaded}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isDownloaded
              ? "text-emerald-500 bg-emerald-500/10 cursor-default"
              : isDownloading
                ? "text-accent bg-accent/10 cursor-wait"
                : "hover:bg-accent hover:text-black text-text-muted"
              }`}
            title={
              isDownloaded
                ? "Already in library"
                : isDownloading
                  ? "Downloading..."
                  : "Download to library"
            }
          >
            {isDownloading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : isDownloaded ? (
              <Check size={13} />
            ) : (
              <Download size={13} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProviderDropdownProps {
  providers: Array<{ id: string; name: string }>;
  selectedProvider: string;
  onSelect: (providerId: string) => void;
}

function ProviderDropdown({
  providers,
  selectedProvider,
  onSelect,
}: ProviderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = providers.find((p) => p.id === selectedProvider) || providers[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-12 px-4 rounded-2xl bg-surface-raised border ${isOpen
          ? "border-accent ring-2 ring-accent/20"
          : "border-border-subtle hover:border-border-glass"
          } text-xs font-bold text-text-primary transition-all flex items-center gap-2.5 cursor-pointer shadow-sm`}
        title="Select search provider"
      >
        <span>{current.name}</span>
        <ChevronDown
          size={14}
          className={`text-text-muted transition-transform duration-200 ${isOpen ? "rotate-180 text-accent" : ""
            }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-44 bg-surface-overlay/95 border border-border-glass rounded-2xl overflow-hidden shadow-2xl z-50 animate-scale-in p-1.5 backdrop-blur-xl">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted/70">
            Search Provider
          </div>
          {providers.map((p) => {
            const isSelected = p.id === selectedProvider;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${isSelected
                  ? "bg-accent/15 text-accent font-bold"
                  : "text-text-secondary hover:bg-surface-raised hover:text-text-primary font-medium"
                  }`}
              >
                <span>{p.name}</span>
                {isSelected && <Check size={14} className="text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HarbourView;

