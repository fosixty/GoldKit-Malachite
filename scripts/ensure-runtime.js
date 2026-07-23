const { installFfmpeg } = require('./fetch-ffmpeg');
const { installYtDlp } = require('./fetch-ytdlp');

async function main() {
  await installYtDlp();
  await installFfmpeg({ allDarwin: process.argv.includes('--all-darwin') });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
