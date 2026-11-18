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
        const answer = type === 'translate' ? lesson.word : lesson.fillAnswer;
        buttons('.option-card').find(b => b.querySelector('.option-text').textContent === answer).click();
    }
    if (!DOM.feedbackArea.matches('.correct')) throw Error('Sem confirmação para ' + type);
    DOM.nextBtn.click();
}
