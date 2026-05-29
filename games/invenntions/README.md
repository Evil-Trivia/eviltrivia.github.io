# InVennTions

An Evil Trivia® word puzzle. Each round has several **phrase rows** (left clue + middle answer + right clue, in a Venn-diagram layout) plus an optional **connection** that ties the phrases together. The whole game lives in this folder as a single self-contained HTML page; admin tooling lives in a sibling folder.

> **Audience.** This README is written to be useful to both human contributors and AI coding agents working on this game. It describes how InVennTions actually works today, not how it might one day work. Keep it that way: when you change behavior, update this file.

---

## Quick reference

| | |
|---|---|
| Player URL (prod) | https://eviltrivia.github.io/games/invenntions/ |
| Admin URL (prod) | https://eviltrivia.github.io/games/invenntionsadmin/ |
| Player file | `games/invenntions/index.html` (single page, no build step) |
| Admin file | `games/invenntionsadmin/index.html` (single page, no build step) |
| Legacy redirects | `games/middleground/index.html`, `games/middleground/admin/index.html` |
| Firebase RTDB root for this game | `games/middleground/` *(legacy id — do not rename)* |
| Public leaderboard mirror | `publicAnswers/middleground/` |
| Site-wide RTDB security rules | `config/database.rules.json` |
| Top-level repo README | `../../README.md` |
| Dependencies | None bundled — Firebase JS SDK 9.17.2 loaded from `gstatic.com` |
| Build/test | None. Static page. Open in a browser or any static server. |
| Deploy | `firebase deploy --only hosting,database` from repo root |

If you only remember one thing: **the RTDB game id is `middleground`, even though the folder is `invenntions/`**. Renaming the RTDB paths would orphan every existing round and submitted score.

---

## Player rules (canonical)

These are the rules the game actually enforces in code. If a UI string in the help modal contradicts them, treat the code as the source of truth and update the help text in `settings/site/playerHelpHtml`.

- **Title screen.** Three buttons: **Play** (loads the live round), **Archive** (lists past rounds by play date), **What am I doing here?** (info modal). A "next game on <date>" line appears under Play once a scheduled round exists.
- **Phrase rows.** Each row has a left clue, a centre answer strip, and a right clue. Tap the answer strip to focus it (yellow `box-shadow` ring). Type with the on-screen keyboard and press **GUESS** (or `Enter` on a physical keyboard). Rows can be solved in any order.
- **Hints.** Tap a clue box once to confirm, again to reveal (−1 point per hint). On a correct phrase guess, **any remaining hints for that row appear automatically at no extra cost**. The connection's hints are never auto-revealed.
- **REVEAL.** Fills in the focused row's answer for **−2 points**. The centre squircle animates in **grey** (revealed) instead of the red/blue/green correct-guess colors. There is no REVEAL for the connection.
- **Connection.** Optional bottom puzzle that asks what links the phrases. Correct connection is **+2** plus **+1 per still-unsolved phrase row** (the "early bird" bonus). The pending bonus is shown inline in the connection answer box until the user starts typing.
- **Finish.** When all phrase rows and the connection (if present) are solved, the score modal opens. The player enters a display name and submits a single record to the leaderboard. The timer is paused at this point.
- **Mobile orientation.** Portrait only. Landscape on a mobile device shows a "Rotate your phone" overlay.

### Scoring (from `addScore`, `applyFreeHintsOnPhraseSolve`, `onGuess`, `onReveal`)

| Change | Points |
|---|---|
| Correct phrase answer | +1 |
| Correct connection | +2 |
| Connection bonus | +1 per phrase row still unsolved when the connection is guessed |
| Each hint you choose to reveal | −1 |
| Using REVEAL on the focused row | −2 |
| Wrong guess | 0 |

Score can go negative. The displayed score is the unbounded sum; no floor is applied.

---

## File layout

```
games/invenntions/
  index.html          # Player. ~6300 lines: HTML + CSS + ES module JS + Firebase SDK imports.
  README.md           # This file.

games/invenntionsadmin/
  index.html          # Admin dashboard. Auth-gated by users/{uid}/role === 'admin'.

games/middleground/
  index.html          # <meta refresh> redirect to ../invenntions/.
  admin/index.html    # <meta refresh> redirect to ../invenntionsadmin/.

config/database.rules.json
                      # RTDB security rules. Two blocks reference `middleground`:
                      #   - games/middleground (admin-write for archive+settings, open r/w for answers)
                      #   - publicAnswers/middleground (open r/w for the public mirror)

functions/            # Firebase Cloud Functions for the wider site. Not used by InVennTions.
```

The player and admin pages are intentionally single self-contained HTML files. They have no build step, no bundler, no source maps to maintain, and no shared JS modules with the rest of the repo. Both load the Firebase JS SDK directly from `https://www.gstatic.com/firebasejs/9.17.2/...` via ES module imports.

---

## Architecture overview

`games/invenntions/index.html` is one document with three concurrent concerns:

1. **Title screen** (`#titleScreen`) — local-only assets, no Firebase required to render. Animates a hand-drawn CSS logo (`.inv-logo` + `.inv-piece` divs + `.inv-squircle-*` SVG paths). Decides whether to send the user to Play, Archive, or the info modal. *Made from scratch in CSS — there are no PNG image assets.*
2. **Archive screen** (`#archiveScreen`) — loaded lazily from RTDB `games/middleground/archive/`, sorted by `playDate` desc, omits rounds with `hidden: true` or future `playDate`.
3. **Quiz screen** (`#quizCard`) — the actual game. Renders one or more `gameRounds[]` entries (currently always one). Includes the custom on-screen keyboard, the focus ring, animated squircle reveals, hint boxes, timer, and finish/leaderboard flow.

All three screens live in the same DOM tree; the JS toggles `.hidden` and updates `body.inv-quiz-active` / `body.inv-title-active` classes to switch CSS modes.

### State the game holds in JS (rough mental model)

