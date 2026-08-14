import * as THREE from 'three';
import { Level } from './Level.js';
import { woodTexture, mossTexture, rustTexture } from '../world/Textures.js';
import { std } from '../characters/builders.js';

export class SecretEntranceLevel extends Level {
    get id() {
        return 'secret';
    }

    async build() {
        this.group = new THREE.Group();
        this.group.position.set(-18, 0, -94);
        const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.4), wood);
        frame.position.y = 1.6;
        this.group.add(frame);
        this.door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.16), wood);
        this.door.position.set(0, 1.25, 0.1);
        this.group.add(this.door);
        const lock = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.24, 0.12),
            new THREE.MeshStandardMaterial({ map: rustTexture(), color: 0x8a4a18, metalness: 0.6, roughness: 0.5 })
        );
        lock.position.set(0.45, 1.2, 0.22);
        this.group.add(lock);
        const moss = new THREE.Mesh(
            new THREE.PlaneGeometry(2.6, 3.4),
            new THREE.MeshStandardMaterial({ map: mossTexture(), side: THREE.DoubleSide, roughness: 0.9 })
        );
        moss.position.set(0, 1.5, -0.25);
        this.group.add(moss);
        const roots = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.2, 5), std(0x3a2a14, 0.9));
        roots.rotation.z = 0.6;
        roots.position.set(-0.8, 0.8, 0.2);
        this.group.add(roots);

        this.addInteract({
            object: this.door,
            interactionLabel: 'Abrir',
            interactionDistance: 2.2,
            interact: (_p, game) => {
                game.dialogue.say('DICO', 'Trancada.');
            }
        });
        this.addInteract({
            object: lock,
            interactionLabel: 'Pedir ajuda a Teco',
            interactionDistance: 2.4,
            interact: (_p, game) => this.sendTeco(game)
        });

        this.game.scene.add(this.group);
        this.opened = false;
    }

    sendTeco(game) {
        if (this.opened) return;
        const dest = this.lockWorld || this.door.getWorldPosition(new THREE.Vector3());
        dest.y += 0.4;
        const local = dest.clone();
        game.teco.root.parent.worldToLocal(local);
        game.teco.ai.command([game.teco.position.clone(), local], {
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
