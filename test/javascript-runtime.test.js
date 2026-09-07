const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  JavaScriptRuntimeError,
  resolveJavaScriptRuntime,
} = require('../electron/javascript-runtime');

function writeMockNode(filePath, platform, arch) {
  const header = Buffer.alloc(4096);
  if (platform === 'win32') {
    header.write('MZ', 0, 'ascii');
    header.writeUInt32LE(0x80, 0x3c);
    header.write('PE\0\0', 0x80, 'ascii');
    header.writeUInt16LE(0x8664, 0x84);
  } else {
    header.writeUInt32LE(0xfeedfacf, 0);
    header.writeUInt32LE(arch === 'arm64' ? 0x0100000c : 0x01000007, 4);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, header, { mode: 0o755 });
  fs.chmodSync(filePath, 0o755);
}

test('packaged and development builds resolve only their bundled Node.js executable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-node-runtime-'));
  try {
    const executable = path.join(root, 'build', 'node', 'win32-x64', 'node.exe');
    writeMockNode(executable, 'win32', 'x64');
    for (const isPackaged of [false, true]) {
      const runtime = resolveJavaScriptRuntime({
        isPackaged,
        resourcesPath: root,
        appPath: root,
        platform: 'win32',
        arch: 'x64',
      });
      assert.deepEqual(runtime, { name: 'node', executable });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missing or wrong-architecture Node.js fails before yt-dlp starts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'malachite-node-invalid-'));
  try {
    assert.throws(
      () => resolveJavaScriptRuntime({
        isPackaged: true,
        resourcesPath: root,
        appPath: root,
        platform: 'win32',
        arch: 'x64',
      }),
      (error) => error instanceof JavaScriptRuntimeError && error.code === 'MISSING_JAVASCRIPT_RUNTIME'
    );
    const executable = path.join(root, 'build', 'node', 'win32-x64', 'node.exe');
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, 'not a Windows executable');
    assert.throws(
      () => resolveJavaScriptRuntime({
        isPackaged: true,
        resourcesPath: root,
        appPath: root,
        platform: 'win32',
        arch: 'x64',
      }),
      (error) => error instanceof JavaScriptRuntimeError && error.code === 'INVALID_JAVASCRIPT_RUNTIME'
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
