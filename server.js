'use strict';
// Three Musketeers - DCA cue runner for Behringer WING.
// No dependencies:  node server.js   ->  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Wing } = require('./lib/wing');

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');
// nameSources: also name the console's input sources (Dante module = 'MOD'); source number = mic number
const DEFAULTS = { httpPort: 3000, wing: { ip: '', port: 2223 }, dcaCount: 16, nameSources: 'MOD', automix: '' };   // automix: 'X' or 'Y' = gain-sharing group for the scene's channels

function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return { ...DEFAULTS, ...c, wing: { ...DEFAULTS.wing, ...(c.wing || {}) } };
  } catch { return JSON.parse(JSON.stringify(DEFAULTS)); }
}
function saveConfig() { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n'); }

const config = loadConfig();
// optional overrides for testing:  HTTP_PORT=3999 WING_IP=127.0.0.1 WING_PORT=22230 node server.js
if (process.env.HTTP_PORT) config.httpPort = Number(process.env.HTTP_PORT);
if (process.env.WING_IP !== undefined) config.wing.ip = process.env.WING_IP;
if (process.env.WING_PORT) config.wing.port = Number(process.env.WING_PORT);
const show = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'show.json'), 'utf8'));
const scenes = new Map(show.scenes.map((s) => [s.id, s]));
const wing = new Wing(config.wing);

// ------------------------------------------------------------------ state
const state = { index: -1, sentScene: null };   // index -1 = standby, nothing sent yet
const log = [];
const clients = new Set();
const userTags = new Map();                      // channel -> non-DCA tags found on the console

function pushLog(entry) {
  log.push({ t: Date.now(), ...entry });
  if (log.length > 400) log.splice(0, log.length - 400);
}
wing.on('log', (e) => { pushLog(e); broadcastSoon(); });
wing.on('status', () => broadcastSoon());

function snapshot() {
  return {
    index: state.index,
    cue: state.index >= 0 ? show.cues[state.index] : null,
    wing: { ip: wing.ip, port: wing.port, online: wing.online, dryRun: wing.dryRun, info: wing.info },
    log: log.slice(-60),
  };
}
let pending = null;
function broadcastSoon() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    const data = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of clients) res.write(data);
  }, 30);
}

