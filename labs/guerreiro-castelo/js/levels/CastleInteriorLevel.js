/**
 * Capítulo 8: Calabouço, Furtividade & Guarda Dorminhoco em Babylon.js.
 */

import { Level } from './Level.js';
import { castleStoneTexture, woodTexture } from '../world/Textures.js';
import { makeTorch, EnvironmentFX } from '../world/Environment.js';
import { Guard } from '../characters/Guard.js';

export class CastleInteriorLevel extends Level {
    get id() {
        return 'interior';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('interiorGroup', scene);
        this.fx = new EnvironmentFX();

        const stoneMat = new BABYLON.StandardMaterial('dungeonStoneMat', scene);
        stoneMat.diffuseTexture = castleStoneTexture(scene, 6, 8);
        stoneMat.diffuseColor = new BABYLON.Color3(0.7, 0.68, 0.65);

        const woodMat = new BABYLON.StandardMaterial('dungeonWoodMat', scene);
        woodMat.diffuseTexture = woodTexture(scene, 2, 2);

        const darkHoleMat = new BABYLON.StandardMaterial('dungeonDarkMat', scene);
        darkHoleMat.diffuseColor = new BABYLON.Color3(0.05, 0.04, 0.03);

        const room = (name, w, h, d, x, y, z, open = []) => {
            const floor = BABYLON.MeshBuilder.CreateBox(`${name}_floor`, { width: w, height: 0.2, depth: d }, scene);
            floor.position.set(x, y - 0.1, z);
            floor.material = stoneMat;
            floor.parent = this.group;
            floor.receiveShadows = true;
            this.game.collision.addFloor(x, z, w, d, y);

            const ceil = BABYLON.MeshBuilder.CreateBox(`${name}_ceil`, { width: w, height: 0.2, depth: d }, scene);
            ceil.position.set(x, y + h, z);
            ceil.material = stoneMat;
            ceil.parent = this.group;

            if (!open.includes('-z')) this.game.collision.addWall(x, z - d / 2, w, 0.3, h, y);
            if (!open.includes('+z')) this.game.collision.addWall(x, z + d / 2, w, 0.3, h, y);
            if (!open.includes('-x')) this.game.collision.addWall(x - w / 2, z, 0.3, d, h, y);
            if (!open.includes('+x')) this.game.collision.addWall(x + w / 2, z, 0.3, d, h, y);
        };

        // Salas do calabouço
        room('roomEntry', 6, 3.4, 10, 0, 0, 0, ['-z']);

        // Escadaria de pedra
        const stairs = new BABYLON.TransformNode('dungeonStairs', scene);
        stairs.parent = this.group;
        for (let i = 0; i < 10; i++) {
            const st = BABYLON.MeshBuilder.CreateBox(`stair_${i}`, { width: 2.2, height: 0.22, depth: 0.7 }, scene);
            st.position.set(0, 0.11 + i * 0.32, -6 - i * 0.55);
            st.material = stoneMat;
            st.parent = stairs;
            this.game.collision.addFloor(0, -6 - i * 0.55, 2.2, 0.7, 0.22 + i * 0.32);
        }

        room('roomCorridor', 10, 3.6, 12, 0, 3.2, -18, ['+z', '-z', '-x', '+x']);
        room('roomCell', 8, 3.4, 10, 0, 3.2, -32, ['+z', '-z']);
        room('roomSideLeft', 6, 3.2, 6, -10, 3.2, -18, ['+x']);
        room('roomSideRight', 6, 3.2, 6, 12, 3.2, -18, ['-x']);

        // Porta da cela e barras de ferro
        this.cellDoor = BABYLON.MeshBuilder.CreateBox('cellDoor', { width: 1.6, height: 2.4, depth: 0.12 }, scene);
        this.cellDoor.position.set(0, 4.4, -37.1);
        this.cellDoor.material = woodMat;
        this.cellDoor.parent = this.group;

        const ironMat = new BABYLON.StandardMaterial('ironBarsMat', scene);
        ironMat.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.35);

