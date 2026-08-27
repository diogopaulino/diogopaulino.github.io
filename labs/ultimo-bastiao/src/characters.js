const B = window.BABYLON;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (current, target, smoothing, dt) => B.Scalar.Lerp(current, target, 1 - Math.exp(-smoothing * dt));

let knightContainer = null;
let instanceId = 0;

const CHARACTER_ROOT = './assets/characters/';
const CHARACTER_FILE = 'Knight.glb';
const EQUIPMENT = ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'];
const LOADOUTS = {
  player: ['1H_Sword', 'Badge_Shield'],
  raider: ['1H_Sword'],
  guard: ['1H_Sword', 'Rectangle_Shield'],
  brute: ['1H_Sword', 'Spike_Shield'],
  warlord: ['2H_Sword']
};

/** Carrega uma única malha humana esquelética; cada combatente recebe sua própria instância e animações. */
export async function loadCharacterAssets(scene, onProgress) {
  knightContainer = await B.SceneLoader.LoadAssetContainerAsync(
    CHARACTER_ROOT,
    CHARACTER_FILE,
    scene,
    event => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(clamp(event.loaded / event.total, 0, 1));
    }
  );
  knightContainer.animationGroups.forEach(group => group.stop());
}

function tuneMaterial(material, enemy, boss) {
  if (!material) return;
  if (material.subMaterials) {
    material.subMaterials.forEach(subMaterial => tuneMaterial(subMaterial, enemy, boss));
    return;
  }

  // A textura atlas já separa aço, couro e tecido. A cor abaixo funciona como
  // graduação por facção sem apagar os detalhes pintados pelo artista.
  material.albedoColor = boss
    ? new B.Color3(.72, .40, .25)
    : enemy ? new B.Color3(.50, .54, .58) : new B.Color3(.93, .89, .78);
  if ('metallic' in material) material.metallic = boss ? .20 : enemy ? .13 : .18;
  if ('roughness' in material) material.roughness = boss ? .48 : enemy ? .62 : .50;
  if ('environmentIntensity' in material) material.environmentIntensity = enemy ? .78 : 1;
}

function configureEquipment(modelRoot, kind) {
  const loadout = LOADOUTS[kind] || LOADOUTS.raider;
  modelRoot.getDescendants(false).forEach(node => {
    const equipment = EQUIPMENT.find(name => node.name.endsWith(`-${name}`));
    if (equipment) node.setEnabled(loadout.includes(equipment));
    if (node.name.endsWith('-Knight_Cape') && kind !== 'player' && kind !== 'warlord') node.setEnabled(false);
    // O pack é deliberadamente "chibi". Alongar o corpo e reduzir cabeça/elmo
    // preserva o rig, mas aproxima a silhueta das proporções do cenário.
    if (node.name.endsWith('-Knight_Head') || node.name.endsWith('-Knight_Helmet')) {
      node.scaling.scaleInPlace(.82);
    }
  });
}

function findAnimation(groups, names) {
  return groups.find(group => names.some(name => group.name.toLowerCase() === name.toLowerCase()))
    || groups.find(group => names.some(name => group.name.toLowerCase().includes(name.toLowerCase())))
    || null;
}

function buildAnimationSet(groups, kind) {
  groups.forEach(group => {
    group.stop();
    group.enableBlending = true;
    group.blendingSpeed = .08;
  });
  return {
    idle: findAnimation(groups, ['Idle']),
    run: findAnimation(groups, ['Running_A', 'Running_B']),
    attackLight: findAnimation(groups, kind === 'warlord' ? ['2H_Melee_Attack_Chop'] : ['1H_Melee_Attack_Slice_Diagonal']),
    attackHeavy: findAnimation(groups, kind === 'warlord' ? ['2H_Melee_Attack_Chop'] : ['1H_Melee_Attack_Slice_Diagonal']),
    block: findAnimation(groups, ['Blocking', 'Block']),
    dodge: findAnimation(groups, ['Dodge_Forward']),
    hurt: findAnimation(groups, ['Hit_A', 'Hit_B']),
    dead: findAnimation(groups, ['Death_A'])
  };
}

function startAction(rig, action) {
  if (rig.activeAction === action) return;
  rig.activeAction = action;
  rig.animationGroups.forEach(group => group.stop());
  const group = rig.animations[action];
  if (!group) return;
  const loop = action === 'idle' || action === 'run' || action === 'block';
  const speed = action === 'run' ? 1.08
    : action === 'attackLight' ? 1.42
      : action === 'attackHeavy' ? .98
        : action === 'dodge' ? 1.16
          : action === 'hurt' ? 1.3
            : action === 'dead' ? .9 : .88;
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
  modelRoot.scaling.copyFromFloats(.96, 1.3, .96);

  const entries = knightContainer.instantiateModelsToScene(name => `${prefix}-${name}`, true, { doNotInstantiate: true });
  entries.rootNodes.forEach(node => { node.parent = modelRoot; });
  const meshes = modelRoot.getChildMeshes(false);
  const materials = new Set();
  meshes.forEach(mesh => {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    world.addShadow(mesh);
    if (mesh.material) materials.add(mesh.material);
  });
  configureEquipment(modelRoot, kind);
  materials.forEach(material => tuneMaterial(material, enemy, boss));

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
    animations: buildAnimationSet(entries.animationGroups, kind),
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
  else if (pose.attacking && !pose.dead) action = pose.attacking === 'heavy' ? 'attackHeavy' : 'attackLight';
  else if (pose.blocking && !pose.dead) action = 'block';
  else if (pose.hurt > .42 && !pose.dead) action = 'hurt';
  else if ((pose.moving || 0) > .08 && !pose.dead) action = 'run';

  if (pose.dead) {
    startAction(rig, 'dead');
    rig.root.rotation.z = damp(rig.root.rotation.z, 0, 9, dt);
    rig.root.position.y = damp(rig.root.position.y, 0, 9, dt);
  } else {
    startAction(rig, action);
    const hurtLean = pose.hurt > 0 ? Math.sin(pose.hurt * 27) * .16 * pose.hurt : 0;
    rig.root.rotation.z = damp(rig.root.rotation.z, hurtLean, 12, dt);
    rig.modelRoot.position.y = damp(rig.modelRoot.position.y, 0, 12, dt);
  }
}
