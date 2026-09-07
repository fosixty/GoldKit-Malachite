const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const unzipper = require('unzipper');

const { NODE_ASSETS, NODE_VERSION, getNodePlatformKeys } = require('./node-assets');

const BUILD_DIR = path.join(__dirname, '..', 'build', 'node');
const MAX_ARCHIVE_BYTES = 80 * 1024 * 1024;
const MAX_EXECUTABLE_BYTES = 150 * 1024 * 1024;
const ALLOWED_DOWNLOAD_HOSTS = new Set(['nodejs.org']);

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function hashesMatch(actual, expected) {
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function download(url, destination, redirectsRemaining = 5) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.has(target.hostname)) {
      reject(new Error(`Refusing Node.js download from untrusted host: ${target.hostname}`));
      return;
    }

    const request = https.get(target, { headers: { 'User-Agent': 'Malachite-build-script' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirectsRemaining === 0) {
          reject(new Error('Node.js download failed: too many redirects'));
          return;
        }
        download(new URL(response.headers.location, target).href, destination, redirectsRemaining - 1)
          .then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Node.js download failed: HTTP ${response.statusCode}`));
        return;
      }

      const declaredLength = Number(response.headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_ARCHIVE_BYTES) {
        response.destroy();
        reject(new Error('Node.js download failed: archive is too large'));
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
        if (received > MAX_ARCHIVE_BYTES) fail(new Error('Node.js download failed: archive is too large'));
      });
      response.on('error', fail);
      output.on('error', fail);
      output.on('finish', () => output.close(resolve));
      response.pipe(output);
    });
    request.on('error', reject);
  });
}

async function extractZipEntry(archivePath, asset, temporaryDestination) {
  const archive = await unzipper.Open.file(archivePath);
  const matches = archive.files.filter(
    (entry) => entry.type === 'File' && entry.path.replaceAll('\\', '/') === asset.entry
  );
  if (matches.length !== 1 || matches[0].uncompressedSize > MAX_EXECUTABLE_BYTES) {
    throw new Error(`Node.js archive does not contain the expected ${asset.entry}`);
  }
  await pipeline(
    matches[0].stream(),
    fs.createWriteStream(temporaryDestination, { flags: 'wx', mode: 0o755 })
  );
}

function extractTarEntry(archivePath, asset, temporaryDestination) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(temporaryDestination, { flags: 'wx', mode: 0o755 });
    const child = spawn('tar', ['-xOf', archivePath, asset.entry], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let received = 0;
    let stderr = '';
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };
    child.stdout.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_EXECUTABLE_BYTES) {
        child.kill();
        output.destroy();
        finish(new Error('Extracted Node.js executable is too large'));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4096);
    });
    child.on('error', (error) => {
      output.destroy();
      finish(error);
    });
    output.on('error', (error) => {
      child.kill();
      finish(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        output.destroy();
        finish(new Error(`Could not extract Node.js (${code}): ${stderr.trim()}`));
        return;
      }
      output.end(() => finish());
    });
    child.stdout.pipe(output, { end: false });
  });
}

async function extractVerifiedExecutable(archivePath, asset, destination) {
  const temporaryDestination = `${destination}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    if (asset.type === 'zip') {
      await extractZipEntry(archivePath, asset, temporaryDestination);
    } else {
      await extractTarEntry(archivePath, asset, temporaryDestination);
    }
    const actualHash = sha256File(temporaryDestination);
    if (!hashesMatch(actualHash, asset.executableSha256)) {
      throw new Error(`Checksum mismatch for extracted ${asset.executable}`);
    }
    if (fs.existsSync(destination)) fs.rmSync(destination);
    fs.renameSync(temporaryDestination, destination);
    if (process.platform !== 'win32') fs.chmodSync(destination, 0o755);
  } finally {
    if (fs.existsSync(temporaryDestination)) fs.rmSync(temporaryDestination);
  }
}

async function installNode({
  platform = process.platform,
  arch = process.arch,
  allDarwin = false,
} = {}) {
  const platformKeys = getNodePlatformKeys(platform, arch, allDarwin);
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-node-'));
  console.log(`Preparing pinned Node.js ${NODE_VERSION}: ${platformKeys.join(', ')}`);

  try {
    for (const platformKey of platformKeys) {
      const asset = NODE_ASSETS[platformKey];
      const destination = path.join(BUILD_DIR, platformKey, asset.executable);
      if (fs.existsSync(destination) && hashesMatch(sha256File(destination), asset.executableSha256)) {
        if (!platformKey.startsWith('win32-')) fs.chmodSync(destination, 0o755);
        console.log(`Verified existing build/node/${platformKey}/${asset.executable}`);
        continue;
      }

      const archivePath = path.join(temporaryDirectory, asset.archive);
      await download(asset.url, archivePath);
      if (!hashesMatch(sha256File(archivePath), asset.archiveSha256)) {
        throw new Error(`Checksum mismatch for ${asset.archive}`);
      }
      await extractVerifiedExecutable(archivePath, asset, destination);
      console.log(`Verified SHA-256 ${asset.executableSha256}`);
    }
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  installNode({ allDarwin: process.argv.includes('--all-darwin') }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { ALLOWED_DOWNLOAD_HOSTS, BUILD_DIR, installNode, sha256File };
