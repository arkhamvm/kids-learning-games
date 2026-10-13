# kids-learning-games

Collection of small browser learning games for Russian primary-school kids (1–4 класс).
Each game is one self-contained HTML file, published on GitHub Pages:
https://arkhamvm.github.io/kids-learning-games/

**Reference games** — the user liked them a lot: for any new game copy their structure, look and
behaviour; change only the content and, if needed, the mechanic.
- `games/sinonimy/index.html` — «Слова-друзья», synonym quiz (2 класс): the basic quiz skeleton.
- `games/alphabet/index.html` — «Английский алфавит» (2 класс): a learn screen (cards + grid) before
  the quiz, several question types, pronunciation (device voice + embedded clips), Russian transcription.
- `games/ustnyj-schet/index.html` — «Устный счёт» (2–3 класс): two modes on the start screen, generated
  questions (no fixed bank), typed answers on an on-screen keypad, step-by-step hints after mistakes,
  a reference table with «Скрыть ответы».

**Mascot template:** `templates/mascot.html` — котёнок Рыжик. Every game uses it unchanged (see below).

## Repo layout

```
games/<slug>/index.html     one game, fully self-contained
templates/mascot.html       the mascot: preview page + the only source of the MASCOT:CSS / :SVG / :JS blocks
scripts/mascot.py           sync | check — copy mascot blocks into pages / verify nothing drifted
scripts/touch-test.mjs      plays a round with real touch taps on 2 phones + desktop: sound, fit, navigation
scripts/alphabet_audio.py   regenerates the alphabet's embedded pronunciation clips (espeak-ng → MP3 → base64)
index.html                  gallery — add a card for every new game (also uses the mascot)
README.md                   list of games — add a row for every new game
.claude/launch.json         static server "site" on :8765 for the browser pane
.nojekyll                   GitHub Pages serves files as-is
```

`<slug>` — lowercase Latin transliteration of the topic: `sinonimy`, `antonimy`, `slogi`, `tablitsa-umnozheniya`.

## Hard requirements

- **One HTML file**: inline `<style>`, inline `<script>`, images as inline SVG. No build step, no npm,
  no external JS, no image/audio files. The only external resource allowed is the Google Fonts `Nunito`
  `<link>` with a system-font fallback — the game must still work offline. Emoji are fine as
  pictures for words (🍎 🐱 🦒): they are text, render everywhere, cost nothing.
- **Favicon** = the mascot's face (data-URI SVG, copy the `<link rel="icon">` from `templates/mascot.html`).
- **Russian UI**, child-friendly and short. Address the child in gender-neutral forms
  («твой ответ», «Молодец!», «Умница!»), never «ты выбрал/выбрала».
- **Content matches the requested grade.** Word/fact banks are hand-written inside the file (no API).
  Review every item: each distractor must be unambiguously wrong (no accidental synonyms / second correct
  answers). Aim for 60–80 items, 10 per round, next round prefers items not seen yet. Arithmetic is
  generated at runtime instead — then wrong options model typical slips (±10 lost carry, ±1, swapped
  digits, wrong sign, neighbouring products), and you must validate the generator by playing a few
  hundred questions in the browser and recomputing every answer from the text on screen.
- **Typed answers** (when a task asks the child to write the answer): an on-screen keypad, never the
  system keyboard (it would cover half the screen and break the fit). Two rows `1 2 3 4 5 ⌫ / 6 7 8 9 0 ✓`
  — no taller than the 4 answer options; keys `tabIndex = -1` + `mousedown` preventDefault so Enter on a
  physical keyboard always submits; digits / Backspace / Enter work too. The answer appears in a box
  inside the expression (`#answerBox`, dashed + blinking while typing, green or red struck-through after).
