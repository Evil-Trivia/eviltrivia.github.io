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
    const patreonId = userData.id;
    const isActiveMember = !!activeMembership;
    
    // Check if this Patreon account is already linked to a Firebase user
    const existingLinkSnapshot = await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).once('value');
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
        
        // Create basic user profile
        await admin.database().ref(`users/${firebaseUid}`).set({
          email: userData.attributes.email,
          displayName: userData.attributes.full_name,
          photoURL: userData.attributes.image_url,
          role: 'patron', 
          createdAt: admin.database.ServerValue.TIMESTAMP
        });
      }
    }
    
    // Now update the user record with Patreon information (new format)
    const patreonUserData = {
      // Primary Patreon data object
      patreon: {
        id: patreonId,
        isActiveMember: isActiveMember,
        pledgeAmountCents: pledgeAmountCents,
        pledgeAmountDollars: pledgeAmountDollars,
        patronStatus: activeMembership?.attributes?.patron_status || 'former_patron',
        lastUpdated: admin.database.ServerValue.TIMESTAMP,
        email: userData.attributes.email,
        fullName: userData.attributes.full_name,
        imageUrl: userData.attributes.image_url,
        membershipData: activeMembership,
        // Store tokens securely for future API calls
        tokens: {
          accessToken: access_token,
          refreshToken: refresh_token,
          createdAt: admin.database.ServerValue.TIMESTAMP
        }
      },
      // User level fields for backward compatibility
      patronStatus: isActiveMember ? 'active' : 'inactive',
      patreonPledgeAmount: pledgeAmountDollars,
      patreonId: patreonId, // Keep this field for backward compatibility
    };
    
    // Update or establish roles
    const userSnapshot = await admin.database().ref(`users/${firebaseUid}`).once('value');
    const existingUserData = userSnapshot.val() || {};
    
    let roles = [];
    if (existingUserData.roles && Array.isArray(existingUserData.roles)) {
      roles = [...existingUserData.roles]; // Clone existing roles
    } else if (existingUserData.role && typeof existingUserData.role === 'string') {
      roles = [existingUserData.role]; // Convert single role to array
    }
    
    // Add 'patron' role if active patron
    if (isActiveMember && !roles.includes('patron')) {
      roles.push('patron');
    } else if (!isActiveMember && roles.includes('patron')) {
      // Remove patron role if inactive
      roles = roles.filter(r => r !== 'patron');
    }
    
    // Set primary role and roles array
    patreonUserData.roles = roles;
    patreonUserData.role = roles[0] || 'member'; 
    
    // Update user data
    await admin.database().ref(`users/${firebaseUid}`).update(patreonUserData);
    
    // During migration, also update patreonUsers branch for backward compatibility
    const patreonBranchData = {
      patreonId: patreonId,
      email: userData.attributes.email,
      fullName: userData.attributes.full_name,
      imageUrl: userData.attributes.image_url,
      lastUpdated: admin.database.ServerValue.TIMESTAMP,
      isActiveMember: isActiveMember,
      pledgeAmountCents: pledgeAmountCents,
      pledgeAmountDollars: pledgeAmountDollars,
      membershipData: activeMembership,
      // Store tokens securely for future API calls
      tokens: {
        accessToken: access_token,
        refreshToken: refresh_token,
        createdAt: admin.database.ServerValue.TIMESTAMP
      },
      // Link accounts
      firebaseUid: firebaseUid
    };
    
    // Update patreonUsers branch for backward compatibility
    await admin.database().ref(`patreonUsers/${patreonId}`).update(patreonBranchData);
    
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
      res.redirect(`${returnUrl}?auth_success=true&patreon_id=${patreonId}&firebase_token=${customToken}&patreon_name=${encodedName}&patreon_email=${encodedEmail}&patreon_image=${encodedImage}&patreon_tier=${encodedTier}&patreon_pledge=${encodedPledgeAmount}`);
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
      
      res.redirect(`${returnUrl}?auth_success=true&patreon_id=${patreonId}&token_error=true&patreon_name=${encodedName}&patreon_email=${encodedEmail}&patreon_image=${encodedImage}&patreon_tier=${encodedTier}&patreon_pledge=${encodedPledgeAmount}`);
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
    
    // First try the legacy path - get Firebase UID linked to this Patreon user from patreonUsers
    const snapshot = await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).once('value');
    let firebaseUid = snapshot.val();
    
    // If not found in legacy path, try to find a user with this Patreon ID in the new structure
    if (!firebaseUid) {
      console.log(`No Firebase UID found in patreonUsers for ${patreonId}, searching users branch`);
      
      // Query users who have this patreonId
      const usersSnapshot = await admin.database().ref('users').orderByChild('patreonId').equalTo(patreonId).once('value');
      const matchingUsers = usersSnapshot.val();
      
      if (matchingUsers && Object.keys(matchingUsers).length > 0) {
        // Found a user with this Patreon ID
        firebaseUid = Object.keys(matchingUsers)[0];
        console.log(`Found user ${firebaseUid} with Patreon ID ${patreonId} in users branch`);
      } else {
        // Try the new structure with patreon.id
        const newStructureSnapshot = await admin.database().ref('users')
          .orderByChild('patreon/id')
          .equalTo(patreonId)
          .once('value');
        
        const newStructureUsers = newStructureSnapshot.val();
        if (newStructureUsers && Object.keys(newStructureUsers).length > 0) {
          firebaseUid = Object.keys(newStructureUsers)[0];
          console.log(`Found user ${firebaseUid} with Patreon ID ${patreonId} in new data structure`);
        }
      }
    }
    
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

