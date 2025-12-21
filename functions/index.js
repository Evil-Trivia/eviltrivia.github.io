const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');

// Initialize Firebase admin
admin.initializeApp();

// Create Express app for Patreon auth
const app = express();

// Function to load environment variables
function loadEnvironmentVariables() {
  console.log('Loading environment variables...');
  
  // Try to load configuration from Firebase Functions config
  try {
    const config = functions.config();
    const patreonConfig = config.patreon;
    const geniusConfig = config.genius;
    
    // Load Patreon Config
    if (patreonConfig) {
      console.log('Found Patreon configuration in functions.config()');
      if (patreonConfig.client_id && !process.env.PATREON_CLIENT_ID) {
        process.env.PATREON_CLIENT_ID = patreonConfig.client_id;
      }
      
      if (patreonConfig.client_secret && !process.env.PATREON_CLIENT_SECRET) {
        process.env.PATREON_CLIENT_SECRET = patreonConfig.client_secret;
      }
      
      if (patreonConfig.webhook_secret && !process.env.PATREON_WEBHOOK_SECRET) {
        process.env.PATREON_WEBHOOK_SECRET = patreonConfig.webhook_secret;
      }
      
      if (patreonConfig.redirect_uri && !process.env.PATREON_REDIRECT_URI) {
        process.env.PATREON_REDIRECT_URI = patreonConfig.redirect_uri;
      }
    }

    // Load Genius Config
    if (geniusConfig) {
        console.log('Found Genius configuration in functions.config()');
        if (geniusConfig.access_token && !process.env.GENIUS_ACCESS_TOKEN) {
            process.env.GENIUS_ACCESS_TOKEN = geniusConfig.access_token;
        }
    }
  } catch (error) {
    console.log('Could not load from functions.config():', error.message);
  }

  // Check if we have environment variables set
  const missingVars = [];
  if (!process.env.PATREON_CLIENT_ID) missingVars.push('PATREON_CLIENT_ID');
  if (!process.env.PATREON_CLIENT_SECRET) missingVars.push('PATREON_CLIENT_SECRET');
  if (!process.env.PATREON_WEBHOOK_SECRET) missingVars.push('PATREON_WEBHOOK_SECRET');
  if (!process.env.PATREON_REDIRECT_URI) missingVars.push('PATREON_REDIRECT_URI');
  // Genius token is optional for app startup but required for lyrics search
  if (!process.env.GENIUS_ACCESS_TOKEN) console.warn('⚠️ GENIUS_ACCESS_TOKEN not set. Lyrics search will fail.');

  if (missingVars.length > 0) {
    console.error(`⚠️ Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please set these using Firebase Functions Config.');
  } else {
    console.log('✅ All required environment variables are set');
  }
}

// Call the function to load environment variables early
loadEnvironmentVariables();

// Configure body parsing middleware - special handling for webhooks
app.use((req, res, next) => {
  // For webhook requests, capture raw body for signature verification
  if (req.path === '/webhooks/patreon') {
    let data = '';
    req.setEncoding('utf8');
    
    req.on('data', (chunk) => {
      data += chunk;
    });
    
    req.on('end', () => {
      // Save the raw body for signature verification
      req.rawBody = data;
      
      // Parse it as JSON if possible
      if (data && data.length > 0) {
        try {
          req.body = JSON.parse(data);
        } catch (e) {
          console.error('Failed to parse webhook JSON body:', e);
          req.body = {};
        }
      }
      next();
    });
  } else {
    // For non-webhook routes, use standard express.json() parser
    express.json()(req, res, next);
  }
});

// Use CORS middleware
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

// Route to initiate Patreon OAuth
app.get('/auth/patreon', (req, res) => {
  // Get client ID from environment variables
  const clientId = process.env.PATREON_CLIENT_ID;
  const redirectUri = process.env.PATREON_REDIRECT_URI || 
    'https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon/callback';
  
  if (!clientId) {
    console.error('[ERROR] Patreon client ID not configured in environment variables');
    return res.status(500).send('Patreon client ID not configured. Please contact the administrator.');
  }
  
  // Set state parameter for CSRF protection
  const state = crypto.randomBytes(20).toString('hex');
  
  // Store state in database
  admin.database().ref(`patreonAuthStates/${state}`).set({
    createdAt: admin.database.ServerValue.TIMESTAMP,
    returnUrl: req.query.returnUrl || '/patreon.html'
  });
  
  // Redirect to Patreon OAuth page
  const authUrl = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=identity%20identity[email]%20identity.memberships%20campaigns.members&state=${state}`;
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Route to handle Patreon OAuth callback
app.get('/auth/patreon/callback', async (req, res) => {
  try {
    console.log('[INFO] Received Patreon callback', {
      path: req.path,
      query: req.query
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
    
    console.log('[INFO] Exchanging authorization code for tokens');
    
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
    
    console.log('[INFO] Getting Patreon user data with access token');
    
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
    
    console.log(`[INFO] Patreon auth successful for user ID: ${patreonId}`);
    console.log(`[INFO] Active member: ${isActiveMember}, Pledge: $${pledgeAmountDollars}`);
    
    // Check if this Patreon account is already linked to a Firebase user
    const existingLinkSnapshot = await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).once('value');
    let firebaseUid = existingLinkSnapshot.val();
    
    if (!firebaseUid) {
      console.log('[INFO] No existing Firebase user linked to this Patreon account');
      // Check if user with this email exists
      try {
        const userRecord = await admin.auth().getUserByEmail(userData.attributes.email);
        firebaseUid = userRecord.uid;
        console.log(`[INFO] Found existing Firebase user with matching email: ${firebaseUid}`);
      } catch (error) {
        // Create a new user 
        console.log('[INFO] Creating new Firebase user for Patreon user');
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
        console.log(`[INFO] Created new Firebase user: ${firebaseUid}`);
      }
    } else {
      console.log(`[INFO] Found existing linked Firebase user: ${firebaseUid}`);
    }
    
    // Now update the user record with Patreon information
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
        tokens: {
          accessToken: access_token,
          refreshToken: refresh_token,
          createdAt: admin.database.ServerValue.TIMESTAMP
        }
      },
      // User level fields for backward compatibility
      patronStatus: isActiveMember ? 'active' : 'inactive',
      patreonPledgeAmount: pledgeAmountDollars,
      patreonId: patreonId
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
    }
    
    // Set primary role and roles array
    patreonUserData.roles = roles;
    patreonUserData.role = roles[0] || 'member'; 
    
    console.log(`[INFO] Updating user record for ${firebaseUid} with Patreon data`);
    
    // Update user data
    await admin.database().ref(`users/${firebaseUid}`).update(patreonUserData);
    
    // Also update patreonUsers branch for backward compatibility
    const patreonBranchData = {
      patreonId: patreonId,
      email: userData.attributes.email,
      fullName: userData.attributes.full_name,
      imageUrl: userData.attributes.image_url,
      lastUpdated: admin.database.ServerValue.TIMESTAMP,
      isActiveMember: isActiveMember,
      pledgeAmountCents: pledgeAmountCents,
      pledgeAmountDollars: pledgeAmountDollars,
      tokens: {
        accessToken: access_token,
        refreshToken: refresh_token,
        createdAt: admin.database.ServerValue.TIMESTAMP
      },
      firebaseUid: firebaseUid
    };
    
    // Update patreonUsers branch
    await admin.database().ref(`patreonUsers/${patreonId}`).update(patreonBranchData);
    
    try {
      // Create custom token for Firebase Auth
      console.log(`[INFO] Creating custom token for user ${firebaseUid}`);
      const customToken = await admin.auth().createCustomToken(firebaseUid);
      
      // Include basic Patreon user info in the redirect
      const encodedName = encodeURIComponent(userData.attributes.full_name || '');
      const encodedEmail = encodeURIComponent(userData.attributes.email || '');
      const encodedImage = encodeURIComponent(userData.attributes.image_url || '');
      const encodedTier = encodeURIComponent(activeMembership?.attributes?.patron_status || 'Connected');
      const encodedPledgeAmount = encodeURIComponent(pledgeAmountDollars);
      
      // Detect mobile devices
      const userAgent = req.get('user-agent') || '';
      const isMobile = userAgent.includes('Mobile') || 
                       userAgent.includes('Android') || 
                       userAgent.includes('iPhone') || 
                       userAgent.includes('iPad');
      
      // Special handling for mobile
      const mobileParam = isMobile ? '&mobile=true' : '';
      
      // Redirect back to the returnUrl or default to patreon.html
      const returnUrl = stateData.returnUrl || '/patreon.html';
      console.log(`[INFO] Redirecting to ${returnUrl} with auth success`);
      
      res.redirect(`${returnUrl}?auth_success=true&patreon_id=${patreonId}&firebase_token=${customToken}&patreon_name=${encodedName}&patreon_email=${encodedEmail}&patreon_image=${encodedImage}&patreon_tier=${encodedTier}&patreon_pledge=${encodedPledgeAmount}${mobileParam}`);
    } catch (tokenError) {
      console.error('Error creating custom token:', tokenError);
      // If we can't create a custom token, we can still redirect with Patreon success
      const returnUrl = stateData.returnUrl || '/patreon.html';
      
      // Include basic Patreon user info in the redirect
      const encodedName = encodeURIComponent(userData.attributes.full_name || '');
      const encodedEmail = encodeURIComponent(userData.attributes.email || '');
      const encodedImage = encodeURIComponent(userData.attributes.image_url || '');
      const encodedTier = encodeURIComponent(activeMembership?.attributes?.patron_status || 'Connected');
      const encodedPledgeAmount = encodeURIComponent(pledgeAmountDollars);
      const mobileParam = req.get('user-agent')?.includes('Mobile') ? '&mobile=true' : '';
      
      res.redirect(`${returnUrl}?auth_success=true&patreon_id=${patreonId}&token_error=true&patreon_name=${encodedName}&patreon_email=${encodedEmail}&patreon_image=${encodedImage}&patreon_tier=${encodedTier}&patreon_pledge=${encodedPledgeAmount}${mobileParam}`);
    }
    
  } catch (error) {
    console.error('Patreon auth error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    // Provide better error info
    let errorDetails = 'token_exchange_failed';
    if (error.message) {
      errorDetails = encodeURIComponent(error.message.substring(0, 100));
    }
    
    // Detect if mobile
    const userAgent = req.get('user-agent') || '';
    const isMobile = userAgent.includes('Mobile') || 
                     userAgent.includes('Android') || 
                     userAgent.includes('iPhone') || 
                     userAgent.includes('iPad');
    const mobileParam = isMobile ? '&mobile=true' : '';
    
    res.redirect(`/patreon.html?auth_error=true&reason=${errorDetails}${mobileParam}`);
  }
});

// Get custom token for existing Patreon link
app.get('/getCustomToken', async (req, res) => {
  try {
    const { patreonId } = req.query;
    
    if (!patreonId) {
      return res.status(400).json({ error: 'Missing patreonId parameter' });
    }
    
    // Get Firebase UID linked to this Patreon user from patreonUsers
    const snapshot = await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).once('value');
    let firebaseUid = snapshot.val();
    
    if (!firebaseUid) {
      return res.status(404).json({ error: 'No Firebase user found for this Patreon ID' });
    }
    
    try {
      // Create custom token
      const customToken = await admin.auth().createCustomToken(firebaseUid);
      res.json({ token: customToken });
    } catch (tokenError) {
      console.error('Error creating custom token:', tokenError);
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
    console.log('==== PATREON WEBHOOK START ====');
    const eventType = req.get('X-Patreon-Event');
    console.log('Received Patreon webhook with event:', eventType);
    
    // Get webhook secret from environment variables
    const webhookSecret = process.env.PATREON_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('❌ Webhook secret not configured - cannot verify webhook signature');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    
    console.log('Webhook secret configured and will be used for signature verification');
    
    // Verify webhook signature
    const signature = req.get('X-Patreon-Signature');
    const rawBody = req.rawBody;
    
    if (!signature) {
      console.error('Missing X-Patreon-Signature header');
      return res.status(403).json({ error: 'Missing signature header' });
    }
    
    if (!rawBody) {
      console.error('Missing raw body - this is required for signature verification');
      return res.status(500).json({ error: 'Internal server error - raw body not captured' });
    }
    
    // Verify signature with md5 (what Patreon uses)
    const hmac = crypto.createHmac('md5', webhookSecret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');
    
    if (signature !== calculatedSignature) {
      console.error('❌ Webhook signature verification failed');
      return res.status(403).json({ error: 'Invalid webhook signature' });
    }
    
    // Signature verified, process the webhook
    console.log('✅ Webhook signature verified successfully');
    
    // Verify webhook payload format
    if (!req.body || !req.body.data) {
      console.error('❌ Invalid webhook payload - missing data object');
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    // Basic event handling - modify this to implement the specific webhook logic
    console.log(`Webhook for event ${eventType} received and verified`);
    
    // Return simple success response
    res.status(200).json({ 
      status: 'success',
      message: 'Webhook received and verified',
      eventType: eventType
    });
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    
    // Return a 200 response even for errors to avoid Patreon retrying
    res.status(200).json({ 
      status: 'error',
      message: 'Error processing webhook',
      error: error.message
    });
  }
});

// Export the Express app as a Cloud Function
exports.app = functions.https.onRequest(app);

// Debug endpoint to test webhook configuration
exports.webhookTest = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  // Get Patreon configuration from environment variables 
  const envClientId = process.env.PATREON_CLIENT_ID;
  const envClientSecret = process.env.PATREON_CLIENT_SECRET;
  const envRedirectUri = process.env.PATREON_REDIRECT_URI;
  const envWebhookSecret = process.env.PATREON_WEBHOOK_SECRET;
  
  // Return configuration info
  res.json({
    timestamp: new Date().toISOString(),
    patreonEnvironment: {
      hasClientId: !!envClientId,
      hasClientSecret: !!envClientSecret,
      hasRedirectUri: !!envRedirectUri, 
      hasWebhookSecret: !!envWebhookSecret,
      redirectUri: envRedirectUri || 'Not configured'
    },
    webhook: {
      url: `https://us-central1-eviltrivia-47664.cloudfunctions.net/app/webhooks/patreon`
    }
  });
});

// Callable function to check wedding puzzle answers securely
exports.checkWeddingAnswer = functions.https.onCall(async (data, context) => {
  // No authentication required for wedding puzzles
  
  // Validate input data
  if (!data.puzzle || !data.answer) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Request must include puzzle number and answer.'
    );
  }
  
  const puzzleNumber = data.puzzle;
  const userAnswer = data.answer.trim().toLowerCase();
  
  try {
    // Get correct answer from database (only accessible server-side)
    const snapshot = await admin.database().ref(`wedding/answers/${puzzleNumber}`).once('value');
    const puzzle = snapshot.val();
    
    if (!puzzle || !puzzle.answer) {
      throw new functions.https.HttpsError(
        'not-found',
        'Puzzle not found or no answer set.'
      );
    }
    
    // Compare answers (case-insensitive, trimmed)
    const correctAnswer = puzzle.answer.trim().toLowerCase();
    const isCorrect = userAnswer === correctAnswer;
    
    // Log answer attempt (optional)
    // Use provided UID or generate anonymous ID
    const uid = data.uid || `anon-${Date.now()}`;
    await admin.database().ref(`wedding/attempts/${puzzleNumber}/${uid}`).push({
      answer: userAnswer,
      correct: isCorrect,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    
    // Return result
    return { correct: isCorrect };
    
  } catch (error) {
    console.error('Error checking wedding answer:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Error checking answer. Please try again.'
    );
  }
});

// Optimized server-side search function for regex tool
exports.searchTerms = functions.region('us-central1').https.onCall(async (data, context) => {
  // Verify user has admin privileges
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required to access search function.'
    );
  }

  const uid = context.auth.uid;
  
  try {
    // Check if user is admin
    const userSnapshot = await admin.database().ref(`users/${uid}`).once('value');
    const userData = userSnapshot.val() || {};
    
    const isAdmin = 
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('admin')) ||
      (userData.role === 'admin');
    
    if (!isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin privileges required to access search function.'
      );
    }

    // Validate input data
    if (!data.searchTerm || !data.files || !Array.isArray(data.files)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Request must include searchTerm and files array.'
      );
    }

    const { 
      searchTerm, 
      files, 
      excludePatterns = [], 
      crosswordMode = false, 
      variableMode = false, 
      ignoreSpaces = false,
      maxResults = 50 
    } = data;

    console.log(`Search request: "${searchTerm}" in files: ${files.join(', ')}`);

    // Server-side pattern compilation
    const searchPattern = compileSearchPattern(searchTerm, { crosswordMode, variableMode, ignoreSpaces });
    const excludeRegexes = excludePatterns.map(pattern => 
      compileExcludePattern(pattern, { crosswordMode })
    );

    const results = [];
    const errors = [];

    // Process files in parallel for better performance
    const filePromises = files.map(async (filename) => {
      try {
        const fileResults = await searchFileOptimized(filename, searchPattern, excludeRegexes, maxResults);
        return fileResults;
      } catch (error) {
        console.error(`Error searching file ${filename}:`, error);
        errors.push({
          filename,
          error: error.message || 'Unknown error'
        });
        return [];
      }
    });

    const fileResultsArrays = await Promise.all(filePromises);
    
    // Flatten and combine results
    for (const fileResults of fileResultsArrays) {
      results.push(...fileResults);
    }

    // Sort by score (highest first) and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, maxResults);

    console.log(`Search completed: found ${results.length} total results, returning ${limitedResults.length}`);

    return {
      results: limitedResults,
      totalFound: results.length,
      errors: errors,
      searchTerm: searchTerm,
      hasMore: results.length > maxResults
    };

  } catch (error) {
    console.error('Error in searchTerms function:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Error performing search. Please try again.'
    );
  }
});

