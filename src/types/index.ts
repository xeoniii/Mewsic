export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year?: number;
  duration: number;
  trackNumber?: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
  lyrics?: string;
  dateAdded: number;
  sourceId?: string;
  provider?: string;
  isVirtual?: boolean;
  coverArt?: string;
  albumArt?: string;
  metadata?: Record<string, any>;
}

export interface Playlist {
  id: string;
  name: string;
  filePath: string;
  trackIds: string[];
  createdAt: number;
  tracks?: Track[];
  coverArt?: string;
}

export interface AppPaths {
  musicDir: string;
  playlistsDir: string;
  coversDir: string;
}

export interface ScanResult {
  tracks: Track[];
  total: number;
  errors: string[];
}

export type AccentPreset =
  | "mint"
  | "sapphire"
  | "violet"
  | "rose"
  | "amber"
  | "cyan"
  | "orange"
  | "fuchsia"
  | "emerald"
  | "custom";

export interface AppSettings {
  accentColor: AccentPreset;
  musicDirectories: string[];
  volume: number;
  repeatMode: "off" | "one" | "all";
  shuffleEnabled: boolean;
}

export type ViewId = "home" | "library" | "playlist" | "player" | "settings" | "harbour" | "audio" | "plugins" | (string & {});

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  repeatMode: "off" | "one" | "all";
  shuffleEnabled: boolean;
}

export interface Notification {
  id: string;
  title?: string;
  message: string;
  type: "info" | "success" | "error";
  loading?: boolean;
  progress?: number;
}

export interface Shortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutMap {
  togglePlay: Shortcut;
  skipForward: Shortcut;
  skipBackward: Shortcut;
  playNext: Shortcut;
  playPrev: Shortcut;
  volumeUp: Shortcut;
  volumeDown: Shortcut;
}

export interface AudioPreset {
  id: string;
  name: string;
  reverbEnabled: boolean;
  reverbStrength: number;
  playbackSpeed: number;
  bassBoost: number;
  volumeBoost: number;
  eqGains: number[];
  panX: number;
  panY: number;
  panAuto?: boolean;
}
