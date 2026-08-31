const os = require('os');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
    }
    if (/(?:^|\.)googlevideo\.com$/i.test(parsed.hostname)) {
      return `${parsed.origin}${parsed.pathname}?[redacted]`;
    }
    for (const name of new Set(parsed.searchParams.keys())) {
      parsed.searchParams.set(name, '[redacted]');
    }
    if (parsed.hash) parsed.hash = '[redacted]';
    return parsed.href;
  } catch {
    return value;
  }
}

function sanitizeYtDlpDiagnostics(value, { homeDirectory = os.homedir() } = {}) {
  let sanitized = String(value || '');
  sanitized = sanitized.replace(
    /\b(authorization|proxy-authorization|cookie|set-cookie)\s*:\s*[^\r\n]*/gi,
    '$1: [redacted]'
  );
  sanitized = sanitized.replace(/https?:\/\/[^\s"'<>]+/gi, sanitizeUrl);
  if (homeDirectory) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(homeDirectory), 'gi'), '%USERPROFILE%');
  }
  return sanitized;
}

module.exports = { sanitizeYtDlpDiagnostics };
