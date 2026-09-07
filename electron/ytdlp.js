const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');
const { buildArgs, FORMAT_ARGS } = require('./ytdlp-args');
const { classifyDownloadError } = require('./download-errors');
const { resolveJavaScriptRuntime } = require('./javascript-runtime');
const { resolveMediaTools } = require('./media-tools');
const { terminateProcessTree } = require('./process-control');
const { shouldRetryYouTubeMediaDownload } = require('./ytdlp-retry');
const { sanitizeYtDlpDiagnostics } = require('./ytdlp-diagnostics');
const MAX_LOG_LINE_LENGTH = 4096;
const MAX_STREAM_BUFFER_LENGTH = 64 * 1024;

function sizeToBytes(value, unit) {
  const powers = { B: 0, KB: 1, KIB: 1, MB: 2, MIB: 2, GB: 3, GIB: 3, TB: 4, TIB: 4 };
  const power = powers[unit.toUpperCase()];
  if (power == null) return null;
  return Number(value) * (unit.toLowerCase().includes('i') ? 1024 : 1000) ** power;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function getBinaryPath() {
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';

  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', binaryName);
  }

  return path.join(__dirname, '..', 'build', binaryName);
}

function parseProgressLine(line) {
  const downloadMatch = line.match(
    /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+)\s*([KMGTP]?i?B)\s+at\s+([\d.]+\s*[KMGTP]?i?B\/s)\s+ETA\s+([\d:]+)/i
  );
  if (downloadMatch) {
    const percent = parseFloat(downloadMatch[1]);
    const totalBytes = sizeToBytes(downloadMatch[2], downloadMatch[3]);
    return {
      percent,
      downloadedSize: formatBytes(totalBytes * (percent / 100)),
      totalSize: formatBytes(totalBytes),
      speed: downloadMatch[4].replace(/\s+/g, '').replace(/([\d.]+)([KMGTP]?i?B\/s)/i, '$1 $2'),
      eta: downloadMatch[5],
      status: 'downloading',
    };
  }

  const simpleMatch = line.match(/\[download\]\s+([\d.]+)%/);
  if (simpleMatch) {
    return {
      percent: parseFloat(simpleMatch[1]),
      speed: null,
      eta: null,
      status: 'downloading',
    };
  }

  if (line.includes('[ExtractAudio]')) {
    return { percent: null, speed: null, eta: null, status: 'extracting' };
  }

  if (line.includes('[Merger]')) {
    return { percent: null, speed: null, eta: null, status: 'merging' };
  }

  if (line.includes('[ffmpeg]')) {
    return { percent: null, speed: null, eta: null, status: 'processing' };
  }

  return null;
}

function parseTitleFromLog(line) {
  const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/);
  if (destMatch) {
    return path.basename(destMatch[1], path.extname(destMatch[1]));
  }

  const infoMatch = line.match(/\[info\]\s+(.+?):\s+Downloading/);
  if (infoMatch) {
    return infoMatch[1];
  }

  return null;
}

function parseOutputPath(line) {
  const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/);
  if (destMatch) {
    return destMatch[1].trim();
  }

  const mergeMatch = line.match(/\[Merger\]\s+Merging formats into\s+"(.+)"/);
  if (mergeMatch) {
    return mergeMatch[1];
  }

  return null;
}

class YtDlpRunner {
  constructor({ spawnProcess = spawn, binaryPathResolver = getBinaryPath } = {}) {
    this.process = null;
    this.cancelled = false;
    this.spawnProcess = spawnProcess;
    this.binaryPathResolver = binaryPathResolver;
  }

  isRunning() {
    return this.process !== null;
  }

  prepare() {
    const common = {
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath(),
      platform: process.platform,
      arch: process.arch,
    };
    const mediaTools = resolveMediaTools({
      ...common,
      environment: process.env,
      logger: console,
    });
    const javascriptRuntime = resolveJavaScriptRuntime(common);
    return { ...mediaTools, javascriptRuntime };
  }

