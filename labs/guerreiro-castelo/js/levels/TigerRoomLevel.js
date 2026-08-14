import * as THREE from 'three';
import { Level } from './Level.js';
import { castleStoneTexture, woodTexture } from '../world/Textures.js';
import { std } from '../characters/builders.js';
import { Tiger } from '../characters/Tiger.js';

export class TigerRoomLevel extends Level {
    get id() {
        return 'tiger';
    }

    async build() {
        this.group = new THREE.Group();
        this.group.position.set(12, 3.2, -18);
        const stone = new THREE.MeshStandardMaterial({ map: castleStoneTexture(), roughness: 0.9 });
        const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 12), stone);
        floor.position.y = -0.1;
        floor.receiveShadow = true;
        this.group.add(floor);
        this.game.collision.addFloor(12, -18, 12, 12, 3.2);

        const walls = [
            [0, 2, -6, 12, 4.2, 0.3],
            [0, 2, 6, 12, 4.2, 0.3],
            [-6, 2, 0, 0.3, 4.2, 12],
            [6, 2, 0, 0.3, 4.2, 12]
        ];
        for (const w of walls) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w[3], w[4], w[5]), stone);
            m.position.set(w[0], w[1], w[2]);
            this.group.add(m);
        }
        this.game.collision.addWall(12, -24, 12, 0.4, 4, 3.2);
        this.game.collision.addWall(12, -12, 12, 0.4, 4, 3.2);
        this.game.collision.addWall(6, -18, 0.4, 12, 4, 3.2);
        this.game.collision.addWall(18, -18, 0.4, 12, 4, 3.2);

        const doorHole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 2.2), std(0x0a0806, 1));
        doorHole.position.set(-5.8, 1.3, 0);
        this.group.add(doorHole);

        for (const [x, y, z] of [
            [-3, 2.6, -2], [0, 3.1, 1], [2.4, 3.4, -1], [4, 3.6, 2]
        ]) {
            const beam = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.25, 2.2),
                new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 })
            );
            beam.position.set(x, y, z);
            this.group.add(beam);
        }
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), stone);
        ledge.position.set(-4, 2.2, 3.4);
        this.group.add(ledge);

        this.keyMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.35, 0.06),
            new THREE.MeshStandardMaterial({ color: 0xd4b45a, metalness: 0.8, roughness: 0.3, emissive: 0x553300, emissiveIntensity: 0.5 })
        );
        this.keyMesh.position.set(4.6, 2.4, -4.4);
        this.group.add(this.keyMesh);

        this.tiger = new Tiger(this.group);
        this.tiger.spawn(1.2, 0, -1.5, Math.PI);
        this.tiger.ai.setBounds(-4, 4, -4, 4);
        this.game.tiger = this.tiger;

        this.addInteract({
            object: this.keyMesh,
            interactionLabel: 'Mandar Teco',
            interactionDistance: 8,
            interact: (_p, game) => this.sendTeco(game)
        });

        const dim = new THREE.PointLight(0xffaa66, 0.45, 10);
        dim.position.set(0, 3, 0);
        this.group.add(dim);

        this.game.scene.add(this.group);
        this.sent = false;
        this.greeted = false;
    }

    sendTeco(game) {
        if (this.sent || game.inventory.cellKey) return;
        this.sent = true;
        game.dialogue.say('DICO', 'Teco… consegue pegar aquela chave?');
        const parent = game.teco.root.parent;
        const wp = (x, y, z) => {
            const v = new THREE.Vector3(x, y, z);
            this.group.localToWorld(v);
            parent.worldToLocal(v);
            return v;
        };
        const path = [
            wp(-4, 2.4, 3.4),
            wp(-3, 2.8, -2),
            wp(0, 3.3, 1),
            wp(2.4, 3.6, -1),
            wp(4.2, 3.8, 2),
            wp(4.6, 2.6, -4.2)
        ];
        game.teco.ai.command(path, {
            climb: true,
            scared: true,
            celebrate: true,
            onComplete: () => {
                this.keyMesh.visible = false;
                game.audio.play('pickup');
                game.dialogue.say('TECO', 'Consegui!');
                game.dialogue.say('DICO', 'Muito bem!');
                game.story.notify('cell_key');
                const back = wp(game.player.position.x, game.player.position.y + 0.2, game.player.position.z);
                game.teco.ai.command([back], { onComplete: () => {} });
            }
        });
    }

    update(dt) {
        this.tiger.update(dt, this.game);
        const p = this.game.player.worldPosition();
        const room = this.group.position;
        const inside = Math.abs(p.x - room.x) < 5.5 && Math.abs(p.z - room.z) < 5.5;
        if (inside && !this.greeted) {
            this.greeted = true;
            this.game.audio.setTheme('tiger');
            this.game.dialogue.say('TIGRE', 'Grrrrrr!');
            this.game.audio.play('growl');
            this.tiger.ai.state = 'THREATEN';
            this.game.checkpoints.save('tiger_room', this.game.story._saveBlob());
        }
        this.keyMesh.rotation.y += dt * 1.2;
    }
}
