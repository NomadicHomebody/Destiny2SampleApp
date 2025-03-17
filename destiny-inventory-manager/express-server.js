// express-server.js - Express server for Angular 19 pre-rendered content
const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');
const { execSync } = require('child_process');

// Configuration from environment
const PORT = process.env.PORT || 4433;
const SSL_KEY = process.env.SSL_KEY;
const SSL_CERT = process.env.SSL_CERT;

// Clear ports first
try {
  console.log('Clearing ports 4433, 9229, 9230...');
  execSync('npx kill-port 4433 9229 9230');
  console.log('Ports cleared.');
} catch (e) {
  console.warn('Error clearing ports:', e.message);
}

// Create Express app
const app = express();

// Static assets from browser build
app.use(express.static(path.join(__dirname, 'dist/destiny-inventory-manager/browser')));

// Serve the index.server.html for all routes
app.get('*', (req, res) => {
  console.log(`Serving request for: ${req.path}`);
  
  // Look for the pre-rendered index.server.html
  const serverIndexPath = path.join(__dirname, 'dist/destiny-inventory-manager/server/index.server.html');
  
  // Fallback to browser index.html if server version doesn't exist
  const browserIndexPath = path.join(__dirname, 'dist/destiny-inventory-manager/browser/index.html');
  
  if (fs.existsSync(serverIndexPath)) {
    console.log('Serving pre-rendered index.server.html');
    return res.sendFile(serverIndexPath);
  }
  
  if (fs.existsSync(browserIndexPath)) {
    console.log('Serving browser index.html (fallback)');
    return res.sendFile(browserIndexPath);
  }
  
  console.error('Neither server nor browser index found!');
  res.status(500).send('Server configuration error: index files not found');
});

// Start HTTPS server if SSL certs are provided
if (SSL_KEY && SSL_CERT) {
  try {
    const sslOptions = {
      key: fs.readFileSync(SSL_KEY),
      cert: fs.readFileSync(SSL_CERT)
    };
    
    https.createServer(sslOptions, app).listen(PORT, () => {
      console.log(`HTTPS server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting HTTPS server:', error);
    process.exit(1);
  }
} else {
  // Fallback to HTTP
  app.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
  });
}