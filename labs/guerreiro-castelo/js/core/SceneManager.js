import { HomeLevel } from '../levels/HomeLevel.js';
import { ShipLevel } from '../levels/ShipLevel.js';
import { BeachLevel } from '../levels/BeachLevel.js';
import { ForestLevel } from '../levels/ForestLevel.js';
import { CastleExteriorLevel } from '../levels/CastleExteriorLevel.js';
import { SecretEntranceLevel } from '../levels/SecretEntranceLevel.js';
import { CastleInteriorLevel } from '../levels/CastleInteriorLevel.js';
import { TigerRoomLevel } from '../levels/TigerRoomLevel.js';
import { EscapeLevel } from '../levels/EscapeLevel.js';
import { ShipEscapeLevel } from '../levels/ShipEscapeLevel.js';
import { EndingLevel } from '../levels/EndingLevel.js';

const FACTORIES = {
    home: HomeLevel,
    homeEnd: HomeLevel,
    ship: ShipLevel,
    beach: BeachLevel,
    forest: ForestLevel,
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
    homeEnd: ['homeEnd'],
    ship: ['ship'],
    island: ['beach', 'forest', 'castle_ext', 'secret'],
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
        await this.unload();
        this.stageId = stageId;
        const ids = STAGES[stageId] || [stageId];
        this.game.collision.clear();
        this.game.interact.clear();
        this.game.arrows.clear();
        const levels = [];
        for (const id of ids) {
            const Ctor = FACTORIES[id];
            if (!Ctor) continue;
            const level = new Ctor(this.game);
            await level.build();
            levels.push(level);
        }
        this.levels = levels;
        this.game.levels = levels;
        this.game.level = levels[0];
        const obstacles = [];
        for (const lv of levels) {
            if (lv.obstacles) obstacles.push(...lv.obstacles);
        }
        this.game.cameraRig.setObstacles(obstacles);
        for (const lv of levels) lv.enter(checkpoint);
        this._applyCheckpointSpawn(checkpoint);
        this.game.scene.updateMatrixWorld(true);
        this.game.cameraRig.snapToPlayer(this.game.player);
        return levels;
    }

    _applyCheckpointSpawn(cp) {
        const p = this.game.player;
        const t = this.game.teco;
        switch (cp) {
            case 'storm_start':
                this.game.level?.beginNight?.();
                break;
            case 'storm_rope':
                this.game.level.phase = 'storm';
                this.game.level.nightStarted = true;
                this.game.weather.apply('storm');
                this.game.storm.setIntensity(0.85);
                this.game.level.ship.userData.rope.visible = true;
                this.game.level.ropeItem.enabled = true;
                p.spawn(0, 1.44, 5, 0);
                break;
            case 'castle_exterior':
                p.spawn(0, 0, -70, Math.PI);
                t.spawn(0.6, 0, -69);
                break;
            case 'secret_door':
                p.spawn(-16, 0, -92, Math.PI * 0.5);
                t.spawn(-15, 0, -92);
                break;
            case 'princess_cell':
                p.spawn(0, 3.2, -34, Math.PI);
                t.spawn(0.4, 3.2, -33);
                break;
            case 'tiger_room':
                p.spawn(10, 3.2, -18, 0);
                t.spawn(9.5, 3.2, -18);
                break;
            case 'princess_rescued':
                p.spawn(0, 3.2, -36, 0);
                t.spawn(0.4, 3.2, -35);
                this.game.camila.spawn(0.8, 3.2, -37);
                this.game.camila.setShackles(false);
                this.game.camila.freed = true;
                this.game.camila.ai.follow();
                break;
            case 'beach_escape':
                p.spawn(0, 0, 12, 0);
                t.spawn(0.5, 0, 11);
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
            if (lv.group) {
                this.game.scene.remove(lv.group);
            }
        }
        this.levels = [];
        this.game.level = null;
    }
}
