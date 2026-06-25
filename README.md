# Mewsic

Mewsic is an offline music player for desktop systems. It is built using Tauri 2, React 18, and Rust. The project focuses on rendering speed, low resource usage, and clean aesthetics.

This project was previously known as OpenMusic.

## Features

### Audio Playback
* Throttled playback engine updates (500ms intervals) to reduce CPU and memory usage.
* A multi-threaded local asset server built in Rust (using tiny_http) that supports HTTP Range requests for fast seeking.
* Cover art caching in the system cache directory to prevent UI lag when loading large libraries.

### Library Management
* Fast library indexing using rayon and walkdir to scan directories in parallel.
* Tag reading and writing for formats including MP3, FLAC, OGG, WAV, AAC, M4A, OPUS, AIFF, and WMA using the lofty crate.
* Virtualized list scrolling to handle large music libraries.
* JSON-based playlists supporting custom track ordering, imports, and exports.

### Integrations
* Search across JioSaavn, iTunes, and YouTube.
* Built-in track downloading and post-processing using yt-dlp and ffmpeg.
* Automatic metadata tagging and cover art embedding for downloaded files.
* Synchronized and plain text lyric fetching from lrclib.net.
* Discord Rich Presence showing the currently playing track and listening duration.
* OS-level media control integration (MPRIS on Linux, SMTC on Windows) using souvlaki.
* System tray integration and desktop notifications on track changes.

### Interface
* Dark theme featuring glassmorphism and real-time backdrop blur.
* Accent colors configurable via CSS custom properties.
* Custom, theme-aware context menus for tracks and playlists.
* Frameless window layout with custom window controls.

## Project Structure

```
.
├── src/                    ← React Frontend (TypeScript)
│   ├── components/
│   │   ├── Dashboard/      ← Home, recent, and search views
│   │   ├── Library/        ← Virtualized lists and metadata editor
│   │   ├── Player/         ← Playback controls and progress tracking
│   │   ├── Settings/       ← Directory scanning and theme configuration
│   │   └── Sidebar/        ← Navigation and playlist list
│   ├── hooks/
│   │   ├── useAudioPlayer.ts ← Playback coordination
│   │   └── useLibrary.ts     ← Scan and track management
│   ├── store/index.ts      ← Zustand global state
│   └── utils/tauriApi.ts   ← Tauri command helpers
├── src-tauri/              ← Rust Backend (Tauri 2.0)
│   ├── src/
│   │   ├── main.rs         ← Core logic, asset server, and search
│   │   └── media_controls.rs ← OS media control bridge
│   ├── Cargo.toml          ← Rust dependencies
│   └── tauri.conf.json     ← Tauri application configuration
└── index.css               ← Base styles and theme configuration
```

## Installation

### macOS and Linux
You can install the latest pre-compiled release using the universal installation script. This script supports macOS and all major Linux distributions (including Arch Linux, Ubuntu, Debian, Fedora, and openSUSE) by downloading the universal AppImage format and setting up desktop integration.

Open your terminal and run:

```bash
curl -fsSL https://raw.githubusercontent.com/xeoniii/Mewsic/main/install.sh | bash
```

### Windows
Open PowerShell as an Administrator and run:

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-Expression (Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/xeoniii/Mewsic/main/install.ps1' -UseBasicParsing).Content"
```

---

## Getting Started

### Prerequisites
* Rust toolchain (stable)
* Node.js (version 18 or later)
* Linux dependencies (if building on Linux): `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

### Development
Install dependencies:
```bash
npm install
```

Start the application in development mode with hot-reloading:
```bash
npm run tauri dev
```

### Production Build
Build native distribution packages (e.g., AppImage, .deb, or .exe depending on target OS):
```bash
npm run tauri build
```

## License

GPL v3.0
