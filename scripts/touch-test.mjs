#!/usr/bin/env node
// Plays one round of a game with real touch taps (headless Chrome + CDP Input.dispatchTouchEvent)
// on two phone sizes and a desktop window. Checks the mascot reactions, the feedback sheet, that
// taps produce sound, that the quiz fits the screen height (no vertical scroll), results and
// navigation, and — if the game has one (#btnLearn) — the learning screen.
//
//   node scripts/touch-test.mjs games/sinonimy/
//
// Needs Node >= 22 and google-chrome (or set CHROME=/path/to/chrome). Works for any game built on
// the standard skeleton: #btnStart, #options .opt, #sheet, #btnNext, #statScore, #btnAgain,
// #btnQuit, #btnSound, #mascot, body[data-screen=start|quiz|end]; optional #btnLearn → learn screen
// with .tile buttons and #btnBack; optional typed answers: #keypad [data-key] (digits, "ok") + #answerBox
// (.correct / .wrong after submit). Learn tiles must play a sound only if <body data-learn-sound>.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = (process.argv[2] || 'games/sinonimy/').replace(/^\/+/, '');
const SIZES = [[390, 844], [360, 640], [1280, 900]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${srv.address().port}/${PAGE}`;

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'touch-test-'));
const chrome = spawn(process.env.CHROME || 'google-chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const browserWs = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  setTimeout(() => reject(new Error('chrome did not start: ' + buf)), 20000);
});
const targets = await (await fetch(`http://127.0.0.1:${new URL(browserWs).port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let msgId = 0;
const pending = new Map();
let errors = [];
let dialogs = [];
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++msgId;
  pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params }));
});
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  } else if (msg.method === 'Page.javascriptDialogOpening') {
    dialogs.push(msg.params.message);
    send('Page.handleJavaScriptDialog', { accept: true });
  }
};
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
async function tapSel(sel) {
  const c = await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await sleep(60);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
  await sleep(70);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const screen = () => ev('document.body.dataset.screen');
const snd = () => ev('({ ...__snd })');
const fits = () => ev(`({ ok: document.documentElement.scrollHeight <= innerHeight + 2,
  sh: document.documentElement.scrollHeight, ih: innerHeight,
  k: getComputedStyle(document.documentElement).getPropertyValue('--k') || '1' })`);
const mascot = () => ev(`document.querySelector('#mascot').getAttribute('class')`);
const noHScroll = () => ev('document.documentElement.scrollWidth <= innerWidth');

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36' });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__ev = [];
  for (const t of ['touchstart', 'pointerdown', 'click'])
    addEventListener(t, (e) => __ev.push(t + ':' + (e.pointerType || '')), true);
  // count sounds that actually start: synthesized effects, decoded clips, speech
  window.__snd = { fx: 0, clip: 0, speech: 0 };
  const osc = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...a) { __snd.fx++; return osc.apply(this, a); };
  const buf = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { __snd.clip++; return buf.apply(this, a); };
  if (window.speechSynthesis) {
    const speak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = (u) => { __snd.speech++; return speak(u); };
  }
