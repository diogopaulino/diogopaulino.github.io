/**
 * Loop da partida: câmera, ondas, golpes, loot, chefes e HUD arcade.
 */

import {
    VW, VH, STAGES, ITEMS, STAGE_TIME, MAX_ATTACKERS, START_LIVES,
    HITSTOP_LIGHT, HITSTOP_HEAVY, HITSTOP_SPECIAL, groundY, CHARACTERS
} from './config.js';
import { clamp, lerp, pick, rand, irand } from './utils.js';
import { makeHero, makeFoe, tryGrab, hitTest } from './actors.js';
import { drawActor, drawCrate, drawItem, drawFx } from './sprites.js';
import { drawStage } from './world.js';
import * as audio from './audio.js';

export class Game {
    constructor(charId) {
        this.charId = charId;
        this.stageIndex = 0;
        this.lives = START_LIVES;
        this.score = 0;
        this.time = STAGE_TIME;
        this.timeAcc = 0;
        this.hero = null;
        this.foes = [];
        this.items = [];
        this.crates = [];
        this.fx = [];
        this.shots = [];
        this.camX = 0;
        this.camTarget = 0;
        this.lockX = 0;
        this.wave = -1;
        this.cleared = false;
        this.goT = 0;
        this.attackers = 0;
        this.hitstop = 0;
        this.shake = 0;
        this.banner = null;
        this.bannerT = 0;
        this.paused = false;
        this.over = false;
        this.won = false;
        this.continueT = 0;
        this.combo = 0;
        this.comboT = 0;
        this.kills = 0;
        this.viewRight = VW - 80;
        this.stageLength = 4000;
        this.stage = STAGES[0];
        this.tick = 0;
        this.bossIntro = false;
        this.resetStage(0);
    }

    resetStage(index) {
        this.stageIndex = index;
        this.stage = STAGES[index];
        this.stageLength = this.stage.length;
        this.hero = makeHero(this.charId, 160, 0);
        this.foes = [];
        this.items = [];
        this.shots = [];
        this.fx = [];
        this.crates = this.stage.crates.map((x) => ({ x, z: irand(-20, 30), hp: 10, broken: false }));
        this.camX = 0;
        this.lockX = this.stage.waves[0].lock;
        this.wave = -1;
        this.cleared = false;
        this.attackers = 0;
        this.time = STAGE_TIME;
        this.timeAcc = 0;
        this.bossIntro = false;
        this.stageDone = false;
        this.banner = { title: this.stage.name, sub: `FASE ${index + 1}` };
        this.bannerT = 90;
        audio.startMusic(this.stage.music);
        this.trySpawn();
    }

    trySpawn() {
        const next = this.wave + 1;
        if (next < this.stage.waves.length) {
            const w = this.stage.waves[next];
            if (this.hero.x > w.lock - 380 || this.wave < 0) {
                this.wave = next;
                this.lockX = w.lock;
                this.cleared = false;
                for (const f of w.foes) {
                    const x = this.lockX + (f.dx || 400);
                    this.foes.push(makeFoe(f.t, x, f.z, f.dx < 0 ? 1 : -1));
                }
            }
        } else if (!this.bossIntro && this.foes.every((f) => f.dead) && this.hero.x > this.stage.boss.lock - 420) {
            this.bossIntro = true;
            this.lockX = this.stage.boss.lock;
            const b = makeFoe(this.stage.boss.id, this.lockX + 280, 0, -1);
            this.foes.push(b);
            this.banner = { title: b.name, sub: BOSSES_TITLE[this.stage.boss.id] || 'CHEFE' };
            this.bannerT = 100;
            audio.sfx('go');
        }
    }

    canAttack(foe) {
        if (foe.token) return true;
        if (this.attackers >= MAX_ATTACKERS) return false;
        foe.token = true;
        this.attackers++;
        return true;
    }

    get viewRightCam() {
        return this.lockX;
    }

