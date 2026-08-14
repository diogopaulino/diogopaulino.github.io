/**
 * Arsenal em first-person: M1 Garand (semi + ping) e Thompson (automático).
 */

import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp } from './utils.js';
import { buildViewGarand, buildViewThompson, buildGrenade } from './models.js';

export class Loadout {
    constructor(camera) {
        this.camera = camera;
        this.garandView = buildViewGarand();
        this.thompsonView = buildViewThompson();
        camera.add(this.garandView);
        camera.add(this.thompsonView);
        this.thompsonView.visible = false;

        this.current = 'garand';
        this.unlocked = { garand: true, thompson: false };
        this.state = {
            garand: { mag: WEAPONS.garand.magSize, reserve: WEAPONS.garand.reserve },
            thompson: { mag: WEAPONS.thompson.magSize, reserve: WEAPONS.thompson.reserve }
        };
        this.grenades = 2;
        this.cooldown = 0;
        this.reloadT = 0;
        this.fireLatch = false;
        this.sway = 0;
        this.kick = 0;
        this.grenadesInFlight = [];
    }

    reset(magBonus = 0) {
        this.current = 'garand';
        this.unlocked.thompson = false;
        this.state.garand.mag = WEAPONS.garand.magSize;
        this.state.garand.reserve = WEAPONS.garand.reserve + magBonus * 8;
        this.state.thompson.mag = WEAPONS.thompson.magSize;
        this.state.thompson.reserve = WEAPONS.thompson.reserve;
        this.grenades = 2;
        this.cooldown = 0;
        this.reloadT = 0;
        this.fireLatch = false;
        this.grenadesInFlight.length = 0;
        this._syncView();
    }

    unlockThompson() {
        this.unlocked.thompson = true;
        this.current = 'thompson';
        this._syncView();
    }

    get spec() {
        return WEAPONS[this.current];
    }

    get ammo() {
        return this.state[this.current];
    }

    get view() {
        return this.current === 'thompson' ? this.thompsonView : this.garandView;
    }

    switchTo(slot) {
        if (this.reloadT > 0) return;
        if (slot === 2 && !this.unlocked.thompson) return;
        this.current = slot === 2 ? 'thompson' : 'garand';
        this._syncView();
    }

    _syncView() {
        this.garandView.visible = this.current === 'garand';
        this.thompsonView.visible = this.current === 'thompson';
    }

    tryReload() {
        const spec = this.spec;
        const ammo = this.ammo;
        if (this.reloadT > 0 || ammo.mag >= spec.magSize || ammo.reserve <= 0) return false;
        this.reloadT = spec.reload;
        return true;
    }

    /**
     * @returns {{shot: boolean, ping: boolean, empty: boolean}}
     */
    tryFire(held) {
        const spec = this.spec;
        const ammo = this.ammo;
        if (this.reloadT > 0 || this.cooldown > 0) return { shot: false, ping: false, empty: false };
        if (ammo.mag <= 0) return { shot: false, ping: false, empty: true };

        if (!spec.auto) {
            if (!held) this.fireLatch = false;
            if (!held || this.fireLatch) return { shot: false, ping: false, empty: false };
            this.fireLatch = true;
        } else if (!held) {
            return { shot: false, ping: false, empty: false };
        }

        ammo.mag -= 1;
        this.cooldown = 60 / spec.rpm;
        this.kick = spec.recoil;
        const ping = spec.id === 'garand' && ammo.mag === 0;
        return { shot: true, ping, empty: false };
    }

    throwGrenade(origin, dir) {
        if (this.grenades <= 0) return null;
        this.grenades -= 1;
        const mesh = buildGrenade();
        mesh.position.copy(origin);
        const g = {
            mesh,
            vx: dir.x * 14,
            vy: dir.y * 14 + 4,
            vz: dir.z * 14,
            life: 2.1
        };
        this.grenadesInFlight.push(g);
        return g;
    }

    update(dt, moving, ads, heightFn) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.kick = Math.max(0, this.kick - dt * 0.12);
        this.sway += dt * (moving ? 8 : 2.2);

        if (this.reloadT > 0) {
            this.reloadT -= dt;
            if (this.reloadT <= 0) {
                const spec = this.spec;
                const ammo = this.ammo;
                const need = spec.magSize - ammo.mag;
                const take = Math.min(need, ammo.reserve);
                ammo.mag += take;
                ammo.reserve -= take;
            }
        }

        const view = this.view;
        const bobX = Math.sin(this.sway) * (moving ? 0.018 : 0.006);
        const bobY = Math.abs(Math.cos(this.sway)) * (moving ? 0.016 : 0.005);
        const adsPull = ads * 0.22;
        const reloadDip = this.reloadT > 0 ? Math.sin((1 - this.reloadT / this.spec.reload) * Math.PI) * 0.28 : 0;
        const baseX = this.current === 'thompson' ? 0.2 : 0.22;
        const baseY = this.current === 'thompson' ? -0.18 : -0.2;
        const baseZ = this.current === 'thompson' ? -0.4 : -0.42;
        view.position.set(
            baseX - adsPull + bobX,
            baseY + ads * 0.12 + bobY - this.kick * 2.4 - reloadDip,
            baseZ - ads * 0.12
        );
        view.rotation.set(
            0.04 - this.kick * 1.8 + reloadDip * 0.4,
            0.08 - ads * 0.08,
            0.02 + bobX * 0.4
        );

        for (let i = this.grenadesInFlight.length - 1; i >= 0; i--) {
            const g = this.grenadesInFlight[i];
            g.life -= dt;
            g.vy -= 18 * dt;
            g.mesh.position.x += g.vx * dt;
            g.mesh.position.y += g.vy * dt;
            g.mesh.position.z += g.vz * dt;
            g.mesh.rotation.x += dt * 6;
            const ground = heightFn
                ? heightFn(g.mesh.position.x, g.mesh.position.z)
                : 0;
            if (g.mesh.position.y < ground + 0.2) {
                g.mesh.position.y = ground + 0.2;
                g.vx *= 0.4;
                g.vz *= 0.4;
                g.vy *= -0.25;
            }
            if (g.life <= 0) {
                g.explode = true;
            }
        }
    }

    popExploded() {
        const done = [];
        for (let i = this.grenadesInFlight.length - 1; i >= 0; i--) {
            if (this.grenadesInFlight[i].explode) {
                done.push(this.grenadesInFlight.splice(i, 1)[0]);
            }
        }
        return done;
    }

    spread(ads) {
        const spec = this.spec;
        return lerp(spec.spread, spec.adsSpread, ads);
    }
}

function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}
