# Evil Trivia Website

This repository contains the code for the Evil Trivia website.

## Directory Structure

The codebase is organized as follows:

### Root Directory
- `index.html` - Main homepage
- `404.html` - Error page
- `site.webmanifest` - Web app manifest
- `favicon.ico` - Favicon
- Configuration files (`.gitignore`, `.firebaserc`, `firebase.json`, etc.)

### CSS
- `/css` - Contains all CSS files
  - `reset.css` - CSS reset
  - `styles.css` - Global styles

### JavaScript
- `/js` - Contains all JavaScript files
  - `/js/components` - UI components
    - `autoload-banner.js` - Loads the banner component
    - `banner.js` - Banner implementation
  - `/js/firebase` - Firebase-related code
    - `firebase-init.js` - Firebase initialization
  - `/js/utils` - Utility functions

### Pages
- `/pages` - Contains HTML pages
  - `account.html` - User account page
  - `admin.html` - Admin dashboard
  - `grading.html` - Grading interface
  - `patreon.html` - Patreon integration page
  - `partner.html` - Partner information page
  - `puzzlearchive_admin_940872398742093847.html` - Puzzle archive admin

### Images
- `/images` - Contains all images
  - Various image files and subdirectories

### Configuration
- `/config` - Configuration files
  - `firebase.json` - Firebase configuration
  - `database.rules.json` - Firebase database rules
  - `firebase-rules.json` - Additional Firebase rules

### Documentation
- `/docs` - Documentation files
  - `PATREON_SETUP.md` - Patreon setup instructions
  - `PATREON_INTEGRATION.md` - Patreon integration documentation

### Functions
- `/functions` - Firebase Cloud Functions
  - `index.js` - Main functions code
  - Other function-related files

### Tools
- `/tools` - Development and utility tools
  - `bfg.jar` - BFG Repo-Cleaner for Git history management

## Development

To run this project locally:

1. Clone the repository
2. Set up Firebase configuration
3. Open `index.html` in your browser or use a local server

## Deployment

The site is deployed to Firebase Hosting.

## URL Structure

The site uses Firebase redirects to maintain compatibility with legacy URLs:
- `/account` redirects to `/pages/account.html`
- `/admin` redirects to `/pages/admin.html`
- `/grading` redirects to `/pages/grading.html`
- `/partner` redirects to `/pages/partner.html`
- `/patreon` redirects to `/pages/patreon.html`

## Patreon Integration

The website now features improved Patreon integration, allowing users to connect their Patreon accounts and access exclusive content.

## Testing Git Commit

This is a small change to test Git commit functionality. 