```
gameRounds[]            # one entry per round in the active session
  .puzzles[]            # phrase rows for that round
  .commonality          # optional connection puzzle for that round
  .roundTitle           # display label
  .subtitle             # display subtitle

puzzles[]               # phrase rows for the CURRENTLY active round (mirror of gameRounds[currentRoundIdx].puzzles)
puzzleSolved[]          # parallel array of booleans
puzzleBuffers[]         # parallel array of in-progress typed strings
revealedLeftArr[]       # number of left hints revealed for each row
revealedRightArr[]      # number of right hints revealed for each row

commonality             # active round's connection puzzle (or null)
commonalitySolved       # boolean
commonalityBuffer       # in-progress typed string
revealedComHints        # number of connection hints revealed

focusKind               # 'phrase' | 'commonality'
focusPuzzleIndex        # which phrase row has the yellow focus ring (-1 if commonality)
phase                   # 'play' | 'finish'
playSessionRoundKey     # e.g. "round:-NxAbCdEf"; identifies the current session for storage
```

The legacy multi-round path (`gameRounds.length > 1`) still has plumbing but Live currently only ever publishes a single round. `collapseToSingleRoundSession()` enforces this at runtime.

### External dependencies

- **Firebase JS SDK 9.17.2** — `firebase-app`, `firebase-database`, `firebase-auth`. Loaded via `import` from gstatic.
- **Firebase config** is hardcoded in both player and admin pages (`firebaseConfig` at the top of each `<script type="module">`). Same project as the rest of Evil Trivia (`eviltrivia-47664`).
- **The shared Evil Trivia banner / nav** from the rest of `eviltrivia.github.io` is **deliberately not loaded** on the player or admin page. The game owns its full viewport.

---

## Firebase Realtime Database structure

All paths are under `games/middleground/` (game id `middleground`).

```
games/middleground/
  archive/
    {roundId}/
      label              # admin-only display name (shown in the archive list)
      subtitle           # tagline rendered under the H1 during play
      playDate           # YYYY-MM-DD; future dates stay off the public archive until released
      scheduleLive       # if true, admin's Refresh auto-marks Live when playDate <= today
      hidden             # if true, omitted from public archive and cannot be Live
      puzzles/           # array OR object of phrase rows
        {n}/
          leftWords      # left clue text
          rightWords     # right clue text
          answer         # middle answer; comma-separated alternates are accepted
          leftHints      # array of hint strings (string-per-line in admin)
          rightHints     # array of hint strings
      commonality/       # optional connection puzzle
        prompt
        answer           # comma-separated alternates OK
        hints            # array of hint strings
      updatedAt

  settings/
    site/
      gameTitle          # shown in the browser tab and the title row H1
      infoHtml           # "What am I doing here?" modal body (HTML)
      playerHelpHtml     # "How to play" modal body (HTML)
      aboutEvilTriviaHtml
      updatedAt
    live/
      roundIds           # ordered array of archive round IDs. Play loads roundIds[0].
      updatedAt
    activeGameId         # legacy library fallback — used only if archive/live is empty

  library/               # legacy multi-game format. Migrated into `archive/` on first admin Refresh.
    {gameId}/

  answers/               # submitted scores (push id per submission)
    {scoreId}/
      displayName, points, elapsedMs, sessionKey, roundId, roundIds, formatVersion, ...

publicAnswers/middleground/
  {scoreId}/             # public mirror of `answers/` for unauthenticated leaderboard reads
  metrics/
    pageViews/{pushId}   # one lightweight page-load event per browser session
    visitors/{visitorId} # per-device visitor marker (unique visitor count)
```

### Security rules summary (`config/database.rules.json`)

| Path | Read | Write |
|---|---|---|
| `games/middleground/archive` | public | admin only (`users/{uid}/role === 'admin'`) |
| `games/middleground/settings` | public | admin only |
| `games/middleground/answers` | public | open (clients submit their own scores) |
| `publicAnswers/middleground` | public | open (mirror, written from the client at submit time) |

There is a separate top-level `publicAnswers/middleground` rule block kept for legacy compatibility. **Do not consolidate them without testing both paths still work.**

---

## Map of `games/invenntions/index.html`

Approximate areas inside the single file. Line numbers drift across edits — use these as a starting point for searches, not as guarantees.

