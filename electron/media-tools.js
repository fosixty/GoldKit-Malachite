const fs = require('fs');
const path = require('path');

class MediaToolsError extends Error {
  constructor(code, userMessage, detail) {
    super(userMessage);
    this.name = 'MediaToolsError';
    this.code = code;
    this.userMessage = userMessage;
    this.detail = detail;
  }
}

function toolNames(platform) {
  return platform === 'win32'
    ? { ffmpeg: 'ffmpeg.exe', ffprobe: 'ffprobe.exe' }
    : { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' };
}

function expectedArchitecture(platform, arch) {
  if (platform === 'win32' && arch === 'x64') return { format: 'pe', machine: 0x8664 };
  if (platform === 'darwin' && arch === 'x64') return { format: 'macho', cpuType: 0x01000007 };
  if (platform === 'darwin' && arch === 'arm64') return { format: 'macho', cpuType: 0x0100000c };
  throw new MediaToolsError(
    'UNSUPPORTED_ARCHITECTURE',
    'This version of Malachite does not support this computer architecture.',
    `Unsupported runtime target: ${platform}-${arch}`
  );
}

function inspectBinaryArchitecture(filePath, platform, arch) {
  const expected = expectedArchitecture(platform, arch);
  const descriptor = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(4096);
  let bytesRead;
  try {
    bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }

  if (expected.format === 'pe') {
    if (bytesRead < 64 || header.toString('ascii', 0, 2) !== 'MZ') return false;
    const peOffset = header.readUInt32LE(0x3c);
    return (
      peOffset + 6 <= bytesRead &&
      header.toString('ascii', peOffset, peOffset + 4) === 'PE\0\0' &&
      header.readUInt16LE(peOffset + 4) === expected.machine
    );
  }

  return (
    bytesRead >= 8 &&
    header.readUInt32LE(0) === 0xfeedfacf &&
    header.readUInt32LE(4) === expected.cpuType
  );
}

function validateToolDirectory(directory, platform, arch) {
  const names = toolNames(platform);
  const paths = {
    directory,
    ffmpeg: path.join(directory, names.ffmpeg),
    ffprobe: path.join(directory, names.ffprobe),
  };

  for (const [name, filePath] of Object.entries({ ffmpeg: paths.ffmpeg, ffprobe: paths.ffprobe })) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (error) {
      throw new MediaToolsError(
        'MISSING_MEDIA_TOOL',
        'Required media tools are missing. Reinstall Malachite and try again.',
        `${name} is unavailable at ${filePath}: ${error.message}`
      );
    }
    if (!stat.isFile()) {
      throw new MediaToolsError(
        'INVALID_MEDIA_TOOL',
        'The installed media tools are invalid. Reinstall Malachite and try again.',
        `${name} is not a regular file: ${filePath}`
      );
    }
    if (platform !== 'win32' && process.platform !== 'win32' && (stat.mode & 0o111) === 0) {
      throw new MediaToolsError(
        'MEDIA_TOOL_PERMISSION_DENIED',
        'Malachite cannot run its media tools. Reinstall the app and check macOS security settings.',
        `${name} is not executable: ${filePath}`
      );
    }
    if (!inspectBinaryArchitecture(filePath, platform, arch)) {
      throw new MediaToolsError(
        'WRONG_MEDIA_TOOL_ARCHITECTURE',
        'The installed media tools are not compatible with this computer. Reinstall the correct Malachite build.',
        `${name} has an invalid format or architecture: ${filePath}`
      );
    }
  }

  return paths;
}

function findOnPath(platform, arch, environment) {
  const names = toolNames(platform);
  const pathValue = environment.PATH || environment.Path || '';
  for (const segment of pathValue.split(path.delimiter)) {
    if (!segment || !path.isAbsolute(segment)) continue;
    const ffmpegPath = path.join(segment, names.ffmpeg);
    const ffprobePath = path.join(segment, names.ffprobe);
    if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
      try {
        return validateToolDirectory(segment, platform, arch);
      } catch {
        // Continue searching rather than trusting the first incompatible PATH entry.
      }
    }
  }
  return null;
}

function resolveMediaTools({
  isPackaged,
  resourcesPath,
  appPath,
  platform = process.platform,
  arch = process.arch,
  environment = process.env,
  logger = console,
}) {
  expectedArchitecture(platform, arch);

  if (isPackaged) {
    const bundledDirectory = path.join(resourcesPath, 'build', 'ffmpeg', `${platform}-${arch}`);
    return validateToolDirectory(bundledDirectory, platform, arch);
  }

  const configuredDirectory = environment.MALACHITE_FFMPEG_DIR;
  if (configuredDirectory) {
    if (!path.isAbsolute(configuredDirectory)) {
      throw new MediaToolsError(
        'INVALID_CONFIGURED_MEDIA_TOOL_PATH',
        'The configured FFmpeg location is invalid.',
        'MALACHITE_FFMPEG_DIR must be an absolute directory path'
      );
    }
    const tools = validateToolDirectory(configuredDirectory, platform, arch);
    logger.info(`Using explicitly configured development media tools: ${configuredDirectory}`);
    return tools;
  }

  const developmentDirectory = path.join(appPath, 'build', 'ffmpeg', `${platform}-${arch}`);
  try {
    const tools = validateToolDirectory(developmentDirectory, platform, arch);
    logger.info(`Using verified development media tools: ${developmentDirectory}`);
    return tools;
  } catch (error) {
    logger.warn(`Verified development media tools unavailable: ${error.detail || error.message}`);
  }

  const pathTools = findOnPath(platform, arch, environment);
  if (pathTools) {
    logger.warn(`Using FFmpeg and FFprobe from PATH for development only: ${pathTools.directory}`);
    return pathTools;
  }

  throw new MediaToolsError(
    'MISSING_DEVELOPMENT_MEDIA_TOOLS',
    'FFmpeg and FFprobe are unavailable. Run npm run fetch-ffmpeg and try again.',
    'No verified development media tools or compatible FFmpeg/FFprobe PATH pair was found'
  );
}

module.exports = {
  MediaToolsError,
  inspectBinaryArchitecture,
  resolveMediaTools,
  toolNames,
  validateToolDirectory,
};
