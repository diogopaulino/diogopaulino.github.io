/**
 * Capítulo 6: Aproximação do Castelo e Reconhecimento com Teco.
 * Arqueiros vigiam o adarve sobre o portão; Teco sobe na árvore-mirante e acha a gruta.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=50';
import { ISLAND_MARKS } from '../world/Island.js?v=50';
import { makeHero, giveBow } from '../characters/cast.js?v=50';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class CastleExteriorLevel extends Level {
    get id() {
        return 'castle_ext';
    }

    async build() {
        const g = this.game;
        const isl = g.island;
        this.island = isl;
        this.group = new THREE.Group();
        const M = ISLAND_MARKS;

        this.archers = [];
        for (const [x, y, z] of isl.castle.userData.archerSpots) {
            const hero = makeHero('archer');
            hero.object.position.set(x, y, z + 0.2);
            isl.castle.add(hero.object);
            giveBow(hero, THREE);
            this.archers.push({ hero, anim: { mode: 'idle' } });
        }

        const gy = isl.heightAt(M.gate.x, M.gate.z);
        this.addInteract({
            object: this.proxy(M.gate.x, gy + 1.4, M.gate.z - 2.4),
            interactionLabel: 'Portão (protegido)',
            interactionDistance: 6,
            interact: (_p, game) => {
                game.dialogue.say('DICO', 'Não por aqui. Há arqueiros demais no portão.');
                if (!this.nearCastle) {
                    this.nearCastle = true;
                    game.story.notify('castle_view');
                }
            }
        });

        const ty = isl.heightAt(M.tree.x, M.tree.z);
        this.treeBase = V(M.tree.x, ty, M.tree.z);
        this.treeItem = this.addInteract({
            object: this.proxy(M.tree.x, ty + 1.2, M.tree.z),
            interactionLabel: 'Mandar Teco',
            interactionDistance: 4.5,
            interact: (_p, game) => this.sendTecoTree(game)
        });

        this.tecoSent = false;
        this.nearCastle = false;
    }

    /** Retomada de checkpoint: a vista do castelo já aconteceu. */
    resume(cp) {
        this.nearCastle = true;
        if (cp === 'secret_door' || this.game.story.flags.otherEntrance) {
            this.tecoSent = true;
            this.treeItem.enabled = false;
        }
    }

    sendTecoTree(game) {
        if (this.tecoSent) return;
        this.tecoSent = true;
        /* missão dada: o aviso sai (antes "Mandar Teco" ficava na tela sem fazer nada) */
        this.treeItem.enabled = false;
        const b = this.treeBase;
        const path = [V(b.x + 0.5, b.y + 0.3, b.z + 0.5), V(b.x + 0.35, b.y + 4.2, b.z + 0.3), V(b.x + 0.2, b.y + 7.2, b.z)];
        game.teco.ai.command(path, {
            climb: true,
            celebrate: true,
            onComplete: () => {
                game.story.notify('teco_tree');
                const p = game.player.position;
                game.teco.ai.command([V(b.x + 0.5, b.y + 0.3, b.z + 0.5), V(p.x, p.y, p.z)], { onComplete: () => {} });
            }
        });
    }

    update(dt) {
        this.time += dt;
        const g = this.game;
        const p = g.player.position;
        for (const a of this.archers) {
            a.hero.lookAt(g.player.root.getWorldPosition(_look).setY(_look.y + 1.5));
            a.hero.update(dt, a.anim);
        }

        if (!this.nearCastle && p.z < ISLAND_MARKS.view.z) {
            this.nearCastle = true;
            g.story.notify('castle_view');
            g.cutscenes.play({
                from: V(p.x + 3, p.y + 3, p.z + 9),
                to: V(p.x + 9, p.y + 12, p.z + 2),
                lookFrom: V(0, 16, -44),
                lookTo: V(0, 24, -60),
                duration: 4.2
            });
        }
    }

    exit() {
        for (const a of this.archers) {
            a.hero.object.removeFromParent();
            a.hero.dispose?.();
        }
        super.exit();
    }
}
const _look = V(0, 0, 0);