- **Every screen fits the screen height — no scrolling in the quiz.** `fit()` scales the whole page with
  CSS `zoom` = available height / natural height of the active screen (`--k` on `<html>`;
  `.app, .sheet { zoom: var(--k) }`, `.app { min-height: calc(100dvh / var(--k)) }`). Per-screen limits
  `FIT = { start: [0.7, 1.4], learn: [0.7, 1.3], quiz: [0.6, 1.4], end: [0.8, 1.3] }`, also capped by
  `innerWidth / 360` so phones don't get narrower than 360 CSS px. Short phones shrink, tablets and
  desktops grow (up to ×1.4). The quiz reserves the feedback sheet's height as bottom padding, so the
  sheet never covers answers. `fit(true)` locks the zoom for the current visit of a screen (`lockedK`):
  later content changes may only shrink it — no size jumps between questions or letters. Call `fit()` on
  every screen change, `fit(true)` after rendering a question / whenever a learn screen's content
  changes, `fit()` after filling results, on `resize` (clears the locks) and on `document.fonts.ready`;
  `delete lockedK.quiz` when a round starts. Keep rows whose text varies (speech bubble next to a small
  mascot) at a fixed `min-height`. Copy `fit()` from a reference game.
  The results screen may scroll (the review list), nothing else should.
- **Phones first — kids play by tapping**, not with a mouse:
  - works at 360–390 px, 16 px side gutter, no horizontal scroll; answers 2×2 (also on phones —
    long words wrap with `hyphens: auto`; key badges 1–4 hidden under `@media (pointer: coarse)`);
  - `html, button { touch-action: manipulation; }` — no double-tap zoom on fast taps;
  - every `:hover` rule inside `@media (hover: hover)` — on touch screens hover sticks after a tap;
  - after an answer the right option is scrolled above the feedback sheet
    (`scroll-margin-bottom` + `scrollIntoView({ block: 'nearest' })`);
  - all actions are plain `click` handlers on buttons (taps produce clicks); no hover-only UI.
- **Keyboard** too: `1`–`4` choose an answer; `Enter`/`Space` = start / next / play again. The global
  handler must skip when a `<button>` has focus — the native click already fires (otherwise double-advance).
- **Speech / pronunciation** (when a game needs words spoken): prefer the device voice via
  `speechSynthesis` for the right locale (e.g. `en-GB` — Russian schools teach British English), fall back
  to clips embedded as base64 MP3 and played through `Mascot.audio()` (the shared, tap-unlocked
  `AudioContext` — works on iOS without per-play gestures). Fall back to clips also on `utterance.onerror`
  (network voices offline). Generate clips with a script like `scripts/alphabet_audio.py` (libespeak-ng via
  ctypes is installed here; there is no espeak CLI). Explicit 🔊 taps always play; automatic playback
  only when `Mascot.sound` is on.
- `prefers-reduced-motion` respected. `localStorage` only for per-viewer prefs, always in `try/catch`.
- No tracking, no network calls, no data collection.

## Standard skeleton (the touch test relies on these ids)

Screens `#screenStart`, `#screenQuiz`, `#screenEnd` with `body[data-screen=start|quiz|end]`;
per-screen mascot slot + speech bubble; `#btnStart`, `#options .opt` (answer buttons, `.correct` /
`.wrong` / `.dim`), `#sheet.show` + `#btnNext`, `#statScore` (`"7/10"`), `#btnAgain`, `#btnQuit`
(with `confirm()`), `#btnSound` (`aria-pressed`), `#progress`, `#streakNum`, `#mascot`.
The sheet sits inside `.sheet-dock` (fixed, `overflow: hidden`, `pointer-events: none`).
Optional learn screen: `#btnLearn` on the start screen → `#screenLearn` (`body[data-screen=learn]`) with
`.tile` buttons and `#btnBack`; the touch test exercises it when present (and requires a sound on tile tap
when `<body data-learn-sound>` is set). Optional typed answers: `#keypad [data-key]` (digits, `del`, `ok`)
+ `#answerBox` with `.correct` / `.wrong`; the touch test types on the keypad when it is visible.
Feedback sheet text: `#sheetTitle`, `#sheetSub`, optional `#sheetHint` (how to solve it, after mistakes);
the text column is `flex: 1; min-width: 0` so long hints wrap instead of pushing «Дальше» off screen.

## Look & feel (Duolingo-like)

Tokens in `:root` (reuse as-is):
green `#58cc02`/`#46a302`/light `#d7ffb8`/text `#58a700`, red `#ff4b4b`/`#ea2b2b`/light `#ffdfe0`,
blue `#1cb0f6`/`#1899d6`, purple `#ce82ff`, orange `#ff9600`, gold `#ffc800`, ink `#3c3c3c`,
line `#e5e5e5`. Font Nunito 700–900.

