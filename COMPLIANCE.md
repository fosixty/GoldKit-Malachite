# Service Policy and Distribution Compliance

Last reviewed: July 22, 2026

This document records the project's compliance posture. It is not legal advice
and does not guarantee that every use is lawful or permitted by a website's terms.
Terms vary by service, user, location, and intended use, and can change over time.

## YouTube and Google services

YouTube's Terms of Service allow downloading only when the Service expressly
authorizes it or when YouTube and the applicable rights holder have given prior
written permission. The Terms also restrict automated access and interference
with features that prevent or limit copying or use of Content.

- YouTube Terms: https://www.youtube.com/static?template=terms
- Google Terms currently in effect: https://policies.google.com/terms
- Google Terms effective July 30, 2026: https://policies.google.com/terms/update

Google's general Terms additionally prohibit using its services to violate legal
rights, automated access contrary to machine-readable instructions, bypassing
protective measures, and providing services that encourage violations.

Malachite therefore:

- identifies itself as independent and uses no YouTube or Google branding;
- requires acceptance of a responsible-use notice;
- presents a separate confirmation for YouTube URLs stating the applicable
  authorization standard, unless the user explicitly confirms it and selects
  “Do not ask again”;
- does not accept browser cookies, account credentials, proxy settings,
  impersonation options, geo-bypass options, or arbitrary yt-dlp arguments;
- passes `--ignore-config` to prevent local yt-dlp configuration from adding those
  capabilities through Malachite; and
- disables playlists and accepts only public HTTP or HTTPS URLs.

These safeguards reduce misuse but cannot verify that a user actually has written
permission. Distributing or using Malachite is not an endorsement by YouTube or
Google. Anyone seeking assurance for a particular public release or use should
obtain advice from a qualified attorney.

## yt-dlp distribution

The yt-dlp source repository is released under the Unlicense. Its standalone
PyInstaller executables include separately licensed components, including
GPLv3-or-later components. The pinned release and its exact notices are:

- Release: https://github.com/yt-dlp/yt-dlp/releases/tag/2026.06.09
- Source license: `legal/yt-dlp/LICENSE`
- Compiled third-party notices: `legal/yt-dlp/THIRD_PARTY_LICENSES.txt`
- Pinned source archive: `build/yt-dlp-2026.06.09-source.tar.gz`

The build script verifies SHA-256 digests for both the executable and source
archive. Installers include these materials alongside the separate executable.
Release maintainers must preserve them and re-review the notices whenever the
pinned yt-dlp version changes.

## FFmpeg and FFprobe distribution

Packaged releases include verified FFmpeg and FFprobe 8.1.2 executables for
Windows x64 and for both macOS x64 and arm64. They are external resources and are
located through a fixed application-controlled path. Production builds never
fall back to system PATH executables.

The builds enable GPL and version 3 components and are therefore distributed as
`GPL-3.0-or-later`; no nonfree FFmpeg build is used. Exact archive and executable
hashes, configurations, providers, architectures, source information, and the
update process are recorded in `legal/ffmpeg/BUILD_INFO.md`. The official source
archive and GPLv3 terms are included in packaged releases.

## Malachite license choice

Malachite uses `GPL-3.0-or-later`. This is a conservative compatibility choice for
an application distributed alongside yt-dlp's GPLv3-or-later PyInstaller builds.
It also ensures recipients can inspect, modify, and redistribute Malachite under
the same copyleft baseline.

YouTube and Google do not approve Malachite or require this license. An open-source
license governs Malachite's code; it does not override service terms, copyright,
privacy rights, trademarks, or anti-circumvention law.

## Release checklist

Before each public binary release:

1. Run `npm ci`, `npm test`, and `npm audit`.
2. Run `npm run fetch-ytdlp` and `npm run fetch-ffmpeg`; verify every pinned
   binary, archive, and source hash.
3. Confirm the installer contains `LICENSE`, `LEGAL.md`, `COMPLIANCE.md`,
   `THIRD_PARTY_NOTICES.md`, the exact yt-dlp notices, FFmpeg build information,
   applicable license texts, and both source archives.
4. Re-review YouTube, Google, yt-dlp, FFmpeg, and dependency terms for changes.
5. Sign the Windows release and sign and notarize the macOS release.

The `dist`, `dist:win`, and `dist:mac` scripts run the verifier automatically
before packaging, but release maintainers remain responsible for reviewing the
resulting artifact.
