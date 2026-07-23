const FFMPEG_VERSION = '8.1.2';

const ARCHIVES = {
  windows: {
    url: 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-8.1.2-essentials_build.zip',
    sha256: 'db580001caa24ac104c8cb856cd113a87b0a443f7bdf47d8c12b1d740584a2ec',
  },
  'macos-x64-ffmpeg': {
    url: 'https://ffmpeg.martin-riedl.de/download/macos/amd64/1783018342_8.1.2/ffmpeg.zip',
    sha256: 'a52ef43883f44c219766d4b3bdde4e635b35465d0b704c01c3a0566b59775df9',
  },
  'macos-x64-ffprobe': {
    url: 'https://ffmpeg.martin-riedl.de/download/macos/amd64/1783018342_8.1.2/ffprobe.zip',
    sha256: '5408ca588c8c72b0dde3afe676d0a7acf25ef97e55ae6eba5c7bede1cda42695',
  },
  'macos-arm64-ffmpeg': {
    url: 'https://ffmpeg.martin-riedl.de/download/macos/arm64/1783011502_8.1.2/ffmpeg.zip',
    sha256: 'ef1aa60006c7b77ce170c1608c08d8e4ba1c30c5746f2ac986ded932d0ac2c3c',
  },
  'macos-arm64-ffprobe': {
    url: 'https://ffmpeg.martin-riedl.de/download/macos/arm64/1783011502_8.1.2/ffprobe.zip',
    sha256: 'c39787f4af7a3932502d2d48db6f6feaaa836b48a73ef78c32cc3285df61dfaf',
  },
};

const PLATFORM_ASSETS = {
  'win32-x64': {
    provider: 'Gyan Doshi release essentials build',
    license: 'GPL-3.0-or-later',
    tools: {
      ffmpeg: {
        archive: 'windows',
        entry: 'ffmpeg-8.1.2-essentials_build/bin/ffmpeg.exe',
        filename: 'ffmpeg.exe',
        sha256: '1326dde4c84ff1f96fe6b8916c5bed29e163e9b5dccf995f6f3db069d143ec5e',
      },
      ffprobe: {
        archive: 'windows',
        entry: 'ffmpeg-8.1.2-essentials_build/bin/ffprobe.exe',
        filename: 'ffprobe.exe',
        sha256: 'b49ccc7c6547b141ad5a2f6ec69cc04323d7133d7704d70b331b904c63eecb07',
      },
    },
  },
  'darwin-x64': {
    provider: 'Martin Riedl macOS Intel release build',
    license: 'GPL-3.0-or-later',
    tools: {
      ffmpeg: {
        archive: 'macos-x64-ffmpeg',
        entry: 'ffmpeg',
        filename: 'ffmpeg',
        sha256: '1ca59dda73668c59898a0b305afd8a88817a989187f222ec62d64e775d614d23',
      },
      ffprobe: {
        archive: 'macos-x64-ffprobe',
        entry: 'ffprobe',
        filename: 'ffprobe',
        sha256: 'bdb6aff0f1f414382effd97040f7862dc85e67996ac296cb4288beed0e06498f',
      },
    },
  },
  'darwin-arm64': {
    provider: 'Martin Riedl macOS Apple Silicon release build',
    license: 'GPL-3.0-or-later',
    tools: {
      ffmpeg: {
        archive: 'macos-arm64-ffmpeg',
        entry: 'ffmpeg',
        filename: 'ffmpeg',
        sha256: 'eaf91238e104dd0e262bc6510e25061855cc99a6955a721b0ac99660d58c473d',
      },
      ffprobe: {
        archive: 'macos-arm64-ffprobe',
        entry: 'ffprobe',
        filename: 'ffprobe',
        sha256: 'ed9dc5871914b466b96b402c9ec0ba68ce4f836e72faa464b1b4e279835bd4a6',
      },
    },
  },
};

const SOURCE_ASSET = {
  url: 'https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz',
  filename: 'ffmpeg-8.1.2.tar.xz',
  sha256: '464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c',
};

function getPlatformKeys(platform, arch, allDarwin = false) {
  if (platform === 'win32' && arch === 'x64' && !allDarwin) {
    return ['win32-x64'];
  }
  if (platform === 'darwin' && allDarwin) {
    return ['darwin-x64', 'darwin-arm64'];
  }
  const key = `${platform}-${arch}`;
  if (PLATFORM_ASSETS[key]) {
    return [key];
  }
  throw new Error(`Unsupported FFmpeg build target: ${key}`);
}

module.exports = {
  ARCHIVES,
  FFMPEG_VERSION,
  PLATFORM_ASSETS,
  SOURCE_ASSET,
  getPlatformKeys,
};
