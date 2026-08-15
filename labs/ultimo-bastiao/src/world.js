const B = window.BABYLON;

const color = hex => B.Color3.FromHexString(hex);
const rand = (min, max) => min + Math.random() * (max - min);
const POLY_TEXTURES = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k';
const POLY_MODELS = 'https://dl.polyhaven.org/file/ph-assets/Models';
const CASTLE_HDR = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/monkstown_castle_1k.hdr';
const POLY_MODEL_BIN_RESOLUTION = { CheeseBox_01: '4k', Lantern_01: '4k' };

const surfaceUrl = (asset, map) => `${POLY_TEXTURES}/${asset}/${asset}_${map}_1k.jpg`;

function pbr(scene, name, hex, metallic = 0, roughness = .8) {
  const material = new B.PBRMaterial(name, scene);
  material.albedoColor = color(hex);
  material.metallic = metallic;
  material.roughness = roughness;
  return material;
}

function texture(scene, name, size, painter) {
  const dynamic = new B.DynamicTexture(name, { width: size, height: size }, scene, false);
  const context = dynamic.getContext();
  painter(context, size);
  dynamic.update(false);
  dynamic.wrapU = B.Texture.WRAP_ADDRESSMODE;
  dynamic.wrapV = B.Texture.WRAP_ADDRESSMODE;
  return dynamic;
}

function photoTexture(scene, path, scale, gammaSpace = true) {
  const image = new B.Texture(path, scene, false, false, B.Texture.TRILINEAR_SAMPLINGMODE);
  image.wrapU = B.Texture.WRAP_ADDRESSMODE;
  image.wrapV = B.Texture.WRAP_ADDRESSMODE;
  image.uScale = scale;
  image.vScale = scale;
  image.gammaSpace = gammaSpace;
  return image;
}

function clothTexture(scene) {
  return texture(scene, 'woven wool fibers', 512, (ctx, size) => {
    ctx.fillStyle = '#b7afa2'; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 4) {
      ctx.strokeStyle = x % 8 ? 'rgba(45,38,32,.2)' : 'rgba(255,250,236,.18)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 7, size); ctx.stroke();
    }
    for (let y = 0; y < size; y += 4) {
      ctx.strokeStyle = y % 8 ? 'rgba(42,34,28,.18)' : 'rgba(255,250,236,.13)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + 5); ctx.stroke();
    }
  });
}

function setRoughnessMap(material, image) {
  material.metallicTexture = image;
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
}

function particleTexture(scene, name, inner, outer) {
  return texture(scene, name, 64, (ctx, size) => {
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    gradient.addColorStop(0, inner); gradient.addColorStop(.35, outer); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  });
}

