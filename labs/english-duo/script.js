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

const VOCABULARY = {
    en: [
        { word: 'hello', translation: 'olá', example: 'Hello, how are you?' },
        { word: 'goodbye', translation: 'adeus', example: 'Goodbye, see you tomorrow!' },
        { word: 'thank you', translation: 'obrigado', example: 'Thank you for your help.' },
        { word: 'please', translation: 'por favor', example: 'Please sit down.' },
        { word: 'water', translation: 'água', example: 'I need some water.' },
        { word: 'food', translation: 'comida', example: 'The food is delicious.' },
        { word: 'house', translation: 'casa', example: 'This is my house.' },
        { word: 'friend', translation: 'amigo', example: 'She is my best friend.' },
        { word: 'beautiful', translation: 'bonito', example: 'What a beautiful day!' },
        { word: 'happy', translation: 'feliz', example: 'I am very happy today.' },
        { word: 'love', translation: 'amor', example: 'Love conquers all.' },
        { word: 'time', translation: 'tempo', example: 'Time flies when you have fun.' },
        { word: 'work', translation: 'trabalho', example: 'I have a lot of work to do.' },
        { word: 'family', translation: 'família', example: 'Family is important.' },
        { word: 'morning', translation: 'manhã', example: 'Good morning!' },
        { word: 'night', translation: 'noite', example: 'Good night, sleep well.' },
        { word: 'book', translation: 'livro', example: 'I love reading books.' },
        { word: 'music', translation: 'música', example: 'Music makes me happy.' },
        { word: 'travel', translation: 'viajar', example: 'I want to travel the world.' },
        { word: 'dream', translation: 'sonho', example: 'Follow your dreams.' }
    ],
    es: [
        { word: 'hola', translation: 'olá', example: '¡Hola! ¿Cómo estás?' },
        { word: 'adiós', translation: 'adeus', example: '¡Adiós, hasta mañana!' },
        { word: 'gracias', translation: 'obrigado', example: 'Gracias por tu ayuda.' },
        { word: 'por favor', translation: 'por favor', example: 'Por favor, siéntate.' },
        { word: 'agua', translation: 'água', example: 'Necesito agua.' },
        { word: 'comida', translation: 'comida', example: 'La comida está deliciosa.' },
        { word: 'casa', translation: 'casa', example: 'Esta es mi casa.' },
        { word: 'amigo', translation: 'amigo', example: 'Él es mi mejor amigo.' },
        { word: 'hermoso', translation: 'bonito', example: '¡Qué día tan hermoso!' },
        { word: 'feliz', translation: 'feliz', example: 'Estoy muy feliz hoy.' },
        { word: 'amor', translation: 'amor', example: 'El amor lo conquista todo.' },
        { word: 'tiempo', translation: 'tempo', example: 'El tiempo vuela.' },
        { word: 'trabajo', translation: 'trabalho', example: 'Tengo mucho trabajo.' },
        { word: 'familia', translation: 'família', example: 'La familia es importante.' },
        { word: 'mañana', translation: 'manhã', example: '¡Buenos días!' },
        { word: 'noche', translation: 'noite', example: 'Buenas noches.' },
        { word: 'libro', translation: 'livro', example: 'Me encanta leer libros.' },
        { word: 'música', translation: 'música', example: 'La música me hace feliz.' },
        { word: 'viajar', translation: 'viajar', example: 'Quiero viajar por el mundo.' },
        { word: 'sueño', translation: 'sonho', example: 'Sigue tus sueños.' }
    ],
    fr: [
        { word: 'bonjour', translation: 'olá', example: 'Bonjour, comment allez-vous?' },
        { word: 'au revoir', translation: 'adeus', example: 'Au revoir, à demain!' },
        { word: 'merci', translation: 'obrigado', example: 'Merci beaucoup.' },
        { word: 's\'il vous plaît', translation: 'por favor', example: 'S\'il vous plaît, asseyez-vous.' },
        { word: 'eau', translation: 'água', example: 'J\'ai besoin d\'eau.' },
        { word: 'nourriture', translation: 'comida', example: 'La nourriture est délicieuse.' },
        { word: 'maison', translation: 'casa', example: 'C\'est ma maison.' },
        { word: 'ami', translation: 'amigo', example: 'C\'est mon meilleur ami.' },
        { word: 'beau', translation: 'bonito', example: 'Quelle belle journée!' },
        { word: 'heureux', translation: 'feliz', example: 'Je suis très heureux.' },
        { word: 'amour', translation: 'amor', example: 'L\'amour conquiert tout.' },
        { word: 'temps', translation: 'tempo', example: 'Le temps passe vite.' },
        { word: 'travail', translation: 'trabalho', example: 'J\'ai beaucoup de travail.' },
        { word: 'famille', translation: 'família', example: 'La famille est importante.' },
        { word: 'matin', translation: 'manhã', example: 'Bon matin!' },
        { word: 'nuit', translation: 'noite', example: 'Bonne nuit.' },
        { word: 'livre', translation: 'livro', example: 'J\'aime lire des livres.' },
        { word: 'musique', translation: 'música', example: 'La musique me rend heureux.' },
        { word: 'voyager', translation: 'viajar', example: 'Je veux voyager.' },
        { word: 'rêve', translation: 'sonho', example: 'Suivez vos rêves.' }
    ],
    de: [
        { word: 'hallo', translation: 'olá', example: 'Hallo, wie geht es dir?' },
        { word: 'auf wiedersehen', translation: 'adeus', example: 'Auf Wiedersehen!' },
        { word: 'danke', translation: 'obrigado', example: 'Danke schön.' },
        { word: 'bitte', translation: 'por favor', example: 'Bitte setzen Sie sich.' },
        { word: 'wasser', translation: 'água', example: 'Ich brauche Wasser.' },
        { word: 'essen', translation: 'comida', example: 'Das Essen ist lecker.' },
        { word: 'haus', translation: 'casa', example: 'Das ist mein Haus.' },
        { word: 'freund', translation: 'amigo', example: 'Er ist mein bester Freund.' },
        { word: 'schön', translation: 'bonito', example: 'Was für ein schöner Tag!' },
        { word: 'glücklich', translation: 'feliz', example: 'Ich bin sehr glücklich.' },
        { word: 'liebe', translation: 'amor', example: 'Liebe überwindet alles.' },
        { word: 'zeit', translation: 'tempo', example: 'Die Zeit vergeht schnell.' },
        { word: 'arbeit', translation: 'trabalho', example: 'Ich habe viel Arbeit.' },
        { word: 'familie', translation: 'família', example: 'Familie ist wichtig.' },
        { word: 'morgen', translation: 'manhã', example: 'Guten Morgen!' },
        { word: 'nacht', translation: 'noite', example: 'Gute Nacht.' },
        { word: 'buch', translation: 'livro', example: 'Ich lese gern Bücher.' },
        { word: 'musik', translation: 'música', example: 'Musik macht mich glücklich.' },
        { word: 'reisen', translation: 'viajar', example: 'Ich will reisen.' },
        { word: 'traum', translation: 'sonho', example: 'Folge deinen Träumen.' }
    ],
    it: [
        { word: 'ciao', translation: 'olá', example: 'Ciao, come stai?' },
        { word: 'arrivederci', translation: 'adeus', example: 'Arrivederci!' },
        { word: 'grazie', translation: 'obrigado', example: 'Grazie mille.' },
        { word: 'per favore', translation: 'por favor', example: 'Per favore, siediti.' },
        { word: 'acqua', translation: 'água', example: 'Ho bisogno di acqua.' },
        { word: 'cibo', translation: 'comida', example: 'Il cibo è delizioso.' },
        { word: 'casa', translation: 'casa', example: 'Questa è la mia casa.' },
        { word: 'amico', translation: 'amigo', example: 'È il mio migliore amico.' },
        { word: 'bello', translation: 'bonito', example: 'Che bella giornata!' },
        { word: 'felice', translation: 'feliz', example: 'Sono molto felice.' },
        { word: 'amore', translation: 'amor', example: 'L\'amore vince tutto.' },
        { word: 'tempo', translation: 'tempo', example: 'Il tempo vola.' },
        { word: 'lavoro', translation: 'trabalho', example: 'Ho molto lavoro.' },
        { word: 'famiglia', translation: 'família', example: 'La famiglia è importante.' },
        { word: 'mattina', translation: 'manhã', example: 'Buon giorno!' },
        { word: 'notte', translation: 'noite', example: 'Buona notte.' },
        { word: 'libro', translation: 'livro', example: 'Mi piace leggere libri.' },
        { word: 'musica', translation: 'música', example: 'La musica mi rende felice.' },
        { word: 'viaggiare', translation: 'viajar', example: 'Voglio viaggiare.' },
        { word: 'sogno', translation: 'sonho', example: 'Segui i tuoi sogni.' }
    ],
    ja: [
        { word: 'こんにちは', translation: 'olá', example: 'こんにちは、お元気ですか？' },
        { word: 'さようなら', translation: 'adeus', example: 'さようなら！' },
        { word: 'ありがとう', translation: 'obrigado', example: 'ありがとうございます。' },
        { word: 'お願いします', translation: 'por favor', example: 'お願いします。' },
        { word: '水', translation: 'água', example: '水が必要です。' },
        { word: '食べ物', translation: 'comida', example: '食べ物は美味しいです。' },
        { word: '家', translation: 'casa', example: 'これは私の家です。' },
        { word: '友達', translation: 'amigo', example: '彼は私の親友です。' },
        { word: '美しい', translation: 'bonito', example: 'なんて美しい日だ！' },
        { word: '幸せ', translation: 'feliz', example: '私はとても幸せです。' },
        { word: '愛', translation: 'amor', example: '愛は全てを征服する。' },
        { word: '時間', translation: 'tempo', example: '時間は速く過ぎる。' },
        { word: '仕事', translation: 'trabalho', example: '仕事がたくさんあります。' },
        { word: '家族', translation: 'família', example: '家族は大切です。' },
        { word: '朝', translation: 'manhã', example: 'おはようございます！' },
        { word: '夜', translation: 'noite', example: 'おやすみなさい。' },
        { word: '本', translation: 'livro', example: '本を読むのが好きです。' },
        { word: '音楽', translation: 'música', example: '音楽が好きです。' },
        { word: '旅行', translation: 'viajar', example: '旅行したいです。' },
        { word: '夢', translation: 'sonho', example: '夢を追いかけて。' }
    ],
    ko: [
        { word: '안녕하세요', translation: 'olá', example: '안녕하세요, 어떻게 지내세요?' },
        { word: '안녕히 가세요', translation: 'adeus', example: '안녕히 가세요!' },
        { word: '감사합니다', translation: 'obrigado', example: '감사합니다.' },
        { word: '제발', translation: 'por favor', example: '제발 앉으세요.' },
        { word: '물', translation: 'água', example: '물이 필요해요.' },
        { word: '음식', translation: 'comida', example: '음식이 맛있어요.' },
        { word: '집', translation: 'casa', example: '이것은 제 집이에요.' },
        { word: '친구', translation: 'amigo', example: '그는 제 친한 친구예요.' },
        { word: '아름다운', translation: 'bonito', example: '정말 아름다운 날이에요!' },
        { word: '행복한', translation: 'feliz', example: '저는 매우 행복해요.' },
        { word: '사랑', translation: 'amor', example: '사랑은 모든 것을 이겨요.' },
        { word: '시간', translation: 'tempo', example: '시간이 빨리 가요.' },
        { word: '일', translation: 'trabalho', example: '일이 많아요.' },
        { word: '가족', translation: 'família', example: '가족은 중요해요.' },
        { word: '아침', translation: 'manhã', example: '좋은 아침이에요!' },
        { word: '밤', translation: 'noite', example: '좋은 밤 되세요.' },
        { word: '책', translation: 'livro', example: '책 읽는 것을 좋아해요.' },
        { word: '음악', translation: 'música', example: '음악이 저를 행복하게 해요.' },
        { word: '여행', translation: 'viajar', example: '여행하고 싶어요.' },
        { word: '꿈', translation: 'sonho', example: '꿈을 따라가세요.' }
    ],
    zh: [
        { word: '你好', translation: 'olá', example: '你好，你好吗？' },
        { word: '再见', translation: 'adeus', example: '再见！' },
        { word: '谢谢', translation: 'obrigado', example: '谢谢你。' },
        { word: '请', translation: 'por favor', example: '请坐。' },
        { word: '水', translation: 'água', example: '我需要水。' },
        { word: '食物', translation: 'comida', example: '食物很好吃。' },
        { word: '家', translation: 'casa', example: '这是我的家。' },
        { word: '朋友', translation: 'amigo', example: '他是我最好的朋友。' },
        { word: '美丽', translation: 'bonito', example: '多么美丽的一天！' },
        { word: '快乐', translation: 'feliz', example: '我很快乐。' },
        { word: '爱', translation: 'amor', example: '爱能战胜一切。' },
        { word: '时间', translation: 'tempo', example: '时间过得很快。' },
        { word: '工作', translation: 'trabalho', example: '我有很多工作。' },
        { word: '家庭', translation: 'família', example: '家庭很重要。' },
        { word: '早上', translation: 'manhã', example: '早上好！' },
        { word: '晚上', translation: 'noite', example: '晚安。' },
        { word: '书', translation: 'livro', example: '我喜欢读书。' },
        { word: '音乐', translation: 'música', example: '音乐让我快乐。' },
        { word: '旅行', translation: 'viajar', example: '我想旅行。' },
        { word: '梦想', translation: 'sonho', example: '追随你的梦想。' }
    ]
};

