const fs = require('fs');
const path = require('path');

const LEGAL_NOTICE_VERSION = 3;
const LEGAL_NOTICE_TITLE = 'Responsible Use Notice';
const LEGAL_NOTICE_MESSAGE = 'Use Malachite only for lawful and authorized downloads.';
const LEGAL_NOTICE_DETAIL = [
  'Malachite is an independent graphical interface for yt-dlp. It is not affiliated with YouTube, Google, or the yt-dlp project.',
  '',
  'You are responsible for ensuring that your use of this software complies with all applicable laws, website terms, licenses, privacy rights, and other requirements in your jurisdiction.',
  '',
  'Only download media that you own, have permission to use, or are otherwise legally entitled to access. Malachite does not grant permission to download third-party content or bypass restrictions.',
  '',
  'Some services, including YouTube, restrict downloading and automated access except in limited authorized cases. You must comply with each service’s terms as well as applicable law.',
  '',
  'By selecting “I Agree,” you acknowledge that you understand and accept responsibility for your use of Malachite.',
].join('\n');

function getAcceptancePath(userDataPath) {
  return path.join(userDataPath, 'legal-notice.json');
}

function getYouTubeAuthorizationPreferencePath(userDataPath) {
  return path.join(userDataPath, 'youtube-authorization.json');
}

function hasAcceptedLegalNotice(userDataPath) {
  try {
    const data = JSON.parse(fs.readFileSync(getAcceptancePath(userDataPath), 'utf8'));
    return (
      Number.isInteger(data.acceptedVersion) &&
      data.acceptedVersion >= 1 &&
      typeof data.acceptedAt === 'string' &&
      !Number.isNaN(Date.parse(data.acceptedAt))
    );
  } catch {
    return false;
  }
}

function recordLegalNoticeAcceptance(userDataPath) {
  const filePath = getAcceptancePath(userDataPath);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const data = {
    acceptedVersion: LEGAL_NOTICE_VERSION,
    acceptedAt: new Date().toISOString(),
  };

  fs.mkdirSync(userDataPath, { recursive: true });
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath);
    }
  }
}

function hasDisabledYouTubeAuthorizationPrompt(userDataPath) {
  try {
    const data = JSON.parse(
      fs.readFileSync(getYouTubeAuthorizationPreferencePath(userDataPath), 'utf8')
    );
    return (
      data.doNotAskAgain === true &&
      typeof data.confirmedAt === 'string' &&
      !Number.isNaN(Date.parse(data.confirmedAt))
    );
  } catch {
    return false;
  }
}

function disableYouTubeAuthorizationPrompt(userDataPath) {
  const filePath = getYouTubeAuthorizationPreferencePath(userDataPath);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const data = {
    doNotAskAgain: true,
    confirmedAt: new Date().toISOString(),
  };

  fs.mkdirSync(userDataPath, { recursive: true });
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath);
    }
  }
}

module.exports = {
  LEGAL_NOTICE_DETAIL,
  LEGAL_NOTICE_MESSAGE,
  LEGAL_NOTICE_TITLE,
  LEGAL_NOTICE_VERSION,
  disableYouTubeAuthorizationPrompt,
  getAcceptancePath,
  getYouTubeAuthorizationPreferencePath,
  hasDisabledYouTubeAuthorizationPrompt,
  hasAcceptedLegalNotice,
  recordLegalNoticeAcceptance,
};
