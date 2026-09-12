/** Atualiza HUD DOM — velocidade, volta, posição, RPM, mensagens. */

import { formatTime, formatSpeed } from './utils.js';

export class Hud {
    constructor() {
        this.els = {
            speed: document.getElementById('hudSpeed'),
            gear: document.getElementById('hudGear'),
            rpm: document.getElementById('hudRpm'),
            lap: document.getElementById('hudLap'),
            pos: document.getElementById('hudPos'),
            time: document.getElementById('hudTime'),
            best: document.getElementById('hudBest'),
            message: document.getElementById('hudMessage'),
            countdown: document.getElementById('countdown'),
            minimap: document.getElementById('minimap')
        };
        this._msgTimer = 0;
        this.minimapCtx = this.els.minimap?.getContext('2d') || null;
    }

    setMessage(text, seconds = 2) {
        if (!this.els.message) return;
        this.els.message.textContent = text;
        this.els.message.dataset.show = 'true';
        this._msgTimer = seconds;
    }

    update(dt, state) {
        if (this._msgTimer > 0) {
            this._msgTimer -= dt;
            if (this._msgTimer <= 0 && this.els.message) this.els.message.dataset.show = 'false';
        }
        const p = state.player;
        if (this.els.speed) this.els.speed.textContent = formatSpeed(p.speed);
        if (this.els.gear) this.els.gear.textContent = String(p.gear);
        if (this.els.rpm) {
            const pct = Math.min(1, (p.rpm - 900) / 8100);
            this.els.rpm.style.setProperty('--rpm', `${(pct * 100).toFixed(1)}%`);
        }
        if (this.els.lap) this.els.lap.textContent = `${Math.min(state.laps, p.lap + 1)} / ${state.laps}`;
        if (this.els.pos) this.els.pos.textContent = `${p.place}º`;
        if (this.els.time) this.els.time.textContent = formatTime(state.raceTime);
        if (this.els.best) this.els.best.textContent = p.bestLap ? formatTime(p.bestLap) : '--:--.---';

        if (this.els.countdown) {
            if (state.phase === 'countdown') {
                this.els.countdown.hidden = false;
                this.els.countdown.textContent = state.countdown > 0.2
                    ? String(Math.ceil(state.countdown))
                    : 'VAI!';
            } else {
                this.els.countdown.hidden = true;
            }
        }

        this._drawMinimap(state);
    }

    _drawMinimap(state) {
        const ctx = this.minimapCtx;
        const canvas = this.els.minimap;
        if (!ctx || !canvas || !state.track) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(10,12,16,0.55)';
        ctx.fillRect(0, 0, w, h);

        const track = state.track;
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < track.count; i += 2) {
            minX = Math.min(minX, track.x[i]);
            maxX = Math.max(maxX, track.x[i]);
            minZ = Math.min(minZ, track.z[i]);
            maxZ = Math.max(maxZ, track.z[i]);
        }
        const pad = 12;
        const sx = (w - pad * 2) / (maxX - minX || 1);
        const sz = (h - pad * 2) / (maxZ - minZ || 1);
        const s = Math.min(sx, sz);
        const mapX = (x) => pad + (x - minX) * s;
        const mapZ = (z) => pad + (z - minZ) * s;

        ctx.strokeStyle = '#d8c4a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < track.count; i++) {
            const x = mapX(track.x[i]);
            const z = mapZ(track.z[i]);
            if (i === 0) ctx.moveTo(x, z); else ctx.lineTo(x, z);
        }
        ctx.closePath();
        ctx.stroke();

        for (const car of state.cars) {
            ctx.fillStyle = car.isPlayer ? '#ff6a3d' : '#9ec9ff';
            ctx.beginPath();
            ctx.arc(mapX(car.x), mapZ(car.z), car.isPlayer ? 3.5 : 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
