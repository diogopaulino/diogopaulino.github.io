const LANGUAGES = {
    en: { name: 'English', flag: '🇺🇸', voice: 'en-US' },
    es: { name: 'Español', flag: '🇪🇸', voice: 'es-ES' },
    fr: { name: 'Français', flag: '🇫🇷', voice: 'fr-FR' },
    de: { name: 'Deutsch', flag: '🇩🇪', voice: 'de-DE' },
    it: { name: 'Italiano', flag: '🇮🇹', voice: 'it-IT' },
    ja: { name: '日本語', flag: '🇯🇵', voice: 'ja-JP' },
    ko: { name: '한국어', flag: '🇰🇷', voice: 'ko-KR' },
    zh: { name: '中文', flag: '🇨🇳', voice: 'zh-CN' }
};

const LESSONS = {
    en: [
        {
            word: 'hello',
            translation: 'olá',
            sentence: 'Hello, how are you?',
            sentenceTranslation: 'Olá, como você está?',
            sentenceWords: ['Hello', 'how', 'are', 'you'],
            fill: 'Hello, ___ are you?',
            fillAnswer: 'how',
            fillOptions: ['how', 'what', 'where', 'who']
        },
        {
            word: 'goodbye',
            translation: 'adeus',
            sentence: 'Goodbye, see you tomorrow!',
            sentenceTranslation: 'Adeus, vejo você amanhã!',
            sentenceWords: ['Goodbye', 'see', 'you', 'tomorrow'],
            fill: 'Goodbye, see you ___!',
            fillAnswer: 'tomorrow',
            fillOptions: ['tomorrow', 'yesterday', 'today', 'never']
        },
        {
            word: 'thank you',
            translation: 'obrigado',
            sentence: 'Thank you very much!',
            sentenceTranslation: 'Muito obrigado!',
            sentenceWords: ['Thank', 'you', 'very', 'much'],
            fill: 'Thank you very ___!',
            fillAnswer: 'much',
            fillOptions: ['much', 'more', 'less', 'many']
        },
        {
            word: 'please',
            translation: 'por favor',
            sentence: 'Please sit down.',
            sentenceTranslation: 'Por favor, sente-se.',
            sentenceWords: ['Please', 'sit', 'down'],
            fill: 'Please ___ down.',
            fillAnswer: 'sit',
            fillOptions: ['sit', 'stand', 'run', 'walk']
        },
        {
            word: 'water',
            translation: 'água',
            sentence: 'I need some water.',
            sentenceTranslation: 'Eu preciso de água.',
            sentenceWords: ['I', 'need', 'some', 'water'],
            fill: 'I need some ___.',
            fillAnswer: 'water',
            fillOptions: ['water', 'food', 'help', 'time']
        },
        {
            word: 'food',
            translation: 'comida',
            sentence: 'The food is delicious.',
            sentenceTranslation: 'A comida está deliciosa.',
            sentenceWords: ['The', 'food', 'is', 'delicious'],
            fill: 'The food is ___.',
            fillAnswer: 'delicious',
            fillOptions: ['delicious', 'terrible', 'cold', 'old']
        },
        {
            word: 'house',
            translation: 'casa',
            sentence: 'This is my house.',
            sentenceTranslation: 'Esta é minha casa.',
            sentenceWords: ['This', 'is', 'my', 'house'],
            fill: 'This is ___ house.',
            fillAnswer: 'my',
            fillOptions: ['my', 'your', 'his', 'her']
        },
        {
            word: 'friend',
            translation: 'amigo',
            sentence: 'She is my best friend.',
            sentenceTranslation: 'Ela é minha melhor amiga.',
            sentenceWords: ['She', 'is', 'my', 'best', 'friend'],
            fill: 'She is my ___ friend.',
            fillAnswer: 'best',
            fillOptions: ['best', 'good', 'old', 'new']
        },
        {
            word: 'beautiful',
            translation: 'bonito',
            sentence: 'What a beautiful day!',
            sentenceTranslation: 'Que dia lindo!',
            sentenceWords: ['What', 'a', 'beautiful', 'day'],
            fill: 'What a ___ day!',
            fillAnswer: 'beautiful',
            fillOptions: ['beautiful', 'ugly', 'bad', 'sad']
        },
        {
            word: 'happy',
            translation: 'feliz',
            sentence: 'I am very happy today.',
            sentenceTranslation: 'Estou muito feliz hoje.',
            sentenceWords: ['I', 'am', 'very', 'happy', 'today'],
            fill: 'I am very ___ today.',
            fillAnswer: 'happy',
            fillOptions: ['happy', 'sad', 'angry', 'tired']
        },
        {
            word: 'love',
            translation: 'amor',
            sentence: 'I love my family.',
            sentenceTranslation: 'Eu amo minha família.',
            sentenceWords: ['I', 'love', 'my', 'family'],
            fill: 'I ___ my family.',
            fillAnswer: 'love',
            fillOptions: ['love', 'hate', 'like', 'know']
        },
        {
            word: 'time',
            translation: 'tempo',
            sentence: 'What time is it?',
            sentenceTranslation: 'Que horas são?',
            sentenceWords: ['What', 'time', 'is', 'it'],
            fill: 'What ___ is it?',
            fillAnswer: 'time',
            fillOptions: ['time', 'day', 'date', 'year']
        },
        {
            word: 'work',
            translation: 'trabalho',
            sentence: 'I go to work every day.',
            sentenceTranslation: 'Eu vou trabalhar todos os dias.',
            sentenceWords: ['I', 'go', 'to', 'work', 'every', 'day'],
            fill: 'I go to work ___ day.',
            fillAnswer: 'every',
            fillOptions: ['every', 'some', 'no', 'any']
        },
        {
            word: 'morning',
            translation: 'manhã',
            sentence: 'Good morning!',
            sentenceTranslation: 'Bom dia!',
            sentenceWords: ['Good', 'morning'],
            fill: 'Good ___!',
            fillAnswer: 'morning',
            fillOptions: ['morning', 'night', 'evening', 'afternoon']
        },
        {
            word: 'night',
            translation: 'noite',
            sentence: 'Good night, sleep well.',
            sentenceTranslation: 'Boa noite, durma bem.',
            sentenceWords: ['Good', 'night', 'sleep', 'well'],
            fill: 'Good night, sleep ___.',
            fillAnswer: 'well',
            fillOptions: ['well', 'bad', 'fast', 'slow']
        },
        {
            word: 'book',
            translation: 'livro',
            sentence: 'I am reading a book.',
            sentenceTranslation: 'Estou lendo um livro.',
            sentenceWords: ['I', 'am', 'reading', 'a', 'book'],
            fill: 'I am ___ a book.',
            fillAnswer: 'reading',
            fillOptions: ['reading', 'writing', 'eating', 'watching']
        },
        {
            word: 'music',
            translation: 'música',
            sentence: 'I love listening to music.',
            sentenceTranslation: 'Eu amo ouvir música.',
            sentenceWords: ['I', 'love', 'listening', 'to', 'music'],
            fill: 'I love listening ___ music.',
            fillAnswer: 'to',
            fillOptions: ['to', 'at', 'in', 'on']
        },
        {
            word: 'eat',
            translation: 'comer',
            sentence: 'I want to eat now.',
            sentenceTranslation: 'Eu quero comer agora.',
            sentenceWords: ['I', 'want', 'to', 'eat', 'now'],
            fill: 'I want ___ eat now.',
            fillAnswer: 'to',
            fillOptions: ['to', 'for', 'at', 'in']
        },
        {
            word: 'drink',
            translation: 'beber',
            sentence: 'Do you want to drink?',
            sentenceTranslation: 'Você quer beber?',
            sentenceWords: ['Do', 'you', 'want', 'to', 'drink'],
            fill: '___ you want to drink?',
            fillAnswer: 'Do',
            fillOptions: ['Do', 'Does', 'Did', 'Are']
        },
        {
            word: 'big',
            translation: 'grande',
            sentence: 'This house is very big.',
            sentenceTranslation: 'Esta casa é muito grande.',
            sentenceWords: ['This', 'house', 'is', 'very', 'big'],
            fill: 'This house is ___ big.',
            fillAnswer: 'very',
            fillOptions: ['very', 'not', 'too', 'so']
        }
    ],
    es: [
        {
            word: 'hola',
            translation: 'olá',
            sentence: '¡Hola! ¿Cómo estás?',
            sentenceTranslation: 'Olá! Como você está?',
            sentenceWords: ['Hola', 'Cómo', 'estás'],
            fill: '¡Hola! ¿___ estás?',
            fillAnswer: 'Cómo',
            fillOptions: ['Cómo', 'Qué', 'Dónde', 'Cuándo']
        },
        {
            word: 'gracias',
            translation: 'obrigado',
            sentence: 'Muchas gracias por tu ayuda.',
            sentenceTranslation: 'Muito obrigado pela sua ajuda.',
            sentenceWords: ['Muchas', 'gracias', 'por', 'tu', 'ayuda'],
            fill: 'Muchas gracias ___ tu ayuda.',
            fillAnswer: 'por',
            fillOptions: ['por', 'para', 'con', 'sin']
        },
        {
            word: 'amor',
            translation: 'amor',
            sentence: 'Te quiero mucho, mi amor.',
            sentenceTranslation: 'Te amo muito, meu amor.',
            sentenceWords: ['Te', 'quiero', 'mucho', 'mi', 'amor'],
            fill: 'Te quiero ___, mi amor.',
            fillAnswer: 'mucho',
            fillOptions: ['mucho', 'poco', 'nada', 'más']
        },
        {
            word: 'casa',
            translation: 'casa',
            sentence: 'Mi casa es tu casa.',
            sentenceTranslation: 'Minha casa é sua casa.',
            sentenceWords: ['Mi', 'casa', 'es', 'tu', 'casa'],
            fill: 'Mi casa ___ tu casa.',
            fillAnswer: 'es',
            fillOptions: ['es', 'está', 'son', 'están']
        },
        {
            word: 'comer',
            translation: 'comer',
            sentence: 'Quiero comer algo.',
            sentenceTranslation: 'Quero comer algo.',
            sentenceWords: ['Quiero', 'comer', 'algo'],
            fill: 'Quiero ___ algo.',
            fillAnswer: 'comer',
            fillOptions: ['comer', 'beber', 'dormir', 'hablar']
        }
    ],
    fr: [
        {
            word: 'bonjour',
            translation: 'olá/bom dia',
            sentence: 'Bonjour, comment allez-vous?',
            sentenceTranslation: 'Bom dia, como você está?',
            sentenceWords: ['Bonjour', 'comment', 'allez', 'vous'],
            fill: 'Bonjour, ___ allez-vous?',
            fillAnswer: 'comment',
            fillOptions: ['comment', 'où', 'quand', 'pourquoi']
        },
        {
            word: 'merci',
            translation: 'obrigado',
            sentence: 'Merci beaucoup!',
            sentenceTranslation: 'Muito obrigado!',
            sentenceWords: ['Merci', 'beaucoup'],
            fill: 'Merci ___!',
            fillAnswer: 'beaucoup',
            fillOptions: ['beaucoup', 'peu', 'très', 'trop']
        },
        {
            word: 'amour',
            translation: 'amor',
            sentence: "L'amour est magnifique.",
            sentenceTranslation: 'O amor é magnífico.',
            sentenceWords: ["L'amour", 'est', 'magnifique'],
            fill: "L'amour ___ magnifique.",
            fillAnswer: 'est',
            fillOptions: ['est', 'sont', 'es', 'êtes']
        }
    ],
    de: [
        {
            word: 'hallo',
            translation: 'olá',
            sentence: 'Hallo, wie geht es dir?',
            sentenceTranslation: 'Olá, como você está?',
            sentenceWords: ['Hallo', 'wie', 'geht', 'es', 'dir'],
            fill: 'Hallo, ___ geht es dir?',
            fillAnswer: 'wie',
            fillOptions: ['wie', 'was', 'wo', 'wann']
        },
        {
            word: 'danke',
            translation: 'obrigado',
            sentence: 'Danke schön!',
            sentenceTranslation: 'Muito obrigado!',
            sentenceWords: ['Danke', 'schön'],
            fill: 'Danke ___!',
            fillAnswer: 'schön',
            fillOptions: ['schön', 'gut', 'sehr', 'viel']
        }
    ],
    it: [
        {
            word: 'ciao',
            translation: 'olá/tchau',
            sentence: 'Ciao, come stai?',
            sentenceTranslation: 'Olá, como você está?',
            sentenceWords: ['Ciao', 'come', 'stai'],
            fill: 'Ciao, ___ stai?',
            fillAnswer: 'come',
            fillOptions: ['come', 'dove', 'quando', 'perché']
        },
        {
            word: 'grazie',
            translation: 'obrigado',
            sentence: 'Grazie mille!',
            sentenceTranslation: 'Muito obrigado!',
            sentenceWords: ['Grazie', 'mille'],
            fill: 'Grazie ___!',
            fillAnswer: 'mille',
            fillOptions: ['mille', 'tanto', 'molto', 'poco']
        }
    ],
    ja: [
        {
            word: 'こんにちは',
            translation: 'olá',
            sentence: 'こんにちは、お元気ですか？',
            sentenceTranslation: 'Olá, como você está?',
            sentenceWords: ['こんにちは', 'お元気', 'ですか'],
            fill: 'こんにちは、___ですか？',
            fillAnswer: 'お元気',
            fillOptions: ['お元気', 'お名前', 'お仕事', 'お天気']
        }
    ],
    ko: [
        {
            word: '안녕하세요',
            translation: 'olá',
            sentence: '안녕하세요, 어떻게 지내세요?',
            sentenceTranslation: 'Olá, como você está?',
            sentenceWords: ['안녕하세요', '어떻게', '지내세요'],
            fill: '안녕하세요, ___ 지내세요?',
            fillAnswer: '어떻게',
            fillOptions: ['어떻게', '어디서', '언제', '왜']
        }
    ],
    zh: [
        {
            word: '你好',
            translation: 'olá',
            sentence: '你好，你好吗？',
            sentenceTranslation: 'Olá, como você está?',
            sentenceWords: ['你好', '你', '好吗'],
            fill: '你好，你___？',
            fillAnswer: '好吗',
            fillOptions: ['好吗', '是谁', '在哪', '什么']
        }
    ]
};

