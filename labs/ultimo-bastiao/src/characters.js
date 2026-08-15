const B = window.BABYLON;

const damp = (current, target, smoothing, dt) => B.Scalar.Lerp(current, target, 1 - Math.exp(-smoothing * dt));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function attach(mesh, parent, position, material, world, rotation = null) {
  mesh.parent = parent;
  mesh.position.copyFromFloats(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.copyFromFloats(rotation[0], rotation[1], rotation[2]);
  mesh.material = material;
  mesh.isPickable = false;
  world.addShadow(mesh);
  return mesh;
}

function createSword(scene, parent, material, world, heavy = false) {
  const pivot = new B.TransformNode('weapon grip', scene);
  pivot.parent = parent;
  pivot.position.copyFromFloats(0, -.87, .02);
  const grip = B.MeshBuilder.CreateCylinder('leather sword grip', { height: .42, diameter: .11, tessellation: 8 }, scene);
  attach(grip, pivot, [0, -.05, 0], world.materials.leather, world);
  const guard = B.MeshBuilder.CreateBox('sword crossguard', { width: heavy ? .72 : .58, height: .08, depth: .11 }, scene);
  attach(guard, pivot, [0, -.29, 0], world.materials.gold, world);
  const blade = B.MeshBuilder.CreateBox('forged sword blade', { width: heavy ? .15 : .11, height: heavy ? 1.4 : 1.18, depth: .045 }, scene);
  attach(blade, pivot, [0, heavy ? -.98 : -.87, 0], material, world);
  const tip = B.MeshBuilder.CreateCylinder('sword point', { height: .22, diameterTop: 0, diameterBottom: heavy ? .15 : .11, tessellation: 4 }, scene);
  attach(tip, pivot, [0, heavy ? -1.79 : -1.57, 0], material, world, [0, Math.PI / 4, 0]);
  return { pivot, blade };
}

function createAxe(scene, parent, world, large = false) {
  const pivot = new B.TransformNode('axe grip', scene);
  pivot.parent = parent;
  pivot.position.copyFromFloats(0, -.82, 0);
  const shaft = B.MeshBuilder.CreateCylinder('ash axe handle', { height: large ? 1.65 : 1.25, diameter: .1, tessellation: 8 }, scene);
  attach(shaft, pivot, [0, -.58, 0], world.materials.wood, world);
  const head = B.MeshBuilder.CreateBox('iron axe head', { width: large ? .78 : .58, height: .38, depth: .13 }, scene);
  attach(head, pivot, [large ? .17 : .12, large ? -1.38 : -1.08, 0], world.materials.iron, world, [0, 0, -.16]);
  const edge = B.MeshBuilder.CreateCylinder('axe cutting edge', { height: large ? .53 : .4, diameterTop: .06, diameterBottom: large ? .42 : .32, tessellation: 4 }, scene);
  attach(edge, pivot, [large ? .52 : .4, large ? -1.39 : -1.08, 0], world.materials.iron, world, [0, 0, -Math.PI / 2]);
  return { pivot, blade: head };
}

function createShield(scene, arm, world, enemy = false, large = false) {
  const shield = B.MeshBuilder.CreateCylinder('round battle shield', { height: .13, diameter: large ? 1.25 : 1.05, tessellation: 24 }, scene);
  attach(shield, arm, [0, -.78, .35], enemy ? world.materials.clothBlack : world.materials.clothRed, world, [Math.PI / 2, 0, 0]);
  const rim = B.MeshBuilder.CreateTorus('shield iron rim', { diameter: large ? 1.23 : 1.03, thickness: .07, tessellation: 24 }, scene);
  attach(rim, shield, [0, .08, 0], world.materials.iron, world);
  const boss = B.MeshBuilder.CreateSphere('shield boss', { diameter: .28, segments: 10, slice: .55 }, scene);
  attach(boss, shield, [0, .12, 0], world.materials.iron, world, [-Math.PI / 2, 0, 0]);
  return shield;
}

/** Cria um cavaleiro articulado e otimizado, modelado apenas com malhas Babylon. */
export function createKnight(scene, world, options = {}) {
  const enemy = Boolean(options.enemy);
  const kind = options.kind || (enemy ? 'raider' : 'player');
  const boss = kind === 'warlord';
  const brute = kind === 'brute' || boss;
  const guarded = kind === 'guard' || boss || !enemy;
  const scale = options.scale || 1;
  const root = new B.TransformNode(`${kind} root`, scene);
  root.scaling.copyFromFloats(scale, scale, scale);

  const hips = new B.TransformNode(`${kind} hips`, scene);
  hips.parent = root;
  const torso = new B.TransformNode(`${kind} torso`, scene);
  torso.parent = hips;

  const tunicMaterial = enemy ? world.materials.clothBlack : world.materials.clothRed;
  const armorMaterial = world.materials.iron;
  const body = B.MeshBuilder.CreateBox(`${kind} mail torso`, { width: brute ? 1.28 : 1.08, height: 1.28, depth: .62 }, scene);
  attach(body, torso, [0, 2.34, 0], armorMaterial, world);
  body.scaling.x = .86;
  const tabard = B.MeshBuilder.CreateBox(`${kind} wool tabard`, { width: brute ? 1.16 : .98, height: 1.12, depth: .65 }, scene);
  attach(tabard, torso, [0, 2.21, .015], tunicMaterial, world);
  tabard.scaling.x = .84;
  const belt = B.MeshBuilder.CreateBox(`${kind} leather belt`, { width: brute ? 1.13 : .96, height: .16, depth: .68 }, scene);
  attach(belt, torso, [0, 1.79, 0], world.materials.leather, world);
  const buckle = B.MeshBuilder.CreateBox(`${kind} belt buckle`, { width: .18, height: .16, depth: .07 }, scene);
  attach(buckle, torso, [0, 1.79, .38], world.materials.gold, world);

  const skirt = B.MeshBuilder.CreateCylinder(`${kind} split mail skirt`, { height: .78, diameterTop: brute ? 1.12 : .95, diameterBottom: brute ? 1.38 : 1.17, tessellation: 8 }, scene);
  attach(skirt, hips, [0, 1.33, 0], tunicMaterial, world);

  const head = B.MeshBuilder.CreateSphere(`${kind} head`, { diameter: .66, segments: 12 }, scene);
  attach(head, torso, [0, 3.3, .015], world.materials.skin, world);
  const helmet = B.MeshBuilder.CreateSphere(`${kind} iron helmet`, { diameter: brute ? .84 : .77, segments: 12, slice: .68 }, scene);
  attach(helmet, torso, [0, 3.47, 0], armorMaterial, world, [Math.PI, 0, 0]);
  helmet.scaling.z = 1.04;
  const noseGuard = B.MeshBuilder.CreateBox(`${kind} nose guard`, { width: .10, height: .43, depth: .10 }, scene);
  attach(noseGuard, torso, [0, 3.29, .36], armorMaterial, world);
  if (boss) {
    [-1, 1].forEach(side => {
      const horn = B.MeshBuilder.CreateCylinder('warlord horn', { height: .68, diameterTop: 0, diameterBottom: .18, tessellation: 8 }, scene);
      attach(horn, torso, [side * .36, 3.76, 0], world.materials.gold, world, [0, 0, side * .58]);
    });
  }

  const leftArm = new B.TransformNode(`${kind} left shoulder`, scene);
  leftArm.parent = torso; leftArm.position.copyFromFloats(-(brute ? .68 : .59), 2.78, 0);
  const rightArm = new B.TransformNode(`${kind} right shoulder`, scene);
  rightArm.parent = torso; rightArm.position.copyFromFloats(brute ? .68 : .59, 2.78, 0);
  [leftArm, rightArm].forEach((arm, index) => {
    const upper = B.MeshBuilder.CreateCylinder(`${kind} armored arm ${index}`, { height: 1.02, diameterTop: .31, diameterBottom: .25, tessellation: 9 }, scene);
    attach(upper, arm, [0, -.44, 0], armorMaterial, world);
    const hand = B.MeshBuilder.CreateSphere(`${kind} gauntlet ${index}`, { diameter: .28, segments: 8 }, scene);
    attach(hand, arm, [0, -.92, 0], world.materials.leather, world);
    const shoulder = B.MeshBuilder.CreateSphere(`${kind} shoulder plate ${index}`, { diameter: brute ? .5 : .43, segments: 9, slice: .62 }, scene);
    attach(shoulder, arm, [0, -.07, 0], armorMaterial, world, [Math.PI, 0, 0]);
  });

  const leftLeg = new B.TransformNode(`${kind} left hip`, scene);
  leftLeg.parent = hips; leftLeg.position.copyFromFloats(-.31, 1.18, 0);
  const rightLeg = new B.TransformNode(`${kind} right hip`, scene);
  rightLeg.parent = hips; rightLeg.position.copyFromFloats(.31, 1.18, 0);
  [leftLeg, rightLeg].forEach((leg, index) => {
    const thigh = B.MeshBuilder.CreateCylinder(`${kind} leg ${index}`, { height: 1.07, diameterTop: .31, diameterBottom: .24, tessellation: 8 }, scene);
    attach(thigh, leg, [0, -.46, 0], world.materials.leather, world);
    const boot = B.MeshBuilder.CreateBox(`${kind} boot ${index}`, { width: .31, height: .55, depth: .48 }, scene);
    attach(boot, leg, [0, -1.06, .09], world.materials.leather, world);
  });

  const weapon = enemy
    ? createAxe(scene, rightArm, world, brute)
    : createSword(scene, rightArm, armorMaterial, world, false);
  const shield = guarded ? createShield(scene, leftArm, world, enemy, boss) : null;

  const cape = boss || !enemy ? B.MeshBuilder.CreatePlane(`${kind} weathered cape`, { width: brute ? 1.28 : 1.05, height: 1.9, sideOrientation: B.Mesh.DOUBLESIDE }, scene) : null;
  if (cape) attach(cape, torso, [0, 2.17, -.39], enemy ? world.materials.clothBlack : world.materials.clothRed, world, [.06, 0, 0]);

  const rig = {
    root, hips, torso, leftArm, rightArm, leftLeg, rightLeg, weapon, shield, cape,
    enemy, kind, boss, phase: Math.random() * Math.PI * 2, time: 0,
    pose: { moving: 0, attacking: null, attackProgress: 0, blocking: false, dodging: false, hurt: 0, dead: false },
    dispose() { root.getChildMeshes().forEach(mesh => mesh.dispose()); root.dispose(); }
  };
  return rig;
}

/** Anima a malha articulada a partir do estado lógico do personagem. */
export function animateKnight(rig, dt) {
  rig.time += dt;
  const pose = rig.pose;
  const move = clamp(pose.moving || 0, 0, 1);
  const pace = rig.time * (5.8 + move * 4.4) + rig.phase;
  const stride = Math.sin(pace) * .58 * move;
  const bob = Math.abs(Math.sin(pace)) * .055 * move;

  let leftLegX = stride;
  let rightLegX = -stride;
  let leftArmX = -stride * .52;
  let rightArmX = stride * .42;
  let leftArmZ = .08;
  let rightArmZ = -.08;
  let torsoY = bob;
  let torsoZ = 0;
  let hipsZ = 0;

  if (pose.blocking && !pose.dead) {
    leftArmX = -1.28; leftArmZ = -.48;
    rightArmX = -.36; rightArmZ = -.32;
    torsoZ = -.08;
  }

  if (pose.attacking && !pose.dead) {
    const progress = clamp(pose.attackProgress, 0, 1);
    if (pose.attacking === 'heavy') {
      if (progress < .45) {
        const wind = easeInOut(progress / .45);
        rightArmX = -2.55 * wind; rightArmZ = -.72 * wind; torsoZ = -.28 * wind;
      } else {
        const slash = easeInOut((progress - .45) / .55);
        rightArmX = -2.55 + slash * 3.9; rightArmZ = -.72 + slash * 1.05; torsoZ = -.28 + slash * .48;
      }
    } else {
      if (progress < .36) {
        const wind = easeInOut(progress / .36);
        rightArmX = -.35 - wind * 1.65; rightArmZ = -wind * .92; torsoZ = -wind * .16;
      } else {
        const slash = easeInOut((progress - .36) / .64);
        rightArmX = -2 + slash * 2.85; rightArmZ = -.92 + slash * 1.5; torsoZ = -.16 + slash * .25;
      }
    }
    leftArmX = rig.shield ? -1.0 : leftArmX;
  }

  if (pose.dodging && !pose.dead) {
    torsoY -= .32;
    torsoZ = -.34;
    leftLegX = -.8; rightLegX = .55;
    leftArmX = -.95; rightArmX = -.8;
  }

  if (pose.hurt > 0 && !pose.dead) {
    torsoZ += Math.sin(pose.hurt * 28) * .22 * pose.hurt;
    rightArmZ -= .28 * pose.hurt;
  }

  if (pose.dead) {
    rig.root.rotation.z = damp(rig.root.rotation.z, rig.enemy ? -1.48 : 1.48, 3.1, dt);
    rig.root.position.y = damp(rig.root.position.y, .12, 3.5, dt);
    rightArmX = .7; leftArmX = -.4; torsoY = -.12;
  } else {
    rig.root.rotation.z = damp(rig.root.rotation.z, 0, 9, dt);
  }

  rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, leftLegX, 12, dt);
  rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, rightLegX, 12, dt);
  rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, leftArmX, pose.attacking ? 20 : 11, dt);
  rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, rightArmX, pose.attacking ? 24 : 11, dt);
  rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, leftArmZ, 14, dt);
  rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, rightArmZ, 17, dt);
  rig.torso.position.y = damp(rig.torso.position.y, torsoY, 11, dt);
  rig.torso.rotation.z = damp(rig.torso.rotation.z, torsoZ, 13, dt);
  rig.hips.rotation.z = damp(rig.hips.rotation.z, hipsZ, 10, dt);
  if (rig.cape) {
    rig.cape.rotation.x = .06 + Math.sin(rig.time * 4.2 + rig.phase) * .035 + move * .15;
    rig.cape.scaling.x = 1 + Math.sin(rig.time * 3.1 + rig.phase) * .025;
  }
}
