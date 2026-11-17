/**
 * Capítulos 2 e 3: Exploração marítima & Tempestade no mar.
 *
 * Fases: explore (conversar, horizonte, leme, Teco) → storm (cabo preso no leme; Teco solta)
 * → helm (Dico ao leme desvia da rocha) → clear.
 * Ao leme: guinada s ∈ [−1, 1] (s += entrada·1,4·dt), o navio avança 16 m/s em −Z e deriva
 * 7·s m/s em X. Bater = passar a menos de 7,5 m do centro da rocha; livrar = 10 m além dela.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=40';
import { buildShip, addShipColliders, updateShip, setShipLamps, SHIP_MARKS, deckY } from '../world/Ship.js?v=40';
import { makeFriend } from '../characters/cast.js?v=40';
import { makeCrag } from '../world/Build.js?v=40';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ROCK_Z = -130;

export class ShipLevel extends Level {
    get id() {
        return 'ship';
    }

    async build() {
        const g = this.game;
        this.group = new THREE.Group();
        this.ship = await buildShip(g);
        this.group.add(this.ship);
        addShipColliders(g.collision, this.ship);

        this.friends = [];
        const lines = [
            ['AMIGO', 'Camila está do outro lado do mar. Vamos buscá-la.'],
            ['AMIGO', 'Espadas, cordas, água… está tudo a bordo.'],
            ['AMIGO', 'Teco já subiu em três barris hoje.']
        ];
        SHIP_MARKS.friends.forEach((s, i) => {
            const hero = makeFriend(i);
            hero.object.position.set(s.x, deckY(s.x, s.z), s.z);
            hero.object.rotation.y = s.yaw;
            this.ship.add(hero.object);
            const f = { hero, anim: { mode: 'idle', upper: undefined }, talkT: 0 };
            this.friends.push(f);
            this.addInteract({
                object: hero.object,
                offsetY: 1,
                interactionLabel: 'Conversar',
                interactionDistance: 2.6,
                interact: (_p, game) => {
                    f.talkT = 3.4;
                    game.dialogue.say(lines[i][0], lines[i][1]);
                    game.audio.play('speech');
                    game.story.notify('talk_friends');
                    game.quests.complete('talk_crew');
                }
            });
        });

        const bow = SHIP_MARKS.bow;
        this.addInteract({
            object: this.proxy(bow.x, deckY(bow.x, bow.z) + 1.2, bow.z - 0.8, this.ship),
            interactionLabel: 'Observar o horizonte',
            interactionDistance: 2.8,
            interact: (_p, game) => {
                game.dialogue.say('DICO', 'Do outro lado do mar… uma ilha, e um castelo.');
                game.story.notify('horizon');
            }
        });

        this.addInteract({
            object: this.ship.userData.helm,
            interactionLabel: 'Verificar o leme',
            interactionDistance: 2.4,
            interact: (_p, game) => {
                if (this.phase === 'explore') {
                    game.dialogue.say('DICO', 'O leme responde. O mar está calmo… por enquanto.');
                    game.story.notify('helm');
                } else if (this.phase === 'storm') {
                    if (game.story.flags.ropeFreed) this.beginHelm();
                    else game.dialogue.say('DICO', 'Um cabo travou o leme! Teco, lá em cima!');
                }
            }
        });

        this.addInteract({
            object: g.teco.root,
            interactionLabel: 'Interagir com Teco',
            interactionDistance: 2.4,
            interact: (_p, game) => {
                if (this.phase !== 'explore') return;
                game.dialogue.say('DICO', 'Fica perto, Teco.');
                game.teco.play('Celebrate');
                game.teco.ai.state = 'CELEBRATE';
                game.teco.ai.timer = 0;
                game.story.notify('teco_play');
            }
        });

        this.ropeItem = this.addInteract({
            object: this.ship.userData.ropeSpot,
            interactionLabel: 'Mandar Teco',
            interactionDistance: 3.6,
            enabled: false,
            interact: (_p, game) => this.sendTecoRope(game)
        });

        /* A rocha da tempestade e dois recifes de enfeite fora da rota. */
        this.rock = makeCrag(21, { rx: 6.5, ry: 11, rz: 7, detail: 5 });
        this.rock.position.set(2, 2, ROCK_Z);
        this.rock.visible = false;
        this.rocks = new THREE.Group();
        this.rocks.add(this.rock);
        for (const [x, z, s, seed] of [[-34, ROCK_Z + 30, 0.6, 22], [38, ROCK_Z - 20, 0.8, 23], [-26, ROCK_Z - 60, 0.5, 24]]) {
            const r = makeCrag(seed, { rx: 6 * s, ry: 9 * s, rz: 6 * s, detail: 4 });
            r.position.set(x, 1, z);
            this.rocks.add(r);
        }
        this.rocks.visible = false;
        g.scene.add(this.rocks);

        this.phase = 'explore';
        this.steer = 0;
        this.shipZ = 0;
        this.shipX = 0;
        this.nightStarted = false;
    }

    _spawn(x, z, yaw) {
        this.game.player.spawn(x, deckY(x, z), z, yaw);
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.ship);
        g.teco.attachTo(this.ship);
        const s = SHIP_MARKS.spawn;
        this._spawn(s.x, s.z, Math.PI);
        g.teco.spawn(s.x + 0.8, deckY(s.x + 0.8, s.z - 0.8), s.z - 0.8);
        g.player.controller.setMode('walk');
        g.input.enabled = true;
        g.weather.apply('day');
        g.audio.setTheme('sea');
        g.storm.setIntensity(0);
        g.ocean.setMode('calm');
        g.ocean.visible = true;
        g.quests.set('explore_ship');
        g.checkpoints.save('ship_start', g.story._saveBlob());
        g.cameraRig.setWorld(g.collision, this.ship, false);
        g.cameraRig.yaw = 0;
        g.cameraRig.pitch = 0.42;
        g.hud.showObjective('Explore o navio');
        g.hud.showToast('Arraste para olhar. Clique ataca, Shift corre, E interage.', 7);
    }

    _storm() {
        const g = this.game;
        this.phase = 'storm';
        g.weather.apply('storm');
        g.ocean.setMode('storm');
        g.audio.setTheme('storm');
        g.storm.setIntensity(0.9);
        g.quests.set('free_helm');
        this.ship.userData.rope.visible = !g.story.flags.ropeFreed;
        this.ropeItem.enabled = !g.story.flags.ropeFreed;
        this.rocks.visible = true;
        this.rock.visible = true;
        setShipLamps(this.ship, 34);
        g.cameraRig.addShake(0.04, 8);
        const h = SHIP_MARKS.helmStand;
        this._spawn(h.x + 1.2, h.z + 0.4, Math.PI);
        g.teco.spawn(h.x + 2, deckY(h.x + 2, h.z), h.z);
    }

    /** `instant` = retomada de checkpoint (sem fade nem falas). */
    beginNight(instant = false) {
        if (this.nightStarted) return;
        this.nightStarted = true;
        const g = this.game;
        if (instant) {
            this._storm();
            return;
        }
        g.hud.showChapter('A Tempestade', 'ondas ferozes na escuridão');
        g.fadeTo(1.2, () => {
            this._storm();
            g.dialogue.say('DICO', 'Segurem firme!');
            g.dialogue.say('DICO', 'O leme travou! Teco, solte aquele cabo!');
            g.checkpoints.save('storm_start', g.story._saveBlob());
        }, 0.9);
    }

    sendTecoRope(game) {
        this.ropeItem.enabled = false;
        game.dialogue.say('DICO', 'Cuidado, Teco!');
        const hz = SHIP_MARKS.helm.z;
        const y = deckY(0, hz);
        const path = [V(1.2, y + 0.4, hz + 0.6), V(0.8, y + 2.4, hz - 0.3), V(1.5, y + 5, hz - 1.1), V(0.4, y + 1.3, hz)];
        game.teco.ai.command(path, {
            climb: true,
            onComplete: () => {
                this.ship.userData.rope.visible = false;
                game.audio.play('success');
                game.story.notify('rope_freed');
            }
        });
    }

    beginHelm() {
        const g = this.game;
        this.phase = 'helm';
        this.ship.userData.rope.visible = false;
        this.ropeItem.enabled = false;
        g.player.controller.setMode('helm');
        const h = SHIP_MARKS.helmStand;
        this._spawn(h.x, h.z, Math.PI);
        g.cameraRig.override = { distance: 15, height: 4.5, pitch: 0.36 };
        g.cameraRig.yaw = 0;
        g.hud.showObjective('Assuma o leme — desvie da rocha');
        g.hud.showToast('A / D ou o analógico viram o leme', 5);
        this.shipZ = 0;
        this.shipX = 0;
        this.steer = 0;
    }

    endStorm() {
        const g = this.game;
        this.phase = 'dawn';
        g.player.controller.setMode('locked');
        g.storm.setIntensity(0.15);
        g.audio.setTheme('land');
    }

    update(dt) {
        this.time += dt;
        const g = this.game;
        const stormy = this.phase !== 'explore';
        const wave = g.ocean.sample(this.shipX, this.shipZ);
        const k = stormy ? 0.8 : 1;
        this.ship.position.y = wave.y * k;
        this.ship.rotation.x = wave.pitch * k;
        this.ship.rotation.z = wave.roll * k + this.steer * 0.05;
        this.ship.rotation.y = wave.yaw - this.steer * 0.12;
        this.ship.userData.helm.rotation.z = this.steer * 2.4 + (stormy && !g.story.flags.ropeFreed ? Math.sin(this.time * 9) * 0.04 : 0);
        updateShip(this.ship, dt, stormy ? 2 : 1, 1);

        for (const f of this.friends) {
            f.talkT = Math.max(0, f.talkT - dt);
            f.anim.mode = f.talkT > 0 ? 'talk' : stormy ? 'block' : 'idle';
            f.hero.update(dt, f.anim);
        }

        if (this.phase === 'helm') {
            const input = g.input;
            this.steer += input.move.x * dt * 1.4;
            if (Math.abs(input.move.x) < 0.1) this.steer *= Math.exp(-dt * 0.6);
            this.steer = Math.max(-1, Math.min(1, this.steer));
            this.shipX += this.steer * 7 * dt;
            this.shipZ -= 16 * dt;
            this.group.position.set(this.shipX, 0, this.shipZ);

            const rock = this.rock.position;
            const dx = this.shipX - rock.x;
            const dz = this.shipZ - rock.z;
            if (Math.hypot(dx, dz) < 7.5) {
                g.story.notify('rock_hit');
                this.phase = 'dead';
            } else if (this.shipZ < rock.z - 10) {
                g.story.notify('rock_cleared');
                this.phase = 'clear';
            }
        }

        if (this.phase === 'storm') g.cameraRig.addShake(0.015, 0.2);
    }

    exit() {
        for (const f of this.friends) f.hero.dispose?.();
        this.rocks.removeFromParent();
        this.rocks.traverse((o) => o.geometry?.dispose());
        super.exit();
        this.game.player.controller.setMode('walk');
    }
}
