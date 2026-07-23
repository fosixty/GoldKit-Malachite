const { isYouTubeUrl } = require('./validation');

const MAX_TRANSIENT_YOUTUBE_MEDIA_RETRIES = 1;
const TRANSIENT_MEDIA_403 = /unable to download video data:\s*HTTP Error 403|HTTP Error 403:\s*Forbidden/i;

function shouldRetryYouTubeMediaDownload({ url, format, errorText, retryCount }) {
  return (
    format !== 'audio' &&
    retryCount < MAX_TRANSIENT_YOUTUBE_MEDIA_RETRIES &&
    isYouTubeUrl(url) &&
    TRANSIENT_MEDIA_403.test(errorText || '')
  );
}

module.exports = {
  MAX_TRANSIENT_YOUTUBE_MEDIA_RETRIES,
  shouldRetryYouTubeMediaDownload,
};
