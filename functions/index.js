const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');

// Initialize Firebase admin 
admin.initializeApp();

// Create Express app for Patreon auth
const app = express();

// Use CORS middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Simple test endpoint
app.get('/test', (req, res) => {
  res.send('Patreon Auth Function is working!');
});

// Route to initiate Patreon OAuth
app.get('/auth/patreon', (req, res) => {
  // Get configs, with fallbacks to avoid errors
  const clientId = functions.config().patreon?.client_id || '';
  const redirectUri = functions.config().patreon?.redirect_uri || '';
  
  if (!clientId) {
    return res.status(500).send('Patreon client ID not configured');
  }
  
  // Redirect to Patreon OAuth page
  const authUrl = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=identity%20identity[email]%20identity.memberships%20campaigns.members`;
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Route to handle Patreon OAuth callback
app.get('/auth/patreon/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      console.error('No code parameter in callback');
      return res.redirect('/patreon.html?auth_error=true&reason=no_code');
    }
    
    // Get configs
    const clientId = functions.config().patreon?.client_id || '';
    const clientSecret = functions.config().patreon?.client_secret || '';
    const redirectUri = functions.config().patreon?.redirect_uri || '';
    
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
    
    const { access_token } = tokenResponse.data;
    
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
      lastUpdated: admin.database.ServerValue.TIMESTAMP,
      isActiveMember: !!activeMembership,
      membershipData: activeMembership
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
      await admin.database().ref(`users/${firebaseUid}/patreonId`).set(patreonUserId);
    }
    
    // Create custom token for Firebase Auth
    const customToken = await admin.auth().createCustomToken(firebaseUid);
    
    // Redirect back to patreon page with success
    res.redirect(`/patreon.html?auth_success=true&patreon_id=${patreonUserId}&firebase_token=${customToken}`);
    
  } catch (error) {
    console.error('Patreon auth error:', error.message);
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
    
    // Create custom token
    const customToken = await admin.auth().createCustomToken(firebaseUid);
    
    res.json({ token: customToken });
  } catch (error) {
    console.error('Error generating custom token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Export the Express app as a Firebase Cloud Function
exports.patreonAuth = functions.https.onRequest(app);

// Simple test function to verify deployments
exports.hello = functions.https.onRequest((req, res) => {
  res.send('Hello from Firebase!');
});