// New endpoint to refresh Patreon data for a specific user
app.post('/refresh-patreon-data', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    // Authenticate request
    let isAuthenticated = false;
    let requestIsAdmin = false;
    let userId = null;
    let authMethod = 'none';
    let userData = null;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
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
    const refreshUserIsAdmin = 
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('admin')) ||
      (userData.role === 'admin');
    
    const hasToolsAccess =
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('tools')) ||
      (userData.role === 'tools');
    
    console.log('Authorization check:', { refreshUserIsAdmin, hasToolsAccess, authMethod });
    
    if (!refreshUserIsAdmin && !hasToolsAccess) {
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

// Migration function to move Patreon data to user accounts
exports.migratePatreonToUsers = functions.https.onRequest(async (req, res) => {
  try {
    // Security check - use a simple token for authentication
    const token = req.query.token;
    if (token !== 'migrate-patreon-data-secret') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    console.log('Starting Patreon data migration...');
    
    // Fetch all patreon users
    const patreonUsersSnapshot = await admin.database().ref('patreonUsers').once('value');
    const patreonUsers = patreonUsersSnapshot.val() || {};
    
    console.log(`Found ${Object.keys(patreonUsers).length} Patreon users to migrate`);
    
    const results = {
      total: Object.keys(patreonUsers).length,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      emailLookups: 0,
      emailLookupSuccesses: 0
    };
    
    // Process each Patreon user
    for (const [patreonId, patreonData] of Object.entries(patreonUsers)) {
      console.log(`Processing Patreon user: ${patreonId}`);
      results.processed++;
      
      let firebaseUid = patreonData.firebaseUid;
      
      // If no Firebase UID, try to find a user with matching email
      if (!firebaseUid && patreonData.email) {
        results.emailLookups++;
        console.log(`No Firebase UID for Patreon user ${patreonId}, trying to find user by email: ${patreonData.email}`);
        
        try {
          // First, try to find user in Firebase Auth
          const userRecord = await admin.auth().getUserByEmail(patreonData.email);
          if (userRecord) {
            firebaseUid = userRecord.uid;
            console.log(`Found Firebase user ${firebaseUid} for email ${patreonData.email}`);
            results.emailLookupSuccesses++;
            
            // Update the link in patreonUsers
            await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).set(firebaseUid);
            console.log(`Updated firebaseUid link for Patreon user ${patreonId}`);
          }
        } catch (authError) {
          console.log(`No Firebase Auth user found for email ${patreonData.email}`);
          
          // As a fallback, search the users database for a matching email
          try {
            const usersSnapshot = await admin.database().ref('users').orderByChild('email').equalTo(patreonData.email).once('value');
            const usersData = usersSnapshot.val();
            
            if (usersData && Object.keys(usersData).length > 0) {
              // Found a user with matching email
              firebaseUid = Object.keys(usersData)[0];
              console.log(`Found user ${firebaseUid} by email in database`);
              results.emailLookupSuccesses++;
              
              // Update the link in patreonUsers
              await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).set(firebaseUid);
              console.log(`Updated firebaseUid link for Patreon user ${patreonId}`);
            }
          } catch (dbError) {
            console.error(`Error searching users by email: ${dbError.message}`);
          }
        }
      }
      
      // Skip if no Firebase UID found
      if (!firebaseUid) {
        console.log(`No Firebase UID for Patreon user ${patreonId}, skipping`);
        results.skipped++;
        results.errors.push({
          patreonId,
          reason: 'No Firebase UID found',
          email: patreonData.email || 'No email',
          name: patreonData.fullName || 'No name'
        });
        continue;
      }
      
      // Prepare the Patreon data to add to user
      const patreonUserData = {
        patreon: {
          id: patreonId,
          isActiveMember: patreonData.isActiveMember || false,
          pledgeAmountCents: patreonData.pledgeAmountCents || 0,
          pledgeAmountDollars: patreonData.pledgeAmountDollars || '0.00',
          patronStatus: patreonData.patronStatus || 'former_patron',
          email: patreonData.email,
          fullName: patreonData.fullName,
          imageUrl: patreonData.imageUrl,
          lastUpdated: patreonData.lastUpdated || admin.database.ServerValue.TIMESTAMP,
          // Store tokens securely for future API calls
          tokens: patreonData.tokens || null
        },
        // User level fields for backward compatibility
        patronStatus: patreonData.isActiveMember ? 'active' : 'inactive',
        patreonPledgeAmount: patreonData.pledgeAmountDollars || '0.00',
        patreonId: patreonId // For backward compatibility
      };
      
      // Update user roles
      try {
        const userSnapshot = await admin.database().ref(`users/${firebaseUid}`).once('value');
        const userData = userSnapshot.val() || {};
        
        let roles = [];
        if (userData.roles && Array.isArray(userData.roles)) {
          roles = [...userData.roles]; // Clone existing roles
        } else if (userData.role && typeof userData.role === 'string') {
          roles = [userData.role]; // Convert single role to array
        }
        
        // Add 'patron' role if user is active patron and doesn't already have it
        if (patreonData.isActiveMember && !roles.includes('patron')) {
          roles.push('patron');
        }
        
        // Set roles and main role
        patreonUserData.roles = roles;
        patreonUserData.role = roles[0] || 'member'; // Set primary role
      } catch (rolesError) {
        console.error(`Error handling roles for user ${firebaseUid}:`, rolesError);
        results.errors.push({
          patreonId,
          firebaseUid,
          error: 'Role processing error: ' + rolesError.message
        });
      }
      
      // Update the user with Patreon data
      try {
        await admin.database().ref(`users/${firebaseUid}`).update(patreonUserData);
        console.log(`Successfully updated user ${firebaseUid} with Patreon data`);
        results.success++;
      } catch (updateError) {
        console.error(`Error updating user ${firebaseUid}:`, updateError);
        results.failed++;
        results.errors.push({
          patreonId,
          firebaseUid,
          error: 'User update error: ' + updateError.message
        });
      }
    }
    
    console.log('Migration completed with results:', results);
    
    // Return the results
    res.json({
      success: true,
      message: 'Migration completed',
      results: results
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to refresh a single Patreon user's data
async function refreshPatreonUserData(patreonId, accessToken) {
  console.log(`Refreshing Patreon data for user ${patreonId}`);
  
  try {
    // Get existing patreon user data to merge with the new data
    const existingPatreonDataSnapshot = await admin.database().ref(`patreonUsers/${patreonId}`).once('value');
    const existingPatreonData = existingPatreonDataSnapshot.exists() ? existingPatreonDataSnapshot.val() : {};
    
    // Get Firebase user data if available
    let firebaseUser = null;
    let existingUserData = {};
    if (existingPatreonData.firebaseUid) {
      const firebaseUserSnapshot = await admin.database().ref(`users/${existingPatreonData.firebaseUid}`).once('value');
      if (firebaseUserSnapshot.exists()) {
        firebaseUser = firebaseUserSnapshot.val();
        existingUserData = firebaseUser.patreon || {};
      }
    }
    
    // Fetch user data from Patreon
    console.log(`Fetching data for Patreon user ${patreonId}`);
    const userResponse = await axios.get('https://www.patreon.com/api/oauth2/v2/identity', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        'include': 'memberships,memberships.currently_entitled_tiers',
        'fields[user]': 'email,full_name,image_url',
        'fields[member]': 'currently_entitled_amount_cents,patron_status,last_charge_date,last_charge_status,next_charge_date,is_free_trial,will_pay_amount_cents'
      }
    });
    
    const userData = userResponse.data.data;
    const included = userResponse.data.included || [];
    
    // Find any active memberships
    let activeMembership = null;
    const entitledTiers = [];
    
    // First pass: extract the membership and tiers
    for (const item of included) {
      if (item.type === 'member') {
        activeMembership = item;
      } else if (item.type === 'tier') {
        entitledTiers.push(item);
      }
    }
    
    // Use our standardized function to create consistent data
    const standardizedData = createStandardizedPatreonData(
      patreonId,
      userData,
      activeMembership,
      entitledTiers,
      accessToken,
      existingPatreonData.tokens?.refreshToken,
      existingUserData
    );
    
    // Special handling for existing API v1 pledge data that might be missing
    if (standardizedData.patreon.pledgeAmountCents === 0 && existingPatreonData.pledgeAmountCents > 0) {
      console.log(`Using existing pledge amount for user ${patreonId}: ${existingPatreonData.pledgeAmountCents} cents`);
      standardizedData.patreon.pledgeAmountCents = existingPatreonData.pledgeAmountCents;
      standardizedData.patreon.pledgeAmountDollars = (existingPatreonData.pledgeAmountCents / 100).toFixed(2);
      
      // If the user was previously active, maintain their status
      if (existingPatreonData.isActiveMember) {
        standardizedData.patreon.isActiveMember = true;
        standardizedData.patreon.patronStatus = 'active_patron';
        standardizedData.patronStatus = 'active';
      }
    }
    
    // Save updates to patreonUsers collection
    const patreonUserUpdate = {
      // Core data
      email: standardizedData.patreon.email,
      fullName: standardizedData.patreon.fullName,
      imageUrl: standardizedData.patreon.imageUrl,
      isActiveMember: standardizedData.patreon.isActiveMember,
      patronStatus: standardizedData.patreon.patronStatus,
      pledgeAmountCents: standardizedData.patreon.pledgeAmountCents,
      pledgeAmountDollars: standardizedData.patreon.pledgeAmountDollars,
      // API data
      membershipData: activeMembership,
      entitledTiers: entitledTiers.length > 0 ? entitledTiers : null,
      // Tokens (preserve refresh token)
      tokens: {
        accessToken: accessToken,
        refreshToken: existingPatreonData.tokens?.refreshToken || null,
        createdAt: admin.database.ServerValue.TIMESTAMP
      },
      // Metadata
      lastUpdated: admin.database.ServerValue.TIMESTAMP
    };
    
    console.log(`Updating patreonUsers/${patreonId} with refreshed data`);
    await admin.database().ref(`patreonUsers/${patreonId}`).update(patreonUserUpdate);
    
    // If there's a linked Firebase user, update their data
    if (firebaseUser && existingPatreonData.firebaseUid) {
      const firebaseUid = existingPatreonData.firebaseUid;
      console.log(`Updating Firebase user ${firebaseUid} with Patreon data`);
      
      // Handle roles
      let roles = [];
      if (firebaseUser.roles && Array.isArray(firebaseUser.roles)) {
        roles = [...firebaseUser.roles]; // Clone array
      } else if (firebaseUser.role && typeof firebaseUser.role === 'string') {
        roles = [firebaseUser.role]; // Convert single role to array
      }
      
      // Add/remove patron role based on active status
      if (standardizedData.patreon.isActiveMember && !roles.includes('patron')) {
        roles.push('patron');
        console.log(`Added patron role to user ${firebaseUid}`);
      } else if (!standardizedData.patreon.isActiveMember && roles.includes('patron')) {
        roles = roles.filter(r => r !== 'patron');
        console.log(`Removed patron role from user ${firebaseUid}`);
      }
      
      // Get the first role as primary
      const primaryRole = roles.length > 0 ? roles[0] : 'member';
      
      // Update the user record
      const userUpdate = {
        patreonId: patreonId,
        patronStatus: standardizedData.patronStatus,
        patreonPledgeAmount: standardizedData.patreonPledgeAmount,
        lastPatreonUpdate: admin.database.ServerValue.TIMESTAMP,
        lastPatronStatusUpdate: admin.database.ServerValue.TIMESTAMP,
        patreon: standardizedData.patreon,
        roles: roles,
        role: primaryRole
      };
      
      await admin.database().ref(`users/${firebaseUid}`).update(userUpdate);
      console.log(`Successfully updated Firebase user ${firebaseUid}`);
    }
    
    return {
      success: true,
      patreonId: patreonId,
      isActive: standardizedData.patreon.isActiveMember,
      patronStatus: standardizedData.patreon.patronStatus,
      pledgeAmount: standardizedData.patreon.pledgeAmountDollars
    };
  } catch (error) {
    console.error(`Error refreshing Patreon data for user ${patreonId}:`, error);
    throw error;
  }
}

// Export the refreshPatreonUserData function so it can be used by other modules
exports.refreshPatreonUserData = refreshPatreonUserData;

// HTTP endpoint for manually refreshing Patreon data
exports.refreshPatreonManual = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    console.log(`Manual refresh request for Patreon data: ${req.query.patreonId || 'no ID provided'}`);
    
    // Authenticate request with a simple token or admin user
    const token = req.query.token;
    let isAuthorized = token === 'refresh-patreon-data-secret';
    
    // If not using token auth, check if user is admin
    if (!isAuthorized && req.headers.authorization) {
      try {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        // Check if user has admin role
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();
        
        if (userData) {
          const isAdmin = 
            (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('admin')) ||
            (userData.role === 'admin');
          
          const hasToolsAccess =
            (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('tools')) ||
            (userData.role === 'tools');
          
          isAuthorized = isAdmin || hasToolsAccess;
        }
      } catch (authError) {
        console.error('Authentication error:', authError);
      }
    }
    
    if (!isAuthorized) {
      console.error('Unauthorized refresh attempt');
      return res.status(403).json({ error: 'Unauthorized. Requires admin access.' });
    }
    
    // Get the Patreon ID from query params
    const patreonId = req.query.patreonId;
    if (!patreonId) {
      console.error('Missing patreonId parameter');
      return res.status(400).json({ error: 'Missing patreonId parameter' });
    }
    
    console.log(`Refreshing data for Patreon user ${patreonId}`);
    
    // Get the Patreon user data
    const patreonUserSnap = await admin.database().ref(`patreonUsers/${patreonId}`).once('value');
    const patreonUserData = patreonUserSnap.val();
    
    if (!patreonUserData) {
      console.error(`Patreon user ${patreonId} not found`);
      return res.status(404).json({ error: 'Patreon user not found' });
    }
    
    // Get access token - check in multiple places for backward compatibility
    let accessToken = null;
    
    // First try to get from the tokens object
    if (patreonUserData.tokens && patreonUserData.tokens.accessToken) {
      accessToken = patreonUserData.tokens.accessToken;
    } 
    // Then check the top level accessToken
    else if (patreonUserData.accessToken) {
      accessToken = patreonUserData.accessToken;
    }
    
    // If that fails, check user data if available
    if (!accessToken && patreonUserData.firebaseUid) {
      const userSnapshot = await admin.database().ref(`users/${patreonUserData.firebaseUid}`).once('value');
      const userData = userSnapshot.val();
      
      if (userData && userData.patreon && userData.patreon.tokens && userData.patreon.tokens.accessToken) {
        accessToken = userData.patreon.tokens.accessToken;
        console.log(`Found access token in user data for Firebase user ${patreonUserData.firebaseUid}`);
      }
    }
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: 'No access token available',
        message: 'The user needs to reconnect their Patreon account to refresh their data.'
      });
    }
    
    // Call the improved refresh function
    const result = await refreshPatreonUserData(patreonId, accessToken);
    
    // Return success with details
    res.json({ 
      success: true, 
      message: `Successfully refreshed Patreon data for user ${patreonId}`,
      result: result
    });
    
  } catch (error) {
    console.error('Error refreshing Patreon data:', error);
    
    // Provide more helpful error message
    let errorMessage = 'Failed to refresh Patreon data';
    let statusCode = 500;
    
    if (error.response) {
      // For API errors, extract more detailed information
      statusCode = error.response.status || 500;
      errorMessage += `: API Error ${statusCode}`;
      
      if (error.response.data) {
        if (typeof error.response.data === 'string') {
          errorMessage += ` - ${error.response.data.substring(0, 100)}`;
        } else {
          errorMessage += ` - ${JSON.stringify(error.response.data).substring(0, 100)}`;
        }
      }
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      message: 'There was an error refreshing the Patreon data. The token may be expired or invalid.'
    });
  }
});

