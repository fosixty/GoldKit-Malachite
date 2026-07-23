# Third-Party Notices

Malachite is an independent project and is not affiliated with YouTube, Google,
the yt-dlp project, or the FFmpeg project.

## yt-dlp

Malachite uses yt-dlp as a separate executable. yt-dlp is an independent
open-source project and is distributed under its own license. The upstream
project's licensing information is available at:

- https://github.com/yt-dlp/yt-dlp#licensing

The PyInstaller-bundled executables used for Windows and macOS include
GPLv3-or-later components. Malachite distributions include the exact upstream
license notices for the pinned yt-dlp release under `legal/yt-dlp/` and include
the pinned upstream source archive under `build/`.

## FFmpeg

Packaged Malachite builds include FFmpeg and FFprobe 8.1.2 as separate external
executables. They are invoked through an explicit application-controlled path and
are not linked into Malachite. Users of packaged builds do not need to install
FFmpeg separately.

The selected Windows x64, macOS Intel, and macOS Apple Silicon builds enable GPL
and version 3 components and are classified as `GPL-3.0-or-later`. They do not use
FFmpeg's nonfree configuration. Malachite's own license remains separately stated
in `LICENSE`.

The applicable GPLv3 text, exact provider URLs, source archive, build
configurations, architecture coverage, and SHA-256 hashes are included under
`legal/ffmpeg/` and `build/ffmpeg/source/`. See:

- https://ffmpeg.org/legal.html
- `legal/ffmpeg/BUILD_INFO.md`
- `legal/ffmpeg/COPYING.GPLv3`
- `build/ffmpeg/source/ffmpeg-8.1.2.tar.xz`

## JavaScript dependencies

Malachite's production renderer includes React and React DOM, distributed under
the MIT License. The required notice is included at
`legal/javascript/REACT-LICENSE`. Exact dependency versions are listed in
`package-lock.json`.
