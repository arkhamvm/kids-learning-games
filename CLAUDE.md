# kids-learning-games

Collection of small browser learning games for Russian primary-school kids (1–4 класс).
Each game is one self-contained HTML file, published on GitHub Pages:
https://arkhamvm.github.io/kids-learning-games/

**Reference game:** `games/sinonimy/index.html` — «Слова-друзья», synonym quiz (2 класс).
The user liked it a lot: for any new game copy its structure, look and behaviour; change only the
content and, if needed, the mechanic.

**Mascot template:** `templates/owl-mascot.html` — совёнок Ух. Every game uses it unchanged (see below).

## Repo layout

```
games/<slug>/index.html     one game, fully self-contained
templates/owl-mascot.html   the owl: preview page + the only source of the OWL:CSS / OWL:SVG / OWL:JS blocks
scripts/mascot.py           sync | check — copy owl blocks into pages / verify nothing drifted
scripts/touch-test.mjs      plays a round with real touch taps on 2 phone sizes (headless Chrome)
index.html                  gallery — add a card for every new game (also uses the owl)
README.md                   list of games — add a row for every new game
.claude/launch.json         static server "site" on :8765 for the browser pane
.nojekyll                   GitHub Pages serves files as-is
```

`<slug>` — lowercase Latin transliteration of the topic: `sinonimy`, `antonimy`, `slogi`, `tablitsa-umnozheniya`.

## Hard requirements

- **One HTML file**: inline `<style>`, inline `<script>`, images as inline SVG. No build step, no npm,
  no external JS, no image files. The only external resource allowed is the Google Fonts `Nunito`
  `<link>` with a system-font fallback — the game must still work offline.
- **Russian UI**, child-friendly and short. Address the child in gender-neutral forms
  («твой ответ», «Молодец!», «Умница!»), never «ты выбрал/выбрала».
- **Content matches the requested grade.** Content bank is hand-written inside the file
  (no API, no generation at runtime). Review every item: each distractor must be unambiguously wrong
  (no accidental synonyms / second correct answers). Aim for 60–80 items, 10 per round, next round
  prefers items not seen yet.
- **Phones first — kids play by tapping**, not with a mouse:
  - works at 360–390 px, 16 px side gutter, no horizontal scroll; answers 2×2, one column below 460 px;
  - `html, button { touch-action: manipulation; }` — no double-tap zoom on fast taps;
  - every `:hover` rule inside `@media (hover: hover)` — on touch screens hover sticks after a tap;
  - after an answer the right option is scrolled above the feedback sheet
    (`scroll-margin-bottom` + `scrollIntoView({ block: 'nearest' })`);
  - all actions are plain `click` handlers on buttons (taps produce clicks); no hover-only UI.
- **Keyboard** too: `1`–`4` choose an answer; `Enter`/`Space` = start / next / play again. The global
  handler must skip when a `<button>` has focus — the native click already fires (otherwise double-advance).
- `prefers-reduced-motion` respected. `localStorage` only for per-viewer prefs, always in `try/catch`.
- No tracking, no network calls, no data collection.

## Standard skeleton (the touch test relies on these ids)

Screens `#screenStart`, `#screenQuiz`, `#screenEnd` with `body[data-screen=start|quiz|end]`;
per-screen owl slot + speech bubble; `#btnStart`, `#options .opt` (answer buttons, `.correct` /
`.wrong` / `.dim`), `#sheet.show` + `#btnNext`, `#statScore` (`"7/10"`), `#btnAgain`, `#btnQuit`
(with `confirm()`), `#btnSound` (`aria-pressed`), `#progress`, `#streakNum`, `#owl`.

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
- **Screens**: start (owl greets, rule explained with one example, «Начать») → quiz → results.
- **Results**: title + stars from `Mascot.finish()`, stat cards Верно / Серия / Точность,
  list «Запомни …» with the correct answer and the child's crossed-out answer, «Играть ещё».

## Mascot — совёнок Ух (mandatory template for every mini-game)

Original character in Duolingo style: green owl, lighter face disc, graduation cap. Never copy
Duolingo's Duo or any other brand character. Open `templates/owl-mascot.html` to see every reaction.

Behaviour — identical in all games, do not change per game:

