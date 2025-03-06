# Patreon Integration with Firebase Auth

This document provides instructions for deploying the Patreon integration with Firebase Authentication for Evil Trivia.

## Overview

The integration allows users to:
1. Authenticate with Patreon
2. Create a Firebase Auth account linked to their Patreon account
3. Access content based on their Patreon membership tier

## Prerequisites

- Firebase project with Realtime Database and Authentication enabled
- Patreon developer account and OAuth client credentials
- Firebase CLI installed (`npm install -g firebase-tools`)

## Deployment Steps

### 1. Firebase Functions Configuration

Set up your Firebase Functions environment variables:

```bash
firebase functions:config:set patreon.client_id="YOUR_PATREON_CLIENT_ID" \
                             patreon.client_secret="YOUR_PATREON_CLIENT_SECRET" \
                             patreon.redirect_uri="https://your-app-domain.com/auth/patreon/callback"
```

### 2. Deploy Cloud Functions

Ensure your `functions` directory has the required dependencies in `package.json`:

```json
{
  "dependencies": {
    "axios": "^0.27.2",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "express": "^4.18.1",
    "firebase-admin": "^11.5.0",
    "firebase-functions": "^4.2.0"
  }
}
```

Install dependencies and deploy:

```bash
cd functions
npm install
firebase deploy --only functions
```

### 3. Update Firebase Security Rules

Copy the contents of `firebase-rules.json` and deploy them using the Firebase console or CLI:

```bash
firebase deploy --only database
```

### 4. Deploy Website Changes

Upload the updated `patreon.html` file to your hosting.

## How It Works

1. **Authentication Flow**:
   - User clicks "Login with Patreon" button
   - User is redirected to Patreon OAuth page
   - After successful authentication, Patreon redirects to our callback function
   - The function creates/finds a Firebase Auth user and links it to the Patreon account
   - User is redirected back to the app with a Firebase custom token

2. **Security**:
   - All database access requires Firebase Authentication
   - Patreon user data is only accessible to the linked Firebase user or admin
   - Admin settings for Patreon tiers are publicly readable

3. **Membership Verification**:
   - The app verifies the user's Patreon membership tier
   - Content is displayed based on the user's tier level
   - Admin can configure required tiers in the Firebase Database

## Troubleshooting

- **Authentication Issues**: Check that your Patreon OAuth client is configured correctly
- **Firebase Rules**: Test your security rules in the Firebase console
- **Cloud Function Logs**: Check Firebase Functions logs for any errors

## Need Help?

Contact the developer for assistance with this integration. 