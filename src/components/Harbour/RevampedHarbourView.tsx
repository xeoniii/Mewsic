import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  Sparkles,
  Download,
  Flame,
  Radio,
  Music,
  Zap,
  ArrowRight,
  Loader2,
  Play,
  Pause,
  CheckCircle2,
  RefreshCw,
  Check,
  X,
  Volume2,
  Headphones,
  Compass,
  SlidersHorizontal,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import { useDisplayData } from "../../hooks/useDisplayData";
import { useLibrary } from "../../hooks/useLibrary";
import { formatDuration } from "../../utils/helpers";
import {
  getSimilarArtists,
  filterAndDiversifyRecommendations,
  isJunkTrack,
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

export interface TopicSection {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  query: string;
  icon: React.ReactNode;
}

// In-memory caches to prevent redundant network requests and avoid layout flicker
let cachedPersonalRecs: HarbourSearchResult[] = [];
const cachedTopicTracks: Record<string, HarbourSearchResult[]> = {};

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
];

const TOPIC_SECTIONS: TopicSection[] = [
  {
    id: "trending",
    title: "Trending Worldwide",
    subtitle: "The most played songs globally right now",
    tag: "GLOBAL HITS",
    query: "top hits 2024",
    icon: <Flame size={15} className="text-amber-400" />,
  },
  {
    id: "chill",
    title: "Chill & Lo-Fi Beats",
    subtitle: "Mellow instrumental chillhop & deep study rhythms",
    tag: "LO-FI & STUDY",
    query: "lofi hip hop chill beats",
    icon: <Radio size={15} className="text-rose-400" />,
  },
  {
    id: "electronic",
    title: "Electronic & Energy",
    subtitle: "High-energy house, synthwave & dance anthems",
    tag: "EDM & SYNTH",
    query: "electronic dance hits",
    icon: <Zap size={15} className="text-emerald-400" />,
  },
  {
    id: "indie",
    title: "Indie & Alternative Essentials",
    subtitle: "Dream pop, indie rock & fresh underground gems",
    tag: "INDIE ESSENTIALS",
    query: "indie alternative dream pop",
    icon: <Sparkles size={15} className="text-purple-400" />,
  },
];

