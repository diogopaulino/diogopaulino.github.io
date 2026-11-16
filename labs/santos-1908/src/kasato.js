/**
 * kasato — o Kasato Maru (K01–K04): modelo completo, passageiros na amurada,
 * tripulação, fumaça da chaminé e esteira.
 *
 * Passageiros (H02, D02): 781 pessoas no navio real; aqui uma amostra por tier,
 * todos no bordo de bombordo (lado do cais), debruçados olhando a cidade.
 * Vestuário: os emigrantes embarcaram em Kōbe com roupa ocidental comprada para a
 * viagem; mantemos uma minoria de quimonos (mulheres) — ver research.md H02.
 */
import * as THREE from 'three';
import { createHuman, poseHuman, SKIN_TONES } from '../../shared/gfx/human.js';
import { createParticles } from '../../shared/gfx/particles.js';
import { seeded, clamp } from '../../shared/gfx/core.js';
import { buildSteamer } from './ships.js';
import { kasatoPose, LAYOUT } from './config.js';

const SUITS = [0x2a2a30, 0x3a342c, 0x4a4438, 0x23262e, 0x5a5346, 0x33302a];
const KIMONO = [0x3a4a7a, 0x5a3a4a, 0x2e4a44, 0x6a5a7a, 0x4a3a2a];

