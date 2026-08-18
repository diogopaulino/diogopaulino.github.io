const B = window.BABYLON;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (current, target, smoothing, dt) => B.Scalar.Lerp(current, target, 1 - Math.exp(-smoothing * dt));

let knightContainer = null;
let instanceId = 0;
let textureCache = null;

const CHARACTER_ROOT = 'https://raw.githubusercontent.com/mrdoob/three.js/master/manual/examples/resources/models/knight/';
const CHARACTER_TEXTURES = {
  armor: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/metal_plate/metal_plate_diff_1k.jpg',
  armorNormal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/metal_plate/metal_plate_nor_gl_1k.jpg',
  armorRoughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/metal_plate/metal_plate_rough_1k.jpg',
  leather: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_leather/brown_leather_albedo_1k.jpg',
  leatherNormal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_leather/brown_leather_nor_gl_1k.jpg',
  leatherRoughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_leather/brown_leather_rough_1k.jpg'
};

function characterTextures(scene) {
  if (textureCache) return textureCache;
  const load = (path, gammaSpace = true) => {
    const image = new B.Texture(path, scene, true, false, B.Texture.TRILINEAR_SAMPLINGMODE);
    image.wrapU = B.Texture.WRAP_ADDRESSMODE;
    image.wrapV = B.Texture.WRAP_ADDRESSMODE;
    image.uScale = image.vScale = 3.4;
    image.gammaSpace = gammaSpace;
    return image;
  };
  textureCache = {
    armor: load(CHARACTER_TEXTURES.armor),
    armorNormal: load(CHARACTER_TEXTURES.armorNormal, false),
    armorRoughness: load(CHARACTER_TEXTURES.armorRoughness, false),
    leather: load(CHARACTER_TEXTURES.leather),
    leatherNormal: load(CHARACTER_TEXTURES.leatherNormal, false),
    leatherRoughness: load(CHARACTER_TEXTURES.leatherRoughness, false)
  };
  return textureCache;
}

/** Carrega uma única malha humana esquelética; cada combatente recebe sua própria instância e animações. */
export async function loadCharacterAssets(scene, onProgress) {
  knightContainer = await B.SceneLoader.LoadAssetContainerAsync(
    CHARACTER_ROOT,
    'KnightCharacter.gltf',
    scene,
    event => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(clamp(event.loaded / event.total, 0, 1));
    }
  );
  knightContainer.animationGroups.forEach(group => group.stop());
}

function tuneMaterial(material, enemy, boss, kind, textures) {
  if (!material) return;
  if (material.subMaterials) {
    material.subMaterials.forEach(subMaterial => tuneMaterial(subMaterial, enemy, boss, kind, textures));
    return;
  }

  const name = material.name.toLowerCase();
  if (name.includes('armor')) {
    material.albedoColor = boss
      ? new B.Color3(.23, .13, .065)
      : enemy ? new B.Color3(.055, .06, .065) : new B.Color3(.27, .30, .31);
    material.metallic = boss ? .82 : .94;
    material.roughness = boss ? .31 : enemy ? .42 : .27;
    material.environmentIntensity = 1.05;
    material.albedoTexture = textures.armor;
    material.bumpTexture = textures.armorNormal;
    material.bumpTexture.level = .22;
    material.metallicTexture = textures.armorRoughness;
    material.useRoughnessFromMetallicTextureAlpha = false;
    material.useRoughnessFromMetallicTextureGreen = true;
    material.useMetallnessFromMetallicTextureBlue = false;
    if (material.clearCoat) {
      material.clearCoat.isEnabled = true;
      material.clearCoat.intensity = enemy ? .18 : .34;
      material.clearCoat.roughness = enemy ? .52 : .35;
    }
  } else if (name.includes('skin')) {
    material.albedoColor = enemy ? new B.Color3(.34, .22, .16) : new B.Color3(.55, .34, .23);
    material.metallic = 0;
    material.roughness = .76;
    if (material.subSurface) {
      material.subSurface.isTranslucencyEnabled = true;
      material.subSurface.translucencyIntensity = .12;
    }
  } else if (name.includes('boot')) {
    material.albedoColor = kind === 'player' ? new B.Color3(.095, .047, .025) : new B.Color3(.045, .028, .019);
    material.metallic = .02;
    material.roughness = .9;
    material.albedoTexture = textures.leather;
    material.bumpTexture = textures.leatherNormal;
    material.bumpTexture.level = .32;
    material.metallicTexture = textures.leatherRoughness;
    material.useRoughnessFromMetallicTextureAlpha = false;
    material.useRoughnessFromMetallicTextureGreen = true;
    material.useMetallnessFromMetallicTextureBlue = false;
  }
}

