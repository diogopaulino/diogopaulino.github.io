/**
 * Encadeia os 12 capítulos. Níveis não ficam isolados — o diretor avança sozinho.
 */

export class StoryDirector {
    constructor(game) {
        this.game = game;
        this.chapter = 1;
        this.phase = 'menu';
        this.flags = {
            talkedFriends: false,
            horizon: false,
            helm: false,
            tecoPlay: false,
            ropeFreed: false,
            rockCleared: false,
            reachedCastle: false,
            otherEntrance: false,
            atSecretDoor: false,
            doorOpen: false,
            keysTaken: false,
            foundCamila: false,
            triedKeys: 0,
            cellKey: false,
            cellOpen: false,
            shacklesOpen: false,
            alarm: false,
            atShip: false,
            untied: false,
            sailUp: false,
            escaped: false
        };
        this._busy = false;
    }

    resetFlags() {
        for (const k of Object.keys(this.flags)) {
            this.flags[k] = typeof this.flags[k] === 'number' ? 0 : false;
        }
    }

    notify(event, extra) {
        const g = this.game;
        switch (event) {
            case 'talk_friends':
                this.flags.talkedFriends = true;
                this._checkShipExplore();
                break;
            case 'horizon':
                this.flags.horizon = true;
                g.quests.complete('horizon');
                this._checkShipExplore();
                break;
            case 'helm':
                this.flags.helm = true;
                g.quests.complete('check_helm');
                this._checkShipExplore();
                break;
            case 'teco_play':
                this.flags.tecoPlay = true;
                this._checkShipExplore();
                break;
            case 'rope_freed':
                this.flags.ropeFreed = true;
                g.quests.set('steer_rock');
                g.checkpoints.save('storm_rope', this._saveBlob());
                g.dialogue.say('DICO', 'Assuma o leme!');
                g.level?.beginHelm?.();
                break;
            case 'rock_hit':
                g.failCheckpoint('A rocha…');
                break;
            case 'rock_cleared':
                this.flags.rockCleared = true;
                this._busy = true;
                g.level?.endStorm?.();
                g.fadeTo(1.6, () => {
                    g.loadStage('island', 'castle_beach');
                    this._busy = false;
                });
                break;
            case 'castle_view':
                this.flags.reachedCastle = true;
                g.quests.set('other_entrance');
                g.dialogue.say('AMIGO', 'Como vamos entrar aí?');
                g.checkpoints.save('castle_exterior', this._saveBlob());
                break;
            case 'teco_tree':
                this.flags.otherEntrance = true;
                g.quests.set('hidden_door');
                g.dialogue.say('DICO', 'O que você encontrou, Teco?');
                g.dialogue.say('DICO', 'Vamos por ali.');
                break;
            case 'at_secret':
                this.flags.atSecretDoor = true;
                g.quests.set('open_door');
                g.checkpoints.save('secret_door', this._saveBlob());
                break;
            case 'door_open':
                this.flags.doorOpen = true;
                g.quests.set('stealth_up');
                g.fadeTo(1.1, () => g.loadStage('interior', 'sleeping_guard'));
                break;
            case 'keys':
                this.flags.keysTaken = true;
                g.inventory.keys = 3;
                g.quests.set('find_camila');
                g.hud.showToast('3 chaves encontradas');
                g.checkpoints.save('sleeping_guard', this._saveBlob());
                break;
            case 'found_camila':
                this.flags.foundCamila = true;
                g.quests.set('cell_key');
                g.checkpoints.save('princess_cell', this._saveBlob());
                break;
            case 'wrong_key':
                this.flags.triedKeys += 1;
                break;
            case 'cell_key':
                this.flags.cellKey = true;
                g.inventory.cellKey = true;
                g.hud.showToast('Chave da cela');
                g.quests.set('back_camila');
                g.checkpoints.save('tiger_room', this._saveBlob());
                break;
            case 'cell_open':
                this.flags.cellOpen = true;
                g.quests.set('free_camila');
                break;
            case 'shackles':
                this.flags.shacklesOpen = true;
                g.camila.setShackles(false);
                g.camila.freed = true;
                g.camila.ai.follow();
                g.dialogue.say('CAMILA', 'Obrigada!');
                g.dialogue.say('DICO', 'Agora precisamos sair daqui.');
                g.checkpoints.save('princess_rescued', this._saveBlob());
                break;
            case 'alarm':
                this.flags.alarm = true;
                g.audio.setTheme('chase');
                g.audio.play('bell');
                g.quests.set('flee');
                g.hud.showObjective('FUJA DO CASTELO', true);
                g.dialogue.say('GUARDA', 'A princesa está fugindo!');
                g.dialogue.say('DICO', 'Corram!');
                g.camila.ai.run();
                g.checkpoints.save('escape_start', this._saveBlob());
                g.fadeTo(0.8, () => g.loadStage('escape', 'escape_start'));
                break;
            case 'reach_ship':
                this.flags.atShip = true;
                g.quests.set('untie');
                g.checkpoints.save('ship_escape', this._saveBlob());
                g.fadeTo(0.8, () => g.loadStage('shipEscape', 'ship_escape'));
                break;
            case 'untie':
                this.flags.untied = true;
                g.quests.set('raise_sail');
                break;
            case 'sail':
                this.flags.sailUp = true;
                g.quests.set('take_helm');
                break;
            case 'escaped':
                this.flags.escaped = true;
                g.quests.set('escaped');
                g.hud.showToast('Você escapou');
                g.fadeTo(1.8, () => g.loadStage('ending', 'ending'));
                break;
            case 'the_end':
                g.showEnding();
                break;
            default:
                if (extra) console.log('[story]', event, extra);
        }
    }

    _checkShipExplore() {
        const f = this.flags;
        const n = [f.talkedFriends, f.horizon, f.helm, f.tecoPlay].filter(Boolean).length;
        if (n >= 1 && this.game.quests.current.id === 'explore_ship') {
            this.game.quests.set('talk_crew');
        }
        if (f.talkedFriends && this.game.quests.current.id === 'talk_crew') this.game.quests.set('horizon');
        if (f.talkedFriends && f.horizon && f.helm && f.tecoPlay) {
            this.game.level?.beginNight?.();
        }
    }

    _saveBlob() {
        return {
            flags: { ...this.flags },
            inventory: { ...this.game.inventory },
            quest: this.game.quests.current.id,
            level: this.game.stageId
        };
    }

    applySave(data) {
        Object.assign(this.flags, data.flags || {});
        this.game.inventory = { keys: 0, cellKey: false, ...data.inventory };
        if (data.quest) this.game.quests.set(data.quest);
    }
}
