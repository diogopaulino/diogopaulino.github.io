/**
 * Elenco: receitas de `createHero` / `createCreature` (labs/shared/gfx) para cada
 * personagem da história. Dico é o herói (detail 2); guardas e amigos são NPCs (detail 1).
 */
import { createHero } from '../../../shared/gfx/hero.js';
import { createCreature } from '../../../shared/gfx/creature.js';

export const CAST = {
    /* Dico: guerreiro de couro, capa curta vermelha — o mesmo figurino na sala e na aventura. */
    dico: {
        build: 0.6, hair: 0x3a2616, hairStyle: 'short', beard: 'full', top: 'tunic', topColor: 0x7a5a3a, trimColor: 0xc9a23a,
        bottom: 'pants', bottomColor: 0x2e2a26, shoes: 'tall', shoeColor: 0x2a1c14, armor: 'leather', gloves: 'leather',
        cape: 'short', capeColor: 0x8a1c1c, belt: 0x3a2618, detail: 2
    },
    ravi: { preset: 'villageBoy', hat: 'none', topColor: 0xe6dcc0, vest: 0x3f5a7a, detail: 2 },
    camila: { preset: 'princess', detail: 2 },
    guard: { preset: 'guard', detail: 1 },
    fatGuard: { preset: 'guard', fat: 0.75, build: 0.1, hat: 'none', hairStyle: 'balding', beard: 'full', tabard: 0x6a2a22, detail: 1 },
    archer: { preset: 'guard', hat: 'none', hood: 'up', cape: 'short', capeColor: 0x2a3a2a, tabard: 0x2f4a32, build: 0.1, detail: 1 },
    friends: [
        { preset: 'pirate', eyepatch: false, detail: 1 },
        { preset: 'peasant', hat: 'bandana', hatColor: 0x2f4a6a, topColor: 0x8a5a3a, build: 0.5, detail: 1 },
        { preset: 'elder', topColor: 0x3f5a6a, hat: 'cap', hatColor: 0x3a342c, detail: 1 }
    ]
};

export function makeHero(key, extra = {}) {
    const spec = typeof key === 'string' ? CAST[key] : key;
    return createHero({ ...spec, ...extra });
}

export function makeFriend(i) {
    return createHero(CAST.friends[i % CAST.friends.length]);
}

export { createCreature };

/**
 * Arco longo para os arqueiros: vara curva (tubo sobre spline) e corda.
 * Fica na mão esquerda (socket handL: +Y sai pelo polegar, X corre pelo antebraço).
 */
export async function giveBow(hero, THREE) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10 - 0.5;
        pts.push(new THREE.Vector3(0, t * 1.5, 0.22 * (1 - 4 * t * t) - 0.11));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const stave = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.016, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.7 }));
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.9 }));
    string.position.z = -0.11;
    const bow = new THREE.Group();
    bow.add(stave, string);
    stave.castShadow = true;
    hero.attach('handL', bow, { position: [0, 0, 0.02] });
    return bow;
}
