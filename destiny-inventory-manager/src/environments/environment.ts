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
  }
};
