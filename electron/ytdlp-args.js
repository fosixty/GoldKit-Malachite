const path = require('path');

function compatibleMp4Format(maxHeight) {
  return [
    `bv[ext=mp4][vcodec^=avc1][height<=${maxHeight}]+ba[ext=m4a][acodec^=mp4a]`,
    `b[ext=mp4][vcodec^=avc1][acodec^=mp4a][height<=${maxHeight}]`,
    `bv*[height<=${maxHeight}]+ba`,
    `b[height<=${maxHeight}]`,
    `bv*[height<=${maxHeight}]`,
  ].join('/');
}

const FORMAT_ARGS = {
  audio: ['-x', '--audio-format', 'mp3'],
  '720p': ['-f', compatibleMp4Format(720)],
  '1080p': ['-f', compatibleMp4Format(1080)],
  best: ['-f', 'bv*+ba/b'],
};

function buildArgs({ url, outputDir, format, ffmpegLocation, nodePath }) {
  const formatArgs = FORMAT_ARGS[format];
  if (!formatArgs) {
    throw new Error('Unsupported download format');
  }
  if (typeof ffmpegLocation !== 'string' || !path.isAbsolute(ffmpegLocation)) {
    throw new Error('A trusted absolute FFmpeg location is required');
  }
  if (typeof nodePath !== 'string' || !path.isAbsolute(nodePath)) {
    throw new Error('A trusted absolute Node.js executable is required');
  }
  const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');

  return [
    '--ignore-config',
    '--verbose',
    '--no-js-runtimes',
    '--js-runtimes',
    `node:${nodePath}`,
    '--ffmpeg-location',
    ffmpegLocation,
    ...formatArgs,
    '-o',
    outputTemplate,
    '--newline',
    '--no-playlist',
    '--progress',
    '--',
    url,
  ];
}

module.exports = { buildArgs, compatibleMp4Format, FORMAT_ARGS };
