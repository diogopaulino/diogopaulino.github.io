/**
 * Princesa Camila: `createHero` (preset princess) + grilhões de ferro nos pulsos.
 */

import * as THREE from 'three';
import { makeHero } from './cast.js?v=50';
import { PrincessAI } from '../ai/PrincessAI.js?v=50';
import { angleDamp } from '../utils/math.js?v=50';
import { mat } from '../world/Build.js?v=50';

export class Camila {
    constructor() {
        this.hero = makeHero('camila');
        this.root = this.hero.object;
        this.root.userData.keep = true;
        this.root.visible = false;
        this.position = new THREE.Vector3(0, 0, 0);
        this.facing = 0;
        this.speed = 0;
        this.active = false;
        this.freed = false;
        this.ai = new PrincessAI(this);
        this.anim = { mode: 'idle', speed: 0 };
        this.talkT = 0;

        /* Grilhões: argola em cada pulso e três elos pendentes (toros de ferro). */
        this.shackles = [];
        const ring = new THREE.TorusGeometry(0.05, 0.012, 8, 16);
        const link = new THREE.TorusGeometry(0.022, 0.007, 6, 12);
        for (const socket of ['handL', 'handR']) {
            const g = new THREE.Group();
            const cuff = new THREE.Mesh(ring, mat('iron'));
            cuff.rotation.y = Math.PI / 2;
            cuff.position.x = socket === 'handL' ? 0.07 : -0.07;
            g.add(cuff);
            for (let i = 0; i < 4; i++) {
                const l = new THREE.Mesh(link, mat('iron'));
                l.position.set(cuff.position.x, -0.06 - i * 0.036, 0);
                l.rotation.y = i % 2 ? Math.PI / 2 : 0;
                g.add(l);
            }
            g.traverse((o) => { o.castShadow = true; });
            this.hero.attach(socket, g, {});
            this.shackles.push(g);
        }
        this.hero.guardL = false;
    }

    spawn(x, y, z) {
        this.position.set(x, y, z);
        this.root.position.copy(this.position);
        this.ai.reset();
    }

    attachTo(parent) {
        parent.add(this.root);
    }

    setShackles(on) {
        for (const s of this.shackles) s.visible = on;
    }

    update(dt, game) {
        this.root.visible = this.active;
        if (!this.active) return;
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 10, dt);
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;

        this.talkT = Math.max(0, this.talkT - dt);
        const a = this.anim;
        a.speed = this.speed;
        if (this.speed > 4.5) a.mode = 'run';
        else if (this.speed > 0.2) a.mode = 'walk';
        else a.mode = game.dialogue.current?.speaker === 'CAMILA' ? 'talk' : 'idle';
        this.hero.update(dt, a);
    }
}
