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
const fetch = require("node-fetch");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Initialize Firebase Admin SDK securely
admin.initializeApp();

// Database reference
const db = admin.firestore();
const rtdb = admin.database();

/**
 * Patreon authentication function
 * Handles OAuth flow with Patreon and creates Firebase auth tokens
 */
exports.patreonAuth = functions.https.onCall(async (data, context) => {
  // Get the Patreon access token from the request
  const patreonToken = data.patreonToken;
  
  if (!patreonToken) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Patreon token is required"
    );
  }
  
  try {
    // Verify token with Patreon API
    const response = await fetch("https://www.patreon.com/api/oauth2/v2/identity?include=memberships,memberships.currently_entitled_tiers", {
      headers: {
        "Authorization": `Bearer ${patreonToken}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to verify Patreon token: ${response.status}`);
    }
    
    const patreonData = await response.json();
    
    // Get user info from Patreon
    const userId = patreonData.data.id;
    const email = patreonData.data.attributes.email;
    const fullName = patreonData.data.attributes.full_name || "Patreon User";
    
    // Check if user has an active membership
    const hasMembership = patreonData.included && 
      patreonData.included.some(item => 
        item.type === "member" && 
        item.attributes.patron_status === "active_patron"
      );
    
    // Find tier information if available
    let tierLevel = 0;
    if (hasMembership && patreonData.included) {
      // Look for tier information in the included data
      const tierData = patreonData.included.find(item => item.type === "tier");
      if (tierData) {
        // You might want to map tier IDs to your own levels
        tierLevel = tierData.attributes.amount_cents / 100; // Convert cents to dollars as a simple level
      }
    }
    
    // Create or update Firebase user
    let firebaseUser;
    try {
      // Try to find existing user by email
      firebaseUser = await admin.auth().getUserByEmail(email);
    } catch (error) {
      // User doesn't exist, create a new one
      firebaseUser = await admin.auth().createUser({
        email: email,
        displayName: fullName
      });
    }
    
    // Set custom claims based on Patreon status
    const customClaims = {
      patreonId: userId,
      patreonStatus: hasMembership ? "active" : "inactive",
      patreonTier: tierLevel,
      updatedAt: Date.now()
    };
    
    await admin.auth().setCustomUserClaims(firebaseUser.uid, customClaims);
    
    // Store user data in Realtime Database for quicker access
    await rtdb.ref(`patreonUsers/${firebaseUser.uid}`).set({
      email: email,
      displayName: fullName,
      patreonId: userId,
      patreonStatus: hasMembership ? "active" : "inactive",
      patreonTier: tierLevel,
      lastUpdated: admin.database.ServerValue.TIMESTAMP
    });
    
    // Create a custom token for the user to sign in with
    const token = await admin.auth().createCustomToken(firebaseUser.uid);
    
    return {
      token: token,
      user: {
        uid: firebaseUser.uid,
        email: email,
        displayName: fullName,
        patreonStatus: hasMembership ? "active" : "inactive",
        patreonTier: tierLevel
      }
    };
  } catch (error) {
    console.error("Patreon authentication error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Secure admin operations function
 */
exports.secureAdminOperation = functions.https.onCall((data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to use this function"
    );
  }
  
  // Check if user has admin privileges
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User must be an admin to use this function"
    );
  }
  
  // Get the operation type from the request
  const operation = data.operation;
  
  // Handle different admin operations
  switch (operation) {
    case "verifyAdminPassword":
      return verifyAdminPassword(data);
    case "updateAdminPassword":
      return updateAdminPassword(data, context);
    case "getAdminSettings":
      return getAdminSettings(data, context);
    case "updatePatreonTier":
      return updatePatreonTier(data, context);
    case "addQuestion":
      return addQuestion(data, context);
    case "deleteQuestion":
      return deleteQuestion(data, context);
    case "updateSettings":
      return updateSettings(data, context);
    default:
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Unknown operation type"
      );
  }
});

/**
 * Public data access function
 * Allows certain read operations without authentication
 */