// Implement the missing handleMemberEvent function to process Patreon webhook events
async function handleMemberEvent(data, included, isActive) {
  try {
    // Get user info from included data
    const user = included.find(item => item.type === 'user');
    
    if (!data.relationships || !data.relationships.user || !data.relationships.user.data) {
      console.error('Invalid webhook data structure');
      return;
    }
    
    const patreonId = data.relationships.user.data.id;
    console.log(`Processing member event for user ID: ${patreonId}`);
    
    // Find tiers if available
    const tiers = included.filter(item => item.type === 'tier');
    
    // Get existing data to preserve important fields
    const existingPatreonDataSnapshot = await admin.database().ref(`patreonUsers/${patreonId}`).once('value');
    const existingPatreonData = existingPatreonDataSnapshot.exists() ? existingPatreonDataSnapshot.val() : {};
    
    let firebaseUser = null;
    let existingUserData = {};
    
    // Check if there's a linked Firebase user
    const firebaseUid = existingPatreonData.firebaseUid;
    if (firebaseUid) {
      const userSnapshot = await admin.database().ref(`users/${firebaseUid}`).once('value');
      if (userSnapshot.exists()) {
        firebaseUser = userSnapshot.val();
        existingUserData = firebaseUser.patreon || {};
      }
    }
    
    // Use our standardized data structure creator
    const standardizedData = createStandardizedPatreonData(
      patreonId,
      user,
      data,
      tiers,
      existingPatreonData.tokens?.accessToken,
      existingPatreonData.tokens?.refreshToken,
      existingUserData
    );
    
    // Override active status based on the webhook event type
    standardizedData.patreon.isActiveMember = isActive;
    standardizedData.patronStatus = isActive ? 'active' : 'inactive';
    
    if (isActive) {
      standardizedData.patreon.patronStatus = 'active_patron';
    } else if (standardizedData.patreon.patronStatus === 'active_patron') {
      standardizedData.patreon.patronStatus = 'former_patron';
    }
    
    // Update patreonUsers collection
    const patreonUpdateData = {
      email: standardizedData.patreon.email,
      fullName: standardizedData.patreon.fullName,
      imageUrl: standardizedData.patreon.imageUrl,
      isActiveMember: standardizedData.patreon.isActiveMember,
      patronStatus: standardizedData.patreon.patronStatus,
      pledgeAmountCents: standardizedData.patreon.pledgeAmountCents,
      pledgeAmountDollars: standardizedData.patreon.pledgeAmountDollars,
      isFreeTrial: standardizedData.patreon.isFreeTrial,
      isGift: standardizedData.patreon.isGift,
      willPayAmountCents: standardizedData.patreon.willPayAmountCents,
      willPayAmountDollars: standardizedData.patreon.willPayAmountDollars,
      lastChargeDate: standardizedData.patreon.lastChargeDate,
      nextChargeDate: standardizedData.patreon.nextChargeDate,
      lastUpdated: admin.database.ServerValue.TIMESTAMP,
      membershipData: data,
      entitledTiers: tiers.length > 0 ? tiers : null,
      // Preserve tokens
      tokens: existingPatreonData.tokens || null,
      // Preserve FirebaseUID link
      firebaseUid: firebaseUid
    };
    
    console.log(`Updating patreonUsers/${patreonId} from webhook event`);
    await admin.database().ref(`patreonUsers/${patreonId}`).update(patreonUpdateData);
    
    // If there's a linked Firebase user, update their record too
    if (firebaseUid) {
      console.log(`Updating Firebase user ${firebaseUid} from webhook event`);
      
      // Handle roles
      let roles = [];
      if (firebaseUser && firebaseUser.roles && Array.isArray(firebaseUser.roles)) {
        roles = [...firebaseUser.roles]; // Clone array
      } else if (firebaseUser && firebaseUser.role && typeof firebaseUser.role === 'string') {
        roles = [firebaseUser.role]; // Convert single role to array
      }
      
      // Add/remove patron role based on active status
      if (isActive && !roles.includes('patron')) {
        roles.push('patron');
        console.log(`Added patron role to user ${firebaseUid}`);
      } else if (!isActive && roles.includes('patron')) {
        roles = roles.filter(r => r !== 'patron');
        console.log(`Removed patron role from user ${firebaseUid}`);
      }
      
      // Get the first role as primary
      const primaryRole = roles.length > 0 ? roles[0] : 'member';
      
      // Update the user record
      const userUpdate = {
        patreonId: patreonId,
        patronStatus: standardizedData.patronStatus,
        patreonPledgeAmount: standardizedData.patreonPledgeAmount,
        lastPatreonUpdate: admin.database.ServerValue.TIMESTAMP,
        lastPatronStatusUpdate: admin.database.ServerValue.TIMESTAMP,
        patreon: standardizedData.patreon,
        roles: roles,
        role: primaryRole
      };
      
      await admin.database().ref(`users/${firebaseUid}`).update(userUpdate);
      console.log(`Successfully updated Firebase user ${firebaseUid} from webhook`);
    }
    
    return {
      success: true,
      patreonId: patreonId,
      firebaseUid: firebaseUid,
      isActive: isActive
    };
    
  } catch (error) {
    console.error('Error handling member event:', error);
    throw error;
  }
}

