const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalizeDirectory,
  directoryKey,
  isYouTubeUrl,
  normalizeDownloadUrl,
  validateDownloadOptions,
} = require('../electron/validation');
const { buildArgs, compatibleMp4Format } = require('../electron/ytdlp-args');
const {
  MAX_TRANSIENT_YOUTUBE_MEDIA_RETRIES,
  shouldRetryYouTubeMediaDownload,
} = require('../electron/ytdlp-retry');
const { createTextContextMenuTemplate } = require('../electron/text-context-menu');
const { ASSETS, SOURCE_ASSET, YT_DLP_VERSION } = require('../scripts/fetch-ytdlp');
const { NODE_ASSETS, NODE_VERSION, getNodePlatformKeys } = require('../scripts/node-assets');
const { sanitizeYtDlpDiagnostics } = require('../electron/ytdlp-diagnostics');
const {
  LEGAL_NOTICE_DETAIL,
  LEGAL_NOTICE_VERSION,
  disableYouTubeAuthorizationPrompt,
  getAcceptancePath,
  getYouTubeAuthorizationPreferencePath,
  hasDisabledYouTubeAuthorizationPrompt,
  hasAcceptedLegalNotice,
  recordLegalNoticeAcceptance,
} = require('../electron/legal');

test('accepts and normalizes public HTTP(S) URLs', () => {
  assert.equal(
    normalizeDownloadUrl('https://www.youtube.com/watch?v=abc'),
    'https://www.youtube.com/watch?v=abc'
  );
  assert.equal(normalizeDownloadUrl('http://example.com/video'), 'http://example.com/video');
});

test('editable fields provide a native paste context-menu action', () => {
  const template = createTextContextMenuTemplate({
    canCopy: true,
    canPaste: true,
    canSelectAll: true,
  });
  const paste = template.find((item) => item.role === 'paste');

  assert.deepEqual(paste, { role: 'paste', enabled: true });
  assert.equal(template.find((item) => item.role === 'cut').enabled, false);
});

test('rejects option injection, credentials, and local network targets', () => {
  const rejected = [
    '--exec=calc',
    'file:///etc/passwd',
    'https://user:password@example.com/video',
    'http://localhost/video',
    'http://127.0.0.1/video',
    'http://10.0.0.1/video',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/video',
    'http://[::ffff:127.0.0.1]/video',
    'http://[fd00::1]/video',
  ];

  for (const url of rejected) {
    assert.throws(() => normalizeDownloadUrl(url), url);
  }
});

test('download options require an allowlisted format and picker-authorized directory', () => {
  const directory = canonicalizeDirectory(process.cwd());
  const authorizedDirectories = new Set([directoryKey(directory)]);

  assert.deepEqual(
    validateDownloadOptions(
      { url: 'https://example.com/video', outputDir: directory, format: 'audio' },
      authorizedDirectories
    ),
    { url: 'https://example.com/video', outputDir: directory, format: 'audio' }
  );
  assert.throws(() =>
    validateDownloadOptions(
      { url: 'https://example.com/video', outputDir: directory, format: '--exec' },
      authorizedDirectories
    )
  );

  const unauthorized = new Set();
  assert.throws(() =>
    validateDownloadOptions(
      { url: 'https://example.com/video', outputDir: directory, format: 'best' },
      unauthorized
    )
  );
});

test('yt-dlp arguments ignore config and terminate options before the URL', () => {
  const ffmpegLocation = path.join(process.cwd(), 'build', 'ffmpeg', 'win32-x64');
  const args = buildArgs({
    url: 'https://example.com/video',
    outputDir: fs.realpathSync.native(process.cwd()),
    format: 'audio',
    ffmpegLocation,
    nodePath: path.join(process.cwd(), 'build', 'node', 'win32-x64', 'node.exe'),
  });

  assert.equal(args[0], '--ignore-config');
  assert.equal(args[1], '--verbose');
  assert.deepEqual(args.slice(2, 5), [
    '--no-js-runtimes',
    '--js-runtimes',
    `node:${path.join(process.cwd(), 'build', 'node', 'win32-x64', 'node.exe')}`,
  ]);
  assert.deepEqual(args.slice(5, 7), ['--ffmpeg-location', ffmpegLocation]);
  assert.deepEqual(args.slice(7, 10), ['-x', '--audio-format', 'mp3']);
  assert.equal(args.at(-2), '--');
  assert.equal(args.at(-1), 'https://example.com/video');
  assert.throws(() =>
    buildArgs({
      url: 'https://example.com/video',
      outputDir: process.cwd(),
      format: '--exec',
      ffmpegLocation,
      nodePath: path.join(process.cwd(), 'node.exe'),
    })
  );
  assert.throws(() =>
    buildArgs({
      url: 'https://example.com/video',
      outputDir: process.cwd(),
      format: 'audio',
      ffmpegLocation: 'relative/path',
      nodePath: path.join(process.cwd(), 'node.exe'),
    })
  );
  assert.throws(() =>
    buildArgs({
      url: 'https://example.com/video',
      outputDir: process.cwd(),
      format: 'audio',
      ffmpegLocation,
      nodePath: 'relative/node.exe',
    })
  );
});

