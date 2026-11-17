/**
 * Tata, a tartaruguinha — o kit de criaturas não tem quelônio, então ela é
 * modelada aqui: uma única SkinnedMesh lisa (casco esculpido, plastrão, pescoço,
 * cabeça, quatro patas e cauda) com 8 ossos, mais os olhos.
 *
 * Mesma interface dos bichos de gfx/creature.js usada pelo jogo:
 *   { object, height, length, gaits, update(dt, { mode, speed, lookAt, groundFn }), dispose() }
 * Frente = +Z, pés em y = 0, medidas em metros (já no tamanho de livro infantil).
 *
 * CASCO — domo sobre contorno oval (mais largo atrás):
 *   p(u, v) = (a(u)·cos u·r(v),  y0 + H·sin(v·π/2)^0,85,  b·sin u·r(v)),   r(v) = cos(v·π/2)^0,72
 *   aba: nos 14 % de baixo o raio abre +9 % e a borda sobe um pouco.
 * Escudos: 5 vertebrais, 4+4 costais e 22 marginais são "sementes" em planta;
 * para cada vértice, F1/F2 = distâncias às duas sementes mais próximas:
 *   sulco   = 1 − smoothstep(0, 0,07, F2 − F1)        (linha entre escudos)
 *   relevo  = +bojo·(1 − (F1/0,3)²) − fundo·sulco + anéis de crescimento·sin(F1·70)
 * A cor por vértice segue o mesmo campo (centro âmbar, borda escura, sulco quase preto).
 *
 * ANDAR — rastejo em diagonais (DE+TD, depois DD+TE). Para cada pata, com fase φ:
 *   s = fract(φ/2π + defasagem);  apoio (s < 0,6): varre de +A a −A;  balanço: volta e levanta sin(π·s')
 *   cadência ω = 2π·v / passada, passada = 0,34·comprimento  →  gaits.walk.speed = 0,5 m/s
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};

const BONE = { root: 0, neck: 1, head: 2, fl: 3, fr: 4, bl: 5, br: 6, tail: 7 };

/** Acumulador de malha com skin (1 ou 2 ossos por vértice). */
class Builder {
    constructor() {
        this.pos = [];
        this.col = [];
        this.si = [];
        this.sw = [];
        this.idx = [];
    }

    vert(x, y, z, c, b0, b1 = b0, w1 = 0) {
        this.pos.push(x, y, z);
        this.col.push(c.r, c.g, c.b);
        this.si.push(b0, b1, 0, 0);
        this.sw.push(1 - w1, w1, 0, 0);
        return this.pos.length / 3 - 1;
    }

    quad(a, b, c, d) {
        this.idx.push(a, b, c, a, c, d);
    }

    /** Grade (rows × cols) já emitida a partir de `start`; wrap = fecha em u. */
    grid(start, rows, cols, wrap, flip = false) {
        const n = wrap ? cols : cols - 1;
        for (let j = 0; j < rows - 1; j++) {
            for (let i = 0; i < n; i++) {
                const a = start + j * cols + i;
                const b = start + j * cols + ((i + 1) % cols);
                const c = start + (j + 1) * cols + ((i + 1) % cols);
                const d = start + (j + 1) * cols + i;
                if (flip) this.quad(a, d, c, b);
                else this.quad(a, b, c, d);
            }
        }
    }

    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
        g.setIndex(this.idx);
        g.computeVertexNormals();
        return g;
    }
}

/** Sementes dos escudos, em planta normalizada (x/a, z/b). */
function scuteSeeds() {
    const s = [];
    for (const z of [-0.74, -0.38, 0, 0.38, 0.74]) s.push([0, z, 0]);
    for (const z of [-0.56, -0.19, 0.19, 0.56]) {
        s.push([0.5, z, 1]);
        s.push([-0.5, z, 1]);
    }
    for (let i = 0; i < 22; i++) {
        const a = (i + 0.5) / 22 * TAU;
        s.push([Math.cos(a) * 1.0, Math.sin(a) * 1.0, 2]);
    }
    return s;
}
const SEEDS = scuteSeeds();
const _f = [0, 0, 0];
function scuteField(nx, nz) {
    let f1 = 9;
    let f2 = 9;
    let kind = 0;
    for (const s of SEEDS) {
        // marginais contam "mais longe" para ficarem como uma faixa estreita na borda
        const d = Math.hypot(nx - s[0], nz - s[1]) * (s[2] === 2 ? 1.75 : 1);
        if (d < f1) {
            f2 = f1;
            f1 = d;
            kind = s[2];
        } else if (d < f2) f2 = d;
    }
    _f[0] = f1;
    _f[1] = f2;
    _f[2] = kind;
    return _f;
}

