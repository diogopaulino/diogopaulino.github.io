/**
 * Céu cinematográfico de faroeste em Babylon.js com ciclo dia/noite e iluminação atmosférica.
 */

import { SKY_STOPS } from './config.js';

export function buildSky(BABYLON, scene) {
    const skyDome = BABYLON.MeshBuilder.CreateSphere('skyDome', { diameter: 800, segments: 32 }, scene);
    const skyMat = new BABYLON.StandardMaterial('mat_sky', scene);
    skyMat.backFaceCulling = false;
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMat.emissiveColor = new BABYLON.Color3(0.85, 0.45, 0.25);
    skyMat.specularColor = new BABYLON.Color3(0, 0, 0);
    skyDome.material = skyMat;

    const sunMesh = BABYLON.MeshBuilder.CreateDisc('sunDisc', { radius: 18, tessellation: 32 }, scene);
    const sunMat = new BABYLON.StandardMaterial('mat_sun_disc', scene);
    sunMat.emissiveColor = new BABYLON.Color3(1.0, 0.9, 0.6);
    sunMat.specularColor = new BABYLON.Color3(0, 0, 0);
    sunMesh.material = sunMat;

    return { skyDome, skyMat, sunMesh };
}

export function sampleSkyPalette(progress) {
    const p = Math.max(0, Math.min(1, progress));
    let a = SKY_STOPS[0];
    let b = SKY_STOPS[SKY_STOPS.length - 1];
    for (let i = 0; i < SKY_STOPS.length - 1; i++) {
        if (p >= SKY_STOPS[i].at && p <= SKY_STOPS[i + 1].at) {
            a = SKY_STOPS[i];
            b = SKY_STOPS[i + 1];
            break;
        }
    }
    const t = b.at === a.at ? 0 : (p - a.at) / (b.at - a.at);

    const lerpArr = (arrA, arrB) => [
        arrA[0] + (arrB[0] - arrA[0]) * t,
        arrA[1] + (arrB[1] - arrA[1]) * t,
        arrA[2] + (arrB[2] - arrA[2]) * t
    ];

    return {
        zenith: lerpArr(a.zenith, b.zenith),
        horizon: lerpArr(a.horizon, b.horizon),
        ground: lerpArr(a.ground, b.ground),
        sun: lerpArr(a.sun, b.sun),
        fog: lerpArr(a.fog, b.fog),
        sunDir: lerpArr(a.sunDir, b.sunDir),
        intensity: (a.lightIntensity || 2) + ((b.lightIntensity || 2) - (a.lightIntensity || 2)) * t
    };
}

export function updateSkyAndLights(BABYLON, skyObj, lights, progress) {
    const pal = sampleSkyPalette(progress);

    if (skyObj?.skyMat) {
        skyObj.skyMat.emissiveColor = new BABYLON.Color3(pal.horizon[0], pal.horizon[1], pal.horizon[2]);
    }

    if (lights?.hemi) {
        lights.hemi.diffuse = new BABYLON.Color3(pal.horizon[0], pal.horizon[1], pal.horizon[2]);
        lights.hemi.groundColor = new BABYLON.Color3(pal.ground[0], pal.ground[1], pal.ground[2]);
    }

    if (lights?.sun) {
        const dir = new BABYLON.Vector3(pal.sunDir[0], pal.sunDir[1], pal.sunDir[2]).normalize();
        lights.sun.direction = dir.scale(-1);
        lights.sun.diffuse = new BABYLON.Color3(pal.sun[0], pal.sun[1], pal.sun[2]);
        lights.sun.intensity = pal.intensity;

        if (skyObj?.sunMesh) {
            skyObj.sunMesh.position = dir.scale(350);
            skyObj.sunMesh.lookAt(new BABYLON.Vector3(0, 0, 0));
        }
    }
}
