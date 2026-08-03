(() => {
  'use strict';

  const STORAGE_KEY = 'dinkie-dino-researched-v1';
  const HOUR_MS = 60 * 60 * 1000;
  const ALERT_REPEAT_MS = 4 * 60 * 1000;
  const IDEAL_TEMP = 25;
  const GRID_W = 38;
  const GRID_H = 24;
  const CELL = 6;

  const LEFT_ICONS = ['drink', 'food', 'light', 'discipline', 'stats'];
  const RIGHT_ICONS = ['play', 'study', 'bath', 'ac', 'medicine'];
  const ALL_ICONS = LEFT_ICONS.concat(RIGHT_ICONS);
  const GRADES = ['E+', 'D+', 'C+', 'B+', 'A+'];
  const RPS = ['rock', 'scissors', 'paper'];

  const canvas = document.getElementById('petCanvas');
  const ctx = canvas.getContext('2d');
  const shell = document.getElementById('tamaShell');
  const lcd = document.getElementById('lcd');
  const soundState = document.getElementById('soundState');
  const resetButton = document.getElementById('resetButton');
  const iconElements = Object.fromEntries(ALL_ICONS.map((id) => [id, document.querySelector(`[data-icon="${id}"]`)]));

  function rows(source) {
    return source.trim().split('\n').map((row) => row.trim());
  }

  /* Pixel art transcribed from photographed/scanned Dinkie Dino LCD frames. */
  const SPRITES = {
    common: [
      [
        rows(`
          ..####..
          .#....#.
          #......#
          #.#..#.#
          #......#
          #......#
          .######.
        `),
        rows(`
          ..####..
          .#....#.
          #......#
          #......#
          #......#
          .######.
        `)
      ],
      [
        rows(`
          ...######...
          ..#......#..
          .#........#.
          #..........#
          #..........#
          #...#..#...#
          #..........#
          #..........#
          #..........#
          .#........#.
          ..########..
        `),
        rows(`
          ...########...
          ..#........#..
          .#..........#.
          #............#
          #............#
          #...#....#...#
          #............#
          .#..........#.
          ..##########..
        `)
      ]
    ],
    meat: [
      [
        rows(`
          .....##.......
          ...######.....
          ..#......#....
          .#........#...
          #..........#..
          #..........#..
          #..#...#...#..
          #..........#..
          #..........##.
          #...........##
          .#...........#
          ..###########.
        `),
        rows(`
          .....##.......
          ...######.....
          ..#......#....
          .#........#...
          #..........#..
          #..........#..
          #..#...#....##
          #............#
          #...........#.
          .#.........#..
          ..#########...
        `)
      ],
      [
        rows(`
          ....###......
          ..#######....
          .#......##...
          #........#...
          #.........#..
          #..#..#...#..
          #.........#..
          #.........##.
          #..........#.
          #..........#.
          .#..........#
          .#..##..####.
          ..##..##.....
        `),
        rows(`
          ....###......
          ..#######....
          .#.......#...
          #.........#..
          #.........#..
          #..#..#...#..
          #..........##
          #...........#
          #...........#
          .#.........#.
          ..#..##..##..
          ...##..##....
        `)
      ],
      [
        rows(`
          ....###.......
          ..######......
          .#.....##.....
          #.......##....
          #........#....
          #.#..#...##...
          #.........#...
          #.........##..
          .#.........#..
          ##...#.....##.
          .#..........#.
          .#...........#
          .#..##..#####.
          ..##..###.....
        `),
        rows(`
          ....###.......
          ..######......
          .#.....##.....
          #.......##....
          #.#..#...#....
          #........##...
          #.........#...
          #.........##..
          .#..........##
          ##.....#.....#
          .#..........#.
          .#.........#..
          #..##..####...
          .##..###......
        `)
      ],
      [
        rows(`
          ....###.........
          ..######........
          .#.....##.......
          .#......##......
          #..#.#...##.....
          #........##.....
          #.........##....
          .##........##...
          ..#...#.....##..
          ###..##......###
          ..#............#
          ..#...#......##.
          .##..##...####..
          .#...#...##.....
          ..###.####......
        `),
        rows(`
          ....###.........
          ..######........
          .#.....##.......
          .#......##......
          #........##.....
          #..#.#...##.....
          #.........##....
          #..........##...
          .##...##....##..
          ..#....#.....##.
          ..#...........##
          ..#....#.......#
          .##...##...####.
          .#....#...##....
          ..####.####.....
        `)
      ]
    ],
    vegetable: [
      [
        rows(`
          ...######.....
          ..#......#....
          .#........#...
          #..........#..
          #..........#..
          #..#...#...#..
          #..........#..
          #..........##.
          #...........##
          .#...........#
          ..###########.
        `),
        rows(`
          ...######.....
          ..#......#....
          .#........#...
          #..........#..
          #..........#..
          #..#...#....##
          #............#
          #...........#.
          .#.........#..
          ..#########...
        `)
      ],
      [
        rows(`
          ...######......
          ..#......#.....
          .#........#....
          .#........#....
          #..........#...
          #..#...#...#...
          #..........#...
          #..........##..
          #...........##.
          #............##
          .#............#
          ..#..##..#####.
          ...##..##......
        `),
        rows(`
          ...######......
          ..#......#.....
          .#........#....
          #..........#...
          #..........#...
          #..#...#...#...
          #...........###
          #.............#
          #............##
          .#..........##.
          .#..####..###..
          ..##....##.....
        `)
      ],
      [
        rows(`
          ..#####.......
          .#.....#......
          #.......#.....
          #.#..#..#.....
          #.......#.....
          #.......#.....
          .##.....##....
          ..#......##...
          .#........##..
          .#.........###
          .#...........#
          .#..#..#..####
          ..##.##.###...
        `),
        rows(`
          ..#####.......
          .#.....#......
          #.......#.....
          #.......#.....
          #.#..#..#.....
          #.......#.....
          .##.....##....
          ..#......##...
          .#........####
          .#...........#
          .#.........##.
          #..#..#..##...
          .##.##.###....
        `)
      ],
      [
        rows(`
          ..####...........
          .#....#..........
          #......#.........
          #.#.#..#.........
          #......#.........
          #......#.........
          .###...#.........
          ...#...#.........
          ...#....##.......
          ..#......###.....
          .##........##....
          .#..........##...
          .#...........###.
          .#..#..........##
          .#..#..##..######
          ..##.###.###.....
        `),
        rows(`
          ..####...........
          .#....#..........
          #......#.........
          #.#..#.#.........
          #......#.........
          #......#.........
          .###...#.........
          ...#...#.........
          ...#....##.......
          ..#......###...##
          .##........####.#
          .#..............#
          .#............##.
          .#.#.........##..
          .#.#..##..####...
          ..#.###.###......
        `)
      ]
    ],
    pasta: [
      [
        rows(`
          ...######.....
          #.#......#....
          ##........#...
          #..........#..
          #..........#..
          #..#...#...#..
          #..........#..
          #..........##.
          #...........##
          .#...........#
          ..###########.
        `),
        rows(`
          ...######.....
          #.#......#....
          ##........#...
          #..........#..
          #..........#..
          #..#...#....##
          #............#
          #...........#.
          .#.........#..
          ..#########...
        `)
      ],
      [
        rows(`
          ...######......
          #.#......#.....
          ##........#....
          ##........#....
          #..........#...
          #..#...#...#...
          #..........#...
          #..........##..
          #...........##.
          #............##
          .#............#
          ..#..##..#####.
          ...##..##......
        `),
        rows(`
          ...######......
          #.#......#.....
          ##........#....
          #..........#...
          #..........#...
          #..#...#...#...
          #...........###
          #.............#
          #............##
          .#..........##.
          .#..####..###..
          ..##....##.....
        `)
      ],
      [
        rows(`
          #..#####.........
          ###....##........
          ##......##.......
          #........##......
          #..#.#....#......
          #.........#......
          #.........##.....
          #..........##....
          .#..........##...
          ..#..........##..
          ..#............#.
          ..#.............#
          ..#..#..##...###.
          ...##.##..###....
        `),
        rows(`
          #..#####........
          ###....##.......
          ##......##......
          #........##.....
          #.#...#...#.....
          #.........#.....
          #.........##....
          #..........##...
          .#..........#.##
          ..#..........#.#
          ..#............#
          ..#...........#.
          .#..#..##...##..
          ..##.##..###....
        `)
      ],
      [
        rows(`
          ....#####..........
          ...#######.........
          #.##....###........
          ###......###.......
          ##........##.......
          #..#..#...##.......
          #.........####.....
          #.........##.##....
          .#.......##...##.##
          ..##....##.....##.#
          ...#####..........#
          ...#.............#.
          ...#...#....#..##..
          ...#..#...##...#...
          ....##.###..###....
        `),
        rows(`
          #...#####..........
          ##.#######.........
          ####....###........
          ###......###.......
          ##........##.......
          #..#.#....##.......
          #.........####.....
          #.........##.##....
          .#.......##...##...
          ..##....##.....##..
          ...#####........##.
          ...#.............##
          ..##..#....#......#
          ..#..#...##...####.
          ...##.###..###.....
        `)
      ]
    ],
    angel: [
      rows(`
        ........##.........
        ......######.......
        .....#......#......
        ....#..#..#..#.....
        ....#........#.....
        ....#.#....#.#.....
        ....#..####..#.....
        .####........#####.
        #....#......#.....#
        .#....#######....#.
        ..#...#.....#..##..
        ...####......##....
        ......#........#...
        .......#........#..
        ........########...
      `),
      rows(`
        ........##.........
        ..#...######..#....
        .....#......#......
        .#..#..#..#..#..#.
        ....#........#.....
        ....#.#....#.#.....
        .##.#.######.#.###.
        #..##.######.##...#
        #...#..####..#....#
        .#...#......#....#.
        ..#...#######...#..
        ...#..#.....#..#...
        ....###......####..
        ......#.........#..
        .......#.......#...
        ........#######....
      `)
    ],
    devil: [
      rows(`
        ..#............#...
        ...###......###....
        ....##########.....
        .....#......#......
        ##..#.##..##.#...##
        ###.#........#.####
        #####.######.######
        #####.#.##.#.######
        #####.#.##.#.######
        #.###..####..####.#
        ..#.##......###.#..
        ....###.....##.....
        ......#.......##...
        ......#........#...
        .......#......#....
        ........######.....
      `),
      rows(`
        ...###......###....
        ..#.##########.#...
        .....#......#......
        ....#........#.....
        ....#.##..##.#.....
        ....#........#.....
        ..###.#....#.###...
        .####.######.#####.
        #####..#..#..######
        ######......#######
        #.#.###.....###.#.#
        ......#......#.....
        ......#.......#....
        .......#.......#...
        ........#######....
      `)
    ],
    grave: [
      rows(`
        ...#####......##..
        ..#.....#.....##..
        .#.......#..######
        ..#.....#...######
        ...#####......##..
        ..............##..
        ..#######.....##..
        .#.......#....##..
        #.........#.......
        #.........###.....
        #..#...#..#..#....
        #.###.###.#...#...
        #..#...#..#....##.
        .#.......#.......#
        ..#######.######..
      `),
      rows(`
        ..............##..
        ...#####......##..
        ..#.....#...######
        ...#####....######
        ..............##..
        ..............##..
        ..#######.....##..
        .#.......#....##..
        #.........#.......
        #.........###.....
        #..#...#..#..#....
        #.###.###.#...#...
        #..#...#..#....##.
        .#.......#.......#
        ..#######.######..
      `)
    ]
  };

  const FOOD_SPRITES = {
    burger: rows(`
      ...###########...
      ..#....#......#..
      .#...#....#....#.
      .#.............#.
      #################
      #################
      #################
      .#.............#.
      .#.............#.
      ..#############..
    `),
    chicken: rows(`
      ...#######........
      ..#.......#.......
      .#.........#......
      #....#.....#...##.
      #.......#...#.#..#
      #..#........###..#
      #.....#.....#...#.
      #.#.........###..#
      #......#....#.#..#
      .#.........#...##.
      ..#.......#.......
      ...#######........
    `),
    noodles: rows(`
      ....#..#..#......
      ....#..#..#......
      ...#..#..#.......
      #################
      ...#..#..#.......
      #################
      ...#..#..#.......
      ....#..#..#......
      .#############...
      .##.........##...
      ..##.......##....
      ...##.....##.....
      ....#######......
    `),
    icecream: rows(`
      ....######....
      ...#......#...
      ..#..#.....#..
      .#..#.......#.
      .#....#.....#.
      #..#.........#
      #............#
      .############.
      .#..........#.
      .##........##.
      ..#........#..
      ...##....##...
      ....#....#....
      ....######....
    `),
    carrot: rows(`
      ....###...
      ##..###.##
      ###.##..##
      .###.#.#..
      ...####...
      ..#....#..
      .#......#.
      .#...####.
      .#......#.
      .#....###.
      .###....#.
      ..#....#..
      ...#..#...
      ....##....
    `),
    apple: rows(`
      ......#.####..
      ......#######.
      ......#.####..
      ......#.......
      ...########...
      .##........##.
      ##..........##
      #............#
      #............#
      #............#
      #............#
      .#..........#.
      ..##......##..
      ...########...
    `)
  };

  const FOODS = [
    { id: 'burger', group: 'meat' },
    { id: 'chicken', group: 'meat' },
    { id: 'noodles', group: 'pasta' },
    { id: 'icecream', group: 'treat' },
    { id: 'carrot', group: 'vegetable' },
    { id: 'apple', group: 'vegetable' }
  ];

  const HANDS = {
    rock: rows(`
      ..##...
      .#..##.
      ##....#
      .....##
      ......#
      .....##
      ......#
      .....##
      ##....#
      ..####.
    `),
    scissors: rows(`
      ..##......
      .#..#.....
      ##...#####
      .........#
      .....####.
      .........#
      .....#####
      .....#....
      ##...#....
      .####.....
    `),
    paper: rows(`
      ..##.....
      .#..####.
      ##......#
      .....####
      ........#
      .....####
      ........#
      .....####
      ##......#
      ..######.
    `)
  };

  const FONT = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
    'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'],
    'C': ['111', '100', '100', '100', '111'], 'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'], 'F': ['111', '100', '110', '100', '100'],
    'H': ['101', '101', '111', '101', '101'], 'K': ['101', '101', '110', '101', '101'],
    'G': ['111', '100', '101', '101', '111'], 'I': ['111', '010', '010', '010', '111'],
    'L': ['100', '100', '100', '100', '111'], 'M': ['101', '111', '111', '101', '101'],
    'N': ['101', '111', '111', '111', '101'], 'O': ['111', '101', '101', '101', '111'],
    'P': ['111', '101', '111', '100', '100'], 'R': ['110', '101', '110', '101', '101'],
    'S': ['111', '100', '111', '001', '111'], 'T': ['111', '010', '010', '010', '010'],
    'U': ['101', '101', '101', '101', '111'], 'V': ['101', '101', '101', '101', '010'],
    'Z': ['111', '001', '010', '100', '111'],
    '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
    ':': ['0', '1', '0', '1', '0'], ' ': ['0', '0', '0', '0', '0']
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function freshState() {
    return {
      version: 1,
      initialized: false,
      clockOffset: 0,
      birthAt: null,
      stage: 0,
      branch: null,
      food: 0,
      drink: 0,
      mood: 3,
      education: 0,
      weight: 1,
      temperature: IDEAL_TEMP,
      acOn: false,
      lightsOn: true,
      dirty: false,
      sick: false,
      sickSince: null,
      alive: true,
      ending: null,
      foodBias: { meat: 0, vegetable: 0, pasta: 0 },
      lastFoodGroup: 'pasta',
      lastEducationHour: null,
      lastProcessedHour: null,
      lastAlertAt: 0,
      soundOn: true,
      careGood: 0,
      careBad: 0,
      wakeCount: 0,
      endingWake: null,
      seed: Math.floor(Date.now() % 2147483647)
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === 1) return Object.assign(freshState(), saved);
    } catch (error) {
      /* A reset below is equivalent to pressing the rear button after bad memory. */
    }
    return freshState();
  }

  let state = loadState();
  let uiMode = state.initialized ? 'idle' : 'clock_wait';
  let selectedSide = null;
  let selectedIndex = -1;
  let statsPage = 0;
  let foodChoice = 0;
  let clockField = 'hour';
  let clockHour = state.initialized ? gameDate().getHours() : 12;
  let clockMinute = state.initialized ? gameDate().getMinutes() : 0;
  let animation = null;
  let rps = null;
  let frame = 0;
  let lastFrameAt = 0;
  let walkX = 8;
  let walkDirection = 1;
  let audioContext = null;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* The original keeps running even if its retained memory cannot be written. */
    }
  }

  function gameDate(realTimestamp = Date.now()) {
    return new Date(realTimestamp + state.clockOffset);
  }

  function gameTimestamp(realTimestamp = Date.now()) {
    return realTimestamp + state.clockOffset;
  }

  function hourIndex(realTimestamp = Date.now()) {
    return Math.floor(gameTimestamp(realTimestamp) / HOUR_MS);
  }

  function isSleeping() {
    const hour = gameDate().getHours();
    return hour >= 21 || hour < 9;
  }

  function displayDay() {
    if (state.ending) return 13;
    return [1, 2, 3, 5, 7, 9][state.stage] || 1;
  }

  function randomAt(value) {
    let n = (value ^ state.seed) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 2246822507);
    n = Math.imul(n ^ (n >>> 13), 3266489909);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function ensureAudio() {
    if (!state.soundOn) return null;
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioContext = new AudioCtor();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function tone(frequency, duration = 0.055, delay = 0, volume = 0.035) {
    const audio = ensureAudio();
    if (!audio) return;
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  const sound = {
    key: () => tone(1350, 0.035),
    enter: () => { tone(950, 0.045); tone(1350, 0.06, 0.05); },
    cancel: () => { tone(750, 0.05); tone(480, 0.07, 0.055); },
    alert: () => { tone(2050, 0.075, 0, 0.05); tone(2050, 0.075, 0.16, 0.05); },
    happy: () => { [880, 1100, 1320, 1760].forEach((note, index) => tone(note, 0.065, index * 0.07)); },
    sad: () => { tone(560, 0.09); tone(380, 0.14, 0.1); },
    death: () => { [420, 330, 250, 190].forEach((note, index) => tone(note, 0.18, index * 0.18, 0.045)); }
  };

  function updateSoundLabel() {
    soundState.textContent = state.soundOn ? 'som ligado' : 'som desligado';
  }

  function updateIconSelection(activeId = null) {
    for (const id of ALL_ICONS) {
      iconElements[id].classList.toggle('selected', id === currentIcon());
      iconElements[id].classList.toggle('active', id === activeId);
    }
  }

  function currentIcon() {
    if (!selectedSide || selectedIndex < 0) return null;
    const list = selectedSide === 'left' ? LEFT_ICONS : RIGHT_ICONS;
    return list[selectedIndex] || null;
  }

  function beginAnimation(type, duration, onDone, data = {}) {
    animation = { type, startedAt: performance.now(), duration, onDone, data };
    uiMode = 'animation';
    updateIconSelection(type);
  }

  function finishAnimation() {
    if (!animation) return;
    const done = animation.onDone;
    animation = null;
    uiMode = 'idle';
    updateIconSelection();
    if (done) done();
    saveState();
  }

  function chooseBranch() {
    const values = state.foodBias;
    const greatest = Math.max(values.meat, values.vegetable, values.pasta);
    const tied = ['meat', 'vegetable', 'pasta'].filter((key) => values[key] === greatest);
    return tied.includes(state.lastFoodGroup) ? state.lastFoodGroup : tied[0];
  }

  /* A documented play log records the six displayed ages as 1, 2, 3, 5, 7 and 9. */
  const EVOLUTION_DAYS = [2, 3, 5, 7, 9];

  function checkEvolution() {
    if (!state.alive || state.ending || state.stage >= 5) return;
    if (state.wakeCount < EVOLUTION_DAYS[state.stage]) return;
    /* Trial-and-error testing confirms the first change occurs at exactly 15 kg. */
    if (state.stage === 0 && state.weight !== 15) return;
    state.stage += 1;
    if (state.stage === 2 && !state.branch) state.branch = chooseBranch();
    sound.happy();
  }

  function processHour(index) {
    if (!state.initialized || !state.alive) return;
    const date = new Date(index * HOUR_MS);
    const hour = date.getHours();

    if (state.ending === 'angel' || state.ending === 'devil') {
      if (hour === 9) {
        state.wakeCount += 1;
        if (state.endingWake !== null && state.wakeCount > state.endingWake) {
          state.alive = false;
          state.ending = 'grave';
          sound.death();
        }
      }
      return;
    }
    if (state.ending === 'grave') return;

    const temperatureStep = Math.floor(randomAt(index) * 9);
    state.temperature = clamp(state.temperature + (state.acOn ? -temperatureStep : temperatureStep), 10, 40);

    if (hour === 9) {
      state.wakeCount += 1;
      state.lightsOn = true;
      if (state.food === 8 && state.drink === 4) state.weight = clamp(state.weight + 1, 1, 99);
      checkEvolution();
      if (state.wakeCount >= 13 && state.stage === 5) {
        state.ending = randomAt(index + 71) < 0.5 ? 'angel' : 'devil';
        state.endingWake = state.wakeCount;
        state.careGood += 1;
        sound.happy();
      }
    }

    if (hour >= 10 && hour <= 15) {
      if (state.food === 8 && state.drink === 4) state.weight = clamp(state.weight + 1, 1, 99);
      const early = state.stage === 0;
      state.food = clamp(state.food - (early ? 4 : 2), 0, 8);
      state.drink = clamp(state.drink - (early ? 2 : 1), 0, 4);
      if (hour === 10 || hour === 12 || hour === 14) state.mood = clamp(state.mood - 1, 0, 5);
    }

    if (hour === 21 && state.lightsOn) state.careBad += 1;
    if (state.food === 0 || state.drink === 0) state.careBad += 1;
    else state.careGood += 1;

    if (!state.dirty && hour >= 10 && hour <= 20 && randomAt(index + 137) < 0.075) state.dirty = true;

    const unsafeTemperature = state.temperature > 30 || state.temperature < 20;
    const asleepAtThisHour = hour >= 21 || hour < 9;
    const neglected = state.food === 0 || state.drink === 0 || (asleepAtThisHour && state.lightsOn);
    if (!state.sick && (unsafeTemperature || neglected) && randomAt(index + 251) < 0.24) {
      state.sick = true;
      state.sickSince = index * HOUR_MS;
      sound.alert();
    }

    if (state.sick && state.sickSince && index * HOUR_MS - state.sickSince > 6 * HOUR_MS) {
      state.alive = false;
      state.ending = 'grave';
      sound.death();
    }
  }

  function catchUp() {
    if (!state.initialized || !state.alive) return;
    const current = hourIndex();
    if (state.lastProcessedHour === null || current < state.lastProcessedHour) {
      state.lastProcessedHour = current;
      saveState();
      return;
    }
    const maximumCatchUp = 24 * 30;
    let processed = 0;
    while (state.lastProcessedHour < current && processed < maximumCatchUp) {
      state.lastProcessedHour += 1;
      processHour(state.lastProcessedHour);
      processed += 1;
    }
    saveState();
  }

  function needsAttention() {
    return state.alive && !state.ending && (
      state.food === 0 || state.drink === 0 || state.mood === 0 || state.dirty || state.sick ||
      state.temperature > 30 || state.temperature < 20
    );
  }

  function maybeAlert() {
    if (!needsAttention()) return;
    const now = Date.now();
    if (now - state.lastAlertAt >= ALERT_REPEAT_MS) {
      state.lastAlertAt = now;
      sound.alert();
      saveState();
    }
  }

  function canEat(food) {
    if (state.stage < 2 || !state.branch || food.group === 'treat') return true;
    if (state.branch === 'pasta') return food.group === 'pasta';
    if (state.branch === 'meat') return food.group === 'meat' || food.group === 'pasta';
    return food.group === 'vegetable' || food.group === 'pasta';
  }

  function improveEducation() {
    const hour = hourIndex();
    if (state.lastEducationHour === hour) return;
    state.education = clamp(state.education + 1, 0, 4);
    state.lastEducationHour = hour;
  }

  function executeAction(id) {
    if (!state.alive || state.ending) {
      sound.cancel();
      return;
    }
    const sleeping = isSleeping();
    if (sleeping && !['light', 'stats', 'ac', 'medicine'].includes(id)) {
      beginAnimation('refuse', 1050, () => sound.cancel());
      return;
    }

    if (id === 'drink') {
      beginAnimation('drink', 1500, () => {
        state.drink = clamp(state.drink + 1, 0, 4);
        sound.enter();
      });
      return;
    }
    if (id === 'food') {
      uiMode = 'food';
      foodChoice = 0;
      sound.enter();
      return;
    }
    if (id === 'light') {
      state.lightsOn = !state.lightsOn;
      sound.enter();
      saveState();
      return;
    }
    if (id === 'discipline') {
      beginAnimation('pet', 1600, () => {
        improveEducation();
        sound.happy();
      });
      return;
    }
    if (id === 'stats') {
      statsPage = 0;
      uiMode = 'stats';
      sound.enter();
      return;
    }
    if (id === 'play') {
      rps = { round: 0, dinoWins: 0, choice: 0, reveal: null, revealUntil: 0 };
      uiMode = 'rps';
      sound.enter();
      return;
    }
    if (id === 'study') {
      beginAnimation('study', 1650, () => {
        improveEducation();
        sound.happy();
      });
      return;
    }
    if (id === 'bath') {
      beginAnimation('bath', 1700, () => {
        state.dirty = false;
        sound.happy();
      });
      return;
    }
    if (id === 'ac') {
      state.acOn = !state.acOn;
      beginAnimation('ac', 1100, () => sound.enter(), { on: state.acOn });
      return;
    }
    if (id === 'medicine') {
      if (!state.sick) {
        beginAnimation('refuse', 1050, () => sound.cancel());
        return;
      }
      beginAnimation('medicine', 1650, () => {
        state.sick = false;
        state.sickSince = null;
        state.mood = 0;
        state.food = 0;
        state.drink = 0;
        state.education = 0;
        sound.enter();
      });
    }
  }

  function confirmFood() {
    const food = FOODS[foodChoice];
    if (!canEat(food)) {
      beginAnimation('refuse', 1100, () => sound.cancel());
      return;
    }
    beginAnimation('eat', 1550, () => {
      state.food = clamp(state.food + 1, 0, 8);
      if (food.group === 'treat') state.mood = clamp(state.mood + 1, 0, 5);
      else {
        state.foodBias[food.group] += 1;
        state.lastFoodGroup = food.group;
      }
      sound.enter();
    }, { food });
  }

  function beats(first, second) {
    return (first === 'rock' && second === 'scissors') ||
      (first === 'scissors' && second === 'paper') ||
      (first === 'paper' && second === 'rock');
  }

  function playRpsRound() {
    if (!rps || rps.reveal) return;
    const player = RPS[rps.choice];
    const dino = RPS[Math.floor(randomAt(hourIndex() + rps.round * 31 + frame) * 3)];
    const dinoWon = beats(dino, player);
    if (dinoWon) {
      rps.dinoWins += 1;
      state.mood = clamp(state.mood + 1, 0, 5);
      sound.happy();
    } else {
      sound.key();
    }
    rps.reveal = { player, dino, dinoWon };
    rps.revealUntil = performance.now() + 950;
    rps.round += 1;
  }

  function finishRpsReveal() {
    if (!rps || !rps.reveal || performance.now() < rps.revealUntil) return;
    rps.reveal = null;
    if (rps.round >= 5) {
      uiMode = 'idle';
      rps = null;
      updateIconSelection();
      saveState();
    }
  }

  function applyClock() {
    const realNow = new Date();
    const target = new Date(realNow);
    target.setHours(clockHour, clockMinute, 0, 0);
    state.clockOffset = target.getTime() - realNow.getTime();
    if (!state.initialized) {
      state.initialized = true;
      state.birthAt = target.getTime();
      state.lastProcessedHour = Math.floor(target.getTime() / HOUR_MS);
    } else {
      state.lastProcessedHour = Math.floor(target.getTime() / HOUR_MS);
    }
    uiMode = 'idle';
    sound.enter();
    saveState();
  }

  function handleButton(code) {
    ensureAudio();
    if (animation) return;

    if (uiMode === 'clock_wait') {
      if (code === 'ENTER') {
        clockField = 'hour';
        uiMode = 'clock_set';
        sound.enter();
      }
      return;
    }

    if (uiMode === 'clock_set') {
      if (code === 'LEFT') {
        if (clockField === 'hour') clockHour = (clockHour + 1) % 24;
        else clockMinute = (clockMinute + 1) % 60;
        sound.key();
      } else if (code === 'RIGHT') {
        clockField = clockField === 'hour' ? 'minute' : 'hour';
        sound.key();
      } else if (code === 'ENTER') {
        if (clockField === 'hour') {
          clockField = 'minute';
          sound.key();
        } else {
          applyClock();
        }
      } else if (code === 'ESC' && state.initialized) {
        uiMode = 'idle';
        sound.cancel();
      }
      return;
    }

    if (uiMode === 'clock') {
      if (code === 'CLOCK' || code === 'ESC' || code === 'ENTER') {
        uiMode = 'idle';
        sound.cancel();
      }
      return;
    }

    if (uiMode === 'stats') {
      if (code === 'LEFT' || code === 'RIGHT') {
        statsPage = (statsPage + (code === 'RIGHT' ? 1 : 5)) % 6;
        sound.key();
      } else if (code === 'ESC' || code === 'ENTER' || code === 'CLOCK') {
        uiMode = 'idle';
        sound.cancel();
      }
      return;
    }

    if (uiMode === 'food') {
      if (code === 'LEFT' || code === 'RIGHT') {
        foodChoice = (foodChoice + (code === 'RIGHT' ? 1 : FOODS.length - 1)) % FOODS.length;
        sound.key();
      } else if (code === 'ENTER') {
        confirmFood();
      } else if (code === 'ESC') {
        uiMode = 'idle';
        sound.cancel();
      }
      return;
    }

    if (uiMode === 'rps') {
      if (code === 'ESC') {
        uiMode = 'idle';
        rps = null;
        sound.cancel();
      } else if (!rps.reveal && (code === 'LEFT' || code === 'RIGHT')) {
        rps.choice = (rps.choice + (code === 'RIGHT' ? 1 : 2)) % 3;
        sound.key();
      } else if (!rps.reveal && code === 'ENTER') {
        playRpsRound();
      }
      return;
    }

    if (code === 'CLOCK') {
      uiMode = 'clock';
      selectedSide = null;
      selectedIndex = -1;
      updateIconSelection();
      sound.enter();
      return;
    }
    if (code === 'ESC') {
      selectedSide = null;
      selectedIndex = -1;
      updateIconSelection();
      sound.cancel();
      return;
    }
    if (code === 'LEFT' || code === 'RIGHT') {
      const side = code === 'LEFT' ? 'left' : 'right';
      if (selectedSide !== side) {
        selectedSide = side;
        selectedIndex = 0;
      } else {
        selectedIndex = (selectedIndex + 1) % 5;
      }
      updateIconSelection();
      sound.key();
      return;
    }
    if (code === 'ENTER' && currentIcon()) {
      executeAction(currentIcon());
    }
  }

  const heldButtons = new Set();
  const consumedButtons = new Set();
  let soundComboTimer = null;
  let clockComboTimer = null;

  function pressButton(element, code) {
    element.classList.add('pressed');
    shell.classList.add('is-pressing');
    heldButtons.add(code);
    if (navigator.vibrate) navigator.vibrate(8);

    if (heldButtons.has('LEFT') && heldButtons.has('RIGHT') && !soundComboTimer) {
      soundComboTimer = setTimeout(() => {
        state.soundOn = !state.soundOn;
        consumedButtons.add('LEFT');
        consumedButtons.add('RIGHT');
        updateSoundLabel();
        if (state.soundOn) sound.enter();
        saveState();
      }, 3000);
    }

    if (heldButtons.has('ESC') && heldButtons.has('ENTER') && !clockComboTimer && state.initialized && uiMode === 'idle') {
      clockComboTimer = setTimeout(() => {
        const now = gameDate();
        clockHour = now.getHours();
        clockMinute = now.getMinutes();
        clockField = 'hour';
        uiMode = 'clock_set';
        consumedButtons.add('ESC');
        consumedButtons.add('ENTER');
        sound.enter();
      }, 420);
    }
  }

  function releaseButton(element, code) {
    element.classList.remove('pressed');
    heldButtons.delete(code);
    if (!shell.querySelector('.pressed')) shell.classList.remove('is-pressing');

    if (!(heldButtons.has('LEFT') && heldButtons.has('RIGHT'))) {
      clearTimeout(soundComboTimer);
      soundComboTimer = null;
    }
    if (!(heldButtons.has('ESC') && heldButtons.has('ENTER'))) {
      clearTimeout(clockComboTimer);
      clockComboTimer = null;
    }

    if (consumedButtons.has(code)) {
      consumedButtons.delete(code);
      return;
    }
    handleButton(code);
  }

  document.querySelectorAll('[data-btn]').forEach((element) => {
    const code = element.dataset.btn;
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      pressButton(element, code);
    });
    element.addEventListener('pointerup', (event) => {
      event.preventDefault();
      releaseButton(element, code);
    });
    element.addEventListener('pointercancel', () => releaseButton(element, code));
  });

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const map = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Escape: 'ESC', Enter: 'ENTER', c: 'CLOCK', C: 'CLOCK' };
    const code = map[event.key];
    if (!code) return;
    event.preventDefault();
    const element = document.querySelector(`[data-btn="${code}"]`);
    if (element) pressButton(element, code);
  });

  document.addEventListener('keyup', (event) => {
    const map = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Escape: 'ESC', Enter: 'ENTER', c: 'CLOCK', C: 'CLOCK' };
    const code = map[event.key];
    if (!code) return;
    event.preventDefault();
    const element = document.querySelector(`[data-btn="${code}"]`);
    if (element) releaseButton(element, code);
  });

  resetButton.addEventListener('click', () => {
    state = freshState();
    uiMode = 'clock_wait';
    selectedSide = null;
    selectedIndex = -1;
    clockHour = 12;
    clockMinute = 0;
    clockField = 'hour';
    animation = null;
    rps = null;
    updateIconSelection();
    updateSoundLabel();
    saveState();
    sound.enter();
  });

  function pixel(x, y, width = 1, height = 1) {
    ctx.fillRect(Math.round(x * CELL), Math.round(y * CELL), Math.round(width * CELL), Math.round(height * CELL));
  }

  function drawMatrix(matrix, x, y, flip = false) {
    const width = Math.max(...matrix.map((line) => line.length));
    matrix.forEach((line, row) => {
      for (let column = 0; column < line.length; column += 1) {
        if (line[column] !== '#') continue;
        pixel(x + (flip ? width - column - 1 : column), y + row);
      }
    });
  }

  function matrixSize(matrix) {
    return { width: Math.max(...matrix.map((line) => line.length)), height: matrix.length };
  }

  function drawCentered(matrix, centerX = GRID_W / 2, centerY = GRID_H / 2, flip = false) {
    const size = matrixSize(matrix);
    drawMatrix(matrix, Math.round(centerX - size.width / 2), Math.round(centerY - size.height / 2), flip);
  }

  function textWidth(text, scale = 1) {
    return Array.from(text).reduce((total, character, index) => {
      const glyph = FONT[character] || FONT[' '];
      return total + glyph[0].length * scale + (index < text.length - 1 ? scale : 0);
    }, 0);
  }

  function drawText(text, x, y, scale = 1, centered = false) {
    const value = String(text).toUpperCase();
    let cursor = centered ? x - Math.floor(textWidth(value, scale) / 2) : x;
    for (const character of value) {
      const glyph = FONT[character] || FONT[' '];
      glyph.forEach((line, row) => {
        for (let column = 0; column < line.length; column += 1) {
          if (line[column] === '1') pixel(cursor + column * scale, y + row * scale, scale, scale);
        }
      });
      cursor += glyph[0].length * scale + scale;
    }
  }

  function getDinoFrames() {
    if (state.stage < 2) return SPRITES.common[state.stage];
    const branch = state.branch || 'pasta';
    return SPRITES[branch][state.stage - 2];
  }

  function drawDinoAt(x, floorY, flip = false, forcedFrame = null) {
    const frames = getDinoFrames();
    const sprite = frames[forcedFrame === null ? frame % 2 : forcedFrame % frames.length];
    const size = matrixSize(sprite);
    drawMatrix(sprite, x, floorY - size.height, flip);
  }

  function drawClock(setting = false) {
    const now = setting ? null : gameDate();
    const hour = setting ? clockHour : now.getHours();
    const minute = setting ? clockMinute : now.getMinutes();
    let display = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (setting && uiMode === 'clock_set' && frame % 2 === 0) {
      display = clockField === 'hour' ? `  :${String(minute).padStart(2, '0')}` : `${String(hour).padStart(2, '0')}:  `;
    }
    drawText(display, GRID_W / 2, 9, 2, true);
  }

  function drawMoodFace(level) {
    const eyeY = level <= 1 ? 7 : 6;
    pixel(10, 4, 18, 1); pixel(8, 5, 2, 2); pixel(28, 5, 2, 2);
    pixel(7, 7, 1, 10); pixel(30, 7, 1, 10); pixel(9, 17, 2, 2); pixel(27, 17, 2, 2); pixel(11, 19, 16, 1);
    if (level === 0) {
      pixel(12, eyeY, 1, 1); pixel(14, eyeY + 1, 1, 1); pixel(23, eyeY + 1, 1, 1); pixel(25, eyeY, 1, 1);
      pixel(14, 15, 1, 1); pixel(15, 14, 8, 1); pixel(23, 15, 1, 1);
    } else if (level === 1) {
      pixel(12, eyeY, 2, 1); pixel(24, eyeY, 2, 1); pixel(14, 14, 10, 1); pixel(13, 15, 1, 1); pixel(24, 15, 1, 1);
    } else if (level === 2) {
      pixel(12, eyeY, 2, 1); pixel(24, eyeY, 2, 1); pixel(14, 15, 10, 1);
    } else {
      pixel(12, eyeY, 2, 2); pixel(24, eyeY, 2, 2);
      const lift = level - 3;
      pixel(14 - lift, 13, 1, 1); pixel(15 - lift, 14, 8 + lift * 2, 1); pixel(23 + lift, 13, 1, 1);
    }
  }

  function drawPlates() {
    for (let index = 0; index < 4; index += 1) {
      const x = 8 + (index % 2) * 14;
      const y = 5 + Math.floor(index / 2) * 10;
      pixel(x, y + 5, 10, 1); pixel(x + 1, y + 6, 8, 1); pixel(x + 2, y + 7, 6, 1);
      const plateFill = clamp(state.food - index * 2, 0, 2);
      if (plateFill > 0) pixel(x + 3, y + 3, 4, 2);
      if (plateFill > 1) pixel(x + 2, y + 2, 6, 1);
    }
  }

  function drawGlasses() {
    for (let index = 0; index < 4; index += 1) {
      const x = 9 + (index % 2) * 13;
      const y = 4 + Math.floor(index / 2) * 10;
      pixel(x, y, 8, 1); pixel(x, y + 1, 1, 7); pixel(x + 7, y + 1, 1, 7); pixel(x + 1, y + 8, 6, 1);
      if (index < state.drink) pixel(x + 1, y + 3, 6, 5);
    }
  }

  function drawStats() {
    if (statsPage === 0) drawMoodFace(state.mood);
    if (statsPage === 1) {
      drawMoodFace(Math.max(2, state.mood));
      drawText(GRADES[state.education], 29, 9, 1, true);
    }
    if (statsPage === 2) {
      drawText(`${state.weight}KG`, 25, 4, 1, true);
      drawText(String(displayDay()), 25, 14, 2, true);
      drawDinoAt(4, 22, false, 0);
    }
    if (statsPage === 3) drawPlates();
    if (statsPage === 4) drawGlasses();
    if (statsPage === 5) {
      drawText(`${Math.round(state.temperature)}C`, 23, 8, 2, true);
      pixel(3, 5, 1, 14); pixel(2, 18, 3, 3); pixel(4, 6, 2, 1);
      pixel(31, 4, 1, 15); pixel(26, 9, 11, 1); pixel(28, 6, 7, 7);
    }
  }

  function drawFoodPicker() {
    const sprite = FOOD_SPRITES[FOODS[foodChoice].id];
    drawCentered(sprite, GRID_W / 2, GRID_H / 2);
    pixel(2, 11, 3, 1); pixel(2, 10, 1, 3);
    pixel(33, 11, 3, 1); pixel(35, 10, 1, 3);
    for (let index = 0; index < FOODS.length; index += 1) pixel(13 + index * 2, 22, index === foodChoice ? 2 : 1, 1);
  }

  function drawRps() {
    if (!rps) return;
    for (let index = 0; index < 5; index += 1) {
      pixel(4 + index * 6, 2, 4, 1);
      if (index < rps.dinoWins) pixel(5 + index * 6, 3, 2, 2);
    }
    if (rps.reveal) {
      drawMatrix(HANDS[rps.reveal.player], 3, 9);
      drawMatrix(HANDS[rps.reveal.dino], 25, 9, true);
      pixel(18, 11, 2, 7); pixel(15, 14, 8, 1);
    } else {
      drawMatrix(HANDS[RPS[rps.choice]], 3, 9);
      drawDinoAt(24, 22, true);
    }
  }

  function drawAnimation(progress) {
    const type = animation.type;
    const phase = Math.floor(progress * 8);
    const bob = phase % 2;
    const dinoX = type === 'eat' || type === 'drink' ? 9 + Math.min(5, phase) : 10;
    drawDinoAt(dinoX, 22 - bob, false);

    if (type === 'eat') {
      const foodSprite = FOOD_SPRITES[animation.data.food.id];
      if (progress < 0.72) drawMatrix(foodSprite, 23, Math.max(5, 20 - foodSprite.length));
    }
    if (type === 'drink') {
      pixel(29, 9, 6, 1); pixel(29, 10, 1, 10); pixel(34, 10, 1, 10); pixel(30, 18, 4, 2);
      if (phase % 2 === 0) { pixel(25, 12, 1, 1); pixel(27, 14, 1, 1); }
    }
    if (type === 'pet') {
      pixel(27, 4, 2, 2); pixel(25, 6, 2, 2); pixel(29, 6, 2, 2); pixel(24, 8, 8, 3); pixel(26, 11, 4, 2);
    }
    if (type === 'study') {
      pixel(23, 12, 13, 1); pixel(23, 13, 1, 8); pixel(35, 13, 1, 8); pixel(24, 20, 11, 1); pixel(29, 13, 1, 8);
      if (phase % 2) pixel(30, 10, 4, 2);
    }
    if (type === 'bath') {
      pixel(2, 3, 34, 2);
      for (let index = 0; index < 8; index += 1) pixel(4 + index * 4, 6 + ((phase + index) % 4) * 3, 1, 2);
    }
    if (type === 'ac') {
      for (let index = 0; index < 4; index += 1) {
        const x = 4 + ((phase * 3 + index * 9) % 30);
        pixel(x, 5 + index * 3, 5, 1); pixel(x + 2, 3 + index * 3, 1, 5);
      }
    }
    if (type === 'medicine') {
      pixel(29, 9, 6, 11); pixel(31, 6, 2, 3); pixel(31, 11, 2, 7); pixel(28, 14, 8, 2);
    }
    if (type === 'refuse') {
      pixel(27, 7, 2, 2); pixel(33, 7, 2, 2); pixel(29, 9, 4, 2); pixel(27, 13, 2, 2); pixel(33, 13, 2, 2); pixel(29, 11, 4, 2);
    }
  }

  function render(timestamp) {
    requestAnimationFrame(render);
    if (timestamp - lastFrameAt < 430) return;
    lastFrameAt = timestamp;
    frame += 1;
    finishRpsReveal();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#17231b';

    const screenOff = state.initialized && !state.lightsOn;
    lcd.classList.toggle('screen-off', screenOff);

    if (uiMode === 'clock_wait' || uiMode === 'clock_set') {
      lcd.classList.remove('screen-off');
      drawClock(true);
      return;
    }
    if (uiMode === 'clock') { drawClock(false); return; }
    if (uiMode === 'stats') { drawStats(); return; }
    if (uiMode === 'food') { drawFoodPicker(); return; }
    if (uiMode === 'rps') { drawRps(); return; }

    if (animation) {
      const progress = clamp((timestamp - animation.startedAt) / animation.duration, 0, 1);
      drawAnimation(progress);
      if (progress >= 1) finishAnimation();
      return;
    }

    if (!state.initialized) return;
    if (!state.alive || state.ending === 'grave') {
      drawCentered(SPRITES.grave[frame % 2], GRID_W / 2, 13);
      return;
    }
    if (state.ending === 'angel' || state.ending === 'devil') {
      drawCentered(SPRITES[state.ending][frame % 2], GRID_W / 2, 13);
      return;
    }
    if (screenOff) return;

    if (state.dirty && frame % 2 === 1) {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (isSleeping()) {
      drawDinoAt(11, 22, false, 1);
      drawText('Z', 28, 5, 1);
      drawText('Z', 31, 2, 1);
      return;
    }

    if (state.sick) {
      drawDinoAt(11, 22, false, frame % 2);
      pixel(31, 4, 1, 7); pixel(28, 7, 7, 1);
      return;
    }

    if (state.temperature > 30) {
      drawDinoAt(11, 22, false, 0);
      pixel(28, 5, 1, 5); pixel(26, 8, 5, 1); pixel(32, 5, 1, 5); pixel(30, 8, 5, 1);
      return;
    }

    if (state.temperature < 20) {
      drawDinoAt(10 + (frame % 2), 22, false);
      pixel(30, 4, 1, 7); pixel(27, 7, 7, 1); pixel(28, 5, 5, 5);
      return;
    }

    if (frame % 3 === 0) {
      walkX += walkDirection;
      const spriteWidth = matrixSize(getDinoFrames()[frame % 2]).width;
      if (walkX + spriteWidth >= 34) walkDirection = -1;
      if (walkX <= 4) walkDirection = 1;
    }
    drawDinoAt(walkX, 22, walkDirection < 0);
  }

  updateSoundLabel();
  updateIconSelection();
  catchUp();
  maybeAlert();
  requestAnimationFrame(render);
  setInterval(() => { catchUp(); maybeAlert(); }, 30 * 1000);
})();