  start({ url, outputDir, format, ffmpegLocation, nodePath }, callbacks) {
    if (this.process) {
      throw new Error('A download is already in progress');
    }

    this.cancelled = false;
    const binaryPath = this.binaryPathResolver();
    const args = buildArgs({ url, outputDir, format, ffmpegLocation, nodePath });

    let title = null;
    let outputPath = null;
    let retryCount = 0;
    let finished = false;
    let rawStderr = '';

    const handleLine = (line, stream) => {
      const trimmed = line.trim().slice(0, MAX_LOG_LINE_LENGTH);
      if (!trimmed) return;

      callbacks.onLog({ line: sanitizeYtDlpDiagnostics(trimmed), stream });

      const parsedTitle = parseTitleFromLog(trimmed);
      if (parsedTitle) title = parsedTitle;

      const parsedOutput = parseOutputPath(trimmed);
      if (parsedOutput) outputPath = parsedOutput;

      const progress = parseProgressLine(trimmed);
      if (progress) {
        callbacks.onProgress(progress);
      }
    };

    const launchAttempt = () => {
      let attemptSettled = false;
      let stderrTail = '';
      let stdoutBuffer = '';
      let stderrBuffer = '';
      const child = this.spawnProcess(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: process.platform !== 'win32',
        shell: false,
      });
      this.process = child;

      child.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
        if (stdoutBuffer.length > MAX_STREAM_BUFFER_LENGTH && !stdoutBuffer.includes('\n')) {
          handleLine(stdoutBuffer, 'stdout');
          stdoutBuffer = '';
        }
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || '';
        lines.forEach((line) => handleLine(line, 'stdout'));
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        rawStderr += text;
        stderrTail = `${stderrTail}${text}`.slice(-MAX_STREAM_BUFFER_LENGTH);
        stderrBuffer += text;
        if (stderrBuffer.length > MAX_STREAM_BUFFER_LENGTH && !stderrBuffer.includes('\n')) {
          handleLine(stderrBuffer, 'stderr');
          stderrBuffer = '';
        }
        const lines = stderrBuffer.split('\n');
        stderrBuffer = lines.pop() || '';
        lines.forEach((line) => handleLine(line, 'stderr'));
      });

      child.on('close', (code) => {
        if (attemptSettled || finished) return;
        attemptSettled = true;
        if (this.process === child) this.process = null;
        if (stdoutBuffer) handleLine(stdoutBuffer, 'stdout');
        if (stderrBuffer) handleLine(stderrBuffer, 'stderr');

        if (this.cancelled) {
          finished = true;
          callbacks.onDone({ code: null, cancelled: true, title, outputPath });
          return;
        }

        if (code === 0) {
          finished = true;
          callbacks.onDone({ code, cancelled: false, title, outputPath });
          return;
        }

        if (shouldRetryYouTubeMediaDownload({
          url,
          format,
          errorText: stderrTail,
          retryCount,
        })) {
          retryCount += 1;
          callbacks.onLog({
            line: '[Malachite] YouTube rejected a temporary media URL. Refreshing it and retrying once...',
            stream: 'stdout',
          });
          callbacks.onProgress({
            percent: 0,
            speed: null,
            eta: null,
            status: 'retrying',
          });
          launchAttempt();
          return;
        }

        finished = true;
        const error = classifyDownloadError({ stderr: rawStderr, url });
        callbacks.onError({
          ...error,
          exitCode: code,
          rawStderr: sanitizeYtDlpDiagnostics(rawStderr),
          mediaTitle: title,
          outputPath,
        });
      });

      child.on('error', (err) => {
        if (attemptSettled || finished) return;
        attemptSettled = true;
        finished = true;
        if (this.process === child) this.process = null;
        const error = classifyDownloadError({ processError: err, url });
        callbacks.onError({
          ...error,
          exitCode: -1,
          rawStderr: sanitizeYtDlpDiagnostics(rawStderr),
          mediaTitle: title,
          outputPath,
        });
      });
    };

    launchAttempt();
  }

  cancel() {
    if (!this.process) return false;
    this.cancelled = true;
    const child = this.process;
    terminateProcessTree(child);
    return true;
  }
}

module.exports = {
  YtDlpRunner,
  getBinaryPath,
  parseProgressLine,
  buildArgs,
  FORMAT_ARGS,
};
