const B = window.BABYLON;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (current, target, smoothing, dt) => B.Scalar.Lerp(current, target, 1 - Math.exp(-smoothing * dt));

let knightContainer = null;
let instanceId = 0;

const CHARACTER_ROOT = 'https://models.babylonjs.com/';

/** Carrega uma única malha humana esquelética; cada combatente recebe sua própria instância e animações. */
export async function loadCharacterAssets(scene, onProgress) {
  knightContainer = await B.SceneLoader.LoadAssetContainerAsync(
    CHARACTER_ROOT,
    'HVGirl.glb',
    scene,
    event => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(clamp(event.loaded / event.total, 0, 1));
    }
  );
  knightContainer.animationGroups.forEach(group => group.stop());
}

function tuneMaterial(material, enemy, boss, kind) {
  if (!material) return;
  if (material.subMaterials) {
    material.subMaterials.forEach(subMaterial => tuneMaterial(subMaterial, enemy, boss, kind));
    return;
  }
  
  // Apenas ajustamos cores simples para otimização extrema e identificação
  if (material.albedoColor) {
    if (boss) {
      material.albedoColor = new B.Color3(0.8, 0.1, 0.1);
      material.emissiveColor = new B.Color3(0.2, 0.0, 0.0);
    } else if (enemy) {
      material.albedoColor = new B.Color3(0.2, 0.2, 0.25);
    } else {
      material.albedoColor = new B.Color3(0.1, 0.3, 0.8);
    }
  }
  
  // Simplificação do PBR
  material.metallic = 0.1;
  material.roughness = 0.8;
  material.environmentIntensity = 0.5;
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
    idle: findAnimation(groups, ['Idle']),
    run: findAnimation(groups, ['Walking']),
    attack: findAnimation(groups, ['Samba']),
    block: findAnimation(groups, ['Idle']),
    dodge: findAnimation(groups, ['WalkingBack'])
  };
}

function startAction(rig, action) {
  if (rig.activeAction === action) return;
  rig.activeAction = action;
  rig.animationGroups.forEach(group => group.stop());
  const group = rig.animations[action];
  if (!group) return;
  const loop = action === 'idle' || action === 'run' || action === 'block';
  // Acelera a animação de Samba para parecer um golpe rápido e fluído
  const speed = action === 'run' ? 1.5 : action === 'attack' ? 3.0 : action === 'dodge' ? 2.5 : 1.0;
  group.start(loop, speed, group.from, group.to, false);
}

/** Cria um lutador esquelético completo. */
export function createKnight(scene, world, options = {}) {
  if (!knightContainer) throw new Error('O modelo realista não foi carregado.');

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
  materials.forEach(material => tuneMaterial(material, enemy, boss, kind));

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
