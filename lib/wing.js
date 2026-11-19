'use strict';
// Behringer WING over OSC (UDP 2223).
//   /ch/N/name  s (16 chars)     /ch/N/mute  i 0|1     /ch/N/tags s  ("#D1".."#D16" = DCA assignment)
//   /dca/N/name s (8 chars)      /dca/N/mute i 0|1
const dgram = require('dgram');
const { EventEmitter } = require('events');
const osc = require('./osc');

class Wing extends EventEmitter {
  constructor({ ip = '', port = 2223 } = {}) {
    super();
    this.ip = ip;
    this.port = port;
    this.online = false;
    this.info = '';
    this.lastSeen = 0;
    this.queue = [];
    this.draining = false;
    this.waiters = new Map();                 // address -> [resolve]
    this.sock = dgram.createSocket('udp4');
    this.sock.on('error', (e) => this.emit('log', { dir: 'err', text: String(e.message || e) }));
    this.sock.on('message', (msg) => this._onMessage(msg));
    this.sock.bind(0);
    this.timer = setInterval(() => this._heartbeat(), 3000);
  }

  get dryRun() { return !this.ip; }

  configure({ ip, port }) {
    if (ip !== undefined) this.ip = String(ip).trim();
    if (port !== undefined) this.port = Number(port) || 2223;
    this.online = false;
    this.info = '';
    this.emit('status');
    this._heartbeat();
  }

  _onMessage(msg) {
    let m;
    try { m = osc.decode(msg); } catch { return; }
    this.lastSeen = Date.now();
    if (!this.online) { this.online = true; this.emit('status'); }
    if (m.address === '/?' || m.address === '/*') {
      this.info = String(m.args[0] || '');
      this.emit('status');
    }
    const w = this.waiters.get(m.address);
    if (w) { this.waiters.delete(m.address); w.forEach((r) => r(m.args)); }
  }

  _heartbeat() {
    if (this.dryRun) return;
    this._raw('/?', []);
    if (this.online && Date.now() - this.lastSeen > 7000) { this.online = false; this.emit('status'); }
  }

  _raw(address, args) {
    if (this.dryRun) return;
    this.sock.send(osc.encode(address, args), this.port, this.ip, () => {});
  }

  // queued, paced send so a full scene change (~120 messages) is not dropped
  send(address, ...args) {
    this.queue.push([address, args]);
    this.emit('log', { dir: this.dryRun ? 'dry' : 'out', text: `${address} ${args.map((a) => JSON.stringify(a)).join(' ')}` });
    if (!this.draining) this._drain();
  }

  _drain() {
    this.draining = true;
    const step = () => {
      for (let i = 0; i < 4 && this.queue.length; i++) {
        const [a, args] = this.queue.shift();
        this._raw(a, args);
      }
      if (this.queue.length) setTimeout(step, 3);
      else this.draining = false;
    };
    step();
  }

  // ask the console for a value; resolves with the reply args, or null if nothing came back
  query(address, timeout = 300) {
    if (this.dryRun) return Promise.resolve(null);
    return new Promise((resolve) => {
      const list = this.waiters.get(address) || [];
      list.push(resolve);
      this.waiters.set(address, list);
      this._raw(address, []);
      setTimeout(() => {
        const l = this.waiters.get(address);
        if (l && l.includes(resolve)) {
          this.waiters.set(address, l.filter((r) => r !== resolve));
          resolve(null);
        }
      }, timeout);
    });
  }

  close() { clearInterval(this.timer); this.sock.close(); }
}

module.exports = { Wing };