export function createKasato(ctx, world) {
    const { scene, mats, quality } = ctx;
    const ship = buildSteamer(mats, {
        L: LAYOUT.kasatoLength, B: LAYOUT.kasatoBeam, draft: 7.2, freeboard: 4.4, detail: 2,
        name: 'KASATO MARU', seed: 1908
    });
    ship.group.name = 'kasato';
    scene.add(ship.group);

    const rnd = seeded(1908);
    const people = [];
    const wells = ship.spots.filter((s) => s.kind === 'well');
    const boat = ship.spots.filter((s) => s.kind === 'boat');
    const others = ship.spots.filter((s) => s.kind !== 'well' && s.kind !== 'boat');
    const pick = (arr) => arr.splice(Math.floor(rnd() * arr.length), 1)[0];
    for (let i = 0; i < quality.passengers; i++) {
        // 45% no convés das baleeiras (guarda-corpo vazado: corpo inteiro à vista), 40% nos poços
        const r = i % 20;
        const spot = r < 9 && boat.length ? pick(boat) : r < 17 && wells.length ? pick(wells) : others.length ? pick(others) : pick(wells);
        if (!spot) break;
        const female = rnd() < 0.36;
        const kimono = female && rnd() < 0.55;
        const child = rnd() < 0.08;
        const h = createHuman({
            female, child,
            height: child ? 1.15 + rnd() * 0.2 : (female ? 1.5 : 1.6) + rnd() * 0.12,
            build: 0.9 + rnd() * 0.15,
            skin: [SKIN_TONES[0], SKIN_TONES[1], 0xe8c098][Math.floor(rnd() * 3)],
            hair: 0x120c08,
            hairStyle: female ? 'bun' : 'short',
            top: kimono ? 'kimono' : female ? 'long' : 'jacket',
            bottom: kimono ? 'kimono' : female ? 'skirt' : 'pants',
            topColor: kimono ? rnd.pick(KIMONO) : female ? 0xd8d0c0 : rnd.pick(SUITS),
            bottomColor: female ? rnd.pick(SUITS) : rnd.pick(SUITS),
            accent: rnd.pick([0xb03a3a, 0xc9a040, 0x6a7a4a]),
            shoes: kimono ? 'sandal' : 'boot',
            shoeColor: kimono ? 0x8a7a5a : 0x1a1410,
            hat: female ? 'none' : rnd.pick(['fedora', 'bowler', 'cap', 'none', 'fedora']),
            hatColor: rnd.pick([0x2a2a2e, 0x4a4238, 0xc9b88a])
        });
        h.object.position.set(spot.x, spot.y, spot.z + (rnd() - 0.5) * 0.3);
        h.object.rotation.y = Math.PI / 2 + (rnd() - 0.5) * 0.5;
        h.phase = rnd() * 40;
        // na borda falsa maciça dos poços ficam eretos (senão só o chapéu aparece)
        h.mode = spot.kind === 'well' ? 'idle' : rnd() < 0.7 ? 'lean' : 'idle';
        if (spot.kind === 'well') h.object.position.x += 0.14;
        else if (h.mode === 'idle') h.object.position.x -= 0.25;
        h.waver = rnd() < 0.2;
        h.object.castShadow = false; // 40 malhas a menos no passe de sombra
        ship.group.add(h.object);
        people.push(h);
    }
    // tripulação na asa do passadiço e no castelo de proa
    const crewSpots = [
        [LAYOUT.kasatoBeam / 2 - 0.3, ship.bridgeY, 12.5, Math.PI / 2],
        [2.2, ship.bridgeY, 15.6, 0.2],
        [1.4, ship.hull.deckYAt(52), 52, 1.2],
        [-1.6, ship.hull.deckYAt(49), 49.5, 0.5]
    ];
    for (const [x, y, z, ry] of crewSpots) {
        const h = createHuman({
            height: 1.68, top: 'jacket', bottom: 'pants', topColor: 0x1c2230, bottomColor: 0x1c2230,
            hat: 'kepi', hatColor: 0xe8e4da, shoes: 'boot', shoeColor: 0x15120f, skin: SKIN_TONES[1], hair: 0x120c08
        });
        h.object.position.set(x, y, z);
        h.object.rotation.y = ry;
        h.phase = rnd() * 30;
        h.mode = 'idle';
        ship.group.add(h.object);
        people.push(h);
    }

    const smoke = createParticles({
        count: quality.smoke, life: 11,
        velocity: new THREE.Vector3(0, 2.4, 0), velocitySpread: new THREE.Vector3(0.5, 0.5, 0.5),
        spread: new THREE.Vector3(0.7, 0.2, 0.7), turbulence: 2.2,
        size: [2.2, 17], color: 0x35312c, opacity: 0.55
    });
    scene.add(smoke.mesh);

    const pose = {};
    const top = new THREE.Vector3();
    const bow = new THREE.Vector3();
    let frame = 0;

    return {
        ship,
        group: ship.group,
        update(t, dt, camera) {
            kasatoPose(t, pose);
            const moving = clamp(pose.speed / 5, 0, 1);
            const g = ship.group;
            g.position.set(pose.x, Math.sin(t * 0.5) * 0.06 * (0.3 + moving), pose.z);
            g.rotation.set(Math.sin(t * 0.42) * 0.006 * (0.4 + moving), pose.heading, Math.sin(t * 0.31 + 1) * 0.008 * (0.4 + moving));
            g.updateMatrixWorld();

            top.copy(ship.funnelTop).applyMatrix4(g.matrixWorld);
            smoke.uniforms.uOrigin.value.copy(top);
            // vento aparente: fumaça fica para trás enquanto o navio anda
            smoke.uniforms.uVel.value.set(-Math.sin(pose.heading) * pose.speed * 0.8 + 0.5, 2.2 + moving * 0.6, -Math.cos(pose.heading) * pose.speed * 0.8 - 0.6);
            smoke.uniforms.uOpacity.value = 0.3 + moving * 0.3;
            const day = world.sky.daylight;
            smoke.uniforms.uColor.value.setRGB(0.3 * (0.4 + day), 0.275 * (0.4 + day), 0.25 * (0.4 + day));
            smoke.update(t);

            bow.set(0, 0, LAYOUT.kasatoLength / 2).applyMatrix4(g.matrixWorld);
            world.ocean.setWake(0, bow.x, bow.z, pose.heading, moving * 0.36, LAYOUT.kasatoBeam / 2, LAYOUT.kasatoLength);

            // pessoas: só anima perto da câmera (metade por frame)
            frame++;
            const close = camera.position.distanceToSquared(g.position) < 250 * 250;
            if (close !== this._close) {
                this._close = close;
                for (const h of people) h.object.visible = close; // longe, gente some (invisível a 300 m)
            }
            if (close) {
                const waving = t > 96 && t < 150;
                for (let i = frame & 1; i < people.length; i += 2) {
                    const h = people[i];
                    poseHuman(h, waving && h.waver ? 'wave' : h.mode, t + h.phase, 1);
                }
            }
        }
    };
}
