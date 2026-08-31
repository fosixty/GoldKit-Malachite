const NODE_VERSION = '24.20.0';
const RELEASE_BASE = `https://nodejs.org/dist/v${NODE_VERSION}`;

const NODE_ASSETS = {
  'win32-x64': {
    archive: `node-v${NODE_VERSION}-win-x64.zip`,
    archiveSha256: '6cac9ffbca8f6a47091e4b5c772e0606049c3871cb67d900c0cedde630e545ba',
    entry: `node-v${NODE_VERSION}-win-x64/node.exe`,
    executable: 'node.exe',
    executableSha256: '5c976096e04e5c2c1f091938926234cc9fbebfe9787ddd149351b3b0ecc707b5',
    type: 'zip',
  },
  'darwin-x64': {
    archive: `node-v${NODE_VERSION}-darwin-x64.tar.xz`,
    archiveSha256: '26fc30891004603d094eed11de5efcd03bbd2efbc35c177fc72648d5d7a7701b',
    entry: `node-v${NODE_VERSION}-darwin-x64/bin/node`,
    executable: 'node',
    executableSha256: 'bb37f3a05d1104a9ca2488718a32ff07f3d0725b7b7b6a04bb26a5af7213fe12',
    type: 'tar',
  },
  'darwin-arm64': {
    archive: `node-v${NODE_VERSION}-darwin-arm64.tar.xz`,
    archiveSha256: 'b7bf7707070b950ba1ec5f1af3bb6de0f2b1962c5033973d94068ab021ef3014',
    entry: `node-v${NODE_VERSION}-darwin-arm64/bin/node`,
    executable: 'node',
    executableSha256: '9d050fd455b56426e25d4d603c7c501cbb2630348e836cf221dcce748e90588a',
    type: 'tar',
  },
  'linux-x64': {
    archive: `node-v${NODE_VERSION}-linux-x64.tar.xz`,
    archiveSha256: '2f2c0da162318f0de47665410c7c8c2ed3d36c8f3105de4bbc61176c70a7cbf2',
    entry: `node-v${NODE_VERSION}-linux-x64/bin/node`,
    executable: 'node',
    executableSha256: '89af8424dd53e560b1933f87ba650d8bf57c83ca5a04600eefb31f416aabbae7',
    type: 'tar',
  },
};

for (const asset of Object.values(NODE_ASSETS)) {
  asset.url = `${RELEASE_BASE}/${asset.archive}`;
}

function getNodePlatformKeys(platform, arch, allDarwin = false) {
  if (platform === 'darwin' && allDarwin) {
    return ['darwin-x64', 'darwin-arm64'];
  }
  const key = `${platform}-${arch}`;
  if (!NODE_ASSETS[key]) {
    throw new Error(`Unsupported Node.js build target: ${key}`);
  }
  return [key];
}

module.exports = { NODE_ASSETS, NODE_VERSION, getNodePlatformKeys };
