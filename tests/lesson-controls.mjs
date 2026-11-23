// Resolve a questão atual pelos elementos que o aluno usa.
export async function answerExercise() {
    const { lesson, type } = gameState.currentExercise;
    const options = DOM.optionsContainer;
    const buttons = selector => [...options.querySelectorAll(selector)];
    if (type === 'matchPairs') {
        for (const word of buttons('[data-type=word]')) {
            word.click();
            buttons('[data-type=translation]').find(b => b.dataset.word === word.dataset.word).click();
        }
        await new Promise(resolve => setTimeout(resolve, 400));
    } else if (type === 'orderWords') {
        for (const word of lesson.sentenceWords) {
            buttons('#word-bank button').find(b => b.textContent === word && !b.disabled).click();
        }
        options.querySelector('.btn-submit').click();
    } else if (type === 'writeWord' || type === 'listenWrite') {
        options.querySelector('input').value = type === 'writeWord' ? lesson.word : lesson.sentence;
        options.querySelector('.btn-submit').click();
    } else {
        // Múltipla escolha: apresentação de palavra nova e tradução pedem a
        // palavra no idioma; "o que significa?" pede a tradução; "ouça e
        // escolha" (japonês, coreano, chinês) pede a frase ouvida.
        const answer = {
            introduce: lesson.word,
            translate: lesson.word,
            reverse: lesson.translation,
            listenChoose: lesson.sentence,
            fillBlank: lesson.fillAnswer
        }[type];
        if (answer === undefined) throw Error('Tipo de exercício sem resposta no teste: ' + type);
        const option = buttons('.option-card').find(b => b.querySelector('.option-text').textContent === answer);
        if (!option) throw Error(`Opção "${answer}" ausente em ${type}`);
        option.click();
    }
    if (!DOM.feedbackArea.matches('.correct')) throw Error('Sem confirmação para ' + type);
    DOM.nextBtn.click();
}
