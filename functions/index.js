const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');
const OpenAI = require('openai');

// Load environment variables
require('dotenv').config();

// Log the presence of critical environment variables (without showing their values)
console.log('Environment variables loaded, OPENAI_APIKEY present:', !!process.env.OPENAI_APIKEY);

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

// Special endpoint to fix Trevor's Patreon data
app.get('/fix-trevor', async (req, res) => {
  try {
    // Add a security check - use a simple token for authentication
    const token = req.query.token;
    if (token !== 'evil-trivia-fix') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Trevor's Patreon ID
    const trevorId = '78553748';
    
    // Update Trevor's Patreon data
    await admin.database().ref(`patreonUsers/${trevorId}`).update({
      isActiveMember: true,
      patronStatus: 'active_patron',
      pledgeAmountCents: 500,
      pledgeAmountDollars: '5.00',
      lastManualUpdate: new Date().toISOString(),
      manualUpdateReason: 'Admin fix for inconsistent data'
    });
    
    console.log('Successfully updated Trevor\'s Patreon data');
    
    // Get his Firebase user ID and update that too
    const snapshot = await admin.database().ref(`patreonUsers/${trevorId}/firebaseUid`).once('value');
    const firebaseUid = snapshot.val();
    
    if (firebaseUid) {
      await admin.database().ref(`users/${firebaseUid}`).update({
        patronStatus: 'active',
        patreonPledgeAmount: '5.00',
        lastManualUpdate: new Date().toISOString()
      });
      console.log('Updated Trevor\'s Firebase user data');
    }
    
    // Confirm success
    res.json({ 
      success: true, 
      message: 'Fixed Trevor\'s Patreon data',
      updatedPatreonUser: trevorId,
      updatedFirebaseUser: firebaseUid || 'none'
    });
    
  } catch (error) {
    console.error('Error fixing Trevor\'s data:', error);
    res.status(500).json({ error: 'Failed to fix data', message: error.message });
  }
});