        const bars = new BABYLON.TransformNode('cellBarsGroup', scene);
        bars.parent = this.group;
        for (let i = 0; i < 6; i++) {
            const b = BABYLON.MeshBuilder.CreateCylinder(`cellBar_${i}`, { diameter: 0.06, height: 2.2 }, scene);
            b.position.set(-0.6 + i * 0.24, 4.4, -37);
            b.material = ironMat;
            b.parent = bars;
        }
        this.bars = bars;

        // Tochas do calabouço
        const torch1 = makeTorch(scene);
        torch1.position.set(-2.4, 1.4, -2);
        torch1.parent = this.group;
        this.fx.addFire(torch1);

        const torch2 = makeTorch(scene);
        torch2.position.set(2.6, 4.6, -18);
        torch2.parent = this.group;
        this.fx.addFire(torch2);

        // Vaso de cerâmica que pode ser derrubado
        const vase = BABYLON.MeshBuilder.CreateCylinder('dungeonVase', {
            diameterTop: 0.24,
            diameterBottom: 0.32,
            height: 0.45
        }, scene);
        vase.position.set(3.2, 3.42, -14);
        const vaseMat = new BABYLON.StandardMaterial('vaseMat', scene);
        vaseMat.diffuseColor = new BABYLON.Color3(0.55, 0.32, 0.18);
        vase.material = vaseMat;
        vase.parent = this.group;

        this.addInteract({
            object: vase,
            interactionLabel: 'Não tocar no vaso',
            interactionDistance: 1.6,
            interact: (_p, game) => {
                vase.rotation.z = 1.2;
                vase.position.y = 3.22;
                game.collision.emitNoise(3.2, -14, 1.4, 0.8);
                game.audio.play('fail');
                game.hud.showStealth(true, 0.8);
            }
        });

        // Guarda dorminhoco
        this.sleeping = new Guard(this.group, { fat: true, sleep: true });
        this.sleeping.spawn(1.4, 3.2, -16.5, 1.2);
        this.game.combat.setGuards([this.sleeping]);

        this.addInteract({
            object: this.sleeping.root,
            interactionLabel: 'Pegar chaves',
            interactionDistance: 1.8,
            interact: (_p, game) => this.stealKeys(game)
        });

        // Camila na cela
        this.game.camila.attachTo(this.group);
        this.game.camila.spawn(0, 3.2, -39.5);
        this.game.camila.setShackles(true);
        this.game.camila.ai.state = 'WAIT';
        this.game.camila.root.setEnabled(true);
        this.game.camila.active = true;

        this.addInteract({
            object: this.game.camila.root,
            interactionLabel: 'Conversar com Camila',
            interactionDistance: 2.4,
            interact: (_p, game) => this.talkCamila(game)
        });

        this.addInteract({
            object: this.cellDoor,
            interactionLabel: 'Usar chave',
            interactionDistance: 2.2,
            interact: (_p, game) => this.tryCell(game)
        });

        // Luz de tocha móvel com Dico
        this.torchLight = new BABYLON.PointLight('dicoTorchLight', new BABYLON.Vector3(0, 0, 0), scene);
        this.torchLight.diffuse = new BABYLON.Color3(1.0, 0.6, 0.2);
        this.torchLight.intensity = 1.1;
        this.torchLight.range = 8;
        this.torchLight.parent = this.group;

        this.obstacles = this.group.getChildMeshes ? this.group.getChildMeshes() : [];
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
        g.ocean.visible = false;
        g.quests.set('stealth_up');
        g.dialogue.say('DICO', 'Devagar… não faça barulho.');
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
        game.dialogue.say('GUARDA', '…hmm… quem está aí…');
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
            this.bars.setEnabled(false);
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
        else game.dialogue.say('DICO', 'Nenhuma das três. Teco, a fechadura é outra. Deve estar na outra sala.');
    }

    tryShackles(game) {
        game.audio.play('fail');
        game.dialogue.say('DICO', 'Tentando os grilhões…');
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

        const p = this.game.player.position;
        this.torchLight.position.set(p.x + 0.3, p.y + 1.5, p.z + 0.2);
        this.torchLight.intensity = 1.0 + Math.sin(this.time * 10) * 0.15;

        const noise = this.game.player.noise || 0;
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
        this.game.ocean.visible = true;
    }
}