function findAnimation(groups, names) {
  return groups.find(group => names.some(name => group.name.toLowerCase() === name.toLowerCase()))
    || groups.find(group => names.some(name => group.name.toLowerCase().includes(name.toLowerCase())))
    || null;
}

function buildAnimationSet(groups) {
  groups.forEach(group => {
    group.stop();
    group.enableBlending = true;
    group.blendingSpeed = .08;
  });
  return {
    idle: findAnimation(groups, ['Idle_swordLeft', 'Idle']),
    run: findAnimation(groups, ['Run_swordRight', 'Run']),
    attack: findAnimation(groups, ['Run_swordAttack', 'Attack']),
    block: findAnimation(groups, ['Idle_swordLeft', 'Idle']),
    dodge: findAnimation(groups, ['Roll_sword', 'Roll'])
  };
}

function startAction(rig, action) {
  if (rig.activeAction === action) return;
  rig.activeAction = action;
  rig.animationGroups.forEach(group => group.stop());
  const group = rig.animations[action];
  if (!group) return;
  const loop = action === 'idle' || action === 'run' || action === 'block';
  const speed = action === 'run' ? 1.08 : action === 'attack' ? 1.25 : action === 'dodge' ? 1.16 : .88;
  group.start(loop, speed, group.from, group.to, false);
}

/** Cria um cavaleiro esquelético completo, em vez de montar um corpo com formas geométricas. */
export function createKnight(scene, world, options = {}) {
  if (!knightContainer) throw new Error('O modelo realista do cavaleiro não foi carregado.');

  const enemy = Boolean(options.enemy);
  const kind = options.kind || (enemy ? 'raider' : 'player');
  const boss = kind === 'warlord';
  const scale = (options.scale || 1) * (boss ? 1.08 : kind === 'brute' ? 1.04 : 1);
  const prefix = `${kind}-${instanceId += 1}`;
  const root = new B.TransformNode(`${prefix}-root`, scene);
  root.scaling.copyFromFloats(scale, scale, scale);

  const modelRoot = new B.TransformNode(`${prefix}-model`, scene);
  modelRoot.parent = root;
  modelRoot.scaling.copyFromFloats(.67, .67, .67);

  const entries = knightContainer.instantiateModelsToScene(name => `${prefix}-${name}`, true, { doNotInstantiate: true });
  entries.rootNodes.forEach(node => { node.parent = modelRoot; });
  const meshes = modelRoot.getChildMeshes(false);
  const materials = new Set();
  meshes.forEach(mesh => {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.alwaysSelectAsActiveMesh = true;
    world.addShadow(mesh);
    if (mesh.material) materials.add(mesh.material);
  });
  const textures = characterTextures(scene);
  materials.forEach(material => tuneMaterial(material, enemy, boss, kind, textures));

  const rig = {
    root,
    modelRoot,
    meshes,
    enemy,
    kind,
    boss,
    phase: Math.random() * Math.PI * 2,
    time: 0,
    activeAction: '',
    animationGroups: entries.animationGroups,
    animations: buildAnimationSet(entries.animationGroups),
    pose: { moving: 0, attacking: null, attackProgress: 0, blocking: false, dodging: false, hurt: 0, dead: false },
    dispose() {
      entries.animationGroups.forEach(group => group.dispose());
      entries.skeletons.forEach(skeleton => skeleton.dispose());
      root.dispose(false, false);
      materials.forEach(material => material.dispose(false, false));
    }
  };

  startAction(rig, 'idle');
  return rig;
}

/** Seleciona clipes capturados para corrida, golpe e rolamento e aplica reação física ao dano. */
export function animateKnight(rig, dt) {
  rig.time += dt;
  const pose = rig.pose;

  let action = 'idle';
  if (pose.dodging && !pose.dead) action = 'dodge';
  else if (pose.attacking && !pose.dead) action = 'attack';
  else if (pose.blocking && !pose.dead) action = 'block';
  else if ((pose.moving || 0) > .08 && !pose.dead) action = 'run';

  if (pose.dead) {
    if (rig.activeAction !== 'dead') {
      rig.animationGroups.forEach(group => group.stop());
      rig.activeAction = 'dead';
    }
    rig.root.rotation.z = damp(rig.root.rotation.z, rig.enemy ? -1.48 : 1.48, 3.1, dt);
    rig.root.position.y = damp(rig.root.position.y, .1, 3.5, dt);
  } else {
    startAction(rig, action);
    const hurtLean = pose.hurt > 0 ? Math.sin(pose.hurt * 27) * .16 * pose.hurt : 0;
    rig.root.rotation.z = damp(rig.root.rotation.z, hurtLean, 12, dt);
    rig.modelRoot.position.y = damp(rig.modelRoot.position.y, 0, 12, dt);
  }
}
