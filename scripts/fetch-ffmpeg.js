const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const unzipper = require('unzipper');

const {
  ARCHIVES,
  FFMPEG_VERSION,
  PLATFORM_ASSETS,
  SOURCE_ASSET,
  getPlatformKeys,
} = require('./ffmpeg-assets');

const BUILD_DIR = path.join(__dirname, '..', 'build', 'ffmpeg');
const MAX_DOWNLOAD_BYTES = 160 * 1024 * 1024;
const MAX_BINARY_BYTES = 130 * 1024 * 1024;
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'ffmpeg.martin-riedl.de',
  'ffmpeg.org',
  'www.gyan.dev',
]);

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function hashesMatch(actual, expected) {
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function download(url, destination, redirectsRemaining = 5) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.has(target.hostname)) {
      reject(new Error(`Refusing download from untrusted host: ${target.hostname}`));
      return;
    }

    const request = https.get(
      target,
      { headers: { 'User-Agent': 'Malachite-build-script' } },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          if (redirectsRemaining === 0) {
            reject(new Error('FFmpeg download failed: too many redirects'));
            return;
          }
          download(new URL(response.headers.location, target).href, destination, redirectsRemaining - 1)
            .then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`FFmpeg download failed: HTTP ${response.statusCode}`));
          return;
        }

        const declaredLength = Number(response.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_DOWNLOAD_BYTES) {
          response.destroy();
          reject(new Error('FFmpeg download failed: archive is too large'));
          return;
        }

        let received = 0;
        const output = fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 });
        const fail = (error) => {
          response.destroy();
          output.destroy();
          reject(error);
        };

        response.on('data', (chunk) => {
          received += chunk.length;
          if (received > MAX_DOWNLOAD_BYTES) {
            fail(new Error('FFmpeg download failed: archive is too large'));
          }
        });
        response.on('error', fail);
        output.on('error', fail);
        output.on('finish', () => output.close(resolve));
        response.pipe(output);
      }
    );
    request.on('error', reject);
  });
}

async function downloadVerified(asset, destination) {
  await download(asset.url, destination);
  const actualHash = sha256File(destination);
  if (!hashesMatch(actualHash, asset.sha256)) {
    throw new Error(`Checksum mismatch for ${path.basename(asset.url)}`);
  }
}

async function extractVerifiedEntry(archivePath, tool, destination, executable) {
  const archive = await unzipper.Open.file(archivePath);
  const matches = archive.files.filter((entry) => entry.type === 'File' && entry.path === tool.entry);
  if (matches.length !== 1 || matches[0].uncompressedSize > MAX_BINARY_BYTES) {
    throw new Error(`FFmpeg archive does not contain the expected ${tool.entry}`);
  }

  const tempDestination = `${destination}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    await pipeline(
      matches[0].stream(),
      fs.createWriteStream(tempDestination, { flags: 'wx', mode: executable ? 0o755 : 0o600 })
    );
    const actualHash = sha256File(tempDestination);
    if (!hashesMatch(actualHash, tool.sha256)) {
      throw new Error(`Checksum mismatch for extracted ${tool.filename}`);
    }
    if (fs.existsSync(destination)) {
      fs.rmSync(destination);
    }
    fs.renameSync(tempDestination, destination);
    if (executable && process.platform !== 'win32') {
      fs.chmodSync(destination, 0o755);
    }
  } finally {
    if (fs.existsSync(tempDestination)) {
      fs.rmSync(tempDestination);
    }
  }
}

function verifiedToolExists(platformKey, tool) {
  const destination = path.join(BUILD_DIR, platformKey, tool.filename);
  const verified = fs.existsSync(destination) && hashesMatch(sha256File(destination), tool.sha256);
  if (verified && !platformKey.startsWith('win32-')) {
    fs.chmodSync(destination, 0o755);
  }
  return verified;
}

async function ensureSource(tempDirectory) {
  const sourceDirectory = path.join(BUILD_DIR, 'source');
  const destination = path.join(sourceDirectory, SOURCE_ASSET.filename);
  if (fs.existsSync(destination) && hashesMatch(sha256File(destination), SOURCE_ASSET.sha256)) {
    return;
  }

  const temporarySource = path.join(tempDirectory, SOURCE_ASSET.filename);
  await downloadVerified(SOURCE_ASSET, temporarySource);
  fs.mkdirSync(sourceDirectory, { recursive: true });
  if (fs.existsSync(destination)) {
    fs.rmSync(destination);
  }
  fs.renameSync(temporarySource, destination);
}

async function installFfmpeg({
  platform = process.platform,
  arch = process.arch,
  allDarwin = false,
} = {}) {
  const platformKeys = getPlatformKeys(platform, arch, allDarwin);
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-ffmpeg-'));
  const downloadedArchives = new Map();

  console.log(`Preparing pinned FFmpeg and FFprobe ${FFMPEG_VERSION}: ${platformKeys.join(', ')}`);
  try {
    await ensureSource(tempDirectory);

    for (const platformKey of platformKeys) {
      const asset = PLATFORM_ASSETS[platformKey];
      for (const tool of Object.values(asset.tools)) {
        if (verifiedToolExists(platformKey, tool)) {
          console.log(`Verified existing build/ffmpeg/${platformKey}/${tool.filename}`);
          continue;
        }

        let archivePath = downloadedArchives.get(tool.archive);
        if (!archivePath) {
          const archive = ARCHIVES[tool.archive];
          archivePath = path.join(tempDirectory, `${tool.archive}.zip`);
          console.log(`Downloading verified ${tool.archive} archive`);
          await downloadVerified(archive, archivePath);
          downloadedArchives.set(tool.archive, archivePath);
        }

        const destination = path.join(BUILD_DIR, platformKey, tool.filename);
        await extractVerifiedEntry(archivePath, tool, destination, true);
        console.log(`Verified SHA-256 ${tool.sha256}`);
      }
    }
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  installFfmpeg({ allDarwin: process.argv.includes('--all-darwin') }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  ALLOWED_DOWNLOAD_HOSTS,
  BUILD_DIR,
  installFfmpeg,
  sha256File,
};
