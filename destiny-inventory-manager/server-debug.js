// server-debug.js - Diagnostic script for Angular SSR server
const fs = require('fs');
const { spawn } = require('child_process');
const { execSync } = require('child_process');

// Check what's actually in the dist folder
console.log('Checking dist folder contents:');
try {
  const serverDir = fs.readdirSync('./dist/destiny-inventory-manager/server');
  console.log('Server directory contents:', serverDir);

  // If server.mjs exists, see what it contains
  if (serverDir.includes('server.mjs')) {
    console.log('server.mjs exists. Examining content...');
    const content = fs.readFileSync('./dist/destiny-inventory-manager/server/server.mjs', 'utf8');
    console.log('server.mjs first 500 chars:', content.substring(0, 500));
  }
} catch (error) {
  console.error('Error examining dist folder:', error);
}

// Try running the server directly with verbose output
console.log('\nTrying to run server.mjs directly:');

// Force clear the debug port
try {
  execSync('npx kill-port 9229 9230');
} catch (e) {}

const server = spawn('node', [
  '--inspect=9230',
  './dist/destiny-inventory-manager/server/server.mjs',
  '--verbose'
], {
  stdio: 'pipe',
  env: {
    ...process.env,
    PORT: '4433',
    NODE_ENV: 'development',
    DEBUG: '*'
  }
});

server.stdout.on('data', (data) => {
  console.log(`[Server Output]: ${data.toString()}`);
});

server.stderr.on('data', (data) => {
  console.log(`[Server Error]: ${data.toString()}`);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

console.log('Diagnostic script is running. Server should start shortly...');