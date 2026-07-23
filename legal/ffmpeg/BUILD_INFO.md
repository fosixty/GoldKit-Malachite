# Bundled FFmpeg and FFprobe build information

Malachite bundles FFmpeg and FFprobe 8.1.2 as separate executables. They are not
part of Malachite's source code and remain subject to their own copyright and
license terms.

The selected builds use `--enable-gpl` and `--enable-version3`, so the complete
FFmpeg executables are distributed under `GPL-3.0-or-later`. They do not use
`--enable-nonfree`. This is compatible with Malachite's existing
`GPL-3.0-or-later` license; it does not change ownership of FFmpeg or its
third-party components.

The complete GPLv3 text is packaged as `legal/ffmpeg/COPYING.GPLv3`. FFmpeg's
official licensing explanation is at https://ffmpeg.org/legal.html.

## Binary inventory

| Target | Provider | Archive SHA-256 | FFmpeg SHA-256 | FFprobe SHA-256 |
|---|---|---|---|---|
| Windows x64 | Gyan Doshi release essentials | `db580001caa24ac104c8cb856cd113a87b0a443f7bdf47d8c12b1d740584a2ec` | `1326dde4c84ff1f96fe6b8916c5bed29e163e9b5dccf995f6f3db069d143ec5e` | `b49ccc7c6547b141ad5a2f6ec69cc04323d7133d7704d70b331b904c63eecb07` |
| macOS Intel x64 | Martin Riedl release build | FFmpeg: `a52ef43883f44c219766d4b3bdde4e635b35465d0b704c01c3a0566b59775df9`; FFprobe: `5408ca588c8c72b0dde3afe676d0a7acf25ef97e55ae6eba5c7bede1cda42695` | `1ca59dda73668c59898a0b305afd8a88817a989187f222ec62d64e775d614d23` | `bdb6aff0f1f414382effd97040f7862dc85e67996ac296cb4288beed0e06498f` |
| macOS Apple Silicon arm64 | Martin Riedl release build | FFmpeg: `ef1aa60006c7b77ce170c1608c08d8e4ba1c30c5746f2ac986ded932d0ac2c3c`; FFprobe: `c39787f4af7a3932502d2d48db6f6feaaa836b48a73ef78c32cc3285df61dfaf` | `eaf91238e104dd0e262bc6510e25061855cc99a6955a721b0ac99660d58c473d` | `ed9dc5871914b466b96b402c9ec0ba68ce4f836e72faa464b1b4e279835bd4a6` |

Pinned archives:

- Windows: https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-8.1.2-essentials_build.zip
- macOS x64 FFmpeg: https://ffmpeg.martin-riedl.de/download/macos/amd64/1783018342_8.1.2/ffmpeg.zip
- macOS x64 FFprobe: https://ffmpeg.martin-riedl.de/download/macos/amd64/1783018342_8.1.2/ffprobe.zip
- macOS arm64 FFmpeg: https://ffmpeg.martin-riedl.de/download/macos/arm64/1783011502_8.1.2/ffmpeg.zip
- macOS arm64 FFprobe: https://ffmpeg.martin-riedl.de/download/macos/arm64/1783011502_8.1.2/ffprobe.zip

FFmpeg lists Gyan's Windows builds and static macOS builds on its download page:
https://ffmpeg.org/download.html.

## Source and build configuration

The exact upstream source archive is packaged at
`build/ffmpeg/source/ffmpeg-8.1.2.tar.xz` and has SHA-256:

`464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c`

Upstream source: https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz

The source archive's detached signature was verified against the FFmpeg release
signing key fingerprint published by the FFmpeg project:

- Fingerprint: `FCF9 86EA 15E6 E293 A564 4F10 B432 2F04 D676 58D8`
- Signature date: 2026-06-16

The Windows build identifies FFmpeg source commit `38b88335f9` and reports:

```text
--enable-gpl --enable-version3 --enable-static --disable-w32threads
--disable-autodetect --enable-cairo --enable-fontconfig --enable-iconv
--enable-gnutls --enable-libxml2 --enable-gmp --enable-bzlib --enable-lzma
--enable-zlib --enable-libsrt --enable-libssh --enable-libzmq
--enable-avisynth --enable-sdl2 --enable-libwebp --enable-libx264
--enable-libx265 --enable-libxvid --enable-libaom --enable-libopenjpeg
--enable-libvpx --enable-mediafoundation --enable-libass --enable-libfreetype
--enable-libfribidi --enable-libharfbuzz --enable-libvidstab --enable-libvmaf
--enable-libzimg --enable-amf --enable-cuda-llvm --enable-cuvid --enable-dxva2
--enable-d3d11va --enable-d3d12va --enable-ffnvcodec --enable-libvpl
--enable-nvdec --enable-nvenc --enable-vaapi --enable-openal --enable-libgme
--enable-libopenmpt --enable-libopencore-amrwb --enable-libmp3lame
--enable-libtheora --enable-libvo-amrwbenc --enable-libgsm
--enable-libopencore-amrnb --enable-libopus --enable-libspeex
--enable-libvorbis --enable-librubberband
```

The macOS x64 and arm64 builds use the same feature configuration except for the
architecture-specific prefix:

```text
--pkg-config-flags=--static --enable-gray --enable-libxml2 --enable-version3
--enable-gpl --enable-openssl --enable-libfreetype --enable-fontconfig
--enable-libharfbuzz --enable-libsnappy --enable-libsrt --enable-libvmaf
--enable-libass --enable-libklvanc --enable-libzimg --enable-libzvbi
--enable-libaom --enable-libdav1d --enable-libopenh264 --enable-libopenjpeg
--enable-librav1e --enable-libsvtav1 --enable-libvpx --enable-libvvenc
--enable-libwebp --enable-libx264 --enable-libx265 --enable-libmp3lame
--enable-libopus --enable-libvorbis --enable-libtheora
```

The macOS build script and dependency manifests are available at commit
`bb1d6db29c` in https://git.martin-riedl.de/ffmpeg/build-script. Gyan's package
README, component versions, and source commit are included in its archive and
documented at https://www.gyan.dev/ffmpeg/builds/.

Release maintainers must preserve the exact source and build information needed
to satisfy GPL corresponding-source obligations for FFmpeg and all statically
linked components. Obtain legal review before relying on external source links
as the sole distribution method.

## Updating

1. Select fixed-version, non-`nonfree` builds for every supported architecture.
2. Review each reported configuration and license classification.
3. Update URLs and archive hashes in `scripts/ffmpeg-assets.js`.
4. Extract only the named FFmpeg and FFprobe entries, calculate their SHA-256
   hashes, and update the same manifest.
5. Update the official source archive and hash.
6. Run `npm run fetch-ffmpeg`, `npm test`, packaged builds, and clean-machine
   MP3/MP4 smoke tests on Windows, macOS Intel, and macOS Apple Silicon.
7. Re-review this notice and the complete corresponding-source bundle.