// Helper function to create standardized Patreon data structure
function createStandardizedPatreonData(patreonId, userData, membershipData, entitledTiers, accessToken, refreshToken, existingData = {}) {
  // Set default values
  let pledgeAmountCents = 0;
  let patronStatus = 'former_patron';
  let isFreeTrial = false;
  let isGift = false;
  let willPayAmountCents = 0;
  let lastChargeDate = null;
  let nextChargeDate = null;
  let isActiveMember = false;
  
  // Get data from membership if available
  if (membershipData && membershipData.attributes) {
    // Get pledge amount
    if (membershipData.attributes.currently_entitled_amount_cents !== undefined) {
      pledgeAmountCents = membershipData.attributes.currently_entitled_amount_cents;
    }
    
    // Get patron status
    if (membershipData.attributes.patron_status) {
      patronStatus = membershipData.attributes.patron_status;
    }
    
    // Check for free trial
    if (membershipData.attributes.is_free_trial) {
      isFreeTrial = true;
    }
    
    // Check for gift membership
    if (membershipData.attributes.is_gift !== undefined) {
      isGift = membershipData.attributes.is_gift;
    }
    
    // Get will_pay_amount if available
    if (membershipData.attributes.will_pay_amount_cents !== undefined) {
      willPayAmountCents = membershipData.attributes.will_pay_amount_cents;
    }
    
    // Get charge dates
    if (membershipData.attributes.last_charge_date) {
      lastChargeDate = membershipData.attributes.last_charge_date;
    }
    
    if (membershipData.attributes.next_charge_date) {
      nextChargeDate = membershipData.attributes.next_charge_date;
    }
  }
  
  // If pledge amount is zero but there are entitled tiers, use the highest tier amount
  if (pledgeAmountCents === 0 && entitledTiers && entitledTiers.length > 0) {
    // Find the highest tier
    const highestTier = entitledTiers.reduce((highest, current) => {
      const currentAmount = current.attributes?.amount_cents || 0;
      const highestAmount = highest.attributes?.amount_cents || 0;
      return currentAmount > highestAmount ? current : highest;
    }, entitledTiers[0]);
    
    if (highestTier && highestTier.attributes && highestTier.attributes.amount_cents) {
      pledgeAmountCents = highestTier.attributes.amount_cents;
    }
  }
  
  // Special case handler for known patrons with specific pledge amounts
  const knownPatrons = {
    '78553748': { // Trevor Ballou
      pledgeAmountCents: 500,
      pledgeAmountDollars: '5.00',
      isActive: true,
      patronStatus: 'active_patron'
    }
  };
  
  // Apply special case handling if needed
  if (knownPatrons[patreonId]) {
    const special = knownPatrons[patreonId];
    
    // Only override if current data looks incorrect
    if (pledgeAmountCents === 0 || patronStatus === 'former_patron') {
      pledgeAmountCents = special.pledgeAmountCents;
      patronStatus = special.patronStatus;
      isActiveMember = special.isActive;
    }
  }
  
  // Determine active status based on patron status 
  if (patronStatus === 'active_patron') {
    isActiveMember = true;
  }
  
  // If existing data has non-zero pledge but new data shows zero, keep the existing amount
  if (existingData && pledgeAmountCents === 0 && existingData.pledgeAmountCents > 0 && existingData.isActiveMember) {
    pledgeAmountCents = existingData.pledgeAmountCents;
    isActiveMember = true;
    patronStatus = 'active_patron';
  }
  
  // Convert cents to dollars for readability
  const pledgeAmountDollars = (pledgeAmountCents / 100).toFixed(2);
  const willPayAmountDollars = (willPayAmountCents / 100).toFixed(2);
  
  // Create tier details array for easier access
  const tierDetails = entitledTiers ? entitledTiers.map(tier => ({
    id: tier.id,
    title: tier.attributes?.title || 'Unknown Tier',
    amountCents: tier.attributes?.amount_cents || 0,
    amountDollars: tier.attributes?.amount_cents ? (tier.attributes.amount_cents / 100).toFixed(2) : '0.00',
    description: tier.attributes?.description || ''
  })) : [];
  
  // Build the standardized data structure
  const standardizedData = {
    // User-level fields for backward compatibility
    patreonId: patreonId,
    patronStatus: isActiveMember ? 'active' : 'inactive',
    patreonPledgeAmount: pledgeAmountDollars,
    
    // Comprehensive patreon object with all details
    patreon: {
      id: patreonId,
      isActiveMember: isActiveMember,
      pledgeAmountCents: pledgeAmountCents,
      pledgeAmountDollars: pledgeAmountDollars,
      patronStatus: patronStatus,
      isFreeTrial: isFreeTrial,
      isGift: isGift,
      willPayAmountCents: willPayAmountCents,
      willPayAmountDollars: willPayAmountDollars,
      lastChargeDate: lastChargeDate,
      nextChargeDate: nextChargeDate,
      lastUpdated: admin.database.ServerValue.TIMESTAMP
    }
  };
  
  // Add user data if available
  if (userData && userData.attributes) {
    standardizedData.patreon.email = userData.attributes.email;
    standardizedData.patreon.fullName = userData.attributes.full_name;
    standardizedData.patreon.imageUrl = userData.attributes.image_url;
  }
  
  // Add membership data if available
  if (membershipData) {
    standardizedData.patreon.membershipData = membershipData;
  }
  
  // Add entitled tiers if available
  if (entitledTiers && entitledTiers.length > 0) {
    standardizedData.patreon.entitledTiers = entitledTiers;
    standardizedData.patreon.tierDetails = tierDetails;
  }
  
  // Add tokens if available
  if (accessToken || refreshToken || (existingData && existingData.tokens)) {
    standardizedData.patreon.tokens = {
      accessToken: accessToken || (existingData && existingData.tokens ? existingData.tokens.accessToken : null),
      refreshToken: refreshToken || (existingData && existingData.tokens ? existingData.tokens.refreshToken : null),
      createdAt: admin.database.ServerValue.TIMESTAMP
    };
  }
  
  return standardizedData;
}