- **3D buttons**: solid fill + `box-shadow: 0 4px 0 <darker>`; `:active` → `translateY(4px)`, shadow 0.
- **Answer cards**: white, 2 px border `#e5e5e5`, 5 px bottom border, radius 16 px, key badge 1–4.
  States: `.correct` (light green + pop), `.wrong` (light red + shake), `.dim` (opacity .4) for the rest.
- **Top bar** (quiz only): ✕ quit, green progress bar with glossy stripe, streak flame counter
  (bumps, glows at ≥3), sound toggle (always visible).
- **Feedback sheet** slides up from the bottom: green title from `Mascot.correct()` or red
  «Правильный ответ:», then the correct pair, button «Дальше» (last question: «Итоги»), red on wrong answers.
- **Feedback sheet on phones** (< 460 px): one compact row — 40 px icon, 18/15 px text, small button.
- **Screens**: start (mascot greets, rule explained with one example, «Начать») → quiz → results.
  Screens slide in from above (`translateY(-8px)`), never from below (that would add scroll height).
- **Results**: title + stars from `Mascot.finish()`, stat cards Верно / Серия / Точность,
  list «Запомни …» with the correct answer and the child's crossed-out answer, «Играть ещё».

## Mascot — котёнок Рыжик (mandatory template for every mini-game)

