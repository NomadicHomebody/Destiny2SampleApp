// env.config.js
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
const result = dotenv.config();

if (result.error) {
  console.warn('No .env file found, using process.env variables only');
}

// Define default fallback values
const defaultValues = {
  BUNGIE_API_KEY: 'API_KEY', // Default development key
  BUNGIE_CLIENT_ID: 'CLIENT_ID',                          // Default development client ID
  BUNGIE_CLIENT_SECRET: 'CLIENT_SECRET', // Default development secret
  API_URL: 'https://www.bungie.net/Platform',
  AUTH_URL: 'https://www.bungie.net/en/OAuth/Authorize',
  TOKEN_URL: 'https://www.bungie.net/Platform/App/OAuth/token/',
  REDIRECT_URL: 'https://localhost:4433/auth/callback'
};

// Read environment variables with fallbacks to default values
const envValues = {
  bungieApiKey: process.env.BUNGIE_API_KEY || defaultValues.BUNGIE_API_KEY,
  bungieClientId: process.env.BUNGIE_CLIENT_ID || defaultValues.BUNGIE_CLIENT_ID,
  bungieClientSecret: process.env.BUNGIE_CLIENT_SECRET || defaultValues.BUNGIE_CLIENT_SECRET,
  apiUrl: process.env.API_URL || defaultValues.API_URL,
  authUrl: process.env.AUTH_URL || defaultValues.AUTH_URL,
  tokenUrl: process.env.TOKEN_URL || defaultValues.TOKEN_URL,
  redirectUrl: process.env.REDIRECT_URL || defaultValues.REDIRECT_URL
};

// Create the environment files content
const environmentFileContent = `
// This file is auto-generated by env.config.js
// Do not edit this file directly - change values in .env file or set environment variables

export const environment = {
  production: false,
  bungie: {
    apiKey: '${envValues.bungieApiKey}',
    apiRoot: '${envValues.apiUrl}',
    authUrl: '${envValues.authUrl}',
    tokenUrl: '${envValues.tokenUrl}',
    clientId: '${envValues.bungieClientId}',
    clientSecret: '${envValues.bungieClientSecret}',
    redirectUrl: '${envValues.redirectUrl}',
    redirectConfig: {
      useCurrentHost: false,
      protocol: '${new URL(envValues.redirectUrl).protocol.replace(':', '')}',
      host: '${new URL(envValues.redirectUrl).hostname}',
      port: '${new URL(envValues.redirectUrl).port}',
      path: '${new URL(envValues.redirectUrl).pathname}'
    }
  },
  logging: {
    minLevel: 'DEBUG',
    emitters: {
      console: true,
      remote: true,
      file: true
    },
    remoteEndpoints: [
      'http://localhost:3000/api/logs'
    ],
    file: {
      enabled: true,
      basePath: './data/logs/',
      folderNamePrefix: 'destiny-app-',
      maxSize: 10 * 1024 * 1024,
      maxFiles: 5,
      compress: true,
      rotationPeriod: 'daily',
      filenamePattern: '{prefix}log-{date}.json'
    },
    offline: {
      enabled: true,
      maxBufferSize: 50,
      syncWhenOnline: true
    },
    maxStoredLogs: 100,
    includeStacksInProduction: false,
    appVersion: '1.0.0',
    filters: {
      excludeSources: ['polling-service', 'heartbeat'],
      custom: {
        environment: 'development',
        clientId: 'destiny-inventory-manager'
      }
    }
  }
};

// Production environment
export const productionEnvironment = {
  production: true,
  bungie: {
    apiKey: '${envValues.bungieApiKey}',
    apiRoot: '${envValues.apiUrl}',
    authUrl: '${envValues.authUrl}',
    tokenUrl: '${envValues.tokenUrl}',
    clientId: '${envValues.bungieClientId}',
    clientSecret: '${envValues.bungieClientSecret}',
    redirectUrl: '${envValues.redirectUrl}',
    redirectConfig: {
      useCurrentHost: false,
      protocol: '${new URL(envValues.redirectUrl).protocol.replace(':', '')}',
      host: '${new URL(envValues.redirectUrl).hostname}',
      port: '${new URL(envValues.redirectUrl).port}',
      path: '${new URL(envValues.redirectUrl).pathname}'
    }
  },
  logging: {
    minLevel: 'INFO',
    emitters: {
      console: false,
      remote: true,
      file: true
    },
    remoteEndpoints: [
      'https://api.yourproduction.com/logs'
    ],
    file: {
      enabled: true,
      basePath: '/var/log/destiny-app/',
      folderNamePrefix: 'prod-',
      maxSize: 100 * 1024 * 1024,
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
`;

// Ensure the environments directory exists
const environmentsDir = './src/environments';
if (!fs.existsSync(environmentsDir)) {
  fs.mkdirSync(environmentsDir, { recursive: true });
}

// Write the environment files
fs.writeFileSync(
  './src/environments/environment.ts',
  environmentFileContent.trim()
);

// Log environment values with sensitive data partially masked
console.log('Environment configuration generated:');
console.log(`  API Key: ${envValues.bungieApiKey.substring(0, 5)}...${envValues.bungieApiKey.substring(envValues.bungieApiKey.length - 5)}`);
console.log(`  Client ID: ${envValues.bungieClientId}`);
console.log(`  Client Secret: ${envValues.bungieClientSecret.substring(0, 5)}...${envValues.bungieClientSecret.substring(envValues.bungieClientSecret.length - 5)}`);
console.log(`  API URL: ${envValues.apiUrl}`);
console.log(`  Redirect URL: ${envValues.redirectUrl}`);