const EXERCISE_TYPES = [
    'translate',
    'fillBlank', 
    'writeWord',
    'orderWords',
    'listenWrite',
    'matchPairs'
];

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.enabled = localStorage.getItem('talk-sound') !== 'off';
        this.updateUI();
    }

    init() {
        if (this.initialized) return;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('talk-sound', this.enabled ? 'on' : 'off');
        this.updateUI();
    }

    updateUI() {
        const btn = document.getElementById('sound-toggle');
        if (!btn) return;
        
        const onIcon = btn.querySelector('.sound-on-icon');
        const offIcon = btn.querySelector('.sound-off-icon');
        
        if (this.enabled) {
            btn.classList.remove('muted');
            btn.title = 'Som ligado';
            if (onIcon) onIcon.style.display = 'block';
            if (offIcon) offIcon.style.display = 'none';
        } else {
            btn.classList.add('muted');
            btn.title = 'Som desligado';
            if (onIcon) onIcon.style.display = 'none';
            if (offIcon) offIcon.style.display = 'block';
        }
    }

    playTone(frequency, duration, type = 'sine') {
        if (!this.enabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playCorrect() {
        if (!this.enabled) return;
        this.init();
        this.playTone(523.25, 0.1);
        setTimeout(() => this.playTone(659.25, 0.1), 100);
        setTimeout(() => this.playTone(783.99, 0.15), 200);
    }

    playWrong() {
        if (!this.enabled) return;
        this.init();
        this.playTone(200, 0.2, 'sawtooth');
        setTimeout(() => this.playTone(150, 0.3, 'sawtooth'), 150);
    }

    playClick() {
        if (!this.enabled) return;
        this.init();
        this.playTone(800, 0.05);
    }

    playLevelUp() {
        if (!this.enabled) return;
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.15), i * 100);
        });
    }
}

class SpeechManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.speaking = false;
    }

    speak(text, lang = 'en-US') {
        if (!this.synth || this.speaking) return;
        
        this.synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.85;
        utterance.pitch = 1;
        
        utterance.onstart = () => {
            this.speaking = true;
            document.querySelector('.btn-speak')?.classList.add('speaking');
        };
        
        utterance.onend = () => {
            this.speaking = false;
            document.querySelector('.btn-speak')?.classList.remove('speaking');
        };
        
        utterance.onerror = () => {
            this.speaking = false;
            document.querySelector('.btn-speak')?.classList.remove('speaking');
        };
        
        this.synth.speak(utterance);
    }
}

const gameState = {
    currentLang: null,
    streak: 0,
    hearts: 5,
    xp: 0,
    progress: 0,
    questionsAnswered: 0,
    totalQuestions: 10,
    currentExercise: null,
    usedLessons: new Set(),
    isProcessing: false,
    selectedWords: [],
    matchedPairs: new Set()
};

const audio = new AudioManager();
const speech = new SpeechManager();

const DOM = {
    languageSelect: document.getElementById('language-select'),
    languageGrid: document.getElementById('language-grid'),
    gameScreen: document.getElementById('game-screen'),
    currentLang: document.getElementById('current-lang'),
    btnBackLang: document.getElementById('btn-back-lang'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    streakCount: document.getElementById('streak-count'),
    heartsCount: document.getElementById('hearts-count'),
    xpCount: document.getElementById('xp-count'),
    questionType: document.getElementById('question-type'),
    questionText: document.getElementById('question-text'),
    btnSpeak: document.getElementById('btn-speak'),
    optionsContainer: document.getElementById('options-container'),
    feedbackArea: document.getElementById('feedback-area'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackMessage: document.getElementById('feedback-message'),
    nextBtn: document.getElementById('next-btn'),
    gameArea: document.getElementById('game-area'),
    gameOver: document.getElementById('game-over'),
    restartBtn: document.getElementById('restart-btn'),
    finalStreak: document.getElementById('final-streak'),
    finalXp: document.getElementById('final-xp'),
    levelComplete: document.getElementById('level-complete'),
    rewardXp: document.getElementById('reward-xp'),
    continueBtn: document.getElementById('continue-btn')
};

function selectLanguage(langCode) {
    audio.playClick();
    gameState.currentLang = langCode;
    const lang = LANGUAGES[langCode];
    
    DOM.currentLang.innerHTML = `
        <span class="current-flag">${lang.flag}</span>
        <span class="current-name">${lang.name}</span>
    `;
    
    DOM.languageSelect.classList.add('hidden');
    DOM.gameScreen.classList.remove('hidden');
    
    initGame();
}

function goBackToLanguageSelect() {
    audio.playClick();
    DOM.gameScreen.classList.add('hidden');
    DOM.languageSelect.classList.remove('hidden');
    gameState.currentLang = null;
}

function initGame() {
    gameState.streak = 0;
    gameState.hearts = 5;
    gameState.xp = 0;
    gameState.progress = 0;
    gameState.questionsAnswered = 0;
    gameState.usedLessons.clear();
    gameState.isProcessing = false;
    gameState.selectedWords = [];
    gameState.matchedPairs.clear();
    
    updateStats();
    
    DOM.gameOver.classList.add('hidden');
    DOM.levelComplete.classList.add('hidden');
    DOM.gameArea.classList.remove('hidden');
    
    loadNextExercise();
}

function updateStats() {
    DOM.streakCount.textContent = gameState.streak;
    DOM.heartsCount.textContent = gameState.hearts;
    DOM.xpCount.textContent = gameState.xp;
    
    const progressPercent = (gameState.questionsAnswered / gameState.totalQuestions) * 100;
    DOM.progressBar.style.width = `${progressPercent}%`;
    DOM.progressText.textContent = `${gameState.questionsAnswered}/${gameState.totalQuestions}`;
}

function getRandomLesson() {
    const lessons = LESSONS[gameState.currentLang] || LESSONS.en;
    const availableLessons = lessons.filter((_, i) => !gameState.usedLessons.has(i));
    
    if (availableLessons.length === 0) {
        gameState.usedLessons.clear();
        const idx = Math.floor(Math.random() * lessons.length);
        gameState.usedLessons.add(idx);
        return lessons[idx];
    }
    
    const randomIdx = Math.floor(Math.random() * availableLessons.length);
    const originalIdx = lessons.indexOf(availableLessons[randomIdx]);
    gameState.usedLessons.add(originalIdx);
    return availableLessons[randomIdx];
}

function getRandomExerciseType() {
    const lessons = LESSONS[gameState.currentLang] || LESSONS.en;
    
    if (lessons.length < 4) {
        return EXERCISE_TYPES.filter(t => t !== 'matchPairs')[Math.floor(Math.random() * 5)];
    }
    
    return EXERCISE_TYPES[Math.floor(Math.random() * EXERCISE_TYPES.length)];
}

function loadNextExercise() {
    DOM.feedbackArea.classList.add('hidden');
    DOM.feedbackArea.classList.remove('correct', 'wrong');
    gameState.isProcessing = false;
    gameState.selectedWords = [];
    gameState.matchedPairs.clear();
    
    if (gameState.questionsAnswered >= gameState.totalQuestions) {
        showLevelComplete();
        return;
    }
    
    const lesson = getRandomLesson();
    const exerciseType = getRandomExerciseType();
    
    gameState.currentExercise = { lesson, type: exerciseType };
    
    switch (exerciseType) {
        case 'translate':
            renderTranslateExercise(lesson);
            break;
        case 'fillBlank':
            renderFillBlankExercise(lesson);
            break;
        case 'writeWord':
            renderWriteWordExercise(lesson);
            break;
        case 'orderWords':
            renderOrderWordsExercise(lesson);
            break;
        case 'listenWrite':
            renderListenWriteExercise(lesson);
            break;
        case 'matchPairs':
            renderMatchPairsExercise();
            break;
    }
}

function renderTranslateExercise(lesson) {
    DOM.questionType.textContent = 'Traduza esta palavra';
    DOM.questionText.textContent = `Como se diz "${lesson.translation}" em ${LANGUAGES[gameState.currentLang].name}?`;
    
    const lessons = LESSONS[gameState.currentLang] || LESSONS.en;
    const distractors = lessons
        .filter(l => l.word !== lesson.word)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(l => l.word);
    
    const options = [lesson.word, ...distractors].sort(() => Math.random() - 0.5);
    
    DOM.optionsContainer.innerHTML = '';
    DOM.optionsContainer.className = 'options-grid';
    
    options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-card';
        btn.innerHTML = `<span class="key-hint">${i + 1}</span><span class="option-text">${opt}</span>`;
        btn.onclick = () => checkTranslateAnswer(opt, lesson.word, btn);
        DOM.optionsContainer.appendChild(btn);
    });
    
    setupKeyboardShortcuts(options.length, (i) => {
        const btns = DOM.optionsContainer.querySelectorAll('.option-card');
        if (btns[i]) btns[i].click();
    });
}

