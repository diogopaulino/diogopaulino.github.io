import * as THREE from 'three';
import { Level } from './Level.js';
import { buildShip, addShipColliders } from '../world/Ship.js';
import { makeRock } from '../world/Environment.js';
import { buildFriend, CharacterAnimator } from '../characters/builders.js';

export class ShipEscapeLevel extends Level {
    get id() {
        return 'ship_escape';
    }

    async build() {
        this.group = new THREE.Group();
        this.ship = buildShip();
        this.group.add(this.ship);
        this.game.scene.add(this.group);
        addShipColliders(this.game.collision);

        this.friends = [];
        for (let i = 0; i < 3; i++) {
            const f = buildFriend(i);
            f.group.position.set(-1.5 + i * 1.4, 1.44, 2);
            this.ship.add(f.group);
            this.friends.push(new CharacterAnimator(f.group, f.clips));
        }

        this.addInteract({
            object: this.ship.userData.mooring,
            interactionLabel: 'Soltar amarra',
            interactionDistance: 2.4,
            interact: (_p, game) => {
                if (this.untied) return;
                this.untied = true;
                this.ship.userData.mooring.visible = false;
                game.audio.play('interact');
                game.story.notify('untie');
            }
        });
        this.addInteract({
            object: this.ship.userData.sail,
            interactionLabel: 'Levantar a vela',
            interactionDistance: 4,
            interact: (_p, game) => {
                if (!this.untied || this.sail) return;
                this.sail = true;
                game.audio.play('success');
                game.story.notify('sail');
            }
        });
        this.addInteract({
            object: this.ship.userData.helm,
            interactionLabel: 'Assumir o leme',
            interactionDistance: 2.2,
            interact: (_p, game) => {
                if (!this.sail) {
                    game.dialogue.say('DICO', 'A vela primeiro!');
                    return;
                }
                this.beginHelm();
            }
        });

        this.rocks = [];
        for (const [x, z] of [[-8, -18], [9, -28], [0, -40]]) {
            const r = makeRock(5);
            r.scale.set(3, 6, 4);
            r.position.set(x, 1.5, z);
            this.game.scene.add(r);
            this.rocks.push(r);
        }

        this.obstacles = [];
        this.ship.traverse((c) => { if (c.isMesh) this.obstacles.push(c); });
        this.game.arrows.setColliders(this.obstacles.concat(this.rocks));
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
        g.player.attachTo(this.ship);
        g.teco.attachTo(this.ship);
        g.camila.attachTo(this.ship);
        g.player.spawn(0, 1.44, 6, Math.PI);
        g.teco.spawn(0.6, 1.5, 5.4);
        g.camila.spawn(-0.8, 1.44, 5);
        g.camila.ai.state = 'WAIT';
        g.weather.apply('day');
        g.audio.setTheme('chase');
        g.ocean.water.visible = true;
        g.quests.set('untie');
        g.input.enabled = true;
        g.player.controller.setMode('walk');
        g.cameraRig.setObstacles(this.obstacles);
        g.arrows.onHitPlayer = () => {
            if (g.player.hurt(0.5)) g.cameraRig.addShake(0.1, 0.2);
        };
        g.input.requestLock();
        g.dialogue.say('DICO', 'Soltem as amarras!');
    }

    beginHelm() {
        this.phase = 'helm';
        this.game.player.controller.setMode('helm');
        this.game.player.spawn(0, 2.23, 7.1, Math.PI);
        this.game.hud.showObjective('Saia da costa sem bater');
        this.game.dialogue.say('DICO', 'Vento nas velas!');
    }

    update(dt) {
        this.time += dt;
        const wave = this.game.ocean.sample(this.shipX, this.shipZ, this.time);
        this.ship.position.y = wave.y * 0.35;
        this.ship.rotation.x = wave.pitch * 0.4;
        this.ship.rotation.z = wave.roll * 0.4;
        this.ship.userData.helm.rotation.z = this.steer * 0.5;
        for (const a of this.friends) a.update(dt);

        this.arrowT += dt;
        if (this.phase !== 'done' && this.arrowT > 0.9 && this.shipZ > -25) {
            this.arrowT = 0;
            const origin = new THREE.Vector3((Math.random() - 0.5) * 16, 8, 18);
            const dir = new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.1, -1).normalize();
            this.game.arrows.fire(origin, dir, 22);
            this.game.audio.play('arrow');
        }

        if (this.phase === 'helm') {
            const input = this.game.input;
            this.steer += input.move.x * dt * 1.5;
            this.steer = Math.max(-1, Math.min(1, this.steer));
            this.shipX += this.steer * 8 * dt;
            this.shipZ -= 14 * dt;
            this.group.position.set(this.shipX, 0, this.shipZ);
            for (const r of this.rocks) {
                if (Math.hypot(this.shipX - r.position.x, this.shipZ - r.position.z) < 6.5) {
                    this.game.failCheckpoint('Pedras na costa…');
                    this.phase = 'dead';
                    return;
                }
            }
            if (this.shipZ < -55) {
                this.phase = 'done';
                this.game.player.controller.setMode('locked');
                this.game.story.notify('escaped');
            }
        }
    }

    exit() {
        super.exit();
        for (const r of this.rocks) this.game.scene.remove(r);
        this.game.arrows.clear();
        this.game.arrows.onHitPlayer = null;
        this.game.player.controller.setMode('walk');
    }
}