// Helper function to search a single file optimized
async function searchFileOptimized(filename, searchPattern, excludeRegexes, maxResults) {
  const results = [];
  
  // Check if file exists first
  const fileRef = admin.database().ref(`tools/${filename}`);
  const existsSnapshot = await fileRef.limitToFirst(1).once('value');
  
  if (!existsSnapshot.exists()) {
    throw new Error(`File ${filename} does not exist`);
  }

  // Use intelligent score range strategy
  // Start with high scores and work down, stopping when we have enough results
  const scoreRanges = [
    { min: 90, max: 100 },
    { min: 75, max: 89 },
    { min: 50, max: 74 },
    { min: 25, max: 49 },
    { min: 0, max: 24 }
  ];

  for (const range of scoreRanges) {
    if (results.length >= maxResults) break;

    try {
      // Fetch score range data
      const rangeSnapshot = await fileRef
        .orderByKey()
        .startAt(String(range.min))
        .endAt(String(range.max))
        .once('value');
      
      const rangeData = rangeSnapshot.val() || {};
      
      // Process scores in descending order for best results first
      const scores = Object.keys(rangeData)
        .map(s => parseInt(s, 10))
        .filter(s => !isNaN(s))
        .sort((a, b) => b - a);

      for (const score of scores) {
        if (results.length >= maxResults) break;

        const terms = rangeData[String(score)] || {};
        
        for (const termId in terms) {
          if (results.length >= maxResults) break;
          
          const termData = terms[termId];
          if (!termData || !termData.term) continue;

          // Apply search pattern
          if (testPattern(searchPattern, termData.term) && !isTermExcluded(termData.term, excludeRegexes)) {
            results.push({
              term: termData.term,
              parentheses: termData.parentheses || '',
              score: score,
              filename: filename,
              termId: termId
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error processing score range ${range.min}-${range.max} in ${filename}:`, error);
      // Continue with next range rather than failing completely
    }
  }

  return results;
}

// Helper function to compile search patterns (server-side version)
function compileSearchPattern(pattern, options = {}) {
  const { crosswordMode, variableMode, ignoreSpaces } = options;

  if (variableMode) {
    return compileVariablePattern(pattern, ignoreSpaces);
  }

  if (!crosswordMode) {
    // Standard wildcard mode
    let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    regexPattern = regexPattern.replace(/\*/g, '.*');
    regexPattern = regexPattern.replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`, 'i');
  }

  // Crossword mode implementation (server-side)
  return compileCrosswordPattern(pattern);
}

function compileVariablePattern(pattern, ignoreSpaces) {
  if (ignoreSpaces) {
    return createSpaceIgnoringVariablePattern(pattern);
  }

  const variableMap = new Map();
  let groupCounter = 1;
  let regexPattern = '^';

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    
    if (char === ' ') {
      regexPattern += ' ';
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      const upperChar = char.toUpperCase();
      
      if (variableMap.has(upperChar)) {
        const groupNum = variableMap.get(upperChar);
        regexPattern += `\\${groupNum}`;
      } else {
        variableMap.set(upperChar, groupCounter);
        regexPattern += '(.)';
        groupCounter++;
      }
    } else {
      regexPattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }

  regexPattern += '$';
  return new RegExp(regexPattern, 'i');
}

function createSpaceIgnoringVariablePattern(pattern) {
  const processedPattern = pattern.replace(/\s+/g, '');
  
  return {
    test: function(target) {
      const cleanTarget = target.replace(/\s+/g, '');
      
      if (cleanTarget.length !== processedPattern.length) {
        return false;
      }

      const assignments = new Map();
      
      for (let i = 0; i < processedPattern.length; i++) {
        const patternChar = processedPattern[i].toUpperCase();
        const targetChar = cleanTarget[i].toLowerCase();
        
        if (/[A-Za-z]/.test(patternChar)) {
          if (assignments.has(patternChar)) {
            if (assignments.get(patternChar) !== targetChar) {
              return false;
            }
          } else {
            assignments.set(patternChar, targetChar);
          }
        } else {
          if (patternChar.toLowerCase() !== targetChar) {
            return false;
          }
        }
      }
      
      return true;
    }
  };
}

function compileCrosswordPattern(pattern) {
  let preparedPattern = pattern.replace(/\*/g, '###ASTERISK###');
  const questionMarkCount = (preparedPattern.match(/\?/g) || []).length;
  
  if (questionMarkCount === 0) {
    let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    regexPattern = regexPattern.replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`, 'i');
  }

  if (preparedPattern.replace(/\?/g, '') === '') {
    return new RegExp(`^(?=[^A-Za-z]*([A-Za-z][^A-Za-z]*){${questionMarkCount}}$)[\\s\\S]*$`, 'i');
  }

  // Handle mixed patterns - simplified server-side version
  let regexPattern = preparedPattern
    .replace(/\?+/g, (match) => `(?:[^A-Za-z]*[A-Za-z]){${match.length}}[^A-Za-z]*`)
    .replace(/###ASTERISK###/g, '.*')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
  return new RegExp(`^${regexPattern}$`, 'i');
}

function compileExcludePattern(pattern, options = {}) {
  const { crosswordMode } = options;
  
  let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  regexPattern = regexPattern.replace(/\*/g, '.*');
  
  if (crosswordMode) {
    regexPattern = regexPattern.replace(/\?/g, '[A-Za-z]');
  } else {
    regexPattern = regexPattern.replace(/\?/g, '.');
  }
  
  return new RegExp(regexPattern, 'i');
}

function testPattern(pattern, text) {
  if (typeof pattern.test === 'function') {
    return pattern.test(text);
  }
  return false;
}

function isTermExcluded(term, excludeRegexes) {
  if (!excludeRegexes || excludeRegexes.length === 0) {
    return false;
  }
  return excludeRegexes.some(regex => regex.test(term));
}

// Get available files for search tool
exports.getAvailableFiles = functions.region('us-central1').https.onCall(async (data, context) => {
  // Verify user has admin privileges
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required to access files.'
    );
  }

  const uid = context.auth.uid;
  
  try {
    // Check if user is admin
    const userSnapshot = await admin.database().ref(`users/${uid}`).once('value');
    const userData = userSnapshot.val() || {};
    
    const isAdmin = 
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('admin')) ||
      (userData.role === 'admin');
    
    if (!isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin privileges required to access files.'
      );
    }

    // Get available files from tools data
    const toolsSnapshot = await admin.database().ref('tools').once('value');
    
    if (!toolsSnapshot.exists()) {
      return { files: [] };
    }
    
    const files = Object.keys(toolsSnapshot.val()).sort();
    
    return { files: files };

  } catch (error) {
    console.error('Error in getAvailableFiles function:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Error getting available files. Please try again.'
    );
  }
});

// Migration function to copy tools data from Realtime Database to Firestore
exports.migrateToFirestore = functions.https.onCall(async (data, context) => {
  // Verify user has admin privileges
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required to run migration.'
    );
  }

  const uid = context.auth.uid;
  
  try {
    // Check if user is admin
    const userSnapshot = await admin.database().ref(`users/${uid}`).once('value');
    const userData = userSnapshot.val() || {};
    
    const isAdmin = 
      (userData.roles && Array.isArray(userData.roles) && userData.roles.includes('admin')) ||
      (userData.role === 'admin');
    
    if (!isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin privileges required to run migration.'
      );
    }

    console.log(`Migration started by admin user: ${uid}`);
    
    // Import and run the migration
    const { migrateToolsToFirestore } = require('./migrate-to-firestore');
    const result = await migrateToolsToFirestore();
    
    console.log('Migration completed successfully:', result);
    
    return {
      success: true,
      message: 'Migration completed successfully',
      ...result
    };

  } catch (error) {
    console.error('Migration error:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `Migration failed: ${error.message}`
    );
  }
});

// Helper to proxy Genius API requests securely
exports.geniusSearch = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated (optional, but good practice if we want to limit usage)
  // For now allowing unauthenticated use as requested by "seamlessly blends" with existing public tools
  
  const query = data.query;
  if (!query) {
    throw new functions.https.HttpsError('invalid-argument', 'Query is required');
  }

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('Genius Access Token not configured');
    throw new functions.https.HttpsError('internal', 'Genius API not configured');
  }

  try {
    console.log(`Searching Genius for: ${query}`);
    const response = await axios.get('https://api.genius.com/search', {
      params: { q: query },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data.response;
  } catch (error) {
    console.error('Error calling Genius API:', error);
    throw new functions.https.HttpsError('internal', 'Failed to search Genius API', error.message);
  }
}); 