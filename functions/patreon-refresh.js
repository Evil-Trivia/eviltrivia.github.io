const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// HTTP endpoint for refreshing Patreon data
exports.refreshPatreonData = functions.https.onRequest(async (req, res) => {
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
    let authValid = false;
    let adminAccess = false;
    let currentUserId = null;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        currentUserId = decodedToken.uid;
        
        // Check if user is admin
        const userSnapshot = await admin.database().ref(`users/${currentUserId}`).once('value');
        const userData = userSnapshot.val() || {};
        
        authValid = true;
        
        // Check for admin role in either roles array or role string
        if (userData.roles && Array.isArray(userData.roles)) {
          adminAccess = userData.roles.includes('admin');
        } else if (userData.role === 'admin') {
          adminAccess = true;
        }
      } catch (error) {
        console.error('Error verifying ID token:', error);
      }
    }
    
    if (!authValid || !adminAccess) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }
    
    // Get the Patreon ID from query params or request body
    const patreonId = req.query.patreonId || (req.body && req.body.patreonId);
    
    if (!patreonId) {
      return res.status(400).json({ error: 'Missing patreonId parameter' });
    }
    
    // Get the Patreon user data
    const patreonUserSnap = await admin.database().ref(`patreonUsers/${patreonId}`).once('value');
    const patreonUserData = patreonUserSnap.val();
    
    if (!patreonUserData) {
      return res.status(404).json({ error: 'Patreon user not found' });
    }
    
    // Get access token
    const accessToken = patreonUserData.tokens?.accessToken;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'No access token available for this user' });
    }
    
    // Call the refresh function from main index.js
    const refreshPatreonUserData = require('./index').refreshPatreonUserData;
    
    if (typeof refreshPatreonUserData !== 'function') {
      console.error('refreshPatreonUserData function not found in index.js');
      return res.status(500).json({ error: 'Refresh function not available' });
    }
    
    await refreshPatreonUserData(patreonId, accessToken);
    
    // Return success
    res.json({ 
      success: true, 
      message: `Successfully refreshed Patreon data for user ${patreonId}` 
    });
    
  } catch (error) {
    console.error('Error refreshing Patreon data:', error);
    res.status(500).json({ 
      error: 'Failed to refresh Patreon data',
      message: error.message
    });
  }
}); 