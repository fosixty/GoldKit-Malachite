# Malachite

Open-source Electron app that wraps [yt-dlp](https://github.com/yt-dlp/yt-dlp) for studio downloads. Dark, minimal UI with real-time progress and a terminal-style log panel.

## Prerequisites

- **Node.js 20+**

Packaged Windows and macOS builds include verified yt-dlp, Node.js, FFmpeg, and
FFprobe binaries; users do not need to install them separately.

## Setup

```bash
npm install
npm run fetch-ytdlp
npm run fetch-node
npm run fetch-ffmpeg
```

`fetch-ytdlp` downloads a pinned official yt-dlp release into `build/` and verifies
its platform-specific SHA-256 digest before installing it:

| Platform | File |
|----------|------|
| Windows | `build/yt-dlp.exe` |
| macOS | `build/yt-dlp` |
| Linux | `build/yt-dlp` |

You can also place a manually built binary in `build/` using the same filenames.
When updating the pinned version in `scripts/fetch-ytdlp.js`, copy hashes only from
the release's signed `SHA2-256SUMS` manifest.

`fetch-node` downloads the pinned official Node.js 24.20.0 LTS archive, verifies both the
archive and extracted executable SHA-256 hashes, and installs only the native
runtime under `build/node/<platform>-<architecture>/`. Malachite passes this exact
absolute path to yt-dlp with `--js-runtimes`; it never relies on Node.js from PATH.
The official yt-dlp executables already bundle the matching `yt-dlp-ejs` scripts,
so no remote EJS component download is enabled. yt-dlp invokes Node.js with its
permission model enabled and no filesystem, network, child-process, or worker grants.

`fetch-ffmpeg` downloads the pinned FFmpeg 8.1.2 archive and official source,
verifies the archive and extracted executable SHA-256 hashes, and extracts only
FFmpeg and FFprobe into the platform/architecture-specific directory under
`build/ffmpeg/`. Exact providers, configurations, licenses, source locations, and
hashes are documented in [legal/ffmpeg/BUILD_INFO.md](legal/ffmpeg/BUILD_INFO.md).

## Development

```bash
npm run dev
```

This starts the Vite dev server and launches Electron. The app spawns the yt-dlp binary from `build/` via `child_process.spawn()` and streams stdout/stderr to the UI.

Development state is stored in the gitignored `.dev-data/` directory instead of
the installed application's real profile. `npm run dev` verifies the pinned
`yt-dlp`, Node.js, FFmpeg, FFprobe, and source archives and downloads them automatically
when missing. These commands work from Git Bash, PowerShell, and a regular
terminal.

Development prefers `MALACHITE_FFMPEG_DIR` when it contains an absolute path to a
compatible FFmpeg/FFprobe pair, then the verified `build/ffmpeg/` pair, and only
then a compatible pair found on PATH with a visible diagnostic. Packaged builds
always require the bundled pair and never fall back to PATH.

To clear development history and show the first-launch responsible-use notice
again:

```bash
npm run dev:reset
npm run dev
```

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

Packaged apps resolve yt-dlp, Node.js, and the matching FFmpeg/FFprobe pair from
`resources/build/` via Electron Builder `extraResources`. Windows releases target
x64. The universal macOS DMG contains separate native x64 and arm64 runtime/tool
pairs and chooses the pair matching the running Electron architecture.

**Note:** macOS `.dmg` builds require a Mac. Windows `.exe` builds run on Windows.

## macOS setup and DMG build

Installers are **not** stored in the GitHub repo. You build the `.dmg` locally on a Mac.

### Prerequisites

- **Node.js 20+**
- Clone the repo and `cd` into it before running any `npm` commands

```bash
git clone https://github.com/fosixty/GoldKit-Malachite.git
cd GoldKit-Malachite
```

### Build the DMG

```bash
npm install
npm run fetch-ytdlp
npm run fetch-node -- --all-darwin
npm run fetch-ffmpeg
npm run dist:mac
```

The installer appears in `release/` (e.g. `release/Malachite-1.0.0.dmg`).

### First launch on macOS

Unsigned builds may trigger Gatekeeper. Right-click the app → **Open** (normal for private/internal apps without Apple notarization).

### Run from source (no installer)

```bash
npm install
npm run dev
```

## Features

- URL input with download / cancel
- Output directory picker (defaults to system Downloads folder)
- Format selector: Audio (MP3), compatible 720p/1080p video, Best quality
- Real-time progress bar with speed and ETA
- Terminal-style log panel (stdout + stderr)
- Download history (last 50 items, persisted in app userData)
- One-time responsible-use notice requiring explicit acceptance

The 720p and 1080p modes first select H.264 video plus AAC/M4A audio and merge
without transcoding into a broadly compatible MP4. They then try a combined
H.264/AAC MP4 before falling back to the best available streams. The existing
Best quality mode remains available and may produce WebM when VP9/AV1 and Opus
are the best formats offered.

## Responsible use and licensing

Use Malachite only to download media that you are legally entitled to access and
save. See [LEGAL.md](LEGAL.md) for the complete notice and third-party licensing
information.

Malachite is licensed under `GPL-3.0-or-later`. See [LICENSE](LICENSE). Service
policy and binary-distribution considerations are documented in
[COMPLIANCE.md](COMPLIANCE.md), with dependency details in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Copyright © 2026 Mitchell Gendron.

Malachite is not affiliated with YouTube, Google, yt-dlp, or FFmpeg. YouTube URLs
receive an additional authorization warning because YouTube's Terms restrict
downloading and automated access except in limited authorized cases. Users may
explicitly confirm the warning and select “Do not ask again.”

## Project structure

```
electron/          Main process, preload, yt-dlp spawn logic
src/               React + Tailwind UI
scripts/           verified yt-dlp and FFmpeg build-time downloaders
build/             yt-dlp, FFmpeg/FFprobe, and source archives (not committed)
yt-dlp-master/     yt-dlp source (reference only)
```

## Tech stack

- Electron
- React + Vite
- Tailwind CSS
- electron-builder (NSIS / DMG)
