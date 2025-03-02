/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Initialize Firebase Admin SDK
admin.initializeApp();

// Get references to Realtime Database and Firestore
const rtdb = admin.database();
const db = admin.firestore();

// Express app for patreonAuth
const app = express();
app.use(cors({ origin: true }));

// Patreon configuration
const patreonClientId = process.env.PATREON_CLIENT_ID || "your-client-id";
const patreonClientSecret = process.env.PATREON_CLIENT_SECRET || "your-client-secret";
const redirectUri = process.env.REDIRECT_URI || "https://us-central1-eviltrivia-47664.cloudfunctions.net/patreonAuth/auth/patreon/callback";

// Patreon OAuth routes
app.get("/auth/patreon", (req, res) => {
  const oauthUrl = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${patreonClientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(oauthUrl);
});

app.get("/auth/patreon/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("No 'code' parameter from Patreon.");
  }

  try {
    const tokenResponse = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      null,
      {
        params: {
          code,
          grant_type: "authorization_code",
          client_id: patreonClientId,
          client_secret: patreonClientSecret,
          redirect_uri: redirectUri,
        },
      }
    );

    const { access_token: accessToken } = tokenResponse.data;

    const userResponse = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          include: "memberships",
          "fields[user]": "full_name,email,hide_pledges",
          "fields[member]": "currently_entitled_amount_cents,patron_status",
        },
      }
    );

    const userData = userResponse.data;
    const patreonUserId = userData.data.id;
    
    // Check if the user has an active membership
    let isActiveMember = false;
    let membershipData = null;
    
    if (userData.included && Array.isArray(userData.included)) {
      membershipData = userData.included.find(item => 
        item.type === 'member' && 
        item.attributes.patron_status === 'active_patron'
      );
      
      isActiveMember = !!membershipData;
    }
    
    // Store in Realtime DB
    await rtdb.ref(`patreonUsers/${patreonUserId}`).set({
      accessToken,
      userData: userData.data,
      membershipData: membershipData || null,
      isActiveMember,
      lastAuthenticated: Date.now(),
    });

    // Redirect back to the application with the Patreon user ID
    res.redirect(`https://eviltrivia.com/patreon-success.html?id=${patreonUserId}`);
  } catch (error) {
    console.error("Error in Patreon authentication:", error);
    res.status(500).send("Authentication failed. Please try again.");
  }
});

// Export the Express app as the patreonAuth function
exports.patreonAuth = functions.https.onRequest(app);

/**
 * Helper function for verifyAdminPassword operation
 */
