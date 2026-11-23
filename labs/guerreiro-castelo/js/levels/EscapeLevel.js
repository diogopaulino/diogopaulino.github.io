/**
 * Capítulo 10: Fuga do Castelo sob Saraivada de Flechas, ao amanhecer.
 *
 * O trio sai pela gruta e corre pela mata até o píer (z > 68, ~130 m: ~28 s trotando a
 * 4,6 m/s, ~20 s correndo a 6,6 m/s). Os arqueiros do adarve disparam cada um a cada 2,8 s
 * enquanto o alvo está a até 75 m; depois disso as flechas caem em arco vindas do castelo
 * (origem 30 m atrás do jogador, 12 m acima).
 * Mira: ponto à frente do jogador (velocidade × tempo de voo ≈ dist/v) + erro de ±3,5 m;
 * ângulo pela balística real (ArrowSystem.aim, g = 9,81 m/s², v = 42–48 m/s).
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=50';
import { getIsland, ISLAND_MARKS } from '../world/Island.js?v=50';
import { makeHero, giveBow } from '../characters/cast.js?v=50';

const _o = new THREE.Vector3();
const _t = new THREE.Vector3();
const _d = new THREE.Vector3();

export class EscapeLevel extends Level {
    get id() {
        return 'escape';
    }

    async build() {
        const g = this.game;
        this.island = await getIsland(g);
        g.island = this.island;
        this.group = this.island.group;
        this.island.addColliders(g.collision);
        g.stage.follow(this.island.terrain);
        this.island.doorPivot.rotation.y = -1.4;
        g.collision.removeBox(this.island.doorBox);

        this.archers = [];
        for (const [x, y, z] of this.island.castle.userData.archerSpots) {
            const hero = makeHero('archer');
            hero.object.position.set(x, y, z + 0.2);
            this.island.castle.add(hero.object);
            giveBow(hero, THREE);
            this.archers.push({ hero, anim: { mode: 'idle', upper: undefined }, t: this.archers.length * 0.3 });
        }
        this.called = false;
        this.done = false;
    }

    enter(checkpoint) {
        const g = this.game;
        const s = ISLAND_MARKS.secret;
        const h = this.island.heightAt;
        g.player.attachTo(this.group);
        g.teco.attachTo(this.group);
        g.camila.attachTo(this.group);
        const px = s.x - 3;
        g.player.spawn(px, h(px, s.z), s.z, -Math.PI / 2);
        g.teco.spawn(px - 1, h(px - 1, s.z + 1), s.z + 1);
        g.camila.spawn(px + 1.2, h(px + 1.2, s.z), s.z);
        g.camila.setShackles(false);
        g.camila.freed = true;
        g.camila.active = true;
        g.camila.ai.run();
        g.weather.apply('dawn');
        g.audio.setTheme('chase');
        g.ocean.setMode('island');
        g.ocean.visible = true;
        g.quests.set('reach_ship');
        g.hud.showObjective('Chegue ao navio', true);
        g.dialogue.say('ARQUEIRO', 'Ali estão eles! Não os deixem escapar!');
        g.input.enabled = true;
        g.player.controller.setMode('walk');
        g.cameraRig.setWorld(g.collision, null, true);
        g.cameraRig.yaw = Math.PI * 0.75;
        g.checkpoints.save('escape_start', g.story._saveBlob());
        void checkpoint;

        g.arrows.groundFn = (x, z) => Math.max(-0.3, h(x, z));
        g.arrows.onHitPlayer = () => {
            if (g.player.hurt(1)) {
                g.audio.play('hit');
                g.cameraRig.addShake(0.16, 0.25);
                g.hud.flashHurt();
                if (!g.player.alive) g.failCheckpoint('Uma flecha…');
            }
        };

        g.hud.showToast(g.hud.isTouch ? 'Corra para o píer! Botão Correr e 🛡 defende.' : 'Corra para o píer! Shift corre, Q defende.', 5);
    }

    update(dt) {
        this.time += dt;
        const g = this.game;
        const p = g.player.position;
        this.island.update(dt, this.time, g.camera, p.x, p.y, p.z);

        for (const a of this.archers) {
            a.t += dt;
            a.anim.upper = a.t < 0.35 ? 'attack' : undefined;
            a.hero.lookAt(_t.set(p.x, p.y + 1.4, p.z));
            a.hero.update(dt, a.anim);
            if (a.t > 2.8 && this.time > 3 && !this.done) {
                a.t = 0;
                a.hero.object.getWorldPosition(_o);
                _o.y += 1.5;
                let dist = Math.hypot(p.x - _o.x, p.z - _o.z);
                if (dist > 75) {
                    // longe do castelo: a flecha cai em arco, vinda de trás
                    const k = 30 / dist;
                    _o.set(p.x + (_o.x - p.x) * k, p.y + 12, p.z + (_o.z - p.z) * k);
                    dist = 30;
                }
                const speed = 42 + Math.random() * 6;
                const c = g.player.controller;
                const lead = dist / speed;
                _t.set(p.x + c.vx * lead + (Math.random() - 0.5) * 7, p.y + 1, p.z + c.vz * lead + (Math.random() - 0.5) * 7);
                g.arrows.aim(_o, _t, speed, _d);
                g.arrows.fire(_o, _d, speed);
                g.audio.play('arrow');
            }
        }

        if (p.z > 20 && !this.called) {
            this.called = true;
            g.dialogue.say('DICO', 'Não parem! O navio está logo à frente!');
            g.teco.ai.state = 'SCARED';
            g.teco.ai.timer = 0;
        }

        if (p.z > ISLAND_MARKS.reach && !this.done) {
            this.done = true;
            g.story.notify('reach_ship');
        }
    }

    exit() {
        for (const a of this.archers) {
            a.hero.object.removeFromParent();
            a.hero.dispose?.();
        }
        this.game.arrows.clear();
        this.game.arrows.onHitPlayer = null;
        super.exit();
    }
}
