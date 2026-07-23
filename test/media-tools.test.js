const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  MediaToolsError,
  resolveMediaTools,
  validateToolDirectory,
} = require('../electron/media-tools');
const {
  ARCHIVES,
  FFMPEG_VERSION,
  PLATFORM_ASSETS,
  SOURCE_ASSET,
  getPlatformKeys,
} = require('../scripts/ffmpeg-assets');
const { terminateProcessTree } = require('../electron/process-control');
const { getSourceStagingPath } = require('../scripts/fetch-ffmpeg');

function writeMockBinary(filePath, platform, arch) {
  const header = Buffer.alloc(4096);
  if (platform === 'win32') {
    header.write('MZ', 0, 'ascii');
    header.writeUInt32LE(0x80, 0x3c);
    header.write('PE\0\0', 0x80, 'ascii');
    header.writeUInt16LE(0x8664, 0x84);
  } else {
    header.writeUInt32LE(0xfeedfacf, 0);
    header.writeUInt32LE(arch === 'arm64' ? 0x0100000c : 0x01000007, 4);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, header, { mode: 0o755 });
  fs.chmodSync(filePath, 0o755);
}

function createToolPair(root, platform, arch) {
  const directory = path.join(root, 'build', 'ffmpeg', `${platform}-${arch}`);
  const suffix = platform === 'win32' ? '.exe' : '';
  writeMockBinary(path.join(directory, `ffmpeg${suffix}`), platform, arch);
  writeMockBinary(path.join(directory, `ffprobe${suffix}`), platform, arch);
  return directory;
}

