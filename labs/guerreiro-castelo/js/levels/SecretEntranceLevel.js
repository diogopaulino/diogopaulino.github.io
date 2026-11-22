/**
 * Capítulo 7: Entrada Secreta do Castelo — gruta úmida com tochas no pé do rochedo.
 * A porta está trancada por dentro; Teco passa pela fresta e solta a tranca.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=40';
import { ISLAND_MARKS } from '../world/Island.js?v=40';

const _d = new THREE.Vector3();

export class SecretEntranceLevel extends Level {
    get id() {
        return 'secret';
    }

    async build() {
        const g = this.game;
        this.island = g.island;
        this.group = new THREE.Group();
        this.door = this.island.doorPivot;
        this.door.rotation.y = 0;
        this.doorSpot = this.proxy(ISLAND_MARKS.secret.x - 0.2, 6.6 + 1.2, ISLAND_MARKS.secret.z);

        this.addInteract({
            object: this.doorSpot,
            interactionLabel: 'Abrir',
            interactionDistance: 2.4,
            interact: (_p, game) => {
                if (this.opened) return;
                /* Os dois avisos ("Abrir" e "Pedir ajuda a Teco") ficam a meio metro um do
                   outro e o "Abrir", mais perto da câmera, vencia sempre: a porta não abria
                   nunca. Agora tentar abrir já chama Teco. */
                game.dialogue.say('DICO', 'Trancada por dentro. Teco, passe pela fresta!');
                this.tried = true;
                this.sendTeco(game);
            }
        });

        this.lockItem = this.addInteract({
            object: this.island.lock,
            interactionLabel: 'Pedir ajuda a Teco',
            interactionDistance: 3.2,
            interact: (_p, game) => this.sendTeco(game)
        });

        this.opened = false;
        this._atDoor = false;
    }

    resume(cp) {
        if (cp === 'secret_door') this._atDoor = true;
    }

    sendTeco(game) {
        if (this.opened || this.sent) return;
        this.sent = true;
        for (const item of this.interactables) item.enabled = false;
        const dest = this.island.lock.getWorldPosition(new THREE.Vector3());
        dest.x -= 0.25;

        game.teco.ai.command([game.teco.position.clone(), dest], {
            climb: true,
            celebrate: true,
            onComplete: () => {
                this.opened = true;
                game.audio.play('click');
                game.dialogue.say('DICO', 'Muito bem, Teco.');
                this.opening = 0;
                game.audio.play('door');
                game.story.notify('door_open');
            }
        });
    }

    update(dt) {
        const g = this.game;
        if (this.opening !== undefined) {
            this.opening = Math.min(1, this.opening + dt * 1.2);
            this.door.rotation.y = -1.4 * this.opening * (2 - this.opening);
        }
        if (!this._atDoor && this.doorSpot.getWorldPosition(_d).distanceTo(g.player.position) < 4.2) {
            this._atDoor = true;
            g.story.notify('at_secret');
        }
    }

    exit() {
        this.door.rotation.y = 0;
        super.exit();
    }
}
