# Evil Trivia Patreon Integration

This directory contains the Firebase Functions used for integrating Patreon authentication with Evil Trivia.

## Configuration

Before deploying the functions, you need to set up the following environment variables using Firebase Functions config:

```bash
# Set Patreon API credentials
firebase functions:config:set patreon.client_id="YOUR_PATREON_CLIENT_ID" \
                              patreon.client_secret="YOUR_PATREON_CLIENT_SECRET" \
                              patreon.redirect_uri="https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon/callback" \
                              patreon.webhook_secret="YOUR_PATREON_WEBHOOK_SECRET"
```

## Deployment

To deploy only the functions, run:

```bash
firebase deploy --only functions
```

## Patreon Setup

1. Create a Patreon OAuth client at https://www.patreon.com/portal/registration/register-clients
2. Set the following redirect URL in your Patreon OAuth settings:
   - `https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon/callback`
3. Set the following webhook URL in your Patreon webhook settings:
   - `https://patreonauth-vapvabofwq-uc.a.run.app/webhooks/patreon`
4. Make sure to specify these events for your webhook:
   - `members:pledge:create`
   - `members:pledge:update`
   - `members:pledge:delete`

## Function URLs

- Main auth endpoint: `https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon`
- Callback URL: `https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon/callback`
- Webhook URL: `https://patreonauth-vapvabofwq-uc.a.run.app/webhooks/patreon`
- Custom token endpoint: `https://patreonauth-vapvabofwq-uc.a.run.app/getCustomToken?patreonId=PATREON_USER_ID`

## Security

The functions include security measures:
- CORS restrictions to only allow requests from your domains
- Origin/referer checking to prevent unauthorized access
- Webhook signature verification to confirm Patreon as the sender
- State parameter for CSRF protection during OAuth flow

## Integration with Website

To integrate with your website, use links like:

```html
<a href="https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon?returnUrl=/account.html">
  Connect with Patreon
</a>
```

The `returnUrl` parameter specifies where to redirect after successful authentication. 