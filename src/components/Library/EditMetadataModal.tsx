import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Save, ImageIcon, Search, Music, FileText, Globe } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { saveTrackMetadata, saveWordLyrics, getCoverArt, fetchTrackMetadata } from "../../utils/tauriApi";
import type { Track } from "../../types";

interface EditMetadataModalProps {
  track: Track;
  onClose: () => void;
}

export function EditMetadataModal({ track, onClose }: EditMetadataModalProps) {
  const { updateTrack } = useStore(useShallow((s) => ({ updateTrack: s.updateTrack })));
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);
  const [genre, setGenre] = useState(track.genre);
  const [year, setYear] = useState(track.year?.toString() ?? "");
  const [lyrics, setLyrics] = useState(track.wordLyrics ?? track.lyrics ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [newCover, setNewCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [fetchingCover, setFetchingCover] = useState(false);
  const [fetchingLyrics, setFetchingLyrics] = useState(false);
  const [showLyricsOptions, setShowLyricsOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCoverArt(track.filePath).then(setCoverUrl);
  }, [track.filePath]);

  const handleCoverSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setNewCover(result);
      setCoverUrl(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFetchMetadata = useCallback(async () => {
    const query = `${title || track.title} ${artist || track.artist}`.trim();
    if (!query) {
      setError("Please provide at least a title or artist to fetch metadata.");
      return;
    }

    setFetchingMetadata(true);
    setError(null);
    try {
      const result = await fetchTrackMetadata(query);
      if (result) {
        if (result.title) setTitle(result.title);
        if (result.artist) setArtist(result.artist);
        if (result.album && result.album !== "YouTube") setAlbum(result.album);
      }
    } catch (err) {
      setError("Failed to fetch metadata. Make sure you are connected to the internet.");
    } finally {
      setFetchingMetadata(false);
    }
  }, [title, track.title, artist, track.artist]);

  const handleFetchCover = useCallback(async () => {
    const query = `${title || track.title} ${artist || track.artist} album art`.trim();
    setFetchingCover(true);
    setError(null);
    try {
      const result = await fetchTrackMetadata(query);
      if (result && result.coverArt) {
        try {
          const base64 = await invoke<string>("fetch_image_as_base64", { url: result.coverArt });
          setCoverUrl(base64);
          setNewCover(base64);
        } catch (e) {
          console.error("Failed to fetch cover art via backend", e);
          setError("Failed to download cover art. It might be blocked by the server.");
        }
      } else {
        setError("No cover art found for this track.");
      }
    } catch (err) {
      setError("Failed to fetch cover art.");
    } finally {
      setFetchingCover(false);
    }
  }, [title, track.title, artist, track.artist]);

  const handleFetchLyricsOnline = useCallback(async () => {
    const query = `${title || track.title} ${artist || track.artist}`.trim();
    setFetchingLyrics(true);
    setShowLyricsOptions(false);
    setError(null);
    try {
      const result = await invoke<string | null>("fetch_lyrics", { query });
      
      if (result) {
        setLyrics(result);
      } else {
        setError("No lyrics found online.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch lyrics online.");
    } finally {
      setFetchingLyrics(false);
    }
  }, [title, track.title, artist, track.artist]);

  const handleSelectLrcFile = useCallback(async () => {
    setShowLyricsOptions(false);
    try {
      const selected = await open({
        filters: [{ name: "Lyrics", extensions: ["lrc", "txt"] }],
        multiple: false,
      });
      if (selected && !Array.isArray(selected)) {
        const bytes = await readFile(selected);
        const content = new TextDecoder().decode(bytes);
        setLyrics(content);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to read LRC file.");
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const hasWordSync = lyrics ? /<(\d+):(\d{2})(?:\.(\d+))?>/.test(lyrics) : false;
      let tagLyrics = lyrics;

      if (hasWordSync && lyrics) {
        // Save word-by-word lyrics to sidecar .elrc file (leaves MP3 clean)
        await saveWordLyrics(track.filePath, track.id, lyrics);
        // Strip <...> word tags so standard music players only see clean line LRC
        tagLyrics = lyrics.replace(/<[^>]+>/g, "").replace(/  +/g, " ");
      }

      await saveTrackMetadata(track.filePath, {
        title: title || undefined,
        artist: artist || undefined,
        album: album || undefined,
        album_artist: track.albumArtist || undefined,
        genre: genre || undefined,
        year: year ? parseInt(year, 10) : undefined,
        cover_art: newCover || undefined,
        lyrics: tagLyrics || undefined,
      });

      const updated: Track = {
        ...track,
        title: title || track.title,
        artist: artist || track.artist,
        album: album || track.album,
        genre: genre || track.genre,
        year: year ? parseInt(year, 10) : track.year,
        lyrics: tagLyrics || undefined,
        wordLyrics: hasWordSync ? lyrics : track.wordLyrics,
      };
      updateTrack(updated);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [track, title, artist, album, genre, year, newCover, lyrics, updateTrack, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="font-display font-semibold text-text-primary">Edit Metadata</h2>
          <button onClick={onClose} className="btn-icon p-1">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6 max-h-[80vh] overflow-y-auto scrollbar-hide">
          <div className="flex gap-6">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-36 h-36 rounded-xl overflow-hidden bg-surface-overlay border border-border-subtle cursor-pointer hover:border-border-glass transition-colors"
                onClick={handleCoverSelect}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={24} className="text-text-muted" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 w-full">
                <button onClick={handleCoverSelect} className="btn-icon text-xs flex items-center justify-center gap-1 w-full bg-white/5 py-1.5 rounded-lg">
                  <ImageIcon size={12} />
                  Local File
                </button>
                <button 
                  onClick={handleFetchCover} 
                  disabled={fetchingCover || saving} 
                  className="btn-icon text-xs flex items-center justify-center gap-1 w-full bg-white/5 py-1.5 rounded-lg disabled:opacity-50"
                >
                  <Search size={12} />
                  {fetchingCover ? "Fetching…" : "Fetch Cover"}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-text-muted mb-1 block">Artist</label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-text-muted mb-1 block">Album</label>
                  <input
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-text-muted mb-1 block">Genre</label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
                  />
                </div>
                <div className="w-20">
                  <label className="text-xs text-text-muted mb-1 block">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

            <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-muted flex items-center gap-1 font-medium">
                  <FileText size={12} />
                  Lyrics
                </label>
                {lyrics && /<(\d+):(\d{2})(?:\.(\d+))?>/.test(lyrics) ? (
                  <span className="text-[10px] text-accent font-bold bg-accent/15 px-2 py-0.5 rounded-full border border-accent/30">
                    Word-Synced (.elrc)
                  </span>
                ) : lyrics && /\[\d+:\d{2}(?:\.\d+)?\]/.test(lyrics) ? (
                  <span className="text-[10px] text-text-primary font-semibold bg-surface-raised px-2 py-0.5 rounded-full border border-border-subtle">
                    Line-Synced
                  </span>
                ) : lyrics ? (
                  <span className="text-[10px] text-text-muted font-medium bg-surface-raised/40 px-2 py-0.5 rounded-full">
                    Plain Text
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <button 
                  onClick={() => setShowLyricsOptions(!showLyricsOptions)}
                  disabled={fetchingLyrics}
                  className="text-[10px] text-accent hover:underline flex items-center gap-1 font-semibold"
                >
                  <Search size={10} />
                  {fetchingLyrics ? "Searching..." : "Fetch Lyrics"}
                </button>
                {showLyricsOptions && (
                  <div className="absolute right-0 top-6 z-10 w-48 glass border border-border-subtle rounded-lg shadow-xl overflow-hidden py-1">
                    <button 
                      onClick={handleFetchLyricsOnline}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2"
                    >
                      <Globe size={12} />
                      Search Online (Word/Line)
                    </button>
                    <button 
                      onClick={handleSelectLrcFile}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 flex items-center gap-2"
                    >
                      <FileText size={12} />
                      Select LRC File
                    </button>
                  </div>
                )}
              </div>
            </div>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Lyrics content (LRC or Word-Synced ELRC supported)..."
              className="w-full h-48 px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-xs outline-none focus:border-border-glass transition-colors resize-none font-mono scrollbar-hide"
            />
          </div>
        </div>

        {error && (
          <div className="px-6 pb-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle">
          <button 
            onClick={handleFetchMetadata} 
            disabled={fetchingMetadata || saving} 
            className="btn-accent bg-surface-overlay text-text-secondary hover:opacity-80"
          >
            <Search size={14} />
            {fetchingMetadata ? "Fetching…" : "Fetch Metadata"}
          </button>
          <button onClick={onClose} className="btn-accent bg-surface-overlay text-text-secondary hover:opacity-80">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || fetchingMetadata || fetchingCover || fetchingLyrics} className="btn-accent">
            <Save size={14} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}