export function RevampedHarbourView() {
  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  const {
    setRevampedHarbour,
    guiScale,
    musicDir,
    addNotification,
    updateNotification,
    removeNotification,
    setQueue,
    setIsPlaying,
    volume,
    trackListenDurations,
  } = useStore(
    useShallow((s) => ({
      setRevampedHarbour: s.setRevampedHarbour,
      guiScale: s.guiScale,
      musicDir: s.musicDir,
      addNotification: s.addNotification,
      updateNotification: s.updateNotification,
      removeNotification: s.removeNotification,
      setQueue: s.setQueue,
      setIsPlaying: s.setIsPlaying,
      volume: s.volume,
      trackListenDurations: s.trackListenDurations,
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
  const [activeTab, setActiveTab] = useState<"discover" | "direct" | "downloads">("discover");
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>("all");
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

  // Topic Tracks State (topics directly rendered as sections)
  const [topicTracks, setTopicTracks] = useState<Record<string, HarbourSearchResult[]>>(() => ({
    ...cachedTopicTracks,
  }));
  const [loadingTopics, setLoadingTopics] = useState<Record<string, boolean>>({});

  // Audio Preview & Download State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  // Direct URL grabber state
  const [directUrl, setDirectUrl] = useState("");
  const [directFormat, setDirectFormat] = useState<"mp3" | "mp4">("mp3");
  const [isDirectDownloading, setIsDirectDownloading] = useState(false);

  // Active transfers progress state
  const [activeTransfers, setActiveTransfers] = useState<
    Array<{ id: string; title: string; progress: number; status: "downloading" | "done" | "error" }>
  >([]);

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

  // Compute top artist seeds based on total listen duration + recency
  const topArtists = useMemo(() => {
    const scores: Record<string, number> = {};
    displayTracks.forEach((t) => {
      if (!t.artist || t.artist === "Unknown Artist") return;
      const durationSec = (trackListenDurations && trackListenDurations[t.id]) || 0;
      scores[t.artist] = (scores[t.artist] || 0) + 15 + Math.sqrt(durationSec);
    });
    return Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  }, [displayTracks, trackListenDurations]);

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
      setActiveTransfers((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            progress,
            status: progress >= 100 ? "done" : "downloading",
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
  }, []);

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
        for (const userArt of userArtists.slice(0, 5)) {
          const sims = getSimilarArtists(userArt);
          sims.forEach((s) => similarArtistsSet.add(s));
        }

        // Fallback seeds if user has few artists in library
        if (similarArtistsSet.size < 5) {
          FALLBACK_SEEDS.forEach((s) => similarArtistsSet.add(s));
        }

        const similarList = Array.from(similarArtistsSet);
        const shuffledSims = [...similarList].sort(() => 0.5 - Math.random());

        // Mix: 1-2 top artists from user + 5-6 similar artists
        const queryArtists: string[] = [];
        if (userArtists.length > 0) {
          const shuffledUser = [...userArtists].sort(() => 0.5 - Math.random());
          queryArtists.push(...shuffledUser.slice(0, 2));
        }

        for (const sim of shuffledSims) {
          if (queryArtists.length >= 8) break;
          if (!queryArtists.includes(sim)) {
            queryArtists.push(sim);
          }
        }

        // Fetch candidate songs from iTunes
        const rawCandidates: Array<{ queryArtist: string; track: HarbourSearchResult }> = [];
        for (const artist of queryArtists) {
          try {
            const results = await invoke<HarbourSearchResult[]>("harbour_search", {
              query: artist,
              provider: "itunes",
            });
            if (Array.isArray(results)) {
              for (const track of results.slice(0, 6)) {
                rawCandidates.push({ queryArtist: artist, track });
              }
            }
          } catch (e) {
            console.warn(`Failed search for artist ${artist}:`, e);
          }
        }

        // Filter out junk variants, songs by other artists matching the name,
        // songs already in user's library, and enforce 1 track per artist diversity!
        const existingTitles = new Set(
          displayTracks.map((t) => t.title).filter(Boolean)
        );

        const diversified = filterAndDiversifyRecommendations(
          rawCandidates,
          existingTitles,
          targetCount
        );

        setPersonalRecs(diversified);
        cachedPersonalRecs = diversified;
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

  // ── 2. Load Direct Topic Sections (Trending, Lo-Fi, Electronic, Indie) ──
  useEffect(() => {
    TOPIC_SECTIONS.forEach(async (topic) => {
      if (cachedTopicTracks[topic.id]?.length > 0) return;

      setLoadingTopics((prev) => ({ ...prev, [topic.id]: true }));
      try {
        const results = await invoke<HarbourSearchResult[]>("harbour_search", {
          query: topic.query,
          provider: "itunes",
        });

        if (Array.isArray(results)) {
          // Filter out junk variants (sped up, slowed, karaoke)
          const clean = results.filter((t) => !isJunkTrack(t.title));
          cachedTopicTracks[topic.id] = clean;
          setTopicTracks((prev) => ({ ...prev, [topic.id]: clean }));
        }
      } catch (err) {
        console.warn(`Failed to fetch topic ${topic.id}:`, err);
      } finally {
        setLoadingTopics((prev) => ({ ...prev, [topic.id]: false }));
      }
    });
  }, []);

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

  // ── 6. Play All Tracks in Player ──
  const handlePlayAllTracks = useCallback(
    (trackList: HarbourSearchResult[]) => {
      if (!trackList.length) return;
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingTrackId(null);
      }

      const virtualQueue: Track[] = trackList.map((t) => ({
        id: `harbour-${t.id}`,
        title: t.title,
        artist: t.artist,
        album: t.album || "Harbour Online",
        albumArtist: t.artist,
        genre: t.genre || "Online Discovery",
        year: t.year,
        duration: t.duration,
        filePath: t.preview_url || t.url,
        fileName: `${t.title}.m4a`,
        fileSize: 0,
        format: "m4a",
        dateAdded: Date.now(),
        isVirtual: true,
        coverArt: t.cover_art,
      }));

      setQueue(virtualQueue, 0);
      setIsPlaying(true);
    },
    [setQueue, setIsPlaying]
  );

  // ── 7. Direct One-Click Download Track ──
  const handleDownloadTrack = useCallback(
    async (track: HarbourSearchResult) => {
      if (downloadingIds.has(track.id) || downloadedIds.has(track.id)) return;

      setDownloadingIds((prev) => new Set(prev).add(track.id));
      const notifId = addNotification("Downloading...", "info", 0, true, track.title);

      setActiveTransfers((prev) => [
        { id: notifId, title: track.title, progress: 0, status: "downloading" },
        ...prev.filter((t) => t.id !== notifId),
      ]);

      let unlisten: (() => void) | undefined;
      try {
        unlisten = await listen<{ id: string; progress: number }>("download-progress", (event) => {
          if (event.payload.id === notifId) {
            updateNotification(notifId, {
              message: `Downloading... ${event.payload.progress.toFixed(0)}%`,
              loading: true,
            });
          }
        });

        await invoke("download_track", {
          musicDir,
          title: track.title,
          artist: track.artist,
          album: track.album || "",
          coverArt: track.cover_art || "",
          downloadId: notifId,
          provider: searchProvider || "itunes",
          url: track.url || "",
          trackId: track.id,
          genre: track.genre,
          year: track.year,
        });

        updateNotification(notifId, {
          message: `Saved "${track.title}" to library!`,
          type: "success",
          loading: false,
        });
        setTimeout(() => removeNotification(notifId), 3500);

        setDownloadedIds((prev) => new Set(prev).add(track.id));
        rescanDirectory();
      } catch (err: any) {
        console.error("Download failed:", err);
        updateNotification(notifId, {
          message: "Download failed: " + (err?.toString() || "Unknown error"),
          type: "error",
          loading: false,
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
      downloadedIds,
      musicDir,
      addNotification,
      updateNotification,
      removeNotification,
      searchProvider,
      rescanDirectory,
    ]
  );

  // ── 8. URL Downloader Handler ──
  const handleDirectUrlDownload = useCallback(async () => {
    const url = directUrl.trim();
    if (!url) return;
    setIsDirectDownloading(true);
    const notifId = addNotification(
      "Fetching audio...",
      "info",
      0,
      true,
      `yt-dlp [${directFormat.toUpperCase()}]`
    );

    setActiveTransfers((prev) => [
      { id: notifId, title: url, progress: 0, status: "downloading" },
      ...prev,
    ]);

    try {
      await invoke("download_track", {
        musicDir,
        title: "Web Stream Download",
        artist: "Online Stream",
        album: "Harbour",
        coverArt: "",
        downloadId: notifId,
        url: url,
        format: directFormat,
        ipVersion: "ipv4",
      });

      updateNotification(notifId, {
        message: "Download complete!",
        type: "success",
        loading: false,
      });
      setTimeout(() => removeNotification(notifId), 4000);
      setDirectUrl("");
      rescanDirectory();
    } catch (err: any) {
      updateNotification(notifId, {
        message: "Download failed: " + (err?.toString() || "Error"),
        type: "error",
        loading: false,
      });
      setTimeout(() => removeNotification(notifId), 5000);
    } finally {
      setIsDirectDownloading(false);
    }
  }, [directUrl, directFormat, musicDir, addNotification, updateNotification, removeNotification, rescanDirectory]);

  // Visible topics depending on filter chip
  const visibleTopicSections = useMemo(() => {
    if (selectedTopicFilter === "all") return TOPIC_SECTIONS;
    return TOPIC_SECTIONS.filter((s) => s.id === selectedTopicFilter);
  }, [selectedTopicFilter]);

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-y-auto page select-none">
      <div className="flex flex-col gap-8 p-8 pb-16 w-full max-w-7xl mx-auto">
        {/* ── TOP EXPERIMENTAL BANNER ── */}
        <div className="flex items-center justify-between bg-surface-raised/40 border border-border-glass rounded-2xl px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Revamped Harbour
            </span>
            <span className="text-xs text-text-muted hidden sm:inline">
              • Diverse taste recommendations, curated topics, and instant audio previews
            </span>
          </div>
          <button
            onClick={() => setRevampedHarbour(false)}
            className="text-[11px] font-semibold text-text-muted hover:text-text-primary px-2.5 py-1 rounded-lg hover:bg-surface-overlay transition-colors"
            title="Switch back to standard Harbour"
          >
            Switch to Default Harbour
          </button>
        </div>

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
          <form onSubmit={handleSearch} className="relative w-full max-w-3xl flex items-center gap-2">
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

            {/* Provider Switcher */}
            <select
              value={searchProvider}
              onChange={(e) => {
                setSearchProvider(e.target.value);
                localStorage.setItem("mewsic-harbour-provider", e.target.value);
              }}
              className="h-12 px-3.5 rounded-2xl bg-surface-raised border border-border-subtle text-xs font-bold text-text-primary focus:border-accent focus:outline-none cursor-pointer"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface-base text-text-primary">
                  {p.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={searchLoading}
              className="btn-accent h-12 px-5 text-xs font-bold flex items-center gap-1.5 shadow-sm rounded-2xl shrink-0"
            >
              {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {/* Quick Filter Navigation Tabs */}
          <div className="flex items-center gap-2 mt-1">
            {[
              { id: "discover", label: "Discover & Topics", icon: <Compass size={13} /> },
              { id: "direct", label: "URL Downloader", icon: <Download size={13} /> },
              { id: "downloads", label: "Transfers", icon: <Zap size={13} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id !== "discover") {
                    setIsSearchActive(false);
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id && !isSearchActive
                    ? "bg-accent text-black shadow-sm"
                    : "bg-surface-raised/40 hover:bg-surface-raised text-text-muted hover:text-text-primary border border-border-subtle"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── SEARCH RESULTS (WHEN USER SEARCHES) ── */}
        {isSearchActive && (
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
            {/* ── TOPIC FILTER CHIPS ── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-bold uppercase text-text-muted flex items-center gap-1.5 mr-1 shrink-0">
                <SlidersHorizontal size={12} />
                Filter:
              </span>
              {[
                { id: "all", label: "All Topics" },
                { id: "recs", label: "For You" },
                { id: "trending", label: "Trending" },
                { id: "chill", label: "Lo-Fi & Study" },
                { id: "electronic", label: "Electronic" },
                { id: "indie", label: "Indie Essentials" },
              ].map((chip) => {
                const isActive = selectedTopicFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setSelectedTopicFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                      isActive
                        ? "bg-accent text-black shadow-sm"
                        : "bg-surface-raised/50 hover:bg-surface-raised text-text-muted hover:text-text-primary border border-border-subtle"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* ── SECTION 1: PERSONALIZED RECOMMENDATIONS ── */}
            {(selectedTopicFilter === "all" || selectedTopicFilter === "recs") && (
              <section className="flex flex-col gap-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-accent" />
                      <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
                        Recommended For You
                      </p>
                    </div>
                    <h2 className="font-display font-black text-2xl md:text-3xl text-text-primary tracking-tight mt-0.5">
                      Songs you might love
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Diverse picks from artists similar to your library taste • Max 1 song per artist
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchPersonalRecommendations(true)}
                      disabled={personalRecsLoading}
                      className="btn-accent bg-surface-raised hover:bg-surface-overlay text-text-primary border-border-subtle h-8 px-3 text-xs font-bold flex items-center gap-1.5"
                      title="Get new recommendations"
                    >
                      <RefreshCw
                        size={13}
                        className={personalRecsLoading ? "animate-spin text-accent" : ""}
                      />
                      <span>Refresh</span>
                    </button>
                    {personalRecs.length > 0 && (
                      <button
                        onClick={() => handlePlayAllTracks(personalRecs.slice(0, targetCount))}
                        className="btn-accent h-8 px-3 text-xs font-bold flex items-center gap-1.5"
                        title="Play all recommended tracks"
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Play All</span>
                      </button>
                    )}
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
                    {personalRecs.slice(0, targetCount).map((track) => (
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
            )}

            {/* ── TOPIC SECTIONS (DIRECTLY RENDERED WITH SONGS) ── */}
            {visibleTopicSections.map((topic) => {
              const tracks = topicTracks[topic.id] || [];
              const isLoading = loadingTopics[topic.id];

              return (
                <section key={topic.id} className="flex flex-col gap-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {topic.icon}
                        <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                          {topic.tag}
                        </p>
                      </div>
                      <h2 className="font-display font-black text-2xl md:text-3xl text-text-primary tracking-tight mt-0.5">
                        {topic.title}
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">{topic.subtitle}</p>
                    </div>

                    {tracks.length > 0 && (
                      <button
                        onClick={() => handlePlayAllTracks(tracks.slice(0, targetCount))}
                        className="btn-accent h-8 px-3 text-xs font-bold flex items-center gap-1.5"
                        title={`Play all in ${topic.title}`}
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Play All</span>
                      </button>
                    )}
                  </div>

                  {isLoading && tracks.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted">
                      <Loader2 size={28} className="animate-spin text-accent" />
                      <p className="text-xs font-medium">Loading {topic.title}...</p>
                    </div>
                  ) : tracks.length > 0 ? (
                    <div
                      className="grid gap-4"
                      style={{ gridTemplateColumns: `repeat(${targetCount}, minmax(0, 1fr))` }}
                    >
                      {tracks.slice(0, targetCount).map((track) => (
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
                    <div className="p-6 rounded-2xl bg-surface-raised/20 border border-border-subtle text-center text-text-muted text-xs">
                      No tracks loaded for this topic yet.
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* ── TAB 2: DIRECT URL DOWNLOADER ── */}
        {activeTab === "direct" && !isSearchActive && (
          <section className="bg-surface-raised/30 border border-border-subtle rounded-3xl p-6 md:p-8 flex flex-col gap-5 max-w-3xl">
            <div>
              <h2 className="font-display font-bold text-xl text-text-primary">
                Direct Media Grabber
              </h2>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Paste video or audio links from YouTube, SoundCloud, Bandcamp, or direct audio URLs.
                High-bitrate audio and metadata are automatically extracted and tagged.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or https://soundcloud.com/..."
                className="flex-1 h-11 px-4 rounded-xl bg-surface-overlay border border-border-subtle focus:border-accent focus:outline-none text-xs text-text-primary"
              />
              <div className="flex items-center gap-2">
                <select
                  value={directFormat}
                  onChange={(e) => setDirectFormat(e.target.value as any)}
                  className="h-11 px-3 rounded-xl bg-surface-overlay border border-border-subtle text-xs font-bold text-text-primary focus:border-accent focus:outline-none cursor-pointer"
                >
                  <option value="mp3">Audio (MP3)</option>
                  <option value="mp4">Video (MP4)</option>
                </select>
                <button
                  onClick={handleDirectUrlDownload}
                  disabled={isDirectDownloading || !directUrl.trim()}
                  className="btn-accent h-11 px-5 text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  {isDirectDownloading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  <span>{isDirectDownloading ? "Fetching..." : "Download"}</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── TAB 3: ACTIVE TRANSFERS ── */}
        {activeTab === "downloads" && !isSearchActive && (
          <section className="bg-surface-raised/30 border border-border-subtle rounded-3xl p-6 md:p-8 flex flex-col gap-4">
            <div>
              <h2 className="font-display font-bold text-xl text-text-primary">
                Active & Recent Transfers
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Real-time progress for all audio downloads and encodes.
              </p>
            </div>

            {activeTransfers.length > 0 ? (
              <div className="flex flex-col gap-3 mt-2">
                {activeTransfers.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-surface-overlay/80 border border-border-subtle"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                        {item.status === "done" ? <Check size={16} /> : <Download size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-primary truncate">{item.title}</p>
                        <p className="text-[11px] text-text-muted mt-0.5 capitalize">
                          {item.status === "done"
                            ? "Saved to library"
                            : `Downloading ${item.progress.toFixed(0)}%`}
                        </p>
                      </div>
                    </div>

                    <div className="w-32 h-2 bg-surface-raised rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-muted text-center">
                <CheckCircle2 size={36} className="text-accent/60 mb-1" />
                <p className="text-sm font-semibold text-text-primary">No Active Transfers</p>
                <p className="text-xs text-text-muted max-w-sm">
                  Downloads initiated through recommendations, search, or the direct grabber will appear here.
                </p>
              </div>
            )}
          </section>
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
  return (
    <div
      onClick={() => onPlayPreview(track)}
      className="group relative bg-surface-raised/40 hover:bg-surface-raised border border-border-subtle hover:border-accent/40 rounded-2xl p-3 flex flex-col gap-2.5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1"
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
          className={`fallback-icon ${
            track.cover_art ? "hidden" : ""
          } w-full h-full flex items-center justify-center text-text-muted bg-surface-raised/50`}
        >
          <Music size={32} className="text-accent/60" />
        </div>

        {/* Hover / Active Play Button Overlay */}
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity flex items-center justify-center ${
            isPlayingPreview ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayPreview(track);
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform ${
              isPlayingPreview
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

        {/* Playing Badge */}
        {isPlayingPreview && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-accent text-black text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md">
            <Volume2 size={12} className="animate-pulse" />
            <span>Preview</span>
          </div>
        )}

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
      <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 mt-auto">
        <span className="text-[10px] font-bold text-text-muted/70 bg-surface-overlay/80 px-1.5 py-0.5 rounded">
          {formatDuration(track.duration)}
        </span>

        <div className="flex items-center gap-1">
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
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              isDownloaded
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
