# Malachite

Private Electron app that wraps [yt-dlp](https://github.com/yt-dlp/yt-dlp) for studio downloads. Dark, minimal UI with real-time progress and a terminal-style log panel.

## Prerequisites

- **Node.js 20+**
- **ffmpeg** on your PATH (required for audio extraction and video merging)

## Setup

```bash
npm install
npm run fetch-ytdlp
```

`fetch-ytdlp` downloads the official yt-dlp binary into `build/`:

| Platform | File |
|----------|------|
| Windows | `build/yt-dlp.exe` |
| macOS | `build/yt-dlp` |
| Linux | `build/yt-dlp` |

You can also place a manually built binary in `build/` using the same filenames.

## Development

```bash
npm run dev
```

This starts the Vite dev server and launches Electron. The app spawns the yt-dlp binary from `build/` via `child_process.spawn()` and streams stdout/stderr to the UI.

## Building installers

```bash
# Build the React app first (done automatically by dist scripts)
npm run build

# Windows NSIS installer → release/*.exe
npm run dist:win

# macOS DMG → release/*.dmg (must run on macOS)
npm run dist:mac

# Current platform
npm run dist
```

Packaged apps resolve the binary from `resources/build/` via electron-builder `extraResources`.

**Note:** macOS `.dmg` builds require a Mac. Windows `.exe` builds run on Windows.

## macOS setup and DMG build

Installers are **not** stored in the GitHub repo. You build the `.dmg` locally on a Mac.

### Prerequisites

- **Node.js 20+**
- **ffmpeg** on your PATH: `brew install ffmpeg`
- Clone the repo and `cd` into it before running any `npm` commands

```bash
git clone https://github.com/fosixty/GoldKit-Malachite.git
cd GoldKit-Malachite
```

### Build the DMG

```bash
npm install
npm run fetch-ytdlp
npm run dist:mac
```

The installer appears in `release/` (e.g. `release/Malachite-1.0.0.dmg`).

### First launch on macOS

Unsigned builds may trigger Gatekeeper. Right-click the app → **Open** (normal for private/internal apps without Apple notarization).

### Run from source (no installer)

```bash
npm install
npm run fetch-ytdlp
npm run dev
```

## Features

- URL input with download / cancel
- Output directory picker (defaults to system Downloads folder)
- Format selector: Audio (MP3), 720p, 1080p, Best quality
- Real-time progress bar with speed and ETA
- Terminal-style log panel (stdout + stderr)
- Download history (last 50 items, persisted in app userData)

## Project structure

```
electron/          Main process, preload, yt-dlp spawn logic
src/               React + Tailwind UI
scripts/           fetch-ytdlp binary downloader
build/             yt-dlp binaries (not committed)
yt-dlp-master/     yt-dlp source (reference only)
```

## Tech stack

- Electron
- React + Vite
- Tailwind CSS
- electron-builder (NSIS / DMG)