export function createWorld(scene, quality) {
  scene.clearColor = new B.Color4(.045, .055, .065, 1);
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogDensity = .0082;
  scene.fogColor = new B.Color3(.26, .29, .30);
  scene.imageProcessingConfiguration.contrast = 1.24;
  scene.imageProcessingConfiguration.exposure = 1.02;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;

  const environment = new B.HDRCubeTexture(CASTLE_HDR, scene, 128, false, true, false, true);
  environment.rotationY = 2.18;
  scene.environmentTexture = environment;
  scene.environmentIntensity = .82;

  const materials = {
    stone: pbr(scene, 'castle stone', '#8a867c', 0, .94),
    stoneDark: pbr(scene, 'wet stone', '#53534f', 0, .98),
    earth: pbr(scene, 'courtyard mud', '#4c493e', 0, .96),
    wood: pbr(scene, 'aged oak material', '#745034', .02, .86),
    iron: pbr(scene, 'forged iron', '#4e5152', .88, .28),
    clothRed: pbr(scene, 'Vardheim red', '#6f1f1d', .02, .88),
    clothBlack: pbr(scene, 'invader black', '#272729', .04, .9),
    grass: pbr(scene, 'winter grass', '#344334', 0, 1),
    skin: pbr(scene, 'skin', '#9d7156', 0, .72),
    leather: pbr(scene, 'leather', '#493124', .01, .87),
    gold: pbr(scene, 'old gold', '#a88446', .78, .38)
  };
  materials.stone.albedoTexture = photoTexture(scene, surfaceUrl('castle_brick_01', 'diff'), 3.8);
  materials.stone.bumpTexture = photoTexture(scene, surfaceUrl('castle_brick_01', 'nor_gl'), 3.8, false);
  materials.stone.bumpTexture.level = .58;
  setRoughnessMap(materials.stone, photoTexture(scene, surfaceUrl('castle_brick_01', 'rough'), 3.8, false));
  materials.stoneDark.albedoTexture = materials.stone.albedoTexture;
  materials.stoneDark.bumpTexture = materials.stone.bumpTexture;
  materials.stoneDark.metallicTexture = materials.stone.metallicTexture;
  materials.stoneDark.useRoughnessFromMetallicTextureAlpha = false;
  materials.stoneDark.useRoughnessFromMetallicTextureGreen = true;
  materials.stoneDark.useMetallnessFromMetallicTextureBlue = false;
  materials.earth.albedoTexture = photoTexture(scene, surfaceUrl('brown_mud_03', 'diff'), 8);
  materials.earth.bumpTexture = photoTexture(scene, surfaceUrl('brown_mud_03', 'nor_gl'), 8, false);
  materials.earth.bumpTexture.level = .72;
  setRoughnessMap(materials.earth, photoTexture(scene, surfaceUrl('brown_mud_03', 'rough'), 8, false));
  materials.wood.albedoTexture = photoTexture(scene, surfaceUrl('rough_wood', 'diff'), 2.4);
  materials.wood.bumpTexture = photoTexture(scene, surfaceUrl('rough_wood', 'nor_gl'), 2.4, false);
  materials.wood.bumpTexture.level = .5;
  setRoughnessMap(materials.wood, photoTexture(scene, surfaceUrl('rough_wood', 'rough'), 2.4, false));
  materials.iron.albedoTexture = photoTexture(scene, surfaceUrl('metal_plate', 'diff'), 3.2);
  materials.iron.bumpTexture = photoTexture(scene, surfaceUrl('metal_plate', 'nor_gl'), 3.2, false);
  materials.iron.bumpTexture.level = .24;
  setRoughnessMap(materials.iron, photoTexture(scene, surfaceUrl('metal_plate', 'rough'), 3.2, false));
  materials.gold.albedoTexture = materials.iron.albedoTexture;
  materials.gold.bumpTexture = materials.iron.bumpTexture;
  materials.gold.metallicTexture = materials.iron.metallicTexture;
  materials.gold.useRoughnessFromMetallicTextureAlpha = false;
  materials.gold.useRoughnessFromMetallicTextureGreen = true;
  materials.gold.useMetallnessFromMetallicTextureBlue = false;
  materials.leather.albedoTexture = photoTexture(scene, surfaceUrl('brown_leather', 'albedo'), 2.8);
  materials.leather.bumpTexture = photoTexture(scene, surfaceUrl('brown_leather', 'nor_gl'), 2.8, false);
  materials.leather.bumpTexture.level = .34;
  setRoughnessMap(materials.leather, photoTexture(scene, surfaceUrl('brown_leather', 'rough'), 2.8, false));
  materials.grass.albedoTexture = materials.earth.albedoTexture;
  materials.grass.bumpTexture = materials.earth.bumpTexture;
  const weave = clothTexture(scene);
  weave.uScale = 5; weave.vScale = 8;
  materials.clothRed.albedoTexture = weave;
  materials.clothBlack.albedoTexture = weave;

  const hemi = new B.HemisphericLight('overcast sky', new B.Vector3(.15, 1, -.2), scene);
  hemi.intensity = .56;
  hemi.diffuse = new B.Color3(.58, .65, .72);
  hemi.groundColor = new B.Color3(.19, .16, .12);
  const sun = new B.DirectionalLight('cold sun', new B.Vector3(-.48, -.78, .34), scene);
  sun.position = new B.Vector3(34, 58, -35);
  sun.intensity = 2.75;
  sun.diffuse = new B.Color3(1, .81, .58);

  const shadow = new B.ShadowGenerator(quality.shadows, sun, true);
  shadow.useBlurExponentialShadowMap = true;
  shadow.blurKernel = quality.shadows >= 2048 ? 28 : 18;
  shadow.bias = .0004;
  shadow.normalBias = .035;
  shadow.darkness = .34;

  const addShadow = (mesh, receive = true) => {
    if (!mesh) return mesh;
    shadow.addShadowCaster(mesh);
    mesh.receiveShadows = receive;
    return mesh;
  };

  const ground = B.MeshBuilder.CreateGround('battle courtyard', { width: 160, height: 160, subdivisions: 4 }, scene);
  ground.material = materials.earth;
  ground.receiveShadows = true;
  ground.isPickable = false;

  const makeBox = (name, size, position, material = materials.stone, rotationY = 0) => {
    const mesh = B.MeshBuilder.CreateBox(name, size, scene);
    mesh.position.copyFromFloats(position[0], position[1], position[2]);
    mesh.rotation.y = rotationY;
    mesh.material = material;
    mesh.metadata = { cameraCollider: material === materials.stone || material === materials.stoneDark || material === materials.wood };
    mesh.receiveShadows = true;
    addShadow(mesh);
    return mesh;
  };

  const makeBattlement = (name, x, z, length, axis = 'x') => {
    const wallSize = axis === 'x' ? { width: length, height: 8.5, depth: 3.4 } : { width: 3.4, height: 8.5, depth: length };
    makeBox(name, wallSize, [x, 4.25, z]);
    const count = Math.floor(length / 4.2);
    for (let i = 0; i <= count; i += 1) {
      const offset = -length / 2 + i * (length / count);
      const px = axis === 'x' ? x + offset : x;
      const pz = axis === 'x' ? z : z + offset;
      makeBox(`${name} merlon ${i}`, { width: axis === 'x' ? 2.2 : 3.7, height: 2.2, depth: axis === 'x' ? 3.7 : 2.2 }, [px, 9.3, pz]);
    }
  };

  makeBattlement('north wall left', -25, -42, 30, 'x');
  makeBattlement('north wall right', 25, -42, 30, 'x');
  makeBattlement('west wall', -42, 0, 84, 'z');
  makeBattlement('east wall', 42, 0, 84, 'z');
  makeBattlement('south wall', 0, 42, 84, 'x');

  const gateLeft = makeBox('gatehouse left', { width: 9, height: 14, depth: 8 }, [-9, 7, -42]);
  const gateRight = makeBox('gatehouse right', { width: 9, height: 14, depth: 8 }, [9, 7, -42]);
  makeBox('gatehouse crown', { width: 10.5, height: 4.2, depth: 8 }, [0, 12, -42]);
  const gate = makeBox('scarred inner gate', { width: 8.8, height: 10.2, depth: .8 }, [0, 5.1, -38.35], materials.wood);
  for (let i = -3; i <= 3; i += 1) makeBox(`gate iron ${i}`, { width: .17, height: 10.3, depth: .13 }, [i * 1.25, 5.1, -37.85], materials.iron);
  makeBox('gate crossbar', { width: 9.4, height: .55, depth: .55 }, [0, 5.1, -37.65], materials.iron);
  gateLeft.receiveShadows = gateRight.receiveShadows = gate.receiveShadows = true;

  const towerPositions = [[-42, -42], [42, -42], [-42, 42], [42, 42]];
  towerPositions.forEach(([x, z], towerIndex) => {
    const tower = B.MeshBuilder.CreateCylinder(`round tower ${towerIndex}`, { height: 15, diameter: 12, tessellation: 18 }, scene);
    tower.position.copyFromFloats(x, 7.5, z); tower.material = materials.stone; tower.metadata = { cameraCollider: true }; addShadow(tower);
    for (let i = 0; i < 10; i += 1) {
      const angle = i / 10 * Math.PI * 2;
      makeBox(`tower merlon ${towerIndex}-${i}`, { width: 2, height: 2.5, depth: 2.3 }, [x + Math.cos(angle) * 5, 16.1, z + Math.sin(angle) * 5], materials.stone, -angle);
    }
  });

  // Mundo distante: relevo baixo e irregular, barato o suficiente para celular.
  for (let i = 0; i < 24; i += 1) {
    const angle = i / 24 * Math.PI * 2 + rand(-.08, .08);
    const radius = rand(92, 132);
    const mountain = B.MeshBuilder.CreatePolyhedron(`distant crag ${i}`, { type: 2, size: 1 }, scene);
    mountain.scaling.copyFromFloats(rand(18, 34), rand(22, 55), rand(17, 31));
    mountain.position.copyFromFloats(Math.cos(angle) * radius, rand(-10, -2), Math.sin(angle) * radius);
    mountain.rotation.y = rand(0, Math.PI);
    mountain.material = i % 3 === 0 ? materials.stoneDark : materials.grass;
    mountain.receiveShadows = true;
  }

  // O céu e os reflexos vêm de uma captura HDR real de ruínas de castelo.
  const sky = scene.createDefaultSkybox(environment, true, 430, .24);
  if (sky) { sky.name = 'Monkstown castle HDR sky'; sky.isPickable = false; }

  for (let i = 0; i < 22; i += 1) {
    const angle = rand(0, Math.PI * 2); const radius = rand(14, 36);
    const rock = B.MeshBuilder.CreatePolyhedron(`courtyard stone ${i}`, { type: 2, size: rand(.25, .8) }, scene);
    rock.position.copyFromFloats(Math.cos(angle) * radius, rand(.08, .35), Math.sin(angle) * radius);
    rock.scaling.y = rand(.4, .8); rock.rotation.y = rand(0, Math.PI); rock.material = materials.stoneDark; addShadow(rock);
  }

  // Estandartes no portão.
  const banners = [];
  [-12.4, 12.4].forEach((x, index) => {
    const pole = B.MeshBuilder.CreateCylinder(`banner pole ${index}`, { height: 9, diameter: .16, tessellation: 8 }, scene);
    pole.position.copyFromFloats(x, 11.3, -37.5); pole.material = materials.iron; addShadow(pole);
    const banner = B.MeshBuilder.CreatePlane(`torn Vardheim banner ${index}`, { width: 3, height: 5, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
    banner.position.copyFromFloats(x + (index ? -.1 : .1), 11.1, -37.1); banner.material = materials.clothRed;
    banner.rotation.y = Math.PI;
    banners.push(banner);
  });

  const fires = [];
  const fireTexture = particleTexture(scene, 'fire particle', 'rgba(255,244,180,1)', 'rgba(255,80,10,.7)');
  const smokeTexture = particleTexture(scene, 'smoke particle', 'rgba(110,105,96,.7)', 'rgba(30,30,30,.45)');
  function createFire(position, scale = 1) {
    const light = new B.PointLight('battle fire light', new B.Vector3(position[0], .8, position[2]), scene);
    light.diffuse = new B.Color3(1, .35, .09); light.intensity = 2.4 * scale; light.range = 14 * scale;
    const fire = new B.ParticleSystem('fire and embers', Math.floor(180 * quality.particles), scene);
    fire.particleTexture = fireTexture; fire.emitter = new B.Vector3(position[0], position[1], position[2]);
    fire.minEmitBox = new B.Vector3(-.3 * scale, 0, -.3 * scale); fire.maxEmitBox = new B.Vector3(.3 * scale, .15, .3 * scale);
    fire.color1 = new B.Color4(1, .58, .12, 1); fire.color2 = new B.Color4(1, .16, .02, .8); fire.colorDead = new B.Color4(.18, .05, .01, 0);
    fire.minSize = .18 * scale; fire.maxSize = .65 * scale; fire.minLifeTime = .25; fire.maxLifeTime = .72;
    fire.emitRate = 70 * quality.particles; fire.blendMode = B.ParticleSystem.BLENDMODE_ADD;
    fire.direction1 = new B.Vector3(-.25, 1.1, -.25); fire.direction2 = new B.Vector3(.25, 2.4, .25); fire.gravity = new B.Vector3(0, .8, 0);
    fire.start();
    const smoke = new B.ParticleSystem('rising smoke', Math.floor(130 * quality.particles), scene);
    smoke.particleTexture = smokeTexture; smoke.emitter = new B.Vector3(position[0], position[1] + .35, position[2]);
    smoke.minEmitBox = new B.Vector3(-.25, 0, -.25); smoke.maxEmitBox = new B.Vector3(.25, .2, .25);
    smoke.color1 = new B.Color4(.22, .21, .19, .28); smoke.color2 = new B.Color4(.08, .08, .08, .18); smoke.colorDead = new B.Color4(.03, .03, .03, 0);
    smoke.minSize = .45 * scale; smoke.maxSize = 1.8 * scale; smoke.minLifeTime = 1.5; smoke.maxLifeTime = 3.8;
    smoke.emitRate = 14 * quality.particles; smoke.direction1 = new B.Vector3(-.15, .9, -.15); smoke.direction2 = new B.Vector3(.15, 1.7, .15); smoke.gravity = new B.Vector3(.05, .18, 0);
    smoke.start();
    fires.push({ light, fire, smoke, fireRate: 70, smokeRate: 14, seed: Math.random() * 10 });
  }
  createFire([-27, .25, -22], 1.1); createFire([31, .25, 10], .85); createFire([-34, .25, 24], .7);
  [-16, 16].forEach(x => createFire([x, 8.8, -38.1], .35));

  // Pós-processamento cinematográfico e FXAA.
  const pipeline = new B.DefaultRenderingPipeline('cinematic pipeline', true, scene, [scene.activeCamera]);
  pipeline.samples = quality.hardwareScale < 1 ? 2 : 1;
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = .84;
  pipeline.bloomWeight = quality.bloom;
  pipeline.bloomKernel = 48;
  pipeline.chromaticAberrationEnabled = quality.aberration;
  pipeline.chromaticAberration.aberrationAmount = 4;
  pipeline.grainEnabled = quality.grain;
  pipeline.grain.intensity = 5;
  pipeline.grain.animated = true;
  if ('ssaoEnabled' in pipeline) pipeline.ssaoEnabled = quality.ssao;

  const bursts = [];
  function burst(position, type = 'spark', count = 7) {
    const material = type === 'blood' ? materials.clothRed : (type === 'dust' ? materials.stoneDark : materials.gold);
    for (let i = 0; i < count * quality.particles; i += 1) {
      const piece = type === 'spark'
        ? B.MeshBuilder.CreateBox('flying spark', { width: .035, height: rand(.12,.3), depth: .035 }, scene)
        : B.MeshBuilder.CreateSphere('impact debris', { diameter: rand(.035,.11), segments: 3 }, scene);
      piece.position.copyFrom(position);
      piece.material = material;
      piece.isPickable = false;
      bursts.push({ mesh: piece, velocity: new B.Vector3(rand(-2.8,2.8), rand(.9,4.2), rand(-2.8,2.8)), life: rand(.28,.7), max: .7, gravity: type === 'spark' ? -3 : -8 });
    }
  }

  function update(dt, time) {
    fires.forEach(fire => { fire.light.intensity = (2.15 + Math.sin(time * 14 + fire.seed) * .35 + Math.random() * .22) * (fire.light.range / 14); });
    banners.forEach((banner, index) => {
      banner.rotation.z = Math.sin(time * 2.1 + index) * .015;
      banner.scaling.x = 1 + Math.sin(time * 3.7 + index * 2) * .025;
    });
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const item = bursts[i];
      item.life -= dt;
      item.velocity.y += item.gravity * dt;
      item.mesh.position.addInPlace(item.velocity.scale(dt));
      item.mesh.rotation.x += dt * 9; item.mesh.rotation.z += dt * 7;
      item.mesh.scaling.scaleInPlace(Math.max(.93, 1 - dt * 2.2));
      if (item.life <= 0 || item.mesh.position.y < .03) { item.mesh.dispose(); bursts.splice(i, 1); }
    }
  }

  function applyQuality(nextQuality) {
    pipeline.samples = nextQuality.hardwareScale < 1 ? 2 : 1;
    pipeline.bloomWeight = nextQuality.bloom;
    pipeline.chromaticAberrationEnabled = nextQuality.aberration;
    pipeline.grainEnabled = nextQuality.grain;
    if ('ssaoEnabled' in pipeline) pipeline.ssaoEnabled = nextQuality.ssao;
    fires.forEach(fire => {
      fire.fire.emitRate = fire.fireRate * nextQuality.particles;
      fire.smoke.emitRate = fire.smokeRate * nextQuality.particles;
    });
  }

  return { materials, shadow, addShadow, update, burst, applyQuality, gate, pipeline, environment, propRoots: [], propContainers: [] };
}

async function loadPolyHavenModel(scene, asset) {
  const gltfUrl = `${POLY_MODELS}/gltf/1k/${asset}/${asset}_1k.gltf`;
  const response = await fetch(gltfUrl);
  if (!response.ok) throw new Error(`Falha ao carregar ${asset}: HTTP ${response.status}`);
  const document = await response.json();
  document.buffers?.forEach(buffer => {
    if (buffer.uri && !buffer.uri.startsWith('data:')) {
      const filename = buffer.uri.split('/').pop();
      const resolution = POLY_MODEL_BIN_RESOLUTION[asset] || '8k';
      buffer.uri = `${POLY_MODELS}/gltf/${resolution}/${asset}/${filename}`;
    }
  });
  document.images?.forEach(image => {
    if (image.uri && !image.uri.startsWith('data:')) {
      const filename = image.uri.split('/').pop();
      image.uri = `${POLY_MODELS}/jpg/1k/${asset}/${filename}`;
    }
  });
  const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(document)], { type: 'model/gltf+json' }));
  try {
    return await B.SceneLoader.LoadAssetContainerAsync('', objectUrl, scene, undefined, '.gltf');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function instantiateProp(scene, world, asset, placements) {
  const container = await loadPolyHavenModel(scene, asset);
  placements.forEach((placement, index) => {
    const name = `${asset}-${index}`;
    const root = new B.TransformNode(name, scene);
    root.position.copyFromFloats(...placement.position);
    root.rotation.copyFromFloats(...(placement.rotation || [0, 0, 0]));
    const scale = placement.scale || 1;
    root.scaling.copyFromFloats(scale, scale, scale);
    const entries = container.instantiateModelsToScene(nodeName => `${name}-${nodeName}`, true, { doNotInstantiate: true });
    entries.rootNodes.forEach(node => { node.parent = root; });
    root.getChildMeshes(false).forEach(mesh => {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      world.addShadow(mesh);
    });
    world.propRoots.push(root);
  });
  world.propContainers.push(container);
}

/** Acrescenta objetos fotogramétricos sem bloquear o início da cena base. */
export async function loadWorldAssets(scene, world) {
  const assets = [
    instantiateProp(scene, world, 'wine_barrel_01', [
      { position: [-21, 0, -17], rotation: [0, .32, 0], scale: 1.18 },
      { position: [-20, .62, -15.5], rotation: [0, -.7, Math.PI / 2], scale: 1.18 },
      { position: [25, .62, 19], rotation: [Math.PI / 2, .2, 0], scale: 1.12 }
    ]),
    instantiateProp(scene, world, 'wooden_bucket_01', [
      { position: [-18.6, 0, -17.5], rotation: [0, 1.1, 0], scale: 1.25 },
      { position: [27.2, 0, 18.3], rotation: [0, -1.3, 0], scale: 1.18 },
      { position: [-31.2, 0, 23], rotation: [.12, .4, -.18], scale: 1.12 }
    ]),
    instantiateProp(scene, world, 'cannon_01', [
      { position: [29, 0, -19], rotation: [0, -2.22, 0], scale: 1.08 }
    ]),
    instantiateProp(scene, world, 'CheeseBox_01', [
      { position: [24.2, 0, 20.2], rotation: [0, -.3, 0], scale: 1.15 },
      { position: [23.8, .64, 20], rotation: [.04, .52, -.03], scale: 1.05 },
      { position: [-22.5, 0, -16.2], rotation: [0, 1.2, 0], scale: 1.08 }
    ]),
    instantiateProp(scene, world, 'Lantern_01', [
      { position: [-18.8, 0, -15.8], rotation: [0, -.8, 0], scale: 1.15 },
      { position: [27.4, 0, 17.1], rotation: [0, .35, 0], scale: 1.08 }
    ])
  ];
  const results = await Promise.allSettled(assets);
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) console.warn('Alguns objetos realistas não puderam ser carregados.', failures);
}