// Add a function to fix up all users' Patreon data
exports.fixPatreonData = functions.https.onRequest(async (req, res) => {
  try {
    // Security check - use a simple token for authentication
    const token = req.query.token;
    if (token !== 'fix-patreon-data-secret') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    console.log('Starting Patreon data fix operation...');
    
    // Get all Patreon users
    const patreonUsersSnapshot = await admin.database().ref('patreonUsers').once('value');
    const patreonUsers = patreonUsersSnapshot.val() || {};
    
    console.log(`Found ${Object.keys(patreonUsers).length} Patreon users to process`);
    
    const results = {
      total: Object.keys(patreonUsers).length,
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    
    // Process each Patreon user
    for (const [patreonId, patreonData] of Object.entries(patreonUsers)) {
      try {
        console.log(`Processing Patreon user: ${patreonId}`);
        results.processed++;
        
        // Get the Firebase UID for this Patreon user
        const firebaseUid = patreonData.firebaseUid;
        
        if (!firebaseUid) {
          console.log(`No Firebase UID for Patreon user ${patreonId}, skipping`);
          results.skipped++;
          continue;
        }
        
        // Get the user data from Firebase
        const userSnapshot = await admin.database().ref(`users/${firebaseUid}`).once('value');
        const userData = userSnapshot.val() || {};
        
        // Create standardized data structure
        const standardizedData = createStandardizedPatreonData(
          patreonId,
          { attributes: { email: patreonData.email, full_name: patreonData.fullName, image_url: patreonData.imageUrl } },
          patreonData.membershipData, 
          patreonData.entitledTiers,
          patreonData.tokens?.accessToken,
          patreonData.tokens?.refreshToken,
          userData.patreon || {}
        );
        
        // Update user roles
        let roles = [];
        if (userData.roles && Array.isArray(userData.roles)) {
          roles = [...userData.roles]; // Clone array
        } else if (userData.role && typeof userData.role === 'string') {
          roles = [userData.role]; // Convert single role to array
        }
        
        // Add patron role if active and not already there
        if (standardizedData.patreon.isActiveMember && !roles.includes('patron')) {
          roles.push('patron');
        } 
        // Remove patron role if not active but it exists
        else if (!standardizedData.patreon.isActiveMember && roles.includes('patron')) {
          roles = roles.filter(r => r !== 'patron');
        }
        
        // Set roles in update data
        standardizedData.roles = roles;
        standardizedData.role = roles[0] || 'member'; // Set primary role for backward compatibility
        
        // Update the user with standardized data
        await admin.database().ref(`users/${firebaseUid}`).update(standardizedData);
        
        // Update the patreonUsers collection with synced data
        const patreonUpdateData = {
          firebaseUid: firebaseUid,
          email: standardizedData.patreon.email,
          fullName: standardizedData.patreon.fullName,
          imageUrl: standardizedData.patreon.imageUrl,
          isActiveMember: standardizedData.patreon.isActiveMember,
          patronStatus: standardizedData.patreon.patronStatus,
          pledgeAmountCents: standardizedData.patreon.pledgeAmountCents,
          pledgeAmountDollars: standardizedData.patreon.pledgeAmountDollars,
          isFreeTrial: standardizedData.patreon.isFreeTrial,
          isGift: standardizedData.patreon.isGift,
          willPayAmountCents: standardizedData.patreon.willPayAmountCents,
          willPayAmountDollars: standardizedData.patreon.willPayAmountDollars,
          lastChargeDate: standardizedData.patreon.lastChargeDate,
          nextChargeDate: standardizedData.patreon.nextChargeDate,
          lastUpdated: admin.database.ServerValue.TIMESTAMP,
          // Keep existing detailed data
          membershipData: patreonData.membershipData || standardizedData.patreon.membershipData,
          entitledTiers: patreonData.entitledTiers || standardizedData.patreon.entitledTiers,
          tokens: patreonData.tokens || standardizedData.patreon.tokens
        };
        
        await admin.database().ref(`patreonUsers/${patreonId}`).update(patreonUpdateData);
        
        console.log(`Successfully standardized data for Patreon user ${patreonId} and Firebase user ${firebaseUid}`);
        results.updated++;
        
      } catch (error) {
        console.error(`Error processing Patreon user ${patreonId}:`, error);
        results.errors.push({ patreonId, error: error.message });
      }
    }
    
    console.log('Fix operation completed with results:', results);
    
    // Return the results
    res.json({
      success: true,
      message: 'Patreon data fix completed',
      results: results
    });
    
  } catch (error) {
    console.error('Patreon data fix failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});