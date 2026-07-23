const { spawn } = require('child_process');

function terminateProcessTree(
  child,
  {
    platform = process.platform,
    spawnProcess = spawn,
    killProcess = process.kill,
  } = {}
) {
  if (!child) return false;

  if (platform === 'win32' && child.pid) {
    const terminator = spawnProcess('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    });
    terminator.on('error', () => child.kill());
  } else if (child.pid) {
    try {
      killProcess(-child.pid, 'SIGTERM');
    } catch {
      child.kill();
    }
  } else {
    child.kill();
  }

  return true;
}

module.exports = { terminateProcessTree };
