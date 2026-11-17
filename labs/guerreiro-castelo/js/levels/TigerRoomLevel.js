/**
 * Capítulo 9: Sala do Tigre & Puzzle Aéreo com Teco.
 * A chave dourada da cela pende de uma viga alta. O tigre dorme; quando Dico entra, acorda e
 * ameaça (chegar a menos de 2,3 m rende uma patada). Teco cruza a sala pelas vigas.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=40';
import { Tiger } from '../characters/Tiger.js?v=40';
import { Kit, block } from '../world/Build.js?v=40';
import { UP } from '../world/Dungeon.js?v=40';

/* vigas: [x, y, z] relativos ao centro da sala — o caminho de Teco passa por cima delas */
const BEAMS = [[-3, 2.6, -2], [0, 3.1, 1], [2.4, 3.4, -1], [4, 3.6, 2]];

export class TigerRoomLevel extends Level {
    get id() {
        return 'tiger';
    }

    async build() {
        const g = this.game;
        this.group = new THREE.Group();
        this.group.position.set(12, UP, -18);
        const kit = new Kit();

        // vigas de madeira atravessando a sala (apoiadas nas paredes) e a mísula de pedra
        for (const [x, y, z] of BEAMS) {
            kit.put('darkwood', block(0.34, 0.3, 12.6, 0.03), x, y, 0);
            kit.put('darkwood', block(0.7, 0.22, 2.2, 0.03), x, y + 0.02, z);
        }
        kit.put('blocks', block(1.3, 0.35, 1.3, 0.05), -4, 2.2, 3.4);
        kit.put('blocks', block(0.5, 2.2, 0.5, 0.05), -4.3, 1.1, 3.4);
        // palha no chão e argola da corrente do tigre
        kit.put('iron', new THREE.TorusGeometry(0.12, 0.025, 8, 16).rotateX(Math.PI / 2), 1.2, 0.03, -1.5);
        kit.build(this.group);

        // Chave dourada suspensa na viga alta.
        // O arco tem 11 cm, a haste 2,8 cm e o dente sai 4 cm para a direita.
        const shape = new THREE.Shape([
            [0, 0.175], [0.04, 0.155], [0.055, 0.12], [0.04, 0.085], [0.014, 0.07], [0.014, -0.09], [0.042, -0.10],
            [0.042, -0.15], [0.014, -0.155], [0.014, -0.175], [-0.014, -0.175], [-0.014, 0.07], [-0.04, 0.085],
            [-0.055, 0.12], [-0.04, 0.155]
        ].map(([x, y]) => new THREE.Vector2(x, y)));
        const hole = new THREE.Path();
        hole.absarc(0, 0.12, 0.022, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        const keyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
        keyGeo.translate(0, 0, -0.009);
        keyGeo.scale(1.6, 1.6, 1.6);
        this.keyMesh = new THREE.Mesh(keyGeo, new THREE.MeshStandardMaterial({
            color: 0xf2c84a, metalness: 1, roughness: 0.28, emissive: 0x6a4a08, emissiveIntensity: 0.8
        }));
        this.keyMesh.position.set(4.6, 2.5, -4.4);
        this.keyMesh.castShadow = true;
        this.keyMesh.userData.ownGeo = true;
        this.keyMesh.visible = !g.inventory.cellKey;
        this.group.add(this.keyMesh);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 2.2, 5), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
        cord.position.set(4.6, 3.85, -4.4);
        cord.userData.ownGeo = true;
        this.group.add(cord);
        this.keyGlow = new THREE.PointLight(0xffd070, 1.2, 4, 2);
        this.keyGlow.position.set(4.6, 2.5, -4.1);
        this.keyGlow.visible = this.keyMesh.visible;
        this.group.add(this.keyGlow);

        // Tigre
        this.tiger = new Tiger(this.group);
        this.tiger.spawn(1.2, 0, -1.5, Math.PI * 0.75);
        this.tiger.ai.setBounds(-4, 4, -4, 4);
        g.tiger = this.tiger;

        this.keyItem = this.addInteract({
            object: this.keyMesh,
            flat: true,
            enabled: false,
            interactionLabel: 'Mandar Teco',
            interactionDistance: 11,
            interact: (_p, game) => this.sendTeco(game)
        });

        this.sent = false;
        this.greeted = false;
    }

    sendTeco(game) {
        if (this.sent || game.inventory.cellKey) return;
        this.sent = true;
        this.keyItem.enabled = false;
        game.dialogue.say('DICO', 'Teco… consegue alcançar aquela chave dourada nas vigas?');

        const roomPos = this.group.position;
        const wp = (x, y, z) => new THREE.Vector3(roomPos.x + x, roomPos.y + y, roomPos.z + z);

        const path = [
            wp(-4, 2.4, 3.4),
            wp(-3, 2.8, -2),
            wp(0, 3.3, 1),
            wp(2.4, 3.6, -1),
            wp(4.2, 3.8, 2),
            wp(4.6, 2.9, -4.2)
        ];

        game.teco.ai.command(path, {
            climb: true,
            scared: true,
            celebrate: true,
            onComplete: () => {
                this.keyMesh.visible = false;
                this.keyGlow.visible = false;
                game.audio.play('pickup');
                game.dialogue.say('TECO', 'Consegui!');
                game.dialogue.say('DICO', 'Muito bem!');
                game.story.notify('cell_key');
                const p = game.player.position;
                game.teco.ai.command([wp(4.2, 3.8, 2), wp(0, 3.3, 1), wp(-4, 2.4, 3.4), new THREE.Vector3(p.x, p.y + 0.1, p.z)], { climb: true, onComplete: () => {} });
            }
        });
    }

    update(dt) {
        const g = this.game;
        this.tiger.update(dt, g);
        const p = g.player.position;
        const room = this.group.position;
        const inside = Math.abs(p.x - room.x) < 6.3 && Math.abs(p.z - room.z) < 6 && p.y > 2.5;

        if (inside && !this.greeted) {
            this.greeted = true;
            g.audio.setTheme('tiger');
            g.dialogue.say('TIGRE', 'Grrrrrr!');
            g.audio.play('growl');
            this.tiger.ai.state = 'THREATEN';
            this.tiger.ai.growlT = 1.5;
            this.tiger.ai.roarT = 5;
            if (!g.inventory.cellKey) {
                g.hud.showToast('Fique longe do tigre. Olhe para a chave e mande Teco.', 6);
                g.checkpoints.save('tiger_room', g.story._saveBlob());
            }
        }
        this.keyItem.enabled = inside && !this.sent && !g.inventory.cellKey;

        this.keyMesh.rotation.y += dt * 1.2;
    }
}
