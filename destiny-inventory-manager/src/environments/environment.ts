export const environment = {
    production: false,
    bungie: {
      apiKey: 'DUMMY_VALUE', // Replace with your actual API key
      apiRoot: 'https://www.bungie.net/Platform',
      authUrl: 'https://www.bungie.net/en/OAuth/Authorize',
      tokenUrl: 'https://www.bungie.net/Platform/App/OAuth/token/',
      clientId: 'DUMMY_VALUE', // Replace with your actual client ID
      clientSecret: 'DUMMY_VALUE', // Replace with your actual client secret
      redirectUrl: 'http://localhost:4200/auth/callback'
    },
    logging: {
      // Minimum log level to output
      minLevel: 'DEBUG', // 'DEBUG', 'INFO', 'WARN', 'ERROR'
      
      // Enable specific emitters
      emitters: {
        console: true,  // Log to console
        remote: true,   // Log to remote endpoints
        file: true      // Log to local file
      },
      
      // Remote logging endpoints (array of strings)
      remoteEndpoints: [
        'http://localhost:3000/api/logs', 
        'http://secondary-logger.example.com/logs'
      ],
      
      // File logging configuration
      file: {
        enabled: true,
        maxSize: 10 * 1024 * 1024,  // 10MB max file size
        compress: true,             // Enable compression (gzip)
        maxFiles: 5                 // Number of rotated files to keep
      },
      
      // Max number of logs to keep in localStorage
      maxStoredLogs: 100,
      
      // Include stack traces in production logs (can increase payload size)
      includeStacksInProduction: false,
      
      // Application version for logging
      appVersion: '1.0.0'
    }
  };
  
  // Production environment would have different settings
  export const productionEnvironment = {
    production: true,
    bungie: {
      // Same as above but with production values
    },
    logging: {
      minLevel: 'INFO',
      emitters: {
        console: false,  // Disable console in production
        remote: true,    // Enable remote logging in production
        file: false      // Disable file logging in production
      },
      remoteEndpoints: [
        'https://api.yourproduction.com/logs',
        'https://backup-logs.yourproduction.com/api/logs'
      ],
      file: {
        enabled: false
      },
      maxStoredLogs: 50,
      includeStacksInProduction: false,
      appVersion: '1.0.0'
    }
  };