const path = require('path');

const packageJson = require(path.join(__dirname, '..', 'package.json'));
const requestedTag = process.argv[2] || process.env.RELEASE_TAG;

if (!requestedTag) {
  console.error('Usage: node scripts/verify-release-version.js <release-tag>');
  process.exit(1);
}

const requestedVersion = requestedTag.startsWith('v')
  ? requestedTag.slice(1)
  : requestedTag;

if (requestedVersion !== packageJson.version) {
  console.error(
    `Release tag ${requestedTag} does not match package version ${packageJson.version}.`
  );
  process.exit(1);
}

console.log(`Verified release ${requestedTag} for ${packageJson.name} ${packageJson.version}.`);
