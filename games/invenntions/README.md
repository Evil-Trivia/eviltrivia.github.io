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
| Constants | `GAME_ID = 'middleground'`, keyboard key arrays (`KB_TOP/MID/BOT`), storage keys (`INV_USER_STORAGE_KEY`, `INV_PROGRESS_STORAGE_KEY`, `INV_SUBMIT_STORAGE_KEY`, `INV_RECOVERY_KEY`), timing constants (`KB_FLASH_MS`, `KB_KEY_POP_LINGER_MS`, `KB_KEY_POP_FADE_MS`, etc.), and the default HTML for the help/info/about modals (`DEFAULT_PLAYER_HELP_HTML`, `DEFAULT_INFO_HTML`, `DEFAULT_ABOUT_HTML`). |
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

InVennTions writes three things to `localStorage` and one record to Firebase per finished session.

### localStorage keys

| Key | Shape | Purpose |
|---|---|---|
| `invMiddlegroundUser` | `{ displayName?, visited?, helpHinted?, submissions?, progressByRound?, ... }` | Per-user profile cache. `visited` is set true after the user opens the title screen for the first time (used to skip the first-visit wiggle on the title's "What am I doing here?" button). `helpHinted` is set true the first time the in-game "?" help button is wiggled after a wrong guess (one-shot, see "First-game help nudge" below). `submissions` and `progressByRound` are per-round dictionaries. |
| `invMiddlegroundProgress` | `{ sessionKey, puzzleBuffers[], puzzleSolved[], revealedLeftArr[], revealedRightArr[], commonalityBuffer, commonalitySolved, revealedComHints, scoreBreakdown, elapsedMs, ... }` | In-progress autosave. Restored by `tryRestoreRoundSession` when the user re-opens the same round. Autosaved every `PROGRESS_AUTOSAVE_MS` (12s). |
| `invMiddlegroundScoreSubmitted` | `{ [sessionKey]: { displayName, rank, ... } }` | Records that this session was already submitted, so the finish modal becomes view-only on reload. |
| `invMiddlegroundAutoRecovery` | timestamp | One-shot recovery guard. `prefetchQuizWithRecovery` clears storage exactly once if Firebase data fails to load, to unblock stuck mobile sessions. |

Admins (`window.invIsAdmin === true`) get their submission and progress records cleared on sign-in so they can play the same round repeatedly for testing.

### Score submission

When the puzzle is complete, the finish screen writes one record to BOTH paths atomically:

- `games/middleground/answers/{pushId}` — internal score store
- `publicAnswers/middleground/{pushId}` — mirror, used by the public leaderboard reads

The payload includes `displayName`, `points`, `elapsedMs`, `sessionKey` (e.g. `round:{roundId}`), `roundId`, `roundIds`, hint/reveal counts, and `formatVersion: 5`. One submission per session is enforced client-side via `invMiddlegroundScoreSubmitted`.

### Deep links

Open a specific archive round with `?round=<firebaseRoundId>`:

`https://eviltrivia.github.io/games/invenntions/?round=-NxAbCdEf`

`getDeepLinkRoundId()` parses the URL; `playArchiveRoundIds` is the entrypoint for loading a specific round.

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
6. **Legacy migration.** On the first admin Refresh, if `archive/` is empty but `library/{gameId}/` has data, the admin copies the rounds into `archive/` and marks the old "active library game" as Live. This is implemented in `migrateLegacyIfNeeded`.

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

### iOS-style keyboard popup

When the player taps any letter (or backspace) on the on-screen keyboard, a yellow paddle pops out of the key. Implementation:

- The popup HTML is `<div id="kbKeyPop"><svg><path/><text/></svg></div>`, a single fixed-positioned container above the keyboard.
- `buildIosKeyPopPath(keyWidth, keyHeight)` generates the SVG `<path>` `d` attribute on each press. The shape is a paddle: wider bubble on top (≈1.55x key width), an S-curve neck (~11px), then a stem that matches the key width and extends down by `keyHeight` so it fully covers the pressed key. The path is **left open along the stem bottom** — SVG fills it implicitly, but no horizontal stroke is drawn there, so the outline merges into the keyboard area without a visible seam.
- The popup is colored `#ffcc00` fill with `#e6b800` stroke and a black letter — the same palette the `.kb-key.kb-flash` class applies to a pressed key. The "held yellow" effect is the popup itself; there is no separate timer. The popup lingers `KB_KEY_POP_LINGER_MS` (75ms) after release, then fades over `KB_KEY_POP_FADE_MS` (30ms).
- The space key is excluded from the popup (its "SPACE" label doesn't fit the paddle shape).

### Phrase squircles

Each phrase row has an SVG with three overlapping rounded-rect ("squircle") paths. On a correct guess, the strokes animate in red → blue → green (with a fill animation for the centre overlap) via `playPhraseSolveSquircle`. If the answer was REVEALed instead of guessed, the same paths render grey. `restoreSolvedPhraseSquircles` re-runs the animation in its end state when the board reflows (e.g., on resume from autosave).

### Focus ring

`.mg-answer-strip.focused:not(.solved)` gets a `box-shadow: 0 0 0 3px #ffcc00, 0 0 0 4px rgba(230,184,0,0.55)`. That's it — no JS positioning. See "Never add a fixed overlay" above.

Because the row containers (`.mg-phrase-block`, `.mg-main-row-wrap`, `.mg-main-row`, and the connection's `.mg-main-row`) use `overflow: hidden` to keep clue text from spilling, the focus halo would normally be clipped at the row boundary and painted under adjacent clue boxes / squircle SVGs. CSS `:has()` selectors lift the focused strip's `.mg-center` to `z-index: 50` and switch its row-wrapping containers to `overflow: visible` while focused, so the halo paints above everything in the row. The clipping returns automatically the moment focus moves elsewhere.

### First-game help nudge

After a brand-new player's **first incorrect guess**, the in-game "?" help button (`#btnHelp`) wiggles once and then gently pulses a yellow glow for ~4.5 s, so the player learns help is available. Implementation:

- `maybeShowHelpHintAfterWrongGuess()` (called from both wrong-guess branches in `onGuess`) reads `profile.helpHinted`. If already true, it's a no-op. Otherwise it sets the flag, adds the `inv-help-wiggle` class to `#btnHelp`, and arms a 4500 ms `stopHelpHint()` timer plus a one-shot click dismiss.
- The CSS class composes two animations: `invHelpWiggle` (a single 0.8 s rotate-wiggle for impact) plus `invHelpGlowPulse` (an infinite 1.6 s soft box-shadow pulse) until the class is removed. `prefers-reduced-motion` drops the wiggle and just keeps the pulse.
- `leaveQuizShell()` also calls `stopHelpHint()` so the animation doesn't keep running if the user pops back to the title mid-pulse.

The `helpHinted` flag is **persistent across sessions** — once a player has been shown the nudge, they'll never see it again, even on a fresh round. To re-test as a developer, clear the `invMiddlegroundUser` key from `localStorage`.

### Score delta layer

`#scoreDeltaLayer` shows the floating "+1" / "−2" animations when the score changes. `showScoreDelta(delta)` is the entrypoint.

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
