// server-ssl.js - SSL wrapper with proper proxy for Angular SSR server
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const { exec } = require('child_process');

// Configuration
const PORT = process.env.PORT || 4433;
const DEBUG_PORT = process.env.DEBUG_PORT || 9230; // Use a different debug port
const SSL_KEY = process.env.SSL_KEY;
const SSL_CERT = process.env.SSL_CERT;

if (!SSL_KEY || !SSL_CERT) {
  console.error('SSL_KEY and SSL_CERT environment variables must be set');
  process.exit(1);
}

// Function to check if port is in use and free it if needed
function checkAndFreePort(port) {
  return new Promise((resolve, reject) => {
    console.log(`Checking if port ${port} is in use...`);
    
    // For Windows
    if (process.platform === 'win32') {
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (stdout && stdout.trim()) {
          console.log(`Port ${port} is in use, killing process...`);
          exec(`npx kill-port ${port}`, (killError) => {
            if (killError) {
              console.error(`Failed to kill process on port ${port}:`, killError);
            }
            // Wait a moment for the port to be released
            setTimeout(resolve, 1500);
          });
        } else {
          console.log(`Port ${port} is free.`);
          resolve();
        }
      });
    } 
    // For Unix-based systems
    else {
      exec(`lsof -i:${port} -t`, (error, stdout) => {
        if (stdout && stdout.trim()) {
          console.log(`Port ${port} is in use, killing process...`);
          exec(`npx kill-port ${port}`, (killError) => {
            if (killError) {
              console.error(`Failed to kill process on port ${port}:`, killError);
            }
            setTimeout(resolve, 1500);
          });
        } else {
          console.log(`Port ${port} is free.`);
          resolve();
        }
      });
    }
  });
}

// Main function to start the server
async function startServer() {
  try {
    // First free the ports if needed
    await checkAndFreePort(PORT);
    await checkAndFreePort(DEBUG_PORT);
    await checkAndFreePort(9229); // Also check default debug port
    
    // Read SSL files
    const sslOptions = {
      key: fs.readFileSync(SSL_KEY),
      cert: fs.readFileSync(SSL_CERT)
    };

    // Pick an internal port for the Angular SSR server (between 50000-60000)
    const internalPort = Math.floor(Math.random() * 10000) + 50000;
    console.log(`Will start internal Angular SSR server on port ${internalPort}`);

    // Start the Angular SSR server as a child process
    const nodeOptions = `--inspect=${DEBUG_PORT}`;
    console.log(`Starting Angular SSR server with options: ${nodeOptions}`);
    
    const serverProcess = spawn('node', [
      nodeOptions,
      './dist/destiny-inventory-manager/server/main.server.mjs'
    ], {
      env: {
        ...process.env,
        PORT: internalPort.toString()
      },
      stdio: 'pipe'
    });

    // Handle server process output
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[SSR Server]: ${output}`);
      
      // Check for server ready message
      if (output.includes('listening') || output.includes('Listening')) {
        console.log('Angular SSR server is ready to accept requests');
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[SSR Server Error]: ${data.toString()}`);
    });

    serverProcess.on('close', (code) => {
      console.log(`Angular SSR server exited with code ${code}`);
      process.exit(code);
    });

    // Wait for the server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create HTTPS server that proxies to the internal server
    const httpsServer = https.createServer(sslOptions, (req, res) => {
      console.log(`Proxying request: ${req.method} ${req.url}`);
      
      // Create a proxy request to the internal server
      const proxyReq = http.request({
        host: 'localhost',
        port: internalPort,
        path: req.url,
        method: req.method,
        headers: req.headers
      }, (proxyRes) => {
        // Forward the response status and headers
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        
        // Pipe the response body
        proxyRes.pipe(res);
      });
      
      // Forward error events
      proxyReq.on('error', (e) => {
        console.error('Proxy request error:', e);
        res.writeHead(502);
        res.end('Proxy Error: ' + e.message);
      });
      
      // Pipe the request body to the proxy request
      req.pipe(proxyReq);
    });

    // Handle HTTPS server errors
    httpsServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is still in use. Please manually close the application using this port.`);
        console.error(`You can do this by running: npx kill-port ${PORT}`);
        serverProcess.kill();
        process.exit(1);
      } else {
        console.error('HTTPS server error:', err);
        serverProcess.kill();
        process.exit(1);
      }
    });

    // Start the HTTPS server
    httpsServer.listen(PORT, () => {
      console.log(`HTTPS server started on port ${PORT} - proxying to internal SSR server on port ${internalPort}`);
    });

    // Forward termination signals
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      serverProcess.kill();
      httpsServer.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error setting up server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();