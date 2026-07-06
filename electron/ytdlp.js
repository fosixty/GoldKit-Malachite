const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');

const FORMAT_ARGS = {
  audio: ['-x', '--audio-format', 'mp3'],
  '720p': ['-f', 'bv*[height<=720]+ba/b[height<=720]'],
  '1080p': ['-f', 'bv*[height<=1080]+ba/b[height<=1080]'],
  best: ['-f', 'bv*+ba/b'],
};

function getBinaryPath() {
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';

  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', binaryName);
  }

  return path.join(__dirname, '..', 'build', binaryName);
}

function buildArgs({ url, outputDir, format }) {
  const formatArgs = FORMAT_ARGS[format] || FORMAT_ARGS.best;
  const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

  return [
    ...formatArgs,
    '-o',
    outputTemplate,
    '--newline',
    '--no-playlist',
    '--progress',
    url,
  ];
}

function parseProgressLine(line) {
  const downloadMatch = line.match(
    /\[download\]\s+([\d.]+)%\s+of\s+~?\s*[\d.]+\w*\s+at\s+([\d.]+\w+\/s)\s+ETA\s+([\d:]+)/
  );
  if (downloadMatch) {
    return {
      percent: parseFloat(downloadMatch[1]),
      speed: downloadMatch[2],
      eta: downloadMatch[3],
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
  constructor() {
    this.process = null;
    this.cancelled = false;
  }

  isRunning() {
    return this.process !== null;
  }

  start({ url, outputDir, format }, callbacks) {
    if (this.process) {
      throw new Error('A download is already in progress');
    }

    this.cancelled = false;
    const binaryPath = getBinaryPath();
    const args = buildArgs({ url, outputDir, format });

    let title = null;
    let outputPath = null;

    this.process = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const handleLine = (line, stream) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      callbacks.onLog({ line: trimmed, stream });

      const parsedTitle = parseTitleFromLog(trimmed);
      if (parsedTitle) title = parsedTitle;

      const parsedOutput = parseOutputPath(trimmed);
      if (parsedOutput) outputPath = parsedOutput;

      const progress = parseProgressLine(trimmed);
      if (progress) {
        callbacks.onProgress(progress);
      }
    };

    let stdoutBuffer = '';
    this.process.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
      lines.forEach((line) => handleLine(line, 'stdout'));
    });

    let stderrBuffer = '';
    this.process.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';
      lines.forEach((line) => handleLine(line, 'stderr'));
    });

    this.process.on('close', (code) => {
      this.process = null;

      if (this.cancelled) {
        callbacks.onDone({ code: null, cancelled: true, title, outputPath });
        return;
      }

      if (code === 0) {
        callbacks.onDone({ code, cancelled: false, title, outputPath });
      } else {
        callbacks.onError({ code, title, outputPath });
      }
    });

    this.process.on('error', (err) => {
      this.process = null;
      callbacks.onError({ code: -1, message: err.message, title, outputPath });
    });
  }

  cancel() {
    if (!this.process) return false;
    this.cancelled = true;
    this.process.kill();
    return true;
  }
}

module.exports = {
  YtDlpRunner,
  getBinaryPath,
  buildArgs,
  FORMAT_ARGS,
};
