# Evil Trivia - Patreon Integration Setup

This guide will walk you through setting up the Patreon integration for your Evil Trivia website.

## Step 1: Set Up Patreon Application

1. Go to the [Patreon Developer Portal](https://www.patreon.com/portal/registration/register-clients)
2. Create a new OAuth client with the following details:
   - **App Name**: Evil Trivia
   - **Description**: Allows Evil Trivia users to access exclusive content with their Patreon membership
   - **Redirect URIs**: `https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon/callback`
   - **Client API Version**: 2
3. After creating the app, make note of your **Client ID** and **Client Secret**

## Step 2: Set Up Patreon Webhooks

1. In your Patreon developer application, go to the **Webhooks** section
2. Add a new webhook with the URL: `https://patreonauth-vapvabofwq-uc.a.run.app/webhooks/patreon`
3. Select the following events:
   - `members:pledge:create`
   - `members:pledge:update`
   - `members:pledge:delete`
4. Save the webhook and copy the **Webhook Secret**

## Step 3: Configure Firebase Functions

1. Make sure you have the Firebase CLI installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Log in to Firebase:
   ```bash
   firebase login
   ```

3. Set the Patreon configuration values:
   ```bash
   firebase functions:config:set patreon.client_id="YOUR_PATREON_CLIENT_ID" \
                              patreon.client_secret="YOUR_PATREON_CLIENT_SECRET" \
                              patreon.redirect_uri="https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon/callback" \
                              patreon.webhook_secret="YOUR_PATREON_WEBHOOK_SECRET"
   ```

4. Deploy the Firebase functions:
   ```bash
   firebase deploy --only functions
   ```

5. Deploy the database rules:
   ```bash
   firebase deploy --only database
   ```

## Step 4: Test the Integration

1. Go to your website and click on the "Login with Patreon" button
2. You should be redirected to Patreon to authorize your application
3. After authorizing, you should be redirected back to your website
4. Check the Firebase console to see if the user data was properly stored

## Troubleshooting

If you encounter any issues:

1. Check the Firebase Functions logs in the Firebase console
2. Verify that your Patreon application settings match the ones in this guide
3. Make sure your Firebase Function configuration has the correct values
4. Check that the callback URLs in your Patreon application match the ones in your Firebase Function config

## Security Considerations

1. The Firebase Functions are configured to only accept requests from your website and Patreon
2. All sensitive data is stored securely in Firebase
3. The OAuth flow includes CSRF protection with a state parameter
4. Webhook requests from Patreon are verified using the webhook secret

## Maintenance

To update the Firebase Functions:

1. Make your changes to the code
2. Run `firebase deploy --only functions` to deploy the changes

## Contact

If you need assistance, please contact the development team. 