    update(input) {
        if (this.over || this.won) return;
        const frozen = this.hitstop > 0;
        if (frozen) this.hitstop--;
        this.tick++;
        if (!frozen) {
            this.timeAcc++;
            if (this.timeAcc >= 60) {
                this.timeAcc = 0;
                this.time--;
                if (this.time <= 0) this.killHero('time');
            }
            if (this.bannerT > 0) this.bannerT--;
            if (this.comboT > 0) this.comboT--;
            else this.combo = 0;
            if (this.shake > 0) this.shake *= 0.86;
        }

        const world = this;
        world.viewRight = Math.min(VW - 70, this.lockX - this.camX - 30);
        world.camX = this.camX;
        world.stageLength = this.stageLength;
        world.onHit = (a, v, knock) => this.registerHit(a, v, knock);
        world.onThrow = () => {
            audio.sfx('throw');
            this.shake = 10;
        };
        world.spawnBossShot = (boss) => this.spawnShot(boss);

        if (input.consume('jump')) {
            if (this.hero.startJump()) audio.sfx('jump');
        }
        if (input.consume('special')) {
            if (this.hero.startSpecial()) {
                audio.sfx('special');
                this.shake = 12;
                this.hitstop = HITSTOP_SPECIAL;
                this.specialFx(this.hero);
            }
        }
        if (this.hero.state !== 'grab' && this.hero.state !== 'grabbed' && input.consume('attack')) {
            const grabbed = tryGrab(this.hero, this.foes.filter((f) => !f.dead));
            if (grabbed && this.hero.canControl()) {
                this.hero.startGrab(grabbed);
                audio.sfx('hit');
            } else {
                const kind = this.hero.startAttack();
                if (kind === 'jattack' || kind === 'blitz') audio.sfx('whiff');
                else if (kind) audio.sfx('whiff');
            }
        }

        if (frozen) return;
        this.hero.tickHero(input, world);
        for (const f of this.foes) f.tickFoe(this.hero, world);

        this.resolveHits();
        this.updateShots();
        this.updateItems();
        this.updateCrates();
        this.updateFx();
        this.updateCamera();
        this.checkWave();
        this.trySpawn();
        this.checkHeroDeath();
    }

    resolveHits() {
        const actors = [this.hero, ...this.foes];
        for (const a of actors) {
            if (!a.hitbox?.w || a.hasHit && a.state !== 'special') continue;
            const active = a.state === 'attack' ? (a.stateT >= 4 && a.stateT <= 12)
                : a.state === 'jattack' ? (a.stateT >= 2 && a.stateT <= 16)
                : a.state === 'blitz' ? (a.stateT >= 2 && a.stateT <= 14)
                : a.state === 'special' ? (a.stateT >= 6 && a.stateT <= 24)
                : false;
            if (!active) continue;
            a.hitbox.x = a.x + a.facing * 28;
            a.hitbox.z = a.z;
            a.hitbox.from = a.x;
            for (const v of actors) {
                if (v === a || v.team === a.team) continue;
                if (a.hasHit && a.state !== 'special') break;
                if (hitTest(a.hitbox, v)) {
                    const knock = a.hitbox.knock;
                    const ok = v.takeHit(a.hitbox.dmg, knock, a.facing);
                    if (ok) {
                        a.hasHit = true;
                        this.registerHit(a, v, knock);
                        if (a.specialType === 'swarm' && a.state === 'special' && v.team === 'foe') {
                            a.hp = Math.min(a.maxHp, a.hp + 6);
                        }
                    }
                }
            }
            for (const c of this.crates) {
                if (c.broken) continue;
                if (Math.abs(c.x - a.x) < 50 && Math.abs(c.z - a.z) < 28 && a.team === 'hero' && active) {
                    c.hp -= 8;
                    a.hasHit = true;
                    if (c.hp <= 0) this.breakCrate(c);
                    else audio.sfx('hit');
                }
            }
        }
    }

    registerHit(a, v, knock) {
        audio.sfx(knock ? 'heavy' : 'hit', knock ? 1.2 : 1);
        this.hitstop = knock ? HITSTOP_HEAVY : HITSTOP_LIGHT;
        this.shake = knock ? 11 : 5;
        const sx = v.x - this.camX;
        const sy = groundY(v.z) - v.y - 90;
        this.fx.push({ kind: 'spark', x: sx + a.facing * 20, y: sy, size: knock ? 22 : 14, life: 10, max: 10, color: '#fff3a0', rot: rand(0, 3) });
        this.fx.push({ kind: 'slash', x: sx, y: sy, size: 28, life: 8, max: 8, color: '#ffffffcc', a0: 0, a1: 1.4 });
        if (a.team === 'hero') {
            this.combo++;
            this.comboT = 50;
            this.score += Math.round((knock ? 120 : 50) * (1 + this.combo * 0.05));
            if (v.dead) {
                this.kills++;
                this.score += v.scoreValue;
                audio.sfx('ko');
                this.maybeDrop(v);
                v.releaseToken(this);
            }
        }
    }