/**
 * Tubo liso ao longo de estações { p:[x,y,z], rx, ry, w (peso do 2º osso), c (cor) }.
 * Os anéis ficam perpendiculares ao caminho; as pontas fecham num vértice.
 */
function loft(B, stations, radial, b0, b1, colorFn = null) {
    const n = stations.length;
    const P = stations.map((s) => new THREE.Vector3(...s.p));
    const start = B.pos.length / 3;
    const t = new THREE.Vector3();
    const side = new THREE.Vector3();
    const up = new THREE.Vector3();
    const ref = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    for (let j = 0; j < n; j++) {
        t.copy(P[Math.min(n - 1, j + 1)]).sub(P[Math.max(0, j - 1)]).normalize();
        if (Math.abs(t.y) > 0.92) ref.set(0, 0, 1);
        else ref.set(0, 1, 0);
        side.crossVectors(ref, t).normalize();
        up.crossVectors(t, side).normalize();
        const s = stations[j];
        for (let i = 0; i < radial; i++) {
            const a = (i / radial) * TAU;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            // seção levemente achatada embaixo
            const ry = s.ry * (sa < 0 ? (s.flat ?? 1) : 1);
            c.copy(s.c);
            if (colorFn) colorFn(c, a, j / (n - 1));
            B.vert(P[j].x + side.x * ca * s.rx + up.x * sa * ry, P[j].y + side.y * ca * s.rx + up.y * sa * ry,
                P[j].z + side.z * ca * s.rx + up.z * sa * ry, c, b0, b1, s.w ?? 0);
        }
    }
    B.grid(start, n, radial, true, true);
    // tampas
    for (const [j, flip] of [[0, false], [n - 1, true]]) {
        const s = stations[j];
        const center = B.vert(P[j].x, P[j].y, P[j].z, s.c, b0, b1, s.w ?? 0);
        for (let i = 0; i < radial; i++) {
            const a = start + j * radial + i;
            const b = start + j * radial + ((i + 1) % radial);
            if (flip) B.idx.push(center, b, a);
            else B.idx.push(center, a, b);
        }
    }
}

