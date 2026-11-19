'use strict';
// Minimal OSC 1.0 encoder/decoder (strings, int32, float32) - all the Wing needs.

function pad(buf) {
  const n = 4 - (buf.length % 4);
  return Buffer.concat([buf, Buffer.alloc(n)]);      // always at least one null, 4-byte aligned
}

function encode(address, args = []) {
  const parts = [pad(Buffer.from(address, 'ascii'))];
  let tags = ',';
  const data = [];
  for (const a of args) {
    if (a && typeof a === 'object' && 'f' in a) {          // {f: n} forces a float32 even for whole numbers
      tags += 'f';
      const b = Buffer.alloc(4); b.writeFloatBE(a.f); data.push(b);
    } else if (typeof a === 'string') {
      tags += 's';
      data.push(pad(Buffer.from(a, 'utf8')));
    } else if (Number.isInteger(a)) {
      tags += 'i';
      const b = Buffer.alloc(4); b.writeInt32BE(a); data.push(b);
    } else {
      tags += 'f';
      const b = Buffer.alloc(4); b.writeFloatBE(a); data.push(b);
    }
  }
  parts.push(pad(Buffer.from(tags, 'ascii')), ...data);
  return Buffer.concat(parts);
}

function readString(buf, off) {
  let end = off;
  while (end < buf.length && buf[end] !== 0) end++;
  const s = buf.toString('utf8', off, end);
  return [s, (end + 4) & ~3];
}

function decode(buf) {
  let off = 0, address, tags;
  [address, off] = readString(buf, off);
  if (off >= buf.length) return { address, args: [] };
  [tags, off] = readString(buf, off);
  const args = [];
  for (const t of tags.slice(1)) {
    if (t === 's') { let s; [s, off] = readString(buf, off); args.push(s); }
    else if (t === 'i') { args.push(buf.readInt32BE(off)); off += 4; }
    else if (t === 'f') { args.push(buf.readFloatBE(off)); off += 4; }
    else break;
  }
  return { address, args };
}

module.exports = { encode, decode };