function renderFillBlankExercise(lesson) {
    DOM.questionType.textContent = 'Complete a frase';
    DOM.questionText.innerHTML = lesson.fill.replace('___', '<span class="blank-space">______</span>');
    
    const options = [...lesson.fillOptions].sort(() => Math.random() - 0.5);
    
    DOM.optionsContainer.innerHTML = '';
    DOM.optionsContainer.className = 'options-grid';
    
    options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-card';
        btn.innerHTML = `<span class="key-hint">${i + 1}</span><span class="option-text">${opt}</span>`;
        btn.onclick = () => checkFillBlankAnswer(opt, lesson.fillAnswer, btn);
        DOM.optionsContainer.appendChild(btn);
    });
    
    setupKeyboardShortcuts(options.length, (i) => {
        const btns = DOM.optionsContainer.querySelectorAll('.option-card');
        if (btns[i]) btns[i].click();
    });
}

function renderWriteWordExercise(lesson) {
    DOM.questionType.textContent = 'Escreva a tradução';
    DOM.questionText.textContent = `Escreva "${lesson.translation}" em ${LANGUAGES[gameState.currentLang].name}:`;
    
    DOM.optionsContainer.innerHTML = '';
    DOM.optionsContainer.className = 'write-exercise';
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-wrapper';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'write-input';
    input.placeholder = 'Digite aqui...';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-submit';
    submitBtn.innerHTML = `Verificar <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    submitBtn.onclick = () => checkWriteAnswer(input.value, lesson.word);
    
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !gameState.isProcessing) {
            submitBtn.click();
        }
    };
    
    inputWrapper.appendChild(input);
    inputWrapper.appendChild(submitBtn);
    DOM.optionsContainer.appendChild(inputWrapper);
    
    setTimeout(() => input.focus(), 100);
    
    document.onkeydown = null;
}

function renderOrderWordsExercise(lesson) {
    DOM.questionType.textContent = 'Ordene as palavras';
    DOM.questionText.textContent = `Monte a frase: "${lesson.sentenceTranslation}"`;
    
    const shuffledWords = [...lesson.sentenceWords].sort(() => Math.random() - 0.5);
    gameState.selectedWords = [];
    
    DOM.optionsContainer.innerHTML = '';
    DOM.optionsContainer.className = 'order-exercise';
    
    const selectedArea = document.createElement('div');
    selectedArea.className = 'selected-words';
    selectedArea.id = 'selected-words';
    
    const wordBank = document.createElement('div');
    wordBank.className = 'word-bank';
    wordBank.id = 'word-bank';
    
    shuffledWords.forEach((word, i) => {
        const btn = document.createElement('button');
        btn.className = 'word-chip';
        btn.textContent = word;
        btn.dataset.word = word;
        btn.dataset.index = i;
        btn.onclick = () => toggleWord(btn, word);
        wordBank.appendChild(btn);
    });
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-submit';
    submitBtn.innerHTML = `Verificar <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    submitBtn.onclick = () => checkOrderAnswer(lesson.sentenceWords);
    
    DOM.optionsContainer.appendChild(selectedArea);
    DOM.optionsContainer.appendChild(wordBank);
    DOM.optionsContainer.appendChild(submitBtn);
    
    document.onkeydown = (e) => {
        if (e.key === 'Enter' && !gameState.isProcessing) {
            submitBtn.click();
        }
    };
}

