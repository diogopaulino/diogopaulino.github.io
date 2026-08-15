const B = window.BABYLON;

const color = hex => B.Color3.FromHexString(hex);
const rand = (min, max) => min + Math.random() * (max - min);

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

function stoneTexture(scene) {
  return texture(scene, 'rough stone', 512, (ctx, size) => {
    ctx.fillStyle = '#77736b'; ctx.fillRect(0, 0, size, size);
    const row = 58;
    for (let y = -row; y < size + row; y += row) {
      const offset = (Math.floor(y / row) % 2) * 48;
      for (let x = -96; x < size + 96; x += 96) {
        const px = x + offset + rand(-4, 4);
        const py = y + rand(-2, 2);
        const shade = Math.floor(rand(91, 132));
        ctx.fillStyle = `rgb(${shade},${shade - 3},${shade - 8})`;
        ctx.fillRect(px + 2, py + 2, 90 + rand(-7, 5), row - 7);
        ctx.strokeStyle = 'rgba(35,32,28,.42)'; ctx.lineWidth = 3;
        ctx.strokeRect(px + 1, py + 1, 92, row - 5);
        for (let i = 0; i < 18; i += 1) {
          ctx.fillStyle = `rgba(255,255,255,${rand(.012, .055)})`;
          ctx.fillRect(px + rand(4, 87), py + rand(4, row - 11), rand(1, 4), rand(1, 3));
        }
      }
    }
  });
}

function earthTexture(scene) {
  return texture(scene, 'mud and stone', 768, (ctx, size) => {
    ctx.fillStyle = '#444239'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4400; i += 1) {
      const light = Math.floor(rand(35, 92));
      ctx.fillStyle = `rgba(${light},${light - 4},${Math.max(18, light - 13)},${rand(.08, .34)})`;
      const r = rand(.5, 4.5);
      ctx.beginPath(); ctx.ellipse(rand(0, size), rand(0, size), r * 1.8, r, rand(0, Math.PI), 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 34; i += 1) {
      ctx.strokeStyle = `rgba(21,19,16,${rand(.12,.28)})`; ctx.lineWidth = rand(1, 4);
      ctx.beginPath();
      const x = rand(0, size), y = rand(0, size);
      ctx.moveTo(x, y); ctx.bezierCurveTo(x + rand(-40, 40), y + rand(5, 45), x + rand(-55, 55), y + rand(20, 70), x + rand(-30, 30), y + rand(45, 100)); ctx.stroke();
    }
  });
}

