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
        },
        {
            word: 'family',
            translation: 'família',
            sentence: 'My family is very important to me.',
            sentenceTranslation: 'Minha família é muito importante para mim.',
            sentenceWords: ['My', 'family', 'is', 'very', 'important'],
            fill: 'My family is very ___ to me.',
            fillAnswer: 'important',
            fillOptions: ['important', 'big', 'small', 'old']
        },
        {
            word: 'school',
            translation: 'escola',
            sentence: 'The children go to school.',
            sentenceTranslation: 'As crianças vão à escola.',
            sentenceWords: ['The', 'children', 'go', 'to', 'school'],
            fill: 'The children go ___ school.',
            fillAnswer: 'to',
            fillOptions: ['to', 'at', 'in', 'on']
        },
        {
            word: 'dog',
            translation: 'cachorro',
            sentence: 'My dog is very friendly.',
            sentenceTranslation: 'Meu cachorro é muito amigável.',
            sentenceWords: ['My', 'dog', 'is', 'very', 'friendly'],
            fill: 'My dog is very ___.',
            fillAnswer: 'friendly',
            fillOptions: ['friendly', 'ugly', 'fast', 'old']
        },
        {
            word: 'red',
            translation: 'vermelho',
            sentence: 'I like the color red.',
            sentenceTranslation: 'Eu gosto da cor vermelha.',
            sentenceWords: ['I', 'like', 'the', 'color', 'red'],
            fill: 'I like the color ___.',
            fillAnswer: 'red',
            fillOptions: ['red', 'blue', 'green', 'black']
        },
        {
            word: 'yes',
            translation: 'sim',
            sentence: 'Yes, I agree.',
            sentenceTranslation: 'Sim, eu concordo.',
            sentenceWords: ['Yes', 'I', 'agree'],
            fill: '___, I agree.',
            fillAnswer: 'Yes',
            fillOptions: ['Yes', 'No', 'Maybe', 'Never']
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
        },
        {
            word: 'adiós',
            translation: 'adeus',
            sentence: 'Adiós, hasta mañana.',
            sentenceTranslation: 'Adeus, até amanhã.',
            sentenceWords: ['Adiós', 'hasta', 'mañana'],
            fill: 'Adiós, hasta ___.',
            fillAnswer: 'mañana',
            fillOptions: ['mañana', 'hoy', 'ayer', 'nunca']
        },
        {
            word: 'por favor',
            translation: 'por favor',
            sentence: 'Ven aquí, por favor.',
            sentenceTranslation: 'Venha aqui, por favor.',
            sentenceWords: ['Ven', 'aquí', 'por', 'favor'],
            fill: 'Ven aquí, ___ favor.',
            fillAnswer: 'por',
            fillOptions: ['por', 'para', 'con', 'sin']
        },
        {
            word: 'agua',
            translation: 'água',
            sentence: 'Necesito un poco de agua.',
            sentenceTranslation: 'Eu preciso de um pouco de água.',
            sentenceWords: ['Necesito', 'un', 'poco', 'de', 'agua'],
            fill: 'Necesito un poco de ___.',
            fillAnswer: 'agua',
            fillOptions: ['agua', 'comida', 'ayuda', 'tiempo']
        },
        {
            word: 'comida',
            translation: 'comida',
            sentence: 'La comida está deliciosa.',
            sentenceTranslation: 'A comida está deliciosa.',
            sentenceWords: ['La', 'comida', 'está', 'deliciosa'],
            fill: 'La comida está ___.',
            fillAnswer: 'deliciosa',
            fillOptions: ['deliciosa', 'terrible', 'fría', 'vieja']
        },
        {
            word: 'amigo',
            translation: 'amigo',
            sentence: 'Ella es mi mejor amiga.',
            sentenceTranslation: 'Ela é minha melhor amiga.',
            sentenceWords: ['Ella', 'es', 'mi', 'mejor', 'amiga'],
            fill: 'Ella es mi ___ amiga.',
            fillAnswer: 'mejor',
            fillOptions: ['mejor', 'buena', 'vieja', 'nueva']
        },
        {
            word: 'hermoso',
            translation: 'bonito',
            sentence: '¡Qué día tan hermoso!',
            sentenceTranslation: 'Que dia tão bonito!',
            sentenceWords: ['Qué', 'día', 'tan', 'hermoso'],
            fill: '¡Qué día tan ___!',
            fillAnswer: 'hermoso',
            fillOptions: ['hermoso', 'feo', 'malo', 'triste']
        },
        {
            word: 'feliz',
            translation: 'feliz',
            sentence: 'Estoy muy feliz hoy.',
            sentenceTranslation: 'Estou muito feliz hoje.',
            sentenceWords: ['Estoy', 'muy', 'feliz', 'hoy'],
            fill: 'Estoy muy ___ hoy.',
            fillAnswer: 'feliz',
            fillOptions: ['feliz', 'triste', 'enojado', 'cansado']
        },
        {
            word: 'tiempo',
            translation: 'tempo',
            sentence: 'No tengo mucho tiempo.',
            sentenceTranslation: 'Eu não tenho muito tempo.',
            sentenceWords: ['No', 'tengo', 'mucho', 'tiempo'],
            fill: 'No tengo mucho ___.',
            fillAnswer: 'tiempo',
            fillOptions: ['tiempo', 'dinero', 'agua', 'pan']
        },
        {
            word: 'trabajo',
            translation: 'trabalho',
            sentence: 'Voy al trabajo todos los días.',
            sentenceTranslation: 'Eu vou ao trabalho todos os dias.',
            sentenceWords: ['Voy', 'al', 'trabajo', 'todos', 'los', 'días'],
            fill: 'Voy al trabajo todos los ___.',
            fillAnswer: 'días',
            fillOptions: ['días', 'años', 'meses', 'minutos']
        },
        {
            word: 'mañana',
            translation: 'manhã',
            sentence: 'Hoy es una mañana hermosa.',
            sentenceTranslation: 'Hoje é uma manhã linda.',
            sentenceWords: ['Hoy', 'es', 'una', 'mañana', 'hermosa'],
            fill: 'Hoy es una ___ hermosa.',
            fillAnswer: 'mañana',
            fillOptions: ['mañana', 'noche', 'tarde', 'semana']
        },
        {
            word: 'noche',
            translation: 'noite',
            sentence: 'Buenas noches, duerme bien.',
            sentenceTranslation: 'Boa noite, durma bem.',
            sentenceWords: ['Buenas', 'noches', 'duerme', 'bien'],
            fill: 'Buenas noches, duerme ___.',
            fillAnswer: 'bien',
            fillOptions: ['bien', 'mal', 'rápido', 'tarde']
        },
        {
            word: 'libro',
            translation: 'livro',
            sentence: 'Estoy leyendo un libro.',
            sentenceTranslation: 'Estou lendo um livro.',
            sentenceWords: ['Estoy', 'leyendo', 'un', 'libro'],
            fill: 'Estoy ___ un libro.',
            fillAnswer: 'leyendo',
            fillOptions: ['leyendo', 'escribiendo', 'comiendo', 'mirando']
        },
        {
            word: 'música',
            translation: 'música',
            sentence: 'Me encanta escuchar música.',
            sentenceTranslation: 'Eu amo ouvir música.',
            sentenceWords: ['Me', 'encanta', 'escuchar', 'música'],
            fill: 'Me encanta ___ música.',
            fillAnswer: 'escuchar',
            fillOptions: ['escuchar', 'ver', 'tocar', 'cantar']
        },
        {
            word: 'beber',
            translation: 'beber',
            sentence: '¿Quieres beber algo?',
            sentenceTranslation: 'Você quer beber algo?',
            sentenceWords: ['Quieres', 'beber', 'algo'],
            fill: '¿Quieres ___ algo?',
            fillAnswer: 'beber',
            fillOptions: ['beber', 'comer', 'hacer', 'decir']
        },
        {
            word: 'grande',
            translation: 'grande',
            sentence: 'Esta casa es muy grande.',
            sentenceTranslation: 'Esta casa é muito grande.',
            sentenceWords: ['Esta', 'casa', 'es', 'muy', 'grande'],
            fill: 'Esta casa es muy ___.',
            fillAnswer: 'grande',
            fillOptions: ['grande', 'pequeña', 'vieja', 'nueva']
        },
        {
            word: 'pequeño',
            translation: 'pequeno',
            sentence: 'Tengo un perro pequeño.',
            sentenceTranslation: 'Eu tenho um cachorro pequeno.',
            sentenceWords: ['Tengo', 'un', 'perro', 'pequeño'],
            fill: 'Tengo un perro ___.',
            fillAnswer: 'pequeño',
            fillOptions: ['pequeño', 'grande', 'feo', 'triste']
        },
        {
            word: 'familia',
            translation: 'família',
            sentence: 'Amo a mi familia.',
            sentenceTranslation: 'Eu amo minha família.',
            sentenceWords: ['Amo', 'a', 'mi', 'familia'],
            fill: 'Amo a mi ___.',
            fillAnswer: 'familia',
            fillOptions: ['familia', 'amigo', 'perro', 'trabajo']
        },
        {
            word: 'escuela',
            translation: 'escola',
            sentence: 'Los niños van a la escuela.',
            sentenceTranslation: 'As crianças vão à escola.',
            sentenceWords: ['Los', 'niños', 'van', 'a', 'la', 'escuela'],
            fill: 'Los niños van a la ___.',
            fillAnswer: 'escuela',
            fillOptions: ['escuela', 'casa', 'playa', 'tienda']
        },
        {
            word: 'perro',
            translation: 'cachorro',
            sentence: 'Mi perro es muy amigable.',
            sentenceTranslation: 'Meu cachorro é muito amigável.',
            sentenceWords: ['Mi', 'perro', 'es', 'muy', 'amigable'],
            fill: 'Mi perro es muy ___.',
            fillAnswer: 'amigable',
            fillOptions: ['amigable', 'feo', 'rápido', 'viejo']
        },
        {
            word: 'rojo',
            translation: 'vermelho',
            sentence: 'Me gusta el color rojo.',
            sentenceTranslation: 'Eu gosto da cor vermelha.',
            sentenceWords: ['Me', 'gusta', 'el', 'color', 'rojo'],
            fill: 'Me gusta el color ___.',
            fillAnswer: 'rojo',
            fillOptions: ['rojo', 'azul', 'verde', 'negro']
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
        },
        {
            word: 'au revoir',
            translation: 'adeus',
            sentence: 'Au revoir, à demain!',
            sentenceTranslation: 'Adeus, até amanhã!',
            sentenceWords: ['Au', 'revoir', 'à', 'demain'],
            fill: 'Au revoir, à ___!',
            fillAnswer: 'demain',
            fillOptions: ['demain', 'hier', "aujourd'hui", 'jamais']
        },
        {
            word: "s'il vous plaît",
            translation: 'por favor',
            sentence: "Asseyez-vous, s'il vous plaît.",
            sentenceTranslation: 'Sente-se, por favor.',
            sentenceWords: ['Asseyez-vous', "s'il", 'vous', 'plaît'],
            fill: "Asseyez-vous, s'il vous ___.",
            fillAnswer: 'plaît',
            fillOptions: ['plaît', 'faut', 'veut', 'peut']
        },
        {
            word: 'eau',
            translation: 'água',
            sentence: "Je bois de l'eau.",
            sentenceTranslation: 'Eu bebo água.',
            sentenceWords: ['Je', 'bois', "de l'eau"],
            fill: 'Je bois ___.',
            fillAnswer: "de l'eau",
            fillOptions: ["de l'eau", 'du pain', 'du café', 'du thé']
        },
        {
            word: 'nourriture',
            translation: 'comida',
            sentence: 'La nourriture est délicieuse.',
            sentenceTranslation: 'A comida está deliciosa.',
            sentenceWords: ['La', 'nourriture', 'est', 'délicieuse'],
            fill: 'La nourriture est ___.',
            fillAnswer: 'délicieuse',
            fillOptions: ['délicieuse', 'terrible', 'froide', 'vieille']
        },
        {
            word: 'ami',
            translation: 'amigo',
            sentence: 'Elle est ma meilleure amie.',
            sentenceTranslation: 'Ela é minha melhor amiga.',
            sentenceWords: ['Elle', 'est', 'ma', 'meilleure', 'amie'],
            fill: 'Elle est ma ___ amie.',
            fillAnswer: 'meilleure',
            fillOptions: ['meilleure', 'bonne', 'vieille', 'nouvelle']
        },
        {
            word: 'beau',
            translation: 'bonito',
            sentence: 'Quelle belle journée!',
            sentenceTranslation: 'Que dia lindo!',
            sentenceWords: ['Quelle', 'belle', 'journée'],
            fill: 'Quelle ___ journée!',
            fillAnswer: 'belle',
            fillOptions: ['belle', 'mauvaise', 'triste', 'longue']
        },
        {
            word: 'heureux',
            translation: 'feliz',
            sentence: "Je suis très heureux aujourd'hui.",
            sentenceTranslation: 'Estou muito feliz hoje.',
            sentenceWords: ['Je', 'suis', 'très', 'heureux', "aujourd'hui"],
            fill: "Je suis très ___ aujourd'hui.",
            fillAnswer: 'heureux',
            fillOptions: ['heureux', 'triste', 'fatigué', 'en colère']
        },
        {
            word: 'temps',
            translation: 'tempo',
            sentence: "Je n'ai pas beaucoup de temps.",
            sentenceTranslation: 'Eu não tenho muito tempo.',
            sentenceWords: ['Je', "n'ai", 'pas', 'beaucoup', 'de', 'temps'],
            fill: "Je n'ai pas beaucoup de ___.",
            fillAnswer: 'temps',
            fillOptions: ['temps', 'argent', 'eau', 'pain']
        },
        {
            word: 'travail',
            translation: 'trabalho',
            sentence: 'Je vais au travail tous les jours.',
            sentenceTranslation: 'Eu vou trabalhar todos os dias.',
            sentenceWords: ['Je', 'vais', 'au', 'travail', 'tous', 'les', 'jours'],
            fill: 'Je vais au travail tous les ___.',
            fillAnswer: 'jours',
            fillOptions: ['jours', 'ans', 'mois', 'soirs']
        },
        {
            word: 'matin',
            translation: 'manhã',
            sentence: "C'est un beau matin.",
            sentenceTranslation: 'É uma bela manhã.',
            sentenceWords: ["C'est", 'un', 'beau', 'matin'],
            fill: "C'est un beau ___.",
            fillAnswer: 'matin',
            fillOptions: ['matin', 'soir', 'jour', 'mois']
        },
        {
            word: 'nuit',
            translation: 'noite',
            sentence: 'Bonne nuit, dors bien.',
            sentenceTranslation: 'Boa noite, durma bem.',
            sentenceWords: ['Bonne', 'nuit', 'dors', 'bien'],
            fill: 'Bonne nuit, dors ___.',
            fillAnswer: 'bien',
            fillOptions: ['bien', 'mal', 'vite', 'tard']
        },
        {
            word: 'livre',
            translation: 'livro',
            sentence: 'Je lis un livre.',
            sentenceTranslation: 'Eu estou lendo um livro.',
            sentenceWords: ['Je', 'lis', 'un', 'livre'],
            fill: 'Je ___ un livre.',
            fillAnswer: 'lis',
            fillOptions: ['lis', 'écris', 'mange', 'regarde']
        },
        {
            word: 'musique',
            translation: 'música',
            sentence: "J'adore écouter de la musique.",
            sentenceTranslation: 'Eu amo ouvir música.',
            sentenceWords: ["J'adore", 'écouter', 'de', 'la', 'musique'],
            fill: "J'adore écouter de la ___.",
            fillAnswer: 'musique',
            fillOptions: ['musique', 'radio', 'télé', 'chanson']
        },
        {
            word: 'boire',
            translation: 'beber',
            sentence: 'Veux-tu boire quelque chose?',
            sentenceTranslation: 'Você quer beber algo?',
            sentenceWords: ['Veux-tu', 'boire', 'quelque', 'chose'],
            fill: 'Veux-tu ___ quelque chose?',
            fillAnswer: 'boire',
            fillOptions: ['boire', 'manger', 'faire', 'dire']
        },
        {
            word: 'grand',
            translation: 'grande',
            sentence: 'Cette maison est très grande.',
            sentenceTranslation: 'Esta casa é muito grande.',
            sentenceWords: ['Cette', 'maison', 'est', 'très', 'grande'],
            fill: 'Cette maison est très ___.',
            fillAnswer: 'grande',
            fillOptions: ['grande', 'petite', 'vieille', 'nouvelle']
        },
        {
            word: 'petit',
            translation: 'pequeno',
            sentence: "J'ai un petit chien.",
            sentenceTranslation: 'Eu tenho um cachorro pequeno.',
            sentenceWords: ["J'ai", 'un', 'petit', 'chien'],
            fill: "J'ai un ___ chien.",
            fillAnswer: 'petit',
            fillOptions: ['petit', 'grand', 'vieux', 'beau']
        },
        {
            word: 'famille',
            translation: 'família',
            sentence: "J'aime ma famille.",
            sentenceTranslation: 'Eu amo minha família.',
            sentenceWords: ["J'aime", 'ma', 'famille'],
            fill: "J'aime ma ___.",
            fillAnswer: 'famille',
            fillOptions: ['famille', 'ami', 'chien', 'travail']
        },
        {
            word: 'école',
            translation: 'escola',
            sentence: "Les enfants vont à l'école.",
            sentenceTranslation: 'As crianças vão à escola.',
            sentenceWords: ['Les', 'enfants', 'vont', "à l'école"],
            fill: 'Les enfants vont ___.',
            fillAnswer: "à l'école",
            fillOptions: ["à l'école", 'à la maison', 'à la plage', 'au magasin']
        },
        {
            word: 'chien',
            translation: 'cachorro',
            sentence: 'Mon chien est très amical.',
            sentenceTranslation: 'Meu cachorro é muito amigável.',
            sentenceWords: ['Mon', 'chien', 'est', 'très', 'amical'],
            fill: 'Mon chien est très ___.',
            fillAnswer: 'amical',
            fillOptions: ['amical', 'laid', 'rapide', 'vieux']
        },
        {
            word: 'rouge',
            translation: 'vermelho',
            sentence: "J'aime la couleur rouge.",
            sentenceTranslation: 'Eu gosto da cor vermelha.',
            sentenceWords: ["J'aime", 'la', 'couleur', 'rouge'],
            fill: "J'aime la couleur ___.",
            fillAnswer: 'rouge',
            fillOptions: ['rouge', 'bleu', 'vert', 'noir']
        },
        {
            word: 'oui',
            translation: 'sim',
            sentence: "Oui, je suis d'accord.",
            sentenceTranslation: 'Sim, eu concordo.',
            sentenceWords: ['Oui', 'je', 'suis', "d'accord"],
            fill: "___, je suis d'accord.",
            fillAnswer: 'Oui',
            fillOptions: ['Oui', 'Non', 'Peut-être', 'Jamais']
        },
        {
            word: 'non',
            translation: 'não',
            sentence: 'Non, merci.',
            sentenceTranslation: 'Não, obrigado.',
            sentenceWords: ['Non', 'merci'],
            fill: '___, merci.',
            fillAnswer: 'Non',
            fillOptions: ['Non', 'Oui', 'Si', 'Merci']
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
        },
        {
            word: 'auf wiedersehen',
            translation: 'adeus',
            sentence: 'Auf Wiedersehen, bis morgen!',
            sentenceTranslation: 'Adeus, até amanhã!',
            sentenceWords: ['Auf', 'Wiedersehen', 'bis', 'morgen'],
            fill: 'Auf Wiedersehen, bis ___!',
            fillAnswer: 'morgen',
            fillOptions: ['morgen', 'heute', 'gestern', 'nie']
        },
        {
            word: 'bitte',
            translation: 'por favor',
            sentence: 'Setz dich bitte hin.',
            sentenceTranslation: 'Sente-se, por favor.',
            sentenceWords: ['Setz', 'dich', 'bitte', 'hin'],
            fill: 'Setz dich ___ hin.',
            fillAnswer: 'bitte',
            fillOptions: ['bitte', 'schnell', 'langsam', 'sofort']
        },
        {
            word: 'wasser',
            translation: 'água',
            sentence: 'Ich brauche etwas Wasser.',
            sentenceTranslation: 'Eu preciso de um pouco de água.',
            sentenceWords: ['Ich', 'brauche', 'etwas', 'Wasser'],
            fill: 'Ich brauche etwas ___.',
            fillAnswer: 'Wasser',
            fillOptions: ['Wasser', 'Essen', 'Hilfe', 'Zeit']
        },
        {
            word: 'essen',
            translation: 'comida',
            sentence: 'Das Essen ist lecker.',
            sentenceTranslation: 'A comida está deliciosa.',
            sentenceWords: ['Das', 'Essen', 'ist', 'lecker'],
            fill: 'Das Essen ist ___.',
            fillAnswer: 'lecker',
            fillOptions: ['lecker', 'schlecht', 'kalt', 'alt']
        },
        {
            word: 'freund',
            translation: 'amigo',
            sentence: 'Sie ist meine beste Freundin.',
            sentenceTranslation: 'Ela é minha melhor amiga.',
            sentenceWords: ['Sie', 'ist', 'meine', 'beste', 'Freundin'],
            fill: 'Sie ist meine ___ Freundin.',
            fillAnswer: 'beste',
            fillOptions: ['beste', 'gute', 'alte', 'neue']
        },
        {
            word: 'schön',
            translation: 'bonito',
            sentence: 'Was für ein schöner Tag!',
            sentenceTranslation: 'Que dia lindo!',
            sentenceWords: ['Was', 'für', 'ein', 'schöner', 'Tag'],
            fill: 'Was für ein ___ Tag!',
            fillAnswer: 'schöner',
            fillOptions: ['schöner', 'hässlicher', 'schlechter', 'trauriger']
        },
        {
            word: 'glücklich',
            translation: 'feliz',
            sentence: 'Ich bin heute sehr glücklich.',
            sentenceTranslation: 'Estou muito feliz hoje.',
            sentenceWords: ['Ich', 'bin', 'heute', 'sehr', 'glücklich'],
            fill: 'Ich bin heute sehr ___.',
            fillAnswer: 'glücklich',
            fillOptions: ['glücklich', 'traurig', 'müde', 'wütend']
        },
        {
            word: 'zeit',
            translation: 'tempo',
            sentence: 'Ich habe nicht viel Zeit.',
            sentenceTranslation: 'Eu não tenho muito tempo.',
            sentenceWords: ['Ich', 'habe', 'nicht', 'viel', 'Zeit'],
            fill: 'Ich habe nicht viel ___.',
            fillAnswer: 'Zeit',
            fillOptions: ['Zeit', 'Geld', 'Wasser', 'Brot']
        },
        {
            word: 'arbeit',
            translation: 'trabalho',
            sentence: 'Ich gehe jeden Tag zur Arbeit.',
            sentenceTranslation: 'Eu vou trabalhar todos os dias.',
            sentenceWords: ['Ich', 'gehe', 'jeden', 'Tag', 'zur', 'Arbeit'],
            fill: 'Ich gehe jeden ___ zur Arbeit.',
            fillAnswer: 'Tag',
            fillOptions: ['Tag', 'Monat', 'Jahr', 'Abend']
        },
        {
            word: 'morgen',
            translation: 'manhã',
            sentence: 'Heute ist ein schöner Morgen.',
            sentenceTranslation: 'Hoje é uma bela manhã.',
            sentenceWords: ['Heute', 'ist', 'ein', 'schöner', 'Morgen'],
            fill: 'Heute ist ein schöner ___.',
            fillAnswer: 'Morgen',
            fillOptions: ['Morgen', 'Abend', 'Tag', 'Monat']
        },
        {
            word: 'nacht',
            translation: 'noite',
            sentence: 'Gute Nacht, schlaf gut.',
            sentenceTranslation: 'Boa noite, durma bem.',
            sentenceWords: ['Gute', 'Nacht', 'schlaf', 'gut'],
            fill: 'Gute Nacht, schlaf ___.',
            fillAnswer: 'gut',
            fillOptions: ['gut', 'schlecht', 'schnell', 'spät']
        },
        {
            word: 'buch',
            translation: 'livro',
            sentence: 'Ich lese ein Buch.',
            sentenceTranslation: 'Eu estou lendo um livro.',
            sentenceWords: ['Ich', 'lese', 'ein', 'Buch'],
            fill: 'Ich ___ ein Buch.',
            fillAnswer: 'lese',
            fillOptions: ['lese', 'schreibe', 'esse', 'sehe']
        },
        {
            word: 'musik',
            translation: 'música',
            sentence: 'Ich liebe es, Musik zu hören.',
            sentenceTranslation: 'Eu amo ouvir música.',
            sentenceWords: ['Ich', 'liebe', 'es', 'Musik', 'zu', 'hören'],
            fill: 'Ich liebe es, Musik zu ___.',
            fillAnswer: 'hören',
            fillOptions: ['hören', 'sehen', 'spielen', 'singen']
        },
        {
            word: 'trinken',
            translation: 'beber',
            sentence: 'Möchtest du etwas trinken?',
            sentenceTranslation: 'Você quer beber algo?',
            sentenceWords: ['Möchtest', 'du', 'etwas', 'trinken'],
            fill: 'Möchtest du etwas ___?',
            fillAnswer: 'trinken',
            fillOptions: ['trinken', 'essen', 'machen', 'sagen']
        },
        {
            word: 'groß',
            translation: 'grande',
            sentence: 'Dieses Haus ist sehr groß.',
            sentenceTranslation: 'Esta casa é muito grande.',
            sentenceWords: ['Dieses', 'Haus', 'ist', 'sehr', 'groß'],
            fill: 'Dieses Haus ist sehr ___.',
            fillAnswer: 'groß',
            fillOptions: ['groß', 'klein', 'alt', 'neu']
        },
        {
            word: 'klein',
            translation: 'pequeno',
            sentence: 'Ich habe einen kleinen Hund.',
            sentenceTranslation: 'Eu tenho um cachorro pequeno.',
            sentenceWords: ['Ich', 'habe', 'einen', 'kleinen', 'Hund'],
            fill: 'Ich habe einen ___ Hund.',
            fillAnswer: 'kleinen',
            fillOptions: ['kleinen', 'großen', 'alten', 'schönen']
        },
        {
            word: 'familie',
            translation: 'família',
            sentence: 'Ich liebe meine Familie.',
            sentenceTranslation: 'Eu amo minha família.',
            sentenceWords: ['Ich', 'liebe', 'meine', 'Familie'],
            fill: 'Ich liebe meine ___.',
            fillAnswer: 'Familie',
            fillOptions: ['Familie', 'Freund', 'Hund', 'Arbeit']
        },
        {
            word: 'schule',
            translation: 'escola',
            sentence: 'Die Kinder gehen zur Schule.',
            sentenceTranslation: 'As crianças vão à escola.',
            sentenceWords: ['Die', 'Kinder', 'gehen', 'zur', 'Schule'],
            fill: 'Die Kinder gehen zur ___.',
            fillAnswer: 'Schule',
            fillOptions: ['Schule', 'Haus', 'Strand', 'Geschäft']
        },
        {
            word: 'hund',
            translation: 'cachorro',
            sentence: 'Mein Hund ist sehr freundlich.',
            sentenceTranslation: 'Meu cachorro é muito amigável.',
            sentenceWords: ['Mein', 'Hund', 'ist', 'sehr', 'freundlich'],
            fill: 'Mein Hund ist sehr ___.',
            fillAnswer: 'freundlich',
            fillOptions: ['freundlich', 'hässlich', 'schnell', 'alt']
        },
        {
            word: 'rot',
            translation: 'vermelho',
            sentence: 'Ich mag die Farbe Rot.',
            sentenceTranslation: 'Eu gosto da cor vermelha.',
            sentenceWords: ['Ich', 'mag', 'die', 'Farbe', 'Rot'],
            fill: 'Ich mag die Farbe ___.',
            fillAnswer: 'Rot',
            fillOptions: ['Rot', 'Blau', 'Grün', 'Schwarz']
        },
        {
            word: 'ja',
            translation: 'sim',
            sentence: 'Ja, ich stimme zu.',
            sentenceTranslation: 'Sim, eu concordo.',
            sentenceWords: ['Ja', 'ich', 'stimme', 'zu'],
            fill: '___, ich stimme zu.',
            fillAnswer: 'Ja',
            fillOptions: ['Ja', 'Nein', 'Vielleicht', 'Nie']
        },
        {
            word: 'nein',
            translation: 'não',
            sentence: 'Nein, danke.',
            sentenceTranslation: 'Não, obrigado.',
            sentenceWords: ['Nein', 'danke'],
            fill: '___, danke.',
            fillAnswer: 'Nein',
            fillOptions: ['Nein', 'Ja', 'Doch', 'Danke']
        },
        {
            word: 'gut',
            translation: 'bom',
            sentence: 'Mir geht es gut, danke.',
            sentenceTranslation: 'Eu estou bem, obrigado.',
            sentenceWords: ['Mir', 'geht', 'es', 'gut', 'danke'],
            fill: 'Mir geht es ___, danke.',
            fillAnswer: 'gut',
            fillOptions: ['gut', 'schlecht', 'müde', 'krank']
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
        },
        {
            word: 'arrivederci',
            translation: 'adeus',
            sentence: 'Arrivederci, a domani!',
            sentenceTranslation: 'Adeus, até amanhã!',
            sentenceWords: ['Arrivederci', 'a', 'domani'],
            fill: 'Arrivederci, a ___!',
            fillAnswer: 'domani',
            fillOptions: ['domani', 'oggi', 'ieri', 'mai']
        },
        {
            word: 'per favore',
            translation: 'por favor',
            sentence: 'Siediti, per favore.',
            sentenceTranslation: 'Sente-se, por favor.',
            sentenceWords: ['Siediti', 'per', 'favore'],
            fill: 'Siediti, per ___.',
            fillAnswer: 'favore',
            fillOptions: ['favore', 'piacere', 'cortesia', 'gentilezza']
        },
        {
            word: 'acqua',
            translation: 'água',
            sentence: "Ho bisogno di un po' d'acqua.",
            sentenceTranslation: 'Eu preciso de um pouco de água.',
            sentenceWords: ['Ho', 'bisogno', 'di', 'un', "po'", "d'acqua"],
            fill: "Ho bisogno di un po' ___.",
            fillAnswer: "d'acqua",
            fillOptions: ["d'acqua", 'di pane', 'di tempo', "d'aiuto"]
        },
        {
            word: 'cibo',
            translation: 'comida',
            sentence: 'Il cibo è delizioso.',
            sentenceTranslation: 'A comida está deliciosa.',
            sentenceWords: ['Il', 'cibo', 'è', 'delizioso'],
            fill: 'Il cibo è ___.',
            fillAnswer: 'delizioso',
            fillOptions: ['delizioso', 'terribile', 'freddo', 'vecchio']
        },
        {
            word: 'amico',
            translation: 'amigo',
            sentence: 'Lei è la mia migliore amica.',
            sentenceTranslation: 'Ela é minha melhor amiga.',
            sentenceWords: ['Lei', 'è', 'la', 'mia', 'migliore', 'amica'],
            fill: 'Lei è la mia ___ amica.',
            fillAnswer: 'migliore',
            fillOptions: ['migliore', 'buona', 'vecchia', 'nuova']
        },
        {
            word: 'bello',
            translation: 'bonito',
            sentence: 'Che bella giornata!',
            sentenceTranslation: 'Que dia lindo!',
            sentenceWords: ['Che', 'bella', 'giornata'],
            fill: 'Che ___ giornata!',
            fillAnswer: 'bella',
            fillOptions: ['bella', 'brutta', 'triste', 'lunga']
        },
        {
            word: 'felice',
            translation: 'feliz',
            sentence: 'Sono molto felice oggi.',
            sentenceTranslation: 'Estou muito feliz hoje.',
            sentenceWords: ['Sono', 'molto', 'felice', 'oggi'],
            fill: 'Sono molto ___ oggi.',
            fillAnswer: 'felice',
            fillOptions: ['felice', 'triste', 'stanco', 'arrabbiato']
        },
        {
            word: 'tempo',
            translation: 'tempo',
            sentence: 'Non ho molto tempo.',
            sentenceTranslation: 'Eu não tenho muito tempo.',
            sentenceWords: ['Non', 'ho', 'molto', 'tempo'],
            fill: 'Non ho molto ___.',
            fillAnswer: 'tempo',
            fillOptions: ['tempo', 'denaro', 'acqua', 'pane']
        },
        {
            word: 'lavoro',
            translation: 'trabalho',
            sentence: 'Vado al lavoro ogni giorno.',
            sentenceTranslation: 'Eu vou trabalhar todos os dias.',
            sentenceWords: ['Vado', 'al', 'lavoro', 'ogni', 'giorno'],
            fill: 'Vado al lavoro ogni ___.',
            fillAnswer: 'giorno',
            fillOptions: ['giorno', 'anno', 'mese', 'sera']
        },
        {
            word: 'mattina',
            translation: 'manhã',
            sentence: 'Oggi è una bella mattina.',
            sentenceTranslation: 'Hoje é uma bela manhã.',
            sentenceWords: ['Oggi', 'è', 'una', 'bella', 'mattina'],
            fill: 'Oggi è una bella ___.',
            fillAnswer: 'mattina',
            fillOptions: ['mattina', 'notte', 'sera', 'settimana']
        },
        {
            word: 'notte',
            translation: 'noite',
            sentence: 'Buonanotte, dormi bene.',
            sentenceTranslation: 'Boa noite, durma bem.',
            sentenceWords: ['Buonanotte', 'dormi', 'bene'],
            fill: 'Buonanotte, dormi ___.',
            fillAnswer: 'bene',
            fillOptions: ['bene', 'male', 'veloce', 'tardi']
        },
        {
            word: 'libro',
            translation: 'livro',
            sentence: 'Sto leggendo un libro.',
            sentenceTranslation: 'Eu estou lendo um livro.',
            sentenceWords: ['Sto', 'leggendo', 'un', 'libro'],
            fill: 'Sto ___ un libro.',
            fillAnswer: 'leggendo',
            fillOptions: ['leggendo', 'scrivendo', 'mangiando', 'guardando']
        },
        {
            word: 'musica',
            translation: 'música',
            sentence: 'Adoro ascoltare la musica.',
            sentenceTranslation: 'Eu amo ouvir música.',
            sentenceWords: ['Adoro', 'ascoltare', 'la', 'musica'],
            fill: 'Adoro ascoltare la ___.',
            fillAnswer: 'musica',
            fillOptions: ['musica', 'radio', 'TV', 'canzone']
        },
        {
            word: 'bere',
            translation: 'beber',
            sentence: 'Vuoi bere qualcosa?',
            sentenceTranslation: 'Você quer beber algo?',
            sentenceWords: ['Vuoi', 'bere', 'qualcosa'],
            fill: 'Vuoi ___ qualcosa?',
            fillAnswer: 'bere',
            fillOptions: ['bere', 'mangiare', 'fare', 'dire']
        },
        {
            word: 'grande',
            translation: 'grande',
            sentence: 'Questa casa è molto grande.',
            sentenceTranslation: 'Esta casa é muito grande.',
            sentenceWords: ['Questa', 'casa', 'è', 'molto', 'grande'],
            fill: 'Questa casa è molto ___.',
            fillAnswer: 'grande',
            fillOptions: ['grande', 'piccola', 'vecchia', 'nuova']
        },
        {
            word: 'piccolo',
            translation: 'pequeno',
            sentence: 'Ho un cane piccolo.',
            sentenceTranslation: 'Eu tenho um cachorro pequeno.',
            sentenceWords: ['Ho', 'un', 'cane', 'piccolo'],
            fill: 'Ho un cane ___.',
            fillAnswer: 'piccolo',
            fillOptions: ['piccolo', 'grande', 'brutto', 'triste']
        },
        {
            word: 'famiglia',
            translation: 'família',
            sentence: 'Amo la mia famiglia.',
            sentenceTranslation: 'Eu amo minha família.',
            sentenceWords: ['Amo', 'la', 'mia', 'famiglia'],
            fill: 'Amo la mia ___.',
            fillAnswer: 'famiglia',
            fillOptions: ['famiglia', 'amico', 'cane', 'lavoro']
        },
        {
            word: 'scuola',
            translation: 'escola',
            sentence: 'I bambini vanno a scuola.',
            sentenceTranslation: 'As crianças vão à escola.',
            sentenceWords: ['I', 'bambini', 'vanno', 'a', 'scuola'],
            fill: 'I bambini vanno a ___.',
            fillAnswer: 'scuola',
            fillOptions: ['scuola', 'casa', 'spiaggia', 'negozio']
        },
        {
            word: 'cane',
            translation: 'cachorro',
            sentence: 'Il mio cane è molto amichevole.',
            sentenceTranslation: 'Meu cachorro é muito amigável.',
            sentenceWords: ['Il', 'mio', 'cane', 'è', 'molto', 'amichevole'],
            fill: 'Il mio cane è molto ___.',
            fillAnswer: 'amichevole',
            fillOptions: ['amichevole', 'brutto', 'veloce', 'vecchio']
        },
        {
            word: 'rosso',
            translation: 'vermelho',
            sentence: 'Mi piace il colore rosso.',
            sentenceTranslation: 'Eu gosto da cor vermelha.',
            sentenceWords: ['Mi', 'piace', 'il', 'colore', 'rosso'],
            fill: 'Mi piace il colore ___.',
            fillAnswer: 'rosso',
            fillOptions: ['rosso', 'blu', 'verde', 'nero']
        },
        {
            word: 'sì',
            translation: 'sim',
            sentence: "Sì, sono d'accordo.",
            sentenceTranslation: 'Sim, eu concordo.',
            sentenceWords: ['Sì', 'sono', "d'accordo"],
            fill: "___, sono d'accordo.",
            fillAnswer: 'Sì',
            fillOptions: ['Sì', 'No', 'Forse', 'Mai']
        },
        {
            word: 'no',
            translation: 'não',
            sentence: 'No, grazie.',
            sentenceTranslation: 'Não, obrigado.',
            sentenceWords: ['No', 'grazie'],
            fill: '___, grazie.',
            fillAnswer: 'No',
            fillOptions: ['No', 'Sì', 'Certo', 'Grazie']
        },
        {
            word: 'buongiorno',
            translation: 'bom dia',
            sentence: 'Buongiorno, come stai?',
            sentenceTranslation: 'Bom dia, como você está?',
            sentenceWords: ['Buongiorno', 'come', 'stai'],
            fill: 'Buongiorno, ___ stai?',
            fillAnswer: 'come',
            fillOptions: ['come', 'dove', 'quando', 'perché']
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
        },
        {
            word: 'ありがとう',
            translation: 'obrigado',
            sentence: 'ありがとうございます。',
            sentenceTranslation: 'Muito obrigado.',
            sentenceWords: ['ありがとう', 'ございます'],
            fill: 'ありがとう___。',
            fillAnswer: 'ございます',
            fillOptions: ['ございます', 'ですか', 'します', 'ましょう']
        },
        {
            word: 'さようなら',
            translation: 'adeus',
            sentence: 'さようなら、また明日。',
            sentenceTranslation: 'Adeus, até amanhã.',
            sentenceWords: ['さようなら', 'また', '明日'],
            fill: 'さようなら、___明日。',
            fillAnswer: 'また',
            fillOptions: ['また', 'もう', 'まだ', 'もし']
        },
        {
            word: 'お願いします',
            translation: 'por favor',
            sentence: 'これをお願いします。',
            sentenceTranslation: 'Isso, por favor.',
            sentenceWords: ['これを', 'お願いします'],
            fill: 'これを___。',
            fillAnswer: 'お願いします',
            fillOptions: ['お願いします', 'ください', 'どうぞ', 'すみません']
        },
        {
            word: '水',
            translation: 'água',
            sentence: '水が飲みたいです。',
            sentenceTranslation: 'Eu quero beber água.',
            sentenceWords: ['水が', '飲みたいです'],
            fill: '___飲みたいです。',
            fillAnswer: '水が',
            fillOptions: ['水が', '食べ物が', '時間が', '助けが']
        },
        {
            word: '食べ物',
            translation: 'comida',
            sentence: 'この食べ物はおいしいです。',
            sentenceTranslation: 'Esta comida está deliciosa.',
            sentenceWords: ['この', '食べ物は', 'おいしいです'],
            fill: 'この食べ物は___。',
            fillAnswer: 'おいしいです',
            fillOptions: ['おいしいです', 'まずいです', '冷たいです', '古いです']
        },
        {
            word: '友達',
            translation: 'amigo',
            sentence: '彼女は私の親友です。',
            sentenceTranslation: 'Ela é minha melhor amiga.',
            sentenceWords: ['彼女は', '私の', '親友です'],
            fill: '彼女は私の___。',
            fillAnswer: '親友です',
            fillOptions: ['親友です', '先生です', '家族です', '隣人です']
        },
        {
            word: '美しい',
            translation: 'bonito',
            sentence: 'なんて美しい日でしょう。',
            sentenceTranslation: 'Que dia lindo!',
            sentenceWords: ['なんて', '美しい', '日でしょう'],
            fill: 'なんて___日でしょう。',
            fillAnswer: '美しい',
            fillOptions: ['美しい', '醜い', '悪い', '悲しい']
        },
        {
            word: '幸せ',
            translation: 'feliz',
            sentence: '今日はとても幸せです。',
            sentenceTranslation: 'Estou muito feliz hoje.',
            sentenceWords: ['今日は', 'とても', '幸せです'],
            fill: '今日はとても___。',
            fillAnswer: '幸せです',
            fillOptions: ['幸せです', '悲しいです', '疲れています', '怒っています']
        },
        {
            word: '時間',
            translation: 'tempo',
            sentence: '時間があまりありません。',
            sentenceTranslation: 'Eu não tenho muito tempo.',
            sentenceWords: ['時間が', 'あまり', 'ありません'],
            fill: '___あまりありません。',
            fillAnswer: '時間が',
            fillOptions: ['時間が', 'お金が', '水が', 'パンが']
        },
        {
            word: '仕事',
            translation: 'trabalho',
            sentence: '毎日仕事に行きます。',
            sentenceTranslation: 'Eu vou trabalhar todos os dias.',
            sentenceWords: ['毎日', '仕事に', '行きます'],
            fill: '毎日仕事に___。',
            fillAnswer: '行きます',
            fillOptions: ['行きます', '来ます', '帰ります', '寝ます']
        },
        {
            word: '朝',
            translation: 'manhã',
            sentence: '今日は良い朝です。',
            sentenceTranslation: 'Hoje é uma boa manhã.',
            sentenceWords: ['今日は', '良い', '朝です'],
            fill: '今日は良い___。',
            fillAnswer: '朝です',
            fillOptions: ['朝です', '夜です', '昼です', '週です']
        },
        {
            word: '夜',
            translation: 'noite',
            sentence: 'おやすみなさい、良い夜を。',
            sentenceTranslation: 'Boa noite, tenha uma boa noite.',
            sentenceWords: ['おやすみなさい', '良い', '夜を'],
            fill: 'おやすみなさい、良い___。',
            fillAnswer: '夜を',
            fillOptions: ['夜を', '朝を', '日を', '週を']
        },
        {
            word: '本',
            translation: 'livro',
            sentence: '本を読んでいます。',
            sentenceTranslation: 'Eu estou lendo um livro.',
            sentenceWords: ['本を', '読んでいます'],
            fill: '___読んでいます。',
            fillAnswer: '本を',
            fillOptions: ['本を', '手紙を', '新聞を', '雑誌を']
        },
        {
            word: '音楽',
            translation: 'música',
            sentence: '音楽を聴くのが大好きです。',
            sentenceTranslation: 'Eu amo ouvir música.',
            sentenceWords: ['音楽を', '聴くのが', '大好きです'],
            fill: '音楽を聴くのが___。',
            fillAnswer: '大好きです',
            fillOptions: ['大好きです', '嫌いです', '苦手です', '下手です']
        },
        {
            word: '飲む',
            translation: 'beber',
            sentence: '何か飲みますか。',
            sentenceTranslation: 'Você quer beber algo?',
            sentenceWords: ['何か', '飲みますか'],
            fill: '何か___。',
            fillAnswer: '飲みますか',
            fillOptions: ['飲みますか', '食べますか', '見ますか', '買いますか']
        },
        {
            word: '大きい',
            translation: 'grande',
            sentence: 'この家はとても大きいです。',
            sentenceTranslation: 'Esta casa é muito grande.',
            sentenceWords: ['この', '家は', 'とても', '大きいです'],
            fill: 'この家はとても___。',
            fillAnswer: '大きいです',
            fillOptions: ['大きいです', '小さいです', '古いです', '新しいです']
        },
        {
            word: '小さい',
            translation: 'pequeno',
            sentence: '小さい犬を飼っています。',
            sentenceTranslation: 'Eu tenho um cachorro pequeno.',
            sentenceWords: ['小さい', '犬を', '飼っています'],
            fill: '___犬を飼っています。',
            fillAnswer: '小さい',
            fillOptions: ['小さい', '大きい', '醜い', '古い']
        },
        {
            word: '家族',
            translation: 'família',
            sentence: '家族を愛しています。',
            sentenceTranslation: 'Eu amo minha família.',
            sentenceWords: ['家族を', '愛しています'],
            fill: '___愛しています。',
            fillAnswer: '家族を',
            fillOptions: ['家族を', '友達を', '犬を', '仕事を']
        },
        {
            word: '学校',
            translation: 'escola',
            sentence: '子供たちは学校に行きます。',
            sentenceTranslation: 'As crianças vão à escola.',
            sentenceWords: ['子供たちは', '学校に', '行きます'],
            fill: '子供たちは___行きます。',
            fillAnswer: '学校に',
            fillOptions: ['学校に', '家に', '海に', '店に']
        },
        {
            word: '犬',
            translation: 'cachorro',
            sentence: '私の犬はとても人懐っこいです。',
            sentenceTranslation: 'Meu cachorro é muito amigável.',
            sentenceWords: ['私の', '犬は', 'とても', '人懐っこいです'],
            fill: '私の犬はとても___。',
            fillAnswer: '人懐っこいです',
            fillOptions: ['人懐っこいです', '醜いです', '速いです', '古いです']
        },
        {
            word: '赤',
            translation: 'vermelho',
            sentence: '赤い色が好きです。',
            sentenceTranslation: 'Eu gosto da cor vermelha.',
            sentenceWords: ['赤い', '色が', '好きです'],
            fill: '___色が好きです。',
            fillAnswer: '赤い',
            fillOptions: ['赤い', '青い', '緑の', '黒い']
        },
        {
            word: 'はい',
            translation: 'sim',
            sentence: 'はい、賛成です。',
            sentenceTranslation: 'Sim, eu concordo.',
            sentenceWords: ['はい', '賛成です'],
            fill: '___、賛成です。',
            fillAnswer: 'はい',
            fillOptions: ['はい', 'いいえ', 'たぶん', 'いつも']
        },
        {
            word: 'いいえ',
            translation: 'não',
            sentence: 'いいえ、結構です。',
            sentenceTranslation: 'Não, obrigado.',
            sentenceWords: ['いいえ', '結構です'],
            fill: '___、結構です。',
            fillAnswer: 'いいえ',
            fillOptions: ['いいえ', 'はい', 'もちろん', 'ありがとう']
        },
        {
            word: 'おはよう',
            translation: 'bom dia',
            sentence: 'おはようございます、元気ですか。',
            sentenceTranslation: 'Bom dia, como você está?',
            sentenceWords: ['おはようございます', '元気ですか'],
            fill: 'おはようございます、___。',
            fillAnswer: '元気ですか',
            fillOptions: ['元気ですか', 'お名前は', 'お仕事は', 'お天気は']
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
        },
        {
            word: '감사합니다',
            translation: 'obrigado',
            sentence: '정말 감사합니다.',
            sentenceTranslation: 'Muito obrigado.',
            sentenceWords: ['정말', '감사합니다'],
            fill: '정말 ___.',
            fillAnswer: '감사합니다',
            fillOptions: ['감사합니다', '죄송합니다', '괜찮습니다', '미안합니다']
        },
        {
            word: '안녕히 가세요',
            translation: 'adeus',
            sentence: '안녕히 가세요, 내일 봐요.',
            sentenceTranslation: 'Adeus, até amanhã.',
            sentenceWords: ['안녕히', '가세요', '내일', '봐요'],
            fill: '안녕히 가세요, ___ 봐요.',
            fillAnswer: '내일',
            fillOptions: ['내일', '오늘', '어제', '절대']
        },
        {
            word: '부탁합니다',
            translation: 'por favor',
            sentence: '이것 좀 부탁합니다.',
            sentenceTranslation: 'Isso, por favor.',
            sentenceWords: ['이것', '좀', '부탁합니다'],
            fill: '이것 좀 ___.',
            fillAnswer: '부탁합니다',
            fillOptions: ['부탁합니다', '고맙습니다', '괜찮습니다', '미안합니다']
        },
        {
            word: '물',
            translation: 'água',
            sentence: '물이 좀 필요해요.',
            sentenceTranslation: 'Eu preciso de um pouco de água.',
            sentenceWords: ['물이', '좀', '필요해요'],
            fill: '___ 좀 필요해요.',
            fillAnswer: '물이',
            fillOptions: ['물이', '음식이', '시간이', '도움이']
        },
        {
            word: '음식',
            translation: 'comida',
            sentence: '이 음식은 맛있어요.',
            sentenceTranslation: 'Esta comida está deliciosa.',
            sentenceWords: ['이', '음식은', '맛있어요'],
            fill: '이 음식은 ___.',
            fillAnswer: '맛있어요',
            fillOptions: ['맛있어요', '맛없어요', '차가워요', '오래됐어요']
        },
        {
            word: '친구',
            translation: 'amigo',
            sentence: '그녀는 제 가장 친한 친구예요.',
            sentenceTranslation: 'Ela é minha melhor amiga.',
            sentenceWords: ['그녀는', '제', '가장', '친한', '친구예요'],
            fill: '그녀는 제 가장 ___ 친구예요.',
            fillAnswer: '친한',
            fillOptions: ['친한', '좋은', '오래된', '새로운']
        },
        {
            word: '아름다운',
            translation: 'bonito',
            sentence: '정말 아름다운 날이에요!',
            sentenceTranslation: 'Que dia lindo!',
            sentenceWords: ['정말', '아름다운', '날이에요'],
            fill: '정말 ___ 날이에요!',
            fillAnswer: '아름다운',
            fillOptions: ['아름다운', '추한', '나쁜', '슬픈']
        },
        {
            word: '행복한',
            translation: 'feliz',
            sentence: '오늘 정말 행복해요.',
            sentenceTranslation: 'Estou muito feliz hoje.',
            sentenceWords: ['오늘', '정말', '행복해요'],
            fill: '오늘 정말 ___.',
            fillAnswer: '행복해요',
            fillOptions: ['행복해요', '슬퍼요', '피곤해요', '화나요']
        },
        {
            word: '시간',
            translation: 'tempo',
            sentence: '시간이 많지 않아요.',
            sentenceTranslation: 'Eu não tenho muito tempo.',
            sentenceWords: ['시간이', '많지', '않아요'],
            fill: '___ 많지 않아요.',
            fillAnswer: '시간이',
            fillOptions: ['시간이', '돈이', '물이', '빵이']
        },
        {
            word: '일',
            translation: 'trabalho',
            sentence: '매일 일하러 가요.',
            sentenceTranslation: 'Eu vou trabalhar todos os dias.',
            sentenceWords: ['매일', '일하러', '가요'],
            fill: '매일 일하러 ___.',
            fillAnswer: '가요',
            fillOptions: ['가요', '와요', '자요', '먹어요']
        },
        {
            word: '아침',
            translation: 'manhã',
            sentence: '오늘은 좋은 아침이에요.',
            sentenceTranslation: 'Hoje é uma boa manhã.',
            sentenceWords: ['오늘은', '좋은', '아침이에요'],
            fill: '오늘은 좋은 ___.',
            fillAnswer: '아침이에요',
            fillOptions: ['아침이에요', '밤이에요', '저녁이에요', '주말이에요']
        },
        {
            word: '밤',
            translation: 'noite',
            sentence: '안녕히 주무세요, 좋은 밤 되세요.',
            sentenceTranslation: 'Boa noite, durma bem.',
            sentenceWords: ['안녕히', '주무세요', '좋은', '밤', '되세요'],
            fill: '안녕히 주무세요, 좋은 ___ 되세요.',
            fillAnswer: '밤',
            fillOptions: ['밤', '아침', '하루', '주']
        },
        {
            word: '책',
            translation: 'livro',
            sentence: '저는 책을 읽고 있어요.',
            sentenceTranslation: 'Eu estou lendo um livro.',
            sentenceWords: ['저는', '책을', '읽고', '있어요'],
            fill: '저는 ___ 읽고 있어요.',
            fillAnswer: '책을',
            fillOptions: ['책을', '신문을', '편지를', '잡지를']
        },
        {
            word: '음악',
            translation: 'música',
            sentence: '저는 음악 듣는 것을 좋아해요.',
            sentenceTranslation: 'Eu amo ouvir música.',
            sentenceWords: ['저는', '음악', '듣는', '것을', '좋아해요'],
            fill: '저는 음악 듣는 것을 ___.',
            fillAnswer: '좋아해요',
            fillOptions: ['좋아해요', '싫어해요', '잘해요', '못해요']
        },
        {
            word: '마시다',
            translation: 'beber',
            sentence: '뭐 좀 마실래요?',
            sentenceTranslation: 'Você quer beber algo?',
            sentenceWords: ['뭐', '좀', '마실래요'],
            fill: '뭐 좀 ___?',
            fillAnswer: '마실래요',
            fillOptions: ['마실래요', '먹을래요', '볼래요', '살래요']
        },
        {
            word: '큰',
            translation: 'grande',
            sentence: '이 집은 정말 커요.',
            sentenceTranslation: 'Esta casa é muito grande.',
            sentenceWords: ['이', '집은', '정말', '커요'],
            fill: '이 집은 정말 ___.',
            fillAnswer: '커요',
            fillOptions: ['커요', '작아요', '오래됐어요', '새로워요']
        },
        {
            word: '작은',
            translation: 'pequeno',
            sentence: '저는 작은 강아지가 있어요.',
            sentenceTranslation: 'Eu tenho um cachorro pequeno.',
            sentenceWords: ['저는', '작은', '강아지가', '있어요'],
            fill: '저는 ___ 강아지가 있어요.',
            fillAnswer: '작은',
            fillOptions: ['작은', '큰', '못생긴', '늙은']
        },
        {
            word: '가족',
            translation: 'família',
            sentence: '저는 가족을 사랑해요.',
            sentenceTranslation: 'Eu amo minha família.',
            sentenceWords: ['저는', '가족을', '사랑해요'],
            fill: '저는 ___ 사랑해요.',
            fillAnswer: '가족을',
            fillOptions: ['가족을', '친구를', '강아지를', '일을']
        },
        {
            word: '학교',
            translation: 'escola',
            sentence: '아이들은 학교에 가요.',
            sentenceTranslation: 'As crianças vão à escola.',
            sentenceWords: ['아이들은', '학교에', '가요'],
            fill: '아이들은 ___ 가요.',
            fillAnswer: '학교에',
            fillOptions: ['학교에', '집에', '바다에', '가게에']
        },
        {
            word: '강아지',
            translation: 'cachorro',
            sentence: '제 강아지는 정말 친근해요.',
            sentenceTranslation: 'Meu cachorro é muito amigável.',
            sentenceWords: ['제', '강아지는', '정말', '친근해요'],
            fill: '제 강아지는 정말 ___.',
            fillAnswer: '친근해요',
            fillOptions: ['친근해요', '못생겼어요', '빨라요', '늙었어요']
        },
        {
            word: '빨간색',
            translation: 'vermelho',
            sentence: '저는 빨간색을 좋아해요.',
            sentenceTranslation: 'Eu gosto da cor vermelha.',
            sentenceWords: ['저는', '빨간색을', '좋아해요'],
            fill: '저는 ___ 좋아해요.',
            fillAnswer: '빨간색을',
            fillOptions: ['빨간색을', '파란색을', '초록색을', '검은색을']
        },
        {
            word: '네',
            translation: 'sim',
            sentence: '네, 저도 동의해요.',
            sentenceTranslation: 'Sim, eu também concordo.',
            sentenceWords: ['네', '저도', '동의해요'],
            fill: '___, 저도 동의해요.',
            fillAnswer: '네',
            fillOptions: ['네', '아니요', '아마도', '절대']
        },
        {
            word: '아니요',
            translation: 'não',
            sentence: '아니요, 괜찮아요.',
            sentenceTranslation: 'Não, tudo bem.',
            sentenceWords: ['아니요', '괜찮아요'],
            fill: '___, 괜찮아요.',
            fillAnswer: '아니요',
            fillOptions: ['아니요', '네', '물론', '고마워요']
        },
        {
            word: '고양이',
            translation: 'gato',
            sentence: '고양이가 소파 위에 있어요.',
            sentenceTranslation: 'O gato está no sofá.',
            sentenceWords: ['고양이가', '소파', '위에', '있어요'],
            fill: '___ 소파 위에 있어요.',
            fillAnswer: '고양이가',
            fillOptions: ['고양이가', '강아지가', '책이', '친구가']
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
        },
        {
            word: '谢谢',
            translation: 'obrigado',
            sentence: '非常谢谢你。',
            sentenceTranslation: 'Muito obrigado.',
            sentenceWords: ['非常', '谢谢', '你'],
            fill: '非常___你。',
            fillAnswer: '谢谢',
            fillOptions: ['谢谢', '对不起', '没关系', '请问']
        },
        {
            word: '再见',
            translation: 'adeus',
            sentence: '再见，明天见。',
            sentenceTranslation: 'Adeus, até amanhã.',
            sentenceWords: ['再见', '明天', '见'],
            fill: '再见，___见。',
            fillAnswer: '明天',
            fillOptions: ['明天', '今天', '昨天', '从不']
        },
        {
            word: '请',
            translation: 'por favor',
            sentence: '请坐。',
            sentenceTranslation: 'Sente-se, por favor.',
            sentenceWords: ['请', '坐'],
            fill: '___坐。',
            fillAnswer: '请',
            fillOptions: ['请', '谢谢', '对不起', '再']
        },
        {
            word: '水',
            translation: 'água',
            sentence: '我需要一点水。',
            sentenceTranslation: 'Eu preciso de um pouco de água.',
            sentenceWords: ['我', '需要', '一点', '水'],
            fill: '我需要一点___。',
            fillAnswer: '水',
            fillOptions: ['水', '食物', '时间', '帮助']
        },
        {
            word: '食物',
            translation: 'comida',
            sentence: '这个食物很好吃。',
            sentenceTranslation: 'Esta comida está deliciosa.',
            sentenceWords: ['这个', '食物', '很好吃'],
            fill: '这个食物___。',
            fillAnswer: '很好吃',
            fillOptions: ['很好吃', '很难吃', '很冷', '很旧']
        },
        {
            word: '朋友',
            translation: 'amigo',
            sentence: '她是我最好的朋友。',
            sentenceTranslation: 'Ela é minha melhor amiga.',
            sentenceWords: ['她', '是', '我最好的', '朋友'],
            fill: '她是我___的朋友。',
            fillAnswer: '最好',
            fillOptions: ['最好', '很老', '新', '坏']
        },
        {
            word: '漂亮',
            translation: 'bonito',
            sentence: '今天天气真漂亮！',
            sentenceTranslation: 'Que dia lindo!',
            sentenceWords: ['今天', '天气', '真', '漂亮'],
            fill: '今天天气真___！',
            fillAnswer: '漂亮',
            fillOptions: ['漂亮', '糟糕', '难看', '悲伤']
        },
        {
            word: '开心',
            translation: 'feliz',
            sentence: '我今天很开心。',
            sentenceTranslation: 'Estou muito feliz hoje.',
            sentenceWords: ['我', '今天', '很', '开心'],
            fill: '我今天很___。',
            fillAnswer: '开心',
            fillOptions: ['开心', '难过', '累', '生气']
        },
        {
            word: '时间',
            translation: 'tempo',
            sentence: '我没有太多时间。',
            sentenceTranslation: 'Eu não tenho muito tempo.',
            sentenceWords: ['我', '没有', '太多', '时间'],
            fill: '我没有太多___。',
            fillAnswer: '时间',
            fillOptions: ['时间', '钱', '水', '面包']
        },
        {
            word: '工作',
            translation: 'trabalho',
            sentence: '我每天都去工作。',
            sentenceTranslation: 'Eu vou trabalhar todos os dias.',
            sentenceWords: ['我', '每天', '都去', '工作'],
            fill: '我每天都去___。',
            fillAnswer: '工作',
            fillOptions: ['工作', '学校', '家', '商店']
        },
        {
            word: '早上',
            translation: 'manhã',
            sentence: '今天早上很美。',
            sentenceTranslation: 'Esta manhã está linda.',
            sentenceWords: ['今天', '早上', '很美'],
            fill: '今天___很美。',
            fillAnswer: '早上',
            fillOptions: ['早上', '晚上', '中午', '周末']
        },
        {
            word: '晚上',
            translation: 'noite',
            sentence: '晚安，好好睡觉。',
            sentenceTranslation: 'Boa noite, durma bem.',
            sentenceWords: ['晚安', '好好', '睡觉'],
            fill: '晚安，___睡觉。',
            fillAnswer: '好好',
            fillOptions: ['好好', '快点', '慢慢', '马上']
        },
        {
            word: '书',
            translation: 'livro',
            sentence: '我在看书。',
            sentenceTranslation: 'Eu estou lendo um livro.',
            sentenceWords: ['我', '在', '看书'],
            fill: '我在___。',
            fillAnswer: '看书',
            fillOptions: ['看书', '写字', '吃饭', '看电视']
        },
        {
            word: '音乐',
            translation: 'música',
            sentence: '我喜欢听音乐。',
            sentenceTranslation: 'Eu amo ouvir música.',
            sentenceWords: ['我', '喜欢', '听', '音乐'],
            fill: '我喜欢听___。',
            fillAnswer: '音乐',
            fillOptions: ['音乐', '新闻', '电视', '故事']
        },
        {
            word: '喝',
            translation: 'beber',
            sentence: '你想喝点什么吗？',
            sentenceTranslation: 'Você quer beber algo?',
            sentenceWords: ['你', '想', '喝点', '什么吗'],
            fill: '你想___什么吗？',
            fillAnswer: '喝点',
            fillOptions: ['喝点', '吃点', '做点', '说点']
        },
        {
            word: '大',
            translation: 'grande',
            sentence: '这个房子很大。',
            sentenceTranslation: 'Esta casa é muito grande.',
            sentenceWords: ['这个', '房子', '很大'],
            fill: '这个房子___。',
            fillAnswer: '很大',
            fillOptions: ['很大', '很小', '很旧', '很新']
        },
        {
            word: '小',
            translation: 'pequeno',
            sentence: '我有一只小狗。',
            sentenceTranslation: 'Eu tenho um cachorro pequeno.',
            sentenceWords: ['我', '有', '一只', '小狗'],
            fill: '我有一只___。',
            fillAnswer: '小狗',
            fillOptions: ['小狗', '大狗', '老狗', '丑狗']
        },
        {
            word: '家庭',
            translation: 'família',
            sentence: '我爱我的家庭。',
            sentenceTranslation: 'Eu amo minha família.',
            sentenceWords: ['我', '爱', '我的', '家庭'],
            fill: '我爱我的___。',
            fillAnswer: '家庭',
            fillOptions: ['家庭', '朋友', '狗', '工作']
        },
        {
            word: '学校',
            translation: 'escola',
            sentence: '孩子们去学校。',
            sentenceTranslation: 'As crianças vão à escola.',
            sentenceWords: ['孩子们', '去', '学校'],
            fill: '孩子们去___。',
            fillAnswer: '学校',
            fillOptions: ['学校', '家', '海边', '商店']
        },
        {
            word: '狗',
            translation: 'cachorro',
            sentence: '我的狗很友好。',
            sentenceTranslation: 'Meu cachorro é muito amigável.',
            sentenceWords: ['我的', '狗', '很友好'],
            fill: '我的狗___。',
            fillAnswer: '很友好',
            fillOptions: ['很友好', '很丑', '很快', '很老']
        },
        {
            word: '红色',
            translation: 'vermelho',
            sentence: '我喜欢红色。',
            sentenceTranslation: 'Eu gosto da cor vermelha.',
            sentenceWords: ['我', '喜欢', '红色'],
            fill: '我喜欢___。',
            fillAnswer: '红色',
            fillOptions: ['红色', '蓝色', '绿色', '黑色']
        },
        {
            word: '是的',
            translation: 'sim',
            sentence: '是的，我同意。',
            sentenceTranslation: 'Sim, eu concordo.',
            sentenceWords: ['是的', '我', '同意'],
            fill: '___，我同意。',
            fillAnswer: '是的',
            fillOptions: ['是的', '不是', '也许', '从不']
        },
        {
            word: '不',
            translation: 'não',
            sentence: '不，谢谢。',
            sentenceTranslation: 'Não, obrigado.',
            sentenceWords: ['不', '谢谢'],
            fill: '___，谢谢。',
            fillAnswer: '不',
            fillOptions: ['不', '是', '当然', '谢谢']
        },
        {
            word: '猫',
            translation: 'gato',
            sentence: '猫在沙发上。',
            sentenceTranslation: 'O gato está no sofá.',
            sentenceWords: ['猫', '在', '沙发上'],
            fill: '猫___沙发上。',
            fillAnswer: '在',
            fillOptions: ['在', '是', '有', '和']
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

const XP_PER_LEVEL = 100;
const STORAGE_KEY = 'talk-data-v1';

const ACHIEVEMENTS = [
    { id: 'streak-3', icon: '🔥', title: '3 dias seguidos', desc: 'Pratique 3 dias seguidos', check: d => getEffectiveStreak(d) >= 3 },
    { id: 'streak-7', icon: '🔥', title: 'Uma semana de sequência', desc: 'Pratique 7 dias seguidos', check: d => getEffectiveStreak(d) >= 7 },
    { id: 'streak-30', icon: '🔥', title: 'Um mês de sequência', desc: 'Pratique 30 dias seguidos', check: d => getEffectiveStreak(d) >= 30 },
    { id: 'xp-100', icon: '⭐', title: 'Primeiros 100 XP', desc: 'Alcance 100 XP no total', check: d => getTotalXp(d) >= 100 },
    { id: 'xp-500', icon: '⭐', title: '500 XP', desc: 'Alcance 500 XP no total', check: d => getTotalXp(d) >= 500 },
    { id: 'xp-1000', icon: '🌟', title: 'Mestre do XP', desc: 'Alcance 1000 XP no total', check: d => getTotalXp(d) >= 1000 },
    { id: 'perfect', icon: '💯', title: 'Lição perfeita', desc: 'Complete uma lição sem errar', check: (d, ctx) => !!(ctx && ctx.perfect) },
    { id: 'polyglot-3', icon: '🌍', title: 'Poliglota', desc: 'Pratique 3 idiomas diferentes', check: d => Object.keys(d.languages).length >= 3 },
    { id: 'polyglot-5', icon: '🗺️', title: 'Explorador de idiomas', desc: 'Pratique 5 idiomas diferentes', check: d => Object.keys(d.languages).length >= 5 }
];

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                languages: parsed.languages || {},
                daily: Object.assign({ lastDate: null, streak: 0, longestStreak: 0, history: {}, goalXp: 30 }, parsed.daily || {}),
                achievements: parsed.achievements || []
            };
        }
    } catch (e) {
        console.warn('Could not read saved progress', e);
    }
    return {
        languages: {},
        daily: { lastDate: null, streak: 0, longestStreak: 0, history: {}, goalXp: 30 },
        achievements: []
    };
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.warn('Could not save progress', e);
    }
}