const QUESTION_TYPES = ['translate', 'listen', 'meaning'];

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
            onIcon.style.display = 'block';
            offIcon.style.display = 'none';
        } else {
            btn.classList.add('muted');
            btn.title = 'Som desligado';
            onIcon.style.display = 'none';
            offIcon.style.display = 'block';
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
        utterance.rate = 0.9;
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
    currentQuestion: null,
    usedWords: new Set(),
    isProcessing: false
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
    gameState.usedWords.clear();
    gameState.isProcessing = false;
    
    updateStats();
    
    DOM.gameOver.classList.add('hidden');
    DOM.levelComplete.classList.add('hidden');
    DOM.gameArea.classList.remove('hidden');
    
    loadNextQuestion();
}

function updateStats() {
    DOM.streakCount.textContent = gameState.streak;
    DOM.heartsCount.textContent = gameState.hearts;
    DOM.xpCount.textContent = gameState.xp;
    
    const progressPercent = (gameState.questionsAnswered / gameState.totalQuestions) * 100;
    DOM.progressBar.style.width = `${progressPercent}%`;
    DOM.progressText.textContent = `${gameState.questionsAnswered}/${gameState.totalQuestions}`;
}

function getRandomWord() {
    const vocab = VOCABULARY[gameState.currentLang];
    const availableWords = vocab.filter(w => !gameState.usedWords.has(w.word));
    
    if (availableWords.length === 0) {
        gameState.usedWords.clear();
        return vocab[Math.floor(Math.random() * vocab.length)];
    }
    
    const word = availableWords[Math.floor(Math.random() * availableWords.length)];
    gameState.usedWords.add(word.word);
    return word;
}

