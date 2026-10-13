#!/usr/bin/env node
// Plays one round of a game with real touch taps (headless Chrome + CDP Input.dispatchTouchEvent)
// on two phone sizes and checks the owl reactions, the feedback sheet, results and navigation.
//
//   node scripts/touch-test.mjs games/sinonimy/
//
// Needs Node >= 22 and google-chrome (or set CHROME=/path/to/chrome). Works for any game built on
// the standard skeleton: #btnStart, #options .opt, #sheet, #btnNext, #statScore, #btnAgain,
// #btnQuit, #btnSound, #owl, body[data-screen=start|quiz|end].
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = (process.argv[2] || 'games/sinonimy/').replace(/^\/+/, '');
const SIZES = [[390, 844], [360, 640]];
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
const owl = () => ev(`document.querySelector('#owl').getAttribute('class')`);
const noHScroll = () => ev('document.documentElement.scrollWidth <= innerWidth');

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36' });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__ev = [];
  for (const t of ['touchstart', 'pointerdown', 'click'])
    addEventListener(t, (e) => __ev.push(t + ':' + (e.pointerType || '')), true);
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

  await tapSel('#owl');
  await sleep(150);
  check('tap owl → wiggle', (await owl()).includes('poke'));
  const evs = await ev('__ev.slice()');
  check('taps arrive as touch → click', evs.includes('pointerdown:touch') && evs.includes('click:touch'), [...new Set(evs)].join(', '));

  await tapSel('#btnStart');
  await sleep(800);
  check('tap start → quiz', (await screen()) === 'quiz');
  check('quiz: owl thinks', (await owl()).includes('is-think'));

  let q = 0;
  let bad = [];
  let sticky = 0;
  while ((await screen()) === 'quiz' && q < 40) {
    const n = await ev(`document.querySelectorAll('#options .opt').length`);
    const bgs = await ev(`[...document.querySelectorAll('#options .opt')].map((b) => getComputedStyle(b).backgroundColor)`);
    if (bgs.some((c) => c !== bgs[0])) sticky++;
    const pick = (q * 3) % n;
    await tapSel(`#options .opt:nth-child(${pick + 1})`);
    await sleep(900);
    const r = await ev(`(() => {
      const btns = [...document.querySelectorAll('#options .opt')];
      const right = btns.findIndex((b) => b.classList.contains('correct'));
      const rr = btns[right].getBoundingClientRect();
      const sheet = document.querySelector('#sheet');
      return { right, picked: btns[${pick}].className, owl: document.querySelector('#owl').getAttribute('class'),
        shown: sheet.classList.contains('show'), visible: rr.top >= 0 && rr.bottom <= sheet.getBoundingClientRect().top };
    })()`);
    const isRight = r.right === pick;
    const ok = r.shown && r.visible && (isRight ? r.owl.includes('is-happy') : r.owl.includes('is-sad') && r.picked.includes('wrong'));
    if (!ok) bad.push(`q${q + 1}: ${JSON.stringify(r)}`);
    await tapSel('#btnNext');
    await sleep(700);
    q++;
  }
  check(`${q} questions: owl happy/sad, sheet shown, right option visible above sheet`, bad.length === 0, bad.join(' ; '));
  check('no sticky :hover between questions', sticky === 0, `${sticky}`);

  const end = await ev(`({ screen: document.body.dataset.screen, score: document.querySelector('#statScore').textContent,
    owl: document.querySelector('#owl').getAttribute('class') })`);
  const [sc, tot] = end.score.split('/').map(Number);
  const ratio = sc / tot;
  const want = ratio >= 0.7 ? 'is-party' : ratio >= 0.4 ? 'is-happy' : 'is-wave';
  check(`results ${end.score} → owl ${want}`, end.screen === 'end' && end.owl.includes(want), end.owl);
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
