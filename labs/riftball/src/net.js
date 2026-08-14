/**
 * Rede 1v1: BroadcastChannel (mesma origem / duas abas) + WebRTC via PeerJS
 * (máquinas diferentes, sinalização na nuvem pública do PeerJS).
 *
 * O host é autoridade da física. O convidado manda input; o host devolve
 * snapshots. Sem servidor de jogo — GitHub Pages só entrega o estático.
 */

import { NET } from './config.js';

export function randomCode() {
    let s = '';
    for (let i = 0; i < 4; i++) {
        s += NET.alphabet[Math.floor(Math.random() * NET.alphabet.length)];
    }
    return s;
}

export function roomUrl(code) {
    const url = new URL(window.location.href);
    url.searchParams.set('sala', code);
    url.hash = '';
    return url.toString();
}

function waitPeerCtor(timeout = 6000) {
    if (window.Peer) return Promise.resolve(window.Peer);
    return new Promise((resolve, reject) => {
        const t0 = performance.now();
        const tick = () => {
            if (window.Peer) return resolve(window.Peer);
            if (performance.now() - t0 > timeout) {
                reject(new Error('PeerJS não carregou. Verifique a rede.'));
                return;
            }
            requestAnimationFrame(tick);
        };
        tick();
    });
}

export class Net {
    constructor() {
        this.role = null;
        this.code = null;
        this.connected = false;
        this.transport = null;
        this.peer = null;
        this.conn = null;
        this.channel = null;
        this.handlers = {};
        this._bcBound = false;
    }

    on(ev, fn) {
        this.handlers[ev] = fn;
    }

    emit(ev, data) {
        this.handlers[ev]?.(data);
    }

    send(msg) {
        if (!this.connected) return;
        try {
            if (this.conn?.open) this.conn.send(msg);
        } catch { /* ignore */ }
        try {
            this.channel?.postMessage({ from: this.role, msg });
        } catch { /* ignore */ }
    }

    destroy() {
        this.connected = false;
        try { this.conn?.close(); } catch { /* ignore */ }
        try { this.peer?.destroy(); } catch { /* ignore */ }
        try { this.channel?.close(); } catch { /* ignore */ }
        this.conn = null;
        this.peer = null;
        this.channel = null;
        this._bcBound = false;
    }

    _bindBroadcast(code) {
        if (typeof BroadcastChannel === 'undefined') return;
        this.channel = new BroadcastChannel(`riftball:${code}`);
        this.channel.onmessage = (ev) => {
            const data = ev.data;
            if (!data || data.from === this.role) return;
            if (data.msg?.type === 'hello' && this.role === 'host' && !this.connected) {
                this.transport = 'broadcast';
                this.connected = true;
                this.channel.postMessage({ from: 'host', msg: { type: 'welcome' } });
                this.emit('connected');
                return;
            }
            if (data.msg?.type === 'welcome' && this.role === 'guest' && !this.connected) {
                this.transport = 'broadcast';
                this.connected = true;
                this.emit('connected');
                return;
            }
            if (this.connected) this.emit('message', data.msg);
        };
        this._bcBound = true;
    }

    async host(code) {
        this.destroy();
        this.role = 'host';
        this.code = code;
        this._bindBroadcast(code);
        this._startPeerHost(code).catch((err) => this.emit('warn', err.message));
    }

    async join(code) {
        this.destroy();
        this.role = 'guest';
        this.code = code;
        this._bindBroadcast(code);
        this.channel?.postMessage({ from: 'guest', msg: { type: 'hello' } });
        this._startPeerGuest(code).catch((err) => this.emit('error', err.message));
    }

    async _startPeerHost(code) {
        const Peer = await waitPeerCtor();
        const peer = new Peer(`${NET.prefix}${code}`, { debug: 0 });
        this.peer = peer;
        peer.on('error', (err) => {
            if (String(err?.type) === 'unavailable-id') {
                this.emit('error', 'Esse código já está em uso. Crie outra sala.');
            } else {
                this.emit('warn', err.message || 'PeerJS avisou um erro.');
            }
        });
        peer.on('connection', (conn) => {
            if (this.connected && this.transport === 'broadcast') {
                conn.close();
                return;
            }
            this.conn = conn;
            conn.on('data', (msg) => this.emit('message', msg));
            conn.on('close', () => {
                if (this.transport === 'webrtc') {
                    this.connected = false;
                    this.emit('disconnected');
                }
            });
            conn.on('open', () => {
                if (this.connected) return;
                this.transport = 'webrtc';
                this.connected = true;
                this.emit('connected');
            });
        });
    }

    async _startPeerGuest(code) {
        const Peer = await waitPeerCtor();
        const peer = new Peer({ debug: 0 });
        this.peer = peer;
        peer.on('error', (err) => {
            this.emit('error', err.message || 'Não deu para achar a sala.');
        });
        await new Promise((resolve, reject) => {
            peer.on('open', resolve);
            peer.on('error', reject);
        });
        if (this.connected) return;
        const conn = peer.connect(`${NET.prefix}${code}`, { reliable: true });
        this.conn = conn;
        conn.on('data', (msg) => this.emit('message', msg));
        conn.on('close', () => {
            if (this.transport === 'webrtc') {
                this.connected = false;
                this.emit('disconnected');
            }
        });
        conn.on('open', () => {
            if (this.connected) return;
            this.transport = 'webrtc';
            this.connected = true;
            this.emit('connected');
        });
    }
}
