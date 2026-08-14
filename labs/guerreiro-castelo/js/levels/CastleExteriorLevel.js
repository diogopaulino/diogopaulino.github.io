import * as THREE from 'three';
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
        this.group = new THREE.Group();
        this.group.position.set(0, 0, -88);
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(90, 70),
            new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.9, color: 0x8a8a70 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.group.add(ground);

        this.castle = buildCastle();
        this.group.add(this.castle);
        addCastleColliders(this.game.collision, 0, -88);

        this.lookout = makeTree();
        this.lookout.position.set(-18, 0, 4);
        this.group.add(this.lookout);

        const gateProxy = new THREE.Object3D();
        gateProxy.position.set(0, 1, 16);
        this.group.add(gateProxy);
        this.addInteract({
            object: gateProxy,
            interactionLabel: 'Portão (protegido)',
            interactionDistance: 4,
            interact: (_p, game) => {
                game.dialogue.say('DICO', 'Não por aqui. Há arqueiros demais.');
                if (!this._viewed) {
                    this._viewed = true;
                    game.story.notify('castle_view');
                }
            }
        });

        this.addInteract({
            object: this.lookout,
            interactionLabel: 'Mandar Teco',
            interactionDistance: 3,
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
            const a = buildGuard({ archer: true });
            a.group.position.set(i * 3.2, 18.2, 14.2);
            this.castle.add(a.group);
            this.archers.push(new CharacterAnimator(a.group, a.clips));
        }

        this.game.scene.add(this.group);
        this.obstacles = [];
        this.group.traverse((c) => { if (c.isMesh) this.obstacles.push(c); });
        this.tecoSent = false;
        this.nearCastle = false;
    }

    sendTecoTree(game) {
        if (this.tecoSent) return;
        this.tecoSent = true;
        const base = this.lookout.getWorldPosition(new THREE.Vector3());
        const local = (x, y, z) => {
            const v = new THREE.Vector3(x, y, z);
            game.teco.root.parent.worldToLocal(v);
            return v;
        };
        const path = [
            local(base.x, 1.2, base.z),
            local(base.x, 4.2, base.z),
            local(base.x, 6.5, base.z)
        ];
        game.teco.ai.command(path, {
            climb: true,
            onComplete: () => {
                game.story.notify('teco_tree');
                game.teco.ai.command([
                    local(game.player.position.x, game.player.position.y, game.player.position.z)
                ], { onComplete: () => {} });
            }
        });
    }

    update(dt) {
        this.time += dt;
        for (const a of this.archers) a.update(dt);
        const p = this.game.player.worldPosition();
        if (!this.nearCastle && p.z < -70) {
            this.nearCastle = true;
            this.game.story.notify('castle_view');
            this.game.cutscenes.play({
                from: new THREE.Vector3(p.x + 4, p.y + 8, p.z + 10),
                to: new THREE.Vector3(p.x + 8, p.y + 16, p.z + 6),
                lookFrom: new THREE.Vector3(0, 12, -88),
                lookTo: new THREE.Vector3(0, 20, -100),
                duration: 3.6
            });
        }
        const door = this.castle.userData.secretDoor;
        door.getWorldPosition(this._wp || (this._wp = new THREE.Vector3()));
        if (!this._atDoor && this._wp.distanceTo(p) < 3.2) {
            this._atDoor = true;
            this.game.story.notify('at_secret');
        }
    }
}
