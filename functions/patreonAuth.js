const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors')({origin: true});
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

admin.initializeApp();

const app = express();
app.use(cors);
app.use(cookieParser());

// Patreon API credentials (store these in Firebase Functions config)
const CLIENT_ID = functions.config().patreon.client_id;
const CLIENT_SECRET = functions.config().patreon.client_secret;
const REDIRECT_URI = functions.config().patreon.redirect_uri;

// Route to initiate Patreon OAuth
app.get('/auth/patreon', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state in a cookie for verification on callback
  res.cookie('patreon_state', state, { 
    maxAge: 3600000, // 1 hour
    httpOnly: true,
    secure: true
  });
  
  // Redirect to Patreon OAuth page
  const authUrl = 'https://www.patreon.com/oauth2/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state: state,
      scope: 'identity identity[email] identity.memberships campaigns.members'
    });
  
  res.redirect(authUrl);
});

// Route to handle Patreon OAuth callback
app.get('/auth/patreon/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies.patreon_state;
    
    // Verify state to prevent CSRF
    if (!state || state !== storedState) {
      return res.status(403).send('State verification failed');
    }
    
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://www.patreon.com/api/oauth2/token', 
      querystring.stringify({
        code,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
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
    
    // Prepare data for database
    const patreonUserId = userData.id;
    const userInfo = {
      patreonId: patreonUserId,
      email: userData.attributes.email,
      fullName: userData.attributes.full_name,
      imageUrl: userData.attributes.image_url,
      accessToken: access_token,
      refreshToken: refresh_token,
      lastUpdated: admin.database.ServerValue.TIMESTAMP,
      isActiveMember: !!activeMembership,
      membershipData: activeMembership
    };
    
    // Store data in Firebase
    await admin.database().ref(`patreonUsers/${patreonUserId}`).update(userInfo);
    
    // Create or find Firebase Auth user
    let firebaseUid;
    try {
      // Try to find existing user by email
      const userRecord = await admin.auth().getUserByEmail(userData.attributes.email);
      firebaseUid = userRecord.uid;
    } catch (error) {
      // User doesn't exist, create a new one
      const newUser = await admin.auth().createUser({
        email: userData.attributes.email,
        displayName: userData.attributes.full_name,
        photoURL: userData.attributes.image_url
      });
      firebaseUid = newUser.uid;
      
      // Create user profile in database
      await admin.database().ref(`users/${firebaseUid}`).set({
        email: userData.attributes.email,
        displayName: userData.attributes.full_name,
        patreonId: patreonUserId,
        role: 'patron',
        createdAt: admin.database.ServerValue.TIMESTAMP
      });
    }
    
    // Link Patreon ID to Firebase user ID
    await admin.database().ref(`patreonUsers/${patreonUserId}/firebaseUid`).set(firebaseUid);
    await admin.database().ref(`users/${firebaseUid}/patreonId`).set(patreonUserId);
    
    // Create a custom token
    const customToken = await admin.auth().createCustomToken(firebaseUid);
    
    // Redirect back to the app with auth success and tokens
    res.redirect(`/patreon?auth_success=true&patreon_id=${patreonUserId}&firebase_token=${customToken}`);
  } catch (error) {
    console.error('Patreon auth error:', error);
    res.redirect('/patreon?auth_error=true');
  }
});

// Route to get a Firebase custom token for an existing Patreon user
app.get('/getCustomToken', async (req, res) => {
  try {
    const { patreonId } = req.query;
    
    if (!patreonId) {
      return res.status(400).json({ error: 'Missing patreonId parameter' });
    }
    
    // Get the Firebase UID linked to this Patreon user
    const userSnapshot = await admin.database().ref(`patreonUsers/${patreonId}/firebaseUid`).once('value');
    const firebaseUid = userSnapshot.val();
    
    if (!firebaseUid) {
      return res.status(404).json({ error: 'No Firebase user found for this Patreon ID' });
    }
    
    // Create a custom token
    const customToken = await admin.auth().createCustomToken(firebaseUid);
    
    res.json({ token: customToken });
  } catch (error) {
    console.error('Error generating custom token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

exports.patreonAuth = functions.https.onRequest(app);
