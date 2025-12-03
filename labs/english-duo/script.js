const gameState = {
    streak: 0,
    hearts: 3,
    progress: 0,
    currentQuestion: null,
    isProcessing: false
};

const DOM = {
    progressBar: document.getElementById('progress-bar'),
    streakCount: document.getElementById('streak-count'),
    heartsCount: document.getElementById('hearts-count'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    feedbackArea: document.getElementById('feedback-area'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackMessage: document.getElementById('feedback-message'),
    feedbackIcon: document.getElementById('feedback-icon'),
    nextBtn: document.getElementById('next-btn'),
    gameArea: document.getElementById('game-area'),
    gameOver: document.getElementById('game-over'),
    restartBtn: document.getElementById('restart-btn'),
    finalStreak: document.getElementById('final-streak')
};

const TOPICS = ['food', 'travel', 'music', 'sport', 'nature', 'technology', 'business', 'art', 'science', 'emotion'];

// Fallback data in case APIs fail
const FALLBACK_QUESTIONS = [
    {
        word: 'apple',
        definition: 'The round fruit of a tree of the rose family, which typically has thin red or green skin and crisp flesh.',
        distractors: ['banana', 'orange', 'grape']
    },
    {
        word: 'computer',
        definition: 'An electronic device for storing and processing data, typically in binary form.',
        distractors: ['calculator', 'phone', 'television']
    },
    {
        word: 'happy',
        definition: 'Feeling or showing pleasure or contentment.',
        distractors: ['sad', 'angry', 'tired']
    }
];

async function fetchWordsFromTopic(topic) {
    try {
        const response = await fetch(`https://api.datamuse.com/words?ml=${topic}&max=30`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error fetching words:', error);
        return [];
    }
}

async function fetchDefinition(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!response.ok) throw new Error('Definition not found');
        const data = await response.json();
        // Get the first definition of the first meaning
        const meaning = data[0].meanings[0];
        const definition = meaning.definitions[0].definition;
        return definition;
    } catch (error) {
        // console.warn(`No definition found for ${word}`);
        return null;
    }
}

async function generateQuestion() {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const words = await fetchWordsFromTopic(topic);

    if (words.length < 4) {
        // Fallback if not enough words
        return getRandomFallback();
    }

    // Try to find a word with a valid definition
    let targetWord = null;
    let definition = null;
    let attempts = 0;

    // Shuffle words to try random ones
    const shuffledWords = words.sort(() => 0.5 - Math.random());

    while (!targetWord && attempts < 5 && shuffledWords.length > 0) {
        const candidate = shuffledWords.pop();
        // Skip words with spaces or hyphens for simplicity
        if (candidate.word.includes(' ') || candidate.word.includes('-')) continue;

        definition = await fetchDefinition(candidate.word);
        if (definition) {
            targetWord = candidate.word;
        }
        attempts++;
    }

    if (!targetWord) {
        return getRandomFallback();
    }

    // Select 3 distractors
    const distractors = [];
    const usedWords = new Set([targetWord]);

    for (const w of words) {
        if (distractors.length >= 3) break;
        if (!usedWords.has(w.word) && !w.word.includes(' ') && !w.word.includes('-')) {
            distractors.push(w.word);
            usedWords.add(w.word);
        }
    }

    // If we still don't have enough distractors, fill with random generic words
    const fillers = ['thing', 'object', 'concept', 'idea'];
    while (distractors.length < 3) {
        distractors.push(fillers.pop() || 'something');
    }

    return {
        word: targetWord,
        definition: definition,
        distractors: distractors
    };
}

function getRandomFallback() {
    return FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
}

function initGame() {
    gameState.streak = 0;
    gameState.hearts = 3;
    gameState.progress = 0;
    updateStats();
    DOM.gameOver.classList.add('hidden');
    DOM.gameArea.classList.remove('hidden');
    loadNextQuestion();
}

function updateStats() {
    DOM.streakCount.textContent = gameState.streak;
    DOM.heartsCount.textContent = gameState.hearts;
    DOM.progressBar.style.width = `${gameState.progress}%`;
}

async function loadNextQuestion() {
    DOM.feedbackArea.classList.add('hidden');
    DOM.feedbackArea.classList.remove('correct', 'wrong');
    DOM.questionText.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Finding a challenge...';
    DOM.optionsContainer.innerHTML = '';
    gameState.isProcessing = false;

    try {
        const questionData = await generateQuestion();
        gameState.currentQuestion = questionData;
        renderQuestion(questionData);
    } catch (error) {
        console.error('Fatal error generating question:', error);
        const fallback = getRandomFallback();
        gameState.currentQuestion = fallback;
        renderQuestion(fallback);
    }
}

function renderQuestion(data) {
    // Clean up definition (sometimes it includes the word itself or is too technical)
    let cleanDef = data.definition;
    // Simple obfuscation if the word appears in definition (case insensitive)
    const regex = new RegExp(data.word, 'gi');
    cleanDef = cleanDef.replace(regex, '___');

    DOM.questionText.textContent = `"${cleanDef}"`;

    const allOptions = [data.word, ...data.distractors];
    // Shuffle options
    allOptions.sort(() => 0.5 - Math.random());

    DOM.optionsContainer.innerHTML = '';
    allOptions.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-card';
        btn.innerHTML = `
            <span class="key-hint">${index + 1}</span>
            <span class="option-text">${opt}</span>
        `;
        btn.onclick = () => checkAnswer(opt, btn);
        DOM.optionsContainer.appendChild(btn);
    });

    // Keyboard shortcuts
    document.onkeydown = (e) => {
        if (gameState.isProcessing) return;
        const key = e.key;
        if (key >= '1' && key <= '4') {
            const index = parseInt(key) - 1;
            const buttons = DOM.optionsContainer.querySelectorAll('.option-card');
            if (buttons[index]) buttons[index].click();
        }
        if (key === 'Enter' && !DOM.feedbackArea.classList.contains('hidden')) {
            DOM.nextBtn.click();
        }
    };
}

