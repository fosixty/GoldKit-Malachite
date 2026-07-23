const fs = require('fs');
const path = require('path');

const { ASSETS, SOURCE_ASSET, installYtDlp, sha256File } = require('./fetch-ytdlp');

async function main() {
  const asset = ASSETS[process.platform];
  if (!asset) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  const binaryPath = path.join(__dirname, '..', 'build', asset.filename);
  const sourcePath = path.join(__dirname, '..', 'build', SOURCE_ASSET.filename);
  const binaryIsVerified =
    fs.existsSync(binaryPath) && sha256File(binaryPath) === asset.sha256;
  const sourceIsVerified =
    fs.existsSync(sourcePath) && sha256File(sourcePath) === SOURCE_ASSET.sha256;

  if (binaryIsVerified && sourceIsVerified) {
    if (process.platform !== 'win32') {
      fs.chmodSync(binaryPath, 0o755);
    }
    console.log(`Verified development binary and source: build/${asset.filename}`);
    return;
  }

  console.log('The verified development binary is missing or outdated.');
  await installYtDlp();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
