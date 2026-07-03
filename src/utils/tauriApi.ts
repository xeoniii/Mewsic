import { invoke, convertFileSrc as tauriConvertFileSrc } from "@tauri-apps/api/core";
import type { Track, Playlist, AppPaths, ScanResult } from "../types";

export function convertFileSrc(filePath: string): string {
  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://") ||
    filePath.startsWith("blob:") ||
    filePath.startsWith("ytsearch:")
  ) {
    return filePath;
  }
  let path = filePath.replace(/\\/g, "/");
  if (!path.startsWith("/")) path = "/" + path;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `http://127.0.0.1:1422${encodedPath}`;
}

export function getOSName(): "Windows" | "macOS" | "Linux" | "Unknown OS" {
  try {
    const mockOs = localStorage.getItem("mewsic-mock-os");
    if (mockOs === "Windows" || mockOs === "macOS" || mockOs === "Linux") {
      return mockOs;
    }
  } catch (e) { }

  if (typeof navigator === "undefined") return "Unknown OS";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "Windows";
  if (ua.includes("mac")) return "macOS";
  if (ua.includes("linux") && !ua.includes("android")) return "Linux";
  return "Unknown OS";
}

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function deepCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepCamel);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[toCamel(k)] = deepCamel(v);
    }
    return out;
  }
  return obj;
}