| moment | owl | API call |
|---|---|---|
| start screen | waves, greets | `Mascot.hello(text?)` |
| question on screen | looks up, head tilted, thinking | `Mascot.question(isFirst)` |
| correct answer | hops, flaps wings, `^ ^` happy eyes, blushes; confetti pops from the answer button; sound | `Mascot.correct(streak, buttonEl)` → sheet title |
| wrong answer | shakes head, droopy eyelids, frowns, a tear falls; sound | `Mascot.wrong()` |
| result ≥ 70 % | dances, tosses the cap, confetti rain; fanfare | `Mascot.finish(score, total)` → `{ stars, title }` |
| result 40–69 % / < 40 % | happy / waves and encourages | (same call) |
| every reaction | new phrase in the speech bubble each time; special lines for 3, 5, 7, 10 in a row | `Mascot.phrases` |
| always | eyes follow the mouse or finger; click/tap on the owl → «ух-ух» + funny phrase | built in |

Stars: ≥ 90 % → 3★, ≥ 70 % → 2★, ≥ 40 % → 1★. Sound on/off is stored in `localStorage['owl-sound']`
and is shared by all games (`Mascot.sound`, `Mascot.sfx('ok'|'bad'|'hoot'|'win'|'end')`).

How to use it in a game:
1. Put empty marker pairs into the page and run `python3 scripts/mascot.py sync`:
   `/* ===== OWL:CSS START ===== */ … END` inside `<style>`,
   `<!-- ===== OWL:SVG START ===== --> … END` inside the start screen's owl slot,
   `// ===== OWL:JS START ===== … END` at the top of `<script>` (before the game code).
2. Give every screen a slot and a bubble (`.bubble.bubble--down` above the owl or `.bubble--left`
   to the right of it); on screen change call `Mascot.mount(slot, bubble)`.
3. Theme the phrases only through `Object.assign(Mascot.phrases, { hello, first, ask, poke, results })`.
4. Never edit the owl inside a game. To change the owl: edit `templates/owl-mascot.html`, run
   `python3 scripts/mascot.py sync`, re-test all games. `check` must pass before every commit.

SVG techniques used by the template (useful if it ever needs changes):
- `.owl * { transform-box: fill-box; }` + per-part `transform-origin` (wings at the shoulder, body at the feet).
- Nested groups when two things move the same part: `o-body` (CSS bob/hop) › `o-tilt` (think/poke);
  `o-track` (JS pointer-follow via the `transform` **attribute**) › `o-mood` (CSS state offset).
- Blink = eyelid `<rect>` clipped by the eye `clipPath`, `scaleY(0→1)` from the top; sad = `rotate(±14deg) scaleY(.42)`.
- Outer `<svg>` needs `overflow: visible` so hops and the cap toss aren't clipped.
- Keyframes are prefixed `owl-` so they never clash with the game's own.

## Known pitfalls (all hit while building `sinonimy`)

- Entry animation with `animation-fill-mode: both` pins the final keyframe's `opacity`, so `.dim`
  stops working. Use `backwards`.
- Restarting a CSS animation: remove class → force reflow → add class. On SVG elements use
  `getBoundingClientRect()` — `offsetWidth` is undefined there.
- Several animations on the same property: the later one wins (happy = `owl-hop … 2, owl-bob … 1.1s infinite`).
- The hidden feedback sheet needs `visibility: hidden` (delayed via transition) so its button can't be tabbed to.
- iOS Safari shows `:active` only if a `touchstart` listener exists — the template adds one.
- Build DOM from content with `textContent`, not `innerHTML`.
- The browser pane can't open `file://`, and in mobile mode it still sends mouse clicks — real taps
  are tested with `scripts/touch-test.mjs`.

## Workflow for a new game

1. Ask only if the mechanic or grade is unclear; otherwise choose sensible defaults.
2. Copy `games/sinonimy/index.html` → `games/<slug>/index.html`; replace title, rule explanation,
   content bank, category tags, owl phrases; adapt the mechanic. Keep the skeleton ids.
3. Re-read the content bank item by item for ambiguous answers.
4. Checks — all must pass:
   ```bash
   python3 scripts/mascot.py check
   node scripts/touch-test.mjs games/<slug>/
   ```
   Then look at it: browser pane `preview_start` → `site` → `http://localhost:8765/games/<slug>/`
   (right and wrong answers, a perfect round, 375 px width, zero console errors).
5. Add a card to `index.html` and a row to `README.md`.
6. Commit (Conventional Commits) and push to `main` — Pages redeploys in ~1 min. Check
   `https://arkhamvm.github.io/kids-learning-games/games/<slug>/`.

## Git

- Repo lives on an NTFS drive (every file shows as 0777): `core.fileMode false` is set — never commit mode changes.
- Default branch `main`; GitHub Pages source: `main` / root. Remote via SSH (`git@github.com:arkhamvm/kids-learning-games.git`).