function getDistractors(correctAnswer, field) {
    const vocab = VOCABULARY[gameState.currentLang];
    const distractors = [];
    const used = new Set([correctAnswer]);
    
    while (distractors.length < 3) {
        const randomWord = vocab[Math.floor(Math.random() * vocab.length)];
        const value = randomWord[field];
        if (!used.has(value)) {
            distractors.push(value);
            used.add(value);
        }
    }
    
    return distractors;
}

function loadNextQuestion() {
    DOM.feedbackArea.classList.add('hidden');
    DOM.feedbackArea.classList.remove('correct', 'wrong');
    gameState.isProcessing = false;
    
    if (gameState.questionsAnswered >= gameState.totalQuestions) {
        showLevelComplete();
        return;
    }
    
    const word = getRandomWord();
    const questionType = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
    
    let question, correctAnswer, distractors, speakText;
    
    switch (questionType) {
        case 'translate':
            question = `Como se diz "${word.translation}" em ${LANGUAGES[gameState.currentLang].name}?`;
            correctAnswer = word.word;
            distractors = getDistractors(word.word, 'word');
            speakText = word.word;
            DOM.questionType.textContent = 'Traduza';
            break;
            
        case 'listen':
            question = 'Ouça e escolha a tradução correta:';
            correctAnswer = word.translation;
            distractors = getDistractors(word.translation, 'translation');
            speakText = word.word;
            DOM.questionType.textContent = 'Ouça';
            setTimeout(() => speakWord(speakText), 500);
            break;
            
        case 'meaning':
            question = `O que significa "${word.word}"?`;
            correctAnswer = word.translation;
            distractors = getDistractors(word.translation, 'translation');
            speakText = word.word;
            DOM.questionType.textContent = 'Significado';
            break;
    }
    
    gameState.currentQuestion = {
        word,
        type: questionType,
        correctAnswer,
        speakText
    };
    
    DOM.questionText.textContent = question;
    
    const allOptions = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
    renderOptions(allOptions);
    
    setupKeyboardShortcuts(allOptions);
}

