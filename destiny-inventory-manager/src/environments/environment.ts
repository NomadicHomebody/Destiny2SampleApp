export const environment = {
    production: false,
    bungie: {
        apiKey: '0d57094af7184c1f99c75e1a885981b2', // Replace with your actual API key
        apiRoot: 'https://www.bungie.net/Platform',
        authUrl: 'https://www.bungie.net/en/OAuth/Authorize',
        tokenUrl: 'https://www.bungie.net/Platform/App/OAuth/token/',
        clientId: '49264', // Replace with your actual client ID
        clientSecret: 'Z82MrLJ5ErUPiaw4zDFGmD8StjZPKAFv.IYYN69TglA', // Replace with your actual client secret
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
        // Base path for log files (for non-browser environments)
        basePath: './data/logs/',
        // Folder name prefix for log groups
        folderNamePrefix: 'destiny-app-',
        // Maximum file size before rotation (in bytes)
        maxSize: 10 * 1024 * 1024,  // 10MB
        // Enable compression (gzip)
        compress: true,
        // Number of rotated files to keep
        maxFiles: 5,
        // Rotation period: 'hourly', 'daily', 'weekly'
        rotationPeriod: 'daily',
        // Filename pattern (supports placeholders: {date}, {level}, {prefix})
        filenamePattern: '{prefix}log-{date}-{level}.json'
      },
      
      // Offline logging (for Service Worker)
      offline: {
        enabled: true,
        maxBufferSize: 50,  // Max number of logs to buffer when offline
        syncWhenOnline: true
      },
      
      // Max number of logs to keep in localStorage
      maxStoredLogs: 100,
      
      // Include stack traces in production logs (can increase payload size)
      includeStacksInProduction: false,
      
      // Application version for logging
      appVersion: '1.0.0',
      
      // Additional filtering options
      filters: {
        // Sources to exclude (array of strings)
        excludeSources: ['polling-service', 'heartbeat'],
        // Custom filters (simple key-value pairs)
        custom: {
          environment: 'development',
          clientId: 'destiny-inventory-manager'
        }
      }
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
        file: true       // Enable file logging in production
      },
      remoteEndpoints: [
        'https://api.yourproduction.com/logs',
        'https://backup-logs.yourproduction.com/api/logs'
      ],
      file: {
        enabled: true,
        basePath: '/var/log/destiny-app/',
        folderNamePrefix: 'prod-',
        maxSize: 100 * 1024 * 1024,  // 100MB
        compress: true,
        maxFiles: 30,
        rotationPeriod: 'daily',
        filenamePattern: '{prefix}{date}.log.gz'
      },
      offline: {
        enabled: true,
        maxBufferSize: 200,
        syncWhenOnline: true
      },
      maxStoredLogs: 50,
      includeStacksInProduction: false,
      appVersion: '1.0.0',
      filters: {
        excludeSources: ['polling-service', 'heartbeat', 'analytics'],
        custom: {
          environment: 'production',
          clientId: 'destiny-inventory-manager'
        }
      }
    }
  };