# Evil Trivia

This is the official repository for Evil Trivia, a collection of trivia games, puzzles, and tools.

## Wedding Puzzle

The wedding puzzle is available without authentication at `/pages/wedding.html`. It uses direct REST API calls to Firebase instead of the Firebase SDK to avoid authentication requirements.

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

## Wedding Puzzle

A single-page puzzle experience with 12 virtual screens and an admin dashboard.

### Features

- Screen 0: User registration (name & email)
- Screens 1-10: Puzzles with clues and answer validation
- Screen 11: Completion with confetti animation
- Admin dashboard to create/edit puzzles and monitor player progress

### Database Structure

```
/wedding/
  answers/            # set only from admin page
     1..10:  {answer:"...", clue:"...", imageUrl:"..." (optional)}
  progress/
     {uid}/
        name: ""
        email: ""
        currentScreen: 0     # 0-11
        solved: [ false… ]   # index 1-10
  attempts/           # logs of answer attempts (created by cloud function)
     {puzzleNum}/
        {uid}/
           {attemptId}: {answer:"...", correct:true|false, timestamp:123456789}
```

### Setup and Deployment

1. The feature uses the existing Firebase authentication system
2. Pages:
   - Public: `/wedding` - The main puzzle experience
   - Admin-only: `/weddingadmin` - Dashboard to manage puzzles and view player progress

3. Cloud Functions:
   - `checkWeddingAnswer` - Callable function that securely validates answers

4. Database Rules:
   - Regular users can only access their own progress
   - Only admins can view all player progress and edit puzzle answers
   - Answers are never exposed to clients (only checked server-side)

5. To create puzzles:
   - Log in as admin and navigate to `/weddingadmin`
   - Use the "Puzzles" tab to create your clues and set answers
   - Optionally add image URLs for visual clues
   - Changes are saved automatically

6. Deployment:
   - Database rules are already included in the codebase
   - Deploy with `firebase deploy` to update functions and hosting

### Puzzle Authoring Workflow

1. Draft your puzzles offline with clear clues and answers
2. Enter them in the admin dashboard
3. Test the experience as a user by opening `/wedding` in an incognito window
4. Monitor player progress in the admin dashboard
5. Send hints via email for players who get stuck 