function toggleWord(btn, word) {
    if (gameState.isProcessing) return;
    audio.playClick();
    
    const selectedArea = document.getElementById('selected-words');
    const wordBank = document.getElementById('word-bank');
    
    if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        const idx = gameState.selectedWords.indexOf(word);
        if (idx > -1) gameState.selectedWords.splice(idx, 1);
        wordBank.appendChild(btn);
    } else {
        btn.classList.add('selected');
        gameState.selectedWords.push(word);
        selectedArea.appendChild(btn);
    }
}

function renderListenWriteExercise(lesson) {
    DOM.questionType.textContent = 'Ouça e escreva';
    DOM.questionText.textContent = 'Ouça a frase e escreva o que você ouviu:';
    
    setTimeout(() => {
        speech.speak(lesson.sentence, LANGUAGES[gameState.currentLang].voice);
    }, 500);
    
    DOM.optionsContainer.innerHTML = '';
    DOM.optionsContainer.className = 'write-exercise';
    
    const listenBtn = document.createElement('button');
    listenBtn.className = 'btn-listen-large';
    listenBtn.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
        Ouvir novamente
    `;
    listenBtn.onclick = () => {
        audio.playClick();
        speech.speak(lesson.sentence, LANGUAGES[gameState.currentLang].voice);
    };
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-wrapper';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'write-input';
    input.placeholder = 'Digite o que você ouviu...';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-submit';
    submitBtn.innerHTML = `Verificar <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    submitBtn.onclick = () => checkListenAnswer(input.value, lesson.sentence);
    
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !gameState.isProcessing) {
            submitBtn.click();
        }
    };
    
    inputWrapper.appendChild(input);
    inputWrapper.appendChild(submitBtn);
    
    DOM.optionsContainer.appendChild(listenBtn);
    DOM.optionsContainer.appendChild(inputWrapper);
    
    setTimeout(() => input.focus(), 100);
    
    document.onkeydown = null;
}

