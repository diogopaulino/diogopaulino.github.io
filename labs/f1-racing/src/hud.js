/** DOM heads-up display: telemetry cluster, timing tower, minimap and messages. */

import { formatTime, formatDelta } from './config.js';

export class Hud {
    constructor(root) {
        this.root = root;
        this.el = {
            speed: root.querySelector('#speedValue'),
            gear: root.querySelector('#gearValue'),
            rpmFill: root.querySelector('#rpmFill'),
            shiftLights: [...root.querySelectorAll('#shiftLights i')],
            position: root.querySelector('#positionValue'),
            positionTotal: root.querySelector('#positionTotal'),
            lap: root.querySelector('#lapValue'),
            lapTotal: root.querySelector('#lapTotal'),
            currentTime: root.querySelector('#currentLapTime'),
            bestTime: root.querySelector('#bestLapTime'),
            lastDelta: root.querySelector('#lastDelta'),
            ersFill: root.querySelector('#ersFill'),
            ersValue: root.querySelector('#ersValue'),
            tyreLabel: root.querySelector('#tyreLabel'),
            tyreWear: root.querySelector('#tyreWear'),
            tyreTemp: root.querySelector('#tyreTemp'),
            drsBadge: root.querySelector('#drsBadge'),
            tower: root.querySelector('#timingTower'),
            minimap: root.querySelector('#minimap'),
            message: root.querySelector('#raceMessage'),
            sector: root.querySelector('#sectorLabel'),
            live: root.querySelector('#raceAnnouncer'),
            fps: root.querySelector('#fpsCounter')
        };

        this.mapCtx = this.el.minimap?.getContext('2d') ?? null;
        this.towerRows = new Map();
        this.messageTimer = 0;
        this.lastGear = null;
    }

    prepareMinimap(circuit) {
        this.circuit = circuit;
        this.mapDirty = true;
    }

    resizeMinimap() {
        const canvas = this.el.minimap;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.max(80, Math.round(rect.width * ratio));
        canvas.height = Math.max(80, Math.round(rect.height * ratio));
        this.mapDirty = true;
    }

    buildMapPath() {
        const circuit = this.circuit;
        const canvas = this.el.minimap;
        if (!circuit || !canvas) return;

        const pad = 10;
        const w = canvas.width - pad * 2;
        const h = canvas.height - pad * 2;
        const spanX = circuit.maxX - circuit.minX;
        const spanZ = circuit.maxZ - circuit.minZ;
        const scale = Math.min(w / spanX, h / spanZ);
        this.mapScale = scale;
        this.mapOffsetX = pad + (w - spanX * scale) / 2 - circuit.minX * scale;
        this.mapOffsetY = pad + (h - spanZ * scale) / 2 - circuit.minZ * scale;

        const path = new Path2D();
        for (let i = 0; i <= circuit.count; i++) {
            const j = i % circuit.count;
            const x = circuit.cx[j] * scale + this.mapOffsetX;
            const y = circuit.cz[j] * scale + this.mapOffsetY;
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
        }
        path.closePath();
        this.mapPath = path;

        const drsPaths = [];
        for (const zone of circuit.drs) {
            const sub = new Path2D();
            const startIndex = circuit.indexAt(zone.start * circuit.length);
            const endIndex = circuit.indexAt(zone.end * circuit.length);
            let i = startIndex;
            let guard = 0;
            let first = true;
            while (guard++ < circuit.count) {
                const x = circuit.cx[i] * scale + this.mapOffsetX;
                const y = circuit.cz[i] * scale + this.mapOffsetY;
                if (first) { sub.moveTo(x, y); first = false; } else sub.lineTo(x, y);
                if (i === endIndex) break;
                i = (i + 1) % circuit.count;
            }
            drsPaths.push(sub);
        }
        this.drsPaths = drsPaths;
        this.mapDirty = false;
    }

    drawMinimap(cars, playerCar) {
        const ctx = this.mapCtx;
        if (!ctx || !this.circuit) return;
        if (this.mapDirty || !this.mapPath) this.buildMapPath();
        const canvas = this.el.minimap;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 7;
        ctx.stroke(this.mapPath);
        ctx.strokeStyle = 'rgba(12,14,20,0.9)';
        ctx.lineWidth = 4.5;
        ctx.stroke(this.mapPath);

        ctx.strokeStyle = 'rgba(52, 235, 152, 0.85)';
        ctx.lineWidth = 3;
        for (const path of this.drsPaths || []) ctx.stroke(path);

        // Start/finish tick.
        const c = this.circuit;
        const sx = c.cx[0] * this.mapScale + this.mapOffsetX;
        const sy = c.cz[0] * this.mapScale + this.mapOffsetY;
        ctx.fillStyle = '#f4f6fb';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);

