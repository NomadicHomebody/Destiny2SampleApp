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
  }
};