function renderOptions(options) {
    DOM.optionsContainer.innerHTML = '';
    
    options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-card';
        btn.innerHTML = `
            <span class="key-hint">${index + 1}</span>
            <span class="option-text">${opt}</span>
        `;
        btn.onclick = () => checkAnswer(opt, btn);
        DOM.optionsContainer.appendChild(btn);
    });
}

function setupKeyboardShortcuts(options) {
    document.onkeydown = (e) => {
        if (gameState.isProcessing) {
            if (e.key === 'Enter' && !DOM.feedbackArea.classList.contains('hidden')) {
                DOM.nextBtn.click();
            }
            return;
        }
        
        const key = e.key;
        if (key >= '1' && key <= '4') {
            const index = parseInt(key) - 1;
            const buttons = DOM.optionsContainer.querySelectorAll('.option-card');
            if (buttons[index]) {
                audio.playClick();
                buttons[index].click();
            }
        }
    };
}

function speakWord(text) {
    const langCode = LANGUAGES[gameState.currentLang].voice;
    speech.speak(text, langCode);
}

function checkAnswer(selected, btnElement) {
    if (gameState.isProcessing) return;
    gameState.isProcessing = true;
    
    const isCorrect = selected === gameState.currentQuestion.correctAnswer;
    
    const buttons = DOM.optionsContainer.querySelectorAll('.option-card');
    buttons.forEach(b => {
        const text = b.querySelector('.option-text').textContent;
        if (text === gameState.currentQuestion.correctAnswer) {
            b.classList.add('correct');
        } else if (b === btnElement && !isCorrect) {
            b.classList.add('wrong');
        }
        b.disabled = true;
    });
    
    if (isCorrect) {
        gameState.streak++;
        gameState.xp += 10 + (gameState.streak * 2);
        gameState.questionsAnswered++;
        
        const miniAvatar = document.querySelector('.mini-avatar');
        miniAvatar.style.animation = 'none';
        miniAvatar.offsetHeight;
        miniAvatar.style.animation = 'celebrate 0.5s ease';
        
        audio.playCorrect();
        showFeedback(true);
    } else {
        gameState.streak = 0;
        gameState.hearts--;
        gameState.questionsAnswered++;
        audio.playWrong();
        showFeedback(false);
    }
    
    updateStats();
    
    if (gameState.hearts <= 0) {
        setTimeout(showGameOver, 1500);
    }
}

function showFeedback(isCorrect) {
    DOM.feedbackArea.classList.remove('hidden', 'correct', 'wrong');
    DOM.feedbackArea.classList.add(isCorrect ? 'correct' : 'wrong');
    
    DOM.feedbackTitle.textContent = isCorrect ? 'Correto!' : 'Incorreto';
    
    if (isCorrect) {
        DOM.feedbackMessage.textContent = `+${10 + (gameState.streak * 2)} XP`;
    } else {
        DOM.feedbackMessage.textContent = `Resposta: ${gameState.currentQuestion.correctAnswer}`;
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

DOM.languageGrid.querySelectorAll('.language-card').forEach(card => {
    card.addEventListener('click', () => {
        const lang = card.dataset.lang;
        selectLanguage(lang);
    });
});

DOM.btnBackLang.addEventListener('click', goBackToLanguageSelect);

DOM.btnSpeak.addEventListener('click', () => {
    if (gameState.currentQuestion) {
        audio.playClick();
        speakWord(gameState.currentQuestion.speakText);
    }
});

DOM.nextBtn.addEventListener('click', () => {
    if (gameState.hearts > 0) {
        loadNextQuestion();
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

document.getElementById('sound-toggle').addEventListener('click', () => {
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
