const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_HISTORY = 50;

function getHistoryPath() {
  return path.join(app.getPath('userData'), 'history.json');
}

function readHistory() {
  const filePath = getHistoryPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(data) ? data : [];
    }
  } catch {
    // ignore corrupt history
  }
  return [];
}

function writeHistory(entries) {
  const filePath = getHistoryPath();
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(entries, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  fs.renameSync(tempPath, filePath);
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'music.youtube.com') {
      const videoId = parsed.searchParams.get('v');
      parsed.search = videoId ? `?v=${encodeURIComponent(videoId)}` : '';
    } else {
      parsed.search = '';
    }

    return parsed.href;
  } catch {
    return '';
  }
}

function createEntry({ url, format, outputDir }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url: sanitizeUrl(url),
    format,
    destinationName: typeof outputDir === 'string' ? path.basename(outputDir) : null,
    title: null,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

function addHistoryEntry(entry) {
  const history = readHistory();
  const newEntry = createEntry(entry);
  history.unshift(newEntry);
  writeHistory(history.slice(0, MAX_HISTORY));
  return newEntry;
}

function updateHistoryEntry(id, updates) {
  const history = readHistory();
  const index = history.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const safeUpdates = { ...updates };
  delete safeUpdates.outputDir;
  delete safeUpdates.outputPath;
  delete safeUpdates.url;
  delete safeUpdates.id;
  history[index] = { ...history[index], ...safeUpdates };
  writeHistory(history);
  return history[index];
}

function clearHistory() {
  writeHistory([]);
}

module.exports = {
  readHistory,
  addHistoryEntry,
  updateHistoryEntry,
  clearHistory,
};
