const fs = require('fs');
const net = require('net');
const path = require('path');

const ALLOWED_FORMATS = new Set(['audio', '720p', '1080p', 'best']);
const MAX_URL_LENGTH = 8192;
const YOUTUBE_HOSTNAMES = new Set([
  'googlevideo.com',
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
]);

function isYouTubeUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return [...YOUTUBE_HOSTNAMES].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('::ffff:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff')
  );
}

function normalizeDownloadUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) {
    throw new Error('A valid URL is required');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('The URL is invalid');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error('URLs containing credentials are not allowed');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local network URLs are not allowed');
  }

  const ipVersion = net.isIP(hostname.replace(/^\[|\]$/g, ''));
  if (
    (ipVersion === 4 && isPrivateIpv4(hostname)) ||
    (ipVersion === 6 && isPrivateIpv6(hostname))
  ) {
    throw new Error('Local network URLs are not allowed');
  }

  return parsed.href;
}

function canonicalizeDirectory(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 32767) {
    throw new Error('A valid output directory is required');
  }

  const resolved = path.resolve(value);
  const canonical = fs.realpathSync.native(resolved);
  if (!fs.statSync(canonical).isDirectory()) {
    throw new Error('The output path must be a directory');
  }
  return canonical;
}

function directoryKey(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function validateDownloadOptions(payload, authorizedDirectories) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid download options');
  }

  const url = normalizeDownloadUrl(payload.url);
  if (!ALLOWED_FORMATS.has(payload.format)) {
    throw new Error('The selected format is invalid');
  }

  let outputDir;
  try {
    outputDir = canonicalizeDirectory(payload.outputDir);
  } catch {
    throw new Error('The output directory is unavailable');
  }

  if (!authorizedDirectories.has(directoryKey(outputDir))) {
    throw new Error('Choose the output directory using the directory picker');
  }

  return { url, outputDir, format: payload.format };
}

module.exports = {
  ALLOWED_FORMATS,
  canonicalizeDirectory,
  directoryKey,
  isYouTubeUrl,
  normalizeDownloadUrl,
  validateDownloadOptions,
};
