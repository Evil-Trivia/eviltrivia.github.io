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
- `/games/middleground/` redirects to `/games/invenntions/` (legacy name)
- `/games/middleground/admin/` redirects to `/games/invenntionsadmin/`

## InVennTions

**InVennTions** is an Evil Trivia® word puzzle: each row is a Venn-style phrase puzzle (left clue + middle answer + right clue), plus an optional **connection** at the bottom that links all the phrases together.

| | |
|---|---|
| **Player URL** | [https://eviltrivia.github.io/games/invenntions/](https://eviltrivia.github.io/games/invenntions/) |
| **Admin URL** | [https://eviltrivia.github.io/games/invenntionsadmin/](https://eviltrivia.github.io/games/invenntionsadmin/) |
| **Player file** | `games/invenntions/index.html` (single self-contained page: HTML, CSS, JS, Firebase SDK) |
| **Admin file** | `games/invenntionsadmin/index.html` |
| **Firebase game id** | `middleground` (legacy internal id — all RTDB paths use `games/middleground/…`) |
| **Title assets** | `games/invenntions/assets/title/piece-01-I.png` … `piece-11-s.png` |

### How the game works (player)

1. **Title screen** — **Play** loads the current live round(s). **Archive** lists past rounds by date. **What am I doing here?** opens help/scoring text (editable in admin).
2. **Phrase rows** — Each row shows a left clue box, a centre answer box, and a right clue box. Tap an answer box to focus it (yellow highlight). Type with the on-screen keyboard and press **GUESS** (or Enter on a physical keyboard).
3. **Solve in any order** — Phrase rows do not need to be solved top-to-bottom.
4. **Hints** — Tap a clue box twice to confirm revealing a hint (−1 point). When you **correctly guess** a phrase, any unrevealed hints on that row appear automatically at no extra cost.
5. **REVEAL** — Fills in the focused row’s answer (−2 points). The centre squircle animates in **grey** (revealed) instead of **green** (correct guess).
6. **Connection** — After the phrase rows, an optional bottom puzzle asks what links the phrases. Its hints are never auto-revealed; you must tap for them (−1 each).
7. **Finish** — When every phrase and the connection (if present) are solved, the player enters a name and submits a score to the leaderboard. A timer runs for the whole session.

**Scoring**

| Change | Points |
|--------|--------|
| Correct phrase answer | +1 |
| Correct connection | +2 |
| Connection bonus | +1 per phrase row still unsolved when the connection is guessed |
| Each hint you choose to reveal | −1 |
| Using REVEAL on the focused row | −2 |
| Wrong guess | 0 |

**Progress on device**

The game autosaves in-progress rounds to `localStorage` (`invMiddlegroundProgress`, `invMiddlegroundUser`). If Firebase is slow or saved data blocks the title menu on mobile, the client clears saved data once and retries loading automatically.

**Deep links**

Open a specific archive round with `?round=<firebaseRoundId>`, e.g.  
`https://eviltrivia.github.io/games/invenntions/?round=-NxAbCdEf`

### Firebase Realtime Database structure

All paths are under **`games/middleground/`** (game id `middleground`).

```
games/middleground/
  archive/
    {roundId}/
      label              # Admin-only round name (shown in archive list)
      subtitle           # Tagline on the play screen for this round
      playDate           # YYYY-MM-DD — archive sorting; future dates stay off archive until released
      scheduleLive       # If true, auto-marked Live when playDate ≤ today (when admin loads/saves)
      hidden             # If true, omitted from public archive (can still be Live)
      puzzles/           # Array or object of phrase rows
        {n}/
          leftWords      # Left clue text
          rightWords     # Right clue text
          answer         # Middle answer; comma-separated alternates accepted
          leftHints      # Array of hint strings
          rightHints     # Array of hint strings
      commonality/       # Optional connection puzzle
        prompt
        answer           # Comma-separated alternates OK
        hints            # Array of hint strings
      updatedAt

  settings/
    site/
      gameTitle          # Shown in browser tab and title row
      infoHtml           # “What am I doing here?” (HTML)
      playerHelpHtml     # “How to play” modal (HTML)
      aboutEvilTriviaHtml
      updatedAt
    live/
      roundIds           # Ordered array of archive round IDs — Play uses the first
      updatedAt
    activeGameId         # Legacy — used only if archive/live is empty (library fallback)

  library/               # Legacy multi-game format; migrated to archive on first admin load
    {gameId}/

  answers/               # All submitted scores (push id per submission)
    {scoreId}/
      displayName, points, elapsedMs, sessionKey, roundId, roundIds, …

publicAnswers/middleground/
  {scoreId}/             # Mirror of answers for public leaderboard reads
```

**Security rules** (`config/database.rules.json`):

- `games/middleground/archive` and `settings` — read public, **write admin only** (`users/{uid}/role === 'admin'`)
- `games/middleground/answers` and `publicAnswers/middleground` — read/write open (score submission from clients)
- Legacy top-level `publicAnswers/middleground` block also exists for compatibility

### Admin setup and authoring

1. **Admin account** — Sign in at `/pages/account.html` with a Firebase Auth user whose RTDB record is `users/{uid}/role = "admin"`.
2. **Open admin** — Go to `/games/invenntionsadmin/`. Non-admins see a sign-in prompt only.
3. **Site content** — Set game title and rich-text HTML for the three help modals; click **Save site content** (writes `settings/site`).
4. **Create rounds**
   - Click **New round**, then **Edit** to add phrase rows (left clue, middle answer, right clue, optional hints per side).
   - Optionally fill in **Commonality** (prompt, answer, hints).
   - Set **Play date**, **Tagline**, and optionally **Schedule to go live**.
   - **Save round** writes to `archive/{roundId}`.
5. **Publish for Play**
   - Click **Live** on one or more rounds (green badge). **Play** on the title screen loads the **first** live round in order.
   - Use **↑ / ↓** on live rows to reorder multi-round live sets.
   - **Hide** removes a round from the public archive list (hidden rounds cannot stay live).
   - **Leaderboard** per round views/deletes scores for that round.
6. **Legacy migration** — On first admin **Refresh**, if `archive` is empty but `library/` has data, rounds are copied into `archive` and the former active library game is marked live.

### Player score submission

When the puzzle is complete, the finish screen writes one record to:

- `games/middleground/answers/{pushId}`
- `publicAnswers/middleground/{pushId}` (mirror for leaderboard)

Payload includes `displayName`, `points`, `elapsedMs`, `sessionKey` (e.g. `round:{roundId}`), `roundId`, hint/reveal counts, and `formatVersion: 5`. One submission per session is enforced client-side (admins can re-submit for testing).

### Local development

1. Clone the repo and use any static server (Firebase Hosting emulator or `npx serve`) — the game is static HTML + Firebase SDK modules.
2. Firebase config is embedded in both player and admin pages (same project as the rest of Evil Trivia).
3. To test admin changes, sign in as an admin user; to test as a player, use `/games/invenntions/` (incognito avoids cached progress).
4. Deploy with `firebase deploy` (hosting + database rules from `config/database.rules.json`).

### Implementation notes

- **Single-file player** — ~6k lines in `games/invenntions/index.html`; no build step.
- **Keyboard** — Custom on-screen keyboard with iOS/NYT-style letter pop-up preview while a key is held.
- **Visual feedback** — Animated red/blue/green squircles on correct phrase solves; grey centre squircle when an answer was revealed instead of guessed.
- **Auth on player** — Optional; used for admin detection (clears test submissions/progress) and future features. Title menu and play work without sign-in.
- **Redirects** — Old URLs under `/games/middleground/` still work.

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