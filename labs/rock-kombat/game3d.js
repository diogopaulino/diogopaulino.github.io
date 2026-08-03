import * as THREE from './vendor/three.module.min.js';

(() => {
  'use strict';

  const audio = window.RockKombatAudio;
  const ROUND_TIME = 75;
  const FIXED_STEP = 1 / 60;
  const ARENA_LIMIT = 4.2;
  const MOBILE = matchMedia('(pointer: coarse)').matches;
  const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FIGHTERS = [
    {
      id: 'kurt', name: 'Kurt Cobain', short: 'KURT', era: 'Grunge Rebel',
      special: 'Guitarrada Grunge', super: 'Feedback de Seattle',
      quote: 'Afinar é opcional. Acertar não.',
      color: '#f3d56b', accent: '#6e925f', portrait: 'portrait-kurt.webp',
      power: 5, speed: 4, defense: 3, skin: 0xd8aa86, hair: 0xc9a75d,
      clothes: 0x53684c, pants: 0x26303b, FX: ['GUITARRADA!', 'FEEDBACK!', 'GRUNGE!']
    },
    {
      id: 'axl', name: 'Axl Rose', short: 'AXL', era: 'Sunset Wildcard',
      special: 'Mic Snake Whip', super: 'Pyro Jungle Encore',
      quote: 'O show começou. No horário... quase.',
      color: '#ff4368', accent: '#ff9b32', portrait: 'portrait-axl.webp',
      power: 4, speed: 5, defense: 3, skin: 0xdfa579, hair: 0xa72820,
      clothes: 0x16131b, pants: 0x20242c, FX: ['SNAKE DANCE!', 'PYRO!', 'ENCORE!']
    },
    {
      id: 'lennon', name: 'John Lennon', short: 'LENNON', era: 'The Dreamer',
      special: 'Peace & Love Pulse', super: 'Imagine Karma Blast',
      quote: 'Imagine não tomar esse contra-ataque.',
      color: '#67d3a2', accent: '#96e8ff', portrait: 'portrait-lennon.webp',
      power: 4, speed: 3, defense: 5, skin: 0xd7a57e, hair: 0x30231e,
      clothes: 0x354e3f, pants: 0x252a2b, FX: ['PEACE!', 'IMAGINE!', 'KARMA!']
    }
  ];

  const STAGES = {
    woodstock: { name: "WOODSTOCK '69", photo: 'stage-woodstock.webp', fog: 0x261626, floor: 0x291d18, key: 0xffc36a, fill: 0x9f58ff },
    stadium: { name: 'STADIUM ARENA', photo: 'stage-stadium.webp', fog: 0x071425, floor: 0x141c29, key: 0x63d8ff, fill: 0xff3d84 },
    club: { name: 'UNDERGROUND CLUB', photo: 'stage-club.webp', fog: 0x17080d, floor: 0x211317, key: 0xff365e, fill: 0x9d5cff }
  };

  const DIFFICULTY = {
    easy: { think: .34, aggression: .42, block: .20, damage: .72, reaction: .30 },
    normal: { think: .22, aggression: .62, block: .40, damage: .88, reaction: .20 },
    hard: { think: .12, aggression: .82, block: .64, damage: 1, reaction: .11 }
  };

  const ATTACKS = {
    punch: { duration: .34, active: [.12, .21], damage: 7, reach: 1.35, hitstun: .28, knock: .18, meter: 9, sound: 'hit_punch' },
    kick: { duration: .48, active: [.20, .33], damage: 10, reach: 1.68, hitstun: .36, knock: .30, meter: 12, sound: 'hit_kick' },
    sweep: { duration: .58, active: [.25, .38], damage: 9, reach: 1.82, hitstun: .56, knock: .55, meter: 13, sound: 'hit_sweep', low: true, knockdown: true },
    uppercut: { duration: .62, active: [.16, .30], damage: 13, reach: 1.38, hitstun: .52, knock: .42, meter: 15, sound: 'hit_uppercut', launcher: true },
    airkick: { duration: .50, active: [.13, .34], damage: 11, reach: 1.56, hitstun: .40, knock: .40, meter: 14, sound: 'hit_kick' }
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const dom = {
    canvas: $('#game'), wrap: $('#canvas-wrap'), roster: $('#roster'), announcer: $('#announcer'),
    renderStatus: $('#render-status'), quality: $('#quality-badge'), coach: $('#coach-text'),
    p1Name: $('#p1-name'), p2Name: $('#p2-name'), timer: $('#timer'), round: $('#round-label'),
    p1Health: $('#p1-health'), p2Health: $('#p2-health'), p1Meter: $('#p1-meter'), p2Meter: $('#p2-meter'),
    p1Ready: $('#p1-ready'), p2Ready: $('#p2-ready'), p1Pips: $('#p1-pips'), p2Pips: $('#p2-pips'),
    p1Pick: $('#p1-pick'), p2Pick: $('#p2-pick'), start: $('#start-fight'),
    pauseModal: $('#pause-modal'), howModal: $('#how-modal')
  };

  let scene;
  let camera;
  let renderer;
  let stageRoot;
  let actorRoot;
  let backdrop;
  let floor;
  let spotLights = [];
  let particles;
  let particleData = [];
  let particlePositions;
  let particleColors;
  let rings = [];
  let currentStage = 'woodstock';
  let difficulty = localStorage.getItem('rk-difficulty') || 'normal';
  let pick1 = null;
  let pick2 = null;
  let match = null;
  let running = false;
  let paused = false;
  let muted = false;
  let lastTime = performance.now();
  let accumulator = 0;
  let elapsed = 0;
  let shake = 0;
  let dramaticZoom = 0;

  const input = {
    held: Object.create(null), pressed: Object.create(null),
    cpuHeld: Object.create(null), cpuPressed: Object.create(null)
  };
  const gamepadHeld = Object.create(null);

  function material(color, roughness = .58, metalness = .08, extras = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extras });
  }

  function mesh(geometry, mat, shadows = true) {
    const item = new THREE.Mesh(geometry, mat);
    item.castShadow = shadows;
    item.receiveShadow = shadows;
    return item;
  }

  function segment(radius, length, mat) {
    const item = mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 5, 10), mat);
    item.position.y = -length / 2;
    return item;
  }

  function jointedLimb(parent, name, position, upperLength, lowerLength, radius, mat, shoeMat, isLeg = false) {
    const upper = new THREE.Group();
    upper.name = name;
    upper.position.set(...position);
    upper.add(segment(radius, upperLength, mat));
    parent.add(upper);

    const lower = new THREE.Group();
    lower.position.y = -upperLength;
    lower.add(segment(radius * .88, lowerLength, mat));
    upper.add(lower);

    const end = new THREE.Group();
    end.position.y = -lowerLength;
    const endMesh = isLeg
      ? mesh(new THREE.CapsuleGeometry(radius * .92, radius * 1.7, 4, 8), shoeMat)
      : mesh(new THREE.SphereGeometry(radius * 1.16, 12, 8), shoeMat);
    if (isLeg) {
      endMesh.rotation.x = Math.PI / 2;
      endMesh.position.z = radius * 1.25;
    }
    end.add(endMesh);
    lower.add(end);
    return { upper, lower, end };
  }

  function createGuitar(color) {
    const root = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(.24, 12, 8), material(color, .34, .18));
    body.scale.set(.78, 1.12, .26);
    root.add(body);
    const cut = mesh(new THREE.SphereGeometry(.15, 10, 7), material(0x111015, .4, .2));
    cut.position.set(.14, .08, .08);
    cut.scale.set(.65, .8, .3);
    root.add(cut);
    const neck = mesh(new THREE.BoxGeometry(.08, .78, .055), material(0x6a3d20, .7));
    neck.position.y = .48;
    root.add(neck);
    const head = mesh(new THREE.BoxGeometry(.13, .18, .065), material(0x9b6a33, .65));
    head.position.y = .93;
    root.add(head);
    root.rotation.z = -.35;
    return root;
  }

  function createMicStand() {
    const root = new THREE.Group();
    const pole = mesh(new THREE.CylinderGeometry(.018, .018, 1.15, 8), material(0x7e7e88, .2, .9));
    pole.position.y = .43;
    root.add(pole);
    const mic = mesh(new THREE.CapsuleGeometry(.04, .12, 4, 8), material(0x26242d, .25, .75));
    mic.position.set(0, 1.06, .03);
    mic.rotation.z = -.2;
    root.add(mic);
    return root;
  }

  function createPeaceCharm() {
    const root = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(.18, .025, 7, 18), material(0xd8eef0, .25, .75, { emissive: 0x183b36, emissiveIntensity: 1.2 }));
    root.add(ring);
    const line = mesh(new THREE.BoxGeometry(.025, .32, .025), ring.material);
    root.add(line);
    const left = mesh(new THREE.BoxGeometry(.025, .20, .025), ring.material);
    left.rotation.z = -.72; left.position.set(-.055, -.08, 0); root.add(left);
    const right = left.clone(); right.rotation.z = .72; right.position.x = .055; root.add(right);
    return root;
  }

  function createFighterModel(def) {
    const root = new THREE.Group();
    root.userData.baseScale = 1;
    const joints = {};
    const skinMat = material(def.skin, .72, 0);
    const hairMat = material(def.hair, .9, 0);
    const topMat = material(def.clothes, .78, .02);
    const pantsMat = material(def.pants, .82, .03);
    const shoeMat = material(0x141318, .48, .18);

    joints.body = new THREE.Group();
    root.add(joints.body);

    const torso = mesh(new THREE.CapsuleGeometry(.40, .78, 7, 12), topMat);
    torso.position.y = 2.05;
    torso.scale.z = .68;
    joints.body.add(torso);

    const belt = mesh(new THREE.CylinderGeometry(.38, .35, .13, 14), material(0x1a171b, .5, .35));
    belt.position.y = 1.52;
    joints.body.add(belt);

    joints.head = new THREE.Group();
    joints.head.position.y = 3.0;
    joints.body.add(joints.head);
    const head = mesh(new THREE.SphereGeometry(.34, 18, 14), skinMat);
    head.scale.set(.88, 1.06, .86);
    joints.head.add(head);

    const nose = mesh(new THREE.ConeGeometry(.055, .14, 8), skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -.01, .31);
    joints.head.add(nose);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x14101a });
    [-.12, .12].forEach(x => {
      const eye = mesh(new THREE.SphereGeometry(.025, 8, 6), eyeMat, false);
      eye.position.set(x, .08, .305);
      joints.head.add(eye);
    });
    const mouth = mesh(new THREE.BoxGeometry(.15, .018, .018), material(0x55262a, .8), false);
    mouth.position.set(0, -.14, .31);
    joints.head.add(mouth);

    if (def.id === 'kurt') {
      for (let i = -2; i <= 2; i++) {
        const lock = mesh(new THREE.CapsuleGeometry(.09, .36 + Math.abs(i) * .035, 4, 7), hairMat);
        lock.position.set(i * .11, .08 - Math.abs(i) * .03, -.02);
        lock.rotation.z = i * .10;
        joints.head.add(lock);
      }
    } else if (def.id === 'axl') {
      const bandana = mesh(new THREE.TorusGeometry(.30, .055, 7, 22), material(0xb92533, .85));
      bandana.rotation.x = Math.PI / 2;
      bandana.position.y = .17;
      joints.head.add(bandana);
      for (let i = 0; i < 8; i++) {
        const lock = mesh(new THREE.CapsuleGeometry(.065, .42 + (i % 2) * .16, 4, 7), hairMat);
        const angle = (i / 8) * Math.PI * 2;
        lock.position.set(Math.sin(angle) * .24, -.10, Math.cos(angle) * .22 - .05);
        lock.rotation.z = Math.sin(angle) * .35;
        joints.head.add(lock);
      }
    } else {
      const hair = mesh(new THREE.SphereGeometry(.35, 16, 10), hairMat);
      hair.scale.set(1.03, .58, 1.02);
      hair.position.y = .24;
      joints.head.add(hair);
      [-.13, .13].forEach(x => {
        const glasses = mesh(new THREE.TorusGeometry(.105, .018, 7, 18), material(0xc5e8ef, .12, .75, { emissive: 0x1f4b52, emissiveIntensity: .8 }));
        glasses.position.set(x, .07, .337);
        joints.head.add(glasses);
      });
      const bridge = mesh(new THREE.BoxGeometry(.06, .014, .014), material(0xa9cfd4, .2, .8));
      bridge.position.set(0, .07, .34);
      joints.head.add(bridge);
    }

    const leftArm = jointedLimb(joints.body, 'leftArm', [-.49, 2.55, 0], .62, .57, .13, topMat, skinMat);
    const rightArm = jointedLimb(joints.body, 'rightArm', [.49, 2.55, 0], .62, .57, .13, topMat, skinMat);
    const leftLeg = jointedLimb(joints.body, 'leftLeg', [-.24, 1.48, 0], .78, .72, .16, pantsMat, shoeMat, true);
    const rightLeg = jointedLimb(joints.body, 'rightLeg', [.24, 1.48, 0], .78, .72, .16, pantsMat, shoeMat, true);
    Object.assign(joints, { leftArm, rightArm, leftLeg, rightLeg });

    const weapon = def.id === 'kurt' ? createGuitar(0xe7c85c) : def.id === 'axl' ? createMicStand() : createPeaceCharm();
    weapon.position.set(0, -.02, .08);
    weapon.scale.setScalar(def.id === 'lennon' ? .72 : .68);
    rightArm.end.add(weapon);
    joints.weapon = weapon;

    const shadow = mesh(new THREE.CircleGeometry(.62, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .42, depthWrite: false }), false);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .012;
    root.add(shadow);
    joints.shadow = shadow;

    const aura = mesh(new THREE.TorusGeometry(.58, .018, 7, 40), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), false);
    aura.rotation.x = Math.PI / 2;
    aura.position.y = .15;
    root.add(aura);
    joints.aura = aura;

    root.traverse(node => {
      if (node.isMesh && node.material && node !== shadow && node !== aura) {
        node.material = node.material.clone();
      }
    });

    return { root, joints, def };
  }

  function createParticleSystem() {
    const max = MOBILE ? 80 : 140;
    particlePositions = new Float32Array(max * 3);
    particleColors = new Float32Array(max * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    const mat = new THREE.PointsMaterial({ size: MOBILE ? .10 : .13, vertexColors: true, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    particles = new THREE.Points(geometry, mat);
    particles.frustumCulled = false;
    scene.add(particles);
    for (let i = 0; i < max; i++) particleData.push({ life: 0, vx: 0, vy: 0, vz: 0 });
  }

  function burst(x, y, color, amount = 18, force = 1) {
    const c = new THREE.Color(color);
    let emitted = 0;
    for (let i = 0; i < particleData.length && emitted < amount; i++) {
      const p = particleData[i];
      if (p.life > 0) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = (.8 + Math.random() * 2.5) * force;
      p.life = .35 + Math.random() * .5;
      p.vx = Math.cos(angle) * speed;
      p.vy = (.2 + Math.random() * 2.7) * force;
      p.vz = (Math.random() - .5) * 1.8 * force;
      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = .2;
      particleColors[i * 3] = c.r;
      particleColors[i * 3 + 1] = c.g;
      particleColors[i * 3 + 2] = c.b;
      emitted++;
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;
  }

  function energyRing(x, y, color, size = .35) {
    const ring = mesh(new THREE.TorusGeometry(size, .028, 6, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }), false);
    ring.position.set(x, y, .38);
    ring.userData.life = .46;
    ring.userData.max = .46;
    ring.userData.spin = (Math.random() - .5) * 3;
    scene.add(ring);
    rings.push(ring);
  }

  function updateEffects(dt) {
    for (let i = 0; i < particleData.length; i++) {
      const p = particleData[i];
      if (p.life <= 0) {
        particlePositions[i * 3 + 1] = -20;
        continue;
      }
      p.life -= dt;
      particlePositions[i * 3] += p.vx * dt;
      particlePositions[i * 3 + 1] += p.vy * dt;
      particlePositions[i * 3 + 2] += p.vz * dt;
      p.vy -= 4.8 * dt;
    }
    particles.geometry.attributes.position.needsUpdate = true;

    rings = rings.filter(ring => {
      ring.userData.life -= dt;
      const progress = 1 - ring.userData.life / ring.userData.max;
      ring.scale.setScalar(1 + progress * 3.8);
      ring.material.opacity = Math.max(0, 1 - progress);
      ring.rotation.z += ring.userData.spin * dt;
      if (ring.userData.life <= 0) {
        scene.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
        return false;
      }
      return true;
    });
  }

  function buildStage() {
    stageRoot = new THREE.Group();
    actorRoot = new THREE.Group();
    scene.add(stageRoot, actorRoot);

    floor = mesh(new THREE.PlaneGeometry(18, 10), material(STAGES[currentStage].floor, .38, .32));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, .3);
    stageRoot.add(floor);

    const edge = mesh(new THREE.BoxGeometry(12, .32, 4.6), material(0x171119, .52, .45));
    edge.position.set(0, -.18, 0);
    stageRoot.add(edge);

    backdrop = mesh(new THREE.PlaneGeometry(15, 8.45), material(0x0a0610, 1, 0, { emissive: STAGES[currentStage].fog, emissiveIntensity: .52 }));
    backdrop.position.set(0, 3.55, -4.15);
    stageRoot.add(backdrop);

    const trussMat = material(0x383441, .28, .84);
    [-5.3, 5.3].forEach(x => {
      const column = mesh(new THREE.CylinderGeometry(.065, .065, 7.2, 8), trussMat);
      column.position.set(x, 3.4, -2.6);
      stageRoot.add(column);
    });
    const truss = mesh(new THREE.CylinderGeometry(.075, .075, 10.7, 8), trussMat);
    truss.rotation.z = Math.PI / 2;
    truss.position.set(0, 6.75, -2.6);
    stageRoot.add(truss);

    const ampMat = material(0x141117, .9, .05);
    [-4.5, 4.5].forEach((x, index) => {
      for (let y = 0; y < 2; y++) {
        const amp = mesh(new THREE.BoxGeometry(1.05, .82, .48), ampMat);
        amp.position.set(x, .45 + y * .84, -1.55);
        stageRoot.add(amp);
        const grille = mesh(new THREE.PlaneGeometry(.88, .60), material(index ? 0x27212a : 0x312a20, .95));
        grille.position.set(x, .45 + y * .84, -1.30);
        stageRoot.add(grille);
      }
    });

    const drum = mesh(new THREE.CylinderGeometry(.45, .45, .42, 24), material(0x751634, .3, .46));
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, .48, -2.1);
    stageRoot.add(drum);

    const ambient = new THREE.HemisphereLight(0xa8cfff, 0x190a12, 1.7);
    stageRoot.add(ambient);
    const key = new THREE.DirectionalLight(STAGES[currentStage].key, MOBILE ? 2.3 : 3.6);
    key.position.set(-3, 7, 5);
    key.castShadow = !MOBILE;
    if (!MOBILE) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -6; key.shadow.camera.right = 6;
      key.shadow.camera.top = 7; key.shadow.camera.bottom = -1;
    }
    stageRoot.add(key);

    spotLights = [];
    [-3.6, 0, 3.6].forEach((x, i) => {
      const spot = new THREE.SpotLight(i === 1 ? STAGES[currentStage].key : STAGES[currentStage].fill, MOBILE ? 34 : 55, 16, .30, .62, 1.2);
      spot.position.set(x, 6.4, 2.5);
      spot.target.position.set(x * .22, 0, 0);
      stageRoot.add(spot, spot.target);
      spotLights.push(spot);
    });

    const crowdGeometry = new THREE.BufferGeometry();
    const crowdCount = MOBILE ? 90 : 180;
    const crowdPos = new Float32Array(crowdCount * 3);
    const crowdColors = new Float32Array(crowdCount * 3);
    const crowdPalette = [new THREE.Color(0xff4368), new THREE.Color(0x4de8ff), new THREE.Color(0xffcf62)];
    for (let i = 0; i < crowdCount; i++) {
      crowdPos[i * 3] = (Math.random() - .5) * 12;
      crowdPos[i * 3 + 1] = .35 + Math.random() * 1.2;
      crowdPos[i * 3 + 2] = -2.8 - Math.random() * .7;
      const c = crowdPalette[i % crowdPalette.length];
      crowdColors[i * 3] = c.r; crowdColors[i * 3 + 1] = c.g; crowdColors[i * 3 + 2] = c.b;
    }
    crowdGeometry.setAttribute('position', new THREE.BufferAttribute(crowdPos, 3));
    crowdGeometry.setAttribute('color', new THREE.BufferAttribute(crowdColors, 3));
    const crowd = new THREE.Points(crowdGeometry, new THREE.PointsMaterial({ size: .08, vertexColors: true, transparent: true, opacity: .72, blending: THREE.AdditiveBlending }));
    crowd.name = 'crowd';
    stageRoot.add(crowd);
    applyStage(currentStage);
  }

  function applyStage(name) {
    currentStage = name;
    const data = STAGES[name];
    if (!backdrop) return;
    scene.fog.color.set(data.fog);
    floor.material.color.set(data.floor);
    backdrop.material.emissive.set(data.fog);
    new THREE.TextureLoader().load(`assets/${data.photo}`, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      if (backdrop.material.map) backdrop.material.map.dispose();
      backdrop.material.map = texture;
      backdrop.material.color.set(0x6e6573);
      backdrop.material.needsUpdate = true;
    });
    spotLights.forEach((light, i) => light.color.set(i === 1 ? data.key : data.fill));
  }

  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: !MOBILE, alpha: false, powerPreference: 'high-performance' });
    const dpr = Math.min(devicePixelRatio || 1, MOBILE ? 1.35 : 1.8);
    renderer.setPixelRatio(dpr);
    renderer.setSize(dom.canvas.clientWidth || 960, dom.canvas.clientHeight || 540, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !MOBILE;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07040a);
    scene.fog = new THREE.FogExp2(STAGES[currentStage].fog, .035);
    camera = new THREE.PerspectiveCamera(38, 16 / 9, .1, 50);
    camera.position.set(0, 3.2, 10.7);
    camera.lookAt(0, 1.8, 0);

    buildStage();
    createParticleSystem();
    dom.quality.textContent = `3D · ${MOBILE ? 'MOBILE' : 'HIGH'}`;
    dom.renderStatus.classList.add('is-ready');
    window.addEventListener('resize', resizeRenderer, { passive: true });
    renderer.setAnimationLoop(frame);
  }

  function resizeRenderer() {
    const rect = dom.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  function createState(def, side) {
    const model = createFighterModel(def);
    actorRoot.add(model.root);
    return {
      def, model, side, x: side === 1 ? -2.25 : 2.25, y: 0, vy: 0, facing: side,
      health: 100, meter: 0, action: 'idle', actionTime: 0, actionHit: false,
      specialPower: 0, specialSpawned: false, hitstun: 0, knockdown: 0,
      blocking: false, blockStarted: 99, combo: 0, comboTimer: 0,
      wins: 0, aiTimer: 0, aiPlan: null, flash: 0
    };
  }

  function resetRound() {
    const { p1, p2 } = match;
    [p1, p2].forEach((fighter, index) => {
      fighter.x = index ? 2.25 : -2.25;
      fighter.y = 0; fighter.vy = 0; fighter.facing = index ? -1 : 1;
      fighter.health = 100; fighter.meter = Math.min(fighter.meter, 30);
      fighter.action = 'idle'; fighter.actionTime = 0; fighter.hitstun = 0;
      fighter.knockdown = 0; fighter.blocking = false; fighter.combo = 0;
      fighter.model.root.visible = true;
    });
    match.time = ROUND_TIME;
    match.phase = 'intro';
    match.phaseTime = 2.2;
    match.projectiles.forEach(projectile => {
      scene.remove(projectile.mesh);
      projectile.mesh.geometry.dispose();
      projectile.mesh.material.dispose();
    });
    match.projectiles.length = 0;
    dom.round.textContent = `ROUND ${match.round}`;
    dom.coach.textContent = match.round === 1 ? 'Aproxime-se, combine golpes e guarde energia para o especial.' : 'O público quer um encore. Varie os golpes!';
    announce(`ROUND ${match.round}`);
    setTimeout(() => announce('ROCK!'), 850);
  }

  function startMatch() {
    if (!pick1) return;
    pick2 ||= FIGHTERS.find(item => item.id !== pick1.id);
    while (actorRoot.children.length) actorRoot.remove(actorRoot.children[0]);
    match = {
      p1: createState(pick1, 1), p2: createState(pick2, -1),
      round: 1, time: ROUND_TIME, phase: 'intro', phaseTime: 2.2,
      projectiles: [], hitStop: 0, slow: 1, slowTime: 0
    };
    dom.p1Name.textContent = pick1.short;
    dom.p2Name.textContent = pick2.short;
    updatePips();
    showScreen('arena-screen');
    resizeRenderer();
    running = true; paused = false;
    audio?.init();
    audio?.music.play(currentStage);
    resetRound();
  }

  function startAttack(fighter, type) {
    if (fighter.hitstun > 0 || fighter.knockdown > 0 || fighter.action !== 'idle') return false;
    if (type === 'special') {
      if (fighter.meter < 50) {
        dom.coach.textContent = 'Carregue ao menos 50% da barra para soltar o especial.';
        audio?.sfx('block');
        return false;
      }
      fighter.specialPower = fighter.meter >= 100 ? 100 : 50;
      fighter.meter -= fighter.specialPower;
      fighter.action = 'special';
      fighter.actionTime = 0;
      fighter.actionHit = false;
      fighter.specialSpawned = false;
      audio?.sfx(`special_${fighter.def.id}`);
      if (fighter.specialPower === 100) beginCinematic(fighter);
      return true;
    }
    fighter.action = type;
    fighter.actionTime = 0;
    fighter.actionHit = false;
    audio?.sfx(type === 'kick' || type === 'airkick' ? 'whiff_kick' : type === 'sweep' ? 'whiff_sweep' : type === 'uppercut' ? 'whiff_kick' : 'whiff_punch');
    return true;
  }

  function beginCinematic(fighter) {
    dramaticZoom = 1;
    match.slow = REDUCED_MOTION ? .85 : .42;
    match.slowTime = .62;
    const line = fighter.def.id === 'kurt' ? 'ALGUÉM PEDIU UMA GUITARRADA?' : fighter.def.id === 'axl' ? 'SEGURA O MICROFONE!' : 'IMAGINE ESTE COMBO!';
    comic(line, fighter.def.color, true);
    burst(fighter.x, 2, fighter.def.color, MOBILE ? 18 : 34, 1.4);
  }

  function spawnProjectile(fighter) {
    const power = fighter.specialPower;
    const colors = { kurt: 0xf5da72, axl: 0xff3c45, lennon: 0x6df4bf };
    const geometry = fighter.def.id === 'lennon'
      ? new THREE.TorusGeometry(power === 100 ? .42 : .30, .07, 8, 28)
      : fighter.def.id === 'kurt'
        ? new THREE.OctahedronGeometry(power === 100 ? .43 : .30, 1)
        : new THREE.IcosahedronGeometry(power === 100 ? .43 : .30, 1);
    const projectileMesh = mesh(geometry, new THREE.MeshBasicMaterial({ color: colors[fighter.def.id], transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false }), false);
    projectileMesh.position.set(fighter.x + fighter.facing * .85, 1.55 + fighter.y, .25);
    scene.add(projectileMesh);
    match.projectiles.push({ owner: fighter, mesh: projectileMesh, x: projectileMesh.position.x, y: projectileMesh.position.y, vx: fighter.facing * (power === 100 ? 7.2 : 5.3), life: 2.2, power });
    audio?.sfx(`projectile_${fighter.def.id}`);
    energyRing(projectileMesh.position.x, projectileMesh.position.y, colors[fighter.def.id], power === 100 ? .4 : .25);
  }

  function hitTarget(attacker, target, attack) {
    const direction = Math.sign(target.x - attacker.x) || attacker.facing;
    const perfectBlock = target.blocking && target.blockStarted < .13 && !attack.low;
    const blocked = target.blocking && !attack.low;
    if (perfectBlock) {
      target.meter = Math.min(100, target.meter + 22);
      attacker.hitstun = .36;
      attacker.action = 'idle';
      audio?.sfx('perfect_parry');
      comic('ROCK BLOCK!', '#4de8ff');
      burst(target.x, 1.65 + target.y, 0x4de8ff, 26, .9);
      energyRing(target.x, 1.65 + target.y, 0x4de8ff, .25);
      shake = Math.max(shake, .12);
      return;
    }

    const cpuMult = attacker.side === -1 ? DIFFICULTY[difficulty].damage : 1;
    const defenseMult = 1 - (target.def.defense - 3) * .045;
    const damage = attack.damage * cpuMult * defenseMult * (blocked ? .16 : 1);
    target.health = Math.max(0, target.health - damage);
    target.flash = .11;
    target.blockStarted = 99;

    if (blocked) {
      target.x += direction * attack.knock * .35;
      target.meter = Math.min(100, target.meter + 3);
      audio?.sfx('block');
      burst(target.x, 1.35 + target.y, 0xffcf62, 8, .55);
    } else {
      target.hitstun = attack.hitstun;
      target.action = 'idle';
      target.x += direction * attack.knock;
      if (attack.launcher) target.vy = 4.8;
      if (attack.knockdown) target.knockdown = .72;
      attacker.meter = Math.min(100, attacker.meter + attack.meter);
      target.meter = Math.min(100, target.meter + attack.meter * .55);
      attacker.combo = attacker.comboTimer > 0 ? attacker.combo + 1 : 1;
      attacker.comboTimer = .92;
      audio?.sfx(attack.sound);
      const hitColor = attacker.def.color;
      burst(target.x, 1.45 + target.y, hitColor, attack.damage > 18 ? 38 : 20, attack.damage > 18 ? 1.6 : .9);
      energyRing(target.x, 1.45 + target.y, hitColor, attack.damage > 18 ? .42 : .20);
      shake = Math.max(shake, attack.damage > 18 ? .36 : .14);
      match.hitStop = REDUCED_MOTION ? .02 : attack.damage > 18 ? .13 : .055;
      if (attacker.combo >= 2) {
        comic(`${attacker.combo} HIT COMBO!`, attacker.def.color);
        audio?.sfx('combo', attacker.combo * .18);
      } else if (Math.random() > .48) {
        comic(attacker.def.FX[Math.floor(Math.random() * attacker.def.FX.length)], attacker.def.color);
      }
    }
    clampFighters();
  }

  function updateProjectiles(dt) {
    match.projectiles = match.projectiles.filter(projectile => {
      projectile.life -= dt;
      projectile.x += projectile.vx * dt;
      projectile.mesh.position.x = projectile.x;
      projectile.mesh.rotation.x += dt * 7;
      projectile.mesh.rotation.z += dt * 10;
      const target = projectile.owner === match.p1 ? match.p2 : match.p1;
      if (Math.abs(projectile.x - target.x) < .55 && Math.abs(projectile.y - (1.5 + target.y)) < 1.25 && target.health > 0) {
        hitTarget(projectile.owner, target, {
          damage: projectile.power === 100 ? 25 : 13,
          hitstun: projectile.power === 100 ? .72 : .42,
          knock: projectile.power === 100 ? .92 : .48,
          meter: projectile.power === 100 ? 15 : 9,
          sound: 'hit_projectile', launcher: projectile.power === 100, low: false
        });
        scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose(); projectile.mesh.material.dispose();
        return false;
      }
      if (projectile.life <= 0 || Math.abs(projectile.x) > 6) {
        scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose(); projectile.mesh.material.dispose();
        return false;
      }
      return true;
    });
  }

  function updateAttack(fighter, opponent, dt) {
    if (fighter.action === 'idle') return;
    fighter.actionTime += dt;
    if (fighter.action === 'special') {
      const duration = fighter.specialPower === 100 ? 1.08 : .82;
      if (!fighter.specialSpawned && fighter.actionTime >= (fighter.specialPower === 100 ? .44 : .34)) {
        fighter.specialSpawned = true;
        spawnProjectile(fighter);
      }
      if (fighter.actionTime >= duration) fighter.action = 'idle';
      return;
    }
    const attack = ATTACKS[fighter.action];
    if (!attack) { fighter.action = 'idle'; return; }
    if (!fighter.actionHit && fighter.actionTime >= attack.active[0] && fighter.actionTime <= attack.active[1]) {
      const horizontal = Math.abs(opponent.x - fighter.x);
      const vertical = Math.abs((opponent.y || 0) - (fighter.y || 0));
      if (horizontal <= attack.reach && vertical < (attack.launcher ? 1.9 : 1.15)) {
        fighter.actionHit = true;
        hitTarget(fighter, opponent, attack);
      }
    }
    if (fighter.actionTime >= attack.duration) fighter.action = 'idle';
  }

  function actionsFrom(source, fighter) {
    if (source.pressed.special) startAttack(fighter, 'special');
    else if (source.pressed.punch) startAttack(fighter, source.held.block ? 'uppercut' : 'punch');
    else if (source.pressed.kick) startAttack(fighter, source.held.block ? 'sweep' : fighter.y > .15 ? 'airkick' : 'kick');
    if (source.pressed.jump && fighter.y <= .01 && fighter.action === 'idle' && fighter.hitstun <= 0) {
      fighter.vy = 5.35;
      audio?.sfx('jump');
    }
  }

  function updateFighter(fighter, opponent, source, dt) {
    fighter.facing = opponent.x >= fighter.x ? 1 : -1;
    fighter.blockStarted += dt;
    fighter.comboTimer -= dt;
    if (fighter.comboTimer <= 0) fighter.combo = 0;
    fighter.flash = Math.max(0, fighter.flash - dt);
    if (fighter.hitstun > 0) {
      fighter.hitstun -= dt;
      fighter.blocking = false;
    } else if (fighter.knockdown > 0) {
      fighter.knockdown -= dt;
      fighter.blocking = false;
    } else {
      const wantsBlock = !!source.held.block && fighter.y <= .02 && fighter.action === 'idle';
      if (wantsBlock && !fighter.blocking) fighter.blockStarted = 0;
      fighter.blocking = wantsBlock;
      actionsFrom(source, fighter);
      if (fighter.action === 'idle' && !fighter.blocking) {
        const move = (source.held.right ? 1 : 0) - (source.held.left ? 1 : 0);
        const speed = 2.45 + (fighter.def.speed - 3) * .18;
        fighter.x += move * speed * dt;
      }
    }

    fighter.vy -= 13.6 * dt;
    fighter.y += fighter.vy * dt;
    if (fighter.y < 0) { fighter.y = 0; fighter.vy = 0; }
    updateAttack(fighter, opponent, dt);
  }

  function updateAI(dt) {
    const ai = match.p2;
    const player = match.p1;
    const profile = DIFFICULTY[difficulty];
    Object.keys(input.cpuPressed).forEach(key => delete input.cpuPressed[key]);
    Object.keys(input.cpuHeld).forEach(key => { input.cpuHeld[key] = false; });
    if (ai.hitstun > 0 || ai.knockdown > 0 || match.phase !== 'fight') return;
    const distance = Math.abs(player.x - ai.x);
    const incoming = match.projectiles.some(p => p.owner === player && Math.abs(p.x - ai.x) < 2.0 && Math.sign(p.vx) === Math.sign(ai.x - p.x));
    ai.aiTimer -= dt;
    if (incoming && Math.random() < profile.block) {
      ai.aiPlan = { type: 'block', time: .45 };
    } else if (ai.aiTimer <= 0) {
      ai.aiTimer = profile.think + Math.random() * profile.reaction;
      const roll = Math.random();
      if (distance > 2.15) {
        ai.aiPlan = roll < .18 && ai.meter >= 50 ? { type: 'special', time: .12 } : { type: 'approach', time: .30 + Math.random() * .35 };
      } else if (roll < profile.block) {
        ai.aiPlan = { type: 'block', time: .18 + Math.random() * .30 };
      } else if (roll < profile.block + profile.aggression) {
        const moves = ai.meter >= 50 ? ['punch', 'kick', 'sweep', 'uppercut', 'special'] : ['punch', 'kick', 'sweep', 'uppercut'];
        ai.aiPlan = { type: moves[Math.floor(Math.random() * moves.length)], time: .14 };
      } else {
        ai.aiPlan = { type: 'retreat', time: .22 + Math.random() * .28 };
      }
    }
    if (!ai.aiPlan) return;
    ai.aiPlan.time -= dt;
    switch (ai.aiPlan.type) {
      case 'block': input.cpuHeld.block = true; break;
      case 'approach': input.cpuHeld[player.x < ai.x ? 'left' : 'right'] = true; break;
      case 'retreat': input.cpuHeld[player.x < ai.x ? 'right' : 'left'] = true; break;
      case 'uppercut': input.cpuHeld.block = true; input.cpuPressed.punch = true; break;
      case 'sweep': input.cpuHeld.block = true; input.cpuPressed.kick = true; break;
      default: input.cpuPressed[ai.aiPlan.type] = true;
    }
    if (ai.aiPlan.time <= 0) ai.aiPlan = null;
  }

  function pollGamepad() {
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return;
    input.held.left = pad.axes[0] < -.35 || pad.buttons[14]?.pressed;
    input.held.right = pad.axes[0] > .35 || pad.buttons[15]?.pressed;
    input.held.block = pad.axes[1] > .45 || pad.buttons[12]?.pressed;
    const map = { 0: 'punch', 1: 'kick', 2: 'special', 3: 'jump' };
    for (const [button, action] of Object.entries(map)) {
      const pressed = pad.buttons[button]?.pressed;
      if (pressed && !gamepadHeld[button]) input.pressed[action] = true;
      gamepadHeld[button] = pressed;
    }
  }

  function clampFighters() {
    if (!match) return;
    const { p1, p2 } = match;
    p1.x = THREE.MathUtils.clamp(p1.x, -ARENA_LIMIT, ARENA_LIMIT);
    p2.x = THREE.MathUtils.clamp(p2.x, -ARENA_LIMIT, ARENA_LIMIT);
    const gap = Math.abs(p1.x - p2.x);
    if (gap < .68 && p1.y < .2 && p2.y < .2) {
      const mid = (p1.x + p2.x) / 2;
      p1.x = mid - .34 * p1.facing;
      p2.x = mid + .34 * p1.facing;
    }
  }

  function endRound(winner) {
    if (match.phase !== 'fight') return;
    match.phase = 'round-over';
    match.phaseTime = 2.8;
    if (winner) winner.wins++;
    announce(winner ? 'K.O.' : 'DRAW');
    if (winner) {
      comic(`${winner.def.short} ROUBOU O SHOW!`, winner.def.color, true);
      audio?.jingle('victory');
    }
    updatePips();
  }

  function finishMatch(winner) {
    running = false;
    audio?.music.stop();
    const resultTitle = $('#result-title');
    const resultQuote = $('#result-quote');
    const portrait = $('#winner-portrait');
    resultTitle.innerHTML = `${winner.def.short} <em>VENCEU!</em>`;
    resultQuote.textContent = `“${winner.def.quote}”`;
    portrait.style.setProperty('--portrait-image', `url("assets/${winner.def.portrait}")`);
    showScreen('result-screen');
  }

  function updateMatch(dt) {
    if (!match || paused) return;
    if (match.hitStop > 0) { match.hitStop -= dt; return; }
    if (match.slowTime > 0) {
      match.slowTime -= dt;
      dt *= match.slow;
    } else match.slow = 1;

    if (match.phase === 'intro') {
      match.phaseTime -= dt;
      if (match.phaseTime <= 0) match.phase = 'fight';
    } else if (match.phase === 'fight') {
      match.time -= dt;
      pollGamepad();
      updateAI(dt);
      updateFighter(match.p1, match.p2, { held: input.held, pressed: input.pressed }, dt);
      updateFighter(match.p2, match.p1, { held: input.cpuHeld, pressed: input.cpuPressed }, dt);
      updateProjectiles(dt);
      clampFighters();
      if (match.p1.health <= 0 || match.p2.health <= 0) endRound(match.p1.health === match.p2.health ? null : match.p1.health > match.p2.health ? match.p1 : match.p2);
      else if (match.time <= 0) endRound(match.p1.health === match.p2.health ? null : match.p1.health > match.p2.health ? match.p1 : match.p2);
    } else if (match.phase === 'round-over') {
      match.phaseTime -= dt;
      if (match.phaseTime <= 0) {
        if (match.p1.wins >= 2 || match.p2.wins >= 2) finishMatch(match.p1.wins >= 2 ? match.p1 : match.p2);
        else { match.round++; resetRound(); }
      }
    }
    for (const key of Object.keys(input.pressed)) delete input.pressed[key];
  }

  function poseFighter(fighter, time) {
    const { joints: j, root } = fighter.model;
    const idle = Math.sin(time * 3.4 + (fighter.side === -1 ? 1.2 : 0));
    const action = fighter.action;
    const attack = ATTACKS[action];
    const duration = attack?.duration || (action === 'special' ? (fighter.specialPower === 100 ? 1.08 : .82) : 1);
    const p = THREE.MathUtils.clamp(fighter.actionTime / duration, 0, 1);
    const snap = Math.sin(Math.PI * THREE.MathUtils.clamp(p, 0, 1));
    const moveLean = 0;

    root.position.set(fighter.x, fighter.y, 0);
    root.rotation.set(0, fighter.facing * (Math.PI / 2 - .34), 0);
    j.body.rotation.set(0, 0, idle * .018 + moveLean);
    j.body.position.y = idle * .025;
    j.head.rotation.set(idle * .025, idle * .04, 0);
    j.leftArm.upper.rotation.set(0, 0, .18 + idle * .045);
    j.rightArm.upper.rotation.set(0, 0, -.18 - idle * .045);
    j.leftArm.lower.rotation.set(0, 0, -.25);
    j.rightArm.lower.rotation.set(0, 0, .25);
    j.leftLeg.upper.rotation.set(0, 0, .04);
    j.rightLeg.upper.rotation.set(0, 0, -.04);
    j.leftLeg.lower.rotation.set(0, 0, 0);
    j.rightLeg.lower.rotation.set(0, 0, 0);
    j.weapon.visible = action === 'special' || fighter.def.id !== 'kurt';
    j.weapon.rotation.set(0, 0, fighter.def.id === 'kurt' ? -.2 : 0);
    j.weapon.scale.setScalar(fighter.def.id === 'lennon' ? .72 : .68);
    j.aura.material.opacity = fighter.meter >= 100 ? .26 + Math.sin(time * 10) * .12 : fighter.meter >= 50 ? .10 : 0;
    j.aura.rotation.z += .025;
    j.aura.scale.setScalar(1 + (fighter.meter / 100) * .35);
    j.shadow.material.opacity = Math.max(.10, .42 - fighter.y * .16);
    j.shadow.scale.setScalar(1 + fighter.y * .08);

    const walking = fighter.action === 'idle' && !fighter.blocking && fighter.hitstun <= 0 && (
      fighter.side === 1 ? (input.held.left || input.held.right) : (input.cpuHeld.left || input.cpuHeld.right)
    );
    if (walking) {
      const stride = Math.sin(time * 10) * .48;
      j.leftLeg.upper.rotation.z = stride;
      j.rightLeg.upper.rotation.z = -stride;
      j.leftArm.upper.rotation.z = .18 - stride * .45;
      j.rightArm.upper.rotation.z = -.18 + stride * .45;
    }
    if (fighter.y > .02) {
      j.leftLeg.upper.rotation.z = -.30;
      j.rightLeg.upper.rotation.z = .42;
      j.leftLeg.lower.rotation.z = .55;
      j.rightLeg.lower.rotation.z = .24;
      j.body.rotation.z = -.08 * fighter.facing;
    }
    if (fighter.blocking) {
      j.body.rotation.x = -.12;
      j.leftArm.upper.rotation.z = -1.45;
      j.rightArm.upper.rotation.z = 1.45;
      j.leftArm.lower.rotation.z = -1.0;
      j.rightArm.lower.rotation.z = 1.0;
    }
    if (action === 'punch') {
      j.rightArm.upper.rotation.x = -1.75 * snap;
      j.rightArm.upper.rotation.z = -.25;
      j.rightArm.lower.rotation.z = .15 * (1 - snap);
      j.body.rotation.z = -.16 * snap;
    } else if (action === 'kick' || action === 'airkick') {
      j.rightLeg.upper.rotation.x = -1.70 * snap;
      j.rightLeg.upper.rotation.z = -.15;
      j.rightLeg.lower.rotation.z = .12;
      j.leftArm.upper.rotation.z = .65;
      j.body.rotation.z = .18 * snap;
    } else if (action === 'sweep') {
      j.body.rotation.z = -1.0 * snap * fighter.facing;
      j.rightLeg.upper.rotation.x = -1.62 * snap;
      j.leftLeg.upper.rotation.z = .55 * snap;
    } else if (action === 'uppercut') {
      j.body.position.y += snap * .45;
      j.rightArm.upper.rotation.z = -2.75 * snap;
      j.rightArm.lower.rotation.z = .12;
      j.leftLeg.upper.rotation.z = .22 * snap;
    } else if (action === 'special') {
      if (fighter.def.id === 'kurt') {
        j.weapon.visible = true;
        j.rightArm.upper.rotation.x = -1.10;
        j.rightArm.upper.rotation.z = -1.15 + snap * 2.15;
        j.rightArm.lower.rotation.z = .3;
        j.weapon.rotation.z = -1.1 + snap * 2.5;
        j.body.rotation.z = -.22 + snap * .44;
      } else if (fighter.def.id === 'axl') {
        j.rightArm.upper.rotation.x = -1.35;
        j.rightArm.upper.rotation.z = -1.1 + Math.sin(p * Math.PI * 4) * .65;
        j.weapon.rotation.z = p * Math.PI * 6;
        j.body.rotation.z = Math.sin(p * Math.PI * 4) * .18;
      } else {
        j.leftArm.upper.rotation.z = -1.55;
        j.rightArm.upper.rotation.z = 1.55;
        j.leftArm.lower.rotation.z = -.15;
        j.rightArm.lower.rotation.z = .15;
        j.weapon.scale.setScalar(.72 + snap * 1.6);
        j.head.rotation.y = Math.sin(p * Math.PI * 4) * .12;
      }
    }
    if (fighter.hitstun > 0 || fighter.flash > 0) {
      j.body.rotation.z = .34 * fighter.facing;
      j.head.rotation.z = -.25 * fighter.facing;
      j.leftArm.upper.rotation.z = .9;
      j.rightArm.upper.rotation.z = -.9;
    }
    if (fighter.knockdown > 0 || fighter.health <= 0) {
      root.rotation.z = -1.35 * fighter.facing;
      root.position.y = Math.max(.34, fighter.y);
    } else root.rotation.z = 0;

    root.traverse(node => {
      if (!node.isMesh || !node.material || node === j.shadow || node === j.aura) return;
      if ('emissiveIntensity' in node.material) node.material.emissiveIntensity = fighter.flash > 0 ? 2.2 : 0;
      if ('emissive' in node.material && fighter.flash > 0) node.material.emissive.set(0xffffff);
      else if ('emissive' in node.material) node.material.emissive.set(0x000000);
    });
  }

  function updateCamera(dt) {
    let targetX = 0;
    let separation = 4.5;
    if (match) {
      targetX = (match.p1.x + match.p2.x) * .38;
      separation = Math.abs(match.p1.x - match.p2.x);
    }
    dramaticZoom = Math.max(0, dramaticZoom - dt * 1.3);
    const desiredZ = 9.8 + Math.max(0, separation - 3.5) * .38 - dramaticZoom * 1.6;
    const jitterX = shake > 0 && !REDUCED_MOTION ? (Math.random() - .5) * shake : 0;
    const jitterY = shake > 0 && !REDUCED_MOTION ? (Math.random() - .5) * shake : 0;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX + jitterX, .10);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 3.15 + jitterY, .10);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredZ, .08);
    camera.lookAt(targetX, 1.72, 0);
    shake = Math.max(0, shake - dt * 1.6);
    spotLights.forEach((light, i) => {
      light.position.x += Math.sin(elapsed * (.35 + i * .08) + i) * .006;
      light.target.position.x = Math.sin(elapsed * (.5 + i * .11) + i) * 2.4;
    });
  }

  function updateHud() {
    if (!match) return;
    const { p1, p2 } = match;
    dom.timer.textContent = Math.max(0, Math.ceil(match.time));
    dom.p1Health.style.transform = `scaleX(${p1.health / 100})`;
    dom.p2Health.style.transform = `scaleX(${p2.health / 100})`;
    dom.p1Meter.style.width = `${p1.meter}%`;
    dom.p2Meter.style.width = `${p2.meter}%`;
    meterLabel(dom.p1Ready, p1);
    meterLabel(dom.p2Ready, p2);
  }

  function meterLabel(element, fighter) {
    element.classList.toggle('is-ready', fighter.meter >= 50);
    element.textContent = fighter.meter >= 100 ? 'SUPER!' : fighter.meter >= 50 ? 'MINI!' : 'CARREGANDO';
  }

  function updatePips() {
    if (!match) return;
    [...dom.p1Pips.children].forEach((pip, index) => pip.classList.toggle('won', index < match.p1.wins));
    [...dom.p2Pips.children].forEach((pip, index) => pip.classList.toggle('won', index < match.p2.wins));
  }

  function frame(now) {
    const rawDt = Math.min(.05, (now - lastTime) / 1000 || FIXED_STEP);
    lastTime = now;
    elapsed += rawDt;
    accumulator += rawDt;
    while (accumulator >= FIXED_STEP) {
      if (running) updateMatch(FIXED_STEP);
      updateEffects(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
    if (match) {
      poseFighter(match.p1, elapsed);
      poseFighter(match.p2, elapsed);
      updateHud();
    }
    updateCamera(rawDt);
    renderer.render(scene, camera);
  }

  function announce(text) {
    dom.announcer.textContent = text;
    dom.announcer.classList.remove('show');
    void dom.announcer.offsetWidth;
    dom.announcer.classList.add('show');
  }

  function comic(text, color = '#ffc44d', big = false) {
    const item = document.createElement('div');
    item.className = `comic-pop${big ? ' is-big' : ''}`;
    item.textContent = text;
    item.style.setProperty('--comic-color', color);
    item.style.left = `${35 + Math.random() * 30}%`;
    item.style.top = `${25 + Math.random() * 24}%`;
    dom.wrap.appendChild(item);
    item.addEventListener('animationend', () => item.remove(), { once: true });
  }

  function showScreen(id) {
    $$('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === id));
    if (id !== 'arena-screen') resizeRenderer();
  }

  function renderRoster() {
    dom.roster.innerHTML = FIGHTERS.map(fighter => `
      <button class="fighter-card" style="--fighter:${fighter.color}" data-fighter="${fighter.id}" type="button" role="listitem">
        <div class="portrait" style="--portrait-image:url('assets/${fighter.portrait}')"></div>
        <div class="fighter-info">
          <h3>${fighter.name}</h3><p>${fighter.era} · ${fighter.special}</p>
          ${['power', 'speed', 'defense'].map(stat => `<div class="stats"><b>${stat === 'power' ? 'FORÇA' : stat === 'speed' ? 'VEL.' : 'DEF.'}</b><span class="stat-dots">${[1, 2, 3, 4, 5].map(value => `<i class="${value <= fighter[stat] ? 'on' : ''}"></i>`).join('')}</span></div>`).join('')}
        </div>
      </button>`).join('');
    $$('.fighter-card').forEach(card => card.addEventListener('click', () => selectFighter(card.dataset.fighter)));
  }

  function selectFighter(id) {
    pick1 = FIGHTERS.find(fighter => fighter.id === id);
    const rivals = FIGHTERS.filter(fighter => fighter.id !== id);
    pick2 = rivals[Math.floor(Math.random() * rivals.length)];
    $$('.fighter-card').forEach(card => {
      card.classList.toggle('is-p1', card.dataset.fighter === pick1.id);
      card.classList.toggle('is-p2', card.dataset.fighter === pick2.id);
    });
    dom.p1Pick.querySelector('strong').textContent = pick1.short;
    dom.p2Pick.querySelector('strong').textContent = pick2.short;
    dom.start.disabled = false;
    audio?.sfx('select');
  }

  function setPaused(value) {
    if (!match || !running) return;
    paused = value;
    dom.pauseModal.hidden = !value;
    if (value) audio?.music.stop();
    else audio?.music.play(currentStage);
  }

  function bindControls() {
    const keyMap = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', ArrowDown: 'block', KeyS: 'block',
      KeyQ: 'punch', KeyF: 'punch', KeyJ: 'punch', KeyE: 'kick', KeyG: 'kick', KeyK: 'kick',
      KeyR: 'special', KeyH: 'special', KeyL: 'special', Space: 'special'
    };
    addEventListener('keydown', event => {
      if (event.code === 'Escape' && running) { setPaused(!paused); return; }
      const action = keyMap[event.code];
      if (!action) return;
      if (running) event.preventDefault();
      if (!input.held[action]) input.pressed[action] = true;
      input.held[action] = true;
    });
    addEventListener('keyup', event => {
      const action = keyMap[event.code];
      if (action) input.held[action] = false;
    });

    $$('[data-touch]').forEach(button => {
      const action = button.dataset.touch;
      const down = event => {
        event.preventDefault();
        if (!input.held[action]) input.pressed[action] = true;
        input.held[action] = true;
        button.classList.add('is-down');
        button.setPointerCapture?.(event.pointerId);
      };
      const up = event => {
        event.preventDefault();
        input.held[action] = false;
        button.classList.remove('is-down');
      };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('contextmenu', event => event.preventDefault());
    });
  }

  function bindUI() {
    $('#enter-game').addEventListener('click', () => { audio?.init(); showScreen('select-screen'); });
    $('#back-to-hero').addEventListener('click', () => showScreen('hero-screen'));
    $('#start-fight').addEventListener('click', startMatch);
    $('#pause-btn').addEventListener('click', () => setPaused(true));
    $('#resume').addEventListener('click', () => setPaused(false));
    $('#quit-fight').addEventListener('click', () => { setPaused(false); running = false; audio?.music.stop(); showScreen('select-screen'); });
    $('#rematch').addEventListener('click', startMatch);
    $('#change-fighter').addEventListener('click', () => showScreen('select-screen'));
    $('#back-to-hero').addEventListener('click', () => audio?.music.stop());
    const openGuide = () => { dom.howModal.hidden = false; if (running) setPaused(true); };
    $('#how-to-play').addEventListener('click', openGuide);
    $('#open-guide-arena').addEventListener('click', openGuide);
    $('#close-how').addEventListener('click', () => { dom.howModal.hidden = true; if (running) setPaused(false); });
    dom.howModal.addEventListener('click', event => { if (event.target === dom.howModal) $('#close-how').click(); });
    $('#sound-toggle').addEventListener('click', event => {
      muted = !muted; audio?.setMuted(muted);
      event.currentTarget.textContent = `SOM: ${muted ? 'OFF' : 'ON'}`;
    });
    $$('[data-stage]').forEach(button => button.addEventListener('click', () => {
      $$('[data-stage]').forEach(item => item.classList.remove('is-active'));
      button.classList.add('is-active');
      applyStage(button.dataset.stage);
    }));
    $$('[data-difficulty]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.difficulty === difficulty);
      button.addEventListener('click', () => {
        difficulty = button.dataset.difficulty;
        localStorage.setItem('rk-difficulty', difficulty);
        $$('[data-difficulty]').forEach(item => item.classList.toggle('is-active', item === button));
      });
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) setPaused(true); });
  }

  function init() {
    renderRoster();
    bindControls();
    bindUI();
    try {
      initRenderer();
    } catch (error) {
      console.error('[Rock Kombat 3D] renderer failed', error);
      dom.renderStatus.querySelector('span').textContent = 'SEU NAVEGADOR NÃO SUPORTA A ARENA 3D';
      dom.quality.textContent = '3D INDISPONÍVEL';
    }
  }

  init();
})();
