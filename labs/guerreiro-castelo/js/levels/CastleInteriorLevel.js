/**
 * Capítulo 8: Calabouço, Furtividade & Guarda Dorminhoco.
 *
 * O salão tem um guarda de ronda (cone de visão no chão) e o carcereiro dormindo à mesa com
 * as chaves. Agachar (C) reduz o alcance da visão a 60 % e o ruído a 0,22; barris e caixotes
 * escondem quem está agachado. As três chaves não abrem a cela — a certa está na sala do tigre.
 * Depois de soltar Camila, voltar ao salão (z > −22) dispara o alarme e a fuga.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=40';
import { buildDungeon, UP } from '../world/Dungeon.js?v=42';
import { Guard } from '../characters/Guard.js?v=42';
import { Kit, block } from '../world/Build.js?v=40';

export class CastleInteriorLevel extends Level {
    get id() {
        return 'interior';
    }

    async build() {
        const g = this.game;
        const d = await buildDungeon(g);
        this.dungeon = d;
        this.group = d.group;
        this.fx = d.fx;
        this.cellDoor = d.cellDoor;
        const vase = d.vase;

        this.addInteract({
            object: vase,
            offsetY: 0.3,
            interactionLabel: 'Não tocar no vaso',
            interactionDistance: 1.7,
            interact: (_p, game) => {
                if (this.vaseDown) return;
                this.vaseDown = true;
                vase.rotation.z = 1.45;
                vase.position.set(3.25, UP + 0.12, -14.9);
                game.collision.emitNoise(3.2, -14, 1.4, 0.8);
                game.audio.play('fail');
                this.sleeping.ai.suspicion += 0.9;
                this.patrol.ai.alert = Math.max(this.patrol.ai.alert, 0.7);
            }
        });

        // Guarda dorminhoco: sentado num banco, de frente para a mesa
        const kit = new Kit();
        kit.put('darkwood', block(0.5, 0.06, 0.5, 0.02), 1.75, UP + 0.47, -16.6);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.put('darkwood', block(0.06, 0.44, 0.06, 0.012), 1.75 + sx * 0.19, UP + 0.22, -16.6 + sz * 0.19);
        kit.build(this.group);
        this.sleeping = new Guard(this.group, { fat: true, sleep: true });
        this.sleeping.spawn(1.75, UP, -16.6, Math.PI / 2);
        g.collision.addPillar(1.75, -16.6, 0.3, 1.2, UP);

        /* Ronda: salão ↔ despensa, com pausa nas pontas. */
        const P = (x, z, wait = 0) => ({ x, z, y: UP, wait });
        this.patrol = new Guard(this.group, {
            viewDist: 8.5, viewAngle: 0.62,
            patrol: [P(-3.95, -14.4, 1.6), P(-3.95, -18), P(-10.2, -18, 2.6), P(-3.95, -18), P(-3.95, -21.7, 1.6), P(-3.95, -18)]
        });
        this.patrol.spawn(-10.2, UP, -18, 0);
        this.patrol.ai.patrolI = 2;
        g.combat.setGuards([this.sleeping, this.patrol]);

        this.addInteract({
            object: this.sleeping.root,
            offsetY: 0.9,
            interactionLabel: 'Pegar chaves',
            interactionDistance: 1.9,
            interact: (_p, game) => this.stealKeys(game)
        });

        this.addInteract({
            object: g.camila.root,
            offsetY: 1,
            interactionLabel: 'Conversar com Camila',
            /* 4,2 m: dá para falar com ela pela grade (a 3,4 m o aviso nunca aparecia) */
            interactionDistance: 4.2,
            interact: (_p, game) => this.talkCamila(game)
        });

        this.cellItem = this.addInteract({
            object: this.proxy(0, UP + 1.2, -37.2),
            interactionLabel: 'Usar chave',
            interactionDistance: 2.2,
            interact: (_p, game) => this.tryCell(game)
        });

        this.keysTaken = g.story.flags.keysTaken;
        this.cellTried = 0;
        this.alarmArmed = false;
        this.doorOpen = 0;
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.group);
        g.teco.attachTo(this.group);
        g.camila.attachTo(this.group);
        g.player.spawn(0, 0, 3.2, Math.PI);
        g.teco.spawn(0.5, 0, 2.6);
        g.camila.spawn(0, UP, -40.2);
        g.camila.setShackles(true);
        g.camila.freed = false;
        g.camila.ai.state = 'WAIT';
        g.camila.active = true;
        g.player.setTorch(true);
        g.weather.apply('interior');
        g.audio.setTheme('stealth');
        g.storm.setIntensity(0);
        g.ocean.visible = false;
        if (!g.story.flags.keysTaken) g.quests.set('stealth_up');
        g.dialogue.say('DICO', 'Devagar… não faça barulho.');
        g.teco.ai.state = 'PERCHED';
        g.cameraRig.setWorld(g.collision, null, true);
        g.cameraRig.yaw = 0;
        g.cameraRig.pitch = 0.25;
        g.input.enabled = true;
        g.player.controller.setMode('walk');
        g.hud.showStealth(true, 0);
        g.hud.showToast('C agacha e esconde. Fique fora do cone do guarda.', 6);
        if (g.story.flags.cellOpen) this._openCell();
    }

    _openCell() {
        this.opening = true;
        if (this.dungeon.cellBox) {
            this.game.collision.removeBox(this.dungeon.cellBox);
            this.dungeon.cellBox = null;
        }
    }

    /** Checkpoint 'princess_rescued': cela aberta e alarme armado. */
    restoreRescue() {
        this._openCell();
        this.doorOpen = 1;
        this.alarmArmed = true;
    }

    stealKeys(game) {
        if (this.keysTaken) return;
        this.keysTaken = true;
        this.sleeping.hasKeys = false;
        game.audio.play('clink');
        game.dialogue.say('GUARDA', '…hmm… quem está aí…');
        game.story.notify('keys');
        this.sleeping.ai.suspicion = Math.max(this.sleeping.ai.suspicion, 0.4);
    }

    talkCamila(game) {
        game.camila.talkT = 3;
        if (!game.story.flags.foundCamila) {
            game.dialogue.play([
                { speaker: 'DICO', text: 'Princesa, viemos salvar você.', duration: 3 },
                { speaker: 'CAMILA', text: 'Vocês vieram mesmo!', duration: 2.8 },
                { speaker: 'DICO', text: 'Vou tirar você daí.', duration: 2.6 }
            ]);
            game.story.notify('found_camila');
        } else if (game.story.flags.cellOpen && !game.story.flags.shacklesOpen) {
            this.tryShackles(game);
        } else if (!game.story.flags.cellOpen) {
            game.dialogue.say('CAMILA', game.inventory.cellKey ? 'Essa chave dourada! Abra a cela!' : 'A chave da cela não fica com os guardas…');
        }
    }

    tryCell(game) {
        if (game.story.flags.cellOpen) return;
        if (game.inventory.cellKey) {
            this._openCell();
            game.audio.play('click');
            game.audio.play('door');
            game.story.notify('cell_open');
            game.dialogue.say('DICO', 'A chave certa.');
            return;
        }
        if (!game.inventory.keys) {
            game.dialogue.say('DICO', 'Preciso de uma chave. O guarda dorminhoco tem um molho!');
            return;
        }
        this.cellTried += 1;
        game.story.notify('wrong_key');
        game.audio.play('fail');
        const n = this.cellTried;
        if (n === 1) game.dialogue.say('DICO', 'Não é esta…');
        else if (n === 2) game.dialogue.say('DICO', 'Tampouco esta.');
        else {
            game.dialogue.say('DICO', 'Nenhuma das três. Teco, a fechadura é outra. Deve estar na outra sala.');
            if (game.quests.current.id === 'cell_key' || game.quests.current.id === 'find_camila') game.quests.set('teco_tiger');
        }
    }

    tryShackles(game) {
        if (this.shackling) return;
        this.shackling = true;
        game.audio.play('fail');
        game.dialogue.say('DICO', 'Tentando os grilhões…');
        setTimeout(() => {
            if (game.level !== this) return;
            game.audio.play('click');
            game.story.notify('shackles');
            this.alarmArmed = true;
        }, 1600);
    }

    update(dt) {
        this.time += dt;
        const g = this.game;
        this.fx.update(this.time);
        /* A fechadura só responde depois de falar com Camila e some com a cela aberta:
           colada na grade, ela roubava o aviso "Conversar com Camila". */
        this.cellItem.enabled = Boolean(g.story.flags.foundCamila || g.inventory.cellKey) && !g.story.flags.cellOpen;
        this.sleeping.update(dt, g);
        this.patrol.update(dt, g);
        if (this.opening) {
            this.doorOpen = Math.min(1, this.doorOpen + dt * 0.9);
            this.cellDoor.rotation.y = 1.45 * this.doorOpen * (2 - this.doorOpen);
        }

        const p = g.player.position;
        const noise = g.player.noise || 0;
        const near = Math.hypot(p.x - 1.75, p.z + 16.6) < 7 ? noise * 0.3 : 0;
        g.hud.showStealth(true, Math.min(1, Math.max(this.patrol.alive ? this.patrol.ai.alert : 0, this.sleeping.ai.suspicion / 1.2 + near)));

        if (this.alarmArmed && p.z > -22 && p.y > 2.5 && !g.story.flags.alarm) {
            this.sleeping.ai.state = 'CHASE';
            g.story.notify('alarm');
        }
    }

    exit() {
        this.sleeping.hero.dispose?.();
        this.patrol.hero.dispose?.();
        super.exit();
        this.game.player.setTorch(false);
        this.game.hud.showStealth(false);
    }
}
