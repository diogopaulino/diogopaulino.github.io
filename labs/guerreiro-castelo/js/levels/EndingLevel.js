/**
 * Capítulo 12: Celebração e Pôr do Sol no Mar.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=50';
import { buildShip, updateShip, SHIP_MARKS, deckY } from '../world/Ship.js?v=50';
import { makeFriend } from '../characters/cast.js?v=50';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class EndingLevel extends Level {
    get id() {
        return 'ending';
    }

    async build() {
        this.group = new THREE.Group();
        this.ship = await buildShip(this.game, { props: true });
        this.group.add(this.ship);
        /* proa para o poente */
        this.group.rotation.y = -1.25;

        this.friends = [];
        SHIP_MARKS.friends.forEach((s, i) => {
            const hero = makeFriend(i);
            const x = -1.6 + i * 1.5;
            hero.object.position.set(x, deckY(x, 2.4), 2.4);
            hero.object.rotation.y = Math.PI;
            this.ship.add(hero.object);
            this.friends.push({ hero, anim: { mode: 'cheer' } });
        });
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.ship);
        g.teco.attachTo(this.ship);
        g.camila.attachTo(this.ship);
        const y = deckY(0, -7);
        g.player.spawn(0.5, y, -7.2, Math.PI);
        g.teco.spawn(1.4, y, -7.6);
        g.teco.ai.state = 'SCRIPT';
        g.camila.spawn(-0.5, y, -7.1);
        g.camila.setShackles(false);
        g.camila.active = true;
        g.camila.ai.state = 'HOLD';
        g.player.controller.setMode('locked');
        g.input.enabled = false;
        g.weather.apply('sunset');
        g.audio.setTheme('calm');
        g.ocean.setMode('calm');
        g.ocean.visible = true;
        g.cameraRig.setWorld(g.collision, this.ship, false);
        g.hud.showObjective('Você escapou');

        // câmera em coordenadas de mundo: o grupo está girado −1,25 rad (proa ≈ oeste)
        const w = (x, yy, z) => this.group.localToWorld(V(x, yy, z));
        g.cutscenes.play({
            from: w(5, y + 2.2, -1),
            to: w(9, y + 5, 12),
            lookFrom: w(0, y + 1.4, -7),
            lookTo: w(0, y + 2.5, -9),
            duration: 11,
            midAt: 0.08,
            onMid: () => {
                g.dialogue.play([
                    { speaker: 'CAMILA', text: 'Obrigada, guerreiro. Achei que nunca mais veria o pôr do sol assim.', duration: 4.2 },
                    { speaker: 'DICO', text: 'Nós sempre cumprimos uma promessa.', duration: 3.6 },
                    { speaker: 'TECO', text: '*Teco pula no mastro e comemora*', duration: 3.2 }
                ]);
            },
            onEnd: () => {
                g.fadeTo(1.6, () => {
                    g.loadStage('home', 'ending');
                });
            }
        });
    }

    update(dt) {
        this.time += dt;
        const g = this.game;
        const wave = g.ocean.sample(0, 0);
        this.ship.position.y = wave.y * 0.8;
        this.ship.rotation.x = wave.pitch * 0.7;
        this.ship.rotation.z = wave.roll * 0.7;
        updateShip(this.ship, dt, 1, 1);
        g.teco.play('Celebrate');
        g.camila.ai.facing = Math.PI;
        for (const f of this.friends) f.hero.update(dt, f.anim);
    }

    exit() {
        for (const f of this.friends) f.hero.dispose?.();
        super.exit();
        this.game.input.enabled = true;
    }
}
