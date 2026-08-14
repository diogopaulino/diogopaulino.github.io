import * as THREE from 'three';
import { Level } from './Level.js';
import { buildShip } from '../world/Ship.js';
import { buildFriend, CharacterAnimator } from '../characters/builders.js';

export class EndingLevel extends Level {
    get id() {
        return 'ending';
    }

    async build() {
        this.group = new THREE.Group();
        this.ship = buildShip();
        this.group.add(this.ship);
        this.game.scene.add(this.group);

        this.friends = [];
        for (let i = 0; i < 3; i++) {
            const f = buildFriend(i);
            f.group.position.set(-1.4 + i, 1.44, 1.5);
            this.ship.add(f.group);
            this.friends.push(new CharacterAnimator(f.group, f.clips));
        }
        this.phase = 'sail';
        this.t = 0;
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.ship);
        g.teco.attachTo(this.ship);
        g.camila.attachTo(this.ship);
        g.player.spawn(0.4, 1.44, 3, Math.PI);
        g.teco.spawn(0.6, 1.52, 3);
        g.teco.ai.state = 'PERCHED';
        g.camila.spawn(-0.8, 1.44, 2.4);
        g.camila.active = true;
        g.camila.root.visible = true;
        g.camila.ai.state = 'WAIT';
        g.player.controller.setMode('locked');
        g.input.enabled = false;
        g.weather.apply('day');
        g.audio.setTheme('calm');
        g.storm.setIntensity(0);
        g.ocean.water.visible = true;
        g.ocean.setStorm(0.12);

        g.dialogue.play(
            [
                { speaker: 'CAMILA', text: 'Eu achei que nunca sairia daquele lugar.', duration: 4 },
                { speaker: 'CAMILA', text: 'Obrigada. A todos vocês.', duration: 3.2 }
            ],
            () => this.pullBack()
        );
    }

    pullBack() {
        const g = this.game;
        g.cutscenes.play({
            from: new THREE.Vector3(2, 3, 8),
            to: new THREE.Vector3(18, 22, 40),
            lookFrom: new THREE.Vector3(0, 2, 0),
            lookTo: new THREE.Vector3(0, 4, -10),
            duration: 6,
            onEnd: () => {
                g.fadeTo(1.6, () => g.loadStage('homeEnd', 'ending'));
            }
        });
    }

    update(dt) {
        this.t += dt;
        this.group.position.z -= dt * 2.2;
        const wave = this.game.ocean.sample(0, this.group.position.z, this.t);
        this.ship.position.y = wave.y * 0.3;
        this.ship.rotation.x = wave.pitch * 0.3;
        this.ship.rotation.z = wave.roll * 0.3;
        for (const a of this.friends) a.update(dt);
    }

    exit() {
        super.exit();
        this.game.input.enabled = true;
    }
}
