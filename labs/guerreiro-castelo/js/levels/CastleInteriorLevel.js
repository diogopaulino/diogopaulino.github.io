import * as THREE from 'three';
import { Level } from './Level.js';
import { castleStoneTexture, woodTexture } from '../world/Textures.js';
import { std } from '../characters/builders.js';
import { makeTorch, EnvironmentFX } from '../world/Environment.js';
import { Guard } from '../characters/Guard.js';
function stoneMat() {
    return new THREE.MeshStandardMaterial({ map: castleStoneTexture(), roughness: 0.9, color: 0x8a8478 });
}

export class CastleInteriorLevel extends Level {
    get id() {
        return 'interior';
    }

    async build() {
        this.group = new THREE.Group();
        this.fx = new EnvironmentFX();
        const stone = stoneMat();
        const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 });

        const room = (w, h, d, x, y, z, open = []) => {
            const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), stone);
            floor.position.set(x, y - 0.1, z);
            floor.receiveShadow = true;
            this.group.add(floor);
            this.game.collision.addFloor(x, z, w, d, y);
            const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), stone);
            ceil.position.set(x, y + h, z);
            this.group.add(ceil);
            if (!open.includes('-z')) this.game.collision.addWall(x, z - d / 2, w, 0.3, h, y);
            if (!open.includes('+z')) this.game.collision.addWall(x, z + d / 2, w, 0.3, h, y);
            if (!open.includes('-x')) this.game.collision.addWall(x - w / 2, z, 0.3, d, h, y);
            if (!open.includes('+x')) this.game.collision.addWall(x + w / 2, z, 0.3, d, h, y);
        };

        room(6, 3.4, 10, 0, 0, 0, ['-z']);
        const stairs = new THREE.Group();
        for (let i = 0; i < 10; i++) {
            const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.7), stone);
            st.position.set(0, 0.11 + i * 0.32, -6 - i * 0.55);
            stairs.add(st);
            this.game.collision.addFloor(0, -6 - i * 0.55, 2.2, 0.7, 0.22 + i * 0.32);
        }
        this.group.add(stairs);

        room(10, 3.6, 12, 0, 3.2, -18, ['+z', '-z', '-x', '+x']);
        room(8, 3.4, 10, 0, 3.2, -32, ['+z', '-z']);
        room(6, 3.2, 6, -10, 3.2, -18, ['+x']);
        room(6, 3.2, 6, 12, 3.2, -18, ['-x']);

        const openings = [
            [0, 1.6, -5, 2, 2.4, 0.4],
            [0, 4.6, -24, 2.2, 2.6, 0.4],
            [-5, 4.6, -18, 0.4, 2.4, 2],
            [5.2, 4.6, -18, 0.4, 2.4, 2]
        ];
        for (const o of openings) {
            const hole = new THREE.Mesh(new THREE.BoxGeometry(o[3], o[4], o[5]), std(0x080604, 1));
            hole.position.set(o[0], o[1], o[2]);
            this.group.add(hole);
        }

        this.cellDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.12), wood);
        this.cellDoor.position.set(0, 4.4, -37.1);
        this.group.add(this.cellDoor);
        const bars = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), std(0x555555, 0.4, 0.7));
            b.position.set(-0.6 + i * 0.24, 4.4, -37);
            bars.add(b);
        }
        this.group.add(bars);
        this.bars = bars;

        const torch1 = makeTorch();
        torch1.position.set(-2.4, 1.4, -2);
        this.group.add(torch1);
        this.fx.addFire(torch1);
        const torch2 = makeTorch();
        torch2.position.set(2.6, 4.6, -18);
        this.group.add(torch2);
        this.fx.addFire(torch2);

        for (let i = 0; i < 4; i++) {
            const rat = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), std(0x3a3a32, 0.9));
            rat.scale.set(1.4, 0.7, 2);
            rat.position.set(-1 + i * 0.7, 0.08, -1 + (i % 2));
            this.group.add(rat);
            this._rats = this._rats || [];
            this._rats.push(rat);
        }

        const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.4, 8), std(0x6a4a2a, 0.7));
        vase.position.set(3.2, 3.42, -14);
        vase.name = 'vase';
        this.group.add(vase);
        this.addInteract({
            object: vase,
            interactionLabel: 'Não tocar',
            interactionDistance: 1.6,
            interact: (_p, game) => {
                vase.rotation.z = 1.2;
                vase.position.y = 3.22;
                game.collision.emitNoise(3.2, -14, 1.4, 0.8);
                game.audio.play('fail');
                game.hud.showStealth(true, 0.8);
            }
        });

        this.sleeping = new Guard(this.group, { fat: true, sleep: true });
        this.sleeping.spawn(1.4, 3.2, -16.5, 1.2);
        this.game.combat.setGuards([this.sleeping]);

        this.addInteract({
            object: this.sleeping.root,
            interactionLabel: 'Pegar chaves',
            interactionDistance: 1.7,
            interact: (_p, game) => this.stealKeys(game)
        });

        this.game.camila.attachTo(this.group);
        this.game.camila.spawn(0, 3.2, -39.5);
        this.game.camila.setShackles(true);
        this.game.camila.ai.state = 'WAIT';
        this.game.camila.root.visible = true;
        this.game.camila.active = true;

        this.addInteract({
            object: this.game.camila.root,
            interactionLabel: 'Conversar',
            interactionDistance: 2.4,
            interact: (_p, game) => this.talkCamila(game)
        });
        this.addInteract({
            object: this.cellDoor,
            interactionLabel: 'Usar chave',
            interactionDistance: 2.2,
            interact: (_p, game) => this.tryCell(game)
        });

        const drip = new THREE.PointLight(0x6688aa, 0.15, 6);
        drip.position.set(2, 2, -4);
        this.group.add(drip);
        this.torchLight = new THREE.PointLight(0xff9030, 1.1, 8);
        this.group.add(this.torchLight);

        this.game.scene.add(this.group);
        this.obstacles = [];
        this.group.traverse((c) => { if (c.isMesh) this.obstacles.push(c); });
        this.keysTaken = false;
        this.cellTried = 0;
        this.alarmArmed = false;
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.group);
        g.teco.attachTo(this.group);
        g.camila.attachTo(this.group);
        g.player.spawn(0, 0, 3.2, Math.PI);
        g.teco.spawn(0.5, 0, 2.6);
        g.player.setTorch(true);
        g.weather.apply('interior');
        g.audio.setTheme('stealth');
        g.storm.setIntensity(0);
        g.ocean.water.visible = false;
        g.quests.set('stealth_up');
        g.dialogue.say('DICO', 'Devagar…');
        g.teco.ai.state = 'PERCHED';
        g.cameraRig.setObstacles(this.obstacles);
        g.input.enabled = true;
        g.player.controller.setMode('walk');
        g.hud.showStealth(true, 0);
        g.input.requestLock();
    }

    stealKeys(game) {
        if (this.keysTaken) return;
        this.keysTaken = true;
        this.sleeping.hasKeys = false;
        game.audio.play('clink');
        game.dialogue.say('GUARDA', '…hmm…');
        game.hud.showStealth(true, 0.7);
        game.story.notify('keys');
        this.sleeping.ai.suspicion = 0.4;
        this.sleeping.root.rotation.y += 0.5;
        setTimeout(() => {
            if (this.sleeping.ai.state === 'SLEEP') {
                this.sleeping.root.rotation.y -= 0.5;
            }
        }, 1800);
    }

    talkCamila(game) {
        if (!game.story.flags.foundCamila) {
            game.dialogue.play([
                { speaker: 'DICO', text: 'Princesa, viemos salvar você.', duration: 3 },
                { speaker: 'CAMILA', text: 'Vocês vieram mesmo!', duration: 2.8 },
                { speaker: 'DICO', text: 'Vou tirar você daí.', duration: 2.6 }
            ]);
            game.story.notify('found_camila');
        } else if (game.story.flags.cellOpen && !game.story.flags.shacklesOpen) {
            this.tryShackles(game);
        }
    }

    tryCell(game) {
        if (game.story.flags.cellOpen) return;
        if (game.inventory.cellKey) {
            this.cellDoor.rotation.y = 1.5;
            this.bars.visible = false;
            game.audio.play('click');
            game.audio.play('door');
            game.story.notify('cell_open');
            game.dialogue.say('DICO', 'A chave certa.');
            return;
        }
        if (!game.inventory.keys) {
            game.dialogue.say('DICO', 'Preciso de uma chave.');
            return;
        }
        this.cellTried += 1;
        game.story.notify('wrong_key');
        game.audio.play('fail');
        const n = this.cellTried;
        if (n === 1) game.dialogue.say('DICO', 'Não é esta…');
        else if (n === 2) game.dialogue.say('DICO', 'Tampouco esta.');
        else game.dialogue.say('DICO', 'Nenhuma das três. Teco, a fechadura é outra.');
    }

    tryShackles(game) {
        game.audio.play('fail');
        game.dialogue.say('DICO', 'Primeira… não. Segunda… nada.');
        setTimeout(() => {
            game.audio.play('click');
            game.story.notify('shackles');
            this.alarmArmed = true;
        }, 1600);
    }

    update(dt) {
        this.time += dt;
        this.fx.update(this.time);
        this.sleeping.update(dt, this.game);
        if (this._rats) {
            for (let i = 0; i < this._rats.length; i++) {
                this._rats[i].position.x = Math.sin(this.time * 1.5 + i) * 1.4 - 1;
            }
        }
        const p = this.game.player.position;
        this.torchLight.position.set(p.x + 0.3, p.y + 1.5, p.z + 0.2);
        this.torchLight.intensity = 1 + Math.sin(this.time * 10) * 0.15;

        const noise = this.game.player.noise;
        this.game.hud.showStealth(true, Math.min(1, this.sleeping.ai.suspicion + noise * 0.3));

        if (this.alarmArmed && p.z > -22 && p.y > 2.5 && !this.game.story.flags.alarm) {
            this.sleeping.ai.state = 'CHASE';
            this.game.story.notify('alarm');
        }
    }

    exit() {
        super.exit();
        this.game.player.setTorch(false);
        this.game.hud.showStealth(false);
        this.game.ocean.water.visible = true;
    }
}