function renderMatchPairsExercise() {
    DOM.questionType.textContent = 'Combine os pares';
    DOM.questionText.textContent = 'Conecte cada palavra com sua tradução:';
    
    const lessons = LESSONS[gameState.currentLang] || LESSONS.en;
    const selectedLessons = lessons.sort(() => Math.random() - 0.5).slice(0, 4);
    
    gameState.matchedPairs.clear();
    gameState.currentExercise.pairs = selectedLessons;
    gameState.currentExercise.selectedPair = null;
    
    const words = selectedLessons.map(l => ({ text: l.word, type: 'word', lesson: l }));
    const translations = selectedLessons.map(l => ({ text: l.translation, type: 'translation', lesson: l }));
    
    const shuffledWords = words.sort(() => Math.random() - 0.5);
    const shuffledTranslations = translations.sort(() => Math.random() - 0.5);
    
    DOM.optionsContainer.innerHTML = '';
    DOM.optionsContainer.className = 'match-exercise';
    
    const leftCol = document.createElement('div');
    leftCol.className = 'match-column';
    
    const rightCol = document.createElement('div');
    rightCol.className = 'match-column';
    
    shuffledWords.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'match-card';
        btn.textContent = item.text;
        btn.dataset.word = item.lesson.word;
        btn.dataset.type = 'word';
        btn.onclick = () => selectMatchCard(btn, item);
        leftCol.appendChild(btn);
    });
    
    shuffledTranslations.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'match-card';
        btn.textContent = item.text;
        btn.dataset.word = item.lesson.word;
        btn.dataset.type = 'translation';
        btn.onclick = () => selectMatchCard(btn, item);
        rightCol.appendChild(btn);
    });
    
    DOM.optionsContainer.appendChild(leftCol);
    DOM.optionsContainer.appendChild(rightCol);
    
    document.onkeydown = null;
}