        for (const car of cars) {
            const x = car.position.x * this.mapScale + this.mapOffsetX;
            const y = car.position.z * this.mapScale + this.mapOffsetY;
            const isPlayer = car === playerCar;
            ctx.beginPath();
            ctx.arc(x, y, isPlayer ? 5 : 3.6, 0, Math.PI * 2);
            ctx.fillStyle = `#${car.team.primary.toString(16).padStart(6, '0')}`;
            ctx.fill();
            if (isPlayer) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            }
        }
    }

    updateTower(order, playerCar) {
        const tower = this.el.tower;
        if (!tower) return;

        const seen = new Set();
        order.forEach((car, index) => {
            seen.add(car);
            let row = this.towerRows.get(car);
            if (!row) {
                row = document.createElement('li');
                row.className = 'tower-row';
                row.innerHTML = `
                    <span class="tower-pos"></span>
                    <span class="tower-flag" aria-hidden="true"></span>
                    <span class="tower-name"></span>
                    <span class="tower-gap"></span>`;
                row.querySelector('.tower-flag').style.background =
                    `#${car.team.primary.toString(16).padStart(6, '0')}`;
                this.towerRows.set(car, row);
                tower.appendChild(row);
            }
            row.style.order = String(index);
            row.classList.toggle('is-player', car === playerCar);
            row.querySelector('.tower-pos').textContent = String(index + 1);
            row.querySelector('.tower-name').textContent = car.team.short;

            const gapEl = row.querySelector('.tower-gap');
            if (index === 0) {
                gapEl.textContent = car.finished ? formatTime(car.finishTime) : 'LÍDER';
            } else {
                const leader = order[0];
                const gapMeters = leader.totalDistance - car.totalDistance;
                const lapLen = this.circuit?.length || 5000;
                if (gapMeters <= 0) {
                    gapEl.textContent = '—';
                } else if (gapMeters > lapLen * 0.85) {
                    const laps = Math.max(1, Math.round(gapMeters / lapLen));
                    gapEl.textContent = laps === 1 ? '+1 VOLTA' : `+${laps} VOLTAS`;
                } else {
                    // Use the faster of the two so a parked car doesn't show +1000s.
                    const speed = Math.max(28, car.speed, leader.speed * 0.85);
                    gapEl.textContent = `+${(gapMeters / speed).toFixed(1)}s`;
                }
            }
        });

        for (const [car, row] of this.towerRows) {
            if (!seen.has(car)) {
                row.remove();
                this.towerRows.delete(car);
            }
        }
    }

    message(text, { duration = 2.4, tone = 'info' } = {}) {
        const el = this.el.message;
        if (!el) return;
        el.textContent = text;
        el.dataset.tone = tone;
        el.classList.add('is-visible');
        this.messageTimer = duration;
        if (this.el.live) this.el.live.textContent = text;
    }

    update(state, dt) {
        const { car, lapCount, totalCars, drsState, sector } = state;
        const el = this.el;

        const speedKmh = Math.round(Math.abs(car.vx) * 3.6);
        if (el.speed) el.speed.textContent = String(speedKmh);
        if (el.gear) {
            const gear = car.vx < 0.5 && car.throttle < 0.05 ? 'N' : String(car.gear);
            if (gear !== this.lastGear) {
                el.gear.textContent = gear;
                el.gear.classList.remove('is-shift');
                void el.gear.offsetWidth;
                el.gear.classList.add('is-shift');
                this.lastGear = gear;
            }
        }

        const rpmNorm = Math.min(1, car.rpm / 15000);
        if (el.rpmFill) el.rpmFill.style.setProperty('--fill', rpmNorm.toFixed(3));
        el.shiftLights.forEach((light, i) => {
            const threshold = 0.62 + (i / el.shiftLights.length) * 0.38;
            light.classList.toggle('is-lit', rpmNorm >= threshold);
        });

        if (el.position) el.position.textContent = String(state.position);
        if (el.positionTotal) el.positionTotal.textContent = String(totalCars);
        if (el.lap) el.lap.textContent = String(Math.min(lapCount, Math.max(1, car.lap + 1)));
        if (el.lapTotal) el.lapTotal.textContent = String(lapCount);

        if (el.currentTime) el.currentTime.textContent = formatTime(state.currentLapTime);
        if (el.bestTime) el.bestTime.textContent = car.bestLap ? formatTime(car.bestLap) : '--:--.---';
        if (el.lastDelta) {
            el.lastDelta.textContent = state.lastDelta === null ? '' : formatDelta(state.lastDelta);
            el.lastDelta.dataset.tone = state.lastDelta === null ? '' : (state.lastDelta <= 0 ? 'good' : 'bad');
        }

        const ersPct = (car.ers / 4) * 100;
        if (el.ersFill) el.ersFill.style.setProperty('--fill', (ersPct / 100).toFixed(3));
        if (el.ersValue) el.ersValue.textContent = `${Math.round(ersPct)}%`;

        if (el.tyreWear) el.tyreWear.style.setProperty('--fill', (1 - car.tyreWear).toFixed(3));
        if (el.tyreTemp) {
            const temp = Math.round(car.tyreTemp);
            el.tyreTemp.textContent = `${temp}°`;
            el.tyreTemp.dataset.state = temp < 70 ? 'cold' : temp > 118 ? 'hot' : 'ok';
        }
        if (el.tyreLabel) {
            el.tyreLabel.textContent = car.compound.label;
            el.tyreLabel.style.color = car.compound.color;
        }

        if (el.drsBadge) {
            el.drsBadge.dataset.state = drsState;
            el.drsBadge.textContent = drsState === 'open' ? 'DRS ATIVO'
                : drsState === 'ready' ? 'DRS DISPONÍVEL' : 'DRS';
        }

        if (el.sector && sector) el.sector.textContent = sector;

        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) el.message?.classList.remove('is-visible');
        }
    }

    setFps(value) {
        if (this.el.fps) this.el.fps.textContent = `${value} FPS`;
    }
}
