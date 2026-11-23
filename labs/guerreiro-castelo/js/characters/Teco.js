/**
 * Companheiro Teco (macaco): `createCreature('monkey')` + IA de acompanhamento.
 * Os nomes de animação do jogo viram modos da criatura:
 *   Idle→idle · Walk→walk · Run→run · Climb→run (o corpo inclina para a subida)
 *   Shoulder→sit · Grab→eat · Scared→alert · Celebrate→roar
 */

import * as THREE from 'three';
import { createCreature } from './cast.js?v=50';
import { MonkeyAI } from '../ai/MonkeyAI.js?v=50';
import { angleDamp, damp } from '../utils/math.js?v=50';

const MODE = { Idle: 'idle', Walk: 'walk', Run: 'run', Climb: 'run', Shoulder: 'sit', Grab: 'eat', Scared: 'alert', Celebrate: 'roar' };

export class Teco {
    constructor() {
        this.creature = createCreature('monkey', { detail: 2, scale: 1.05, seed: 4 });
        this.root = this.creature.object;
        this.root.userData.keep = true;
        this.position = new THREE.Vector3(0, 0, 0);
        this.facing = 0;
        this.ai = new MonkeyAI(this);
        this.onShoulder = false;
        this.visible = true;
        this.clip = 'Idle';
        this.climbTilt = 0;
        this.anim = { mode: 'idle', speed: 0 };
        this._last = new THREE.Vector3();
    }

    spawn(x, y, z) {
        this.position.set(x, y, z);
        this._last.copy(this.position);
        this.root.position.copy(this.position);
        this.ai.reset();
    }

    attachTo(parent) {
        parent.add(this.root);
    }

    play(name) {
        this.clip = name;
    }

    update(dt, game) {
        this.game = game;
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 10, dt);
        this.root.position.copy(this.position);
        // subindo: inclina o corpo pela razão vertical/horizontal do deslocamento
        const dy = this.position.y - this._last.y;
        const dh = Math.hypot(this.position.x - this._last.x, this.position.z - this._last.z);
        const tilt = this.clip === 'Climb' ? -Math.atan2(dy, dh + 1e-4) * 0.8 : 0;
        this.climbTilt = damp(this.climbTilt, tilt, 10, dt);
        this.root.rotation.set(this.climbTilt, this.facing, 0, 'YXZ');
        const a = this.anim;
        a.mode = MODE[this.clip] || 'idle';
        a.speed = dt > 0 ? Math.hypot(dh, dy) / dt : 0;
        this.root.visible = this.visible;
        if (this.visible) this.creature.update(dt, a);
        this._last.copy(this.position);
    }
}
