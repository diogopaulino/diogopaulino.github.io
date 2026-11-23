/**
 * Capítulo 11: Zarpando e Fuga de Navio, ao amanhecer.
 *
 * prep: soltar a amarra → levantar a vela (o pano desfralda) → assumir o leme.
 * helm: 14 m/s em −Z, deriva 8·s m/s; três recifes (raio de batida 6,5 m); livre em z < −150.
 * Flechas chegam da praia (atrás, +Z) enquanto o navio está a menos de 60 m da partida.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=40';
import { buildShip, addShipColliders, updateShip, SHIP_MARKS, deckY } from '../world/Ship.js?v=40';
import { buildCastle } from '../world/Castle.js?v=40';
import { makeCrag } from '../world/Build.js?v=40';
import { makeFriend } from '../characters/cast.js?v=40';

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _l = new THREE.Vector3();

export class ShipEscapeLevel extends Level {
    get id() {
        return 'ship_escape';
    }

    async build() {
        const g = this.game;
        this.group = new THREE.Group();
        this.ship = await buildShip(g, { sails: true });
        this.ship.userData.sail.userData.set = 0;
        this.ship.userData.mooring.visible = true;
        this.group.add(this.ship);
        addShipColliders(g.collision, this.ship);

        this.friends = [];
        SHIP_MARKS.friends.forEach((s, i) => {
            const hero = makeFriend(i);
            hero.object.position.set(s.x, deckY(s.x, s.z), s.z);
            hero.object.rotation.y = s.yaw;
            this.ship.add(hero.object);
            this.friends.push({ hero, anim: { mode: 'idle' } });
        });

        const u = this.ship.userData;
        this.addInteract({
            object: u.mooringSpot,
            interactionLabel: 'Soltar amarra',
            interactionDistance: 2.6,
            interact: (_p, game) => {
                if (this.untied) return;
                this.untied = true;
                u.mooring.visible = false;
                game.audio.play('interact');
                game.story.notify('untie');
            }
        });

        this.addInteract({
            object: u.sailSpot,
            interactionLabel: 'Levantar a vela',
            interactionDistance: 3.2,
            interact: (_p, game) => {
                if (this.sail) return;
                if (!this.untied) {
                    game.dialogue.say('DICO', 'Primeiro a amarra!');
                    return;
                }
                this.sail = true;
                game.audio.play('success');
                game.story.notify('sail');
            }
        });

        this.addInteract({
            object: u.helm,
            interactionLabel: 'Assumir o leme',
            interactionDistance: 2.4,
            interact: (_p, game) => {
                if (!this.sail) {
                    game.dialogue.say('DICO', 'A vela primeiro!');
                    return;
                }
                this.beginHelm();
            }
        });

        /* Cenário fixo no mundo: recifes à frente, a ilha e o castelo ficando para trás. */
        this.world = new THREE.Group();
        this.rocks = [];
        for (const [x, z, seed] of [[-8, -55, 31], [9, -88, 32], [0, -122, 33]]) {
            const r = makeCrag(seed, { rx: 5, ry: 8, rz: 5.5, detail: 4 });
            r.position.set(x, 1.2, z);
            this.world.add(r);
            this.rocks.push(r);
        }
        const isle = makeCrag(34, { rx: 90, ry: 16, rz: 46, detail: 5, rough: 0.6 });
        isle.position.set(10, -2, 128);
        this.world.add(isle);
        const beach = makeCrag(35, { rx: 60, ry: 3, rz: 22, detail: 4, rough: 0.3, mat: 'mossy' });
        beach.position.set(-6, -1.2, 64);
        this.world.add(beach);
        const castle = await buildCastle({ door: false, detail: 0 });
        castle.position.set(14, 12, 132);
        castle.rotation.y = Math.PI;
        this.world.add(castle);
        g.scene.add(this.world);

        this.phase = 'prep';
        this.steer = 0;
        this.shipX = 0;
        this.shipZ = 0;
        this.untied = false;
        this.sail = false;
        this.arrowT = 0;
    }

    enter() {
        const g = this.game;
        const y = (x, z) => deckY(x, z);
        g.player.attachTo(this.ship);
        g.teco.attachTo(this.ship);
        g.camila.attachTo(this.ship);
        g.player.spawn(1.7, y(1.7, 1.4), 1.4, Math.PI);
        g.teco.spawn(2.2, y(2.2, 0.6), 0.6);
        g.camila.spawn(-1.8, y(-1.8, 1.8), 1.8);
        g.camila.setShackles(false);
        g.camila.active = true;
        g.camila.ai.state = 'WAIT';
        g.weather.apply('dawn', { shadowRadius: 34 });
        g.audio.setTheme('chase');
        g.ocean.setMode('calm');
        g.ocean.visible = true;
        g.quests.set('untie');
        g.input.enabled = true;
        g.player.controller.setMode('walk');
        g.cameraRig.setWorld(g.collision, this.ship, false);
        g.cameraRig.yaw = 0;
        g.cameraRig.pitch = 0.42;

        g.arrows.onHitPlayer = () => {
            if (g.player.hurt(0.5)) {
                g.audio.play('hit');
                g.cameraRig.addShake(0.1, 0.2);
                if (!g.player.alive) g.failCheckpoint('Uma flecha…');
            }
        };
        /* flechas cravam no convés */
        g.arrows.blockFn = (p) => {
            this.ship.worldToLocal(_l.copy(p));
            const d = deckY(_l.x, _l.z);
            return d !== null && _l.y < d + 0.05 && _l.y > d - 2;
        };

        g.hud.showToast('Arraste para olhar. E interage.', 4);
        g.dialogue.say('DICO', 'Soltem as amarras!');
    }

    beginHelm() {
        const g = this.game;
        this.phase = 'helm';
        g.player.controller.setMode('helm');
        const h = SHIP_MARKS.helmStand;
        g.player.spawn(h.x, deckY(h.x, h.z), h.z, Math.PI);
        g.cameraRig.override = { distance: 15, height: 4.5, pitch: 0.36 };
        g.cameraRig.yaw = 0;
        g.hud.showObjective('Saia da costa sem bater nos recifes');
        g.hud.showToast(g.hud.isTouch ? 'Incline o analógico para desviar das pedras' : 'Desvie das pedras com A / D ou ← →', 6);
        g.dialogue.say('DICO', 'Vento nas velas! Segurem-se!');
    }

    update(dt) {
        this.time += dt;
        const g = this.game;
        const wave = g.ocean.sample(this.shipX, this.shipZ);
        this.ship.position.y = wave.y * 0.8;
        this.ship.rotation.x = wave.pitch * 0.8;
        this.ship.rotation.z = wave.roll * 0.8 + this.steer * 0.05;
        this.ship.rotation.y = -this.steer * 0.12;
        this.ship.userData.helm.rotation.z = this.steer * 2.4;
        updateShip(this.ship, dt, 1.2, this.sail ? 1 : 0);

        for (const f of this.friends) {
            f.anim.mode = this.phase === 'done' ? 'cheer' : 'block';
            f.hero.update(dt, f.anim);
        }

        this.arrowT += dt;
        if (this.phase !== 'done' && this.arrowT > 0.9 && this.shipZ > -60) {
            this.arrowT = 0;
            // da praia (≈ 45 m atrás da partida) em arco sobre o convés
            _o.set((Math.random() - 0.5) * 24, 6, 46);
            _d.set(this.shipX + (Math.random() - 0.5) * 7 - _o.x, 9 + Math.random() * 5, this.shipZ + (Math.random() - 0.5) * 16 - _o.z).normalize();
            g.arrows.fire(_o, _d, 30 + Math.random() * 6);
            g.audio.play('arrow');
        }

        if (this.phase === 'helm') {
            const input = g.input;
            this.steer += input.move.x * dt * 1.5;
            if (Math.abs(input.move.x) < 0.1) this.steer *= Math.exp(-dt * 0.6);
            this.steer = Math.max(-1, Math.min(1, this.steer));
            this.shipX += this.steer * 8 * dt;
            this.shipZ -= 14 * dt;
            this.group.position.set(this.shipX, 0, this.shipZ);

            for (const r of this.rocks) {
                if (Math.hypot(this.shipX - r.position.x, this.shipZ - r.position.z) < 6.5) {
                    g.failCheckpoint('Pedras na costa…');
                    this.phase = 'dead';
                    return;
                }
            }

            if (this.shipZ < -150) {
                this.phase = 'done';
                g.player.controller.setMode('locked');
                g.story.notify('escaped');
            }
        }
    }

    exit() {
        for (const f of this.friends) f.hero.dispose?.();
        this.world.removeFromParent();
        this.world.traverse((o) => { if (o.userData?.ownGeo) o.geometry?.dispose(); });
        this.game.arrows.clear();
        this.game.arrows.onHitPlayer = null;
        super.exit();
        this.game.player.controller.setMode('walk');
    }
}
