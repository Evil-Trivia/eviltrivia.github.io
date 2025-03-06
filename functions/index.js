const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors')({origin: true});
const axios = require('axios');
const querystring = require('querystring');

// Initialize Firebase Admin
admin.initializeApp();

// Create Express app
const app = express();
app.use(cors);

// Diagnostic route
app.get('/debug', (req, res) => {
  const clientId = functions.config().patreon?.client_id || 'NOT SET';
  const clientSecret = functions.config().patreon?.client_secret ? 'SET (Hidden)' : 'NOT SET';
  const redirectUri = functions.config().patreon?.redirect_uri || 'NOT SET';
  
  res.json({
    clientIdSet: clientId !== 'NOT SET',
    clientIdLength: clientId !== 'NOT SET' ? clientId.length : 0,
    clientSecretSet: clientSecret !== 'NOT SET',
    redirectUri: redirectUri
  });
});

// Route to initiate Patreon OAuth
app.get('/auth/patreon', (req, res) => {
  // Get configs with fallbacks
  const clientId = functions.config().patreon?.client_id || '';
  const redirectUri = functions.config().patreon?.redirect_uri || '';
  
  console.log('Starting Patreon auth with client ID length:', clientId.length);
  console.log('Redirect URI:', redirectUri);
  
  if (!clientId) {
    return res.status(500).send('Patreon client ID not configured');
  }
  
  try {
    // Redirect to Patreon OAuth page with explicit scope parameter
    const authUrl = 'https://www.patreon.com/oauth2/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: `${functions.config().patreon?.redirect_uri}/auth/patreon/callback`,
        scope: 'identity identity[email] identity.memberships campaigns.members'
      });
    
    console.log('Redirecting to Patreon auth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error redirecting to Patreon:', error);
    res.status(500).send('Error redirecting to Patreon: ' + error.message);
  }
});

// Rest of your code...
// Route to handle Patreon OAuth callback and other functions

// Export the Express app as a Cloud Function
exports.patreonAuth = functions.https.onRequest(app);

// Simple test function (keep this for verification)
exports.hello = functions.https.onRequest((req, res) => {
  res.send('Hello from Firebase!');
});
