/**
 * Capítulos 2 e 3: Exploração marítima & Tempestade no mar em Babylon.js.
 */

import { Level } from './Level.js';
import { buildShip, addShipColliders } from '../world/Ship.js';
import { buildFriend, CharacterAnimator } from '../characters/builders.js';
import { makeRock } from '../world/Environment.js';

export class ShipLevel extends Level {
    get id() {
        return 'ship';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('shipLevelRoot', scene);
        this.ship = buildShip(scene);
        this.ship.parent = this.group;

        addShipColliders(this.game.collision);

        this.friends = [];
        const spots = [
            { x: -1.6, z: -2.2, y: 1.44, yaw: 0.4, line: ['AMIGO', 'Camila está do outro lado do mar. Vamos buscá-la.'] },
            { x: 1.8, z: 1.4, y: 1.44, yaw: -0.8, line: ['AMIGO', 'Espadas, cordas, água… está tudo a bordo.'] },
            { x: -1.4, z: 4.6, y: 1.44, yaw: 2.4, line: ['AMIGO', 'Teco já subiu em três barris hoje.'] }
        ];

        spots.forEach((s, i) => {
            const f = buildFriend(scene, i);
            f.root.position.set(s.x, s.y, s.z);
            f.root.rotation.y = s.yaw;
            f.root.parent = this.ship;
            const anim = new CharacterAnimator(f.root, f.clips);
            this.friends.push({ root: f.root, anim, line: s.line });

            this.addInteract({
                object: f.root,
                interactionLabel: 'Conversar',
                interactionDistance: 2.4,
                interact: (_p, game) => {
                    game.dialogue.say(s.line[0], s.line[1]);
                    game.audio.play('speech');
                    game.story.notify('talk_friends');
                    game.quests.complete('talk_crew');
                }
            });
        });

        const horizon = new BABYLON.TransformNode('horizonProxy', scene);
        horizon.position.set(0, 1.8, -7.5);
        horizon.parent = this.ship;
        this.addInteract({
            object: horizon,
            interactionLabel: 'Observar o horizonte',
            interactionDistance: 2.8,
            interact: (_p, game) => {
                game.dialogue.say('DICO', 'Do outro lado do mar… uma ilha, e um castelo.');
                game.story.notify('horizon');
            }
        });

        this.addInteract({
            object: this.ship.userData.helm,
            interactionLabel: 'Verificar o leme',
            interactionDistance: 2.2,
            interact: (_p, game) => {
                if (this.phase === 'explore') {
                    game.dialogue.say('DICO', 'O leme responde. O mar está calmo… por enquanto.');
                    game.story.notify('helm');
                } else if (this.phase === 'helm' || this.phase === 'storm') {
                    this.beginHelm();
                }
            }
        });

        this.addInteract({
            object: this.game.teco.root,
            interactionLabel: 'Interagir com Teco',
            interactionDistance: 2.4,
            interact: (_p, game) => {
                game.dialogue.say('DICO', 'Fica perto, Teco.');
                game.teco.play('Celebrate');
                game.teco.ai.state = 'CELEBRATE';
                game.teco.ai.timer = 0;
                game.story.notify('teco_play');
            }
        });

        this.ropeItem = this.addInteract({
            object: this.ship.userData.rope,
            interactionLabel: 'Mandar Teco',
            interactionDistance: 3.4,
            enabled: false,
            interact: (_p, game) => this.sendTecoRope(game)
        });

        this.rock = makeRock(6, scene);
        this.rock.scaling.set(4.5, 8, 5);
        this.rock.position.set(2, 2, -70);
        this.rock.setEnabled(false);

        this.obstacles = this.ship.getChildMeshes ? this.ship.getChildMeshes() : [];

        this.phase = 'explore';
        this.steer = 0;
        this.shipZ = 0;
        this.shipX = 0;
        this.nightStarted = false;
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.ship);
        g.teco.attachTo(this.ship);
        g.camila.attachTo(this.ship);
        g.player.spawn(0, 1.44, 3.2, Math.PI);
        g.teco.spawn(0.8, 1.5, 2.4);
        g.player.controller.setMode('walk');
        g.input.enabled = true;
        g.weather.apply('day');
        g.audio.setTheme('sea');
        g.storm.setIntensity(0);
        g.ocean.visible = true;
        g.quests.set('explore_ship');
        g.checkpoints.save('ship_start', g.story._saveBlob());
        g.cameraRig.setObstacles(this.obstacles);
        g.cameraRig.yaw = Math.PI;
        g.cameraRig.pitch = 0.28;
        g.cameraRig.cutscene = false;
        g.cameraRig.snapToPlayer(g.player);
        g.hud.showObjective('Explore o navio');
        g.input.requestLock();
    }

    beginNight() {
        if (this.nightStarted) return;
        this.nightStarted = true;
        const g = this.game;
        g.hud.showChapter('A Tempestade', 'ondas ferozes na escuridão');
        g.fadeTo(1.2, () => {
            this.phase = 'storm';
            g.weather.apply('storm');
            g.audio.setTheme('storm');
            g.storm.setIntensity(0.85);
            g.dialogue.say('DICO', 'Segurem firme!');
            g.quests.set('free_helm');
            g.checkpoints.save('storm_start', g.story._saveBlob());
            this.ship.userData.rope.setEnabled(true);
            this.ropeItem.enabled = true;
            this.rock.setEnabled(true);
            g.cameraRig.addShake(0.04, 8);
            g.player.spawn(0, 1.44, 4.5, 0);
            g.fadeTo(0, null, 0.9);
        });
    }

    sendTecoRope(game) {
        this.ropeItem.enabled = false;
        game.dialogue.say('DICO', 'Cuidado, Teco!');
        const path = [
            new BABYLON.Vector3(1.8, 1.7, 2),
            new BABYLON.Vector3(2.1, 2.1, 4.2),
            new BABYLON.Vector3(1.2, 2.6, 6.4),
            new BABYLON.Vector3(0.3, 2.7, 7.4)
        ];
        game.teco.ai.command(path, {
            climb: true,
            onComplete: () => {
                this.ship.userData.rope.setEnabled(false);
                game.audio.play('success');
                game.story.notify('rope_freed');
            }
        });
    }

    beginHelm() {
        const g = this.game;
        this.phase = 'helm';
        g.player.controller.setMode('helm');
        g.player.spawn(0, 2.23, 7.1, Math.PI);
        g.hud.showObjective('Assuma o leme — desvie da rocha');
        this.shipZ = 0;
        this.shipX = 0;
        this.steer = 0;
        this.rock.position.set(3, 2, -55);
        this.rock.setEnabled(true);
    }

    endStorm() {
        const g = this.game;
        this.phase = 'dawn';
        g.player.controller.setMode('locked');
        g.storm.setIntensity(0.15);
        g.weather.apply('dawn');
        g.audio.setTheme('land');

        const castleHint = BABYLON.MeshBuilder.CreateBox('castleHint', { width: 18, height: 28, depth: 18 }, this.game.scene);
        const cMat = new BABYLON.StandardMaterial('cHintMat', this.game.scene);
        cMat.diffuseColor = new BABYLON.Color3(0.55, 0.5, 0.45);
        castleHint.material = cMat;
        castleHint.position.set(8, 16, -160);
        this._hint = castleHint;

        g.cutscenes.play({
            from: new BABYLON.Vector3(4, 8, 16),
            to: new BABYLON.Vector3(10, 14, 6),
            lookFrom: new BABYLON.Vector3(8, 10, -40),
            lookTo: new BABYLON.Vector3(8, 18, -160),
            duration: 5.2,
            onEnd: () => {}
        });
    }

    update(dt) {
        this.time += dt;
        const wave = this.game.ocean.sample(this.shipX, this.shipZ, this.time);
        const storm = this.game.storm.rainIntensity;
        this.ship.position.y = wave.y * (0.4 + storm);
        this.ship.rotation.x = wave.pitch * (0.5 + storm);
        this.ship.rotation.z = wave.roll * (0.5 + storm);
        this.ship.rotation.y = wave.yaw;

        const sail = this.ship.userData.sail;
        if (sail) {
            sail.rotation.y = Math.sin(this.time * (1 + storm * 3)) * (0.04 + storm * 0.12);
        }
        this.ship.userData.helm.rotation.z = this.steer * 0.6;

        for (const f of this.friends) f.anim.update(dt);

        if (this.phase === 'helm') {
            const input = this.game.input;
            this.steer += input.move.x * dt * 1.4;
            this.steer = Math.max(-1, Math.min(1, this.steer));
            this.shipX += this.steer * 7 * dt;
            this.shipZ -= 16 * dt;
            this.group.position.set(this.shipX, 0, this.shipZ);
            this.game.storm.follow(this.group.position);

            const rock = this.rock.position;
            const sx = this.shipX;
            const sz = this.shipZ;
            const dx = sx - rock.x;
            const dz = sz - rock.z;
            if (Math.hypot(dx, dz) < 7.5) {
                this.game.story.notify('rock_hit');
                this.phase = 'dead';
            } else if (sz < rock.z - 10) {
                this.game.story.notify('rock_cleared');
                this.phase = 'clear';
            }
        }

        if (this.phase === 'storm') {
            this.game.cameraRig.addShake(0.015, 0.2);
            this.game.storm.follow(this.ship.position);
        }
    }

    exit() {
        super.exit();
        if (this.rock) {
            try { this.rock.dispose(); } catch { /* ignore */ }
        }
        if (this._hint) {
            try { this._hint.dispose(); } catch { /* ignore */ }
        }
        this.game.player.controller.setMode('walk');
    }
}
