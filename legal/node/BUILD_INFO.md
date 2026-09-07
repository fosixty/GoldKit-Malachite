# Bundled Node.js runtime

Malachite bundles only the Node.js executable from the official Node.js 24.20.0
LTS binary archives. npm, Corepack, headers, documentation, and global modules are
not included. yt-dlp receives the executable through an absolute
`--js-runtimes node:<path>` argument; Malachite never resolves it through `PATH`.

Upstream release and integrity manifest:

- https://nodejs.org/dist/v24.20.0/
- https://nodejs.org/dist/v24.20.0/SHASUMS256.txt
- https://github.com/nodejs/node/blob/v24.20.0/LICENSE

## Pinned assets

| Target | Official archive SHA-256 | Extracted executable SHA-256 | Executable bytes |
| --- | --- | --- | ---: |
| Windows x64 | `6cac9ffbca8f6a47091e4b5c772e0606049c3871cb67d900c0cedde630e545ba` | `5c976096e04e5c2c1f091938926234cc9fbebfe9787ddd149351b3b0ecc707b5` | 93,381,448 |
| macOS x64 | `26fc30891004603d094eed11de5efcd03bbd2efbc35c177fc72648d5d7a7701b` | `bb37f3a05d1104a9ca2488718a32ff07f3d0725b7b7b6a04bb26a5af7213fe12` | 124,285,824 |
| macOS arm64 | `b7bf7707070b950ba1ec5f1af3bb6de0f2b1962c5033973d94068ab021ef3014` | `9d050fd455b56426e25d4d603c7c501cbb2630348e836cf221dcce748e90588a` | 121,911,744 |
| Linux x64 development | `2f2c0da162318f0de47665410c7c8c2ed3d36c8f3105de4bbc61176c70a7cbf2` | `89af8424dd53e560b1933f87ba650d8bf57c83ca5a04600eefb31f416aabbae7` | 126,458,664 |

The archive and executable values are enforced in `scripts/node-assets.js` and
`scripts/fetch-node.js`. The archive hashes match Node.js's official
`SHASUMS256.txt`; the executable hashes additionally make an altered or partial
local runtime fail verification on later builds.

## License and notices

Each official Node.js binary archive contains a root `LICENSE` file combining
the Node.js MIT license with licenses and copyright notices for externally
maintained libraries incorporated into Node.js. `legal/node/LICENSE` is the exact
LF-form file from the official 24.20.0 macOS archives. Its SHA-256 is
`5888dbb9a1d2b18f2c3e6c5f6af1b39de658372b402a0577b002777f14c62ace`.
The Windows archive contains the same content with CRLF line endings.

When updating Node.js, replace this file from the same pinned official release,
review changes to all incorporated-component notices, update every archive and
executable hash, and re-run the packaged-resource tests.

## Runtime restrictions

yt-dlp 2026.08.19 supports Node.js 22 or newer. Its built-in Node EJS provider
invokes Node.js 24.20.0 as `node --permission -`, sends the solver program through
stdin, and captures stdout/stderr. No filesystem, network, child-process, worker,
native-addon, WASI, FFI, or inspector permission is granted. The official yt-dlp
executables bundle the matching yt-dlp-ejs 0.8.0 scripts, so Malachite does not
enable npm or GitHub remote EJS components.

Node.js describes its permission model as a defense against accidental access by
trusted code, not as a security boundary against malicious code. Malachite must
therefore continue to pin and update both yt-dlp and Node.js and must not enable
untrusted EJS component sources.
