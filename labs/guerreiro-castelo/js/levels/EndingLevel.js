/**
 * Capítulo 12: Celebração e Pôr do Sol no Mar em Babylon.js.
 */

import { Level } from './Level.js';
import { buildShip } from '../world/Ship.js';
import { buildFriend, CharacterAnimator } from '../characters/builders.js';

export class EndingLevel extends Level {
    get id() {
        return 'ending';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('endingLevelGroup', scene);
        this.ship = buildShip(scene);
        this.ship.parent = this.group;

        this.friends = [];
        for (let i = 0; i < 3; i++) {
            const f = buildFriend(scene, i);
            f.root.position.set(-1.4 + i * 1.4, 1.44, 1.2);
            f.root.parent = this.ship;
            this.friends.push(new CharacterAnimator(f.root, f.clips));
        }

        this.obstacles = this.ship.getChildMeshes ? this.ship.getChildMeshes() : [];
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.ship);
        g.teco.attachTo(this.ship);
        g.camila.attachTo(this.ship);
        g.player.spawn(0, 1.44, 4.5, 0);
        g.teco.spawn(0.8, 1.5, 3.8);
        g.camila.spawn(-0.6, 1.44, 3.6);
        g.camila.setShackles(false);
        g.camila.active = true;
        g.camila.root.setEnabled(true);
        g.player.controller.setMode('locked');
        g.weather.apply('sunset');
        g.audio.setTheme('calm');
        g.ocean.visible = true;

        g.cutscenes.play({
            from: new BABYLON.Vector3(0, 4, 14),
            to: new BABYLON.Vector3(0, 7, 24),
            lookFrom: new BABYLON.Vector3(0, 2.4, 0),
            lookTo: new BABYLON.Vector3(0, 3.4, -6),
            duration: 7.5,
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
        const wave = this.game.ocean.sample(0, 0, this.time);
        this.ship.position.y = wave.y * 0.25;
        this.ship.rotation.x = wave.pitch * 0.3;
        this.ship.rotation.z = wave.roll * 0.3;
        for (const f of this.friends) f.update(dt);
    }
}
