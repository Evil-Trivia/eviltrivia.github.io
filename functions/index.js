const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');

// Initialize Firebase admin with database URL specified
admin.initializeApp({
  databaseURL: 'https://eviltrivia-47664-default-rtdb.firebaseio.com'
});

// Create Express app for Patreon auth
const app = express();

/**
 * SECURITY MIDDLEWARE
 * Only allow requests from your domain and Patreon
 */
const securityMiddleware = (req, res, next) => {
  const origin = req.get('origin');
  const referer = req.get('referer');
  const allowedOrigins = [
    'https://eviltrivia.com',
    'https://www.eviltrivia.com',
    'https://eviltrivia.github.io',
    'https://evil-trivia.github.io',
    'https://eviltrivia-47664.web.app',
    'https://eviltrivia-47664.firebaseapp.com',
    'https://patreonauth-vapvabofwq-uc.a.run.app'
  ];
  
  // Allow Patreon Callback and webhooks
  if (req.path === '/auth/patreon/callback' || req.path === '/webhooks/patreon') {
    console.log('[INFO] Allowing Patreon callback or webhook');
    return next();
  }
  
  // Always allow the Patreon auth initiation path
  if (req.path === '/auth/patreon') {
    console.log('[INFO] Allowing Patreon auth initiation');
    return next();
  }

  // Always allow the getCustomToken endpoint 
  if (req.path === '/getCustomToken') {
    console.log('[INFO] Allowing getCustomToken request');
    return next();
  }
  
  // Always allow the debug endpoint
  if (req.path === '/debug-config') {
    console.log('[INFO] Allowing debug-config request');
    return next();
  }
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    console.log('[INFO] Allowing request from origin:', origin);
    return next();
  }
  
  // Check referer as fallback
  if (referer) {
    const isAllowedReferer = allowedOrigins.some(allowed => referer.startsWith(allowed));
    if (isAllowedReferer) {
      console.log('[INFO] Allowing request from referer:', referer);
      return next();
    }
  }
  
  // Reject unauthorized requests
  console.error('[ERROR] Unauthorized request:', { 
    path: req.path, 
    method: req.method,
    origin: origin || 'none',
    referer: referer || 'none'
  });
  return res.status(403).json({ error: 'Unauthorized' });
};

// Use CORS middleware - restrict to your domain
app.use(cors({ 
  origin: [
    'https://eviltrivia.com',
    'https://www.eviltrivia.com',
    'https://eviltrivia.github.io',
    'https://evil-trivia.github.io',
    'https://eviltrivia-47664.web.app',
    'https://eviltrivia-47664.firebaseapp.com',
    'https://patreonauth-vapvabofwq-uc.a.run.app'
  ]
}));
app.use(express.json());

// Apply security middleware
app.use(securityMiddleware);

// Simple test endpoint (only for testing, consider removing in production)
app.get('/test', (req, res) => {
  res.send('Patreon Auth Function is working!');
});

// Debug endpoint to check Patreon config values (remove in production)
app.get('/debug-config', (req, res) => {
  // Don't expose actual secret values, just info about what's configured
  const config = {
    hasClientId: !!process.env.PATREON_CLIENT_ID,
    clientIdLength: process.env.PATREON_CLIENT_ID?.length || 0,
    clientIdFallback: 'Using fallback value: ' + (process.env.PATREON_CLIENT_ID ? 'No' : 'Yes'),
    hasClientSecret: !!process.env.PATREON_CLIENT_SECRET,
    clientSecretLength: process.env.PATREON_CLIENT_SECRET?.length || 0,
    clientSecretFallback: 'Using fallback value: ' + (process.env.PATREON_CLIENT_SECRET ? 'No' : 'Yes'),
    redirectUri: process.env.PATREON_REDIRECT_URI || 'Using fallback URL',
    hasWebhookSecret: !!process.env.PATREON_WEBHOOK_SECRET,
    webhookSecretFallback: 'Using fallback value: ' + (process.env.PATREON_WEBHOOK_SECRET ? 'No' : 'Yes'),
    serverTime: new Date().toISOString(),
    env: process.env.NODE_ENV || 'not set',
    firebaseAdmin: {
      isInitialized: !!admin.apps.length,
      appCount: admin.apps.length,
      projectId: admin.app().options.projectId || 'Not available',
      databaseURL: admin.app().options.databaseURL || 'Not available',
      serviceAccount: admin.app().options.credential ? 'Using provided credentials' : 'Using default credentials'
    }
  };
  
  res.json(config);
});

