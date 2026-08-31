const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  GENERIC_ERROR,
  YOUTUBE_VERIFICATION_PHRASES,
  classifyDownloadError,
} = require('../electron/download-errors');

const FIXTURE_DIRECTORY = path.join(__dirname, 'fixtures', 'stderr');

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIRECTORY, `${name}.txt`), 'utf8');
}

const CLASSIFIED_FIXTURES = [
  ['youtube-verification', 'YOUTUBE_VERIFICATION_REQUIRED'],
  ['ffmpeg-missing', 'FFMPEG_MISSING'],
  ['unsupported-url', 'UNSUPPORTED_URL'],
  ['network-unavailable', 'NETWORK_UNAVAILABLE'],
  ['destination-permission-denied', 'DESTINATION_PERMISSION_DENIED'],
  ['disk-full', 'DISK_FULL'],
];

for (const [name, expectedCode] of CLASSIFIED_FIXTURES) {
  test(`classifies sanitized ${name} stderr`, () => {
    const error = classifyDownloadError({ stderr: fixture(name) });
    assert.equal(error.code, expectedCode);
    assert.deepEqual(Object.keys(error).sort(), ['code', 'message', 'title']);
  });
}

test('matches every stable YouTube verification phrase case-insensitively', () => {
  for (const phrase of YOUTUBE_VERIFICATION_PHRASES) {
    assert.equal(
      classifyDownloadError({ stderr: `ERROR: ${phrase.toUpperCase()}` }).code,
      'YOUTUBE_VERIFICATION_REQUIRED'
    );
  }
});

test('returns the exact YouTube verification title and guidance', () => {
  const error = classifyDownloadError({ stderr: fixture('youtube-verification') });
  assert.equal(error.title, 'YouTube requested verification');
  assert.equal(
    error.message,
    'This commonly happens when using a VPN, proxy, or heavily shared network. Disable the VPN and try again. If it continues, wait a few minutes or use browser authentication.'
  );
});

test('classifies a missing prepared FFmpeg installation without exposing error details', () => {
  const error = classifyDownloadError({
    processError: {
      code: 'MISSING_MEDIA_TOOL',
      message: 'Sensitive local path omitted from the public error',
    },
  });
  assert.equal(error.code, 'FFMPEG_MISSING');
  assert.doesNotMatch(JSON.stringify(error), /Sensitive local path/);
});

test('uses the existing generic error for unknown stderr', () => {
  assert.deepEqual(
    classifyDownloadError({ stderr: fixture('unknown') }),
    GENERIC_ERROR
  );
});

test('reports a YouTube media 403 without claiming every format was retried', () => {
  const error = classifyDownloadError({
    stderr: 'ERROR: unable to download video data: HTTP Error 403: Forbidden',
    url: 'https://www.youtube.com/watch?v=public',
  });
  assert.equal(error.code, 'YOUTUBE_MEDIA_REJECTED');
  assert.equal(
    error.message,
    'YouTube rejected the media request. Try again later or update Malachite if the problem continues.'
  );
});
