/**
 * Vida na orla: pedestres e ciclistas esculpidos, cães, carros, guarda-sóis e gaivotas.
 */

import * as THREE from 'three';
import { ORLA_LENGTH, ZONES, CANALS, WALK } from './config.js';
import { seeded } from './utils.js';
import {
    createSculptedHuman,
    animateSculptedHuman,
    createSculptedBird,
    createSculptedDog,
    animateSculptedDog,
    createBeachCar,
    createBeachUmbrella,
    metalMaterial,
    createSpokedWheel
} from '../../shared/realism.js';

function makeBicycle(frameColor = 0xc43c28) {
    const bike = new THREE.Group();
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.85 });
    const frameMat = metalMaterial(frameColor, { roughness: 0.35, metalness: 0.7 });
    const chromeMat = metalMaterial(0xd8dde4, { roughness: 0.25, metalness: 0.85 });

    for (const z of [-0.52, 0.52]) {
        const wheel = createSpokedWheel({
            radius: 0.34,
            width: 0.08,
            spokes: 10,
            rimMaterial: tireMat,
            hubMaterial: chromeMat
        });
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(0, 0.34, z);
        bike.add(wheel);
    }

    const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.88, 8), frameMat);
    topTube.rotation.x = Math.PI / 2;
    topTube.position.set(0, 0.68, 0);

    const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.82, 8), frameMat);
    downTube.rotation.x = 0.85;
    downTube.position.set(0, 0.52, 0.14);

    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), frameMat);
    seatPost.rotation.x = -0.22;
    seatPost.position.set(0, 0.58, -0.22);

    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.64, 8), chromeMat);
    fork.rotation.x = -0.24;
    fork.position.set(0, 0.58, 0.44);

    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8), chromeMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.88, 0.38);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.24), tireMat);
    saddle.position.set(0, 0.84, -0.28);

    bike.add(topTube, downTube, seatPost, fork, handlebar, saddle);
    return bike;
}