function woodTexture(scene) {
  return texture(scene, 'aged oak', 512, (ctx, size) => {
    ctx.fillStyle = '#68482e'; ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 64) {
      ctx.fillStyle = x % 128 ? '#725035' : '#5f412a'; ctx.fillRect(x, 0, 61, size);
      ctx.fillStyle = 'rgba(20,12,7,.42)'; ctx.fillRect(x + 60, 0, 4, size);
      for (let i = 0; i < 18; i += 1) {
        ctx.strokeStyle = `rgba(25,14,8,${rand(.08,.25)})`; ctx.lineWidth = rand(1, 3);
        ctx.beginPath(); const y = rand(0, size); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 19, y + rand(-7,7), x + 43, y + rand(-7,7), x + 60, y + rand(-2,2)); ctx.stroke();
      }
    }
  });
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
  materials.stone.albedoTexture = stoneTexture(scene);
  materials.stone.albedoTexture.uScale = 4.8; materials.stone.albedoTexture.vScale = 2.6;
  materials.earth.albedoTexture = earthTexture(scene);
  materials.earth.albedoTexture.uScale = 7; materials.earth.albedoTexture.vScale = 7;
  materials.wood.albedoTexture = woodTexture(scene);
  materials.wood.albedoTexture.uScale = 2; materials.wood.albedoTexture.vScale = 2;

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
    tower.position.copyFromFloats(x, 7.5, z); tower.material = materials.stone; addShadow(tower);
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

  // Céu procedural com horizonte quente e nuvens em camadas.
  const sky = B.MeshBuilder.CreateSphere('storm sky', { diameter: 430, segments: 20, sideOrientation: B.Mesh.BACKSIDE }, scene);
  const skyMat = new B.StandardMaterial('storm sky material', scene);
  skyMat.disableLighting = true;
  skyMat.emissiveTexture = texture(scene, 'painted storm sky', 1024, (ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#17212c'); gradient.addColorStop(.47, '#39444a'); gradient.addColorStop(.72, '#8b6a4d'); gradient.addColorStop(1, '#262825');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(${Math.floor(rand(23,70))},${Math.floor(rand(28,69))},${Math.floor(rand(34,73))},${rand(.07,.25)})`;
      ctx.beginPath(); ctx.ellipse(rand(0,size), rand(90,600), rand(45,180), rand(8,32), rand(-.1,.1), 0, Math.PI * 2); ctx.fill();
    }
  });
  skyMat.emissiveTexture.vScale = .98;
  skyMat.backFaceCulling = false;
  skyMat.disableDepthWrite = true;
  sky.material = skyMat;
  sky.infiniteDistance = true;
  sky.isPickable = false;

  // Vegetação e destroços dão escala e escondem a forma simples das muralhas.
  for (let i = 0; i < quality.vegetation; i += 1) {
    const outside = i < quality.vegetation * .68;
    const x = outside ? (Math.random() > .5 ? rand(48, 78) : rand(-78, -48)) : rand(-36, 36);
    const z = outside ? rand(-70, 70) : rand(-33, 34);
    if (!outside && Math.hypot(x, z) < 15) continue;
    const trunk = B.MeshBuilder.CreateCylinder(`pine trunk ${i}`, { height: rand(2.6, 4.7), diameterTop: .18, diameterBottom: .48, tessellation: 7 }, scene);
    trunk.position.copyFromFloats(x, 1.5, z); trunk.material = materials.wood;
    const crown = B.MeshBuilder.CreateCylinder(`pine crown ${i}`, { height: rand(4, 7), diameterTop: 0, diameterBottom: rand(2.4, 4.1), tessellation: 8 }, scene);
    crown.position.copyFromFloats(x, rand(4.4, 5.5), z); crown.material = materials.grass;
    if (!outside) { addShadow(trunk); addShadow(crown); }
  }

  for (let i = 0; i < 22; i += 1) {
    const angle = rand(0, Math.PI * 2); const radius = rand(14, 36);
    const rock = B.MeshBuilder.CreatePolyhedron(`courtyard stone ${i}`, { type: 2, size: rand(.25, .8) }, scene);
    rock.position.copyFromFloats(Math.cos(angle) * radius, rand(.08, .35), Math.sin(angle) * radius);
    rock.scaling.y = rand(.4, .8); rock.rotation.y = rand(0, Math.PI); rock.material = materials.stoneDark; addShadow(rock);
  }

  const barrel = (x, z, rotation = 0) => {
    const body = B.MeshBuilder.CreateCylinder('broken barrel', { height: 1.4, diameter: 1.05, tessellation: 12 }, scene);
    body.position.copyFromFloats(x, .7, z); body.rotation.z = rotation; body.material = materials.wood; addShadow(body);
    [-.48, .48].forEach(y => {
      const ring = B.MeshBuilder.CreateTorus('barrel iron hoop', { diameter: 1.06, thickness: .07, tessellation: 12 }, scene);
      ring.parent = body; ring.position.y = y; ring.material = materials.iron; addShadow(ring);
    });
  };
  barrel(-21, -17, 0); barrel(-20, -15.8, Math.PI / 2); barrel(25, 19, Math.PI / 2);

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
    fires.push({ light, fire, smoke, seed: Math.random() * 10 });
  }
  createFire([-27, .25, -22], 1.1); createFire([31, .25, 10], .85); createFire([-34, .25, 24], .7);
  [-16, 16].forEach(x => createFire([x, 8.8, -38.1], .35));

  // Pós-processamento cinematográfico e FXAA.
  const pipeline = new B.DefaultRenderingPipeline('cinematic pipeline', true, scene, [scene.activeCamera]);
  pipeline.samples = quality.hardwareScale < 1 ? 2 : 1;
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = .84;
  pipeline.bloomWeight = .13;
  pipeline.bloomKernel = 48;
  pipeline.chromaticAberrationEnabled = true;
  pipeline.chromaticAberration.aberrationAmount = 4;
  pipeline.grainEnabled = true;
  pipeline.grain.intensity = 5;
  pipeline.grain.animated = true;

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

  return { materials, shadow, addShadow, update, burst, gate, pipeline };
}
