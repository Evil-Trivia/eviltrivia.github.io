/* index.js for Firebase Function */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

admin.initializeApp();

const app = express();

// Set up middleware properly
app.use(cors({ origin: true }));
app.use(express.json());

// Using process.env for 2nd Gen functions
const patreonClientId = process.env.PATREON_CLIENT_ID;
const patreonClientSecret = process.env.PATREON_CLIENT_SECRET;
const redirectUri = "https://eviltrivia.com/auth/patreon/callback";

// 1) Start OAuth
app.get("/auth/patreon", (req, res) => {
  const scope = "identity%20identity.memberships";
  const authUrl =
    `https://www.patreon.com/oauth2/authorize?response_type=code` +
    `&client_id=${patreonClientId}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${scope}`;
  return res.redirect(authUrl);
});

// 2) OAuth Callback
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
    await admin.database().ref(`patreonUsers/${patreonUserId}`).set({
      accessToken,
      userData: userData.data,
      membershipData: membershipData || null,
      isActiveMember,
      lastAuthenticated: Date.now(),
    });

    // Check if they have an active membership
    if (isActiveMember) {
      return res.send(`
        <html>
          <body>
            <h2>Patreon login successful!</h2>
            <p>You can close this tab. You'll be redirected automatically in a few seconds.</p>
            <script>
              window.setTimeout(function() {
                window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `);
    } else {
      return res.send(`
        <html>
          <body>
            <h2>Patreon login successful, but you don't have an active membership.</h2>
            <p>Please make sure you have an active pledge to access exclusive content.</p>
            <p><a href="https://www.patreon.com/eviltrivia" target="_blank">Visit our Patreon page</a></p>
            <script>
              window.setTimeout(function() {
                window.close();
              }, 5000);
            </script>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error("Patreon callback error", error);
    let errorMessage = "An error occurred during authentication.";
    
    if (error.response && error.response.data) {
      console.error("Response data:", error.response.data);
      errorMessage = JSON.stringify(error.response.data);
    }
    
    return res.status(500).send(`
      <html>
        <body>
          <h2>Authentication Error</h2>
          <p>There was a problem connecting to Patreon. Please try again later.</p>
          <p>Error details: ${errorMessage}</p>
          <a href="https://eviltrivia.com/patreon">Back to Evil Trivia</a>
        </body>
      </html>
    `);
  }
});

// 3) Webhook for membership changes
app.post("/webhook/patreon", (req, res) => {
  console.log("Patreon webhook data:", req.body);
  
  // Process membership changes here
  // This is where you'd handle events like new pledges, deleted pledges, etc.
  
  return res.status(200).send("ok");
});

// Export for 2nd Gen functions
exports.patreonAuth = functions.https.onRequest(app);

console.log("Force new deploy @", new Date());