function getLangData(code) {
    if (!appData.languages[code]) {
        appData.languages[code] = { xp: 0, lessonsCompleted: 0, bestStreak: 0, words: {} };
    }
    return appData.languages[code];
}

function getTotalXp(data = appData) {
    return Object.values(data.languages).reduce((sum, l) => sum + (l.xp || 0), 0);
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function shiftDateStr(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function getEffectiveStreak(data = appData) {
    const daily = data.daily;
    if (!daily.lastDate) return 0;
    const today = todayStr();
    const yesterday = shiftDateStr(today, -1);
    if (daily.lastDate === today || daily.lastDate === yesterday) return daily.streak;
    return 0;
}

function registerDailyActivity(xpEarned) {
    const today = todayStr();
    const daily = appData.daily;

    if (daily.lastDate !== today) {
        const yesterday = shiftDateStr(today, -1);
        daily.streak = (daily.lastDate === yesterday) ? daily.streak + 1 : 1;
        daily.lastDate = today;
        daily.longestStreak = Math.max(daily.longestStreak || 0, daily.streak);
    }

    daily.history[today] = (daily.history[today] || 0) + xpEarned;
    saveData();
}

function getWordState(langCode, word) {
    const lang = getLangData(langCode);
    if (!lang.words[word]) lang.words[word] = { box: 0, seen: 0, correct: 0 };
    return lang.words[word];
}

function recordWordResult(langCode, word, isCorrect) {
    const w = getWordState(langCode, word);
    w.seen++;
    if (isCorrect) {
        w.correct++;
        w.box = Math.min(4, w.box + 1);
    } else {
        w.box = 0;
    }
    saveData();
}

function addXp(amount) {
    gameState.xp += amount;
    gameState.sessionBestStreak = Math.max(gameState.sessionBestStreak, gameState.streak);

    const lang = getLangData(gameState.currentLang);
    lang.xp += amount;
    lang.bestStreak = Math.max(lang.bestStreak || 0, gameState.sessionBestStreak);

    registerDailyActivity(amount);
}

function checkAchievements(ctx = {}) {
    let unlockedAny = false;
    ACHIEVEMENTS.forEach(a => {
        if (appData.achievements.includes(a.id)) return;
        if (a.check(appData, ctx)) {
            appData.achievements.push(a.id);
            showToast(a.icon, a.title);
            unlockedAny = true;
        }
    });
    if (unlockedAny) saveData();
}

function showToast(icon, title) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-text">
            <strong>Conquista desbloqueada!</strong>
            <span>${title}</span>
        </div>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3800);
}

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
    sessionBestStreak: 0,
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

