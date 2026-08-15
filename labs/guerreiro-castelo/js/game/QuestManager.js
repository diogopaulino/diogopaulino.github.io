/**
 * Objetivos da aventura. O HUD mostra o atual; atualizações exibem banner.
 */

export const QUEST_ORDER = [
    { id: 'explore_ship', text: 'Explore o navio' },
    { id: 'talk_crew', text: 'Fale com seus companheiros' },
    { id: 'horizon', text: 'Observe o horizonte' },
    { id: 'check_helm', text: 'Verifique o leme' },
    { id: 'free_helm', text: 'Liberte o leme' },
    { id: 'steer_rock', text: 'Desvie da rocha' },
    { id: 'reach_castle', text: 'Chegue até o castelo' },
    { id: 'other_entrance', text: 'Encontre outra entrada' },
    { id: 'hidden_door', text: 'Chegue até a entrada escondida' },
    { id: 'open_door', text: 'Abra a porta' },
    { id: 'stealth_up', text: 'Suba sem ser descoberto' },
    { id: 'steal_keys', text: 'Pegue as chaves' },
    { id: 'find_camila', text: 'Encontre a princesa' },
    { id: 'cell_key', text: 'Encontre a chave da cela' },
    { id: 'teco_tiger', text: 'Peça ajuda a Teco' },
    { id: 'back_camila', text: 'Volte para Camila' },
    { id: 'free_camila', text: 'Liberte Camila' },
    { id: 'flee', text: 'FUJA DO CASTELO' },
    { id: 'reach_ship', text: 'Chegue ao navio' },
    { id: 'untie', text: 'Solte as amarras' },
    { id: 'raise_sail', text: 'Levante a vela' },
    { id: 'take_helm', text: 'Assuma o leme' },
    { id: 'escaped', text: 'Você escapou' }
];

export class QuestManager {
    constructor(game) {
        this.game = game;
        this.current = QUEST_ORDER[0];
        this.completed = new Set();
    }

    set(id) {
        const q = QUEST_ORDER.find((x) => x.id === id);
        if (!q) return;
        this.current = q;
        if (this.game && this.game.hud) {
            this.game.hud.showObjective(q.text, id === 'flee');
        }
    }

    complete(id) {
        this.completed.add(id);
        const i = QUEST_ORDER.findIndex((x) => x.id === id);
        if (i >= 0 && i + 1 < QUEST_ORDER.length && this.current.id === id) {
            this.set(QUEST_ORDER[i + 1].id);
        }
    }
}