test('compatible video arguments prefer H.264 and M4A without transcoding', () => {
  const selector = compatibleMp4Format(1080);
  const args = buildArgs({
    url: 'https://example.com/video',
    outputDir: process.cwd(),
    format: '1080p',
    ffmpegLocation: path.join(process.cwd(), 'media tools'),
    nodePath: path.join(process.cwd(), 'runtime', 'node.exe'),
  });

  assert.match(selector, /vcodec\^=avc1/);
  assert.match(selector, /acodec\^=mp4a/);
  assert.match(selector, /b\[ext=mp4\]/);
  assert.match(selector, /bv\*\[height<=1080\]\+ba/);
  assert.deepEqual(args.slice(7, 9), ['-f', selector]);
  assert.equal(args.includes('--recode-video'), false);
  assert.equal(args.includes('--exec'), false);
});

test('video retries one transient YouTube media 403 without bypassing access controls', () => {
  const transientFailure = {
    url: 'https://www.youtube.com/watch?v=myee1ck_p8k',
    format: '720p',
    errorText: 'ERROR: unable to download video data: HTTP Error 403: Forbidden',
    retryCount: 0,
  };

  assert.equal(MAX_TRANSIENT_YOUTUBE_MEDIA_RETRIES, 1);
  assert.equal(shouldRetryYouTubeMediaDownload(transientFailure), true);
  assert.equal(
    shouldRetryYouTubeMediaDownload({
      ...transientFailure,
      retryCount: MAX_TRANSIENT_YOUTUBE_MEDIA_RETRIES,
    }),
    false
  );
  assert.equal(
    shouldRetryYouTubeMediaDownload({ ...transientFailure, format: 'audio' }),
    false
  );
  assert.equal(
    shouldRetryYouTubeMediaDownload({
      ...transientFailure,
      url: 'https://example.com/video',
    }),
    false
  );
  assert.equal(
    shouldRetryYouTubeMediaDownload({
      ...transientFailure,
      errorText: 'ERROR: This video is private',
    }),
    false
  );
});

test('yt-dlp build assets are pinned with SHA-256 hashes', () => {
  assert.match(YT_DLP_VERSION, /^\d{4}\.\d{2}\.\d{2}$/);
  for (const asset of Object.values(ASSETS)) {
    assert.match(asset.url, new RegExp(`/releases/download/${YT_DLP_VERSION}/`));
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  }
  assert.match(SOURCE_ASSET.url, new RegExp(`/releases/download/${YT_DLP_VERSION}/`));
  assert.match(SOURCE_ASSET.sha256, /^[a-f0-9]{64}$/);
});

