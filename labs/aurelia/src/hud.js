/** HUD estilo Forza: cluster analógico, eventos, rádio e minimapa. */

import { CARS, SKIES, RADIO, EVENTS, CAMERAS } from './config.js';
import { formatSpeed, formatTime } from './utils.js';

export class Hud {
    constructor(doc) {
        this.doc = doc;
        this.needle = doc.querySelector('#tachNeedle');
        this.speed = doc.querySelector('#speedValue');
        this.gear = doc.querySelector('#gearValue');
        this.rpm = doc.querySelector('#rpmValue');
        this.eventName = doc.querySelector('#eventName');
        this.eventScore = doc.querySelector('#eventScore');
        this.stars = doc.querySelector('#eventStars');
        this.radioName = doc.querySelector('#radioName');
        this.radioTag = doc.querySelector('#radioTag');
        this.cameraLabel = doc.querySelector('#cameraLabel');
        this.fps = doc.querySelector('#fpsCounter');
        this.message = doc.querySelector('#raceMessage');
        this.minimap = doc.querySelector('#minimap');
        this.miniCtx = this.minimap?.getContext('2d');
        this.carName = doc.querySelector('#hudCarName');
        this.skyName = doc.querySelector('#hudSkyName');
        this.boostFill = doc.querySelector('#boostFill');
        this.driftBadge = doc.querySelector('#driftBadge');
        this.scoreValue = doc.querySelector('#scoreValue');
        this.msgTimer = 0;
        this.flash = 0;
    }

    setCar(spec) {
        if (this.carName) this.carName.textContent = spec.name;
    }

    setSky(id) {
        if (this.skyName) this.skyName.textContent = SKIES[id]?.name || id;
    }

    setRadio(station) {
        if (this.radioName) this.radioName.textContent = station.name;
        if (this.radioTag) this.radioTag.textContent = station.tag;
    }

    setCamera(id) {
        const cam = CAMERAS.find((c) => c.id === id);
        if (this.cameraLabel) this.cameraLabel.textContent = cam?.name || id;
    }

    toast(text, time = 2.4) {
        if (!this.message) return;
        this.message.textContent = text;
        this.message.dataset.show = 'true';
        this.msgTimer = time;
    }

    update(dt, vehicle, extras) {
        if (this.msgTimer > 0) {
            this.msgTimer -= dt;
            if (this.msgTimer <= 0 && this.message) this.message.dataset.show = 'false';
        }

        const kmh = formatSpeed(vehicle.speed);
        if (this.speed) this.speed.textContent = String(kmh).padStart(3, '0');
        if (this.gear) this.gear.textContent = vehicle.speed < 1.2 && vehicle.throttle < 0.1 ? 'N' : String(vehicle.gear);
        if (this.rpm) this.rpm.textContent = `${Math.round(vehicle.rpm / 100) * 100}`;

        const spec = vehicle.spec;
        const rpmT = (vehicle.rpm - spec.idle) / (spec.redline - spec.idle);
        if (this.needle) {
            const angle = -120 + rpmT * 240;
            this.needle.style.transform = `rotate(${angle}deg)`;
        }

        if (this.boostFill) this.boostFill.style.width = `${Math.round(vehicle.boost * 100)}%`;
        if (this.scoreValue) this.scoreValue.textContent = Math.round(extras.score || 0).toLocaleString('pt-BR');

        if (this.driftBadge) {
            const drifting = vehicle.slip > 0.22 && vehicle.speed > 10;
            this.driftBadge.dataset.active = drifting ? 'true' : 'false';
            if (drifting) {
                this.driftBadge.textContent = `${Math.round(vehicle.driftChain * 10) / 10}s  ·  ${Math.round(vehicle.driftScore)}`;
            }
        }

        if (extras.event) {
            if (this.eventName) this.eventName.textContent = extras.event.name;
            if (this.eventScore) {
                this.eventScore.textContent = extras.event.kind === 'speed'
                    ? `${formatSpeed(extras.event.peak || 0)} km/h`
                    : `${Math.round(extras.event.points || 0)} pts`;
            }
            if (this.stars) {
                const s = extras.event.starsEarned || 0;
                this.stars.textContent = '★'.repeat(s) + '☆'.repeat(Math.max(0, 3 - s));
            }
        } else {
            if (this.eventName) this.eventName.textContent = 'Festival livre';
            if (this.eventScore) this.eventScore.textContent = 'explore a costa';
            if (this.stars) this.stars.textContent = '☆☆☆';
        }

        if (this.fps && extras.fps) this.fps.textContent = `${extras.fps} fps`;
        this.drawMinimap(vehicle, extras.road, extras.traffic);
    }

    drawMinimap(vehicle, road, traffic) {
        const ctx = this.miniCtx;
        const canvas = this.minimap;
        if (!ctx || !canvas || !road) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(8,10,16,0.55)';
        ctx.fillRect(0, 0, w, h);

        const pad = 12;
        const sx = (w - pad * 2) / (road.maxX - road.minX);
        const sz = (h - pad * 2) / (road.maxZ - road.minZ);
        const s = Math.min(sx, sz);
        const mapX = (x) => pad + (x - road.minX) * s;
        const mapZ = (z) => h - pad - (z - road.minZ) * s;

        ctx.strokeStyle = 'rgba(255,180,90,0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i < road.count; i += 2) {
            const x = mapX(road.cx[i]);
            const z = mapZ(road.cz[i]);
            if (i === 0) ctx.moveTo(x, z);
            else ctx.lineTo(x, z);
        }
        ctx.closePath();
        ctx.stroke();

        if (traffic) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            for (const car of traffic.cars) {
                ctx.beginPath();
                ctx.arc(mapX(car.position.x), mapZ(car.position.z), 2.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.fillStyle = '#ff6b2c';
        ctx.beginPath();
        ctx.arc(mapX(vehicle.position.x), mapZ(vehicle.position.z), 3.4, 0, Math.PI * 2);
        ctx.fill();
    }

    populateMenu() {
        const carList = this.doc.querySelector('#carList');
        if (carList && !carList.dataset.ready) {
            carList.dataset.ready = '1';
            carList.innerHTML = CARS.map((car) => `
                <button type="button" class="option-card" data-car="${car.id}">
                    <span class="option-class">${car.class}</span>
                    <strong>${car.name}</strong>
                    <span class="option-meta">${car.maker} · ${car.year}</span>
                    <span class="option-power">${Math.round(car.power / 1000)} kW</span>
                </button>
            `).join('');
        }
        const skyList = this.doc.querySelector('#skyList');
        if (skyList && !skyList.dataset.ready) {
            skyList.dataset.ready = '1';
            skyList.innerHTML = Object.values(SKIES).map((sky) => `
                <button type="button" class="chip" data-sky="${sky.id}">
                    ${sky.name}
                </button>
            `).join('');
        }
    }
}

export { CARS, RADIO, EVENTS };