    maybeDrop(v) {
        if (Math.random() > 0.42) return;
        const kind = pick(['apple', 'apple', 'roast', 'gold', 'pipe', 'knife']);
        this.items.push({ kind, x: v.x, z: v.z, life: 60 * 8 });
    }

    breakCrate(c) {
        c.broken = true;
        audio.sfx('heavy');
        this.shake = 6;
        const kind = pick(['apple', 'roast', 'pipe', 'knife', 'gold']);
        this.items.push({ kind, x: c.x, z: c.z, life: 60 * 10 });
    }

    spawnShot(boss) {
        const kind = boss.kind === 'witch' ? 'orb' : boss.kind === 'mummy' ? 'sand' : 'bat';
        this.shots.push({
            x: boss.x + boss.facing * 30,
            z: boss.z,
            y: 70,
            vx: boss.facing * (kind === 'bat' ? 4.2 : 3.4),
            vz: (this.hero.z - boss.z) * 0.02,
            kind,
            life: 90,
            dmg: 12 * boss.power
        });
    }

    updateShots() {
        for (const s of this.shots) {
            s.x += s.vx;
            s.z += s.vz;
            s.life--;
            if (this.hero.invuln <= 0 && !this.hero.dead && Math.abs(s.x - this.hero.x) < 28 && Math.abs(s.z - this.hero.z) < 22) {
                this.hero.takeHit(s.dmg, false, signish(s.vx));
                s.life = 0;
                audio.sfx('hurt');
            }
        }
        this.shots = this.shots.filter((s) => s.life > 0);
    }

