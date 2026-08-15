/**
 * Capítulo 9: Sala do Tigre & Puzzle Aéreo com Teco em Babylon.js.
 */

import { Level } from './Level.js';
import { castleStoneTexture, woodTexture } from '../world/Textures.js';
import { Tiger } from '../characters/Tiger.js';

export class TigerRoomLevel extends Level {
    get id() {
        return 'tiger';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('tigerRoomGroup', scene);
        this.group.position.set(12, 3.2, -18);

        const stoneMat = new BABYLON.StandardMaterial('tigerStoneMat', scene);
        stoneMat.diffuseTexture = castleStoneTexture(scene, 4, 4);

        const woodMat = new BABYLON.StandardMaterial('tigerWoodMat', scene);
        woodMat.diffuseTexture = woodTexture(scene, 2, 2);

        // Piso
        const floor = BABYLON.MeshBuilder.CreateBox('tigerFloor', { width: 12, height: 0.2, depth: 12 }, scene);
        floor.position.y = -0.1;
        floor.material = stoneMat;
        floor.parent = this.group;
        floor.receiveShadows = true;
        this.game.collision.addFloor(12, -18, 12, 12, 3.2);

        // 4 Paredes
        const walls = [
            { name: 'tWallN', w: 12, h: 4.2, d: 0.3, x: 0, y: 2, z: -6 },
            { name: 'tWallS', w: 12, h: 4.2, d: 0.3, x: 0, y: 2, z: 6 },
            { name: 'tWallW', w: 0.3, h: 4.2, d: 12, x: -6, y: 2, z: 0 },
            { name: 'tWallE', w: 0.3, h: 4.2, d: 12, x: 6, y: 2, z: 0 }
        ];

        for (const w of walls) {
            const m = BABYLON.MeshBuilder.CreateBox(w.name, { width: w.w, height: w.h, depth: w.d }, scene);
            m.position.set(w.x, w.y, w.z);
            m.material = stoneMat;
            m.parent = this.group;
        }

        this.game.collision.addWall(12, -24, 12, 0.4, 4, 3.2);
        this.game.collision.addWall(12, -12, 12, 0.4, 4, 3.2);
        this.game.collision.addWall(6, -18, 0.4, 12, 4, 3.2);
        this.game.collision.addWall(18, -18, 0.4, 12, 4, 3.2);

        // Vigas de madeira no alto
        const beamCoords = [
            [-3, 2.6, -2],
            [0, 3.1, 1],
            [2.4, 3.4, -1],
            [4, 3.6, 2]
        ];
        for (const [x, y, z] of beamCoords) {
            const beam = BABYLON.MeshBuilder.CreateBox('beam', { width: 0.7, height: 0.25, depth: 2.2 }, scene);
            beam.position.set(x, y, z);
            beam.material = woodMat;
            beam.parent = this.group;
        }

        const ledge = BABYLON.MeshBuilder.CreateBox('ledge', { width: 1.2, height: 0.3, depth: 1.2 }, scene);
        ledge.position.set(-4, 2.2, 3.4);
        ledge.material = stoneMat;
        ledge.parent = this.group;

        // Chave dourada suspensa na viga alta
        this.keyMesh = BABYLON.MeshBuilder.CreateBox('cellKeyGold', { width: 0.12, height: 0.35, depth: 0.06 }, scene);
        this.keyMesh.position.set(4.6, 2.4, -4.4);
        const goldMat = new BABYLON.StandardMaterial('goldKeyCellMat', scene);
        goldMat.diffuseColor = new BABYLON.Color3(0.95, 0.8, 0.2);
        goldMat.specularColor = new BABYLON.Color3(1, 1, 0.8);
        goldMat.emissiveColor = new BABYLON.Color3(0.4, 0.3, 0.05);
        this.keyMesh.material = goldMat;
        this.keyMesh.parent = this.group;

        // Tigre patrulhando
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

        const dim = new BABYLON.PointLight('tigerRoomLight', new BABYLON.Vector3(0, 3, 0), scene);
        dim.diffuse = new BABYLON.Color3(1.0, 0.7, 0.4);
        dim.intensity = 0.55;
        dim.range = 12;
        dim.parent = this.group;

        this.obstacles = this.group.getChildMeshes ? this.group.getChildMeshes() : [];
        this.sent = false;
        this.greeted = false;
    }

    sendTeco(game) {
        if (this.sent || game.inventory.cellKey) return;
        this.sent = true;
        game.dialogue.say('DICO', 'Teco… consegue alcançar aquela chave dourada nas vigas?');

        const roomPos = this.group.position;
        const wp = (x, y, z) => new BABYLON.Vector3(roomPos.x + x, roomPos.y + y, roomPos.z + z);

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
                this.keyMesh.setEnabled(false);
                game.audio.play('pickup');
                game.dialogue.say('TECO', 'Consegui!');
                game.dialogue.say('DICO', 'Muito bem!');
                game.story.notify('cell_key');
                const back = new BABYLON.Vector3(game.player.position.x, game.player.position.y + 0.2, game.player.position.z);
                game.teco.ai.command([back], { onComplete: () => {} });
            }
        });
    }

    update(dt) {
        this.tiger.update(dt, this.game);
        const p = this.game.player.position;
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
