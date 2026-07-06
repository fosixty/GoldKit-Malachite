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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
}

function createEntry({ url, format, outputDir }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url,
    format,
    outputDir,
    title: null,
    outputPath: null,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

function addHistoryEntry(entry) {
  const history = readHistory();
  history.unshift(entry);
  writeHistory(history.slice(0, MAX_HISTORY));
  return entry;
}

function updateHistoryEntry(id, updates) {
  const history = readHistory();
  const index = history.findIndex((item) => item.id === id);
  if (index === -1) return null;

  history[index] = { ...history[index], ...updates };
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
