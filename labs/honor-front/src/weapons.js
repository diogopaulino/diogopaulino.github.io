/**
 * Arsenal em first-person para Honor Front em Babylon.js.
 * M1 Garand (semi-automático + ping característico) e Thompson SMG.
 */

import { WEAPONS } from './config.js';
import { buildViewGarand, buildViewThompson } from './models.js';

export class Loadout {
    constructor(BABYLON, camera, scene) {
        this.BABYLON = BABYLON;
        this.camera = camera;
        this.scene = scene;

        this.garandView = buildViewGarand(BABYLON, scene);
        this.thompsonView = buildViewThompson(BABYLON, scene);

        this.garandView.parent = camera;
        this.thompsonView.parent = camera;

        this.thompsonView.setEnabled(false);

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
        this.recoilZ = 0;
        this.recoilRotX = 0;
    }

    reset() {
        this.current = 'garand';
        this.unlocked.thompson = false;
        this.state.garand.mag = WEAPONS.garand.magSize;
        this.state.garand.reserve = WEAPONS.garand.reserve;
        this.state.thompson.mag = WEAPONS.thompson.magSize;
        this.state.thompson.reserve = WEAPONS.thompson.reserve;
        this.grenades = 2;
        this.cooldown = 0;
        this.reloadT = 0;
        this.fireLatch = false;
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

    get activeView() {
        return this.current === 'thompson' ? this.thompsonView : this.garandView;
    }

    switchTo(slot) {
        if (this.reloadT > 0) return;
        if (slot === 2 && !this.unlocked.thompson) return;
        this.current = slot === 2 ? 'thompson' : 'garand';
        this._syncView();
    }

    _syncView() {
        this.garandView.setEnabled(this.current === 'garand');
        this.thompsonView.setEnabled(this.current === 'thompson');
    }

    tryReload() {
        const spec = this.spec;
        const ammo = this.ammo;
        if (this.reloadT > 0 || ammo.mag >= spec.magSize || ammo.reserve <= 0) return false;
        this.reloadT = spec.reload;
        return true;
    }

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
        this.cooldown = spec.cooldown;
        this.recoilZ = 0.08;
        this.recoilRotX = 0.12;

        const ping = this.current === 'garand' && ammo.mag === 0;
        return { shot: true, ping, empty: false };
    }

    releaseTrigger() {
        this.fireLatch = false;
    }

    update(dt) {
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

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

        // Amortecimento de recuo
        this.recoilZ = Math.max(0, this.recoilZ - dt * 0.8);
        this.recoilRotX = Math.max(0, this.recoilRotX - dt * 1.2);

        const v = this.activeView;
        if (v) {
            v.position.z = -this.recoilZ;
            v.rotation.x = -this.recoilRotX;
        }
    }
}
