const fs = require('fs');
const path = require('path');

const { inspectBinaryArchitecture } = require('./media-tools');

class JavaScriptRuntimeError extends Error {
  constructor(code, detail) {
    super('The bundled JavaScript runtime is unavailable. Reinstall Malachite and try again.');
    this.name = 'JavaScriptRuntimeError';
    this.code = code;
    this.detail = detail;
  }
}

function nodeExecutableName(platform) {
  return platform === 'win32' ? 'node.exe' : 'node';
}

function validateNodeExecutable(filePath, platform, arch) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    throw new JavaScriptRuntimeError(
      'MISSING_JAVASCRIPT_RUNTIME',
      `Node.js is unavailable at ${filePath}: ${error.message}`
    );
  }
  if (!stat.isFile() || !inspectBinaryArchitecture(filePath, platform, arch)) {
    throw new JavaScriptRuntimeError(
      'INVALID_JAVASCRIPT_RUNTIME',
      `Node.js has an invalid format or architecture: ${filePath}`
    );
  }
  if (platform !== 'win32' && process.platform !== 'win32' && (stat.mode & 0o111) === 0) {
    throw new JavaScriptRuntimeError(
      'JAVASCRIPT_RUNTIME_PERMISSION_DENIED',
      `Node.js is not executable: ${filePath}`
    );
  }
  return filePath;
}

function resolveJavaScriptRuntime({
  isPackaged,
  resourcesPath,
  appPath,
  platform = process.platform,
  arch = process.arch,
}) {
  const root = isPackaged ? resourcesPath : appPath;
  const executable = path.join(
    root,
    'build',
    'node',
    `${platform}-${arch}`,
    nodeExecutableName(platform)
  );
  return {
    name: 'node',
    executable: validateNodeExecutable(executable, platform, arch),
  };
}

module.exports = {
  JavaScriptRuntimeError,
  nodeExecutableName,
  resolveJavaScriptRuntime,
  validateNodeExecutable,
};
