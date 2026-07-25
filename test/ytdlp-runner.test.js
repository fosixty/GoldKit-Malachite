const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const path = require('node:path');
const test = require('node:test');

const { YtDlpRunner, parseProgressLine } = require('../electron/ytdlp');

function createChild(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {};
  return child;
}

test('progress lines include transferred and total sizes', () => {
  assert.deepEqual(
    parseProgressLine('[download] 40.0% of 1.20GiB at 14.3MiB/s ETA 00:41'),
    {
      percent: 40,
      downloadedSize: '515 MB',
      totalSize: '1.29 GB',
      speed: '14.3 MiB/s',
      eta: '00:41',
      status: 'downloading',
    }
  );
});

test('runner refreshes a rejected YouTube video URL once and then completes', async () => {
  const children = [];
  const spawnCalls = [];
  const spawnProcess = (binary, args, options) => {
    const child = createChild(1000 + children.length);
    children.push(child);
    spawnCalls.push({ binary, args, options });

    setImmediate(() => {
      if (children.length === 1) {
        child.stderr.write('ERROR: unable to download video data: HTTP Error 403: Forbidden\n');
        child.stderr.end();
        child.stdout.end();
        child.emit('close', 1);
      } else {
        child.stdout.write('[download] 100% of 1.00MiB\n');
        child.stdout.end();
        child.stderr.end();
        child.emit('close', 0);
      }
    });
    return child;
  };

  const logs = [];
  const progress = [];
  const result = await new Promise((resolve, reject) => {
    const runner = new YtDlpRunner({
      spawnProcess,
      binaryPathResolver: () => path.join(process.cwd(), 'build', 'yt-dlp.exe'),
    });
    runner.start(
      {
        url: 'https://www.youtube.com/watch?v=myee1ck_p8k',
        outputDir: process.cwd(),
        format: '720p',
        ffmpegLocation: path.join(process.cwd(), 'build', 'ffmpeg', 'win32-x64'),
      },
      {
        onLog: (entry) => logs.push(entry),
        onProgress: (entry) => progress.push(entry),
        onDone: resolve,
        onError: (error) => reject(new Error(error.message)),
      }
    );
  });

  assert.equal(spawnCalls.length, 2);
  assert.equal(spawnCalls[0].options.shell, false);
  assert.deepEqual(spawnCalls[0].args, spawnCalls[1].args);
  assert.match(logs.map(({ line }) => line).join('\n'), /refreshing it and retrying once/i);
  assert.ok(progress.some(({ status }) => status === 'retrying'));
  assert.equal(result.code, 0);
  assert.equal(result.cancelled, false);
});

test('runner returns a structured verification error and complete trailing stderr', async () => {
  const rawStderr = [
    "ERROR: Sign in to confirm you're not a bot. ",
    'Use --cookies-from-browser or --cookies for the authentication.',
  ].join('');
  const logs = [];
  const child = createChild(2000);
  const spawnProcess = () => {
    setImmediate(() => {
      child.stderr.write(rawStderr.slice(0, 37));
      child.stderr.write(rawStderr.slice(37));
      child.stderr.end();
      child.stdout.end();
      child.emit('close', 1);
    });
    return child;
  };

  const error = await new Promise((resolve, reject) => {
    const runner = new YtDlpRunner({
      spawnProcess,
      binaryPathResolver: () => path.join(process.cwd(), 'build', 'yt-dlp.exe'),
    });
    runner.start(
      {
        url: 'https://www.youtube.com/watch?v=redacted',
        outputDir: process.cwd(),
        format: 'audio',
        ffmpegLocation: path.join(process.cwd(), 'build', 'ffmpeg', 'win32-x64'),
      },
      {
        onLog: (entry) => logs.push(entry),
        onProgress: () => {},
        onDone: () => reject(new Error('Expected the runner to fail')),
        onError: resolve,
      }
    );
  });

  assert.equal(error.code, 'YOUTUBE_VERIFICATION_REQUIRED');
  assert.equal(error.exitCode, 1);
  assert.equal(error.rawStderr, rawStderr);
  assert.equal(error.mediaTitle, null);
  assert.ok(logs.some((entry) => entry.stream === 'stderr' && entry.line === rawStderr));
});