| Area | What lives there |
|---|---|
| `<head>` | All page CSS. Notable rule groups: `.inv-title-screen`, `.inv-logo` / `.inv-piece` / `.inv-squircle-*` (title animation), `.mg-phrase-block`, `.mg-answer-strip` (game board), `.keyboard-wrap` / `.kb-key` (on-screen keyboard), `.kb-key-pop*` (iOS-style key popup paddle). |
| `<body>` markup | `#titleScreen`, `#archiveScreen`, `#quizCard` (`#playCard` → `#boardArea` → `#puzzleMount`, plus `#keyboardWrap`), modals (`#helpModal`, `#infoModal`, `#aboutModal`, `#scoreModal`), the rotate overlay, and `#kbKeyPop` for the keyboard popup. |
| Firebase init + auth | Top of the `<script type="module">`. `onAuthStateChanged` sets `window.invIsAdmin` if the signed-in user has `users/{uid}/role === 'admin'`. Admins get their stored progress/submission cleared on sign-in so they can re-test rounds. |
| Constants | `GAME_ID = 'middleground'`, keyboard key arrays (`KB_TOP/MID/BOT`), storage keys (`INV_USER_STORAGE_KEY`, `INV_PROGRESS_STORAGE_KEY`, `INV_SUBMIT_STORAGE_KEY`, `INV_RECOVERY_KEY`, `INV_VISITOR_ID_KEY`, `INV_PAGE_VIEW_TRACKED_KEY`), timing constants (`KB_FLASH_MS`, `KB_KEY_POP_LINGER_MS`, `KB_KEY_POP_FADE_MS`, etc.), and the default HTML for the help/info/about modals (`DEFAULT_PLAYER_HELP_HTML`, `DEFAULT_INFO_HTML`, `DEFAULT_ABOUT_HTML`). |
| Scoring + hint UI | `addScore`, `registerHintUsed`, `applyFreeHintsOnPhraseSolve`, `syncPhraseHintTapUi`, `syncComHintTapUi`, `updateComBonusHint`, `buildScoreBreakdownHtml`. |
| Timer | `startPlayTimer`, `stopPlayTimer`, `resumePlayTimer`, `getPlayElapsedMs`, `updateTimerStat`. |
| Local persistence | `readPlayProgress` / `savePlayProgress` / `ensureProgressAutosave` / `invClearPlayProgress`; `readSubmitRecord` / `writeSubmitRecord` / `invClearSubmitSession`; `readUserProfile` / `writeUserProfile` / `markUserVisited`. `sanitizeStoredPlayerData` runs at title boot and clears anything corrupted. |
| Recovery | `prefetchQuizWithRecovery` will clear local storage exactly once (guarded by `INV_RECOVERY_KEY`) if Firebase data fails to load, to unwedge stuck mobile sessions. |
| Title animation | `initTitleScreen`, `armSquircleAnimation`, `layoutSquirclePaths`, `bindSquircleLayout`, `finishTitleIntro`, `skipTitleIntroAnimation`. The squircles use `roundedRectPath` to draw three overlapping rounded rectangles whose intersections form the IVN / VEN / TIONS Venn diagram. |
| Archive | `loadArchiveCatalog`, `renderArchiveList`, `enrichArchiveSubmissionRanks`, `formatArchiveStatus`. |
| Quiz fetch | `loadQuiz`, `fetchQuizData`, `loadQuizDataOnly`, `loadLiveRoundsFromArchive`, `loadLegacyLibraryGame`, `fetchQuizDataForRoundIds`, `archiveBlockToPlayRound`. |
| Board rendering | `renderBoard`, `renderPuzzleHintRow`, `renderComHintZone`, `syncFocusedStripDisplay`, `applyActiveGuessHighlight`, `clearActiveGuessHighlight`. |
| Layout/fit | `syncPlayViewportLayout`, `fitBoardToViewport`, `captureLayoutViewport`, `shouldReflowLayoutForWindowResize`, `reflowQuizLayoutFromViewport`. The "viewport-locked" pattern (`layoutViewportLocked`) avoids reflowing on small mobile-Safari URL-bar shimmers. |
| Phrase squircles | `layoutPhraseSquirclePaths`, `playPhraseSolveSquircle`, `restoreSolvedPhraseSquircles`. Animated red/blue/green strokes on a correct guess; grey strokes if the answer was REVEALed. |
| On-screen keyboard | `buildKeyboard`, `ensureKeyboardPointerHandling`, `fireKbKey`, `scheduleKbInput`, `flashKeyBtn`, `flashKeyForInput`, `kbHaptic`. Pointer events power the key tracking; a microtask-batched queue (`pumpKbInputQueue`) preserves tap order. |
| iOS-style keyboard popup | `buildIosKeyPopPath`, `showKbKeyPop`, `hideKbKeyPop`, `hideKbKeyPopImmediate`, `kbKeyPopLabelFor`, `shouldShowKbKeyPop`. The popup is a single SVG `<path>` (a paddle: wider bubble on top, S-curve neck, key-width stem) drawn into `#kbKeyPop` and positioned via `transform: translate(-50%, calc(-100% + var(--kb-key-pop-stem)))`. The stem height is set to the actual pressed key's `rect.height`, so the paddle fully covers the pressed key — the popup *is* the "held yellow" state, no separate timer. |
| Input + guess flow | `onKeyTap`, `onGuess`, `onReveal`, `revealFocusedAnswer`, `checkAllComplete`, `shakeStrip`, `cycleFocus`, `focusNextSlot`, `onPhysicalKeydown`. |
| Finish + submission | `showFinish`, `scheduleFinishModalReveal`, `revealScoreModal`, `submitFinalScore`, `loadPublicLeaderboard`, `showFinishLeaderboard`, `shareMyScore`, `markSessionSubmitted`, `hasSubmittedForCurrentSession`. |
| Misc UI | `bindModalUi`, `openHelpModal`, `openInfoModal`, `openAboutModal`, `openScoreModal`, `closeAllModals`, `bindRotateOverlay`, `updateRotateOverlay`. |

### Key DOM selectors

| Selector | Role |
|---|---|
| `#titleScreen`, `#archiveScreen`, `#quizCard` | The three top-level screens. |
| `#playCard`, `#boardArea`, `#puzzleMount` | Quiz card → board container → mount point for the rendered puzzle HTML. |
| `.mg-phrase-block[data-phrase-i="N"]` | One phrase row. `data-phrase-i` is the index into `puzzles[]`. |
| `#strip-p-N` | Answer strip for phrase N. Becomes `.focused` when the row has the yellow ring. |
| `#strip-c` | Connection answer strip. |
| `.mg-answer-strip.focused` | The currently focused strip. The yellow ring is a `box-shadow` on this selector — **not** a separately-positioned overlay (a previous overlay-based ring drifted relative to the strip during pinch/desktop zoom). |
| `#keyboardWrap`, `#keyboardRoot` | The on-screen keyboard. `hidden-kb` class hides it during the finish screen. |
| `#kbKeyPop`, `#kbKeyPopSvg`, `#kbKeyPopPath`, `#kbKeyPopText` | The iOS-style key popup paddle. |

---

## State + persistence model

InVennTions writes profile/progress markers to browser storage, emits one lightweight page-view metric per browser session, and writes one score record to Firebase per finished session.

### Emergency device reset

One escape hatch is wired up for the case where a player's local storage / Firebase auth state has gotten stuck and the title screen no longer loads:

1. **URL flag** — visiting `https://eviltrivia.github.io/games/invenntions/?reset=1` calls `invFullDeviceReset()` BEFORE any title-screen wiring runs. The query string is stripped via `history.replaceState` so a manual refresh doesn't re-trigger the reset.

The reset path goes through `invFullDeviceReset()`, which:

- Clears `INV_USER_STORAGE_KEY`, `INV_PROGRESS_STORAGE_KEY`, `INV_SUBMIT_STORAGE_KEY` and the `INV_RECOVERY_KEY` session flag (same as `resetInvenntionsPlayerStorage`).
- Calls Firebase `signOut(auth)` — this clears the Firebase auth IndexedDB store and the in-memory token. We saw iOS Safari sessions get wedged with a signed-in user whose RTDB reads silently hung; the same account worked in incognito and on other devices. Wiping localStorage alone did not unstick those sessions, but signing the user out did.

