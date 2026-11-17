/**
 * Estágios e checkpoints. Cada estágio monta um ou mais níveis; o checkpoint diz onde
 * o jogador renasce dentro dele ("Continuar" e "Reiniciar checkpoint" passam por aqui).
 */
import * as THREE from 'three';
import { HomeLevel } from '../levels/HomeLevel.js?v=40';
import { ShipLevel } from '../levels/ShipLevel.js?v=40';
import { BeachLevel } from '../levels/BeachLevel.js?v=40';
import { CastleExteriorLevel } from '../levels/CastleExteriorLevel.js?v=40';
import { SecretEntranceLevel } from '../levels/SecretEntranceLevel.js?v=40';
import { CastleInteriorLevel } from '../levels/CastleInteriorLevel.js?v=40';
import { TigerRoomLevel } from '../levels/TigerRoomLevel.js?v=40';
import { EscapeLevel } from '../levels/EscapeLevel.js?v=40';
import { ShipEscapeLevel } from '../levels/ShipEscapeLevel.js?v=40';
import { EndingLevel } from '../levels/EndingLevel.js?v=40';
import { ISLAND_MARKS } from '../world/Island.js?v=40';

const FACTORIES = {
    home: HomeLevel,
    ship: ShipLevel,
    beach: BeachLevel,
    castle_ext: CastleExteriorLevel,
    secret: SecretEntranceLevel,
    interior: CastleInteriorLevel,
    tiger: TigerRoomLevel,
    escape: EscapeLevel,
    shipEscape: ShipEscapeLevel,
    ending: EndingLevel
};

export const STAGES = {
    home: ['home'],
    ship: ['ship'],
    island: ['beach', 'castle_ext', 'secret'],
    interior: ['interior', 'tiger'],
    escape: ['escape'],
    shipEscape: ['shipEscape'],
    ending: ['ending']
};

export const CHECKPOINT_STAGE = {
    home_intro: 'home',
    ship_start: 'ship',
    storm_start: 'ship',
    storm_rope: 'ship',
    castle_beach: 'island',
    castle_exterior: 'island',
    secret_door: 'island',
    sleeping_guard: 'interior',
    princess_cell: 'interior',
    tiger_room: 'interior',
    princess_rescued: 'interior',
    escape_start: 'escape',
    beach_escape: 'escape',
    ship_escape: 'shipEscape',
    ending: 'ending'
};

export class SceneManager {
    constructor(game) {
        this.game = game;
        this.levels = [];
        this.stageId = null;
    }

    async load(stageId, checkpoint) {
        const g = this.game;
        await this.unload();
        this.stageId = stageId;
        const ids = STAGES[stageId] || [stageId];
        g.collision.clear();
        g.interact.clear();
        g.arrows.clear();
        g.combat.setGuards([]);
        g.cutscenes.blocking = false;
        g.cameraRig.cutscene = false;
        g.cameraRig.override = null;
        g.player.pose = null;
        g.player.controller.setMode('walk');
        g.player.setTorch(false);
        g.player.setArmed(true);
        g.teco.visible = true;
        g.camila.active = false;
        g.storm.setIntensity(0);
        const levels = [];
        for (const id of ids) {
            const Ctor = FACTORIES[id];
            if (!Ctor) continue;
            const level = new Ctor(g);
            await level.build(levels);
            if (level.group && !level.group.parent) g.scene.add(level.group);
            levels.push(level);
        }
        this.levels = levels;
        g.levels = levels;
        g.level = levels[0];
        for (const lv of levels) lv.enter(checkpoint);
        this._applyCheckpointSpawn(checkpoint);
        g.scene.updateMatrixWorld(true);
        g.cameraRig.snapToPlayer(g.player);
        await g.stage.warmup();
        return levels;
    }

    _applyCheckpointSpawn(cp) {
        const g = this.game;
        const p = g.player;
        const t = g.teco;
        const M = ISLAND_MARKS;
        const gy = (x, z) => g.collision.ground?.(x, z) ?? 0;
        switch (cp) {
            case 'storm_start':
                g.level?.beginNight?.(true);
                break;
            case 'storm_rope':
                g.level?.beginNight?.(true);
                g.level?.beginHelm?.();
                break;
            case 'castle_exterior':
                p.spawn(M.view.x, gy(M.view.x, M.view.z), M.view.z, Math.PI);
                t.spawn(M.view.x + 0.6, gy(M.view.x, M.view.z), M.view.z + 1);
                g.cameraRig.yaw = 0;
                for (const lv of this.levels) lv.resume?.(cp);
                break;
            case 'secret_door':
                p.spawn(M.secret.x - 2.5, gy(M.secret.x - 2.5, M.secret.z + 2), M.secret.z + 2, Math.PI * 0.6);
                t.spawn(M.secret.x - 3, gy(M.secret.x - 3, M.secret.z + 3), M.secret.z + 3);
                g.cameraRig.yaw = -Math.PI * 0.4;
                for (const lv of this.levels) lv.resume?.(cp);
                break;
            case 'princess_cell':
                p.spawn(0, 3.2, -34, Math.PI);
                t.spawn(0.4, 3.2, -33);
                break;
            case 'tiger_room':
                p.spawn(3, 3.2, -18, Math.PI / 2);
                t.spawn(2.4, 3.2, -18);
                g.cameraRig.yaw = -Math.PI / 2;
                break;
            case 'princess_rescued':
                p.spawn(0, 3.2, -35.5, 0);
                t.spawn(0.4, 3.2, -35);
                g.cameraRig.yaw = Math.PI;
                g.camila.spawn(0.8, 3.2, -36.6);
                g.camila.setShackles(false);
                g.camila.freed = true;
                g.camila.ai.follow();
                g.level.restoreRescue?.();
                break;
            default:
                break;
        }
    }

    update(dt) {
        for (const lv of this.levels) lv.update(dt, this.game);
    }

    async unload() {
        for (const lv of this.levels) {
            lv.exit();
        }
        this.levels = [];
        this.game.level = null;
    }
}

export { THREE };
