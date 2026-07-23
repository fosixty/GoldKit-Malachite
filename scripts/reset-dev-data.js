const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const devDataPath = path.resolve(projectRoot, '.dev-data');

if (path.dirname(devDataPath) !== projectRoot || path.basename(devDataPath) !== '.dev-data') {
  throw new Error('Refusing to remove an unexpected development data path');
}

fs.rmSync(devDataPath, { recursive: true, force: true });
console.log('Reset .dev-data. The next development launch will behave like a first launch.');
