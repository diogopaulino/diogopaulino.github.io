/**
 * Castelo Estelar — Arquitetura de conto de fadas hiper-realista em Babylon.js.
 * Construído com geometria detalhada e materiais PBR (calcário de cantaria, ardósia azul, ouro, vitrais).
 */

import {
    getLimestoneTextures,
    getRoofTextures,
    getClockTexture,
    getFlagTexture
} from './textures.js';

export function createCastle(scene, shadowGenerator) {
    const B = window.BABYLON;
    const root = new B.TransformNode('castle_root', scene);

    const limestoneTex = getLimestoneTextures(scene, { uScale: 4, vScale: 8 });
    const roofTex = getRoofTextures(scene, { uScale: 3, vScale: 6 });
    const clockTex = getClockTexture(scene);
    const flagTex = getFlagTexture(scene);

    // ==========================================
    // Materiais PBR
    // ==========================================

    // Calcário de cantaria das muralhas e fustes
    const stoneMat = new B.PBRMaterial('mat_stone', scene);
    stoneMat.albedoTexture = limestoneTex.albedo;
    stoneMat.bumpTexture = limestoneTex.bump;
    stoneMat.roughness = 0.78;
    stoneMat.metallic = 0.02;
    stoneMat.ambientColor = new B.Color3(0.12, 0.14, 0.18);
    stoneMat.emissiveColor = new B.Color3(0.04, 0.035, 0.025);

    // Telhados cônicos de ardósia azul
    const roofMat = new B.PBRMaterial('mat_roof', scene);
    roofMat.albedoTexture = roofTex.albedo;
    roofMat.bumpTexture = roofTex.bump;
    roofMat.roughness = 0.42;
    roofMat.metallic = 0.14;
    roofMat.emissiveColor = new B.Color3(0.02, 0.04, 0.1);

    // Ornamentos e pináculos dourados
    const goldMat = new B.PBRMaterial('mat_gold', scene);
    goldMat.albedoColor = new B.Color3(0.96, 0.82, 0.32);
    goldMat.metallic = 0.94;
    goldMat.roughness = 0.22;
    goldMat.emissiveColor = new B.Color3(0.24, 0.18, 0.06);

    // Vitrais e janelas com iluminação quente
    const windowMat = new B.PBRMaterial('mat_window', scene);
    windowMat.albedoColor = new B.Color3(1.0, 0.9, 0.65);
    windowMat.emissiveColor = new B.Color3(1.0, 0.75, 0.32);
    windowMat.emissiveIntensity = 1.8;
    windowMat.roughness = 0.2;
    windowMat.metallic = 0.0;

    // Madeira nobre e ferro
    const woodMat = new B.PBRMaterial('mat_wood', scene);
    woodMat.albedoColor = new B.Color3(0.24, 0.16, 0.08);
    woodMat.roughness = 0.88;
    woodMat.metallic = 0.05;

    const darkMat = new B.PBRMaterial('mat_dark', scene);
    darkMat.albedoColor = new B.Color3(0.08, 0.07, 0.06);
    darkMat.roughness = 0.92;
    darkMat.metallic = 0.1;

    const leadMat = new B.PBRMaterial('mat_lead', scene);
    leadMat.albedoColor = new B.Color3(0.28, 0.3, 0.32);
    leadMat.roughness = 0.48;
    leadMat.metallic = 0.65;

    // Material do mostrador do relógio
    const clockMat = new B.PBRMaterial('mat_clock', scene);
    clockMat.albedoTexture = clockTex;
    clockMat.roughness = 0.35;
    clockMat.metallic = 0.1;
    clockMat.emissiveColor = new B.Color3(0.18, 0.14, 0.08);

    // Material de tecido da bandeira
    const flagMat = new B.PBRMaterial('mat_flag', scene);
    flagMat.albedoTexture = flagTex;
    flagMat.roughness = 0.65;
    flagMat.metallic = 0.05;
    flagMat.backFaceCulling = false;
    flagMat.twoSidedLighting = true;

    const shadowMeshes = [];
    const flags = [];
    const windowMeshes = [];

    function trackMesh(m, castShadow = true, receiveShadow = true) {
        m.parent = root;
        m.receiveShadows = receiveShadow;
        if (castShadow && shadowGenerator) {
            shadowGenerator.addShadowCaster(m);
            shadowMeshes.push(m);
        }
        return m;
    }

    // ==========================================
    // Funções utilitárias de construção
    // ==========================================

    function addBox(name, mat, { pos = [0, 0, 0], size = [1, 1, 1], rot = [0, 0, 0], cast = true, receive = true } = {}) {
        const m = B.MeshBuilder.CreateBox(name, {
            width: size[0],
            height: size[1],
            depth: size[2]
        }, scene);
        m.material = mat;
        m.position.set(pos[0], pos[1], pos[2]);
        m.rotation.set(rot[0], rot[1], rot[2]);
        return trackMesh(m, cast, receive);
    }

    function addCylinder(name, mat, { pos = [0, 0, 0], diam = 1, diamTop = diam, height = 1, tess = 36, rot = [0, 0, 0], cast = true, receive = true } = {}) {
        const m = B.MeshBuilder.CreateCylinder(name, {
            diameterBottom: diam,
            diameterTop: diamTop,
            height: height,
            tessellation: tess
        }, scene);
        m.material = mat;
        m.position.set(pos[0], pos[1], pos[2]);
        m.rotation.set(rot[0], rot[1], rot[2]);
        return trackMesh(m, cast, receive);
    }

    function addCone(name, mat, { pos = [0, 0, 0], diam = 1, height = 1, tess = 36, rot = [0, 0, 0], cast = true, receive = true } = {}) {
        const m = B.MeshBuilder.CreateCylinder(name, {
            diameterBottom: diam,
            diameterTop: 0,
            height: height,
            tessellation: tess
        }, scene);
        m.material = mat;
        m.position.set(pos[0], pos[1], pos[2]);
        m.rotation.set(rot[0], rot[1], rot[2]);
        return trackMesh(m, cast, receive);
    }

    function addSphere(name, mat, { pos = [0, 0, 0], diam = 1, segs = 24, cast = false, receive = false } = {}) {
        const m = B.MeshBuilder.CreateSphere(name, {
            diameter: diam,
            segments: segs
        }, scene);
        m.material = mat;
        m.position.set(pos[0], pos[1], pos[2]);
        return trackMesh(m, cast, receive);
    }

    function addMerlons(cx, cz, w, d, y, { step = 0.8, h = 0.65, t = 0.36 } = {}) {
        const hw = w / 2;
        const hd = d / 2;
        const place = (x, z) => {
            addBox(`merlon_${Math.random()}`, stoneMat, {
                pos: [cx + x, y + h / 2, cz + z],
                size: [t, h, t],
                cast: false
            });
        };
        for (let x = -hw; x <= hw + 0.01; x += step) {
            place(x, -hd);
            place(x, hd);
        }
        for (let z = -hd + step; z < hd; z += step) {
            place(-hw, z);
            place(hw, z);
        }
    }

    function addGothicWindow(x, y, z, { w = 0.65, h = 1.5, yaw = 0 } = {}) {
        const winBox = addBox(`win_box_${Math.random()}`, windowMat, {
            pos: [x, y, z],
            size: [w, h, 0.08],
            rot: [0, yaw, 0],
            cast: false
        });
        windowMeshes.push(winBox);

        // Arco pontiagudo superior
        const winArch = addCone(`win_arch_${Math.random()}`, windowMat, {
            pos: [x, y + h * 0.55, z],
            diam: w * 0.95,
            height: h * 0.38,
            rot: [0, yaw, 0],
            cast: false
        });
        windowMeshes.push(winArch);

        // Moldura e peitoril de ferro/chumbo
        addBox(`win_frame_${Math.random()}`, leadMat, {
            pos: [x, y, z + (yaw === 0 ? 0.02 : -0.02)],
            size: [w * 0.08, h * 1.15, 0.1],
            rot: [0, yaw, 0],
            cast: false
        });
        addBox(`win_sill_${Math.random()}`, goldMat, {
            pos: [x, y - h * 0.52, z + (yaw === 0 ? 0.02 : -0.02)],
            size: [w * 1.22, 0.1, 0.14],
            rot: [0, yaw, 0],
            cast: false
        });
    }

    function addFinial(x, y, z, scale = 1) {
        addSphere(`fin_sph_${Math.random()}`, goldMat, {
            pos: [x, y, z],
            diam: 0.45 * scale,
            cast: false
        });
        addCone(`fin_cone_${Math.random()}`, goldMat, {
            pos: [x, y + 0.65 * scale, z],
            diam: 0.16 * scale,
            height: 1.1 * scale,
            cast: false
        });
    }

    function addFlagBanner(x, y, z, scale = 1) {
        addCylinder(`pole_${Math.random()}`, goldMat, {
            pos: [x, y + 0.9 * scale, z],
            diam: 0.08 * scale,
            height: 1.8 * scale,
            cast: false
        });
        const plane = B.MeshBuilder.CreatePlane(`flag_${Math.random()}`, {
            width: 1.4 * scale,
            height: 0.8 * scale,
            sideOrientation: B.Mesh.DOUBLESIDE
        }, scene);
        plane.material = flagMat;
        plane.position.set(x + 0.72 * scale, y + 1.25 * scale, z);
        trackMesh(plane, false, false);
        flags.push({ mesh: plane, baseY: y + 1.25 * scale, scale });
    }

    function addTower({ x = 0, y = 0, z = 0, r = 1.25, h = 12, roofH = 6.5, clock = false, banner = true } = {}) {
        // Fuste cilíndrico de calcário
        addCylinder(`tow_body_${Math.random()}`, stoneMat, {
            pos: [x, y + h / 2, z],
            diam: r * 2,
            diamTop: r * 1.9,
            height: h,
            tess: 36
        });

        // Corbelha / cornija superior
        addCylinder(`tow_cornice_${Math.random()}`, stoneMat, {
            pos: [x, y + h + 0.22, z],
            diam: r * 2.3,
            diamTop: r * 2.35,
            height: 0.45,
            tess: 36,
            cast: false
        });

        // Ameias no topo da torre
        addMerlons(x, z, r * 2.2, r * 2.2, y + h + 0.35, {
            step: Math.max(0.55, r * 0.55),
            h: 0.55,
            t: 0.28
        });

        // Telhado cônico de ardósia azul
        addCone(`tow_roof_${Math.random()}`, roofMat, {
            pos: [x, y + h + 0.55 + roofH / 2, z],
            diam: r * 2.65,
            height: roofH,
            tess: 40
        });

        // Pináculo dourado
        const tipY = y + h + 0.55 + roofH;
        addFinial(x, tipY + 0.2, z, Math.max(0.75, r * 0.7));
        if (banner) {
            addFlagBanner(x, tipY + 0.9, z, Math.max(0.7, r * 0.65));
        }

        // Janelas góticas nos níveis da torre
        const levels = Math.max(2, Math.floor(h / 4.2));
        for (let i = 0; i < levels; i++) {
            const wy = y + 2.4 + i * (h - 3.4) / levels;
            addGothicWindow(x, wy, z + r * 0.96, { w: r * 0.38, h: 1.2 + r * 0.15 });
            if (r > 1.15) {
                addGothicWindow(x, wy, z - r * 0.96, { w: r * 0.32, h: 1.05, yaw: Math.PI });
            }
        }

        // Relógio no fuste principal
        if (clock) {
            const clockMesh = addCylinder(`clock_face_${Math.random()}`, clockMat, {
                pos: [x, y + h * 0.64, z + r * 0.98],
                diam: 2.2,
                height: 0.1,
                rot: [Math.PI / 2, 0, 0],
                cast: false
            });
            // Anel externo do relógio
            const ring = B.MeshBuilder.CreateTorus(`clock_ring_${Math.random()}`, {
                diameter: 2.22,
                thickness: 0.14,
                tessellation: 36
            }, scene);
            ring.material = goldMat;
            ring.position.set(x, y + h * 0.64, z + r * 1.02);
            ring.rotation.set(Math.PI / 2, 0, 0);
            trackMesh(ring, false, false);
        }
    }

    // ==========================================
    // Montagem do Castelo
    // ==========================================

    // 1. Muralhas externas (Curtain Walls)
    addBox('curtain_wall_main', stoneMat, {
        pos: [0, 3.6, 2.2],
        size: [24, 7.2, 15.5]
    });
    addMerlons(0, 2.2, 24, 15.5, 7.2, { step: 0.88, h: 0.7, t: 0.38 });

    // Alas laterais das muralhas
    for (const sx of [-1, 1]) {
        addBox(`curtain_wing_${sx}`, stoneMat, {
            pos: [sx * 10.4, 4.8, 2.2],
            size: [2.8, 9.6, 16.2]
        });
        // Contrafortes laterais (Buttresses)
        addBox(`buttress_${sx}`, stoneMat, {
            pos: [sx * 12.4, 4.4, 4.8],
            size: [1.8, 8.8, 2.6],
            rot: [0, 0, sx * -0.16]
        });
    }

    // 2. Grande Torre de Menagem (Central Keep)
    addBox('keep_body', stoneMat, {
        pos: [0, 8.8, -1.2],
        size: [12.6, 17.6, 10.2]
    });
    addBox('keep_roof_base', roofMat, {
        pos: [0, 17.8, -1.2],
        size: [13.2, 0.65, 10.8]
    });
    addMerlons(0, -1.2, 12.6, 10.2, 17.6, { step: 0.82, h: 0.75, t: 0.36 });

    // Janelas da Torre de Menagem
    for (let i = -1; i <= 1; i++) {
        addGothicWindow(i * 2.6, 7.8, 4.0, { w: 0.8, h: 1.8 });
        addGothicWindow(i * 2.6, 12.2, 4.0, { w: 0.7, h: 1.55 });
    }

    // Balcão Real superior
    addBox('keep_balcony', stoneMat, {
        pos: [0, 10.8, 4.8],
        size: [5.2, 0.32, 1.8]
    });
    for (let i = -2; i <= 2; i++) {
        addCylinder(`balcony_col_${i}`, goldMat, {
            pos: [i * 0.95, 11.3, 5.5],
            diam: 0.1,
            height: 0.95,
            cast: false
        });
    }

    // 3. Portaria Fortificada (Gatehouse & Barbican)
    addBox('gatehouse_body', stoneMat, {
        pos: [0, 4.6, 7.8],
        size: [8.2, 9.2, 4.6]
    });
    // Túnel do portão
    addBox('gate_tunnel', darkMat, {
        pos: [0, 2.8, 10.05],
        size: [2.8, 4.8, 0.5],
        cast: false
    });
    addCone('gate_arch', darkMat, {
        pos: [0, 5.5, 10.05],
        diam: 2.8,
        height: 1.6,
        rot: [Math.PI / 2, 0, 0],
        cast: false
    });
    // Grade de madeira (Portcullis)
    for (let i = -1; i <= 1; i++) {
        addBox(`portcullis_${i}`, woodMat, {
            pos: [i * 0.75, 2.6, 10.12],
            size: [0.14, 4.2, 0.1],
            cast: false
        });
    }
    // Rosácea / Vitral circular acima do portão
    const roseRing = B.MeshBuilder.CreateTorus('rose_ring', {
        diameter: 1.9,
        thickness: 0.16,
        tessellation: 36
    }, scene);
    roseRing.material = goldMat;
    roseRing.position.set(0, 10.2, 10.12);
    roseRing.rotation.set(Math.PI / 2, 0, 0);
    trackMesh(roseRing, false, false);

    const roseGlass = addSphere('rose_glass', windowMat, {
        pos: [0, 10.2, 10.14],
        diam: 1.6,
        cast: false
    });
    roseGlass.scaling.set(1, 1, 0.08);
    windowMeshes.push(roseGlass);

    addGothicWindow(-2.4, 6.8, 10.1, { w: 0.75, h: 1.6 });
    addGothicWindow(2.4, 6.8, 10.1, { w: 0.75, h: 1.6 });

    // 4. Ponte de Arcos de Pedra sobre o Lago (Arch Bridge)
    const bridgeLength = 18;
    const bridgeWidth = 3.8;
    const bridgeZ0 = 10.0;
    addBox('bridge_deck', stoneMat, {
        pos: [0, 1.45, bridgeZ0 + bridgeLength / 2],
        size: [bridgeWidth, 0.46, bridgeLength],
        receive: true
    });
    addMerlons(0, bridgeZ0 + bridgeLength / 2, bridgeWidth, bridgeLength, 1.65, {
        step: 0.9,
        h: 0.48,
        t: 0.24
    });

    const arches = 4;
    const span = bridgeLength / arches;
    for (let i = 0; i < arches; i++) {
        const z = bridgeZ0 + span * (i + 0.5);
        addCylinder(`bridge_arch_${i}`, stoneMat, {
            pos: [0, 0.18, z],
            diam: bridgeWidth * 0.95,
            height: bridgeWidth * 1.08,
            rot: [0, 0, Math.PI / 2],
            receive: true
        });
        addBox(`bridge_pier_l_${i}`, stoneMat, {
            pos: [-bridgeWidth * 0.44, 0.6, z],
            size: [0.5, 1.3, span * 0.55]
        });
        addBox(`bridge_pier_r_${i}`, stoneMat, {
            pos: [bridgeWidth * 0.44, 0.6, z],
            size: [0.5, 1.3, span * 0.55]
        });
        // Lanternas douradas nos pilares da ponte
        if (i % 2 === 0) {
            addSphere(`bridge_lamp_l_${i}`, windowMat, {
                pos: [-bridgeWidth * 0.48, 2.3, z],
                diam: 0.35
            });
            addSphere(`bridge_lamp_r_${i}`, windowMat, {
                pos: [bridgeWidth * 0.48, 2.3, z],
                diam: 0.35
            });
        }
    }

    // Escadaria do Pátio ao Portão
    for (let i = 0; i < 9; i++) {
        addBox(`stair_${i}`, stoneMat, {
            pos: [0, 0.2 + i * 0.24, 26.5 - i * 0.75],
            size: [4.6 - i * 0.12, 0.26, 1.2],
            receive: true
        });
    }

    // 5. Torres e Coruchéus (Grand Spire & Turrets)
    const towerSpecs = [
        // Coruchéu Central Majestoso com Relógio
        { x: 0, y: 17.5, z: -1.4, r: 2.15, h: 24.5, roofH: 13.5, clock: true, banner: true },
        // Torres das Quatro Esquinas e Flancos
        { x: -6.8, y: 7.2, z: 4.8, r: 1.35, h: 12.5, roofH: 6.8, banner: true },
        { x: 6.5, y: 7.2, z: 5.1, r: 1.2, h: 11.2, roofH: 6.2, banner: true },
        { x: -9.2, y: 7.2, z: -1.2, r: 1.55, h: 16.8, roofH: 9.0, banner: true },
        { x: 9.4, y: 7.2, z: -1.5, r: 1.28, h: 19.5, roofH: 10.2, banner: true },
        { x: -5.5, y: 7.2, z: -6.8, r: 1.65, h: 17.8, roofH: 9.4, banner: true },
        { x: 5.0, y: 7.2, z: -7.0, r: 1.4, h: 14.5, roofH: 7.8, banner: true },
        // Torres Gêmeas da Portaria
        { x: -2.75, y: 8.8, z: 7.8, r: 0.98, h: 9.2, roofH: 4.8, banner: true },
        { x: 2.75, y: 8.8, z: 7.8, r: 0.94, h: 9.6, roofH: 5.0, banner: true },
        // Coruchéu Posterior Alto
        { x: 0.0, y: 17.5, z: -6.6, r: 1.05, h: 11.8, roofH: 6.0, banner: true }
    ];

    for (const spec of towerSpecs) {
        addTower(spec);
    }

    // Guaritas de canto (Bartizans)
    const corners = [
        [-5.8, 17.6, 3.4], [5.8, 17.6, 3.4], [-5.8, 17.6, -5.8], [5.8, 17.6, -5.8]
    ];
    for (const [x, y, z] of corners) {
        addTower({ x, y, z, r: 0.52, h: 2.8, roofH: 2.4, banner: false });
    }

    return {
        root,
        windowMat,
        flags,
        setGlow: (intensity) => {
            windowMat.emissiveIntensity = 0.85 + intensity * 1.8;
            clockMat.emissiveColor = new B.Color3(0.18 + intensity * 0.35, 0.14 + intensity * 0.25, 0.08);
        },
        tick: (time) => {
            // Ondulação suave das bandeiras
            for (let i = 0; i < flags.length; i++) {
                const f = flags[i];
                const wave = Math.sin(time * 3.5 + i * 1.2) * 0.14;
                f.mesh.rotation.y = wave;
                f.mesh.rotation.z = Math.cos(time * 2.8 + i) * 0.06;
            }
        }
    };
}

