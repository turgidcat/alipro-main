// Compatibility entry: all version updates use the root source fingerprint.
const path = require('node:path');
const { prepare } = require('./release-version.cjs');
prepare(path.resolve(__dirname, '..'), process.argv.includes('--apply'));
