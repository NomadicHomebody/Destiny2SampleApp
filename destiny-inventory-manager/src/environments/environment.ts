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
    
    // Enable console output
    enableConsole: true,
    
    // Enable sending logs to server
    enableRemote: false,
    
    // Remote logging endpoint (only used if enableRemote is true)
    remoteEndpoint: 'http://localhost:3000/api/logs',
    
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
    enableConsole: false,
    enableRemote: false,
    remoteEndpoint: 'https://your-api.com/api/logs',
    maxStoredLogs: 50,
    includeStacksInProduction: true,
    appVersion: '1.0.0'
  }
};  
  