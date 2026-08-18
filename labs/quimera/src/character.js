/**
 * Monta o boneco a partir das três peças e cuida do idle.
 *
 * Regras de encaixe (ver LAYOUT em config.js):
 *   cabeça.position.y = HEAD_Y
 *   corpo permanece com os pés em y = 0
 *   acessório: grip | shoulder | back
 *
 * Idle:
 *   respiração  y = 1 + 0.016 * sin(t * 1.7)
 *   piscar      a cada 3–5 s, pálpebra scale.y → 0.08 por 120 ms
 *   asas        flap sin(t * 4)
 */

import * as THREE from 'three';
import { LAYOUT, KIT_BY_ID } from './config.js';
import { buildHead } from './heads.js';
import { buildBody } from './bodies.js';
import { buildAccessory } from './accessories.js';

const ATTACH = {
    grip: LAYOUT.GRIP,
    shoulder: LAYOUT.SHOULDER_L,
    back: LAYOUT.BACK
};

export class Character {
    constructor() {
        this.root = new THREE.Group();
        this.root.name = 'quimera';
        this.headAnchor = new THREE.Group();
        this.bodyAnchor = new THREE.Group();
        this.accAnchor = new THREE.Group();
        this.root.add(this.bodyAnchor, this.headAnchor, this.accAnchor);
        this.cache = { head: {}, body: {}, accessory: {} };
        this.ids = { head: 'pirate', body: 'pirate', accessory: 'pirate' };
        this.blinkT = 2.8;
        this.blinking = 0;
        this.bounce = { head: 1, body: 1, accessory: 1 };
        this._head = null;
        this._body = null;
        this._acc = null;
    }

    _part(slot, id) {
        const kit = KIT_BY_ID[id];
        if (!this.cache[slot][id]) {
            const built = slot === 'head'
                ? buildHead(kit)
                : slot === 'body'
                    ? buildBody(kit)
                    : buildAccessory(kit);
            this.cache[slot][id] = built;
        }
        return this.cache[slot][id];
    }

    setMix(ids, { bounce = true } = {}) {
        this.ids = { ...ids };
        this._setSlot('body', ids.body, bounce);
        this._setSlot('head', ids.head, bounce);
        this._setSlot('accessory', ids.accessory, bounce);
        this._placeAccessory();
    }

    _setSlot(slot, id, bounce) {
        const next = this._part(slot, id);
        const anchor = slot === 'head'
            ? this.headAnchor
            : slot === 'body'
                ? this.bodyAnchor
                : this.accAnchor;

        while (anchor.children.length) {
            anchor.remove(anchor.children[0]);
        }
        anchor.add(next);

        if (slot === 'head') {
            next.position.set(0, 0, 0);
            this.headAnchor.position.set(0, LAYOUT.HEAD_Y, 0);
            this._head = next;
        } else if (slot === 'body') {
            next.position.set(0, 0, 0);
            this._body = next;
        } else {
            this._acc = next;
        }

        if (bounce) this.bounce[slot] = 0.12;
    }

    _placeAccessory() {
        if (!this._acc) return;
        const attach = this._acc.userData.attach || 'grip';
        const pos = ATTACH[attach] || ATTACH.grip;
        this.accAnchor.position.set(pos[0], pos[1], pos[2]);
        this._accBaseY = pos[1];
        this.accAnchor.rotation.set(0, 0, 0);
        if (attach === 'grip') this.accAnchor.rotation.set(0.15, 0.4, 0.2);
        if (attach === 'back') this.accAnchor.rotation.set(0.1, 0.2, 0);
    }

    update(dt, t) {
        const breath = Math.sin(t * 1.7) * 0.016;
        this.bodyAnchor.scale.set(1, 1 + breath, 1);
        this.headAnchor.position.y = LAYOUT.HEAD_Y + breath * 0.7;
        this.headAnchor.rotation.z = Math.sin(t * 0.7) * 0.04;
        this.headAnchor.rotation.y = Math.sin(t * 0.35) * 0.08;

        this.blinkT -= dt;
        if (this.blinkT <= 0) {
            this.blinking = 0.12;
            this.blinkT = 2.6 + Math.random() * 2.4;
        }
        if (this.blinking > 0) {
            this.blinking -= dt;
            this._setLids(this.blinking > 0.05 ? 1 : 0.12);
        } else {
            this._setLids(0.12);
        }

        const wings = this._body?.userData.wings;
        if (wings) {
            const flap = Math.sin(t * 4.2) * 0.22;
            wings.forEach((w, i) => {
                w.rotation.z = (i % 2 === 0 ? 0.4 : -0.4) + flap * (i < 2 ? 1 : 0.6);
            });
        }

        this.accAnchor.rotation.z = Math.sin(t * 1.3) * 0.08;
        this.accAnchor.position.y = (this._accBaseY || LAYOUT.GRIP[1]) + Math.sin(t * 1.9) * 0.02;

        for (const slot of ['head', 'body', 'accessory']) {
            const b = this.bounce[slot];
            if (b < 1) {
                this.bounce[slot] = Math.min(1, b + dt * 3.2);
                const e = easeOutBack(this.bounce[slot]);
                const anchor = slot === 'head'
                    ? this.headAnchor
                    : slot === 'body'
                        ? this.bodyAnchor
                        : this.accAnchor;
                const y = slot === 'body' ? 1 + breath : e;
                anchor.scale.set(e, y, e);
            }
        }
    }

    _setLids(sy) {
        const lids = this._head?.userData.lids;
        if (!lids) return;
        lids.forEach((lid) => {
            lid.scale.y = sy;
        });
    }
}

function easeOutBack(x) {
    const c = 1.70158;
    const x1 = x - 1;
    return 1 + (c + 1) * x1 * x1 * x1 + c * x1 * x1;
}