export function createLife(quality) {
    const root = new THREE.Group();
    root.name = 'life';
    const rand = seeded(0x11fe);
    const people = [];
    const bikes = [];
    const birds = [];
    const dogs = [];
    const cars = [];
    const umbrellas = [];

    const shirts = [0x2a5f8f, 0xc45c2a, 0x3d7a45, 0x6b4a8a, 0xd99b26, 0x2c6e78, 0xe8e4dc, 0xf0f0f2];
    const shorts = [0x262b34, 0x3d4856, 0x4a3c30, 0x1e242c, 0xd8c8a0];
    const skins = [0xd4a574, 0xe0b892, 0x9c6e49, 0x6b462b, 0xc49a72];
    const carColors = [0xc43c28, 0x2a5f8f, 0xf2f0ea, 0x1e242c, 0xd99b26, 0x3d7a45];
    const umbrellaColors = [0xc43c28, 0x2a6a8c, 0xe8dfca, 0x3d7a45, 0xd99b26, 0xf0f0f2];

    for (let i = 0; i < quality.peopleCount; i++) {
        const onBike = rand() > 0.72;
        const human = createSculptedHuman({
            style: rand() > 0.88 ? 'child' : 'human',
            skin: skins[(rand() * skins.length) | 0],
            hair: rand() > 0.3 ? 0x241810 : 0x6e4c28,
            shirt: shirts[(rand() * shirts.length) | 0],
            pants: shorts[(rand() * shorts.length) | 0],
            hat: onBike ? 0x286494 : (rand() > 0.78 ? 0xe8dfca : null),
            detailedFace: quality.id === 'high' && i < 8,
            scale: rand() > 0.88 ? 0.78 : 0.96
        });

        let actor = human;
        if (onBike) {
            actor = new THREE.Group();
            const bikeMesh = makeBicycle(shirts[(i + 2) % shirts.length]);
            human.position.set(0, 0.14, -0.1);
            const rig = human.userData.rig;
            if (rig) {
                rig.torso.rotation.x = 0.38;
                rig.leftArm.rotation.x = -0.95;
                rig.rightArm.rotation.x = -0.95;
            }
            actor.add(bikeMesh, human);
            actor.userData.human = human;
        }

        const x = (rand() - 0.5) * (ORLA_LENGTH - 40);
        const z = onBike
            ? ZONES.bikePath + (rand() - 0.5) * 0.8
            : WALK.pathZ + (rand() - 0.5) * WALK.pathHalfWidth * 1.4;
        actor.position.set(x, 0.04, z);
        actor.userData = {
            ...actor.userData,
            speed: (onBike ? 13 : 3.8) * (0.75 + rand() * 0.5),
            dir: rand() > 0.5 ? 1 : -1,
            onBike,
            phase: rand() * Math.PI * 2
        };
        root.add(actor);
        (onBike ? bikes : people).push(actor);
    }

    // Cães na areia / calçadão
    const dogCount = quality.id === 'low' ? 3 : quality.id === 'medium' ? 7 : 12;
    const coats = [0xc4a06a, 0x3a2a20, 0xe8e0d4, 0x8a6a48, 0x2c3038];
    for (let i = 0; i < dogCount; i++) {
        const dog = createSculptedDog({
            coat: coats[i % coats.length],
            scale: 0.85 + rand() * 0.35
        });
        dog.position.set(
            (rand() - 0.5) * (ORLA_LENGTH - 60),
            0.02,
            ZONES.sandInner + rand() * (ZONES.sandOuter - ZONES.sandInner - 4)
        );
        dog.userData = {
            ...dog.userData,
            speed: 4 + rand() * 5,
            dir: rand() > 0.5 ? 1 : -1,
            phase: rand() * Math.PI * 2,
            baseZ: dog.position.z
        };
        root.add(dog);
        dogs.push(dog);
    }

    // Tráfego leve na avenida Bartolomeu de Gusmão
    const carCount = quality.id === 'low' ? 3 : quality.id === 'medium' ? 7 : 12;
    for (let i = 0; i < carCount; i++) {
        const car = createBeachCar({
            body: carColors[i % carColors.length],
            scale: 1.05
        });
        const lane = i % 2 === 0 ? -1 : 1;
        car.position.set(
            (rand() - 0.5) * (ORLA_LENGTH - 40),
            0,
            ZONES.avenue - 1.5 + lane * 2.2
        );
        car.rotation.y = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.userData = {
            speed: 16 + rand() * 10,
            dir: lane > 0 ? 1 : -1,
            lane
        };
        root.add(car);
        cars.push(car);
    }

    // Guarda-sóis na faixa de areia (José Menino → Ponta)
    const umbCount = quality.id === 'low' ? 8 : quality.id === 'medium' ? 16 : 26;
    for (let i = 0; i < umbCount; i++) {
        const umb = createBeachUmbrella({
            canopy: umbrellaColors[i % umbrellaColors.length],
            scale: 0.95 + rand() * 0.25
        });
        let x = (rand() - 0.5) * (ORLA_LENGTH - 50);
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width + 4)) x += 8;
        umb.position.set(x, 0, ZONES.sandInner + 2 + rand() * 8);
        umb.rotation.y = rand() * Math.PI * 2;
        root.add(umb);
        umbrellas.push(umb);
    }

    // Gaivotas esculpidas com asas articuladas
    const birdCount = quality.id === 'low' ? 6 : 14;
    for (let i = 0; i < birdCount; i++) {
        const mesh = createSculptedBird({
            wingspan: 1.4,
            bodyColor: 0xf4f4f0,
            tipColor: 0x2c3038
        });
        mesh.position.set(
            (rand() - 0.5) * ORLA_LENGTH,
            8 + rand() * 18,
            ZONES.sandOuter + rand() * 40
        );
        mesh.userData = {
            ...mesh.userData,
            speed: 7 + rand() * 8,
            radius: 20 + rand() * 40,
            baseX: mesh.position.x,
            baseZ: mesh.position.z,
            phase: rand() * Math.PI * 2,
            height: mesh.position.y
        };
        root.add(mesh);
        birds.push(mesh);
    }

    function update(t, dt) {
        for (const p of people) {
            const u = p.userData;
            p.position.x += u.dir * u.speed * dt;
            if (p.position.x > ORLA_LENGTH * 0.48) u.dir = -1;
            if (p.position.x < -ORLA_LENGTH * 0.48) u.dir = 1;
            for (const c of CANALS) {
                if (Math.abs(p.position.x - c.x) < c.width + 1.5) {
                    p.position.x += u.dir * 0.4;
                }
            }
            p.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            animateSculptedHuman(p, t * u.speed * 1.6 + u.phase, 0.52);
        }
        for (const b of bikes) {
            const u = b.userData;
            b.position.x += u.dir * u.speed * dt;
            if (b.position.x > ORLA_LENGTH * 0.48) u.dir = -1;
            if (b.position.x < -ORLA_LENGTH * 0.48) u.dir = 1;
            b.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            const rig = u.human?.userData?.rig;
            if (rig) {
                const pedal = Math.sin(t * u.speed * 1.1 + u.phase) * 0.48;
                rig.leftLeg.rotation.x = -0.35 + pedal;
                rig.rightLeg.rotation.x = -0.35 - pedal;
            }
        }
        for (const dog of dogs) {
            const u = dog.userData;
            dog.position.x += u.dir * u.speed * dt;
            if (dog.position.x > ORLA_LENGTH * 0.45) u.dir = -1;
            if (dog.position.x < -ORLA_LENGTH * 0.45) u.dir = 1;
            dog.position.z = u.baseZ + Math.sin(t * 0.7 + u.phase) * 1.5;
            dog.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            animateSculptedDog(dog, t * u.speed * 2.2 + u.phase, 0.5);
        }
        for (const car of cars) {
            const u = car.userData;
            car.position.x += u.dir * u.speed * dt;
            if (car.position.x > ORLA_LENGTH * 0.48) car.position.x = -ORLA_LENGTH * 0.48;
            if (car.position.x < -ORLA_LENGTH * 0.48) car.position.x = ORLA_LENGTH * 0.48;
            if (car.userData.lightMat) {
                car.userData.lightMat.emissiveIntensity = 0.35 + Math.sin(t * 8) * 0.05;
            }
        }
        for (const bird of birds) {
            const u = bird.userData;
            const a = t * 0.35 + u.phase;
            bird.position.x = u.baseX + Math.cos(a) * u.radius;
            bird.position.z = u.baseZ + Math.sin(a) * u.radius * 0.4;
            bird.position.y = u.height + Math.sin(a * 2) * 1.5;
            bird.rotation.y = -a + Math.PI;
            const flap = Math.sin(t * u.speed + u.phase) * 0.52;
            if (u.leftWing) u.leftWing.rotation.z = flap;
            if (u.rightWing) u.rightWing.rotation.z = -flap;
        }
        // Guarda-sóis: leve balanço no vento
        for (let i = 0; i < umbrellas.length; i++) {
            umbrellas[i].rotation.z = Math.sin(t * 0.8 + i) * 0.03;
        }
    }

    return { root, update };
}
