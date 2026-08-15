/**
 * Capítulo 6: Aproximação do Castelo e Reconhecimento com Teco em Babylon.js.
 */

import { Level } from './Level.js';
import { buildCastle, addCastleColliders } from '../world/Castle.js';
import { makeTree } from '../world/Environment.js';
import { grassTexture } from '../world/Textures.js';
import { buildGuard, CharacterAnimator } from '../characters/builders.js';

export class CastleExteriorLevel extends Level {
    get id() {
        return 'castle_ext';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('castleExtGroup', scene);
        this.group.position.set(0, 0, -88);

        const ground = BABYLON.MeshBuilder.CreateGround('castleExtGround', { width: 90, height: 70 }, scene);
        ground.position.y = 0.02;
        const gMat = new BABYLON.StandardMaterial('castleExtGMat', scene);
        gMat.diffuseTexture = grassTexture(scene, 12, 10);
        gMat.diffuseColor = new BABYLON.Color3(0.55, 0.55, 0.45);
        ground.material = gMat;
        ground.parent = this.group;
        ground.receiveShadows = true;

        this.castle = buildCastle(scene);
        this.castle.parent = this.group;
        addCastleColliders(this.game.collision, 0, -88);

        this.lookout = makeTree(Math.random, scene);
        this.lookout.position.set(-18, 0, 4);
        this.lookout.parent = this.group;

        const gateProxy = new BABYLON.TransformNode('gateProxy', scene);
        gateProxy.position.set(0, 1, 16);
        gateProxy.parent = this.group;

        this.addInteract({
            object: gateProxy,
            interactionLabel: 'Portão (protegido)',
            interactionDistance: 4,
            interact: (_p, game) => {
                game.dialogue.say('DICO', 'Não por aqui. Há arqueiros demais no portão.');
                if (!this._viewed) {
                    this._viewed = true;
                    game.story.notify('castle_view');
                }
            }
        });

        this.addInteract({
            object: this.lookout,
            interactionLabel: 'Mandar Teco',
            interactionDistance: 3.5,
            interact: (_p, game) => this.sendTecoTree(game)
        });

        const secret = this.castle.userData.secretDoor;
        this.addInteract({
            object: secret,
            interactionLabel: 'Chegar à porta',
            interactionDistance: 2.6,
            interact: (_p, game) => {
                game.story.notify('at_secret');
                game.quests.set('open_door');
            }
        });

        this.archers = [];
        for (let i = -2; i <= 2; i++) {
            const a = buildGuard(scene, { archer: true });
            a.root.position.set(i * 3.2, 18.2, 14.2);
            a.root.parent = this.castle;
            this.archers.push(new CharacterAnimator(a.root, a.clips));
        }

        this.obstacles = this.group.getChildMeshes ? this.group.getChildMeshes() : [];
        this.tecoSent = false;
        this.nearCastle = false;
    }

    sendTecoTree(game) {
        if (this.tecoSent) return;
        this.tecoSent = true;
        const base = this.lookout.getAbsolutePosition();
        const path = [
            new BABYLON.Vector3(base.x, 1.2, base.z),
            new BABYLON.Vector3(base.x, 4.2, base.z),
            new BABYLON.Vector3(base.x, 6.5, base.z)
        ];
        game.teco.ai.command(path, {
            climb: true,
            celebrate: true,
            onComplete: () => {
                game.story.notify('teco_tree');
                game.teco.ai.command([
                    new BABYLON.Vector3(game.player.position.x, game.player.position.y, game.player.position.z)
                ], { onComplete: () => {} });
            }
        });
    }

    update(dt) {
        this.time += dt;
        for (const a of this.archers) a.update(dt);

        const p = this.game.player.position;
        if (!this.nearCastle && p.z < -70) {
            this.nearCastle = true;
            this.game.story.notify('castle_view');
            this.game.cutscenes.play({
                from: new BABYLON.Vector3(p.x + 4, p.y + 8, p.z + 10),
                to: new BABYLON.Vector3(p.x + 8, p.y + 16, p.z + 6),
                lookFrom: new BABYLON.Vector3(0, 12, -88),
                lookTo: new BABYLON.Vector3(0, 20, -100),
                duration: 3.6
            });
        }

        const door = this.castle.userData.secretDoor;
        const doorPos = door.getAbsolutePosition ? door.getAbsolutePosition() : door.position;
        if (!this._atDoor && BABYLON.Vector3.Distance(doorPos, p) < 3.2) {
            this._atDoor = true;
            this.game.story.notify('at_secret');
        }
    }
}
