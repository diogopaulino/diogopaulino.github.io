import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// O jogo pode recarregar ao trocar a qualidade. Espere o menu inicializar
// antes de ler os valores, inclusive jogos que montam as opções via JS.
export async function checkGameSettings(evaluate, reload, waitFor) {
    if (!await evaluate("!!document.querySelector('#volumeSlider')")) return;
    const ready = `document.querySelector('#volumeSlider') &&
        (document.querySelector('#startButton,#btnNew,#btnNewGame')?.offsetWidth ||
         document.querySelector('#qualitySelect')?.offsetWidth)`;
    await waitFor(ready);
    const initial = await evaluate(`({
        volume: document.querySelector('#volumeSlider').value,
        quality: document.querySelector('#qualitySelect').value,
        options: Array.from(document.querySelector('#qualitySelect').options, option => option.value)
    })`);
    const set = (id, value, event) => evaluate(`(() => {
        const control = document.getElementById(${JSON.stringify(id)});
        control.value = ${JSON.stringify(String(value))};
        control.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true }));
    })()`);
    const alternative = initial.options.find(q => q !== initial.quality);
    assert.ok(alternative, 'O menu precisa oferecer outra qualidade');
    try {
        for (const volume of [0, 100, 37]) {
            await set('volumeSlider', volume, 'input');
            assert.equal(await evaluate("parseInt(document.querySelector('#volumeValue').textContent)"), volume);
        }
        await set('qualitySelect', alternative, 'change');
        await delay(350);
        await reload();
        await waitFor(ready);
        await waitFor(`document.querySelector('#volumeSlider').value === '37' &&
            document.querySelector('#qualitySelect').value === ${JSON.stringify(alternative)}`);
    } finally {
        await waitFor(ready);
        await set('volumeSlider', initial.volume, 'input');
        await set('qualitySelect', initial.quality, 'change');
    }
}
