# Mewsic

Mewsic is a high-performance, cross-platform desktop music player built with React and Rust (Tauri). It is designed to efficiently manage large local audio libraries while seamlessly integrating online music search and download capabilities within a modern, minimalist interface.

## Key Features
* High-Performance Scanning: Multithreaded library indexing capable of parsing thousands of tracks in seconds without UI blocking or high memory overhead.

* Modern Aesthetic & UI: A highly polished interface featuring a default dark mode, glassmorphic design elements, fluid micro-animations, and customizable accent colors.

* Integrated Downloads & Metadata: Direct audio search and download capabilities with previews, automated retrieval of synchronized lyrics, cover art, and track metadata.

* Advanced Playlist Management: Create, edit, and export custom playlists with dynamic cover art and portable `.json` storage.

* Robust Plugin Ecosystem: Extensible architecture supporting `.mewsic` archives, allowing for custom themes, new audio providers, and UI modifications via automated installation. More info at [API-docs](https://xeoniii.github.io/Mewsic/plugin-api)

## Installation

Compiled binaries for Windows, macOS, and Linux are available on the [Releases](https://github.com/xeoniii/Mewsic/releases) page.

### Building from Source

#### Prerequisites
1. **Node.js** (LTS recommended)
2. **Rust Toolchain** (via [rustup](https://rustup.rs/))
3. **OS-Specific Dependencies** (Linux only):
   * **Ubuntu/Debian**: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`
   * **Arch Linux**: `sudo pacman -S webkit2gtk-4.1 base-devel curl wget file libxdo openssl libayatana-appindicator librsvg`
   * *Windows/macOS users only need Node and Rust.*

#### Development Setup

```bash
# Clone the repository
git clone https://github.com/xeoniii/Mewsic.git
cd Mewsic

# Install frontend dependencies
npm install

# Run the development server (starts the frontend and Rust backend)
npm run tauri dev
```

#### Production Build

To compile a release binary for your current operating system, run:

```bash
npm run tauri build
```
The compiled installers and executables will be generated in `src-tauri/target/release/bundle/`.

---
*Licensed under GPL v3.0.*