export function createTurtle({ scale = 1 } = {}) {
    const B = new Builder();
    // ---------- medidas ----------
    const A = 0.19; // meia-largura do casco
    const Bz = 0.235; // meio-comprimento
    const H = 0.165; // altura do domo
    const Y0 = 0.085; // altura da aba (as patas erguem o corpo)

    const cShellA = new THREE.Color(0xc79a4a); // âmbar do centro do escudo
    const cShellB = new THREE.Color(0x5d4a26); // borda do escudo
    const cGroove = new THREE.Color(0x231a0e);
    const cRim = new THREE.Color(0x8a7434);
    const cBelly = new THREE.Color(0xe7d39a);
    const cSkin = new THREE.Color(0x6f8f3a);
    const cSkinDark = new THREE.Color(0x3f5a26);
    const cStripe = new THREE.Color(0xe8d552);
    const c = new THREE.Color();

    const outline = (u) => {
        // oval mais larga atrás (z < 0), com leve entalhe sobre o pescoço
        const s = Math.sin(u);
        const wide = 1 + 0.07 * -s;
        const notch = 1 - 0.05 * Math.exp(-((u - Math.PI / 2) ** 2) / 0.05);
        return [A * wide * Math.cos(u), Bz * s * notch];
    };

    // ---------- carapaça ----------
    {
        const U = 104;
        const V = 40;
        const start = B.pos.length / 3;
        for (let j = 0; j < V; j++) {
            const v = j / (V - 1);
            const r = Math.pow(Math.cos(v * Math.PI / 2), 0.72);
            const flare = 1 + 0.09 * (1 - sstep(0, 0.14, v));
            for (let i = 0; i < U; i++) {
                const u = (i / U) * TAU;
                const [ox, oz] = outline(u);
                let x = ox * r * flare;
                let z = oz * r * flare;
                let y = Y0 + H * Math.pow(Math.sin(v * Math.PI / 2), 0.85) + 0.012 * (1 - sstep(0, 0.1, v));
                // domo um pouco mais alto atrás do centro
                y += 0.012 * r * (1 - r) * 4 * (-z / Bz);
                const f = scuteField(x / (A * 1.09), z / (Bz * 1.09));
                const groove = 1 - sstep(0, 0.07, f[1] - f[0]);
                const dome = clamp(1 - (f[0] / 0.3) ** 2);
                const ring = Math.sin(f[0] * 70) * 0.0007 * (1 - groove);
                const d = 0.0075 * dome * (f[2] === 2 ? 0.45 : 1) - 0.006 * groove + ring;
                // desloca pela normal aproximada do domo (radial + para cima)
                const nl = Math.hypot(x / A, (y - Y0) / H * 1.2, z / Bz) || 1;
                x += (x / A / nl) * d;
                y += ((y - Y0) / H * 1.2 / nl) * d;
                z += (z / Bz / nl) * d;
                c.copy(cShellB).lerp(cShellA, Math.pow(dome, 1.6) * (0.75 + 0.25 * Math.sin(f[0] * 70)));
                if (f[2] === 2) c.lerp(cRim, 0.55);
                c.lerp(cGroove, groove * 0.9);
                B.vert(x, y, z, c, BONE.root);
            }
        }
        B.grid(start, V, U, true, true);
    }

    // ---------- plastrão (barriga) ----------
    {
        const U = 104;
        const R = 7;
        const start = B.pos.length / 3;
        for (let j = 0; j < R; j++) {
            const k = 1 - j / (R - 1); // 1 na borda → 0 no centro
            for (let i = 0; i < U; i++) {
                const u = (i / U) * TAU;
                const [ox, oz] = outline(u);
                const x = ox * 1.09 * k;
                const z = oz * 1.09 * k;
                const y = Y0 + 0.012 * sstep(0.82, 1, k) - 0.03 * (1 - k * k) - 0.004;
                c.copy(cBelly).lerp(cShellB, sstep(0.86, 1, k) * 0.8);
                // placas da barriga: linha central e três travessas
                const line = Math.exp(-((x / 0.006) ** 2)) + Math.exp(-((((Math.abs(z) % 0.11) - 0.055) / 0.006) ** 2));
                c.lerp(cShellB, clamp(line) * 0.5 * (1 - sstep(0.8, 1, k)));
                B.vert(x, y, z, c, BONE.root);
            }
        }
        B.grid(start, R, U, true, false);
    }

    // ---------- pescoço + cabeça ----------
    const skinFn = (base) => (col, a, k) => {
        // listras amarelas longitudinais, barriga clara
        const stripe = sstep(0.55, 0.85, Math.cos(a * 5 + 0.6));
        col.copy(base).lerp(cStripe, stripe * 0.75);
        col.lerp(cBelly, sstep(-0.2, -0.85, Math.sin(a)) * 0.7);
        col.lerp(cSkinDark, 0.25 * (1 - k));
    };
    const neckAt = [0, 0.118, Bz - 0.07];
    const headAt = [0, 0.168, Bz + 0.085];
    loft(B, [
        { p: [0, 0.112, Bz - 0.11], rx: 0.03, ry: 0.028, c: cSkinDark, w: 0 },
        { p: [0, 0.118, Bz - 0.05], rx: 0.036, ry: 0.033, c: cSkin, w: 0 },
        { p: [0, 0.132, Bz + 0.0], rx: 0.034, ry: 0.031, c: cSkin, w: 0.15 },
        { p: [0, 0.15, Bz + 0.045], rx: 0.033, ry: 0.031, c: cSkin, w: 0.5 },
        { p: [0, 0.166, Bz + 0.08], rx: 0.04, ry: 0.036, c: cSkin, w: 0.95 },
        { p: [0, 0.176, Bz + 0.112], rx: 0.05, ry: 0.043, c: cSkin, w: 1, flat: 0.85 },
        { p: [0, 0.178, Bz + 0.142], rx: 0.049, ry: 0.041, c: cSkin, w: 1, flat: 0.82 },
        { p: [0, 0.174, Bz + 0.168], rx: 0.04, ry: 0.033, c: cSkin, w: 1, flat: 0.8 },
        { p: [0, 0.168, Bz + 0.187], rx: 0.027, ry: 0.023, c: cSkin, w: 1 },
        { p: [0, 0.163, Bz + 0.198], rx: 0.013, ry: 0.012, c: cSkinDark, w: 1 }
    ], 20, BONE.neck, BONE.head, skinFn(cSkin));

    // ---------- patas ----------
    const legs = [
        { bone: BONE.fl, at: [0.125, 0.085, 0.135], out: [0.105, -0.062, 0.085], front: true, side: 1 },
        { bone: BONE.fr, at: [-0.125, 0.085, 0.135], out: [-0.105, -0.062, 0.085], front: true, side: -1 },
        { bone: BONE.bl, at: [0.13, 0.085, -0.13], out: [0.09, -0.062, -0.075], front: false, side: 1 },
        { bone: BONE.br, at: [-0.13, 0.085, -0.13], out: [-0.09, -0.062, -0.075], front: false, side: -1 }
    ];
    for (const L of legs) {
        const [ax, ay, az] = L.at;
        const [ox, oy, oz] = L.out;
        const P = (k, lift = 0) => [ax + ox * k, ay + oy * Math.pow(k, 1.5) + lift, az + oz * k];
        loft(B, [
            { p: [ax - ox * 0.45, ay + 0.012, az - oz * 0.45], rx: 0.026, ry: 0.026, c: cSkinDark },
            { p: P(0.0), rx: 0.04, ry: 0.035, c: cSkin },
            { p: P(0.3), rx: 0.039, ry: 0.033, c: cSkin },
            { p: P(0.6), rx: 0.035, ry: 0.031, c: cSkin },
            { p: P(0.85), rx: 0.036, ry: 0.028, c: cSkin },
            // pé: nadadeira achatada apoiada no chão
            { p: [ax + ox * 1.0, 0.024, az + oz * 1.0 + (L.front ? 0.012 : -0.008)], rx: 0.044, ry: 0.022, c: cSkin },
            { p: [ax + ox * 1.14, 0.013, az + oz * 1.14 + (L.front ? 0.03 : -0.02)], rx: 0.04, ry: 0.012, c: cSkinDark },
            { p: [ax + ox * 1.24, 0.008, az + oz * 1.24 + (L.front ? 0.042 : -0.03)], rx: 0.02, ry: 0.007, c: cSkinDark }
        ], 14, L.bone, L.bone, (col, a, k) => {
            col.lerp(cStripe, sstep(0.6, 0.9, Math.cos(a * 4)) * 0.45 * (1 - k));
            col.lerp(cSkinDark, sstep(0.7, 1, k) * 0.5);
        });
    }

    // ---------- cauda ----------
    loft(B, [
        { p: [0, 0.092, -Bz + 0.06], rx: 0.022, ry: 0.02, c: cSkinDark },
        { p: [0, 0.086, -Bz - 0.0], rx: 0.02, ry: 0.018, c: cSkin },
        { p: [0, 0.072, -Bz - 0.045], rx: 0.013, ry: 0.012, c: cSkin },
        { p: [0, 0.06, -Bz - 0.08], rx: 0.005, ry: 0.005, c: cSkinDark }
    ], 10, BONE.tail, BONE.tail);

    const geometry = B.build();
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius *= 1.6;

    // ---------- esqueleto ----------
    const mk = (name, x, y, z) => {
        const b = new THREE.Bone();
        b.name = name;
        b.position.set(x, y, z);
        return b;
    };
    const root = mk('root', 0, 0.1, 0);
    const neck = mk('neck', neckAt[0], neckAt[1] - 0.1, neckAt[2]);
    const head = mk('head', headAt[0] - neckAt[0], headAt[1] - neckAt[1], headAt[2] - neckAt[2]);
    const legBones = legs.map((L, i) => mk(`leg${i}`, L.at[0], L.at[1] - 0.1, L.at[2]));
    const tail = mk('tail', 0, 0.09 - 0.1, -Bz + 0.03);
    root.add(neck, ...legBones, tail);
    neck.add(head);
    const bones = [root, neck, head, ...legBones, tail];

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0, envMapIntensity: 0.9 });
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = 'tata';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));

    // olhos: duas calotas escuras e brilhantes presas ao osso da cabeça
    const eyeGeo = new THREE.SphereGeometry(0.0125, 14, 10);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.06, metalness: 0, envMapIntensity: 1.6 });
    for (const s of [1, -1]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(s * 0.039, 0.178 + 0.012 - headAt[1], Bz + 0.148 - headAt[2]);
        eye.scale.set(0.7, 1, 1);
        head.add(eye);
    }

    const object = new THREE.Group();
    object.name = 'turtle';
    object.add(mesh);
    object.scale.setScalar(scale);

    const length = (Bz * 2 + 0.2 + 0.08) * scale;
    const height = (Y0 + H) * scale;
    const stride = 0.34 * length;
    const gaits = {
        walk: { speed: 0.5, stride, duty: 0.6 },
        trot: { speed: 1.1, stride, duty: 0.6 },
        run: { speed: 2.0, stride, duty: 0.6 }
    };

    const st = { phase: 0, time: 0, move: 0, sit: 0, swim: 0, lookY: 0, lookP: 0 };
    const _inv = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    // defasagens do rastejo: diagonais juntas
    const OFF = [0, 0.5, 0.5, 0];

    function update(dt, s = {}) {
        const mode = s.mode || 'idle';
        const moving = mode === 'walk' || mode === 'trot' || mode === 'run';
        const swimming = mode === 'swim';
        const v = s.speed ?? (gaits[mode]?.speed || 0);
        dt = Math.min(dt, 0.1);
        st.time += dt;
        const k = 1 - Math.exp(-7 * dt);
        st.move += ((moving || swimming ? 1 : 0) - st.move) * k;
        st.sit += ((mode === 'sit' || mode === 'sleep' ? 1 : 0) - st.sit) * k;
        st.swim += ((swimming ? 1 : 0) - st.swim) * k;
        st.phase += dt * TAU * (swimming ? 1.1 : Math.max(0.35, v) / stride);
        const t = st.time;

        // olhar para o alvo (mundo → espaço da malha)
        let ty = 0;
        let tp = 0;
        if (s.lookAt) {
            _inv.copy(mesh.matrixWorld).invert();
            _p.copy(s.lookAt).applyMatrix4(_inv);
            ty = clamp(Math.atan2(_p.x, _p.z - Bz), -0.9, 0.9);
            tp = clamp(Math.atan2(_p.y - 0.16, Math.hypot(_p.x, _p.z - Bz)), -0.3, 0.6);
        }
        st.lookY += (ty - st.lookY) * (1 - Math.exp(-5 * dt));
        st.lookP += (tp - st.lookP) * (1 - Math.exp(-5 * dt));

        // corpo: balanço lateral ao andar, respiração parado, desce ao sentar
        const sway = Math.sin(st.phase) * 0.06 * st.move;
        root.position.set(0, 0.1 + Math.abs(Math.sin(st.phase)) * 0.006 * st.move - 0.034 * st.sit + Math.sin(t * 1.7) * 0.002, 0);
        root.rotation.set(Math.sin(t * 1.3) * 0.012 - 0.05 * st.swim, sway * 0.5, sway);

        // pescoço e cabeça: recolhe ao sentar, espicha ao andar, olha em volta parado
        const curious = Math.sin(t * 0.7) * 0.3 * (1 - st.move) * (1 - st.sit);
        neck.position.z = neckAt[2] - 0.05 * st.sit + 0.012 * st.move;
        neck.rotation.set(-st.lookP * 0.5 - 0.1 * st.move + 0.25 * st.sit, st.lookY * 0.55 + curious * 0.5 - sway * 0.4, 0);
        head.rotation.set(-st.lookP * 0.5 + 0.12 * st.move + Math.sin(t * 2.1) * 0.03, st.lookY * 0.45 + curious * 0.5, 0);

        // patas
        for (let i = 0; i < 4; i++) {
            const L = legs[i];
            const b = legBones[i];
            const ph = (((st.phase / TAU + OFF[i]) % 1) + 1) % 1;
            let sweep;
            let lift = 0;
            if (ph < 0.6) sweep = lerp(1, -1, ph / 0.6);
            else {
                const q = (ph - 0.6) / 0.4;
                sweep = lerp(-1, 1, q * q * (3 - 2 * q));
                lift = Math.sin(Math.PI * q);
            }
            const amp = 0.55 * st.move;
            // nadar: remadas largas e juntas na frente, alternadas atrás
            const row = Math.sin(st.phase + (L.front ? 0 : Math.PI * 0.5) + (L.front ? 0 : (L.side > 0 ? 0 : Math.PI))) * 0.7 * st.swim;
            b.rotation.set(
                0,
                L.side * (sweep * amp * (1 - st.swim) + row) * (L.front ? 1 : 1),
                -L.side * (lift * 0.4 * st.move * (1 - st.swim) + 0.35 * st.sit + 0.25 * st.swim)
            );
            b.position.set(L.at[0] * (1 - 0.3 * st.sit), L.at[1] - 0.1 + 0.02 * st.sit, L.at[2] * (1 - 0.15 * st.sit));
        }
        tail.rotation.set(0.1 * st.sit, Math.sin(t * 3.1) * 0.35 + sway * 2, 0);
    }
    update(0.016, { mode: 'idle' });

    return {
        object, mesh, height, length, scale, gaits,
        hipHeight: 0.085 * scale,
        modes: ['idle', 'walk', 'trot', 'run', 'sit', 'sleep', 'alert', 'eat', 'swim'],
        triangles: geometry.index.count / 3,
        update,
        dispose() {
            geometry.dispose();
            material.dispose();
            eyeGeo.dispose();
            eyeMat.dispose();
        }
    };
}