// ------------------------------------------------------------------ console control
async function readUserTags(mics) {
  // keep whatever tags the operator already has on a channel (mute groups etc.), we only own #D1..#D16
  const replies = await Promise.all(mics.map((m) => wing.query(`/ch/${m}/tags`)));
  replies.forEach((args, i) => {
    if (!args || typeof args[0] !== 'string') return;
    const keep = args[0].split(',').map((t) => t.trim()).filter((t) => t && !/^#D\d+$/i.test(t));
    userTags.set(mics[i], keep);
  });
}

// Automix on the WING lives in each channel's post-insert slot (mode AUTO_X / AUTO_Y, max 16 channels).
async function setAutomix(inScene) {
  const mode = `AUTO_${String(config.automix).toUpperCase()}`;
  const mics = show.mics.map((m) => m.mic);
  const cur = await Promise.all(mics.map(async (m) => ({
    mode: await wing.query(`/ch/${m}/postins/mode`), ins: await wing.query(`/ch/${m}/postins/ins`),
  })));
  wing.send(`/cfg/amix/${String(config.automix).toLowerCase()}`, 1);
  // leave first, so the 16-channel limit is never hit while joining
  mics.forEach((m, i) => {
    const was = cur[i].mode && String(cur[i].mode[0]);
    if (!inScene.has(m) && (!was || was.startsWith('AUTO'))) {
      wing.send(`/ch/${m}/postins/on`, 0);
      wing.send(`/ch/${m}/postins/mode`, 'FX');
    }
  });
  mics.forEach((m, i) => {
    if (!inScene.has(m)) return;
    const was = cur[i].mode && String(cur[i].mode[0]);
    const fx = cur[i].ins && String(cur[i].ins[0]);
    if (was === 'FX' && fx && fx !== 'NONE') {      // an effect is inserted there: do not displace it
      pushLog({ dir: 'err', text: `ch ${m}: post insert holds ${fx}, not added to automix` });
      return;
    }
    wing.send(`/ch/${m}/postins/mode`, mode);
    wing.send(`/ch/${m}/postins/on`, 1);
  });
}

// which input source carries a mic: same number unless config.sourceMap says otherwise
// a sourceMap entry is a number (same source group, other slot) or "GRP/n" (other group, e.g. "LCL/5")
const sourceOf = (mic) => {
  const v = (config.sourceMap || {})[mic];
  const m = /^([A-Za-z]+)\/(\d+)$/.exec(String(v ?? ''));
  if (m) return `${m[1].toUpperCase()}/${Number(m[2])}`;
  return `${config.nameSources}/${Number(v) || mic}`;
};

// ---- remembered DCA fader level per mic (so a character comes back at the level they were left at)
const LEVELS_FILE = process.env.LEVELS_FILE || path.join(ROOT, 'data', 'levels.json');   // override when testing
let levels = {};
try { levels = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8')); } catch { /* none saved yet */ }
function saveLevels() { fs.writeFile(LEVELS_FILE, JSON.stringify(levels, null, 1) + '\n', () => {}); }
let assigned = null;                             // chars of the scene currently on the console: [{mic, dca}]
async function captureLevels() {
  if (!assigned || config.rememberLevels === false) return;
  const replies = await Promise.all(assigned.map((c) => wing.query(`/dca/${c.dca}/fdr`)));
  let n = 0;
  replies.forEach((args, i) => {
    if (!args || typeof args[2] !== 'number') return;
    levels[assigned[i].mic] = Math.round(args[2] * 10) / 10;
    n++;
  });
  if (n) { saveLevels(); pushLog({ dir: 'info', text: `remembered ${n} DCA level(s)` }); }
}

const dcaMute = new Map();                       // DCA -> mute state this app last sent
const named = new Set();                         // DCAs this app has put a character name on
function setDcaMute(d, mute, force) {
  if (!force && dcaMute.get(d) === mute) return;
  dcaMute.set(d, mute);
  wing.send(`/dca/${d}/mute`, mute);
}

async function sendScene(scene, cue) {
  const inScene = new Map(scene.chars.map((c) => [c.mic, c]));
  const live = new Set(cue.live);
  const allMics = show.mics.map((m) => m.mic);
  await readUserTags(allMics);

  pushLog({ dir: 'info', text: `--- scene ${scene.id} "${scene.title}": full DCA / channel setup ---` });
  // 1. close every cast channel while DCAs are re-assigned (the scene's channels re-open in step 4)
  for (const m of show.mics) wing.send(`/ch/${m.mic}/mute`, 1);
  // 1b. automix: channels in the scene join the gain-sharing group, everyone else leaves it
  if (config.automix) await setAutomix(inScene);
  // 2. DCA mutes for the first cue, before anything is routed to them
  //    Only the DCAs this scene uses are touched - any other DCA is left exactly as it is.
  for (const c of scene.chars) setDcaMute(c.dca, live.has(c.mic) ? 0 : 1, true);
  // 3. DCA assignment (tags) and names
  for (const m of show.mics) {
    const c = inScene.get(m.mic);
    const tags = [...(userTags.get(m.mic) || [])];
    if (c) tags.push(`#D${c.dca}`);
    wing.send(`/ch/${m.mic}/tags`, tags.join(','));
    wing.send(`/ch/${m.mic}/name`, (c ? c.name : m.name).slice(0, 16));
    if (config.nameSources) wing.send(`/io/in/${sourceOf(m.mic)}/name`, (c ? c.name : m.name).slice(0, 16));
  }
  if (config.nameSources) {
    // blank any source in the range that no mic lands on (e.g. the old slot after a shift)
    const used = new Set(allMics.map(sourceOf));
    for (let n = 1; n <= Math.max(...allMics); n++) if (!used.has(`${config.nameSources}/${n}`)) wing.send(`/io/in/${config.nameSources}/${n}/name`, '');
  }
  const mine = new Set(scene.chars.map((c) => c.dca));
  for (const c of scene.chars) { wing.send(`/dca/${c.dca}/name`, c.dcaName.slice(0, 8)); named.add(c.dca); }
  // put each character's remembered level on the DCA they now have (DCAs are still muted / channels closed)
  if (config.rememberLevels !== false) {
    for (const c of scene.chars) if (typeof levels[c.mic] === 'number') wing.send(`/dca/${c.dca}/fdr`, { f: levels[c.mic] });
  }
  assigned = scene.chars.map((c) => ({ mic: c.mic, dca: c.dca }));
  // a DCA an earlier scene named but this one does not use: clear the old character name, nothing else
  for (const d of [...named]) if (!mine.has(d)) { wing.send(`/dca/${d}/name`, ''); named.delete(d); dcaMute.delete(d); }
  // end of show (a scene with nobody in it): mute the DCAs reserved for mics, 1..dcaCount, and no others
  if (!scene.chars.length) for (let d = 1; d <= config.dcaCount; d++) setDcaMute(d, 1, true);
  // 4. open the channels that belong to this scene (their DCA decides if they are heard)
  for (const c of scene.chars) wing.send(`/ch/${c.mic}/mute`, 0);
  state.sentScene = scene.id;
}

// within a scene: only the DCAs whose mute actually changes get a message
function sendMutes(scene, cue) {
  const live = new Set(cue.live);
  for (const c of scene.chars) setDcaMute(c.dca, live.has(c.mic) ? 0 : 1, false);
}

let busy = Promise.resolve();
function fire(index, { full = false } = {}) {
  busy = busy.then(async () => {
    index = Math.max(0, Math.min(show.cues.length - 1, index));
    const cue = show.cues[index];
    const scene = scenes.get(cue.scene);
    state.index = index;
    pushLog({ dir: 'cue', text: `CUE ${cue.id}  ${cue.label}` });
    await captureLevels();                       // every cue: save where the scene's DCA faders are right now
    if (full || state.sentScene !== scene.id) await sendScene(scene, cue);
    else sendMutes(scene, cue);
    broadcastSoon();
  }).catch((e) => pushLog({ dir: 'err', text: String(e && e.stack || e) }));
  return busy;
}

// ------------------------------------------------------------------ http
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function result() {
  const cue = state.index >= 0 ? show.cues[state.index] : null;
  const next = show.cues[state.index + 1] || null;
  return { ok: true, index: state.index, cue: cue && { id: cue.id, label: cue.label, live: cue.live }, next: next && { id: next.id, label: next.label } };
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'content-type' }); return res.end(); }

  // ---- cue control: GET or POST both work so any show-control tool can trigger them
  if (p === '/api/next' || p === '/next' || p === '/go') {
    if (state.index >= show.cues.length - 1) return json(res, 200, { ...result(), atEnd: true });
    await fire(state.index + 1); return json(res, 200, result());
  }
  if (p === '/api/prev' || p === '/prev' || p === '/back') {
    if (state.index <= 0) return json(res, 200, { ...result(), atStart: true });
    await fire(state.index - 1); return json(res, 200, result());
  }
  // whole scenes: land on the scene's .0 blackout cue (everything muted, DCAs set up)
  if (p === '/api/next-scene' || p === '/next-scene' || p === '/api/prev-scene' || p === '/prev-scene') {
    const order = show.scenes.map((sc) => sc.id);
    const here = state.index >= 0 ? order.indexOf(show.cues[state.index].scene) : -1;
    const want = p.includes('next') ? here + 1 : here - 1;
    if (want >= order.length) return json(res, 200, { ...result(), atEnd: true });
    if (want < 0) return json(res, 200, { ...result(), atStart: true });
    await fire(show.cues.findIndex((c) => c.scene === order[want]));
    return json(res, 200, result());
  }
  if (p === '/api/first' || p === '/first') { await fire(0, { full: true }); return json(res, 200, result()); }
  if (p === '/api/resync' || p === '/resync') {
    if (state.index < 0) return json(res, 409, { ok: false, error: 'no cue is active yet' });
    await fire(state.index, { full: true }); return json(res, 200, result());
  }
  let m = p.match(/^\/(?:api\/)?goto\/(.+)$/);
  if (m) {
    const i = show.cues.findIndex((c) => c.id === m[1]);
    if (i < 0) return json(res, 404, { ok: false, error: `no cue ${m[1]}` });
    await fire(i); return json(res, 200, result());
  }
  if (p === '/api/levels') return json(res, 200, { ok: true, levels });
  if (p === '/api/levels/save') { await (busy = busy.then(captureLevels)); return json(res, 200, { ok: true, levels }); }
  if (p === '/api/levels/clear') { levels = {}; saveLevels(); return json(res, 200, { ok: true, levels }); }
  if (p === '/api/state') return json(res, 200, { ...result(), wing: snapshot().wing });
  if (p === '/api/show') return json(res, 200, show);
  if (p === '/api/config' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.ip !== undefined) config.wing.ip = String(body.ip).trim();
    if (body.port !== undefined) config.wing.port = Number(body.port) || 2223;
    saveConfig();
    wing.configure(config.wing);
    state.sentScene = null;                      // next cue does a full setup on the new console
    assigned = null;
    return json(res, 200, { ok: true, wing: snapshot().wing });
  }
  if (p === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // ---- static files
  // /control = the main page without the script, /script = the script only
  const page = { '/': 'index.html', '/control': 'index.html', '/script': 'script.html' }[p];
  const file = path.normalize(path.join(ROOT, 'public', page || p));
  if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': file.includes('pages') ? 'max-age=3600' : 'no-store' });
    res.end(data);
  });
});

server.listen(config.httpPort, () => {
  console.log(`Three Musketeers cue runner: http://localhost:${config.httpPort}`);
  console.log(wing.dryRun ? 'No console IP set - running dry (messages are logged, not sent).' : `WING at ${wing.ip}:${wing.port}`);
  console.log(`Next cue over HTTP:  curl http://localhost:${config.httpPort}/api/next`);
});