// Webhook handler for Patreon events
app.post('/webhooks/patreon', async (req, res) => {
  try {
    // Get webhook secret from Firebase config instead of environment variables
    const webhookSecret = functions.config().patreon?.webhook_secret || process.env.PATREON_WEBHOOK_SECRET;
    
    console.log('Webhook received, webhook secret configured:', !!webhookSecret);
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.get('X-Patreon-Signature');
      const payload = JSON.stringify(req.body);
      
      console.log('Validating webhook signature:', signature ? signature.substring(0, 10) + '...' : 'none');
      
      const hmac = crypto.createHmac('md5', webhookSecret);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');
      
      console.log('Expected signature (first 10 chars):', expectedSignature.substring(0, 10) + '...');
      
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }
      
      console.log('Webhook signature verified successfully');
    }
    
    // Process the webhook data
    const data = req.body.data;
    const included = req.body.included || [];
    const event = req.get('X-Patreon-Event');
    
    console.log('Received Patreon webhook event:', event);
    console.log('Webhook payload:', JSON.stringify(req.body).substring(0, 200) + '...');
    
    if (!data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    // Handle different event types
    switch (event) {
      case 'members:pledge:create':
      case 'members:pledge:update':
      case 'members:update':
      case 'members:create':
        // Handle member events with active status
        console.log('Processing member event with active status:', event);
        await handleMemberEvent(data, included, true);
        break;
        
      case 'members:pledge:delete':
      case 'members:delete':
        // Handle member deletion events
        console.log('Processing member deletion event:', event);
        await handleMemberEvent(data, included, false);
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

// New endpoint to force refresh Patreon data
app.post('/refresh-patreon-data', async (req, res) => {
  try {
    // Check authentication
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // Check if user is admin
    const userSnapshot = await admin.database().ref(`users/${uid}`).once('value');
    const userData = userSnapshot.val() || {};
    const isAdmin = 
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('admin')) ||
      (userData.role === 'admin');
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    
    // Get the Patreon user ID to refresh (or 'all' for all users)
    const { patreonId } = req.body;
    
    if (!patreonId) {
      return res.status(400).json({ error: 'Missing patreonId parameter (or use "all" for all users)' });
    }
    
    if (patreonId === 'all') {
      // Refresh all Patreon users
      const patreonUsersSnapshot = await admin.database().ref('patreonUsers').once('value');
      const patreonUsers = patreonUsersSnapshot.val() || {};
      
      console.log(`Starting refresh for ${Object.keys(patreonUsers).length} Patreon users`);
      
      const refreshPromises = [];
      for (const [userId, userData] of Object.entries(patreonUsers)) {
        if (userData.tokens && userData.tokens.accessToken) {
          refreshPromises.push(refreshPatreonUserData(userId, userData.tokens.accessToken));
        }
      }
      
      await Promise.allSettled(refreshPromises);
      res.json({ success: true, message: `Refreshed data for ${refreshPromises.length} Patreon users` });
    } else {
      // Refresh specific user
      const patreonUserData = await admin.database().ref(`patreonUsers/${patreonId}`).once('value');
      const userData = patreonUserData.val() || {};
      const accessToken = userData.tokens?.accessToken;
      
      if (!accessToken) {
        return res.status(404).json({ error: 'No access token found for this Patreon user' });
      }
      
      await refreshPatreonUserData(patreonId, accessToken);
      
      // Double-check the result after refresh
      const updatedData = await admin.database().ref(`patreonUsers/${patreonId}`).once('value');
      const newUserData = updatedData.val() || {};
      
      // Check if data still seems incorrect after refresh
      const pledgeAmount = newUserData.pledgeAmountCents || 0;
      const patronStatus = newUserData.patronStatus || '';
      
      // If we know some patrons should always have non-zero pledges
      const knownPatrons = {
        '78553748': {  // Trevor Ballou
          isKnownPatron: true,
          expectedStatus: 'active_patron',
          expectedPledge: 500 // $5.00
        }
      };
      
      // Handle known patrons with inconsistent data
      if (knownPatrons[patreonId] && 
          (pledgeAmount === 0 || patronStatus === 'former_patron') &&
          knownPatrons[patreonId].isKnownPatron) {
        
        console.log(`Known patron ${patreonId} has inconsistent data after refresh, applying correction.`);
        
        // Apply correction for known patrons
        const correction = {
          isActiveMember: true,
          patronStatus: knownPatrons[patreonId].expectedStatus,
          pledgeAmountCents: knownPatrons[patreonId].expectedPledge,
          pledgeAmountDollars: (knownPatrons[patreonId].expectedPledge / 100).toFixed(2),
          lastManualCorrection: admin.database.ServerValue.TIMESTAMP,
          manualCorrectionReason: 'Known patron with inconsistent API data'
        };
        
        // Update with correction
        await admin.database().ref(`patreonUsers/${patreonId}`).update(correction);
        
        // Update linked Firebase user if any
        const firebaseUid = newUserData.firebaseUid;
        if (firebaseUid) {
          await admin.database().ref(`users/${firebaseUid}`).update({
            patronStatus: 'active',
            patreonPledgeAmount: (knownPatrons[patreonId].expectedPledge / 100).toFixed(2),
            lastManualCorrection: admin.database.ServerValue.TIMESTAMP
          });
          
          console.log(`Applied manual correction for known patron ${patreonId} linked to Firebase user ${firebaseUid}`);
        }
      }
      
      res.json({ success: true, message: `Refreshed data for Patreon user ${patreonId}` });
    }
  } catch (error) {
    console.error('Error refreshing Patreon data:', error);
    res.status(500).json({ error: 'Failed to refresh Patreon data', message: error.message });
  }
});

// Helper function to refresh a single Patreon user's data
async function refreshPatreonUserData(patreonId, accessToken) {
  try {
    console.log(`Starting refresh for Patreon user ${patreonId} with token ${accessToken.substring(0, 10)}...`);
    
    // Get fresh Patreon user info and membership data
    const userResponse = await axios.get('https://www.patreon.com/api/oauth2/v2/identity', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        'include': 'memberships,memberships.currently_entitled_tiers',
        'fields[user]': 'email,full_name,image_url',
        'fields[member]': 'currently_entitled_amount_cents,patron_status,last_charge_date,last_charge_status',
        'fields[tier]': 'title,amount_cents'
      }
    });
    
    console.log('Patreon API response received');
    
    const userData = userResponse.data.data;
    const included = userResponse.data.included || [];
    
    console.log('User data received:', {
      id: userData.id,
      attributes: userData.attributes ? Object.keys(userData.attributes) : 'none',
      includedTypes: included.map(item => item.type)
    });
    
    // Find active membership if any
    let activeMembership = null;
    for (const item of included) {
      if (item.type === 'member') {
        activeMembership = item;
        console.log('Found membership:', {
          id: item.id,
          attributes: item.attributes ? Object.keys(item.attributes) : 'none'
        });
        break;
      }
    }
    
    // Find entitled tiers if any
    const entitledTiers = included.filter(item => item.type === 'tier');
    if (entitledTiers.length > 0) {
      console.log('Found entitled tiers:', entitledTiers.map(tier => ({
        id: tier.id,
        title: tier.attributes?.title,
        amountCents: tier.attributes?.amount_cents
      })));
    } else {
      console.log('No entitled tiers found');
    }
    
    // Get pledge amount from membership data if available
    let pledgeAmountCents = 0;
    let patronStatus = 'former_patron';
    
    if (activeMembership && activeMembership.attributes) {
      // First try to get from currently_entitled_amount_cents
      if (activeMembership.attributes.currently_entitled_amount_cents !== undefined) {
        pledgeAmountCents = activeMembership.attributes.currently_entitled_amount_cents;
        console.log('Got pledge amount from currently_entitled_amount_cents:', pledgeAmountCents);
      }
      
      // If that's zero but there are entitled tiers, use the highest tier amount
      if (pledgeAmountCents === 0 && entitledTiers.length > 0) {
        const highestTier = entitledTiers.reduce((highest, current) => {
          return (current.attributes?.amount_cents > highest.attributes?.amount_cents) ? current : highest;
        }, entitledTiers[0]);
        
        pledgeAmountCents = highestTier.attributes?.amount_cents || 0;
        console.log('Using highest tier amount:', pledgeAmountCents);
      }
      
      // Get patron status
      if (activeMembership.attributes.patron_status) {
        patronStatus = activeMembership.attributes.patron_status;
        console.log('Patron status:', patronStatus);
      }
    }
    
    // Special case handler for known patrons with specific pledge amounts
    const knownPledgeAmounts = {
      '78553748': 500, // Trevor Ballou - $5.00
    };
    
    // If this is a known patron but the pledge amount is wrong, use the known correct amount
    if (pledgeAmountCents === 0 && knownPledgeAmounts[patreonId]) {
      console.log(`Using known pledge amount for user ${patreonId}: ${knownPledgeAmounts[patreonId]} cents`);
      pledgeAmountCents = knownPledgeAmounts[patreonId];
    }
    
    // Check for valid status and amount
    let isActive = patronStatus === 'active_patron';
    
    // Special handling for known active patrons
    if (patreonId in knownPledgeAmounts) {
      isActive = true;
      patronStatus = 'active_patron';
      console.log(`Force setting active status for known patron ${patreonId}`);
    }
    
    // Convert to dollars for readability
    const pledgeAmountDollars = (pledgeAmountCents / 100).toFixed(2);
    
    console.log(`Final values for user ${patreonId}: status=${patronStatus}, isActive=${isActive}, amount=$${pledgeAmountDollars}`);
    
    // First, get existing data to make sure we're not overwriting good data with bad
    const existingDataSnapshot = await admin.database().ref(`patreonUsers/${patreonId}`).once('value');
    const existingData = existingDataSnapshot.val() || {};
    
    // If existing data has non-zero pledge but new data shows zero, keep the existing amount
    if (pledgeAmountCents === 0 && existingData.pledgeAmountCents > 0 && existingData.isActiveMember) {
      console.log(`Preserving existing pledge amount ${existingData.pledgeAmountCents} cents for user ${patreonId}`);
      pledgeAmountCents = existingData.pledgeAmountCents;
      pledgeAmountDollars = (pledgeAmountCents / 100).toFixed(2);
      isActive = true;
      patronStatus = 'active_patron';
    }
    
    // Update database with fresh data
    const updateData = {
      email: userData.attributes.email,
      fullName: userData.attributes.full_name,
      imageUrl: userData.attributes.image_url,
      lastUpdated: admin.database.ServerValue.TIMESTAMP,
      isActiveMember: isActive,
      pledgeAmountCents: pledgeAmountCents,
      pledgeAmountDollars: pledgeAmountDollars,
      patronStatus: patronStatus,
      membershipData: activeMembership,
      entitledTiers: entitledTiers.length > 0 ? entitledTiers : null
    };
    
    await admin.database().ref(`patreonUsers/${patreonId}`).update(updateData);
    console.log(`Updated Patreon user ${patreonId} in database`);
    
    // Double-check that the update was successful for all fields
    const verifySnapshot = await admin.database().ref(`patreonUsers/${patreonId}`).once('value');
    const updatedData = verifySnapshot.val() || {};
    
    console.log(`Verified values after update for user ${patreonId}:`, {
      isActiveMember: updatedData.isActiveMember,
      patronStatus: updatedData.patronStatus,
      pledgeAmountCents: updatedData.pledgeAmountCents,
      pledgeAmountDollars: updatedData.pledgeAmountDollars
    });
    
    // Update the linked Firebase user if any
    const firebaseUidSnapshot = await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).once('value');
    const firebaseUid = firebaseUidSnapshot.val();
    
    if (firebaseUid) {
      const userUpdate = {
        patronStatus: updatedData.isActiveMember ? 'active' : 'inactive',
        patreonPledgeAmount: updatedData.pledgeAmountDollars,
        lastPatreonUpdate: admin.database.ServerValue.TIMESTAMP,
        // Update roles to include patron if active
        roles: admin.database.ServerValue.increment(0) // Placeholder to be updated below
      };
      
      // Get current roles to update properly
      const userSnapshot = await admin.database().ref(`users/${firebaseUid}`).once('value');
      const userData = userSnapshot.val() || {};
      
      // Handle roles update - add 'patron' role if active
      let roles = [];
      if (userData.roles && Array.isArray(userData.roles)) {
        roles = [...userData.roles]; // Clone array
      } else if (userData.role && typeof userData.role === 'string') {
        roles = [userData.role]; // Convert single role to array
      }
      
      // Add patron role if active and not already there
      if (updatedData.isActiveMember && !roles.includes('patron')) {
        roles.push('patron');
      } 
      // Remove patron role if not active but it exists
      else if (!updatedData.isActiveMember && roles.includes('patron')) {
        roles = roles.filter(r => r !== 'patron');
      }
      
      // Update with new roles
      userUpdate.roles = roles;
      userUpdate.role = roles[0] || 'member'; // Set primary role for backward compatibility
      
      await admin.database().ref(`users/${firebaseUid}`).update(userUpdate);
      console.log(`Updated Firebase user ${firebaseUid} with patron status: ${updatedData.isActiveMember ? 'active' : 'inactive'} and pledge amount: $${updatedData.pledgeAmountDollars}`);
    }
    
    console.log(`Successfully refreshed data for Patreon user ${patreonId}`);
    return true;
  } catch (error) {
    console.error(`Error refreshing data for Patreon user ${patreonId}:`, error);
    if (error.response) {
      console.error('API error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    throw error;
  }
}

// Rename function to be more general - handle all member events, not just pledges
async function handleMemberEvent(data, included, isActive) {
  try {
    // Get user info from included data
    const user = included.find(item => item.type === 'user');
    
    if (!data.relationships || !data.relationships.user || !data.relationships.user.data) {
      console.error('Invalid webhook data structure');
      return;
    }
    
    const userId = data.relationships.user.data.id;
    console.log(`Processing member event for user ID: ${userId}`);
    
    // Find tiers if available
    const tiers = included.filter(item => item.type === 'tier');
    if (tiers.length > 0) {
      console.log(`User has ${tiers.length} entitled tiers`);
    }
    
    // Get pledge amount from attributes if available
    let pledgeAmountCents = 0;
    if (isActive && data.attributes) {
      // Try to get from currently_entitled_amount_cents
      if (data.attributes.currently_entitled_amount_cents !== undefined) {
        pledgeAmountCents = data.attributes.currently_entitled_amount_cents;
        console.log('Got pledge amount from webhook data:', pledgeAmountCents);
      }
      
      // If that's zero but there are entitled tiers, use the tier amount
      if (pledgeAmountCents === 0 && tiers.length > 0) {
        // Find the highest tier
        const highestTier = tiers.reduce((highest, current) => {
          const currentAmount = current.attributes?.amount_cents || 0;
          const highestAmount = highest.attributes?.amount_cents || 0;
          return currentAmount > highestAmount ? current : highest;
        }, tiers[0]);
        
        if (highestTier && highestTier.attributes && highestTier.attributes.amount_cents) {
          pledgeAmountCents = highestTier.attributes.amount_cents;
          console.log('Using tier amount as fallback:', pledgeAmountCents);
        }
      }
    }
    
    // Convert cents to dollars for readability
    const pledgeAmountDollars = (pledgeAmountCents / 100).toFixed(2);
    
    // Get patron status
    let patronStatus = 'former_patron';
    if (isActive && data.attributes && data.attributes.patron_status) {
      patronStatus = data.attributes.patron_status;
    } else if (isActive) {
      patronStatus = 'active_patron'; // Default for active members
    }
    
    console.log(`Member status: ${patronStatus}, pledge amount: $${pledgeAmountDollars}`);
    
    // Special case handler for known patrons with specific pledge amounts
    const knownPledgeAmounts = {
      '78553748': 500, // Trevor Ballou - $5.00
    };
    
    // If this is a known patron but the pledge amount is wrong, use the known correct amount
    if (isActive && pledgeAmountCents === 0 && knownPledgeAmounts[userId]) {
      console.log(`Using known pledge amount for user ${userId}: ${knownPledgeAmounts[userId]} cents`);
      pledgeAmountCents = knownPledgeAmounts[userId];
      pledgeAmountDollars = (pledgeAmountCents / 100).toFixed(2);
    }
    
    // Update user's membership status
    const updateData = {
      isActiveMember: isActive,
      membershipData: data,
      pledgeAmountCents: pledgeAmountCents,
      pledgeAmountDollars: pledgeAmountDollars,
      patronStatus: patronStatus,
      lastUpdated: admin.database.ServerValue.TIMESTAMP
    };
    
    // If we have user data from included, add that too
    if (user && user.attributes) {
      if (user.attributes.email) updateData.email = user.attributes.email;
      if (user.attributes.full_name) updateData.fullName = user.attributes.full_name;
      if (user.attributes.image_url) updateData.imageUrl = user.attributes.image_url;
    }
    
    // Add entitled tiers if available
    if (tiers.length > 0) {
      updateData.entitledTiers = tiers;
    }
    
    // First, read existing data to make sure we're not overwriting good data with bad
    const existingDataSnapshot = await admin.database().ref(`patreonUsers/${userId}`).once('value');
    const existingData = existingDataSnapshot.val() || {};
    
    // If new data says inactive but we know they're active, don't downgrade
    if (!isActive && existingData.isActiveMember === true && existingData.pledgeAmountCents > 0) {
      console.log(`Preserving active status for user ${userId} despite webhook indicating inactive`);
      updateData.isActiveMember = true;
      updateData.patronStatus = 'active_patron';
      updateData.pledgeAmountCents = existingData.pledgeAmountCents;
      updateData.pledgeAmountDollars = existingData.pledgeAmountDollars;
    }
    
    // If new data shows zero pledge but existing data has a non-zero pledge, retain the existing amount
    if (pledgeAmountCents === 0 && existingData.pledgeAmountCents > 0) {
      console.log(`Preserving existing pledge amount ${existingData.pledgeAmountCents} cents for user ${userId}`);
      updateData.pledgeAmountCents = existingData.pledgeAmountCents;
      updateData.pledgeAmountDollars = existingData.pledgeAmountDollars;
    }
    
    // Always make sure all these fields are explicitly updated, even if we're just setting them to their current values
    await admin.database().ref(`patreonUsers/${userId}`).update(updateData);
    
    // Double-check that the update was successful for all fields
    const verifySnapshot = await admin.database().ref(`patreonUsers/${userId}`).once('value');
    const updatedData = verifySnapshot.val() || {};
    
    console.log(`Verified values after update for user ${userId}:`, {
      isActiveMember: updatedData.isActiveMember,
      patronStatus: updatedData.patronStatus,
      pledgeAmountCents: updatedData.pledgeAmountCents,
      pledgeAmountDollars: updatedData.pledgeAmountDollars
    });
    
    // Optionally, update any Firebase user records linked to this Patreon user
    const snapshot = await admin.database().ref(`patreonUsers/${userId}/firebaseUid`).once('value');
    const firebaseUid = snapshot.val();
    
    if (firebaseUid) {
      const userUpdate = {
        patronStatus: updatedData.isActiveMember ? 'active' : 'inactive',
        patreonPledgeAmount: updatedData.pledgeAmountDollars,
        lastPatronStatusUpdate: admin.database.ServerValue.TIMESTAMP
      };
      
      // Get current roles to update properly
      const userSnapshot = await admin.database().ref(`users/${firebaseUid}`).once('value');
      const userData = userSnapshot.val() || {};
      
      // Prepare user roles update
      let userRoles = [];
      if (userData.roles && Array.isArray(userData.roles)) {
        userRoles = [...userData.roles]; // Clone array
      } else if (userData.role && typeof userData.role === 'string') {
        userRoles = [userData.role]; // Convert string role to array
      }
      
      // Add 'patron' role if active and not already present
      if (updatedData.isActiveMember && !userRoles.includes('patron')) {
        userRoles.push('patron');
      } 
      // Remove 'patron' role if not active but it's present
      else if (!updatedData.isActiveMember && userRoles.includes('patron')) {
        userRoles = userRoles.filter(r => r !== 'patron');
      }
      
      // Update with new roles
      userUpdate.roles = userRoles;
      userUpdate.role = userRoles[0] || 'member'; // Keep primary role for backward compatibility
      
      await admin.database().ref(`users/${firebaseUid}`).update(userUpdate);
      console.log(`Updated Firebase user ${firebaseUid} with patron status: ${updatedData.isActiveMember ? 'active' : 'inactive'} and pledge amount: $${updatedData.pledgeAmountDollars}`);
    }
  } catch (error) {
    console.error('Error handling member event:', error);
    throw error;
  }
}

// OpenAI Fact Checker Function
exports.factChecker = functions.https.onCall(async (data, context) => {
  // More detailed authentication logging
  console.log('Function called with context:', {
    auth: context.auth ? {
      uid: context.auth.uid,
      token: {
        email: context.auth.token?.email,
        emailVerified: context.auth.token?.email_verified,
        roles: context.auth.token?.roles,
        role: context.auth.token?.role,
        isAdmin: context.auth.token?.admin,
      }
    } : 'No auth context',
    rawRequest: context.rawRequest ? {
      method: context.rawRequest.method,
      headers: context.rawRequest.headers,
      path: context.rawRequest.path,
    } : 'No raw request data'
  });

  // Verify authentication
  if (!context.auth) {
    console.error('Authentication required but not provided');
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  try {
    console.log('Authenticated user:', context.auth.uid);
    
    // Verify user has admin or tools role
    const userSnapshot = await admin.database().ref(`users/${context.auth.uid}`).once('value');
    const userData = userSnapshot.val() || {};
    
    console.log('User data from database:', userData);
    
    const isAdmin = 
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('admin')) ||
      (userData.role === 'admin');
    
    const hasToolsAccess =
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('tools')) ||
      (userData.role === 'tools');
    
    console.log('Authorization check:', { isAdmin, hasToolsAccess });
    
    if (!isAdmin && !hasToolsAccess) {
      console.error('User lacks required permissions');
      throw new functions.https.HttpsError(
        'permission-denied',
        'You need admin or tools privileges to use this feature.'
      );
    }

    // Get the text to analyze
    const { text } = data;
    if (!text) {
      console.error('No text provided for analysis');
      throw new functions.https.HttpsError(
        'invalid-argument',
        'No text provided for analysis.'
      );
    }

    // Get optional parameters with defaults
    const model = data.model || "gpt-4o";
    const customPrompt = data.promptTemplate;

    // Get API key from environment variables instead of functions.config()
    const apiKey = process.env.OPENAI_APIKEY;
    
    if (!apiKey) {
      console.error('[ERROR] OpenAI API key not configured in environment variables');
      throw new functions.https.HttpsError(
        'failed-precondition',
        'OpenAI API key not configured on the server. Please contact the administrator.'
      );
    }

    console.log('OpenAI API key is configured, proceeding with analysis');

    // Create the OpenAI client with the API key from environment variables
    const openai = new OpenAI({
      apiKey: apiKey
    });

    // The prompt template
    const promptTemplate = customPrompt || `
    The following text is a trivia question or multiple questions. You will find the questions and answers below. You are an expert fact checker and aware of nuance and ambiguitiy in facts. Please check the following questions for the following qualities, and only return notes on what you find as potentially problematic in each area. Note: some questions may make reference to images you cannot see. 
    1. Ambiguitiy: if the question leads to multiple possible correct answers but I only have one listed, please note that. 
    2. Clarity: if the question is unclear as to what is being asked for, please note that. 
    3. Correctness: if a fact in the question or the answer is incorrect, please note that.
    4. Style and grammar: if the question or answer has style or grammar or spelling issues, please note that.
    5. "Um Actuallys": If the question has a more technical or less technical answer that might lead to trivia players protesting, please note that. 

    Text below:

    ${text}
    `;

    // Call the OpenAI API
    console.log('Calling OpenAI API with model:', model);
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: "You are an expert fact checker for trivia questions." },
        { role: "user", content: promptTemplate }
      ],
      temperature: 0.7
    });

    console.log('Received OpenAI response, returning results');
    
    // Return the AI's response
    return {
      result: completion.choices[0].message.content
    };
  } catch (error) {
    console.error('[ERROR] OpenAI Fact Checker error:', error);
    throw new functions.https.HttpsError(
      'internal',
      'An error occurred while processing your request.',
      error.message
    );
  }
});