Original character in Duolingo style: ginger kitten with green eyes, white muzzle, whiskers, a tail
and a graduation cap. (It replaced the first mascot, совёнок Ух, at the user's request.) Never copy
Duolingo's Duo or any other brand character. Open `templates/mascot.html` to see every reaction.

Behaviour — identical in all games, do not change per game:

| moment | mascot | API call |
|---|---|---|
| start screen | waves a paw, greets | `Mascot.hello(text?)` |
| question on screen | looks up, head tilted, one ear turned — thinking | `Mascot.question(isFirst)` |
| correct answer | hops, throws paws out, `^ ^` happy eyes, blushes, ears perk, tail wags; confetti pops from the answer button; sound | `Mascot.correct(streak, buttonEl)` → sheet title |
| wrong answer | shakes head, ears flatten, droopy eyelids, frowns, a tear falls, tail droops; sound | `Mascot.wrong()` |
| result ≥ 70 % | dances, tosses the cap, tail wags, confetti rain; fanfare | `Mascot.finish(score, total)` → `{ stars, title }` |
| result 40–69 % / < 40 % | happy / waves and encourages | (same call) |
| every reaction | new phrase in the speech bubble each time; special lines for 3, 5, 7, 10 in a row | `Mascot.phrases` |
| always | eyes follow the mouse or finger; click/tap on the kitten → «мяу» + funny phrase | built in |

Stars: ≥ 90 % → 3★, ≥ 70 % → 2★, ≥ 40 % → 1★. Sound on/off is stored in `localStorage['mascot-sound']`
and is shared by all games (`Mascot.sound`, `Mascot.sfx('ok'|'bad'|'meow'|'win'|'end')`).

How to use it in a game:
1. Put empty marker pairs into the page and run `python3 scripts/mascot.py sync`:
   `/* ===== MASCOT:CSS START ===== */ … END` inside `<style>`,
   `<!-- ===== MASCOT:SVG START ===== --> … END` inside the start screen's mascot slot,
   `// ===== MASCOT:JS START ===== … END` at the top of `<script>` (before the game code).
2. Give every screen a slot and a bubble (`.bubble.bubble--down` above the mascot or `.bubble--left`
   to the right of it); on screen change call `Mascot.mount(slot, bubble)`.
3. Theme the phrases only through `Object.assign(Mascot.phrases, { hello, first, ask, poke, results })`.
4. Never edit the mascot inside a game. To change it (or swap the character): edit
   `templates/mascot.html`, run `python3 scripts/mascot.py sync`, re-test all games, and update
   the character name in the games' static greeting text. `check` must pass before every commit.

SVG techniques used by the template (useful if it ever needs changes):
- `.mascot * { transform-box: fill-box; }` + per-part `transform-origin` (paws at the shoulder,
  ears at their base, tail at its root, body at the feet).
- Nested groups when two things move the same part: `m-body` (CSS bob/hop) › `m-tilt` (think/poke);
  `m-track` (JS pointer-follow via the `transform` **attribute**) › `m-mood` (CSS state offset).
- Blink = eyelid `<rect>` clipped by the eye `clipPath`, `scaleY(0→1)` from the top; sad = `rotate(±14deg) scaleY(.42)`.
- Paws hang from under the head: keep paw rotations within ±75° (wave −75…−108°) or they cover the face.
- Outer `<svg>` needs `overflow: visible` so hops and the cap toss aren't clipped.
- Keyframes are prefixed `mascot-` so they never clash with the game's own.
- Check poses statically before shipping: render each `is-*` state (and paw angles) side by side in headless Chrome.

## Known pitfalls (all hit while building `sinonimy`)

- Entry animation with `animation-fill-mode: both` pins the final keyframe's `opacity`, so `.dim`
  stops working. Use `backwards`.
- Restarting a CSS animation: remove class → force reflow → add class. On SVG elements use
  `getBoundingClientRect()` — `offsetWidth` is undefined there.
- Several animations on the same property: the later one wins (happy = `mascot-hop … 2, mascot-bob … 1.1s infinite`).
- The hidden feedback sheet needs `visibility: hidden` (delayed via transition) so its button can't be tabbed to.
- iOS Safari shows `:active` only if a `touchstart` listener exists — the template adds one.
- `zoom` + a fixed sheet parked below the screen makes Chrome count it in the page height → keep the sheet
  inside the clipping `.sheet-dock`.
- `fit()` measures the active screen with `.measuring { flex: none }` at `--k: 1`; don't lock the quiz zoom
  from `show()` — the previous round's question is still in the DOM then.
- The browser pane tab is often in the background (`document.visibilityState === 'hidden'`): CSS
  animations and rAF freeze there (screens stuck at the first keyframe, confetti frozen), so measurements
  and screenshots can mislead. Trust `scripts/touch-test.mjs` (headless Chrome renders normally).
- The browser pane serves files only via the session's start folder: if the session began elsewhere, put a
  `.claude/launch.json` there with `python3 -m http.server 8765 --directory <repo>`.
- `gh` is a snap and can't read `/media/...`: run `gh` commands from `~` (`cd ~ && gh …`) and push with plain `git`.
- `sed -i` fails on this NTFS drive («Операция не позволена» while preserving permissions) — edit files with Python or the Edit tool.
- Build DOM from content with `textContent`, not `innerHTML`.
- The browser pane can't open `file://`, and in mobile mode it still sends mouse clicks — real taps
  are tested with `scripts/touch-test.mjs`.

## Workflow for a new game

1. Ask only if the mechanic or grade is unclear; otherwise choose sensible defaults.
2. Copy `games/sinonimy/index.html` → `games/<slug>/index.html`; replace title, rule explanation,
   content bank, category tags, mascot phrases; adapt the mechanic. Keep the skeleton ids.
3. Re-read the content bank item by item for ambiguous answers.
4. Checks — all must pass:
   ```bash
   python3 scripts/mascot.py check
   node scripts/touch-test.mjs games/<slug>/
   ```
   The touch test covers 390×844, 360×640 and 1280×900: taps, sound on every answer, quiz fits the
   height, mascot reactions, results, navigation, the learn screen if any.
   Then look at it: browser pane `preview_start` → `site` → `http://localhost:8765/games/<slug>/`
   (right and wrong answers, a perfect round, 375 px width, zero console errors).
5. Add a card to `index.html` and a row to `README.md`.
6. Commit (Conventional Commits) and push to `main` — Pages redeploys in ~1 min. Check
   `https://arkhamvm.github.io/kids-learning-games/games/<slug>/`.

## Git

- Repo lives on an NTFS drive (every file shows as 0777): `core.fileMode false` is set — never commit mode changes.
- Default branch `main`; GitHub Pages source: `main` / root. Remote via SSH (`git@github.com:arkhamvm/kids-learning-games.git`).