` });

let failed = false;
for (const [W, H] of SIZES) {
  errors = [];
  dialogs = [];
  const results = [];
  const check = (name, ok, detail = '') => {
    if (!ok) failed = true;
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: URL_ });
  await sleep(1800);

  const env = await ev(`({ hover: matchMedia('(hover: hover)').matches, coarse: matchMedia('(pointer: coarse)').matches,
    touchAction: getComputedStyle(document.querySelector('#btnStart')).touchAction })`);
  check('touch device emulated', !env.hover && env.coarse, JSON.stringify(env));
  check('buttons: touch-action manipulation', env.touchAction === 'manipulation', env.touchAction);
  check('start: no horizontal scroll', await noHScroll());

  await tapSel('#btnSound');
  await sleep(200);
  const s1 = await ev(`document.querySelector('#btnSound').getAttribute('aria-pressed')`);
  await tapSel('#btnSound');
  await sleep(200);
  const s2 = await ev(`document.querySelector('#btnSound').getAttribute('aria-pressed')`);
  check('tap sound toggle off → on', s1 === 'false' && s2 === 'true', `${s1} → ${s2}`);

  await tapSel('#mascot');
  await sleep(150);
  check('tap mascot → wiggle', (await mascot()).includes('poke'));
  const evs = await ev('__ev.slice()');
  check('taps arrive as touch → click', evs.includes('pointerdown:touch') && evs.includes('click:touch'), [...new Set(evs)].join(', '));

  if (await ev(`!!document.querySelector('#btnLearn')`)) {
    await tapSel('#btnLearn');
    await sleep(700);
    check('learn: tap «learn» → learn screen', (await screen()) === 'learn');
    const before = await snd();
    const tiles = await ev(`document.querySelectorAll('.tile').length`);
    await tapSel(`.tile:nth-child(${Math.min(7, tiles)})`);
    await sleep(900);
    const after = await snd();
    const active = await ev(`[...document.querySelectorAll('.tile')].findIndex((t) => t.classList.contains('active'))`);
    const needSound = await ev(`document.body.hasAttribute('data-learn-sound')`);
    const played = after.clip + after.speech > before.clip + before.speech;
    check(`learn: tap tile → it becomes active${needSound ? ' and a sound plays' : ''}`, active === Math.min(7, tiles) - 1 && (played || !needSound),
      `active=${active}, sounds ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    const learnFit = await fits();
    check(`learn screen fits the height (zoom ${(+learnFit.k).toFixed(2)})`, learnFit.ok, `${learnFit.sh}>${learnFit.ih}`);
    await tapSel('#btnBack');
    await sleep(600);
    check('learn: tap back → start', (await screen()) === 'start');
  }

  await tapSel('#btnStart');
  await sleep(800);
  check('tap start → quiz', (await screen()) === 'quiz');
  check('quiz: mascot thinks', (await mascot()).includes('is-think'));

  let q = 0;
  let bad = [];
  let sticky = 0;
  let silent = 0;
  let overflow = [];
  let kq = '1';
  let typedQs = 0;
  while ((await screen()) === 'quiz' && q < 40) {
    if (await ev(`!!document.querySelector('#keypad:not([hidden])')`)) {
      // typed answer: tap two digits and ✓ on the on-screen keypad
      typedQs++;
      const s0 = await snd();
      for (const k of [String(1 + (q % 9)), String(q % 10), 'ok']) {
        await tapSel(`#keypad [data-key="${k}"]`);
        await sleep(120);
      }
      await sleep(800);
      if ((await snd()).fx <= s0.fx) silent++;
      const f = await fits();
      if (!f.ok) overflow.push(`q${q + 1}: ${f.sh}>${f.ih} (k=${f.k})`);
      const r = await ev(`(() => {
        const box = document.querySelector('#answerBox');
        const sheet = document.querySelector('#sheet');
        const rb = box.getBoundingClientRect();
        return { box: box.className, text: box.textContent, mascot: document.querySelector('#mascot').getAttribute('class'),
          shown: sheet.classList.contains('show'), visible: rb.top >= 0 && rb.bottom <= sheet.getBoundingClientRect().top };
      })()`);
      const right = r.box.includes('correct');
      const ok = r.shown && r.visible && r.text === `${1 + (q % 9)}${q % 10}`
        && (right ? r.mascot.includes('is-happy') : r.box.includes('wrong') && r.mascot.includes('is-sad'));
      if (!ok) bad.push(`q${q + 1} typed: ${JSON.stringify(r)}`);
      await tapSel('#btnNext');
      await sleep(700);
      q++;
      continue;
    }
    const n = await ev(`document.querySelectorAll('#options .opt').length`);
    const bgs = await ev(`[...document.querySelectorAll('#options .opt')].map((b) => getComputedStyle(b).backgroundColor)`);
    if (bgs.some((c) => c !== bgs[0])) sticky++;
    const pick = (q * 3) % n;
    const s0 = await snd();
    await tapSel(`#options .opt:nth-child(${pick + 1})`);
    await sleep(900);
    if ((await snd()).fx <= s0.fx) silent++;
    const f = await fits();
    if (q === 0) kq = f.k;
    if (!f.ok) overflow.push(`q${q + 1}: ${f.sh}>${f.ih} (k=${f.k})`);
    const r = await ev(`(() => {
      const btns = [...document.querySelectorAll('#options .opt')];
      const right = btns.findIndex((b) => b.classList.contains('correct'));
      const rr = btns[right].getBoundingClientRect();
      const sheet = document.querySelector('#sheet');
      return { right, picked: btns[${pick}].className, mascot: document.querySelector('#mascot').getAttribute('class'),
        shown: sheet.classList.contains('show'), visible: rr.top >= 0 && rr.bottom <= sheet.getBoundingClientRect().top };
    })()`);
    const isRight = r.right === pick;
    const ok = r.shown && r.visible && (isRight ? r.mascot.includes('is-happy') : r.mascot.includes('is-sad') && r.picked.includes('wrong'));
    if (!ok) bad.push(`q${q + 1}: ${JSON.stringify(r)}`);
    await tapSel('#btnNext');
    await sleep(700);
    q++;
  }
  check(`${q} questions${typedQs ? ` (${typedQs} typed on the keypad)` : ''}: mascot happy/sad, sheet shown, answer visible above sheet`, bad.length === 0, bad.join(' ; '));
  check('no sticky :hover between questions', sticky === 0, `${sticky}`);
  check('every answer tap plays a sound effect', silent === 0, `${silent} silent answers`);
  check(`quiz + answer sheet fit the screen height (zoom ${(+kq).toFixed(2)})`, overflow.length === 0, overflow.join(' ; '));

  const end = await ev(`({ screen: document.body.dataset.screen, score: document.querySelector('#statScore').textContent,
    mascot: document.querySelector('#mascot').getAttribute('class') })`);
  const [sc, tot] = end.score.split('/').map(Number);
  const ratio = sc / tot;
  const want = ratio >= 0.7 ? 'is-party' : ratio >= 0.4 ? 'is-happy' : 'is-wave';
  check(`results ${end.score} → mascot ${want}`, end.screen === 'end' && end.mascot.includes(want), end.mascot);
  check('results: no horizontal scroll', await noHScroll());

  await tapSel('#btnAgain');
  await sleep(800);
  check('tap again → new round', (await screen()) === 'quiz');
  await tapSel('#btnQuit');
  await sleep(600);
  check('tap quit → confirm → start', dialogs.length === 1 && (await screen()) === 'start');
  check('no JS errors', errors.length === 0, errors.join(' | '));

  console.log(`\n=== ${PAGE} @ ${W}x${H}, touch ===`);
  console.log(results.join('\n'));
}

ws.close();
chrome.kill();
srv.close();
await sleep(500);
fs.rmSync(prof, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