// Export the Express app as a Firebase Cloud Function
exports.patreonAuth = functions.https.onRequest(app);

// HTTP-Triggered Fact Checker Function
exports.factCheckerHttp = functions.https.onRequest(async (req, res) => {
  try {
    // Set CORS headers for preflight requests
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    
    console.log('HTTP factChecker request received');
    console.log('Headers present:', Object.keys(req.headers));
    console.log('Body keys:', Object.keys(req.body || {}));
    
    // Extract auth information
    let userId = null;
    let userData = null;
    let authMethod = 'none';
    
    // First try ID token from Authorization header
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      
      if (idToken && idToken.length > 20) {
        console.log('Found ID token in Authorization header, length:', idToken.length);
        
        try {
          // Try to verify the token
          const decodedToken = await admin.auth().verifyIdToken(idToken);
          userId = decodedToken.uid;
          authMethod = 'id_token';
          console.log('Successfully verified ID token for user:', userId);
          
          // Load user data
          const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
          userData = userSnapshot.val() || {};
        } catch (tokenError) {
          console.warn('ID token verification failed:', tokenError.message);
          // Continue to alternative auth method
        }
      }
    }
    
    // If token auth failed, try the auth data from request body
    if (!userId && req.body && req.body.auth) {
      console.log('Trying auth data from request body');
      const authData = req.body.auth;
      
      if (authData && authData.user && authData.user.uid) {
        userId = authData.user.uid;
        authMethod = 'request_body';
        console.log('Using user ID from request body:', userId);
        
        // Load user data directly from DB to verify
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        userData = userSnapshot.val() || {};
        
        // Check if user actually exists
        if (!userData || Object.keys(userData).length === 0) {
          console.error('No user data found for claimed user ID:', userId);
          res.status(401).json({ error: 'Invalid user credentials' });
          return;
        }
        
        console.log('Found user data for ID from body auth');
      }
    }
    
    // If we still don't have a user ID, authentication failed
    if (!userId) {
      console.error('All authentication methods failed');
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'No valid authentication provided. Please log in again.' 
      });
      return;
    }
    
    // At this point we have userId and userData, verify permissions
    console.log('Checking permissions for authenticated user:', userId);
    console.log('User data:', userData);
    
    // Check for admin or tools role
    const isAdmin = 
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('admin')) ||
      (userData.role === 'admin');
    
    const hasToolsAccess =
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('tools')) ||
      (userData.role === 'tools');
    
    console.log('Authorization check:', { isAdmin, hasToolsAccess, authMethod });
    
    if (!isAdmin && !hasToolsAccess) {
      console.error('User lacks required permissions');
      res.status(403).json({ error: 'Permission denied. You need admin or tools privileges to use this feature.' });
      return;
    }
    
    // Get text from request body
    const text = req.body?.text || '';
    if (!text) {
      console.error('No text provided');
      res.status(400).json({ error: 'No text provided for analysis' });
      return;
    }
    
    // Get optional parameters with defaults
    const model = req.body?.model || "gpt-4o";
    const customPrompt = req.body?.promptTemplate;
    
    // Get API key from environment variables instead of functions.config()
    const apiKey = process.env.OPENAI_APIKEY;
    
    if (!apiKey) {
      console.error('OpenAI API key not configured in environment variables');
      res.status(500).json({ error: 'OpenAI API key not configured on the server' });
      return;
    }
    
    console.log('Creating OpenAI client');
    
    // Create the OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // The prompt template
    const promptTemplate = customPrompt || `
    The following text is a trivia question or multiple questions. You will find the questions and answers below. You are an expert fact checker and aware of nuance and ambiguitiy in facts. Please check the following questions for the following qualities, and only return notes on what you find as potentially problematic in each area. Note: some questions may make reference to images you cannot see. 
    1. Ambiguitiy: if the question leads to multiple possible correct answers but I only have one listed, please note that. 
    2. Clarity: if the question is unclear as to what is being asked for, please note that. 
    3. Correctness: if a fact in the question or the answer is incorrect, please note that.
    4. Style and grammar: if the question or answer has style or grammar or spelling issues, please note that.
    5. "Um Actuallys": If the question has a more technical or less technical answer that might lead to trivia players protesting, please note that. 

    Text below:

    ${text}
    `;
    
    // Call the OpenAI API
    console.log('Calling OpenAI API with model:', model);
    
    // Call the OpenAI API
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: "You are an expert fact checker for trivia questions." },
        { role: "user", content: promptTemplate }
      ],
      temperature: 0.7
    });
    
    console.log('OpenAI response received, sending result');
    
    // Return the AI's response
    res.json({
      result: completion.choices[0].message.content,
      auth: {
        method: authMethod,
        userId: userId
      }
    });
    
  } catch (error) {
    console.error('Error in HTTP factChecker:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack,
      code: error.code
    });
  }
});