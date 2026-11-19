#!/usr/bin/env node
// Copy the main EQ of one WING channel to others.   node tools/copy-eq.js <from> <first> <last> [--dry]
// Backs up every target channel's EQ to backups/ first; restore with:  node tools/copy-eq.js --restore <file>
const dgram = require('dgram'), fs = require('fs'), path = require('path');
const osc = require('../lib/osc');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const IP = cfg.wing.ip, PORT = cfg.wing.port;
const PARAMS = ['on', 'mdl', 'mix', 'lg', 'lf', 'lq', 'leq', '1g', '1f', '1q', '2g', '2f', '2q', '3g', '3f', '3q', '4g', '4f', '4q', 'hg', 'hf', 'hq', 'heq'];
const sock = dgram.createSocket('udp4'); const waiters = new Map();
sock.on('message', (m) => {
  const d = osc.decode(m); const z = m.indexOf(0x2c, d.address.length); const tags = m.toString('ascii', z, m.indexOf(0, z));
  const w = waiters.get(d.address); if (w) { waiters.delete(d.address); w({ tags, args: d.args }); }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(addr) {
  for (let t = 0; t < 4; t++) {
    const r = await new Promise((res) => { waiters.set(addr, res); sock.send(osc.encode(addr, []), PORT, IP); setTimeout(() => res(null), 400); });
    if (r) return r;
  }
  throw new Error('no reply for ' + addr);
}
// value to send back: float params as float, int as int, enums as string
const val = (r) => (r.tags === ',sff' ? { f: r.args[2] } : r.tags === ',sfi' ? { i: r.args[2] } : { s: r.args[0] });
const enc = (addr, v) => { const b = osc.encode(addr, ['f' in v ? 0.5 : 'i' in v ? v.i : v.s]); if ('f' in v) b.writeFloatBE(v.f, b.length - 4); return b; };
async function readEq(ch) { const o = {}; for (const p of PARAMS) { const r = await get(`/ch/${ch}/eq/${p}`); o[p] = { ...val(r), txt: r.args[0] }; } return o; }
async function writeEq(ch, eq) { for (const p of PARAMS) { sock.send(enc(`/ch/${ch}/eq/${p}`, eq[p]), PORT, IP); await sleep(4); } }

(async () => {
  await new Promise((r) => sock.bind(0, r));
  const a = process.argv.slice(2);
  if (a[0] === '--restore') {
    const b = JSON.parse(fs.readFileSync(a[1], 'utf8'));
    for (const [ch, eq] of Object.entries(b.channels)) { await writeEq(ch, eq); console.log('restored ch', ch); }
    process.exit(0);
  }
  const from = +a[0], first = +a[1], last = +a[2], dry = a.includes('--dry');
  const src = await readEq(from);
  console.log(`ch ${from} EQ:`, PARAMS.map((p) => `${p}=${src[p].txt}`).join(' '));
  const targets = []; for (let c = first; c <= last; c++) if (c !== from) targets.push(c);
  const backup = { taken: new Date().toISOString(), from, channels: {} };
  for (const c of targets) backup.channels[c] = await readEq(c);
  const dir = path.join(__dirname, '..', 'backups'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `eq-backup-${backup.taken.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 1)); console.log('backup ->', file);
  const differing = targets.filter((c) => PARAMS.some((p) => backup.channels[c][p].txt !== src[p].txt));
  console.log('channels that differ from the source now:', differing.join(', ') || 'none');
  if (dry) process.exit(0);
  for (const c of targets) await writeEq(c, src);
  await sleep(300);
  let bad = 0;
  for (const c of targets) { const now = await readEq(c); const diff = PARAMS.filter((p) => now[p].txt !== src[p].txt); if (diff.length) { bad++; console.log(`ch ${c} MISMATCH:`, diff.map((p) => `${p} ${now[p].txt}!=${src[p].txt}`).join(', ')); } }
  console.log(bad ? `${bad} channel(s) did not match` : `verified: EQ on ${targets.length} channels matches ch ${from}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