exports.publicData = functions.https.onCall((data, context) => {
  const operation = data.operation;
  
  switch (operation) {
    case "getPublicQuestions":
      return getPublicQuestions();
    case "getGameSettings":
      return getGameSettings();
    default:
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Unknown operation type"
      );
  }
});

// Helper functions
async function getPublicQuestions() {
  const snapshot = await rtdb.ref("publicQuestions").once("value");
  return snapshot.val() || {};
}

async function getGameSettings() {
  const snapshot = await rtdb.ref("gameSettings/public").once("value");
  return snapshot.val() || {};
}

/**
 * Helper function to add a trivia question to the database
 * @param {Object} data - Question data from the client
 * @param {Object} context - Firebase function context
 * @return {Promise<Object>} Operation result
 */
function addQuestion(data, context) {
  const {question, options, correctAnswer, category} = data;

  if (!question || !options || !correctAnswer || !category) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required question fields",
    );
  }

  return db.collection("triviaQuestions").add({
    question,
    options,
    correctAnswer,
    category,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: context.auth.uid,
  })
      .then(() => {
        return {success: true, message: "Question added successfully"};
      })
      .catch((error) => {
        console.error("Error adding question:", error);
        throw new functions.https.HttpsError("internal", error.message);
      });
}

/**
 * Helper function to delete a trivia question
 * @param {Object} data - Question data including ID
 * @param {Object} context - Firebase function context
 * @return {Promise<Object>} Operation result
 */
function deleteQuestion(data, context) {
  const {questionId} = data;

  if (!questionId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Question ID is required",
    );
  }

  return db.collection("triviaQuestions").doc(questionId).delete()
      .then(() => {
        return {success: true, message: "Question deleted successfully"};
      })
      .catch((error) => {
        console.error("Error deleting question:", error);
        throw new functions.https.HttpsError("internal", error.message);
      });
}

/**
 * Helper function to update game settings
 * @param {Object} data - Settings data
 * @param {Object} context - Firebase function context
 * @return {Promise<Object>} Operation result
 */
function updateSettings(data, context) {
  const {settings} = data;

  if (!settings) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Settings object is required",
    );
  }

  // eslint-disable-next-line max-len
  return db.collection("gameSettings")
      .doc("current")
      .set(settings, {merge: true})
      .then(() => {
        return {success: true, message: "Settings updated successfully"};
      })
      .catch((error) => {
        console.error("Error updating settings:", error);
        throw new functions.https.HttpsError("internal", error.message);
      });
}

/**
 * One-time setup function to assign admin role to a user
 * IMPORTANT: Delete or comment out this function after using it once!
 */
exports.bootstrapAdmin = functions.https.onRequest(async (req, res) => {
  // Secure this endpoint with a secret key
  const secretKey = "your-secret-bootstrap-key"; // Change this to something secure

  if (req.query.key !== secretKey) {
    return res.status(401).send("Unauthorized");
  }

  const email = req.query.email;
  if (!email) {
    return res.status(400).send("Email parameter is required");
  }

  try {
    // Get the user by email
    const user = await admin.auth().getUserByEmail(email);

    // Set custom claims (admin: true)
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
    });

    res.status(200).send(`Success! ${email} is now an admin.`);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

/**
 * Helper function for verifyAdminPassword operation
 */
async function verifyAdminPassword(data) {
  const password = data.password;
  
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
      // Generate a temporary token for admin login
      const adminEmail = "admin@eviltrivia.com"; // Can be any identifier
      
      // Return success with credentials
      return {
        success: true,
        email: adminEmail,
        token: correctPassword // Use the password as the token
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    console.error("Error verifying admin password:", error);
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
    // Update admin password in database
    await rtdb.ref('adminSettings/adminPassword').set(newPassword);
    
    return { success: true };
  } catch (error) {
    console.error("Error updating admin password:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
}

/**
 * Helper function for getAdminSettings operation
 */
async function getAdminSettings(data, context) {
  try {
    // Get admin settings from database
    const snapshot = await rtdb.ref('adminSettings').once('value');
    const settings = snapshot.val() || {};
    
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
    // Update Patreon tier settings
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
