# Changelog

## Unreleased

- Update the pinned yt-dlp executable and source archive from 2026.06.09 to 2026.08.19 for current YouTube client support.
- Bundle checksum-verified Node.js 24.20.0 LTS and explicitly configure yt-dlp to use its permission-restricted runtime for EJS challenge solving without global dependencies or remote EJS downloads.
- Add verbose, sanitized Activity Log diagnostics that redact signed media URLs, authentication headers, cookies, and user-profile paths.

## 1.0.1 - 2026-07-24

- Show specific guidance when YouTube asks users to verify they are not a bot, including the common VPN, proxy, and shared-network cause.
- Centralize download error classification for verification, missing FFmpeg, unsupported URLs, network failures, destination permissions, disk space, and unknown failures.
- Preserve complete yt-dlp stderr in the transient Activity Log without adding it to persistent history or telemetry.