function selectMatchCard(btn, item) {
    if (gameState.isProcessing || btn.classList.contains('matched')) return;
    audio.playClick();
    
    const exercise = gameState.currentExercise;
    
    if (!exercise.selectedPair) {
        document.querySelectorAll('.match-card').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        exercise.selectedPair = { btn, item };
    } else {
        const first = exercise.selectedPair;
        
        if (first.btn === btn) {
            btn.classList.remove('selected');
            exercise.selectedPair = null;
            return;
        }
        
        if (first.item.type === item.type) {
            first.btn.classList.remove('selected');
            btn.classList.add('selected');
            exercise.selectedPair = { btn, item };
            return;
        }
        
        if (first.item.lesson.word === item.lesson.word) {
            first.btn.classList.add('matched', 'correct');
            btn.classList.add('matched', 'correct');
            first.btn.classList.remove('selected');
            gameState.matchedPairs.add(first.item.lesson.word);
            exercise.selectedPair = null;
            
            if (gameState.matchedPairs.size === exercise.pairs.length) {
                setTimeout(() => {
                    gameState.streak++;
                    gameState.xp += 15 + (gameState.streak * 2);
                    gameState.questionsAnswered++;
                    audio.playCorrect();
                    updateStats();
                    showFeedback(true, 'Todos os pares combinados!');
                }, 300);
            }
        } else {
            first.btn.classList.add('wrong');
            btn.classList.add('wrong');
            first.btn.classList.remove('selected');
            
            setTimeout(() => {
                first.btn.classList.remove('wrong');
                btn.classList.remove('wrong');
            }, 500);
            
            exercise.selectedPair = null;
        }
    }
}

function checkTranslateAnswer(selected, correct, btn) {
    if (gameState.isProcessing) return;
    gameState.isProcessing = true;
    
    const isCorrect = selected.toLowerCase() === correct.toLowerCase();
    markOptionCards(correct, btn, isCorrect);
    processAnswer(isCorrect, correct);
}

function checkFillBlankAnswer(selected, correct, btn) {
    if (gameState.isProcessing) return;
    gameState.isProcessing = true;
    
    const isCorrect = selected.toLowerCase() === correct.toLowerCase();
    markOptionCards(correct, btn, isCorrect);
    processAnswer(isCorrect, correct);
}

function checkWriteAnswer(input, correct) {
    if (gameState.isProcessing || !input.trim()) return;
    gameState.isProcessing = true;
    
    const normalizedInput = input.trim().toLowerCase();
    const normalizedCorrect = correct.toLowerCase();
    const isCorrect = normalizedInput === normalizedCorrect;
    
    const inputEl = document.querySelector('.write-input');
    if (inputEl) {
        inputEl.classList.add(isCorrect ? 'correct' : 'wrong');
        inputEl.disabled = true;
    }
    
    processAnswer(isCorrect, correct);
}

function checkOrderAnswer(correctOrder) {
    if (gameState.isProcessing) return;
    gameState.isProcessing = true;
    
    const isCorrect = gameState.selectedWords.join(' ') === correctOrder.join(' ');
    
    const selectedArea = document.getElementById('selected-words');
    if (selectedArea) {
        selectedArea.classList.add(isCorrect ? 'correct' : 'wrong');
    }
    
    processAnswer(isCorrect, correctOrder.join(' '));
}

function checkListenAnswer(input, correct) {
    if (gameState.isProcessing || !input.trim()) return;
    gameState.isProcessing = true;
    
    const normalizedInput = input.trim().toLowerCase().replace(/[.,!?]/g, '');
    const normalizedCorrect = correct.toLowerCase().replace(/[.,!?¿¡]/g, '');
    
    const similarity = calculateSimilarity(normalizedInput, normalizedCorrect);
    const isCorrect = similarity > 0.8;
    
    const inputEl = document.querySelector('.write-input');
    if (inputEl) {
        inputEl.classList.add(isCorrect ? 'correct' : 'wrong');
        inputEl.disabled = true;
    }
    
    processAnswer(isCorrect, correct);
}

function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const costs = [];
    for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (longer[i - 1] !== shorter[j - 1]) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }
    
    return (longer.length - costs[shorter.length]) / longer.length;
}

