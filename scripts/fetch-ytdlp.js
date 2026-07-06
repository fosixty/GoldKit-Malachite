const fs = require('fs');
const path = require('path');
const https = require('https');

const RELEASE_BASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download';
const BUILD_DIR = path.join(__dirname, '..', 'build');

const ASSETS = {
  win32: { url: `${RELEASE_BASE}/yt-dlp.exe`, filename: 'yt-dlp.exe' },
  darwin: { url: `${RELEASE_BASE}/yt-dlp_macos`, filename: 'yt-dlp' },
  linux: { url: `${RELEASE_BASE}/yt-dlp`, filename: 'yt-dlp' },
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = (targetUrl) => {
      https
        .get(targetUrl, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            request(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            return;
          }

          response.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        })
        .on('error', reject);
    };

    request(url);
  });
}

async function main() {
  const platform = process.platform;
  const asset = ASSETS[platform];

  if (!asset) {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
  }

  fs.mkdirSync(BUILD_DIR, { recursive: true });

  const dest = path.join(BUILD_DIR, asset.filename);
  console.log(`Downloading ${asset.url} -> ${dest}`);

  await download(asset.url, dest);

  if (platform !== 'win32') {
    fs.chmodSync(dest, 0o755);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