function toSnake(s: string): string {
  return s.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`);
}

function deepSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepSnake);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[toSnake(k)] = deepSnake(v);
    }
    return out;
  }
  return obj;
}

export async function getAppPaths(): Promise<AppPaths> {
  const raw = await invoke<Record<string, string>>("get_app_paths");
  return deepCamel(raw) as AppPaths;
}

export async function scanMusicDirectory(dirPath: string): Promise<ScanResult> {
  const raw = await invoke<Record<string, unknown>>("scan_music_directory", { dirPath });
  return deepCamel(raw) as ScanResult;
}

export async function getTrackMetadata(filePath: string): Promise<Track> {
  const raw = await invoke<Record<string, unknown>>("get_track_metadata", { filePath });
  return deepCamel(raw) as Track;
}

export async function listPlaylists(playlistsDir: string): Promise<Playlist[]> {
  const raw = await invoke<unknown[]>("list_playlists", { playlistsDir });
  return deepCamel(raw) as Playlist[];
}

export async function createPlaylist(playlistsDir: string, name: string): Promise<Playlist> {
  const raw = await invoke<Record<string, unknown>>("create_playlist", { playlistsDir, name });
  return deepCamel(raw) as Playlist;
}

export async function savePlaylist(playlist: Playlist): Promise<void> {
  await invoke("save_playlist", { playlist: deepSnake(playlist) });
}

export async function renamePlaylist(playlist: Playlist, newName: string): Promise<Playlist> {
  const result = await invoke<any>("rename_playlist", { playlist: deepSnake(playlist), newName });
  return {
    ...playlist,
    id: result.id ?? playlist.id,
    name: result.name ?? newName,
    filePath: result.file_path ?? playlist.filePath,
    trackIds: result.track_ids ?? playlist.trackIds,
    createdAt: result.created_at ?? playlist.createdAt,
    coverArt: result.cover_art ?? playlist.coverArt,
    tracks: result.tracks ?? playlist.tracks,
  };
}

export async function deletePlaylist(filePath: string): Promise<void> {
  await invoke("delete_playlist", { filePath });
}

export const clearImageCache = () => invoke("clear_image_cache");
export const deleteTrack = (filePath: string) => invoke("delete_track", { filePath });
export const getStreamUrl = (url: string): Promise<string> => invoke("get_stream_url", { url });

export interface ResolvedStream {
  url: string;
  title: string;
  artist: string;
  duration: number;
  coverArt: string;
}

export async function resolveStreamMetadata(url: string): Promise<ResolvedStream> {
  const raw = await invoke("resolve_stream_metadata", { url });
  return deepCamel(raw) as ResolvedStream;
}

export async function importPlaylist(playlistsDir: string, sourcePath: string): Promise<Playlist> {
  const raw = await invoke<Record<string, unknown>>("import_playlist", { playlistsDir, sourcePath });
  return deepCamel(raw) as Playlist;
}

export async function pickDirectory(): Promise<string | null> {
  return invoke<string | null>("pick_directory");
}

export function readAudioFile(filePath: string): string {
  return convertFileSrc(filePath);
}

export interface TrackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  album_artist?: string;
  genre?: string;
  year?: number;
  track_number?: number;
  cover_art?: string;
  lyrics?: string;
}

export async function saveTrackMetadata(filePath: string, metadata: TrackMetadata): Promise<void> {
  await invoke("save_track_metadata", { filePath, metadata: deepSnake(metadata) });
}

const MAX_COVER_CACHE = 50;
const CACHE_TTL = 30000;

interface CacheEntry {
  url: string;
  lastUsed: number;
}

const coverCache = new Map<string, CacheEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of coverCache.entries()) {
    if (now - entry.lastUsed > CACHE_TTL) {
      coverCache.delete(key);
    }
  }
}, 10000);

export async function getCoverArt(filePath: string, size = 256, lowEnd = false): Promise<string | null> {
  if (!filePath) return null;
  return `${convertFileSrc(filePath)}?thumb=1&size=${size}${lowEnd ? "&lowend=1" : ""}`;
}

export function getCoverArtSync(filePath: string, size = 256, lowEnd = false): string | null {
  if (!filePath) return null;
  return `${convertFileSrc(filePath)}?thumb=1&size=${size}${lowEnd ? "&lowend=1" : ""}`;
}

export function clearCoverCache() {
  coverCache.clear();
}

export async function updateDiscordRpc(
  title: string,
  artist: string,
  isPlaying: boolean,
  currentTime: number,
  duration: number,
  playlistName: string,
  coverUrl?: string
): Promise<void> {
  await invoke("update_discord_rpc", { title, artist, isPlaying, currentTime, duration, playlistName, coverUrl });
}

export async function clearDiscordRpc(): Promise<void> {
  await invoke("clear_discord_rpc");
}

export async function setTrayEnabled(enabled: boolean): Promise<void> {
  await invoke("set_tray_enabled", { enabled });
}

export async function toggleFullscreen(): Promise<void> {
  await invoke("toggle_fullscreen");
}

export async function importFiles(sources: string[], targetDir: string): Promise<number> {
  return invoke("import_files", { sources, targetDir });
}

export interface HarbourSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverArt: string;
  url: string;
  previewUrl?: string;
}

export async function searchHarbour(query: string, provider: string): Promise<HarbourSearchResult[]> {
  const raw = await invoke<any[]>("harbour_search", { query, provider });
  return deepCamel(raw) as HarbourSearchResult[];
}

export async function fetchTrackMetadata(query: string): Promise<HarbourSearchResult> {
  const raw = await invoke<any>("fetch_track_metadata", { query });
  return deepCamel(raw) as HarbourSearchResult;
}

export async function downloadTrack(
  musicDir: string,
  title: string,
  artist: string,
  album: string,
  coverArt: string,
  downloadId: string,
  provider?: string
): Promise<string> {
  return invoke("download_track", { musicDir, title, artist, album, coverArt, downloadId, provider });
}

export async function updateMediaMetadata(
  title: string,
  artist: string,
  album: string,
  coverUrl?: string,
  duration?: number
): Promise<void> {
  await invoke("update_media_metadata", { title, artist, album, coverUrl, duration });
}

export async function updateMediaPlayback(isPlaying: boolean, progress?: number): Promise<void> {
  await invoke("update_media_playback", { isPlaying, progress });
}

export async function clearMediaControls(): Promise<void> {
  await invoke("clear_media_controls");
}

export async function forceQuit(): Promise<void> {
  await invoke("force_quit");
}