/**
 * Capítulo 1 & Epílogo: Sala da Lareira em Babylon.js.
 */

import { Level } from './Level.js';
import { buildHomeInterior, addHomeColliders } from '../world/Home.js';
import { buildRavi, CharacterAnimator } from '../characters/builders.js';
import { EnvironmentFX } from '../world/Environment.js';

export class HomeLevel extends Level {
    get id() {
        return 'home';
    }

    async build() {
        const scene = this.game.scene;
        const g = buildHomeInterior(scene);
        this.group = g;
        this.fx = new EnvironmentFX();
        this.fx.addFire(g.userData.fire);
        addHomeColliders(this.game.collision);

        const ravi = buildRavi(scene);
        ravi.root.position.set(0.55, 0, 1.55);
        ravi.root.rotation.y = -0.6;
        ravi.root.parent = g;
        this.ravi = ravi;
        this.raviAnim = new CharacterAnimator(ravi.root, ravi.clips);

        const lamp = new BABYLON.PointLight('hearthPointLight', new BABYLON.Vector3(0, 1.1, -2.8), scene);
        lamp.diffuse = new BABYLON.Color3(1.0, 0.55, 0.2);
        lamp.intensity = 1.35;
        lamp.range = 8;
        lamp.parent = g;
        this.hearthLight = lamp;

        const fill = new BABYLON.PointLight('homeFillLight', new BABYLON.Vector3(1.5, 2.2, 1), scene);
        fill.diffuse = new BABYLON.Color3(1.0, 0.78, 0.62);
        fill.intensity = 0.35;
        fill.range = 10;
        fill.parent = g;

        this.obstacles = g.getChildMeshes ? g.getChildMeshes() : [];
    }

    enter(checkpoint) {
        const g = this.game;
        g.player.attachTo(this.group);
        g.teco.attachTo(this.group);
        g.teco.root.setEnabled(false);
        g.player.spawn(0.15, 0, 1.7, Math.PI);
        g.player.controller.setMode('locked');
        g.input.enabled = false;
        g.weather.apply('night');
        g.audio.setTheme('home');
        g.storm.setIntensity(0);
        g.ocean.visible = false;
        g.cameraRig.setObstacles(this.obstacles);

        if (checkpoint === 'ending') {
            this._endingBeat();
            return;
        }

        g.cutscenes.play({
            from: new BABYLON.Vector3(2.8, 1.6, 3.2),
            to: new BABYLON.Vector3(1.4, 1.45, 2.6),
            lookFrom: new BABYLON.Vector3(0, 1.1, 1.2),
            lookTo: new BABYLON.Vector3(0.2, 1.2, 1.5),
            duration: 4.2,
            onEnd: () => this._introDialogue()
        });
    }

    _introDialogue() {
        const g = this.game;
        g.dialogue.play(
            [
                { speaker: 'RAVI', text: 'Pai, conta uma história?', duration: 3.1 },
                { speaker: 'DICO', text: 'Tenho uma história muito boa.', duration: 3.2 },
                { speaker: 'RAVI', text: 'Tem aventura?', duration: 2.6 },
                { speaker: 'DICO', text: 'Tem aventura, navio, castelo e até uma princesa.', duration: 4.2 },
                { speaker: 'DICO', text: 'Tudo começou quando eu e meus amigos fomos resgatar uma princesa…', duration: 4.4 }
            ],
            () => this._intoFire()
        );
    }

    _intoFire() {
        const g = this.game;
        g.cutscenes.play({
            from: new BABYLON.Vector3(1.2, 1.4, 2.4),
            to: new BABYLON.Vector3(0.1, 0.9, -2.2),
            lookFrom: new BABYLON.Vector3(0, 1.1, 0.4),
            lookTo: new BABYLON.Vector3(0, 0.7, -3.1),
            duration: 3.6,
            onMid: () => g.hud.showChapter('A Travessia', 'rumo ao outro lado do mar'),
            onEnd: () => {
                g.audio.play('wave');
                g.fadeTo(1.4, () => {
                    g.loadStage('ship', 'ship_start');
                });
            }
        });
    }

    _endingBeat() {
        const g = this.game;
        g.player.spawn(0.15, 0, 1.7, Math.PI);
        g.player.controller.setMode('locked');
        g.teco.root.setEnabled(false);
        g.cutscenes.play({
            from: new BABYLON.Vector3(2.2, 1.5, 3),
            to: new BABYLON.Vector3(1.3, 1.4, 2.5),
            lookFrom: new BABYLON.Vector3(0.2, 1.2, 1.4),
            lookTo: new BABYLON.Vector3(0.2, 1.2, 1.5),
            duration: 2.5,
            onEnd: () => {
                g.dialogue.play(
                    [
                        { speaker: 'RAVI', text: 'E depois?', duration: 2.6 },
                        { speaker: 'DICO', text: 'Depois nós voltamos para casa.', duration: 3.4 },
                        { speaker: 'RAVI', text: 'E o Teco?', duration: 2.8 }
                    ],
                    () => this._tecoJoke()
                );
            }
        });
    }

    _tecoJoke() {
        const g = this.game;
        const shiny = this.group.userData.shiny;
        g.audio.play('click');
        if (shiny) {
            const startX = shiny.position.x;
            const startY = shiny.position.y;
            let t = 0;
            this._fly = (dt) => {
                t += dt;
                shiny.position.x = startX + t * 1.8;
                shiny.position.y = startY + Math.sin(t * 6) * 0.1 + t * 0.2;
                if (t > 1.2) {
                    shiny.setEnabled(false);
                    this._fly = null;
                    g.dialogue.say('DICO', '… Teco levou o brinquedo de novo.', 2.4);
                    setTimeout(() => g.story.notify('the_end'), 2000);
                }
            };
        } else {
            g.story.notify('the_end');
        }
    }

    update(dt) {
        this.time += dt;
        this.fx.update(this.time);
        this.raviAnim?.update(dt);
        if (this.hearthLight) {
            this.hearthLight.intensity = 1.2 + Math.sin(this.time * 9) * 0.25;
        }
        this._fly?.(dt);
    }

    exit() {
        super.exit();
        this.game.ocean.visible = true;
        this.game.player.controller.setMode('walk');
        this.game.input.enabled = true;
        this.game.teco.root.setEnabled(true);
    }
}
