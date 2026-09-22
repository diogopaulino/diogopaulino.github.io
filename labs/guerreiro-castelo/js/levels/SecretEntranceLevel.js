/**
 * Capítulo 7: Entrada Secreta do Castelo em Babylon.js.
 */

import { Level } from './Level.js';
import { woodTexture, mossTexture, rustTexture, castleStoneTexture } from '../world/Textures.js';

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
        const stoneMat = new BABYLON.StandardMaterial('secretStoneMat', scene);
        stoneMat.diffuseTexture = castleStoneTexture(scene, 2, 2);
        stoneMat.diffuseColor = new BABYLON.Color3(0.72, 0.68, 0.6);

        // Portal de pedra e folha de tábuas no vão da caixa antiga.
        // this.door continua sendo o alvo de "Abrir".
        const frame = new BABYLON.TransformNode('doorFrame', scene);
        frame.position.y = 1.6;
        frame.parent = this.group;
        const carve = (parent, name, shape, path, mat) => {
            const mesh = BABYLON.MeshBuilder.ExtrudeShape(name, {
                shape: shape.map(([x, y]) => new BABYLON.Vector3(x, y, 0)),
                path: path.map(([x, y, z]) => new BABYLON.Vector3(x, y, z || 0)),
                cap: BABYLON.Mesh.CAP_ALL,
                closeShape: true,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            }, scene);
            mesh.material = mat;
            mesh.parent = parent;
            return mesh;
        };
        const archPoints = (halfW, springY, crownY, n = 10) => {
            const pts = [];
            for (let i = 0; i <= n; i++) {
                const u = (i / n) * 2 - 1;
                const y = springY + (crownY - springY) * Math.sqrt(Math.max(0, 1 - u * u));
                pts.push([+(u * halfW).toFixed(4), +y.toFixed(4)]);
            }
            return pts;
        };
        const jamb = [
            [0.18, -0.18], [-0.24, -0.18], [-0.24, 0.08], [-0.1, 0.18], [0.18, 0.18]
        ];
        carve(frame, 'secretJamb', jamb, [[-0.9, -1.55, 0], [-0.9, 1.0, 0]], stoneMat);
        carve(frame, 'secretJamb', jamb.map(([x, y]) => [x, -y]), [[0.9, -1.55, 0], [0.9, 1.0, 0]], stoneMat);
        const innerArch = archPoints(0.72, 0.92, 1.28);
        const outerArch = archPoints(0.98, 0.78, 1.5);
        carve(frame, 'secretArch', innerArch.concat(outerArch.slice().reverse()), [[0, 0, -0.15], [0, 0, 0.22]], stoneMat);

        const door = new BABYLON.TransformNode('secretDoorMesh', scene);
        door.position.set(0, 1.25, 0.1);
        door.parent = this.group;
        this.door = door;
        const board = [
            [0.02, -0.06], [-0.05, -0.055], [-0.065, -0.035],
            [-0.065, 0.035], [-0.05, 0.055], [0.02, 0.06]
        ];
        const strap = [
            [0.01, -0.035], [-0.055, -0.028], [-0.06, 0.028], [0.01, 0.035]
        ];
        const ironMat = new BABYLON.StandardMaterial('secretIronMat', scene);
        ironMat.diffuseColor = new BABYLON.Color3(0.32, 0.3, 0.28);
        ironMat.specularColor = new BABYLON.Color3(0.4, 0.38, 0.35);
        for (let i = 0; i < 5; i++) {
            const x = -0.44 + i * 0.22;
            carve(door, 'secretPlank', board, [[x, -1.12, 0], [x, 1.12, 0]], woodMat);
        }
        for (const y of [-0.55, 0.4]) {
            carve(door, 'secretStrap', strap, [[-0.58, y, 0.02], [0.58, y, 0.02]], ironMat);
        }

        const lock = BABYLON.MeshBuilder.CreateLathe('secretLockMesh', {
            shape: [
                new BABYLON.Vector3(0.02, 0, 0),
                new BABYLON.Vector3(0.09, 0.015, 0),
                new BABYLON.Vector3(0.1, 0.04, 0),
                new BABYLON.Vector3(0.045, 0.055, 0),
                new BABYLON.Vector3(0.03, 0.1, 0),
                new BABYLON.Vector3(0.012, 0.12, 0)
            ],
            tessellation: 10,
            cap: BABYLON.Mesh.CAP_ALL
        }, scene);
        lock.rotation.x = Math.PI / 2;
        lock.position.set(0.45, 1.2, 0.2);
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