The existing automatic `prefetchQuizWithRecovery` now also calls `invFullDeviceReset()` instead of just `resetInvenntionsPlayerStorage()` so the auth state is included when the page detects a failed first prefetch.

### Browser storage keys

| Key | Shape | Purpose |
|---|---|---|
| `invMiddlegroundUser` | `{ displayName?, visited?, helpHinted?, submissions?, progressByRound?, ... }` | Per-user profile cache. `visited` is set true after the user opens the title screen for the first time (used to skip the first-visit wiggle on the title's "What am I doing here?" button). `helpHinted` is set true the first time the in-game "?" help button is wiggled after a wrong guess (one-shot, see "First-game help nudge" below). `submissions` and `progressByRound` are per-round dictionaries. |
| `invMiddlegroundProgress` | `{ sessionKey, puzzleBuffers[], puzzleSolved[], revealedLeftArr[], revealedRightArr[], commonalityBuffer, commonalitySolved, revealedComHints, scoreBreakdown, elapsedMs, ... }` | In-progress autosave. Restored by `tryRestoreRoundSession` when the user re-opens the same round. Autosaved every `PROGRESS_AUTOSAVE_MS` (12s). |
| `invMiddlegroundVisitorId` | string | Stable anonymous visitor ID used for admin traffic stats (`unique visitors`) and to dedupe `players per game` when available. |
| `invMiddlegroundScoreSubmitted` | `{ [sessionKey]: { displayName, rank, ... } }` | Records that this session was already submitted, so the finish modal becomes view-only on reload. |
| `invMiddlegroundAutoRecovery` | timestamp | One-shot recovery guard. `prefetchQuizWithRecovery` clears storage exactly once if Firebase data fails to load, to unblock stuck mobile sessions. |
| `invMiddlegroundPageViewTracked` | `'1'` (sessionStorage) | Session flag so each browser tab emits at most one `metrics/pageViews` event per load. |

Admins (`window.invIsAdmin === true`) get their submission and progress records cleared on sign-in so they can play the same round repeatedly for testing.

### Score submission

When the puzzle is complete, the finish screen writes one record to BOTH paths atomically:

- `games/middleground/answers/{pushId}` — internal score store
- `publicAnswers/middleground/{pushId}` — mirror, used by the public leaderboard reads

The payload includes `displayName`, `visitorId`, `points`, `elapsedMs`, `sessionKey` (e.g. `round:{roundId}`), `roundId`, `roundIds`, hint/reveal counts, per-question results, and `formatVersion: 7`. One submission per session is enforced client-side via `invMiddlegroundScoreSubmitted`.

Per-question fields added in `formatVersion: 6`:

- `phraseResults[]` — one entry per phrase row in the order rendered. Each entry is `{ solved, revealed, manualHintsLeft, manualHintsRight }`. `manualHints*` counts only hints the player chose to reveal at −1 each — auto-revealed free hints on a correct guess do not increment them.
- `commonalityResult` — `{ solved, revealed, manualHints, bonusPoints }` for the connection puzzle, or omitted (`null`) if the round has no connection.
- `themeBonusPoints` — copy of the connection's `bonusPoints` (the early-bird bonus the player banked on the connection guess), surfaced at the payload root for convenience.

These fields are also mirrored into the local submission record (`invMiddlegroundUser.submissions[sessionKey]`) so the share-emoji grid and Venn-diagram squircle colors can be reconstructed when the player re-opens a round they already submitted.

`formatVersion: 7` adds `visitorId` (anonymous per-browser identifier) so admin analytics can estimate unique players per round without relying on display names.

### Deep links

Open a specific archive round with `?round=<firebaseRoundId>`:

`https://eviltrivia.github.io/games/invenntions/?round=-NxAbCdEf`

`getDeepLinkRoundId()` parses the URL; `playArchiveRoundIds` is the entrypoint for loading a specific round.

---

## Images in the help / info / about modals

The Site-content rich-text editors (info, How to play, About) support inline images and animated GIFs. Starter assets ship in this folder:

- `games/invenntions/HowTo_Question.png` — annotated example of a phrase clue / answer box.
- `games/invenntions/HowTo_Answer.png` — annotated example of a solved row + connection.
- `games/invenntions/Hints.gif` — short screen-recording demo of revealing hints. Generated from `Hints.mov` (same folder) via ffmpeg; the `.mov` is kept as the source asset.

**To insert one while authoring:** in the admin's rich-text toolbar, drop down the **📷 Image…** select on the right side of the toolbar, pick one, and it is inserted as an `<img>` at the current cursor position. The dropdown also has a **Custom path…** entry that prompts for any URL or absolute site path. The inserted `<img>` is a real DOM element, so you can position it precisely inside a paragraph, after a heading, etc., simply by placing your cursor there before picking from the dropdown.

**To add more reusable images:**

1. Drop the file into `games/invenntions/` (any filename — but it must live in this folder so the absolute `/games/invenntions/...` path resolves on both player and admin pages). PNG, JPG, GIF (animated GIFs work — they reuse the same `<img>` tag) are all fine.
2. Add an entry to the `HOWTO_IMAGES` array near the top of `games/invenntionsadmin/index.html`:
   ```js
   const HOWTO_IMAGES = [
     { name: 'HowTo_Question', file: 'HowTo_Question.png' },
     { name: 'HowTo_Answer',   file: 'HowTo_Answer.png' },
     { name: 'Hints (gif)',    file: 'Hints.gif' }
   ];
   ```
3. Reload the admin page — the new image is in every editor's dropdown.

**For screen-recording demos (.mov → .gif):** drop the `.mov` into `games/invenntions/`, then convert with `ffmpeg`'s two-pass palette workflow at the same duration as the source:

```bash
W=360 FPS=12 SRC=games/invenntions/Hints.mov DST=games/invenntions/Hints.gif PAL=/tmp/inv_palette.png
ffmpeg -y -i "$SRC" -vf "fps=$FPS,scale=$W:-1:flags=lanczos,palettegen=stats_mode=diff" "$PAL"
ffmpeg -y -i "$SRC" -i "$PAL" -lavfi "fps=$FPS,scale=$W:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 "$DST"
rm "$PAL"
```

`fps=12` controls file size but keeps the playback duration identical to the source (the filter resamples frames, it does not retime). 360px width matches the player's `.mg-rich img` cap on retina without upscaling.

**Sizing.** Inserted images are styled responsively by `.mg-rich img` in `games/invenntions/index.html`:

```css
.mg-rich img {
  display: block;
  max-width: 100%;
  width: min(100%, 420px);
  height: auto;
  margin: 14px auto;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
```

So they cap at 420px wide on desktop, shrink to fit on narrow phones, and never get horizontally cut off inside the modal. The admin editor mirrors these styles via `.rte-editor img` so authoring matches what the player sees.

---

## Admin workflow (`games/invenntionsadmin/index.html`)

1. **Sign in** at `/pages/account.html` as a Firebase user whose RTDB record has `users/{uid}/role = "admin"`.
2. **Open the admin page.** Non-admins see a sign-in prompt; nothing else loads.
3. **Site content tab.** Set the game title and rich-text HTML for the three help/info/about modals; click **Save site content** (writes `settings/site`).
4. **Rounds tab.**
    - **New round** → blank editor.
    - Each round editor lets you edit phrase rows (left clue / middle answer / right clue / optional hints per side) and an optional commonality (prompt / answer / hints).
    - **Play date**, **Tagline (subtitle)**, **Schedule to go live** flags.
    - **Save round** writes to `archive/{roundId}`.
5. **Publish for Play.**
    - **Live** toggles a round into `settings/live/roundIds`. **Play** on the title screen loads `roundIds[0]`.
    - Multi-round live arrays are still supported in the data model; the player currently collapses to a single round (`collapseToSingleRoundSession`).
    - **↑ / ↓** reorder live rounds.
    - **Hidden** removes a round from the public archive. Hidden rounds cannot stay live.
    - **Leaderboard** per round lets the admin view and delete scores for that round.
6. **Stats panel.**
    - **Page views** and **Unique visitors** are read from `publicAnswers/middleground/metrics`.
    - **Players per game** lists archive rounds in oldest-first order (#1 = oldest) with both unique player count and raw submission count.
    - Unique players prefer `visitorId` and fall back to legacy session/display-name signals for older submissions.
7. **Legacy migration.** On the first admin Refresh, if `archive/` is empty but `library/{gameId}/` has data, the admin copies the rounds into `archive/` and marks the old "active library game" as Live. This is implemented in `migrateLegacyIfNeeded`.

---

## Local development

The game is static HTML + the Firebase SDK. No build, no install. The simplest dev loop:

```bash
# From repo root
npx serve .
# → open http://localhost:3000/games/invenntions/
```

Or use the Firebase Hosting emulator:

```bash
firebase emulators:start --only hosting
```

To deploy:

```bash
firebase deploy --only hosting,database
```

`--only database` ships any rule changes from `config/database.rules.json`. Hosting picks up the static files including this folder.

### Testing notes

- **To play as a normal user**, open `/games/invenntions/` in an incognito window — that avoids cached progress in `localStorage`.
- **To test admin changes**, sign in as an admin user; admin sign-in clears local progress/submission for the current session, so admins can replay the same round.
- **There are no automated tests** for this game. UX changes must be verified manually in a browser. Mobile-relevant changes should at minimum be tested in iOS Safari and Android Chrome (or their devtools mobile emulators).

---

## Conventions, gotchas, and "always / never / ask first"

### Always

- **Treat the RTDB id `middleground` as a load-bearing constant.** It appears in the player, the admin, the security rules, and the public-leaderboard mirror. The folder rename from `middleground/` to `invenntions/` already happened; the data id did not move with it.
- **Keep the player and admin pages self-contained.** No shared JS bundles, no extracted modules. If you want to share code, copy it. This is intentional — these pages are deployed via GitHub Pages with no build pipeline.
- **Sanitize user-rendered strings** with `esc()` / `escAttr()` (already used everywhere round data is interpolated into the DOM). Round content is admin-authored but still goes through `innerHTML` writes.
- **Update `playerHelpHtml` / `infoHtml` (admin → Site content)** when you change a player-visible rule. The defaults in `DEFAULT_PLAYER_HELP_HTML` / `DEFAULT_INFO_HTML` are fallbacks; live rounds usually have site content set.
- **Position visual overlays *on* the element they decorate, not as floating fixed siblings.** The yellow focus ring used to be a `position: fixed` overlay positioned via `getBoundingClientRect()`; it drifted from the focused answer strip on pinch/desktop zoom. It is now a `box-shadow` on `.mg-answer-strip.focused:not(.solved)` so it scales and pans with the element naturally. If you ever feel the urge to add another floating fixed overlay aligned to an in-flow element, prefer a CSS pseudo-element / shadow / outline first.
- **Bump `formatVersion`** on `answers/`/`publicAnswers/` writes if you change the submission payload shape. The leaderboard reader does best-effort parsing of older versions; do not assume fields exist.

### Never

- **Never rename the RTDB path `games/middleground/` to `games/invenntions/`** without a migration script and a security-rules update. You'll lose every existing round and every leaderboard entry, and admin writes will start failing because the rules still gate on the old path.
- **Never reintroduce PNG image assets for the title logo.** The logo is built from scratch in CSS via `.inv-piece` divs + animated SVG squircles. There used to be `assets/title/piece-XX.png` references with a JS load-error fallback; that whole path is gone. If you need to change the logo, edit the divs and the squircle path math (`layoutSquirclePaths`).
- **Never block the title menu on Firebase.** The Play button must remain tappable even if `prefetchQuiz` fails. The current flow uses `prefetchQuizWithRecovery` (one-shot localStorage clear + retry) and times out RTDB reads via `invDbGet(..., INV_DB_TIMEOUT_MS)`. Past regressions repeatedly soft-locked the mobile title screen; do not undo this resiliency.
- **Never add a `position: fixed` element whose coordinates come from `getBoundingClientRect()` of an in-flow element.** Pinch zoom drifts it. See the focus-ring section above.
- **Never disable the rotate-to-portrait overlay on mobile.** Landscape breaks the keyboard layout. `bindRotateOverlay` handles the toggle.
- **Never write to `users/{uid}/role` from the player or admin page.** Roles are managed out-of-band (admin console / cloud function). The admin page reads the role on sign-in via `users/${user.uid}/role`.

### Ask first

- Any change that would alter the **scoring math**, the **submission payload shape**, or the **score-per-session uniqueness rule**. Players have a leaderboard and historic submissions; silently moving the goalposts is bad.
- Anything that touches `config/database.rules.json` — both the `games/middleground/...` block and the `publicAnswers/middleground` block need to stay coherent.
- Any visual change to the title-screen animation timing (`SQUIRCLE_PAIR_MS`, `SQUIRCLE_VENN_MS`, etc.) — the timings are tuned to feel right; "just shorten it" is rarely the right answer.
- Any change to the keyboard popup geometry (`buildIosKeyPopPath`) — the proportions are scaled from the actual iOS keyboard popup constants and were tuned through several iterations; capture the proposed change visually before committing.

---

## Visual design notes

### Clue-box layout (height budget)

Each `.mg-words` (the left or right clue card on a phrase row) is a fixed-height container whose available vertical space is split between the clue text and (when revealed) the inline hint area beneath it. Two JS constants in `preprocessClueBoxLayout` define the budget, both in `em` units relative to `.mg-words`' own font:

| Constant | Default | What it does |
|---|---|---|
| `MG_WORDS_H_EM` | `4.0` | Total fixed height of every `.mg-words` box. Drives the `--mg-words-h` CSS variable. |
| `MG_HINT_SLOT_EM` | `1.5` | Height of the hint slot (`.mg-hint-area`) when a hint is shown. Drives `--mg-hint-slot-h`. |

The CSS variables `--mg-full-clue-h` (no hint) and `--mg-split-clue-h` (with hint) are derived from the above minus the outer `.mg-words` padding.

Five gotchas worth remembering, all of which were part of the "descenders cut off, second clue line clipped when hint is shown" bug:

1. **No inner padding on `.mg-words-text` or `.mg-hint-lines`.** They both used to have `padding: 2px` — combined with `box-sizing: border-box` and a tight `max-height`, that ate ~4px off the usable text area and caused glyph descenders to clip even when the binary font-fit search had picked the smallest allowed font (`MG_FIT_MIN_PX = 7.5`).
2. **Clue text always allows 2 lines** (`fitClueWordsText` uses `maxLines = 2` unconditionally). When a hint is revealed, `.mg-words.mg-words--with-hint .mg-words-text` keeps `-webkit-line-clamp: 2` (not 1) and the binary search shrinks the font enough that two lines fit inside `--mg-split-clue-h`. Forcing `line-clamp: 1` clipped any multi-word clue that wrapped.
3. **Hint text uses normal block flow, not `-webkit-line-clamp`.** On iOS Safari, `display: -webkit-box` + `-webkit-line-clamp` + `overflow: hidden` can clip descenders (`p/y/g/j/q`) in `.mg-hint-lines` even when there is visible room. The current rule uses `display: block`, `line-height: 1.2`, and lets the parent `.mg-hint-area` be the sole clipping boundary.
4. **With-hint micro-alignment matters.** In the `mg-words--with-hint` state, the vertical gap between clue and hint is `0` (not `2px`), the clue text is nudged up by `1px`, and `fitHintLinesText()` shrinks hint font to the slot when needed. That combination prevents the hint's second line from clipping while keeping clue text visually inset from side edges (the with-hint fit path narrows clue text width to `calc(100% - 4px)` with `2px` side margins).
5. **Hint edge + layering rules.** Hint-only outer-edge breathing room is applied via `.mg-side-left .mg-hint-area { padding-left: 2px; }` and `.mg-side-right .mg-hint-area { padding-right: 2px; }` so outermost hints don't hug the screen border. In with-hint state, `.mg-hint-area` / `.mg-hint-lines` get elevated `z-index` and `overflow: visible` so descenders on line 2 are painted above sibling row content instead of being visually shaved.

If you change the budget, do the math against `clueFitCeilingPx`: shrinking the slot below ~9px-equivalent for two lines makes the clue illegible on phones.

### Title intro layout stability

The logo intro animation should start and end in the same vertical position. To prevent post-intro "logo jump" when async title text arrives:

- `.inv-title-status` keeps its line box reserved even when empty (`visibility: hidden` instead of collapsing with `display: none`).
- `.inv-title-next-game` always reserves two lines of space (`min-height: 2.7em`), and its hidden state preserves layout (`display: block !important; visibility: hidden`) instead of removing the element from flow.
- The button stack (`.inv-title-menu`) reveals with a short transition (`opacity` + small `translateY`) so it fades in and rises a touch instead of snapping in.

This ensures that when `updateNextScheduledNote()` reveals the "next puzzle releasing on..." text after prefetch, the centered title block does not recenter upward.

### Keyboard hit-testing (no dead space between keys)

The on-screen keyboard's `pointerdown` / `pointermove` handlers don't require the touch to land directly on a `.kb-key` element. `findKbKeyAtOrNear(clientX, clientY)`:

1. First checks the element directly under the touch (`document.elementFromPoint`); if it resolves to a non-disabled `.kb-key` inside `keyboardRoot`, that's the answer.
2. Otherwise falls back to a Euclidean-distance scan over every key in `keyboardRoot`, picking the nearest one whose bounding rect's closest point is within ~36px of the touch.

Without that fallback, a tap that landed in the inter-key gap (the 4px row gap, the 4px column gap, or just outside a key's border but still inside the keyboard) registered nothing — the iOS keyboard does not have this dead space, and the asymmetry felt buggy. Keep both branches in this resolver: the direct-hit shortcut is fast (no per-key rect math), and the distance fallback only runs on the rare miss.

### iOS-style keyboard popup

When the player taps any letter, space, or backspace on the on-screen keyboard, a yellow paddle pops out of the key. Implementation:

- The popup HTML is `<div id="kbKeyPop"><svg><path/><text/></svg></div>`, a single fixed-positioned container above the keyboard.
- `buildIosKeyPopPath(keyWidth, keyHeight)` generates the SVG `<path>` `d` attribute on each press. The shape is a paddle: wider bubble on top, an S-curve neck (~11px), then a stem that matches the key width and extends down by `keyHeight` so it fully covers the pressed key. The path is **left open along the stem bottom** — SVG fills it implicitly, but no horizontal stroke is drawn there, so the outline merges into the keyboard area without a visible seam.
- **Bubble width.** For narrow letter keys the bubble is ≈1.55x the key width (the iOS flared-paddle look). For wide keys (space bar) the multiplier alone would balloon the bubble to a comically wide flag; the formula is capped at `keyWidth + 32` so the bubble stays close to the key width while still showing a small visible flare on both sides.
- The popup is colored `#ffcc00` fill with `#e6b800` stroke and a black letter — the same palette the `.kb-key.kb-flash` class applies to a pressed key. The "held yellow" effect is the popup itself; there is no separate timer.
- **Timing.** Tuned to match the native iOS feel: `KB_KEY_POP_LINGER_MS = 0` (no delay after touch up before the fade starts) and `KB_KEY_POP_FADE_MS = 60` (a short ease-out fade). The CSS transition on `.kb-key-pop` uses the same `0.06s` duration so the element is never hidden before the fade has finished painting. The enter animation (`kbKeyPopIn`) is a 20ms `scale(0.95 → 1)` + `opacity(0.7 → 1)` — fast enough to read as "instant" but with a small visible pop. The previous timings (75ms linger + 30ms fade + 40ms scale-up from 0.86) felt sluggish in side-by-side comparison with the iOS keyboard; do not lengthen them back without re-checking against the native keyboard.
- **Yellow flash on the key itself.** A short `.kb-flash` class adds a yellow background to the key on each fire (`flashKeyBtn`). `KB_FLASH_MS = 50` is the cap, but for real touch input we additionally collapse the flash to a single-frame remnant on `pointerup` (`KB_FLASH_RELEASE_MS = 16`) — the popup paddle is the primary "I pressed this" feedback, and letting the in-key yellow run its full duration after the finger had moved on left visible yellow trails behind fast-typed letters.
- The GUESS and REVEAL action keys are still excluded (they're labelled words, not single characters, and a flared paddle around them looks wrong). Space is included — its label is "SPACE", drawn at the same single-char font size as the letter popups.

### Phrase squircles

Each phrase row has an SVG with three overlapping rounded-rect ("squircle") paths. On a correct guess, the strokes animate in red → blue → green (with a fill animation for the centre overlap) via `playPhraseSolveSquircle`. If the answer was REVEALed instead of guessed, the same paths render grey. `restoreSolvedPhraseSquircles` re-runs the animation in its end state when the board reflows (e.g., on resume from autosave).

`fitBoardToViewport` calls `restoreSolvedPhraseSquircles` on every reflow **including when `phase === 'finish'`** (it short-circuits the scaling math in that case but still paints the squircles). Without that, re-entering a previously submitted round shows blank squircles instead of the colors the player actually earned. The per-row `puzzleRevealed[]` state needed for the grey-vs-coloured choice is persisted both in the in-progress autosave (`invMiddlegroundProgress`) and in the per-round submission record (`invMiddlegroundUser.submissions[sessionKey]`).

### Focus ring

`.mg-answer-strip.focused:not(.solved)` gets a `box-shadow: 0 0 0 3px #ffcc00, 0 0 0 4px rgba(230,184,0,0.55)`. That's it — no JS positioning. See "Never add a fixed overlay" above.

Because the row containers (`.mg-phrase-block`, `.mg-main-row-wrap`, `.mg-main-row`, and the connection's `.mg-main-row`) use `overflow: hidden` to keep clue text from spilling, the focus halo would normally be clipped at the row boundary and painted under adjacent clue boxes / squircle SVGs. CSS `:has()` selectors lift the focused strip's `.mg-center` to `z-index: 50` and switch its row-wrapping containers to `overflow: visible` while focused, so the halo paints above everything in the row. The clipping returns automatically the moment focus moves elsewhere.

The outermost clipper is `#puzzleMount` itself (which keeps `overflow: hidden` for layout reasons). It carries `padding: 3px 0 5px` so the focus halo on the top-most row and the bottom-most row (typically the connection / final question) doesn't get sliced off at the puzzle's edge. If you ever change this padding, verify the halo around the connection answer strip is still fully visible.

### First-game help nudge

After a brand-new player's **first incorrect guess**, the in-game "?" help button (`#btnHelp`) wiggles once and then gently pulses a yellow glow for ~4.5 s, so the player learns help is available. Implementation:

- `maybeShowHelpHintAfterWrongGuess()` (called from both wrong-guess branches in `onGuess`) reads `profile.helpHinted`. If already true, it's a no-op. Otherwise it sets the flag, adds the `inv-help-wiggle` class to `#btnHelp`, and arms a 4500 ms `stopHelpHint()` timer plus a one-shot click dismiss.
- The CSS class composes two animations: `invHelpWiggle` (a single 0.8 s rotate-wiggle for impact) plus `invHelpGlowPulse` (an infinite 1.6 s soft box-shadow pulse) until the class is removed. `prefers-reduced-motion` drops the wiggle and just keeps the pulse.
- `leaveQuizShell()` also calls `stopHelpHint()` so the animation doesn't keep running if the user pops back to the title mid-pulse.

The `helpHinted` flag is **persistent across sessions** — once a player has been shown the nudge, they'll never see it again, even on a fresh round. To re-test as a developer, clear the `invMiddlegroundUser` key from `localStorage`.

### Score delta layer

`#scoreDeltaLayer` shows the floating "+1" / "−2" animations when the score changes. `showScoreDelta(delta)` is the entrypoint.

### Connection ("final question") layout

The connection (the optional final puzzle that asks what links the phrases together) renders as a single grey rounded module — `.com-prompt` — that contains **both the question prompt and the answer strip**. Earlier versions split these into two separate rows; the combined module reads better as one self-contained piece and keeps the answer visually tied to the question it's answering. The structure inside `#comPromptBlock` is:

1. `.com-prompt-text` — the prompt question.
2. `.mg-hint-tap-msg` — the inline "tap to reveal a hint" status text.
3. `.com-hint-inline` — the revealed hints inline.
4. `.mg-main-row.mg-com-answer-row` — the answer strip (`#strip-c`).

Tapping the strip focuses it (handled in `onBoardClick` by the `.mg-answer-strip[id]` early-return branch). Tapping anywhere else inside `#comPromptBlock` triggers the hint reveal flow. Do not collapse those two branches into one; the strip needs to win on focus even though it's now physically inside the hint-tap target.

The grey box gets `padding-bottom: 8px` in quiz mode so the focused strip's yellow halo fits inside the grey box without overlapping the bottom border. If you ever change the focus halo width, recheck this padding.

### Identifying the player's own row in the leaderboard

`loadPublicLeaderboard` filters the public-answers snapshot to rows that match the current `sessionKey` (i.e. all submissions for this round) and ranks them. To highlight the player's own row and choose the right contextual blurb ("top score", "scored better than X% of players", "first to submit"), it then has to find the player's specific row inside that already-filtered list.

Earlier code did this by re-running `scoreMatchesSessionKey()` over the filtered list, which trivially returned `true` for every row — so the loop always picked index 0 and reported "you have the top score" regardless of where the player actually placed.

`findOurLeaderboardRowIndex(rows, name, points, elapsedMs)` is the fix:

1. **Match by Firebase push id** — `submitFinalScore` saves `newRef.key` as `lastSavedScoreId` (and we mirror it onto each row as `__id` when reading). Exact, robust, no false positives. The id is also persisted in the local submission record (`scoreId` field) so it survives page reloads.
2. **Fallback: match by `(displayName, points, elapsedMs)`** for legacy submissions written before `scoreId` was tracked. If multiple rows match (extremely unlikely — same name, exact same point total, exact same millisecond duration), we take the most recent by `timestamp`.

The leaderboard blurb logic is now: 1 row → "you're the first to submit", `ourRank === 0` → "top score", otherwise "scored better than X% of *the other* players" with denominator `rows.length - 1`.

### Archive completion states (`getRoundPlayStatus`)

The archive list shows three play states per round:

| Status | When it applies | Label |
|---|---|---|
| `submitted` | A leaderboard submission exists for the round (local `invMiddlegroundUser.submissions[sessionKey]` has `submitted: true`) | rank · points · time |
| `completed` | The puzzle's autosave is in `phase: 'finish'` (or every phrase + connection is solved) but no leaderboard submission was made — the player closed the page before clicking Save score | "Completed — tap to submit" (amber) |
| `in_progress` | Autosaved progress exists but the puzzle isn't fully solved | "In progress" (red) |
| `not_played` | No autosave and no submission | "Not played" (grey) |

Without the explicit `completed` state, players who finished the puzzle but didn't submit saw their round listed as "In progress" forever, which read as a bug. `progressIsCompleted()` is the source of truth: a saved progress is "completed" if the saved `phase` is `'finish'`, OR every entry in `puzzleSolved[]` is true AND the connection (if present) is solved or revealed.

### Share / emoji grid (`buildEmojiGrid`)

The "share my score" copy-to-clipboard text uses an emoji grid that summarises the round, one row per phrase plus the connection. The format is intentionally compact (no spaces, one emoji per line for the phrases; a single number emoji for the connection):

| Question | Emoji rule |
|---|---|
| Phrase row — solved without using any manual hints | 🟩 |
| Phrase row — solved but used at least one manual hint | 🟨 |
| Phrase row — answer was REVEALed | 🟥 |
| Connection — number of bonus points the player earned on the connection guess (the "early bird" bonus) | digit emoji, e.g. `3️⃣`. **No coloured square.** |

The connection row deliberately has **no coloured square** even though the same red/yellow/green rule could be applied — only the bonus number is shown. If the round has no connection, the connection row is omitted entirely. The bonus is `sessionThemeBonusPoints` (defaults to 0 if the connection was REVEALed).

The per-row colour relies on `manualHintRevealedLeft[i]` / `manualHintRevealedRight[i]` / `manualComHintsRevealed` being incremented **once per player-confirmed hint reveal** (the second tap on a clue box). Free hints that auto-reveal on a correct phrase guess do not count. If these counters drift from the actual hint usage, the grid is wrong — keep them in sync with `revealedLeftArr[i]` / `revealedRightArr[i]` increments.

#### Share round number

The share text includes a per-round number — `"InVennTions #N"` — where N is the round's 1-based position among non-hidden, released rounds when sorted by `playDate` **ascending** (oldest = #1). Computed by `getRoundShareNumber(roundId)` from the cached `fetchArchiveRaw()` data so the number is consistent with what's in Firebase, not whatever happens to be in the in-memory `archiveCatalog`. If the lookup fails (network error, round not in archive), it falls back to the truncated round ID (the legacy format).

Note: this number can shift if older rounds are added retroactively. That should be rare in practice (admins normally add rounds for the future, not the past), but if it happens, screenshots of previously shared scores will have stale numbers. We accept that trade-off because using a stable Firebase push ID was unreadable for players.

---

## URL redirects

Listed for completeness — old paths still resolve:

| Old | New |
|---|---|
| `/games/middleground/` | `/games/invenntions/` |
| `/games/middleground/admin/` | `/games/invenntionsadmin/` |

The redirect HTML lives in `games/middleground/index.html` and `games/middleground/admin/index.html` (meta-refresh + `location.replace`). Do not delete those files until you are sure no external link or bookmark still points at them.

---

## When changing this game

A short checklist:

1. Identify which area you're touching using the "Map of `games/invenntions/index.html`" table above.
2. Make the change; verify in a browser (incognito for player; signed in as admin for admin-only paths).
3. If you changed scoring, payload, storage keys, or the RTDB schema, update both this README and the top-level repo README.
4. If you added or removed `localStorage` keys, also update `sanitizeStoredPlayerData` so corrupted/legacy data is cleaned at boot.
5. Commit and push from the repo root. The site auto-deploys via the project's standard hosting flow.