async function verifyAdminPassword(data) {
  // Extract password safely
  const password = data?.password || '';
  
  if (!password) {
    throw new functions.https.HttpsError(
      "invalid-argument", 
      "Password is required"
    );
  }
  
  try {
    // Get admin password from database
    const snapshot = await rtdb.ref('adminSettings/adminPassword').once('value');
    const correctPassword = snapshot.val();
    
    if (password === correctPassword) {
      return {
        success: true,
        email: "admin@eviltrivia.com",
        token: "admin-authenticated"  // Don't send back the actual password
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    console.error("Error verifying admin password:", error.message);
    throw new functions.https.HttpsError("internal", error.message);
  }
}

/**
 * Helper function for getAdminSettings operation
 */
async function getAdminSettings(data, context) {
  try {
    const settingsSnap = await rtdb.ref('adminSettings').once('value');
    const settings = settingsSnap.val() || {};
    
    return { 
      success: true,
      settings
    };
  } catch (error) {
    console.error("Error getting admin settings:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
}

/**
 * Helper function for updateAdminPassword operation
 */
async function updateAdminPassword(data, context) {
  const newPassword = data.newPassword;
  
  if (!newPassword) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "New password is required"
    );
  }
  
  try {
    await rtdb.ref('adminSettings/adminPassword').set(newPassword);
    return { success: true };
  } catch (error) {
    console.error("Error updating admin password:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
}

/**
 * Helper function for updatePatreonTier operation
 */
async function updatePatreonTier(data, context) {
  const { requiredAmountCents, tierDescription } = data;
  
  if (requiredAmountCents === undefined) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Required amount is required"
    );
  }
  
  try {
    await rtdb.ref('adminSettings/patreon').set({
      requiredAmountCents,
      tierDescription: tierDescription || '',
      updatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error updating Patreon tier:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
}

/**
 * Secure admin operations function
 */
exports.secureAdminOperation = functions.https.onCall((data, context) => {
  const operation = data.operation;
  
  // IMPORTANT: Handle verifyAdminPassword without requiring authentication
  if (operation === "verifyAdminPassword") {
    return verifyAdminPassword(data);
  }
  
  // All other operations require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to use this function"
    );
  }
  
  // Handle different admin operations
  switch (operation) {
    case "updateAdminPassword":
      return updateAdminPassword(data, context);
    case "getAdminSettings":
      return getAdminSettings(data, context);
    case "updatePatreonTier":
      return updatePatreonTier(data, context);
    default:
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Unknown operation type"
      );
  }
});

/**
 * Public data function for retrieving non-sensitive data
 */
exports.publicData = functions.https.onCall(async (data, context) => {
  const operation = data?.operation || '';
  
  try {
    if (operation === 'getGradingSessions') {
      // Retrieve grading sessions
      const snapshot = await rtdb.ref('grading').once('value');
      const sessions = snapshot.val() || {};
      
      // Format sessions for display
      const formattedSessions = {};
      Object.entries(sessions).forEach(([id, session]) => {
        formattedSessions[id] = {
          location: session.location || 'Unknown',
          triviaNumber: session.triviaNumber || '0',
          date: session.date || 'Unknown',
          closed: session.closed || false
        };
      });
      
      return { 
        success: true, 
        sessions: formattedSessions 
      };
    }
    
    throw new Error("Unknown operation");
  } catch (error) {
    console.error("Error in publicData:", error.message);
    return {
      success: false,
      message: error.message
    };
  }
});

/**
 * Function to bootstrap initial admin settings if needed
 */
exports.bootstrapAdmin = functions.https.onCall(async (data, context) => {
  // Check if this is the first setup
  try {
    const settingsSnapshot = await rtdb.ref('adminSettings').once('value');
    
    if (!settingsSnapshot.exists()) {
      // Create initial admin settings
      await rtdb.ref('adminSettings').set({
        adminPassword: "eviltrivia",
        gradingPassword: "eviltrivia",
        searchPassword: "evil",
        setupComplete: true,
        setupDate: new Date().toISOString()
      });
      
      return {
        success: true,
        message: "Initial admin settings created successfully"
      };
    }
    
    return {
      success: false,
      message: "Admin settings already exist"
    };
  } catch (error) {
    console.error("Error bootstrapping admin settings:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Update this function to avoid circular references
exports.testAdminAuth = functions.https.onCall(async (data, context) => {
  // Log minimally to avoid circular references
  console.log("testAdminAuth called with data:", typeof data);
  
  try {
    // Extract password safely
    const password = data?.password || '';
    
    if (!password) {
      return { 
        success: false, 
        message: "Password is required"
      };
    }
    
    // Get admin password from database
    const snapshot = await rtdb.ref('adminSettings/adminPassword').once('value');
    const correctPassword = snapshot.val();
    
    return {
      success: password === correctPassword,
      message: password === correctPassword ? "Success" : "Wrong password"
    };
  } catch (error) {
    console.error("Error in testAdminAuth:", error.message);
    return {
      success: false,
      message: "Error: " + error.message
    };
  }
});

// Simple test function
exports.superSimpleTest = functions.https.onCall((data, context) => {
  console.log("superSimpleTest called");
  return {
    success: true,
    message: "Function executed successfully",
    receivedData: data
  };
});

// Admin authentication function
exports.adminAuthenticate = functions.https.onCall((data, context) => {
  console.log("adminAuthenticate called with data:", data ? "exists" : "null");
  
  if (!data) {
    return { success: false, message: "No data provided" };
  }
  
  // Safely extract password
  const password = data.password || "";
  console.log("Password received, length:", password.length);
  
  if (!password) {
    return { success: false, message: "Password is required" };
  }
  
  // Hard-coded password for testing
  const correctPassword = "eviltrivia";
  const isMatch = password === correctPassword;
  
  console.log("Password match:", isMatch);
  
  return {
    success: isMatch,
    message: isMatch ? "Success" : "Incorrect password"
  };
});

// Add a separate admin password verification function with no auth check
exports.verifyAdminPassword = functions.https.onCall(async (data, context) => {
  // Extract password safely
  const password = data?.password || '';
  
  if (!password) {
    throw new functions.https.HttpsError(
      "invalid-argument", 
      "Password is required"
    );
  }
  
  try {
    // Get admin password from database
    const snapshot = await rtdb.ref('adminSettings/adminPassword').once('value');
    const correctPassword = snapshot.val();
    
    console.log("Password check: attempting to verify");
    
    return {
      success: password === correctPassword,
      message: password === correctPassword ? "Success" : "Wrong password"
    };
  } catch (error) {
    console.error("Error verifying admin password:", error.message);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Add a completely separate password verification function with explicit logging
exports.adminPasswordCheck = functions.https.onCall(async (data, context) => {
  try {
    // Extract password safely
    const password = data?.password || '';
    
    if (!password) {
      return { 
        success: false, 
        message: "Password is required" 
      };
    }
    
    // For testing, try a hardcoded password first
    const correctPassword = "eviltrivia"; // Hardcode the password for initial testing
    
    // Log values for debugging (remove in production)
    console.log("Password check:");
    console.log("- Password entered:", password);
    console.log("- Correct password:", correctPassword);
    console.log("- Match:", password === correctPassword);
    
    return {
      success: password === correctPassword,
      message: password === correctPassword ? "Success" : "Wrong password"
    };
  } catch (error) {
    console.error("Error in simple password check:", error);
    return {
      success: false,
      message: "Error: " + error.message
    };
  }
});