function checkAnswer(selectedWord, btnElement) {
    if (gameState.isProcessing) return;
    gameState.isProcessing = true;

    const isCorrect = selectedWord.toLowerCase() === gameState.currentQuestion.word.toLowerCase();

    // Visual feedback on buttons
    const buttons = DOM.optionsContainer.querySelectorAll('.option-card');
    buttons.forEach(b => {
        const text = b.querySelector('.option-text').textContent;
        if (text.toLowerCase() === gameState.currentQuestion.word.toLowerCase()) {
            b.classList.add('correct');
        } else if (b === btnElement && !isCorrect) {
            b.classList.add('wrong');
        }
        b.disabled = true; // Disable all buttons
    });

    // Logic feedback
    if (isCorrect) {
        gameState.streak++;
        gameState.progress += 10;
        if (gameState.progress > 100) gameState.progress = 0; // Loop progress for endless mode

        // Mascot animation
        const mascot = document.querySelector('.mascot');
        mascot.classList.add('bouncing');
        setTimeout(() => mascot.classList.remove('bouncing'), 500);

        playSound('correct');
        showFeedback(true);
    } else {
        gameState.streak = 0;
        gameState.hearts--;
        playSound('wrong');
        showFeedback(false);
    }

    updateStats();

    if (gameState.hearts <= 0) {
        setTimeout(endGame, 1000);
    }
}

function showFeedback(isCorrect) {
    DOM.feedbackArea.classList.remove('hidden', 'correct', 'wrong');
    DOM.feedbackArea.classList.add(isCorrect ? 'correct' : 'wrong');

    DOM.feedbackTitle.textContent = isCorrect ? 'Correct!' : 'Incorrect';
    DOM.feedbackMessage.textContent = isCorrect
        ? 'Great job! Keep going.'
        : `The correct answer was: ${gameState.currentQuestion.word}`;

    DOM.feedbackIcon.innerHTML = isCorrect ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>';

    // Focus next button
    DOM.nextBtn.focus();
}

function endGame() {
    DOM.gameArea.classList.add('hidden');
    DOM.feedbackArea.classList.add('hidden');
    DOM.gameOver.classList.remove('hidden');
    DOM.finalStreak.textContent = gameState.streak;
}

function playSound(type) {
    // Simple audio feedback could be added here
    // For now, we rely on visual feedback
}

DOM.nextBtn.addEventListener('click', () => {
    if (gameState.hearts > 0) {
        loadNextQuestion();
    } else {
        endGame();
    }
});

DOM.restartBtn.addEventListener('click', initGame);

// Start game
initGame();