    updateItems() {
        for (const it of this.items) {
            it.life--;
            if (Math.abs(it.x - this.hero.x) < 36 && Math.abs(it.z - this.hero.z) < 22 && !this.hero.dead) {
                const spec = ITEMS[it.kind];
                if (spec.heal) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + spec.heal);
                if (spec.weapon) {
                    this.hero.weapon = spec.weapon;
                    this.hero.weaponHits = spec.weapon === 'pipe' ? 8 : 6;
                }
                this.score += spec.score;
                it.life = 0;
                audio.sfx('item');
            }
        }
        this.items = this.items.filter((it) => it.life > 0);
    }

    updateCrates() {}

    updateFx() {
        for (const f of this.fx) f.life--;
        this.fx = this.fx.filter((f) => f.life > 0);
    }

    specialFx(hero) {
        const sx = hero.x - this.camX;
        const sy = groundY(hero.z) - hero.y - 80;
        const color = CHARACTERS[hero.charId].color;
        this.fx.push({ kind: 'ring', x: sx, y: sy, size: 20, life: 18, max: 18, color });
        for (let i = 0; i < 8; i++) {
            this.fx.push({ kind: 'spark', x: sx, y: sy, size: 18, life: 12, max: 12, color, rot: i });
        }
        if (hero.specialType === 'howl') {
            for (const f of this.foes) {
                if (!f.dead && Math.abs(f.x - hero.x) < 220 && Math.abs(f.z - hero.z) < 50) f.stun = 40;
            }
        }
        if (hero.specialType === 'storm') {
            for (const f of this.foes) {
                if (!f.dead && Math.abs(f.x - hero.x) < 140 && Math.abs(f.z - hero.z) < 40) {
                    f.takeHit(22 * hero.power, true, hero.facing);
                    this.registerHit(hero, f, true);
                }
            }
        }
    }

    updateCamera() {
        const target = clamp(this.hero.x - VW * 0.34, 0, Math.max(0, this.lockX - VW + 80));
        this.camX = lerp(this.camX, target, 0.12);
        if (this.cleared) {
            this.lockX = Math.min(this.stageLength, this.lockX + 14);
            this.goT++;
        }
    }

    checkWave() {
        const live = this.foes.filter((f) => !f.dead && f.state !== 'dead');
        if (!this.cleared && this.wave >= 0 && live.length === 0 && !this.waitingBoss()) {
            this.cleared = true;
            this.goT = 0;
            this.time = Math.min(STAGE_TIME, this.time + 20);
            audio.sfx('go');
        }
        if (!this.stageDone && this.bossIntro && live.length === 0 && this.foes.some((f) => f.boss && f.dead)) {
            this.stageClear();
        }
    }

    waitingBoss() {
        return this.wave >= this.stage.waves.length - 1 && !this.bossIntro && this.hero.x < this.stage.boss.lock - 400;
    }

    stageClear() {
        if (this.stageDone) return;
        this.stageDone = true;
        this.score += this.time * 100 + this.lives * 1000;
        if (this.stageIndex >= STAGES.length - 1) {
            this.won = true;
            this.hero.setState('win');
            audio.sfx('win');
            audio.stopMusic();
        } else {
            this.banner = { title: 'FASE LIMPA', sub: '+TEMPO  +VIDAS' };
            this.bannerT = 80;
            setTimeout(() => this.resetStage(this.stageIndex + 1), 1400);
        }
    }

    killHero() {
        if (this.hero.dead) return;
        this.hero.hp = 0;
        this.hero.dead = true;
        this.hero.setState('knockdown');
        this.hero.vy = 8;
        this.hero.y = 1;
        audio.sfx('die');
    }

    checkHeroDeath() {
        if (!this.hero.dead) return;
        if (this.hero.state !== 'dead' && !(this.hero.state === 'knockdown' && this.hero.stateT > 50)) return;
        if (this._dying) return;
        this._dying = true;
        setTimeout(() => {
            this._dying = false;
            this.lives--;
            if (this.lives < 0) {
                this.over = true;
                this.continueT = 9;
                audio.stopMusic();
            } else {
                const x = this.hero.x;
                const z = this.hero.z;
                this.hero = makeHero(this.charId, x, z);
                this.hero.invuln = 80;
                this.time = Math.max(this.time, 40);
            }
        }, 900);
    }

    continue() {
        this.over = false;
        this.lives = 2;
        this.continueT = 0;
        const x = this.hero.x;
        this.hero = makeHero(this.charId, x, this.hero.z);
        this.hero.invuln = 90;
        this.time = STAGE_TIME;
        audio.startMusic(this.stage.music);
    }

    project(actor) {
        actor.sx = actor.x - this.camX;
        actor.sy = groundY(actor.z) - actor.y;
    }

    render(ctx) {
        const shx = (Math.random() - 0.5) * this.shake;
        const shy = (Math.random() - 0.5) * this.shake * 0.5;
        ctx.save();
        ctx.translate(shx, shy);
        drawStage(ctx, this.stage, this.camX, this.tick);

        const drawables = [];
        for (const c of this.crates) {
            drawables.push({ z: c.z, draw: () => drawCrate(ctx, c.x - this.camX, groundY(c.z), c.broken) });
        }
        for (const it of this.items) {
            it.sx = it.x - this.camX;
            it.sy = groundY(it.z);
            drawables.push({ z: it.z, draw: () => drawItem(ctx, it, this.tick) });
        }
        for (const s of this.shots) {
            drawables.push({
                z: s.z,
                draw: () => {
                    ctx.save();
                    ctx.globalAlpha = 0.9;
                    ctx.fillStyle = s.kind === 'orb' ? '#d060ff' : s.kind === 'sand' ? '#e0c060' : '#1a0c14';
                    ctx.beginPath();
                    ctx.ellipse(s.x - this.camX, groundY(s.z) - s.y, 14, 10, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            });
        }
        const folks = [this.hero, ...this.foes].filter((a) => a.state !== 'dead' || a.stateT < 40);
        for (const a of folks) {
            this.project(a);
            drawables.push({ z: a.z, draw: () => drawActor(ctx, a, this.tick) });
        }
        drawables.sort((a, b) => b.z - a.z);
        for (const d of drawables) d.draw();

        for (const f of this.fx) drawFx(ctx, f);
        ctx.restore();

        this.drawHud(ctx);
    }

    drawHud(ctx) {
        const h = this.hero;
        const c = CHARACTERS[this.charId];
        ctx.save();
        ctx.fillStyle = 'rgba(8,6,12,0.55)';
        ctx.fillRect(0, 0, VW, 78);

        ctx.fillStyle = '#1a1014';
        ctx.fillRect(24, 18, 54, 54);
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(24, 18, 54, 54);
        ctx.save();
        ctx.beginPath();
        ctx.rect(24, 18, 54, 54);
        ctx.clip();
        drawActor(ctx, { ...h, sx: 52, sy: 78, facing: 1, state: 'idle', stateT: 0, y: 0, invuln: 0, flash: 0, scale: 0.42 }, this.tick);
        ctx.restore();

        ctx.font = '700 14px "Press Start 2P", monospace';
        ctx.fillStyle = c.color;
        ctx.fillText(c.name, 92, 34);
        ctx.fillStyle = '#8a8090';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillText(`1P`, 92, 50);

        const ratio = h.hp / h.maxHp;
        ctx.fillStyle = '#1a1018';
        ctx.fillRect(92, 56, 280, 14);
        ctx.fillStyle = ratio > 0.5 ? '#3ecf6a' : ratio > 0.25 ? '#e0c040' : '#e04040';
        ctx.fillRect(92, 56, 280 * Math.max(0, ratio), 14);
        ctx.strokeStyle = '#f0e8d0';
        ctx.lineWidth = 2;
        ctx.strokeRect(92, 56, 280, 14);

        ctx.fillStyle = c.accent;
        for (let i = 0; i < Math.max(0, this.lives); i++) {
            ctx.beginPath();
            ctx.arc(390 + i * 18, 36, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.textAlign = 'center';
        ctx.font = '700 28px "Press Start 2P", monospace';
        ctx.fillStyle = this.time < 15 ? '#ff5050' : '#f4ead8';
        ctx.fillText(String(Math.max(0, this.time)).padStart(2, '0'), VW / 2, 48);
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#8a8090';
        ctx.fillText('TEMPO', VW / 2, 22);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#f4ead8';
        ctx.font = '700 14px "Press Start 2P", monospace';
        ctx.fillText(String(this.score).padStart(7, '0'), VW - 28, 40);
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#8a8090';
        ctx.fillText(this.stage.name, VW - 28, 58);
        ctx.textAlign = 'left';

        const boss = this.foes.find((f) => f.boss && !f.dead);
        if (boss) {
            ctx.fillStyle = 'rgba(8,6,12,0.5)';
            ctx.fillRect(VW / 2 - 220, 86, 440, 28);
            ctx.fillStyle = '#1a1018';
            ctx.fillRect(VW / 2 - 200, 96, 400, 12);
            ctx.fillStyle = '#c43b3b';
            ctx.fillRect(VW / 2 - 200, 96, 400 * (boss.hp / boss.maxHp), 12);
            ctx.strokeStyle = '#f0e8d0';
            ctx.strokeRect(VW / 2 - 200, 96, 400, 12);
            ctx.textAlign = 'center';
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#f0e8d0';
            ctx.fillText(boss.name, VW / 2, 92);
            ctx.textAlign = 'left';
        }

        if (this.combo >= 2 && this.comboT > 0) {
            ctx.font = '700 16px "Press Start 2P", monospace';
            ctx.fillStyle = '#f0c14a';
            ctx.fillText(`${this.combo} HIT`, 92, 100);
        }

        if (this.cleared && !this.bossIntro) {
            ctx.textAlign = 'right';
            ctx.font = '700 28px "Press Start 2P", monospace';
            ctx.fillStyle = `rgba(244, 234, 216, ${0.6 + Math.sin(this.goT * 0.15) * 0.4})`;
            ctx.fillText('GO ▶', VW - 36, VH * 0.48);
            ctx.textAlign = 'left';
        }

        if (this.bannerT > 0 && this.banner) {
            const a = Math.min(1, this.bannerT / 12, (90 - Math.min(90, this.bannerT)) / 12);
            ctx.globalAlpha = Math.max(0, a);
            ctx.fillStyle = 'rgba(8,4,10,0.72)';
            ctx.fillRect(0, VH * 0.38, VW, 90);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f4ead8';
            ctx.font = '700 22px "Press Start 2P", monospace';
            ctx.fillText(this.banner.title, VW / 2, VH * 0.38 + 42);
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = CHARACTERS[this.charId].color;
            ctx.fillText(this.banner.sub, VW / 2, VH * 0.38 + 70);
            ctx.globalAlpha = 1;
            ctx.textAlign = 'left';
        }
        ctx.restore();
    }
}

const BOSSES_TITLE = {
    imhotep: 'O ETERNO',
    morgana: 'SENHORA DA NÉVOA',
    baron: 'NOCTURNO'
};

function signish(v) {
    return v < 0 ? -1 : 1;
}
