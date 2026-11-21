// Avança até o adversário e alterna golpes usando os controles da arena.
export function fightRounds() {
    const { match, step } = window.__lab;
    let held = [];
    function press(keys) {
        for (const code of held) if (!keys.includes(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        for (const code of keys) if (!held.includes(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        held = keys;
    }
    let hits = false;
    for (let frame = 0; frame < 42000 && match.phase !== 'complete'; frame++) {
        const next = [];
        if (match.phase === 'fight') {
            const gap = match.p2.x - match.p1.x;
            if (Math.abs(gap) > 48) next.push(gap > 0 ? 'KeyD' : 'KeyA');
            if (frame % 8 < 4) next.push(['KeyK', 'KeyJ', 'KeyL', 'KeyU'][Math.floor(frame / 8) % 4]);
        }
        press(next);
        step();
        if (match.p2.health < 100) hits = true;
    }
    press([]);
    return { hits, phase: match.phase, wins: Math.max(match.p1.wins, match.p2.wins) };
}

// Exercita regressões do motor com os mesmos lutadores e comandos da arena.
export async function checkCombat() {
    const [{ FIGHTERS, GROUND, LEFT_WALL }, { InputBuffer }, { Fighter, moveFor }, combat] = await Promise.all([
        import('../labs/rock-kombat/constants.js'),
        import('../labs/rock-kombat/input.js'),
        import('../labs/rock-kombat/fighter.js'),
        import('../labs/rock-kombat/combat.js')
    ]);
    const { applyHit, bodyPush, resolveCombat, spawnProjectile, updateProjectiles } = combat;

    function assert(condition, detail) {
        if (!condition) throw new Error(detail);
    }

    function setup(first = 0, second = 1) {
        const p1 = new Fighter(FIGHTERS[first], new InputBuffer());
        const p2 = new Fighter(FIGHTERS[second], new InputBuffer(), true);
        const match = { p1, p2, effects: [], rings: [], projectiles: [], damageNumbers: [], events: [], shake: 0, hitStop: 0 };
        p1.setMatch(match);
        p2.setMatch(match);
        p1.reset(700);
        p2.reset(800);
        let frame = 0;

        function step(count = 1) {
            for (let i = 0; i < count; i++) {
                frame++;
                p1.input.updateFrame(frame);
                p2.input.updateFrame(frame);
                p1.update(p2);
                p2.update(p1);
                bodyPush(match);
                resolveCombat(match);
                updateProjectiles(match);
            }
        }

        return { p1, p2, match, step };
    }

    {
        const { p1, p2, step } = setup();
        p1.input.tap('light');
        step();
        p1.input.tap('medium');
        step(5);
        assert(p1.move?.name === 'medium' && p2.health < 100, 'Comando antecipado não encaixou no combo');
        step(8);
        assert(p1.combo === 2 && p1.comboDamage > 0, 'Segundo golpe não entrou no combo');
    }

    {
        const { p1, p2, step } = setup();
        p1.input.tap('launcher');
        step(9);
        assert(p2.launched, 'Lançador não levantou o rival');
        p1.input.tap('jump');
        step();
        assert(p1.superJumping && !p1.grounded(), 'Lançador não aceitou o salto com toque rápido');
        step(7);
        p1.input.tap('light');
        step(7);
        assert(p1.combo >= 2, 'Golpe aéreo não conectou após o lançador');
    }

    {
        const { p1, p2, step } = setup();
        p2.x = 1140;
        p1.input.tap('jump');
        step(10);
        assert(p1.y < GROUND - 95, 'Salto não chegou à altura do dash');
        p1.input.tap('dash');
        step();
        assert(p1.dashType === 'air', 'Dash aéreo não começou');
        step(70);
        assert(p1.grounded() && p1.dashType === null, 'Dash aéreo travou a queda');
    }

    {
        const { p1, p2, match } = setup();
        p1.x = LEFT_WALL;
        p2.x = LEFT_WALL + 4;
        bodyPush(match);
        assert(p1.x === LEFT_WALL && p2.x - p1.x === 94, 'Colisão de corpo cedeu no canto');
        p1.beginMove('light');
        p2.beginMove('light');
        p1.moveFrame = p1.move.startup;
        p2.moveFrame = p2.move.startup;
        resolveCombat(match);
        assert(p1.health < 100 && p2.health < 100, 'O primeiro jogador teve prioridade em golpes simultâneos');
    }

    {
        const { p1, p2, match } = setup();
        p1.beginMove('throw');
        p1.moveFrame = p1.move.startup;
        p2.y -= 12;
        resolveCombat(match);
        assert(p2.health === 100, 'Agarrão terrestre acertou um rival no ar');
        p2.y = GROUND;
        resolveCombat(match);
        assert(p2.health < 100 && p2.launched, 'Agarrão não acertou um rival ao alcance');
    }

    {
        const { p1, p2, match } = setup();
        const move = moveFor(p1, 'special');
        p1.beginMove('heavy');
        p2.input.down('right');
        spawnProjectile(match, p1, move);
        updateProjectiles(match);
        assert(p2.health === 100 && match.projectiles.length === 0, 'Projétil não foi aparado');
        assert(p1.move?.name === 'heavy', 'Aparar projétil interrompeu remotamente seu dono');
    }

    {
        const { p1, p2, match } = setup();
        p1.wins = 1;
        p2.health = 2;
        const light = moveFor(p1, 'light');
        applyHit(match, p1, p2, light);
        assert(p2.health === 1 && p2.state === 'dizzy' && match.finishTimer === 210, 'Finalização não abriu no último round');
        applyHit(match, p1, p2, light);
        assert(p2.health === 0 && match.stageFinisher && !match.hyperFinish, 'Nocaute comum foi identificado como Hyper');
    }

    for (let index = 0; index < FIGHTERS.length; index++) {
        const { p1, p2, step } = setup(index, (index + 1) % FIGHTERS.length);
        p1.meter = 200;
        p2.x = 980;
        p1.input.tap('hyper');
        step(94);
        assert(p1.meter < 200 && p2.health < 88, `Hyper de ${p1.data.name} não atingiu o rival`);
    }

    return true;
}
