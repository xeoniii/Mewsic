import React, { useState, useEffect, useRef } from "react";
import { Search, Download, Music, Loader2, Globe, AlertCircle, ChevronDown, Check, Terminal, Youtube, Link as LinkIcon, Send, FileAudio, FileVideo, Zap, PlusCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useLibrary } from "../../hooks/useLibrary";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";

interface HarbourSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_art: string;
  url: string;
  preview_url?: string;
}

export default function HarbourView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HarbourSearchResult[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState(() => {
    return localStorage.getItem("mewsic-harbour-provider") || "itunes";
  });

  useEffect(() => {
    localStorage.setItem("mewsic-harbour-provider", provider);
  }, [provider]);
  const [preparing, setPreparing] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const { musicDir, addNotification, updateNotification, removeNotification, addPlaylist } = useStore(useShallow((s) => ({
    musicDir: s.musicDir,
    addNotification: s.addNotification,
    updateNotification: s.updateNotification,
    removeNotification: s.removeNotification,
    addPlaylist: s.addPlaylist,
  })));
  const { rescanDirectory } = useLibrary();

  const [dependencyProgress, setDependencyProgress] = useState<{ytdlp: number, ffmpeg: number}>({ytdlp: 0, ffmpeg: 0});
  const [currentDep, setCurrentDep] = useState<"yt-dlp" | "ffmpeg" | null>(null);

  const [customProviders, setCustomProviders] = useState<Array<{ id: string; name: string }>>([]);

  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePreview = (url?: string) => {
    if (!url) return;
    if (playingPreviewUrl === url) {
      audioRef.current?.pause();
      setPlayingPreviewUrl(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.volume = 0.5;
      audio.play();
      audio.onended = () => setPlayingPreviewUrl(null);
      audioRef.current = audio;
      setPlayingPreviewUrl(url);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    const updateProviders = () => {
      if (window.Mewsic?.ui?.registry?.searchProviders) {
        const list: Array<{ id: string; name: string }> = [];
        window.Mewsic.ui.registry.searchProviders.forEach((config: any, id: string) => {
          list.push({ id, name: config.name });
        });
        setCustomProviders(list);
      }
    };

    window.addEventListener("plugin-ui-updated", updateProviders);
    updateProviders();
    return () => window.removeEventListener("plugin-ui-updated", updateProviders);
  }, []);

  const providers = [
    { id: "itunes", name: "iTunes" },
    { id: "jiosaavn", name: "JioSaavn" },
    { id: "youtube", name: "YouTube" },
    { id: "soundcloud", name: "SoundCloud" },
    ...customProviders
  ];

  useEffect(() => {
    let unlistenYt: (() => void) | undefined;
    let unlistenFm: (() => void) | undefined;

    const init = async () => {
      try {
        unlistenYt = await listen<number>("harbour-download-progress-ytdlp", (event) => {
          setDependencyProgress(prev => ({ ...prev, ytdlp: event.payload }));
          setCurrentDep("yt-dlp");
        });
        unlistenFm = await listen<number>("harbour-download-progress-ffmpeg", (event) => {
          setDependencyProgress(prev => ({ ...prev, ffmpeg: event.payload }));
          setCurrentDep("ffmpeg");
        });

        await invoke("ensure_dependencies");
      } catch (err) {
        console.error("Dependency check failed:", err);
      } finally {
        setPreparing(false);
      }
    };
    init();

    return () => {
      if (unlistenYt) unlistenYt();
      if (unlistenFm) unlistenFm();
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<{ id: string; progress: number }>("download-progress", (event) => {
      updateNotification(event.payload.id, { progress: event.payload.progress });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setShowSecret(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unlisten.then(f => f());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const customProv = window.Mewsic?.ui?.registry?.searchProviders?.get(provider);
      if (customProv) {
        const res = await customProv.search(query);
        setResults(res);
        if (res.length === 0) setError("No results found.");
        return;
      }

      if (query.trim().startsWith("MWS-")) {
        let rawCode = query.trim().substring(4);
        
        // Check for provider prefix like MWS-jiosaavn:Title - Artist
        if (rawCode.includes(":") && !rawCode.startsWith("http")) {
          const parts = rawCode.split(":");
          const p = parts[0].toLowerCase();
          if (["jiosaavn", "itunes", "youtube"].includes(p)) {
            setProvider(p);
            rawCode = parts.slice(1).join(":");
          }
        }

        // If it's a URL, we can fetch specific metadata
        if (rawCode.startsWith("http")) {
          const res = await invoke<HarbourSearchResult>("fetch_track_metadata", { query: rawCode });
          if (res) {
            setResults([res]);
          } else {
            setError("No metadata found for this link.");
          }
          return;
        }
        // Otherwise search for the ID/code normally
        const res = await invoke<HarbourSearchResult[]>("harbour_search", {
          query: rawCode,
          provider
        });
        setResults(res);
        if (res.length === 0) setError("No results found.");
      } else {
        const res = await invoke<HarbourSearchResult[]>("harbour_search", {
          query,
          provider
        });
        setResults(res);
        if (res.length === 0) setError("No results found.");
      }
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const downloadTrack = async (track: HarbourSearchResult) => {
    setDownloadingIds(prev => new Set(prev).add(track.id));
    const notifId = addNotification("Downloading...", "info", 0, true, track.title);

    let unlisten: (() => void) | undefined;
    try {
      const customProv = window.Mewsic?.ui?.registry?.searchProviders?.get(provider);
      if (customProv && customProv.download) {
        await customProv.download(track, musicDir, (progress: number) => {
          updateNotification(notifId, { 
            message: `Downloading... ${progress.toFixed(0)}%`, 
            loading: true 
          });
        });
        updateNotification(notifId, { message: "Download complete!", type: "success", loading: false });
        setTimeout(() => removeNotification(notifId), 3000);
        rescanDirectory();
        return;
      }

      unlisten = await listen("download-progress", (event: any) => {
        const { id, progress } = event.payload;
        if (id === notifId) {
          updateNotification(notifId, { 
            message: `Downloading... ${progress.toFixed(0)}%`, 
            loading: true 
          });
        }
      });

      await invoke("download_track", {
        musicDir,
        title: track.title,
        artist: track.artist,
        album: track.album,
        coverArt: track.cover_art,
        downloadId: notifId,
        provider
      });
      updateNotification(notifId, { message: "Download complete!", type: "success", loading: false });
      setTimeout(() => removeNotification(notifId), 3000);
      rescanDirectory();
    } catch (err: any) {
      console.error(err);
      updateNotification(notifId, { message: "Download failed", type: "error", loading: false });
      setTimeout(() => removeNotification(notifId), 5000);
    } finally {
      if (unlisten) unlisten();
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  if (preparing) {
    const progress = currentDep === "yt-dlp" ? dependencyProgress.ytdlp : dependencyProgress.ffmpeg;
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-base text-text-muted gap-4">
        <Loader2 size={48} className="animate-spin text-accent" />
        <div className="text-center">
          <p className="text-lg font-medium text-text-primary">Preparing Harbour</p>
          <p className="text-sm">Downloading latest discovery tools...</p>
          
          {currentDep && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="w-64 h-2 bg-surface-raised border border-border-subtle rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-accent transition-all duration-300 shadow-[0_0_10px_var(--accent-glow)]" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between w-64 text-[10px] font-black uppercase tracking-[0.2em]">
                <span className="text-accent">{currentDep}</span>
                <span className="text-text-primary">{progress.toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base text-text-primary overflow-hidden page relative">
      {showSecret && <SecretMenu onClose={() => setShowSecret(false)} />}
      {
  // This is the header section
}
      <header className="p-4 md:p-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border-b border-border-subtle bg-surface-base/50 backdrop-blur-md sticky top-0 z-10 min-w-0">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center text-accent flex-shrink-0 border border-white/5">
            <Globe size={24} />
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Harbour Engine</h1>
            <p className="text-xs md:text-sm text-text-muted truncate">Global music ingestion and discovery</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full xl:w-auto items-center min-w-0 flex-1 xl:flex-none justify-end">
          <div className="relative flex-1 group min-w-0 max-w-md">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for songs, artists..."
              className="w-full bg-white/5 border border-white/5 rounded-xl h-11 pl-10 sm:pl-12 pr-4 focus:outline-none focus:border-accent/50 transition-all placeholder:text-text-muted text-text-primary hover:bg-white/10 min-w-0 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ProviderSelector provider={provider} setProvider={setProvider} providers={providers} />
            
            <button
              type="submit"
              disabled={loading}
              className="btn-accent px-4 sm:px-6 h-11 shrink-0 shadow-sm flex items-center justify-center"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : (
                <>
                  <Search size={18} className="sm:mr-2" />
                  <span className="hidden sm:inline">Search</span>
                </>
              )}
            </button>
          </div>
        </form>
      </header>

      {
  // Here is the main content
}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-6">
        {loading && results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-text-muted">
            <Loader2 size={48} className="animate-spin text-accent" />
            <p className="text-lg font-medium animate-pulse">Scanning the airwaves...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-text-muted max-w-2xl mx-auto text-center px-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary mb-2">Search Failed</h3>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => handleSearch()}
              className="mt-4 px-6 py-2 bg-surface-raised hover:bg-surface-overlay border border-border-subtle rounded-lg transition-colors text-text-primary"
            >
              Try Again
            </button>
          </div>
        ) : results.length > 0 ? (
          <div className="flex flex-col gap-2 max-w-5xl mx-auto animate-slide-up">
            {results.map((track) => (
              <div
                key={track.id}
                className="group flex items-center gap-4 p-3 rounded-[1.25rem] bg-surface-raised border border-white/5 hover:bg-surface-overlay hover:border-accent/30 transition-colors shadow-sm"
              >
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-surface-base shadow-inner">
                  {track.cover_art ? (
                    <>
                      <img 
                        src={track.cover_art} 
                        alt={track.title} 
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                        }}
                      />
                      <div className="fallback-icon hidden w-full h-full flex items-center justify-center text-text-muted">
                        <Music size={24} />
                      </div>
                    </>
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <Music size={24} />
                      </div>
                  )}
                  {downloadingIds.has(track.id) && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-accent" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h4 className="font-bold text-base sm:text-lg truncate group-hover:text-accent transition-colors text-text-primary">
                    {track.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-text-muted truncate flex items-center gap-2 mt-0.5">
                    <span className="font-medium text-text-secondary">{track.artist}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span>{track.album}</span>
                  </p>
                </div>
                
                {track.duration > 0 && (
                  <div className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-text-muted/60 tabular-nums px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                    {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                  </div>
                )}

                <button
                  onClick={() => downloadTrack(track)}
                  disabled={downloadingIds.has(track.id) && !(track as any).isPlaylist}
                  className="w-12 h-12 rounded-xl bg-black/20 hover:bg-accent hover:text-black flex items-center justify-center transition-all disabled:opacity-50 text-text-muted shadow-inner flex-shrink-0"
                  title={(track as any).isPlaylist ? "Import Playlist" : "Download Track"}
                >
                  {(track as any).isPlaylist ? (
                    <PlusCircle size={20} />
                  ) : (
                    <Download size={20} />
                  )}
                </button>
                {track.preview_url && !(track as any).isPlaylist && (
                  <button
                    onClick={() => togglePreview(track.preview_url)}
                    className="w-12 h-12 rounded-xl bg-black/20 hover:bg-accent hover:text-black flex items-center justify-center transition-all text-text-muted shadow-inner flex-shrink-0"
                    title={playingPreviewUrl === track.preview_url ? "Stop Preview" : "Play Preview"}
                  >
                    {playingPreviewUrl === track.preview_url ? (
                      <div className="w-3 h-3 bg-current" /> // Square for stop
                    ) : (
                      <FileAudio size={20} /> // Play icon or FileAudio
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-text-muted/30 animate-fade-in">
            <Globe size={64} className="text-text-muted/20" />
            <div className="text-center">
              <h3 className="text-xl font-bold text-text-muted/50 mb-1">Ready to Discover?</h3>
              <p className="text-sm">Enter a song, artist, or ID above.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProviderSelectorProps {
  provider: string;
  setProvider: (p: string) => void;
  providers: Array<{ id: string; name: string }>;
}

function ProviderSelector({ provider, setProvider, providers }: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentProvider = providers.find(p => p.id === provider) || providers[1];

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [isOpen]);

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 sm:gap-3 bg-white/5 border ${isOpen ? 'border-accent ring-1 ring-accent/20' : 'border-white/5 hover:border-white/10'} rounded-xl px-3 sm:px-4 h-11 transition-all text-sm font-medium w-[110px] sm:w-[140px] justify-between group hover:bg-white/10`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-text-primary truncate">{currentProvider.name}</span>
        </div>
        <ChevronDown size={16} className={`text-text-muted shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-surface-overlay border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-scale-in p-1.5">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProvider(p.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                provider === p.id 
                  ? 'bg-accent/10 text-accent font-bold' 
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{p.name}</span>
              </div>
              {provider === p.id && <Check size={14} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SecretMenu({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"mp3" | "mp4">("mp3");
  const [ipVersion, setIpVersion] = useState<"ipv4" | "ipv6">("ipv4");
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  const { musicDir, addNotification, updateNotification, removeNotification } = useStore(useShallow((s) => ({
    musicDir: s.musicDir,
    addNotification: s.addNotification,
    updateNotification: s.updateNotification,
    removeNotification: s.removeNotification,
  })));

  useEffect(() => {
    const unlisten = listen<{ id: string, message: string }>("download-log", (event) => {
      setLogs(prev => [...prev.slice(-100), event.payload.message]);
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);


  const handleManualDownload = async () => {
    if (!url.trim()) return;
    setIsProcessing(true);
    const notifId = addNotification("Manual Download Started", "info", 0, true, `yt-dlp [${format.toUpperCase()}]`);

    try {
      setLogs([]);
      const targetDir = await invoke<string>("get_downloads_dir").catch(() => musicDir);

      await invoke("download_track", {
        musicDir: targetDir,
        title: "Manual Download",
        artist: "Manual-yt-dlp",
        album: "Manual",
        coverArt: "",
        downloadId: notifId,
        url: url.trim(),
        format,
        ipVersion
      });
      updateNotification(notifId, { message: "Manual download complete!", type: "success", loading: false });
      setTimeout(() => removeNotification(notifId), 5000);
      setUrl("");
    } catch (err: any) {
      updateNotification(notifId, { message: "Manual download failed", type: "error", loading: false });
      setTimeout(() => removeNotification(notifId), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center p-8 animate-fade-in">
      <div className="w-full max-w-xl glass border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col animate-scale-in">
        <div className="bg-white/5 border-b border-white/5 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shadow-[0_0_15px_rgba(var(--color-accent),0.2)]">
              <Terminal size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary tracking-tight">Manual yt-dlp</h2>
              <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black">Advanced Media Ingestion</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-text-muted transition-colors"
          >
            <AlertCircle size={18} />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[75vh] scrollbar-thin">
          {
  // This is the url input part
}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
              Source URL / Identifier
            </label>
            <div className="relative group">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={18} />
              <input 
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-sm font-medium text-text-primary placeholder:text-text-muted"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {
  // This is the format selection part
}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
                Output Format
              </label>
              <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl">
                <button 
                  onClick={() => setFormat("mp3")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${format === "mp3" ? "bg-accent text-black" : "text-text-muted hover:text-text-primary"}`}
                >
                  <FileAudio size={14} />
                  MP3
                </button>
                <button 
                  onClick={() => setFormat("mp4")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${format === "mp4" ? "bg-accent text-black" : "text-text-muted hover:text-text-primary"}`}
                >
                  <FileVideo size={14} />
                  MP4
                </button>
              </div>
            </div>

            {
  // This is the ip version selection part
}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
                Network Protocol
              </label>
              <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl">
                <button 
                  onClick={() => setIpVersion("ipv4")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${ipVersion === "ipv4" ? "bg-accent text-black" : "text-text-muted hover:text-text-primary"}`}
                >
                  IPv4
                </button>
                <button 
                  onClick={() => setIpVersion("ipv6")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${ipVersion === "ipv6" ? "bg-accent text-black" : "text-text-muted hover:text-text-primary"}`}
                >
                  IPv6
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-accent-muted/10 border border-accent/20 flex items-center justify-between">
            <div className="flex gap-3">
              <Zap size={16} className="text-accent flex-shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-text-primary">Always use FFmpeg</p>
                <p className="text-[9px] text-text-muted leading-tight">Post-processing forced for all extractions</p>
              </div>
            </div>
            <div className="w-8 h-4 bg-accent/20 border border-accent/40 rounded-full relative">
              <div className="absolute right-1 top-0.5 w-2.5 h-2.5 rounded-full bg-accent" />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button 
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-white/10 text-xs font-bold text-text-muted hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleManualDownload}
              disabled={!url.trim() || isProcessing}
              className="flex-1 bg-accent hover:bg-accent/80 disabled:opacity-30 text-black font-black text-xs uppercase tracking-[0.1em] py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent/10 active:scale-[0.98]"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {isProcessing ? "Processing..." : "Initiate Download"}
            </button>
          </div>

          {
  // This is the terminal view part
}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">
                Live Terminal Output
              </label>
              {logs.length > 0 && (
                <button onClick={() => setLogs([])} className="text-[9px] text-accent/60 hover:text-accent font-bold uppercase tracking-widest">Clear</button>
              )}
            </div>
            <div 
              ref={logContainerRef}
              className="h-48 bg-black/60 border border-white/5 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto scrollbar-thin selection:bg-accent/30"
            >
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-text-muted/20 italic">
                  Waiting for process initialization...
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-accent/30 shrink-0 select-none">[{i.toString().padStart(3, '0')}]</span>
                      <span className={log.includes('ERROR') ? 'text-red-400' : log.includes('[download]') ? 'text-accent/80' : 'text-text-secondary'}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-black/20 p-4 text-center border-t border-white/5">
          <p className="text-[9px] font-mono text-text-muted/40 uppercase tracking-widest">
            Engine: Harbour-X-06 // Protocol: <span className="text-accent/60 font-bold">{ipVersion.toUpperCase()}</span> // Encoder: <span className="text-accent/60 font-bold">FFMPEG</span>
          </p>
        </div>
      </div>
    </div>
  );
}
