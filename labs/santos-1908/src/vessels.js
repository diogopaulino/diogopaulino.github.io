/**
 * vessels — as outras embarcações do porto do café: vapores atracados e fundeados,
 * veleiros de carga com velas ferradas, o rebocador que acompanha o Kasato Maru e
 * catraias a remo cruzando o estuário (contagem inventada com plausibilidade — §6).
 */
import * as THREE from 'three';
import { createHuman, poseHuman, SKIN_TONES } from '../../shared/gfx/human.js';
import { createParticles } from '../../shared/gfx/particles.js';
import { clamp, lerp, smoothstep } from '../../shared/gfx/core.js';
import { buildSteamer, buildSailer, buildTug, buildCanoe } from './ships.js';
import { kasatoPose } from './config.js';
import { bar, P, Batch } from './kit.js';

export function createVessels(ctx, world) {
    const { scene, mats, quality } = ctx;
    const floats = [];
    const add = (group, x, z, heading, bobK = 1) => {
        group.position.set(x, 0, z);
        group.rotation.y = heading;
        scene.add(group);
        floats.push({ group, x, z, heading, bobK, ph: x * 0.13 + z * 0.07 });
        return group;
    };

    // vapores: dois atracados (um a NW carregando café, um a SE) e um fundeado ao largo
    const specs = [
        { L: 98, B: 12.8, seed: 11, hullSide: 0x18181b, funnel: 0x1c1c1e, funnelBase: 0x9a2a22, funnelBand: 0x9a2a22, x: -7.4, z: 152, h: 0 },
        { L: 88, B: 12, seed: 23, hullSide: 0x3a3f44, hullBottom: 0x4a2a22, funnel: 0x1c1c1e, funnelBase: 0xd8c27a, funnelBand: 0x1c1c1e, x: -7.0, z: -292, h: Math.PI },
        { L: 104, B: 13.4, seed: 37, hullSide: 0x1a1c20, funnel: 0x1c1c1e, funnelBase: 0x1c1c1e, funnelBand: 0xe6e0d0, x: -262, z: 236, h: 0.55 }
    ];
    const smokes = [];
    specs.slice(0, quality.id === 'low' ? 2 : 3).forEach((sp, i) => {
        const st = buildSteamer(mats, { ...sp, draft: 6, freeboard: 3.9, detail: 1 });
        add(st.group, sp.x, sp.z, sp.h, 0.4);
        st.group.updateMatrixWorld();
        if (i !== 1) {
            const p = createParticles({
                count: 26, life: 9, origin: st.funnelTop.clone().applyMatrix4(st.group.matrixWorld),
                velocity: new THREE.Vector3(0.5, 1.4, -0.5), turbulence: 1.6, size: [1.6, 11], color: 0x4a4640, opacity: 0.26
            });
            scene.add(p.mesh);
            smokes.push(p);
        }
    });

    // veleiros
    const s1 = buildSailer(mats, { L: 46, B: 8.6, side: 0x1e2a24, masts: 3 });
    add(s1.group, -5.4, 292, 0, 0.5);
    if (quality.id !== 'low') {
        const s2 = buildSailer(mats, { L: 38, B: 7.6, side: 0x2a2420, masts: 2 });
        add(s2.group, -5.0, 356, Math.PI, 0.5);
        const s3 = buildSailer(mats, { L: 50, B: 9, side: 0xd8d2c2, masts: 3 });
        add(s3.group, -305, -150, 2.6, 1);
    }

    // rebocador de escolta
    const tug = buildTug(mats);
    scene.add(tug.group);
    const tugSmoke = createParticles({
        count: 34, life: 6, velocity: new THREE.Vector3(0, 2, 0), turbulence: 1.2, size: [0.8, 7], color: 0x2e2a26, opacity: 0.5
    });
    scene.add(tugSmoke.mesh);

    // catraias a remo
    const canoes = [];
    const routes = [
        [[-60, -210], [-190, -60]], [[-40, 96], [-230, 150]], [[-160, 40], [-30, 230]]
    ];
    routes.slice(0, quality.id === 'low' ? 1 : 3).forEach((r, i) => {
        const c = buildCanoe(mats);
        const rower = createHuman({
            height: 1.68, top: i % 2 ? 'none' : 'long', bottom: 'rolled', shoes: 'barefoot', hat: 'straw',
            topColor: 0xd8d0c0, bottomColor: 0x6a6252, skin: SKIN_TONES[3 + i], hair: 0x120c08
        });
        rower.object.position.set(0, -0.14, -0.2);
        c.group.add(rower.object);
        const ob = new Batch(mats);
        for (const s of [1, -1]) ob.add('wood', bar(P(s * 0.5, 0.75, 0.2), P(s * 2.3, 0.05, 0.9), 0.03, 5, 0.05), 0x9a7a50);
        const oars = ob.build(null, { cast: false });
        c.group.add(oars);
        scene.add(c.group);
        canoes.push({ group: c.group, rower, oars, a: r[0], b: r[1], off: i * 0.31 });
    });

    const pose = {};
    const tmp = new THREE.Vector3();
    return {
        update(t) {
            const oc = world.ocean;
            for (const f of floats) {
                f.group.position.y = oc.heightAt(f.x, f.z, t, 0.25) * f.bobK;
                f.group.rotation.z = Math.sin(t * 0.4 + f.ph) * 0.008 * f.bobK;
                f.group.rotation.x = Math.sin(t * 0.33 + f.ph * 1.7) * 0.004 * f.bobK;
            }
            for (const s of smokes) s.update(t);

            // rebocador: na amura de boreste do Kasato até a manobra; depois se afasta
            kasatoPose(t, pose);
            const away = smoothstep(96, 118, t);
            const lx = lerp(-16, -80, away);
            const lz = lerp(104, 150, away);
            const c = Math.cos(pose.heading);
            const s = Math.sin(pose.heading);
            const tx = pose.x + lx * c + lz * s;
            const tz = pose.z - lx * s + lz * c;
            const g = tug.group;
            g.position.set(tx, oc.heightAt(tx, tz, t, 0.35), tz);
            g.rotation.set(Math.sin(t * 0.9) * 0.012, pose.heading - away * 0.9, Math.sin(t * 0.7) * 0.02);
            g.updateMatrixWorld();
            const sp = clamp(pose.speed / 5 + away * (1 - smoothstep(116, 124, t)) * 0.6, 0, 1);
            tmp.set(0, 0, 12).applyMatrix4(g.matrixWorld);
            oc.setWake(1, tmp.x, tmp.z, g.rotation.y, sp * 0.3, 2.9, 24);
            tugSmoke.uniforms.uOrigin.value.copy(tug.funnelTop).applyMatrix4(g.matrixWorld);
            tugSmoke.uniforms.uVel.value.set(-Math.sin(g.rotation.y) * pose.speed * 0.7 + 0.4, 2, -Math.cos(g.rotation.y) * pose.speed * 0.7 - 0.4);
            tugSmoke.update(t);

            for (const cn of canoes) {
                const u = (t / 150 + cn.off) % 1;
                const k = u < 0.5 ? u * 2 : 2 - u * 2;
                const x = lerp(cn.a[0], cn.b[0], k);
                const z = lerp(cn.a[1], cn.b[1], k);
                cn.group.position.set(x, oc.heightAt(x, z, t, 0.3) + 0.02, z);
                const dir = Math.atan2(cn.b[0] - cn.a[0], cn.b[1] - cn.a[1]) + (u < 0.5 ? 0 : Math.PI);
                cn.group.rotation.set(Math.sin(t * 1.1 + cn.off * 9) * 0.03, dir, Math.sin(t * 0.8 + cn.off * 5) * 0.04);
                const stroke = Math.sin(t * 2.2 + cn.off * 20);
                poseHuman(cn.rower, 'sit', t, 1);
                // remada: tronco vai e volta, braços estendem
                cn.rower.bones.spine.rotation.x = 0.25 + stroke * 0.3;
                cn.rower.bones.armL.rotation.x = cn.rower.bones.armR.rotation.x = -1.1 - stroke * 0.35;
                cn.rower.bones.foreL.rotation.x = cn.rower.bones.foreR.rotation.x = -0.5 + stroke * 0.4;
                cn.rower.object.rotation.y = Math.PI; // remador de costas para a proa
                cn.oars.rotation.y = stroke * 0.35;
                cn.oars.rotation.x = Math.cos(t * 2.2 + cn.off * 20) * 0.12;
            }
        }
    };
}
