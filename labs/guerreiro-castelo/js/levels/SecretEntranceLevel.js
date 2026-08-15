/**
 * Capítulo 7: Entrada Secreta do Castelo em Babylon.js.
 */

import { Level } from './Level.js';
import { woodTexture, mossTexture, rustTexture } from '../world/Textures.js';

export class SecretEntranceLevel extends Level {
    get id() {
        return 'secret';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('secretEntranceGroup', scene);
        this.group.position.set(-18, 0, -94);

        const woodMat = new BABYLON.StandardMaterial('secretWoodMat', scene);
        woodMat.diffuseTexture = woodTexture(scene, 2, 2);

        const frame = BABYLON.MeshBuilder.CreateBox('doorFrame', { width: 2.2, height: 3.2, depth: 0.4 }, scene);
        frame.position.y = 1.6;
        frame.material = woodMat;
        frame.parent = this.group;

        this.door = BABYLON.MeshBuilder.CreateBox('secretDoorMesh', { width: 1.4, height: 2.4, depth: 0.16 }, scene);
        this.door.position.set(0, 1.25, 0.1);
        this.door.material = woodMat;
        this.door.parent = this.group;

        const lock = BABYLON.MeshBuilder.CreateBox('secretLockMesh', { width: 0.2, height: 0.24, depth: 0.12 }, scene);
        lock.position.set(0.45, 1.2, 0.22);
        const rustMat = new BABYLON.StandardMaterial('secretRustMat', scene);
        rustMat.diffuseTexture = rustTexture(scene, 1, 1);
        rustMat.diffuseColor = new BABYLON.Color3(0.6, 0.35, 0.15);
        lock.material = rustMat;
        lock.parent = this.group;

        const moss = BABYLON.MeshBuilder.CreatePlane('secretMossMesh', { width: 2.6, height: 3.4 }, scene);
        moss.position.set(0, 1.5, -0.25);
        const mossMat = new BABYLON.StandardMaterial('sMossMat', scene);
        mossMat.diffuseTexture = mossTexture(scene, 2, 2);
        mossMat.backFaceCulling = false;
        moss.material = mossMat;
        moss.parent = this.group;

        const roots = BABYLON.MeshBuilder.CreateCylinder('secretRoots', { diameter: 0.08, height: 2.2 }, scene);
        roots.rotation.z = 0.6;
        roots.position.set(-0.8, 0.8, 0.2);
        const rootMat = new BABYLON.StandardMaterial('rootMat', scene);
        rootMat.diffuseColor = new BABYLON.Color3(0.25, 0.18, 0.1);
        roots.material = rootMat;
        roots.parent = this.group;

        this.addInteract({
            object: this.door,
            interactionLabel: 'Abrir',
            interactionDistance: 2.2,
            interact: (_p, game) => {
                game.dialogue.say('DICO', 'Trancada por dentro.');
            }
        });

        this.addInteract({
            object: lock,
            interactionLabel: 'Pedir ajuda a Teco',
            interactionDistance: 2.4,
            interact: (_p, game) => this.sendTeco(game)
        });

        this.opened = false;
    }

    sendTeco(game) {
        if (this.opened) return;
        const dest = this.door.getAbsolutePosition();
        dest.y += 0.4;

        game.teco.ai.command([game.teco.position.clone(), dest], {
            climb: true,
            celebrate: true,
            onComplete: () => {
                this.opened = true;
                game.audio.play('click');
                game.dialogue.say('DICO', 'Muito bem, Teco.');
                this.door.rotation.y = -1.4;
                game.audio.play('door');
                game.story.notify('door_open');
            }
        });
    }
}
