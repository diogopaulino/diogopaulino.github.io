/**
 * Tigre do castelo: `createCreature('tiger')` + TigerAI.
 * Animações do jogo → modos da criatura: Sleep→sleep · Idle→alert · Growl→roar ·
 * Walk→walk · Jump→attack (o jogo sobe a raiz em Y).
 */

import * as THREE from 'three';
import { createCreature } from './cast.js?v=40';
import { TigerAI } from '../ai/TigerAI.js?v=40';
import { angleDamp } from '../utils/math.js';

const MODE = { Sleep: 'sleep', Idle: 'alert', Growl: 'roar', Walk: 'walk', Jump: 'attack', Attack: 'attack' };

export class Tiger {
    constructor(parent) {
        this.creature = createCreature('tiger', { detail: 2, seed: 2 });
        this.root = this.creature.object;
        parent.add(this.root);
        this.position = new THREE.Vector3(0, 0, 0);
        this.facing = 0;
        this.clip = 'Sleep';
        /* compatível com o código antigo: tiger.animator.play('Walk') */
        this.animator = { play: (name) => { this.clip = name; } };
        this.ai = new TigerAI(this);
        this.anim = { mode: 'sleep', speed: 0, lookAt: null };
        this.look = new THREE.Vector3();
    }

    spawn(x, y, z, yaw = 0) {
        this.position.set(x, y, z);
        this.facing = yaw;
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
        this.ai.reset();
    }

    update(dt, game) {
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing ?? this.facing, 6, dt);
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
        const a = this.anim;
        a.mode = MODE[this.clip] || 'idle';
        a.speed = this.clip === 'Walk' ? 2.2 : 0;
        a.lookAt = this.ai.lookTarget ? this.ai.lookTarget.getWorldPosition(this.look).setY(this.look.y + 0.8) : null;
        this.creature.update(dt, a);
    }
}
