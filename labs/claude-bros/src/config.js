/* Claude Bros — constantes da simulação, mapa da fase e tiers de qualidade.
 *
 * --- Simulação --------------------------------------------------------------
 * Passo fixo de 1/120s com acumulador: a física não muda com o refresh rate do
 * monitor (60Hz, 120Hz ou um frame perdido dão o mesmo salto).
 *
 * Unidades da lógica: 1 tile = 32px de mundo. Velocidades em px/s, acelerações
 * em px/s². A cena 3D usa metros: 1 tile = 1 m (U = 1/32), com y para cima e o
 * topo do chão em y = 0 — a conversão vive em `toX`/`toY`.
 *
 *   GRAVITY        1900 px/s²   queda com peso, sem virar pedra
 *   JUMP_VELOCITY  -560 px/s    ~2.6 tiles de altura, passa por cima do rival
 *   RUN_SPEED       210 px/s    ~6.5 tiles/s
 *
 * --- Sensação de controle ---------------------------------------------------
 *   · coyote time (140ms) — pular logo depois de sair da plataforma ainda vale
 *   · jump buffer (160ms) — apertar pulo pouco antes de pousar ainda vale
 *   · pulo variável — soltar o botão corta a subida
 *   · ápice leve — perto do topo do pulo (|vy| < APEX_SPEED) a gravidade cai
 *     para APEX_GRAVITY·g enquanto o botão está preso: dá tempo de mirar o pouso
 *   · derrapagem — trocar de direção em corrida freia com SKID_ACCEL (mais forte
 *     que a aceleração normal) e levanta poeira
 *   · controle aéreo reduzido (AIR_ACCEL < RUN_ACCEL) e atrito do ar baixo
 *   · correção de quina — bater a cabeça a menos de CORNER_NUDGE px da borda de
 *     um bloco desliza o personagem para o lado em vez de matar o pulo
 */

export const TILE = 32;
export const GRAVITY = 1900;
export const JUMP_VELOCITY = -560;
export const JUMP_CUT = 0.45;      // fator aplicado à subida quando o botão é solto
export const RUN_SPEED = 210;
export const RUN_ACCEL = 1500;
export const SKID_ACCEL = 2700;
export const AIR_ACCEL = 1150;
export const RUN_FRICTION = 1900;
export const AIR_FRICTION = 420;
export const MAX_FALL = 780;
export const COYOTE_TIME = 0.14;
export const JUMP_BUFFER = 0.16;
export const APEX_SPEED = 70;
export const APEX_GRAVITY = 0.62;
export const CORNER_NUDGE = 7;
export const ENEMY_SPEED = 52;
export const STOMP_BOUNCE = -380;
export const FIXED_STEP = 1 / 120;

/* Modo família (pensado para crianças):
 *   LIVES        5 vidas por partida (eram 3)
 *   HURT_INSET   o corpo do rival e das estacas "machuca" só no miolo: a caixa de
 *                dano encolhe HURT_INSET px de cada lado — encostar de raspão não dói
 *   STOMP_WINDOW pisar vale se os pés estão nos 75% de cima do rival (eram 60%)
 *   RESPAWN_INVULN segundos piscando (sem dano) depois de renascer               */
export const LIVES = 5;
export const HURT_INSET = 5;
export const STOMP_WINDOW = 0.75;
export const RESPAWN_INVULN = 2;

/* Mapa. Cada caractere é um tile de 32px.
 * Nenhuma caixa '?' fica sobre a borda de um vão: bater a cabeça nela no pulo
 * derrubava o personagem na água (armadilha injusta para criança). Pelo mesmo
 * motivo há no máximo um rival por trecho de chão; os outros ficam nas plataformas.
 *   #  chão                    =  plataforma (degrau, ilhota ou torre)
 *   ?  caixa de faísca         o  faísca dourada
 *   e  rival (musgoso)         ^  estacas de ferro
 *   P  nascimento do jogador   F  estandarte final                */
export const LEVEL = [
    '                                                                                        ',
    '                                                                                        ',
    '                                                                                        ',
    '                                                    o o o                               ',
    '                                        o          =======                              ',
    '                              o o      ===                                   o o o      ',
    '                    ?        =====                        o  o              =======     ',
    '            oeo                                 ?        ======                         ',
    '           =====                                                      e                F',
    '                                                     o                       ?         =',
    '     o                         ?  oeo                                  o o             =',
    '   =====        e                =====        e            ^^        =======  e        =',
    '###########   ############   #############   ########   ########   ##############   #####',
    '###########   ############   #############   ########   ########   ##############   #####',
];

export const COLS = Math.max(...LEVEL.map((row) => row.length));
export const ROWS = LEVEL.length;
export const GROUND_ROW = 12;
export const WORLD_WIDTH = COLS * TILE;
export const WORLD_HEIGHT = ROWS * TILE;

/** Superfície da água dos vãos, em metros (y da cena). Cair abaixo dela custa uma vida. */
export const WATER_LEVEL = -2.3;

/** px da lógica → metros da cena. */
export const U = 1 / TILE;
export const toX = (px) => px * U;
export const toY = (py) => (GROUND_ROW * TILE - py) * U;

/* Tiers de qualidade. `density` multiplica a vegetação/rochas instanciadas;
   `grass` é o número de tufos por m² nas ilhas; `terrainRes` o passo (m) da grade do
   terreno; `propShadows` liga a sombra projetada por plantas, pedras e árvores. */
export const QUALITY = {
    low: { pixelRatio: 1.25, shadowMap: 1024, density: 0.22, grass: 2.5, trees: 0.25, terrainRes: 0.4, propShadows: false, transmission: false, sculpt: 0.022, clouds: 8 },
    medium: { pixelRatio: 1.5, shadowMap: 2048, density: 0.7, grass: 9, trees: 0.75, terrainRes: 0.3, propShadows: true, transmission: true, sculpt: 0.018, clouds: 12 },
    high: { pixelRatio: 2, shadowMap: 2048, density: 1, grass: 15, trees: 1, terrainRes: 0.25, propShadows: true, transmission: true, sculpt: 0.015, clouds: 16 }
};

export const STORAGE_QUALITY = 'claude-bros:quality';