test('packaged Windows resolves only the bundled x64 media tools with spaces in paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite packaged tools '));
  try {
    const expected = createToolPair(root, 'win32', 'x64');
    const tools = resolveMediaTools({
      isPackaged: true,
      resourcesPath: root,
      appPath: 'unused',
      platform: 'win32',
      arch: 'x64',
      environment: { MALACHITE_FFMPEG_DIR: 'C:\\untrusted', PATH: 'C:\\untrusted' },
    });
    assert.equal(tools.directory, expected);
    assert.equal(tools.ffmpeg, path.join(expected, 'ffmpeg.exe'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const arch of ['x64', 'arm64']) {
  test(`packaged macOS resolves its bundled ${arch} media tools`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `malachite-mac-${arch}-`));
    try {
      const expected = createToolPair(root, 'darwin', arch);
      const tools = resolveMediaTools({
        isPackaged: true,
        resourcesPath: root,
        appPath: 'unused',
        platform: 'darwin',
        arch,
        environment: {},
      });
      assert.equal(tools.directory, expected);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('development prefers an explicit absolute FFmpeg directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-explicit-tools-'));
  try {
    const directory = createToolPair(root, 'win32', 'x64');
    const messages = [];
    const tools = resolveMediaTools({
      isPackaged: false,
      resourcesPath: 'unused',
      appPath: path.join(root, 'different-app'),
      platform: 'win32',
      arch: 'x64',
      environment: { MALACHITE_FFMPEG_DIR: directory, PATH: '' },
      logger: { info: (message) => messages.push(message), warn: (message) => messages.push(message) },
    });
    assert.equal(tools.directory, directory);
    assert.match(messages.join('\n'), /explicitly configured development media tools/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missing, invalid, and unsupported media tools fail clearly', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-invalid-tools-'));
  try {
    assert.throws(
      () => validateToolDirectory(root, 'win32', 'x64'),
      (error) => error instanceof MediaToolsError && error.code === 'MISSING_MEDIA_TOOL'
    );
    fs.writeFileSync(path.join(root, 'ffmpeg.exe'), 'not an executable');
    fs.writeFileSync(path.join(root, 'ffprobe.exe'), 'not an executable');
    assert.throws(
      () => validateToolDirectory(root, 'win32', 'x64'),
      (error) => error instanceof MediaToolsError && error.code === 'WRONG_MEDIA_TOOL_ARCHITECTURE'
    );
    assert.throws(
      () => resolveMediaTools({
        isPackaged: true,
        resourcesPath: root,
        appPath: root,
        platform: 'win32',
        arch: 'arm64',
        environment: {},
      }),
      (error) => error instanceof MediaToolsError && error.code === 'UNSUPPORTED_ARCHITECTURE'
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('FFmpeg archives, binaries, source, architectures, and licenses are pinned', () => {
  assert.equal(FFMPEG_VERSION, '8.1.2');
  assert.deepEqual(getPlatformKeys('darwin', 'x64', true), ['darwin-x64', 'darwin-arm64']);
  assert.deepEqual(getPlatformKeys('win32', 'x64'), ['win32-x64']);
  assert.throws(() => getPlatformKeys('win32', 'arm64'));

  for (const archive of Object.values(ARCHIVES)) {
    assert.match(archive.url, /^https:\/\//);
    assert.match(archive.sha256, /^[a-f0-9]{64}$/);
  }
  for (const asset of Object.values(PLATFORM_ASSETS)) {
    assert.equal(asset.license, 'GPL-3.0-or-later');
    for (const tool of Object.values(asset.tools)) {
      assert.match(tool.sha256, /^[a-f0-9]{64}$/);
      assert.ok(ARCHIVES[tool.archive]);
    }
  }
  assert.match(SOURCE_ASSET.url, /ffmpeg-8\.1\.2\.tar\.xz$/);
  assert.match(SOURCE_ASSET.sha256, /^[a-f0-9]{64}$/);
});

test('FFmpeg source is staged on the destination filesystem before rename', () => {
  const destination = path.join('D:', 'checkout', 'build', 'ffmpeg', 'source', SOURCE_ASSET.filename);
  const stagingPath = getSourceStagingPath(destination, 4242);

  assert.equal(path.dirname(stagingPath), path.dirname(destination));
  assert.match(path.basename(stagingPath), /^\.ffmpeg-8\.1\.2\.tar\.xz\.4242\.tmp$/);
});

test('packaging includes external FFmpeg resources and process spawning never enables a shell', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );
  const buildResource = packageJson.build.extraResources.find((item) => item.from === 'build');
  assert.ok(buildResource.filter.includes('ffmpeg/source/**/*'));
  assert.ok(
    packageJson.build.win.extraResources.some(
      (item) => item.from === 'build/ffmpeg/win32-x64'
    )
  );
  assert.ok(
    packageJson.build.mac.extraResources.some(
      (item) => item.from === 'build/ffmpeg/darwin-x64'
    )
  );
  assert.ok(
    packageJson.build.mac.extraResources.some(
      (item) => item.from === 'build/ffmpeg/darwin-arm64'
    )
  );
  assert.equal(
    packageJson.build.mac.x64ArchFiles,
    'Contents/Resources/build/ffmpeg/**/*'
  );

  const runnerSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ytdlp.js'), 'utf8');
  assert.doesNotMatch(runnerSource, /shell:\s*true/);
  assert.match(runnerSource, /shell:\s*false/);
});

test('cancellation terminates the Windows yt-dlp and FFmpeg process tree without a shell', () => {
  const calls = [];
  let errorHandler;
  let fallbackKilled = false;
  const child = { pid: 4242, kill: () => { fallbackKilled = true; } };

  const result = terminateProcessTree(child, {
    platform: 'win32',
    spawnProcess: (executable, args, options) => {
      calls.push({ executable, args, options });
      return { on: (event, handler) => { if (event === 'error') errorHandler = handler; } };
    },
  });

  assert.equal(result, true);
  assert.deepEqual(calls, [{
    executable: 'taskkill.exe',
    args: ['/pid', '4242', '/T', '/F'],
    options: { stdio: 'ignore', windowsHide: true, shell: false },
  }]);
  assert.equal(fallbackKilled, false);
  errorHandler();
  assert.equal(fallbackKilled, true);
});

test('cancellation targets the detached Unix process group', () => {
  const signals = [];
  let fallbackKilled = false;
  const child = { pid: 73, kill: () => { fallbackKilled = true; } };

  terminateProcessTree(child, {
    platform: 'darwin',
    killProcess: (pid, signal) => signals.push({ pid, signal }),
  });

  assert.deepEqual(signals, [{ pid: -73, signal: 'SIGTERM' }]);
  assert.equal(fallbackKilled, false);
});
