const { isYouTubeUrl } = require('./validation');

const GENERIC_ERROR = Object.freeze({
  code: 'DOWNLOAD_FAILED',
  title: 'Couldn’t download.',
  message: 'The download or media processing step failed.',
});

const ERROR_DEFINITIONS = Object.freeze({
  YOUTUBE_VERIFICATION_REQUIRED: Object.freeze({
    code: 'YOUTUBE_VERIFICATION_REQUIRED',
    title: 'YouTube requested verification',
    message: 'This commonly happens when using a VPN, proxy, or heavily shared network. Disable the VPN and try again. If it continues, wait a few minutes or use browser authentication.',
  }),
  FFMPEG_MISSING: Object.freeze({
    code: 'FFMPEG_MISSING',
    title: 'FFmpeg is unavailable',
    message: 'Required media tools are missing. Reinstall Malachite and try again.',
  }),
  UNSUPPORTED_URL: Object.freeze({
    code: 'UNSUPPORTED_URL',
    title: 'Unsupported URL',
    message: 'This website or URL is not supported by the current download engine.',
  }),
  NETWORK_UNAVAILABLE: Object.freeze({
    code: 'NETWORK_UNAVAILABLE',
    title: 'Network unavailable',
    message: 'Malachite could not reach the media service. Check your connection and try again.',
  }),
  DESTINATION_PERMISSION_DENIED: Object.freeze({
    code: 'DESTINATION_PERMISSION_DENIED',
    title: 'Can’t write to destination',
    message: 'Malachite does not have permission to save files in the selected folder. Choose another folder or update its permissions.',
  }),
  DISK_FULL: Object.freeze({
    code: 'DISK_FULL',
    title: 'Not enough disk space',
    message: 'The destination does not have enough free space for this download.',
  }),
  FORMAT_UNAVAILABLE: Object.freeze({
    code: 'FORMAT_UNAVAILABLE',
    title: 'Couldn’t download.',
    message: 'A supported media format is not available for this URL.',
  }),
  MEDIA_UNAVAILABLE: Object.freeze({
    code: 'MEDIA_UNAVAILABLE',
    title: 'Couldn’t download.',
    message: 'This media is unavailable or requires access that Malachite does not support.',
  }),
  YOUTUBE_MEDIA_REJECTED: Object.freeze({
    code: 'YOUTUBE_MEDIA_REJECTED',
    title: 'Couldn’t download.',
    message: 'YouTube rejected the media request after a retry. Try again later or update Malachite if the problem continues.',
  }),
  MEDIA_PROCESSING_FAILED: Object.freeze({
    code: 'MEDIA_PROCESSING_FAILED',
    title: 'Couldn’t download.',
    message: 'Malachite could not process or merge the downloaded media.',
  }),
  MEDIA_TOOL_PERMISSION_DENIED: Object.freeze({
    code: 'MEDIA_TOOL_PERMISSION_DENIED',
    title: 'Media tools could not start',
    message: 'Malachite cannot run its bundled media tools. Reinstall the app and check system security settings.',
  }),
  DOWNLOAD_PROCESS_START_FAILED: Object.freeze({
    code: 'DOWNLOAD_PROCESS_START_FAILED',
    title: 'Couldn’t start download',
    message: 'Malachite could not start the download process.',
  }),
});

const YOUTUBE_VERIFICATION_PHRASES = Object.freeze([
  "sign in to confirm you're not a bot",
  'use --cookies-from-browser',
  'use --cookies for the authentication',
]);

function result(definition) {
  return { ...definition };
}

function classifyDownloadError({ stderr = '', url = '', processError = null } = {}) {
  const normalized = String(stderr).toLowerCase().replaceAll('’', "'");
  const processCode = processError?.code;

  if (YOUTUBE_VERIFICATION_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return result(ERROR_DEFINITIONS.YOUTUBE_VERIFICATION_REQUIRED);
  }

  if (
    processCode === 'ENOSPC'
    || /\bno space left on device\b|\bdisk (?:is )?full\b|\bnot enough (?:free )?space\b|\benospc\b/i.test(stderr)
  ) {
    return result(ERROR_DEFINITIONS.DISK_FULL);
  }

  if (
    /\bpermission denied\b|\baccess is denied\b|\beacces\b|\boperation not permitted\b/i.test(stderr)
  ) {
    return result(ERROR_DEFINITIONS.DESTINATION_PERMISSION_DENIED);
  }

  if (
    /\bunsupported url\b|\bno suitable extractor\b/i.test(stderr)
  ) {
    return result(ERROR_DEFINITIONS.UNSUPPORTED_URL);
  }

  if (
    /\bnetwork is unreachable\b|\btemporary failure in name resolution\b|\bname or service not known\b|\bgetaddrinfo failed\b|\bcould not resolve host\b|\bconnection (?:was )?(?:refused|reset|failed)\b|\bfailed to establish a new connection\b/i.test(stderr)
  ) {
    return result(ERROR_DEFINITIONS.NETWORK_UNAVAILABLE);
  }

  if (
    ['MISSING_MEDIA_TOOL', 'MISSING_DEVELOPMENT_MEDIA_TOOLS'].includes(processCode)
    || /\b(?:ffmpeg|ffprobe)(?: and (?:ffmpeg|ffprobe))? (?:not found|could not be found|is not installed|is unavailable)\b|\bunable to find (?:ffmpeg|ffprobe)\b/i.test(stderr)
  ) {
    return result(ERROR_DEFINITIONS.FFMPEG_MISSING);
  }

  if (/requested format is not available/i.test(stderr)) {
    return result(ERROR_DEFINITIONS.FORMAT_UNAVAILABLE);
  }

  if (/age.?restricted|private video|video unavailable|not available/i.test(stderr)) {
    return result(ERROR_DEFINITIONS.MEDIA_UNAVAILABLE);
  }

  if (/(?:HTTP Error 403|Forbidden)/i.test(stderr) && isYouTubeUrl(url)) {
    return result(ERROR_DEFINITIONS.YOUTUBE_MEDIA_REJECTED);
  }

  if (/ffmpeg|ffprobe|merge/i.test(stderr)) {
    return result(ERROR_DEFINITIONS.MEDIA_PROCESSING_FAILED);
  }

  if (processCode === 'EACCES' || processCode === 'EPERM') {
    return result(ERROR_DEFINITIONS.MEDIA_TOOL_PERMISSION_DENIED);
  }

  if (processError) {
    return result(ERROR_DEFINITIONS.DOWNLOAD_PROCESS_START_FAILED);
  }

  return result(GENERIC_ERROR);
}

module.exports = {
  ERROR_DEFINITIONS,
  GENERIC_ERROR,
  YOUTUBE_VERIFICATION_PHRASES,
  classifyDownloadError,
};
