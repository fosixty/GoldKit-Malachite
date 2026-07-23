const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const YT_DLP_VERSION = '2026.06.09';
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
    sha256: '3a48cb955d55c8821b60ccbdbbc6f61bc958f2f3d3b7ad5eaf3d83a543293a27',
  },
  darwin: {
    url: `${RELEASE_BASE}/yt-dlp_macos`,
    filename: 'yt-dlp',
    sha256: 'b82c3626952e6c14eaf654cc565866775ffd0b9ffb7021628ac59b42c2f4f244',
  },
  linux: {
    url: `${RELEASE_BASE}/yt-dlp`,
    filename: 'yt-dlp',
    sha256: 'e5d57466682cfa9d61e9cf7c8a4f09b00f4a62af37d3bbdc4bcffdf63615feac',
  },
};
const SOURCE_ASSET = {
  url: `${RELEASE_BASE}/yt-dlp.tar.gz`,
  filename: `yt-dlp-${YT_DLP_VERSION}-source.tar.gz`,
  sha256: '7603f876b78d08b5fdd5bcd1d368590fde22c3c18e4ea00766d51120d21cc679',
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
