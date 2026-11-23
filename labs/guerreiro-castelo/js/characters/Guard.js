/**
 * Guarda do castelo: `createHero` (preset guard) + GuardAI + cone de visão visível.
 * Animação: golpe pela fase do swing da IA (antecipação legível), 'hit' ao cambalear.
 *
 * O cone é um setor de círculo no chão (raio = alcance da visão, abertura = ±ângulo),
 * filho do guarda, que muda de cor com o alerta: verde (calmo) → âmbar → vermelho.
 */

import * as THREE from 'three';
import { makeHero } from './cast.js?v=50';
import { GuardAI } from '../ai/GuardAI.js?v=50';
import { angleDamp } from '../utils/math.js?v=50';

const CALM = new THREE.Color(0x7ad0a0);
const WARN = new THREE.Color(0xffc24a);
const HOT = new THREE.Color(0xff4a2a);

export class Guard {
    constructor(parent, opts = {}) {
        this.hero = makeHero(opts.fat ? 'fatGuard' : 'guard');
        this.root = this.hero.object;
        parent.add(this.root);

        this.position = new THREE.Vector3(0, 0, 0);
        this.facing = 0;
        this.speed = 0;
        this.health = opts.health || 2;
        this.alive = true;
        this.hasKeys = Boolean(opts.fat);
        this.ai = new GuardAI(this, opts);
        this.anim = { mode: 'idle', speed: 0, phase: undefined, blink: 0 };
        this.swingT = 0;
        this.dieT = 0;
        if (!opts.sleep) this.hero.equip({ handR: 'sword' });

        // setor do cone: centro na origem, aberto para +Z (a frente do herói)
        const a = this.ai.viewAngle;
        const geo = new THREE.CircleGeometry(this.ai.viewDist, 28, Math.PI / 2 - a, a * 2);
        geo.rotateX(-Math.PI / 2);
        this.coneMat = new THREE.MeshBasicMaterial({
            color: CALM.clone(), transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
        });
        this.cone = new THREE.Mesh(geo, this.coneMat);
        this.cone.position.y = 0.06;
        this.cone.renderOrder = 3;
        this.cone.userData.ownGeo = true;
        this.root.add(this.cone);
    }

    spawn(x, y, z, yaw = 0) {
        this.position.set(x, y, z);
        this.facing = yaw;
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
        this.ai.home.x = x;
        this.ai.home.y = y;
        this.ai.home.z = z;
        this.ai.facing = yaw;
    }

    /** Golpe de Dico vindo de (fromX, fromZ): dano, empurrão de `push` m/s e cambaleio. */
    takeHit(amount = 1, fromX = this.position.x, fromZ = this.position.z - 1, push = 3.8, game = null) {
        if (!this.alive) return;
        this.health -= amount;
        /* dorminhoco acordado na marra: passa a ser guarda de verdade */
        if (this.ai.state === 'SLEEP') this.ai.sleep = false;
        this.ai.stagger(fromX, fromZ, push);
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            this.dieT = 0;
            this.cone.visible = false;
            game?.hud?.showToast('Guarda nocauteado', 2);
        }
    }

    update(dt, game) {
        const a = this.anim;
        a.phase = undefined;
        a.blink = 0;
        if (!this.alive) {
            // nocauteado: escorrega com o empurrão, cai e fica no chão (sem sangue)
            this.dieT += dt;
            const k = Math.exp(-7 * dt);
            this.ai.kvx *= k;
            this.ai.kvz *= k;
            this.ai._slide(game, dt);
            this.root.position.copy(this.position);
            a.mode = 'die';
            this.hero.update(dt, a);
            return;
        }
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 8, dt);
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;

        const st = this.ai.state;
        a.speed = this.speed;
        if (st === 'SLEEP') {
            a.mode = 'sit';
            a.blink = 1;
        } else if (st === 'STAGGER') {
            a.mode = 'hit';
            a.phase = Math.min(1, this.ai.timer / 0.45);
        } else if (st === 'ATTACK') {
            /* fase do golpe = tempo desde o início / 0,9 s → o corte (fase 0,3–0,5 do herói)
               cai em ~0,27–0,45 s, junto do impacto da IA (0,42 s) */
            const sw = this.ai.swingT;
            a.mode = sw >= 0 ? 'attack' : 'block';
            if (sw >= 0) a.phase = Math.min(1, sw / 0.9);
        } else if (this.speed > 2.5) a.mode = 'run';
        else if (this.speed > 0.2) a.mode = 'walk';
        else a.mode = 'idle';
        this.hero.update(dt, a);

        // cone: some com o guarda dormindo; cor pelo alerta
        const k = this.ai.alert;
        this.cone.visible = st !== 'SLEEP';
        if (k < 0.5) this.coneMat.color.copy(CALM).lerp(WARN, k * 2);
        else this.coneMat.color.copy(WARN).lerp(HOT, Math.min(1, (k - 0.5) * 2));
        this.coneMat.opacity = 0.05 + 0.1 * Math.min(1, k);
    }
}