function markOptionCards(correct, clickedBtn, isCorrect) {
    const buttons = DOM.optionsContainer.querySelectorAll('.option-card');
    buttons.forEach(b => {
        const text = b.querySelector('.option-text')?.textContent;
        if (text?.toLowerCase() === correct.toLowerCase()) {
            b.classList.add('correct');
        } else if (b === clickedBtn && !isCorrect) {
            b.classList.add('wrong');
        }
        b.disabled = true;
    });
}

function processAnswer(isCorrect, correctAnswer) {
    if (isCorrect) {
        gameState.streak++;
        gameState.xp += 10 + (gameState.streak * 2);
        gameState.questionsAnswered++;
        
        const miniAvatar = document.querySelector('.mini-avatar');
        if (miniAvatar) {
            miniAvatar.style.animation = 'none';
            miniAvatar.offsetHeight;
            miniAvatar.style.animation = 'celebrate 0.5s ease';
        }
        
        audio.playCorrect();
        showFeedback(true);
    } else {
        gameState.streak = 0;
        gameState.hearts--;
        gameState.questionsAnswered++;
        audio.playWrong();
        showFeedback(false, `Resposta correta: ${correctAnswer}`);
    }
    
    updateStats();
    
    if (gameState.hearts <= 0) {
        setTimeout(showGameOver, 1500);
    }
}

function showFeedback(isCorrect, message = '') {
    DOM.feedbackArea.classList.remove('hidden', 'correct', 'wrong');
    DOM.feedbackArea.classList.add(isCorrect ? 'correct' : 'wrong');
    
    DOM.feedbackTitle.textContent = isCorrect ? 'Correto!' : 'Incorreto';
    
    if (isCorrect) {
        DOM.feedbackMessage.textContent = message || `+${10 + (gameState.streak * 2)} XP`;
    } else {
        DOM.feedbackMessage.textContent = message;
    }
    
    DOM.nextBtn.focus();
}

function showGameOver() {
    DOM.gameArea.classList.add('hidden');
    DOM.feedbackArea.classList.add('hidden');
    DOM.gameOver.classList.remove('hidden');
    DOM.finalStreak.textContent = gameState.streak;
    DOM.finalXp.textContent = gameState.xp;
}

function showLevelComplete() {
    DOM.gameArea.classList.add('hidden');
    DOM.feedbackArea.classList.add('hidden');
    DOM.levelComplete.classList.remove('hidden');
    
    const bonusXp = 50 + (gameState.hearts * 10);
    gameState.xp += bonusXp;
    DOM.rewardXp.textContent = `+${bonusXp} XP`;
    
    audio.playLevelUp();
    createConfetti();
}

function createConfetti() {
    const container = document.getElementById('confetti');
    if (!container) return;
    container.innerHTML = '';
    
    const colors = ['#667eea', '#f093fb', '#48bb78', '#ed8936', '#9f7aea', '#fbd38d'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = `${Math.random() * 0.5}s`;
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        container.appendChild(confetti);
    }
}

function setupKeyboardShortcuts(count, callback) {
    document.onkeydown = (e) => {
        if (gameState.isProcessing) {
            if (e.key === 'Enter' && !DOM.feedbackArea.classList.contains('hidden')) {
                DOM.nextBtn.click();
            }
            return;
        }
        
        const key = e.key;
        if (key >= '1' && key <= String(count)) {
            const index = parseInt(key) - 1;
            audio.playClick();
            callback(index);
        }
    };
}

function speakCurrentWord() {
    const exercise = gameState.currentExercise;
    if (!exercise) return;
    
    const langCode = LANGUAGES[gameState.currentLang].voice;
    
    if (exercise.type === 'listenWrite') {
        speech.speak(exercise.lesson.sentence, langCode);
    } else {
        speech.speak(exercise.lesson.word, langCode);
    }
}

DOM.languageGrid.querySelectorAll('.language-card').forEach(card => {
    card.addEventListener('click', () => {
        const lang = card.dataset.lang;
        selectLanguage(lang);
    });
});

DOM.btnBackLang.addEventListener('click', goBackToLanguageSelect);

DOM.btnSpeak.addEventListener('click', () => {
    audio.playClick();
    speakCurrentWord();
});

DOM.nextBtn.addEventListener('click', () => {
    if (gameState.hearts > 0) {
        loadNextExercise();
    } else {
        showGameOver();
    }
});

DOM.restartBtn.addEventListener('click', () => {
    audio.playClick();
    initGame();
});

DOM.continueBtn.addEventListener('click', () => {
    audio.playClick();
    initGame();
});

document.getElementById('sound-toggle')?.addEventListener('click', () => {
    audio.toggle();
});

document.addEventListener('click', () => {
    audio.init();
}, { once: true });

const avatarContainer = document.querySelector('.avatar-container');
if (avatarContainer) {
    document.addEventListener('mousemove', (e) => {
        const pupils = avatarContainer.querySelectorAll('.pupil');
        const rect = avatarContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const distance = Math.min(4, Math.hypot(e.clientX - centerX, e.clientY - centerY) / 50);
        
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;
        
        pupils.forEach(pupil => {
            pupil.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
        });
    });
}
