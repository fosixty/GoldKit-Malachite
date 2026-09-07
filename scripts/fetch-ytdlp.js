const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const YT_DLP_VERSION = '2026.08.19';
const RELEASE_BASE = `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}`;
const BUILD_DIR = path.join(__dirname, '..', 'build');
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'release-assets.githubusercontent.com',
]);

const ASSETS = {
  win32: {
    url: `${RELEASE_BASE}/yt-dlp.exe`,
    filename: 'yt-dlp.exe',
    sha256: '66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a',
  },
  darwin: {
    url: `${RELEASE_BASE}/yt-dlp_macos`,
    filename: 'yt-dlp',
    sha256: '0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202',
  },
  linux: {
    url: `${RELEASE_BASE}/yt-dlp`,
    filename: 'yt-dlp',
    sha256: '1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6',
  },
};
const SOURCE_ASSET = {
  url: `${RELEASE_BASE}/yt-dlp.tar.gz`,
  filename: `yt-dlp-${YT_DLP_VERSION}-source.tar.gz`,
  sha256: '072aad4f2a7604e92155f61a275a4752dc64046c8f6d90df3710525d94cd37c1',
};

function download(url, dest, redirectsRemaining = 5) {
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
            reject(new Error('Download failed: too many redirects'));
            return;
          }
          const nextUrl = new URL(response.headers.location, target).href;
          download(nextUrl, dest, redirectsRemaining - 1).then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }

        const declaredLength = Number(response.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_DOWNLOAD_BYTES) {
          response.destroy();
          reject(new Error('Download failed: file is too large'));
          return;
        }

        let received = 0;
        const file = fs.createWriteStream(dest, { flags: 'wx', mode: 0o600 });
        const fail = (error) => {
          response.destroy();
          file.destroy();
          reject(error);
        };

        response.on('data', (chunk) => {
          received += chunk.length;
          if (received > MAX_DOWNLOAD_BYTES) {
            fail(new Error('Download failed: file is too large'));
          }
        });
        response.on('error', fail);
        file.on('error', fail);
        file.on('finish', () => file.close(resolve));
        response.pipe(file);
      }
    );
    request.on('error', reject);
  });
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function installVerifiedAsset(asset, executable = false) {
  const dest = path.join(BUILD_DIR, asset.filename);
  if (fs.existsSync(dest) && sha256File(dest) === asset.sha256) {
    if (executable && process.platform !== 'win32') {
      fs.chmodSync(dest, 0o755);
    }
    console.log(`Verified existing ${asset.filename}`);
    return;
  }

  const tempDest = `${dest}.${process.pid}.download`;
  console.log(`Downloading ${asset.filename} -> ${dest}`);

  try {
    await download(asset.url, tempDest);
    const actualHash = sha256File(tempDest);
    if (!crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(asset.sha256))) {
      throw new Error(`Checksum mismatch for ${asset.filename}`);
    }

    if (fs.existsSync(dest)) {
      fs.rmSync(dest);
    }
    fs.renameSync(tempDest, dest);
  } finally {
    if (fs.existsSync(tempDest)) {
      fs.rmSync(tempDest);
    }
  }

  if (executable && process.platform !== 'win32') {
    fs.chmodSync(dest, 0o755);
  }

  console.log(`Verified SHA-256 ${asset.sha256}`);
}

async function installYtDlp() {
  const asset = ASSETS[process.platform];
  if (!asset) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  console.log(`Preparing pinned yt-dlp ${YT_DLP_VERSION}`);
  await installVerifiedAsset(asset, true);
  await installVerifiedAsset(SOURCE_ASSET);
  console.log('Done.');
}

if (require.main === module) {
  installYtDlp().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = {
  ASSETS,
  SOURCE_ASSET,
  YT_DLP_VERSION,
  download,
  installYtDlp,
  sha256File,
};
