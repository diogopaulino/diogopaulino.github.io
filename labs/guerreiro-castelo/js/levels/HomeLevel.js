/**
 * Capítulo 1 & Epílogo: Sala da Lareira.
 * Dico conta a história ao filho Ravi diante do fogo; a câmera mergulha nas chamas e a
 * aventura começa. No epílogo a cena volta para cá (e Teco leva o brinquedo de novo).
 * Com checkpoint 'menu' a sala serve de fundo vivo para o menu principal.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=50';
import { buildHomeInterior, addHomeColliders, HOME_MARKS } from '../world/Home.js?v=50';
import { EnvironmentFX } from '../world/Environment.js?v=50';
import { makeHero } from '../characters/cast.js?v=50';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class HomeLevel extends Level {
    get id() {
        return 'home';
    }

    async build() {
        const g = await buildHomeInterior(this.game);
        this.group = g;
        this.fx = new EnvironmentFX();
        this.fx.addFire(g.userData.fire);
        addHomeColliders(this.game.collision);

        this.ravi = makeHero('ravi');
        const r = HOME_MARKS.ravi;
        this.ravi.object.position.set(r.x, 0, r.z);
        this.ravi.object.rotation.y = r.yaw;
        g.add(this.ravi.object);
        this.raviAnim = { mode: 'sit', upper: undefined };
        this.look = V(0, 0, 0);
    }

    enter(checkpoint) {
        const g = this.game;
        const d = HOME_MARKS.dico;
        g.player.attachTo(this.group);
        g.teco.attachTo(this.group);
        g.teco.visible = false;
        g.teco.root.visible = false;
        g.player.spawn(d.x, 0, d.z, d.yaw);
        g.player.pose = { mode: 'sit' };
        g.player.setArmed(false);
        g.player.controller.setMode('locked');
        g.input.enabled = false;
        g.weather.apply('night');
        g.storm.setIntensity(0);
        g.ocean.visible = false;
        g.cameraRig.setWorld(g.collision, null, true);
        g.hud.showStealth(false);

        if (checkpoint === 'menu') {
            this.menuCam = true;
            g.cameraRig.cutscene = true;
            return;
        }
        g.audio.setTheme('home');
        g.hud.showObjective('Ouça a história');

        if (checkpoint === 'ending') {
            this._endingBeat();
            return;
        }

        g.cutscenes.play({
            from: V(-2.4, 1.9, 2.9),
            to: V(-0.5, 1.25, 1.35),
            lookFrom: V(0.2, 0.9, -1.6),
            lookTo: V(0.15, 0.95, -1.5),
            duration: 4.6,
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
        const f = HOME_MARKS.fire;
        g.cutscenes.play({
            from: V(-0.5, 1.25, 1.35),
            to: V(f.x, 0.62, f.z + 0.75),
            lookFrom: V(0.15, 0.95, -1.5),
            lookTo: V(f.x, 0.5, f.z),
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
        g.cutscenes.play({
            from: V(-2.2, 1.7, 2.4),
            to: V(-0.9, 1.3, 1.2),
            lookFrom: V(0.2, 0.9, -1.4),
            lookTo: V(0.1, 0.85, -1.3),
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
            /* Teco aparece, pega o cavalinho e sai correndo pela sala. */
            const teco = g.teco;
            teco.visible = true;
            teco.ai.state = 'SCRIPT';
            const startX = shiny.position.x;
            let t = 0;
            this._fly = (dt) => {
                t += dt;
                const x = startX - 2.4 + Math.min(t, 1.2) * 2 + Math.max(0, t - 1.2) * 3.2;
                teco.position.set(x, 0, shiny.position.z + 0.15);
                teco.ai.facing = Math.PI / 2;
                teco.play('Run');
                if (t > 1.2) {
                    shiny.position.x = x + 0.25;
                    shiny.position.y = 0.3 + Math.sin(t * 14) * 0.03;
                }
                if (t > 2.3) {
                    shiny.visible = false;
                    teco.visible = false;
                    this._fly = null;
                    g.dialogue.say('DICO', '… Teco levou o brinquedo de novo.', 2.4);
                    /* só fecha a história se ninguém saiu para o menu nesse meio-tempo */
                    setTimeout(() => { if (g.level === this && g.running) g.story.notify('the_end'); }, 2400);
                }
            };
        } else {
            g.story.notify('the_end');
        }
    }

    update(dt) {
        this.time += dt;
        const g = this.game;
        this.fx.update(this.time);
        // quem fala gesticula; o outro escuta olhando para quem fala
        const who = g.dialogue.current?.speaker;
        this.raviAnim.upper = who === 'RAVI' ? 'talk' : undefined;
        if (g.player.pose) g.player.pose.upper = who === 'DICO' ? 'talk' : undefined;
        this.ravi.lookAt(g.player.root.getWorldPosition(this.look).setY(1.25));
        this.ravi.update(dt, this.raviAnim);
        if (this.menuCam) {
            const a = this.time * 0.07;
            g.cameraRig.setCutscenePose(
                this.look.set(-1.6 + Math.sin(a) * 0.9, 1.5 + Math.sin(a * 1.7) * 0.12, 2.3 + Math.cos(a) * 0.5),
                _look.set(0.1, 0.85, -1.9));
        }
        this._fly?.(dt);
    }

    exit() {
        this.ravi?.dispose?.();
        super.exit();
        this.game.input.enabled = true;
    }
}
const _look = V(0, 0, 0);
