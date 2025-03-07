# Evil Trivia Website

This repository contains the code for the Evil Trivia website.

## Directory Structure

The codebase is organized as follows:

### Root Directory
- `index.html` - Main homepage
- `404.html` - Error page
- `site.webmanifest` - Web app manifest
- `favicon.ico` - Favicon

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

### Pages
- `/pages` - Contains HTML pages
  - `account.html` - User account page
  - `admin.html` - Admin dashboard
  - `grading.html` - Grading interface
  - `patreon.html` - Patreon integration page
  - `partner.html` - Partner information page

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

## Development

To run this project locally:

1. Clone the repository
2. Set up Firebase configuration
3. Open `index.html` in your browser or use a local server

## Deployment

The site is deployed to Firebase Hosting. 