let appData = loadData();

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
    continueBtn: document.getElementById('continue-btn'),
    dailyCard: document.getElementById('daily-card'),
    dailyStreakValue: document.getElementById('daily-streak-value'),
    dailyWeek: document.getElementById('daily-week'),
    goalRingFill: document.getElementById('goal-ring-fill'),
    goalRingValue: document.getElementById('goal-ring-value'),
    trophyToggle: document.getElementById('trophy-toggle'),
    achievementsModal: document.getElementById('achievements-modal'),
    achievementsGrid: document.getElementById('achievements-grid'),
    achievementsClose: document.getElementById('achievements-close')
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
    renderDailyDashboard();
}

function initGame() {
    gameState.streak = 0;
    gameState.sessionBestStreak = 0;
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

function lessonWeight(lesson) {
    const lang = getLangData(gameState.currentLang);
    const w = lang.words[lesson.word];
    if (!w) return 5;
    return Math.max(1, 6 - w.box);
}

function pickWeighted(pool) {
    const weights = pool.map(lessonWeight);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
}

function getRandomLesson() {
    const lessons = LESSONS[gameState.currentLang] || LESSONS.en;
    const availableLessons = lessons.filter((_, i) => !gameState.usedLessons.has(i));

    if (availableLessons.length === 0) {
        gameState.usedLessons.clear();
        const picked = pickWeighted(lessons);
        gameState.usedLessons.add(lessons.indexOf(picked));
        return picked;
    }

    const picked = pickWeighted(availableLessons);
    const originalIdx = lessons.indexOf(picked);
    gameState.usedLessons.add(originalIdx);
    return picked;
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
                    gameState.questionsAnswered++;
                    addXp(15 + (gameState.streak * 2));
                    exercise.pairs.forEach(l => recordWordResult(gameState.currentLang, l.word, true));
                    audio.playCorrect();
                    updateStats();
                    checkAchievements();
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
    const word = gameState.currentExercise?.lesson?.word;
    if (word) recordWordResult(gameState.currentLang, word, isCorrect);

    if (isCorrect) {
        gameState.streak++;
        gameState.questionsAnswered++;
        addXp(10 + (gameState.streak * 2));

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
    checkAchievements();

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
    saveData();
}

function showLevelComplete() {
    DOM.gameArea.classList.add('hidden');
    DOM.feedbackArea.classList.add('hidden');
    DOM.levelComplete.classList.remove('hidden');

    const perfect = gameState.hearts === 5;
    const bonusXp = 50 + (gameState.hearts * 10);
    addXp(bonusXp);
    DOM.rewardXp.textContent = `+${bonusXp} XP`;

    const lang = getLangData(gameState.currentLang);
    lang.lessonsCompleted = (lang.lessonsCompleted || 0) + 1;
    saveData();

    checkAchievements({ perfect });

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

function renderLanguageCards() {
    DOM.languageGrid.querySelectorAll('.language-card').forEach(card => {
        const code = card.dataset.lang;
        const lang = appData.languages[code];

        let progressEl = card.querySelector('.lang-progress');
        if (!progressEl) {
            progressEl = document.createElement('div');
            progressEl.className = 'lang-progress';
            card.appendChild(progressEl);
        }

        if (lang && lang.xp > 0) {
            const level = Math.floor(lang.xp / XP_PER_LEVEL) + 1;
            const pct = lang.xp % XP_PER_LEVEL;
            progressEl.innerHTML = `
                <span class="lang-level">Nv. ${level}</span>
                <div class="lang-bar"><div class="lang-bar-fill" style="width:${pct}%"></div></div>
            `;
        } else {
            progressEl.innerHTML = '';
        }
    });
}

function renderDailyWeek() {
    if (!DOM.dailyWeek) return;
    DOM.dailyWeek.innerHTML = '';

    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const active = (appData.daily.history[key] || 0) > 0;

        const dot = document.createElement('div');
        dot.className = 'day-dot' + (active ? ' active' : '') + (i === 0 ? ' today' : '');
        dot.innerHTML = `<span class="day-dot-circle"></span><span class="day-dot-label">${labels[d.getDay()]}</span>`;
        DOM.dailyWeek.appendChild(dot);
    }
}

function renderDailyDashboard() {
    const streak = getEffectiveStreak();
    if (DOM.dailyStreakValue) DOM.dailyStreakValue.textContent = streak;
    if (DOM.dailyCard) DOM.dailyCard.classList.toggle('has-streak', streak > 0);

    const goal = appData.daily.goalXp;
    const earnedToday = appData.daily.history[todayStr()] || 0;
    const pct = Math.min(1, earnedToday / goal);
    const circumference = 2 * Math.PI * 26;

    if (DOM.goalRingFill) {
        DOM.goalRingFill.style.strokeDasharray = `${circumference}`;
        DOM.goalRingFill.style.strokeDashoffset = `${circumference * (1 - pct)}`;
    }
    if (DOM.goalRingValue) {
        DOM.goalRingValue.textContent = `${Math.min(earnedToday, goal)}/${goal}`;
    }
    if (DOM.dailyCard) DOM.dailyCard.classList.toggle('goal-complete', earnedToday >= goal);

    renderDailyWeek();
    renderLanguageCards();
}

function renderAchievements() {
    if (!DOM.achievementsGrid) return;
    DOM.achievementsGrid.innerHTML = ACHIEVEMENTS.map(a => {
        const unlocked = appData.achievements.includes(a.id);
        return `
            <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                <span class="achievement-icon">${unlocked ? a.icon : '🔒'}</span>
                <span class="achievement-title">${a.title}</span>
                <span class="achievement-desc">${a.desc}</span>
            </div>
        `;
    }).join('');
}

DOM.languageGrid.querySelectorAll('.language-card').forEach(card => {
    card.addEventListener('click', () => {
        const lang = card.dataset.lang;
        selectLanguage(lang);
    });
});

DOM.btnBackLang.addEventListener('click', goBackToLanguageSelect);

DOM.trophyToggle?.addEventListener('click', () => {
    audio.playClick();
    renderAchievements();
    DOM.achievementsModal.classList.remove('hidden');
});

DOM.achievementsClose?.addEventListener('click', () => {
    DOM.achievementsModal.classList.add('hidden');
});

DOM.achievementsModal?.addEventListener('click', (e) => {
    if (e.target === DOM.achievementsModal) DOM.achievementsModal.classList.add('hidden');
});

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

renderDailyDashboard();
checkAchievements();