// Route to initiate Patreon OAuth
app.get('/auth/patreon', (req, res) => {
  // Use environment variables instead of functions.config()
  const clientId = process.env.PATREON_CLIENT_ID;
  const redirectUri = process.env.PATREON_REDIRECT_URI || 
    'https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon/callback';
  
  if (!clientId) {
    console.error('[ERROR] Patreon client ID not configured in environment variables');
    return res.status(500).send('Patreon client ID not configured. Please contact the administrator.');
  }
  
  // Set state parameter for CSRF protection
  const state = crypto.randomBytes(20).toString('hex');
  
  // Store state in database with timestamp to verify later and expire old states
  admin.database().ref(`patreonAuthStates/${state}`).set({
    createdAt: admin.database.ServerValue.TIMESTAMP,
    returnUrl: req.query.returnUrl || '/patreon.html'
  });
  
  // Redirect to Patreon OAuth page with state
  const authUrl = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=identity%20identity[email]%20identity.memberships%20campaigns.members&state=${state}`;
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Route to handle Patreon OAuth callback
app.get('/auth/patreon/callback', async (req, res) => {
  try {
    console.log('[INFO] Received Patreon callback', {
      path: req.path,
      url: req.url, 
      query: req.query,
      origin: req.get('origin'),
      referer: req.get('referer')
    });
    
    const { code, state } = req.query;
    
    if (!code) {
      console.error('[ERROR] No code parameter in callback');
      return res.redirect('/patreon.html?auth_error=true&reason=no_code');
    }
    
    // Verify state to prevent CSRF
    if (!state) {
      console.error('[ERROR] No state parameter in callback');
      return res.redirect('/patreon.html?auth_error=true&reason=invalid_state');
    }
    
    // Check if state exists in database
    const stateSnapshot = await admin.database().ref(`patreonAuthStates/${state}`).once('value');
    const stateData = stateSnapshot.val();
    
    if (!stateData) {
      console.error('Invalid state parameter');
      return res.redirect('/patreon.html?auth_error=true&reason=invalid_state');
    }
    
    // State is valid, cleanup the state entry
    await admin.database().ref(`patreonAuthStates/${state}`).remove();
    
    // Get configs using environment variables
    const clientId = process.env.PATREON_CLIENT_ID;
    const clientSecret = process.env.PATREON_CLIENT_SECRET;
    const redirectUri = process.env.PATREON_REDIRECT_URI || 
      'https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon/callback';
    
    if (!clientId || !clientSecret) {
      console.error('[ERROR] Patreon client ID or secret not configured in environment variables');
      return res.redirect('/patreon.html?auth_error=true&reason=missing_credentials');
    }
    
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://www.patreon.com/api/oauth2/token', 
      querystring.stringify({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, refresh_token } = tokenResponse.data;
    
    // Get Patreon user info and membership data
    const userResponse = await axios.get('https://www.patreon.com/api/oauth2/v2/identity', {
      headers: {
        Authorization: `Bearer ${access_token}`
      },
      params: {
        'include': 'memberships',
        'fields[user]': 'email,full_name,image_url',
        'fields[member]': 'currently_entitled_amount_cents,patron_status'
      }
    });
    
    const userData = userResponse.data.data;
    const memberships = userResponse.data.included || [];
    
    // Find active membership if any
    let activeMembership = null;
    for (const membership of memberships) {
      if (membership.type === 'member') {
        activeMembership = membership;
        break;
      }
    }
    
    // Get pledge amount from membership data if available
    const pledgeAmountCents = activeMembership && 
      activeMembership.attributes && 
      activeMembership.attributes.currently_entitled_amount_cents
        ? activeMembership.attributes.currently_entitled_amount_cents
        : 0;
    
    // Convert to dollars for readability
    const pledgeAmountDollars = (pledgeAmountCents / 100).toFixed(2);
    
    // Prepare data for database
    const patreonUserId = userData.id;
    const userInfo = {
      patreonId: patreonUserId,
      email: userData.attributes.email,
      fullName: userData.attributes.full_name,
      imageUrl: userData.attributes.image_url,
      lastUpdated: admin.database.ServerValue.TIMESTAMP,
      isActiveMember: !!activeMembership,
      pledgeAmountCents: pledgeAmountCents,
      pledgeAmountDollars: pledgeAmountDollars,
      membershipData: activeMembership,
      // Store tokens securely for future API calls
      tokens: {
        accessToken: access_token,
        refreshToken: refresh_token,
        createdAt: admin.database.ServerValue.TIMESTAMP
      }
    };
    
    // Store data in Firebase
    await admin.database().ref(`patreonUsers/${patreonUserId}`).update(userInfo);
    
    // Check if this Patreon account is already linked to a Firebase user
    const existingLinkSnapshot = await admin.database().ref(`patreonUsers/${patreonUserId}/firebaseUid`).once('value');
    let firebaseUid = existingLinkSnapshot.val();
    
    if (!firebaseUid) {
      // Check if user with this email exists
      try {
        const userRecord = await admin.auth().getUserByEmail(userData.attributes.email);
        firebaseUid = userRecord.uid;
      } catch (error) {
        // Create a new user 
        const newUser = await admin.auth().createUser({
          email: userData.attributes.email,
          displayName: userData.attributes.full_name,
          photoURL: userData.attributes.image_url
        });
        firebaseUid = newUser.uid;
        
        // Create user profile
        await admin.database().ref(`users/${firebaseUid}`).set({
          email: userData.attributes.email,
          displayName: userData.attributes.full_name,
          photoURL: userData.attributes.image_url,
          role: 'patron', 
          createdAt: admin.database.ServerValue.TIMESTAMP
        });
      }
      
      // Link accounts
      await admin.database().ref(`patreonUsers/${patreonUserId}/firebaseUid`).set(firebaseUid);
      await admin.database().ref(`users/${firebaseUid}`).update({
        patreonId: patreonUserId,
        patronStatus: !!activeMembership ? 'active' : 'inactive',
        patreonPledgeAmount: pledgeAmountDollars
      });
    }
    
    try {
      // Create custom token for Firebase Auth
      const customToken = await admin.auth().createCustomToken(firebaseUid);
      
      // Include basic Patreon user info in the redirect
      const encodedName = encodeURIComponent(userData.attributes.full_name || '');
      const encodedEmail = encodeURIComponent(userData.attributes.email || '');
      const encodedImage = encodeURIComponent(userData.attributes.image_url || '');
      const encodedTier = encodeURIComponent(activeMembership?.attributes?.patron_status || 'Connected');
      const encodedPledgeAmount = encodeURIComponent(pledgeAmountDollars);
      
      // Redirect back to the returnUrl or default to patreon.html
      const returnUrl = stateData.returnUrl || '/patreon.html';
      res.redirect(`${returnUrl}?auth_success=true&patreon_id=${patreonUserId}&firebase_token=${customToken}&patreon_name=${encodedName}&patreon_email=${encodedEmail}&patreon_image=${encodedImage}&patreon_tier=${encodedTier}&patreon_pledge=${encodedPledgeAmount}`);
    } catch (tokenError) {
      console.error('Error creating custom token:', tokenError);
      // If we can't create a custom token, we can still redirect with Patreon success
      // The client can handle this by using anonymous auth or another method
      const returnUrl = stateData.returnUrl || '/patreon.html';
      
      // Include basic Patreon user info in the redirect
      const encodedName = encodeURIComponent(userData.attributes.full_name || '');
      const encodedEmail = encodeURIComponent(userData.attributes.email || '');
      const encodedImage = encodeURIComponent(userData.attributes.image_url || '');
      const encodedTier = encodeURIComponent(activeMembership?.attributes?.patron_status || 'Connected');
      const encodedPledgeAmount = encodeURIComponent(pledgeAmountDollars);
      
      res.redirect(`${returnUrl}?auth_success=true&patreon_id=${patreonUserId}&token_error=true&patreon_name=${encodedName}&patreon_email=${encodedEmail}&patreon_image=${encodedImage}&patreon_tier=${encodedTier}&patreon_pledge=${encodedPledgeAmount}`);
    }
    
  } catch (error) {
    console.error('Patreon auth error:', error.message);
    console.error(error.stack);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    res.redirect('/patreon.html?auth_error=true&reason=token_exchange_failed');
  }
});

// Get custom token for existing Patreon link
app.get('/getCustomToken', async (req, res) => {
  try {
    const { patreonId } = req.query;
    
    if (!patreonId) {
      return res.status(400).json({ error: 'Missing patreonId parameter' });
    }
    
    // Get Firebase UID linked to this Patreon user
    const snapshot = await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).once('value');
    const firebaseUid = snapshot.val();
    
    if (!firebaseUid) {
      return res.status(404).json({ error: 'No Firebase user found for this Patreon ID' });
    }
    
    try {
      // Create custom token
      const customToken = await admin.auth().createCustomToken(firebaseUid);
      res.json({ token: customToken });
    } catch (tokenError) {
      console.error('Error creating custom token:', tokenError);
      // Return a specific error for token creation issues
      res.status(500).json({ 
        error: 'Token creation failed', 
        message: 'Could not create Firebase custom token due to permissions issues',
        patreonId: patreonId,
        firebaseUid: firebaseUid,
        manualAuth: true // Flag indicating client should try alternative auth
      });
    }
  } catch (error) {
    console.error('Error handling getCustomToken request:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Webhook handler for Patreon events
app.post('/webhooks/patreon', async (req, res) => {
  try {
    // Get webhook secret from environment variables
    const webhookSecret = process.env.PATREON_WEBHOOK_SECRET;
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.get('X-Patreon-Signature');
      const payload = JSON.stringify(req.body);
      
      const hmac = crypto.createHmac('md5', webhookSecret);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }
    }
    
    // Process the webhook data
    const data = req.body.data;
    const included = req.body.included || [];
    const event = req.get('X-Patreon-Event');
    
    console.log('Received Patreon webhook event:', event);
    
    if (!data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    // Handle different event types
    switch (event) {
      case 'members:pledge:create':
      case 'members:pledge:update':
        // Handle new/updated pledge
        await handlePledgeEvent(data, included, true);
        break;
        
      case 'members:pledge:delete':
        // Handle deleted pledge
        await handlePledgeEvent(data, included, false);
        break;
        
      default:
        console.log('Unhandled webhook event type:', event);
    }
    
    // Acknowledge receipt
    res.status(200).json({ status: 'success' });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to handle pledge events
async function handlePledgeEvent(data, included, isActive) {
  try {
    // Get user info from included data
    const user = included.find(item => item.type === 'user');
    
    if (!data.relationships || !data.relationships.user || !data.relationships.user.data) {
      console.error('Invalid webhook data structure');
      return;
    }
    
    const userId = data.relationships.user.data.id;
    
    // Get pledge amount from attributes if available
    const pledgeAmountCents = isActive && data.attributes && data.attributes.currently_entitled_amount_cents
        ? data.attributes.currently_entitled_amount_cents
        : 0;
    
    // Convert cents to dollars for readability
    const pledgeAmountDollars = (pledgeAmountCents / 100).toFixed(2);
    
    // Update user's membership status
    await admin.database().ref(`patreonUsers/${userId}`).update({
      isActiveMember: isActive,
      membershipData: data,
      pledgeAmountCents: pledgeAmountCents,
      pledgeAmountDollars: pledgeAmountDollars,
      lastUpdated: admin.database.ServerValue.TIMESTAMP
    });
    
    console.log(`Updated member ${userId} with active status: ${isActive} and pledge amount: $${pledgeAmountDollars}`);
    
    // Optionally, update any Firebase user records linked to this Patreon user
    const snapshot = await admin.database().ref(`patreonUsers/${userId}/firebaseUid`).once('value');
    const firebaseUid = snapshot.val();
    
    if (firebaseUid) {
      await admin.database().ref(`users/${firebaseUid}`).update({
        patronStatus: isActive ? 'active' : 'inactive',
        patreonPledgeAmount: pledgeAmountDollars,
        lastPatronStatusUpdate: admin.database.ServerValue.TIMESTAMP
      });
      
      console.log(`Updated Firebase user ${firebaseUid} with patron status: ${isActive ? 'active' : 'inactive'} and pledge amount: $${pledgeAmountDollars}`);
    }
  } catch (error) {
    console.error('Error handling pledge event:', error);
    throw error;
  }
}

// Export the Express app as a Firebase Cloud Function
exports.patreonAuth = functions.https.onRequest(app);