test('Node.js runtime assets are pinned for every supported desktop target', () => {
  assert.match(NODE_VERSION, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(getNodePlatformKeys('darwin', 'x64', true), ['darwin-x64', 'darwin-arm64']);
  assert.deepEqual(getNodePlatformKeys('win32', 'x64'), ['win32-x64']);
  assert.throws(() => getNodePlatformKeys('win32', 'arm64'));
  for (const asset of Object.values(NODE_ASSETS)) {
    assert.match(asset.url, new RegExp(`/dist/v${NODE_VERSION}/`));
    assert.match(asset.archiveSha256, /^[a-f0-9]{64}$/);
    assert.match(asset.executableSha256, /^[a-f0-9]{64}$/);
    assert.match(asset.entry, new RegExp(`^node-v${NODE_VERSION.replaceAll('.', '\\.')}-.+/node(?:\\.exe)?$`));
  }

  const license = fs.readFileSync(path.join(__dirname, '..', 'legal', 'node', 'LICENSE'), 'utf8');
  assert.match(license, /The externally maintained libraries used by Node\.js are:/);
  assert.match(license, /- V8, located at deps\/v8/);
  assert.match(license, /- OpenSSL, located at deps\/openssl/);
  assert.match(license, /- ICU, located at deps\/icu-small/);
});

test('yt-dlp diagnostics redact signed media URLs, headers, and user profile paths', () => {
  const homeDirectory = 'C:\\Users\\Sensitive Name';
  const diagnostics = sanitizeYtDlpDiagnostics([
    '[debug] Invoking http downloader on "https://rr1.googlevideo.com/videoplayback?ip=1.2.3.4&sig=secret"',
    '[debug] CDN URL "https://cdn.example/video?X-Amz-Credential=user%2Fscope&X-Amz-Signature=secret#token"',
    'Authorization: Bearer secret',
    'Cookie: SID=secret',
    `Output: ${homeDirectory}\\Downloads\\example.mp4`,
  ].join('\n'), { homeDirectory });

  assert.match(diagnostics, /googlevideo\.com\/videoplayback\?\[redacted\]/);
  assert.match(diagnostics, /cdn\.example\/video\?X-Amz-Credential=%5Bredacted%5D&X-Amz-Signature=%5Bredacted%5D#\[redacted\]/);
  assert.doesNotMatch(diagnostics, /1\.2\.3\.4|user%2Fscope|Bearer secret|SID=secret|Sensitive Name|#token/);
  assert.match(diagnostics, /%USERPROFILE%\\Downloads/);
});

test('recognizes YouTube URLs without matching lookalike domains', () => {
  assert.equal(isYouTubeUrl('https://www.youtube.com/watch?v=abc'), true);
  assert.equal(isYouTubeUrl('https://music.youtube.com/watch?v=abc'), true);
  assert.equal(isYouTubeUrl('https://youtu.be/abc'), true);
  assert.equal(isYouTubeUrl('https://r1---sn.example.googlevideo.com/videoplayback'), true);
  assert.equal(isYouTubeUrl('https://www.youtube-nocookie.com/embed/abc'), true);
  assert.equal(isYouTubeUrl('https://youtube.com.example.org/video'), false);
  assert.equal(isYouTubeUrl('https://notyoutube.com/video'), false);
});

test('legal notice acceptance is versioned and persisted without content data', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-legal-'));
  try {
    assert.equal(hasAcceptedLegalNotice(directory), false);
    recordLegalNoticeAcceptance(directory);
    assert.equal(hasAcceptedLegalNotice(directory), true);
    recordLegalNoticeAcceptance(directory);

    const stored = JSON.parse(fs.readFileSync(getAcceptancePath(directory), 'utf8'));
    assert.equal(stored.acceptedVersion, LEGAL_NOTICE_VERSION);
    assert.match(stored.acceptedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(Object.keys(stored).sort(), ['acceptedAt', 'acceptedVersion']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('legal notice acceptance remains valid across notice and app updates', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-legal-old-'));

  try {
    fs.writeFileSync(
      getAcceptancePath(tempDirectory),
      JSON.stringify({ acceptedVersion: 1, acceptedAt: '2026-01-01T00:00:00.000Z' })
    );

    assert.equal(hasAcceptedLegalNotice(tempDirectory), true);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('YouTube authorization prompt preference is persisted without URL data', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-youtube-prompt-'));

  try {
    assert.equal(hasDisabledYouTubeAuthorizationPrompt(tempDirectory), false);
    disableYouTubeAuthorizationPrompt(tempDirectory);
    assert.equal(hasDisabledYouTubeAuthorizationPrompt(tempDirectory), true);

    const stored = JSON.parse(
      fs.readFileSync(getYouTubeAuthorizationPreferencePath(tempDirectory), 'utf8')
    );
    assert.equal(stored.doNotAskAgain, true);
    assert.match(stored.confirmedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(Object.keys(stored).sort(), ['confirmedAt', 'doNotAskAgain']);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('legal notice identifies dependencies and centers user responsibility', () => {
  assert.match(LEGAL_NOTICE_DETAIL, /independent graphical interface for yt-dlp/i);
  assert.match(LEGAL_NOTICE_DETAIL, /not affiliated with YouTube, Google, or the yt-dlp project/i);
  assert.match(LEGAL_NOTICE_DETAIL, /You are responsible for ensuring/i);
  assert.match(LEGAL_NOTICE_DETAIL, /website terms, licenses, privacy rights/i);
  assert.match(LEGAL_NOTICE_DETAIL, /including YouTube, restrict downloading/i);
});
