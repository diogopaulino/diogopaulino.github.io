/** Deterministic world and riding rules. Distances are metres; time is seconds. */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function hash(x, z) {
    const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
    return n - Math.floor(n); // JS remainder is negative for negative coordinates.
}
export function noise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), sx), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), sx), sz) * 2 - 1;
}
export function fbm(x, z, octaves = 4) {
    let value = 0, amplitude = 0.5;
    for (let i = 0; i < octaves; i++) { value += noise(x, z) * amplitude; x *= 2.03; z *= 2.03; amplitude *= 0.5; }
    return value;
}
export const roadX = z => 24 * Math.sin(z * 0.007) + 12 * Math.sin(z * 0.021);
export const roadDistance = (x, z) => Math.abs(x - roadX(z));
const rawHeight = (x, z) => 8 + fbm(x * 0.004, z * 0.004) * 30 + fbm(x * 0.025, z * 0.025, 3) * 3;
export const LANDMARKS = [
    { name: 'Acampamento Aurora', z: 24, offset: -15, kind: 'camp', story: 'Uma carta. Seis destinos. Um último favor.', action: 'Aceitar a entrega', reward: 0 },
    { name: 'Correio de Santa Luz', z: 165, offset: 16, kind: 'town', story: 'A carta chegou. O carteiro precisa de ajuda na estrada.', action: 'Entregar a carta', reward: 25 },
    { name: 'Passagem dos Corvos', z: 340, offset: -10, kind: 'outpost', story: 'Bandidos tomaram a passagem. Abra caminho.', action: 'Inspecionar a passagem', reward: 40, enemies: 3 },
    { name: 'Rancho Boa Esperança', z: 530, offset: 18, kind: 'ranch', story: 'O rancho está isolado. Leve as provisões ao norte.', action: 'Recolher provisões', reward: 35 },
    { name: 'Mina do Sol Poente', z: 745, offset: -12, kind: 'mine', story: 'A última emboscada guarda a entrada da mina.', action: 'Entregar as provisões', reward: 60, enemies: 4 },
    { name: 'Refúgio da Fronteira', z: 970, offset: 12, kind: 'camp', story: 'O oeste se lembra de quem cumpre a palavra.', action: 'Concluir a jornada', reward: 100 }
].map((p, id) => ({ ...p, id, x: roadX(p.z) + p.offset }));
export function terrainHeight(x, z) {
    let y = rawHeight(x, z);
    // Blend a 6 m trail into the hills; flatten each settlement to avoid floating buildings.
    const trail = 1 - clamp((roadDistance(x, z) - 3) / 13, 0, 1);
    y = lerp(y, rawHeight(roadX(z), z), trail * trail * (3 - 2 * trail));
    for (const p of LANDMARKS) {
        const t = 1 - clamp((Math.hypot(x - p.x, z - p.z) - 15) / 16, 0, 1);
        if (t > 0) y = lerp(y, rawHeight(p.x, p.z), t * t * (3 - 2 * t));
    }
    return y;
}
export function biomeAt(x, z) {
    if (z > 630 && z < 865) return 'Cânion Encarnado';
    if (x < -100) return 'Serra do Corvo';
    if (z > 880) return 'Fronteira do Norte';
    return z > 420 ? 'Vale da Esperança' : 'Pradaria Dourada';
}
export function freshPlayer() {
    return { x: roadX(24), z: 20, yaw: 0, yawRate: 0, speed: 0, distance: 0, stamina: 100, health: 100, focus: 100, ammo: 6, reload: 0, cooldown: 0, cruise: false, tired: false, money: 0, kills: 0, phase: 0 };
}
/** Montaria — física por andaduras (cavalo de sela ~500 kg com cavaleiro). Unidades: m, s, rad.
 *
 * Andaduras de referência (m/s): passo 1,7 · trote 4 · galope curto 7 · galope 11 · disparada 14
 *   (≈ 6 · 14 · 25 · 40 · 50 km/h). Um puro-sangue de corrida chega a ~17 m/s sem carga; um
 *   cavalo de lida com cavaleiro e alforjes sustenta 11–14 m/s por pouco tempo.
 * Alvo de velocidade: v* = galope × rédea (analógico proporcional) ou disparada com espora;
 *   marcha automática = 6,5 m/s; rédea para trás freia e, quase parado, recua a 0,8 m/s.
 * Aceleração limitada por potência: a ≤ min(A₀, (P/m)/v) com A₀ = 3 m/s² e P/m = 18 W/kg
 *   → 0→40 km/h em ~5 s e 40→50 km/h em ~2,5 s. Rédea para trás: −5,5 m/s²; soltar: −3 m/s².
 * Rampa: na subida a aceleração perde g·sinθ·0,5 (mínimo 0,25 m/s², o cavalo nunca escorrega
 *   para trás) e o alvo cai 60 % por unidade de inclinação (piso de 35 %).
 * Curva: ω* = rédea × min(ω₀, a_lat/|v|), ω₀ = 1,4 rad/s (pivô sobre os posteriores) e
 *   a_lat = 5,5 m/s² (~0,56 g). A guinada tem inércia (τ = 0,15 s) e curvar forte custa
 *   velocidade (perda = 0,08·|ω|·v por segundo).
 * Colisão: círculos (raio + 0,65 m). O cavalo é empurrado para fora, desvia sozinho para a
 *   tangente (cavalo não se joga contra pedra) e perde velocidade conforme o ângulo de choque:
 *   de frente freia 12 m/s². `impact` (0–1) informa o choque para câmera e som.
 * Passo fixo interno ≤ 1/60 s, então o resultado não muda com a taxa de quadros.
 * Vigor do cavalo: −17/s em disparada, +10/s abaixo de 5 m/s, +5/s até 10 m/s, −1/s a galope.
 * Exaustão com histerese: a espora só volta a funcionar com 28 % de vigor.
 */
export const HORSE = { walk: 1.7, trot: 4, canter: 7, gallop: 11, sprint: 14, cruise: 6.5, back: 0.8, accel: 3, power: 18, brake: 5.5, coast: 3, yawRate: 1.4, lateral: 5.5, yawTau: 0.15, radius: 0.65 };
const STEP = 1 / 60;
export function stepRiding(p, input, dt, colliders = []) {
    const throttle = clamp(input.throttle, -1, 1), steer = clamp(input.steer, -1, 1);
    if (p.stamina <= 1) p.tired = true;
    if (p.stamina >= 28) p.tired = false;
    const sprint = input.sprint && !p.tired && throttle >= 0;
    const result = { obstacle: false, grade: 0, impact: 0 };
    if (!Number.isFinite(p.yawRate)) p.yawRate = 0;
    const steps = Math.max(1, Math.ceil(dt / STEP - 1e-6)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
        const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw), y = terrainHeight(p.x, p.z);
        const grade = (terrainHeight(p.x + sy * 2, p.z + cy * 2) - y) / 2, sinT = grade / Math.sqrt(1 + grade * grade);
        result.grade = grade;
        // velocidade-alvo pela rédea; recuar só quando quase parado
        let target = throttle < -0.1 ? (p.speed < 0.3 ? -HORSE.back * -throttle : 0)
            : sprint ? HORSE.sprint : throttle > 0.1 ? HORSE.gallop * throttle : p.cruise ? HORSE.cruise : 0;
        if (target > 0) target *= clamp(1 - Math.max(0, grade) * 0.6, 0.35, 1);
        const error = target - p.speed;
        let a;
        if (error >= 0) a = Math.min(error * 2.5, Math.max(0.25, Math.min(HORSE.accel, HORSE.power / Math.max(Math.abs(p.speed), 1)) - 9.81 * Math.max(0, sinT) * 0.5));
        else a = Math.max(error * 2.5, -(throttle < -0.1 ? HORSE.brake : HORSE.coast));
        p.speed += a * h;
        if (Math.abs(p.speed) < 0.04 && Math.abs(target) < 0.04) p.speed = 0;
        // guinada com inércia, limitada pela aderência lateral
        const v = Math.abs(p.speed);
        const yawTarget = steer * Math.min(HORSE.yawRate, HORSE.lateral / Math.max(v, 0.1)) * (p.speed < 0 ? -1 : 1);
        p.yawRate += (yawTarget - p.yawRate) * (1 - Math.exp(-h / HORSE.yawTau));
        p.yaw += p.yawRate * h;
        if (v > 4) p.speed -= Math.sign(p.speed) * 0.08 * Math.abs(p.yawRate) * v * h;
        // movimento + colisão com deslize
        const vx = Math.sin(p.yaw) * p.speed, vz = Math.cos(p.yaw) * p.speed;
        let nx = p.x + vx * h, nz = p.z + vz * h, hit = false;
        for (let k = 0; k < colliders.length; k++) {
            const o = colliders[k], dx = nx - o.x, dz = nz - o.z, r = o.radius + HORSE.radius, d2 = dx * dx + dz * dz;
            if (d2 >= r * r) continue;
            hit = true;
            const d = Math.sqrt(d2) || 1e-3, ux = dx / d, uz = dz / d, vn = vx * ux + vz * uz;
            nx = o.x + ux * r; nz = o.z + uz * r;
            if (vn < 0 && Math.abs(p.speed) > 1e-3) {
                const head = clamp(-vn / Math.abs(p.speed), 0, 1);
                result.impact = Math.max(result.impact, head * clamp(Math.abs(p.speed) / HORSE.gallop, 0, 1));
                p.speed -= Math.sign(p.speed) * Math.min(Math.abs(p.speed), 12 * head * h);
                // desvio instintivo para o lado da tangente mais próxima do rumo atual
                const side = (vx * uz - vz * ux) > 0 ? -1 : 1;
                p.yaw += side * 2 * head * h;
            }
        }
        result.obstacle = result.obstacle || hit;
        const steep = Math.abs(terrainHeight(nx, nz) - y) > Math.max(0.6, Math.abs(p.speed) * h * 0.9);
        if (steep) { p.speed -= p.speed * (1 - Math.exp(-16 * h)); result.obstacle = true; }
        else { p.distance += Math.hypot(nx - p.x, nz - p.z); p.x = nx; p.z = nz; }
        const speed = Math.abs(p.speed);
        p.stamina = clamp(p.stamina + (sprint && speed > 10 ? -17 : speed < 5 ? 10 : speed < 10 ? 5 : -1) * h, 0, 100);
        p.phase += speed * h;
    }
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.reload > 0) { p.reload = Math.max(0, p.reload - dt); if (p.reload === 0) p.ammo = 6; }
    return result;
}
export function worldClock(elapsed) {
    const minutes = (16 * 60 + elapsed * 1.5) % 1440;
    return { hour: minutes / 60, label: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}` };
}
const SETTINGS_KEY = 'rastro-vermelho:babylon';
export const SETTINGS_DEFAULT = { quality: 'auto', volume: 70, muted: false, best: 0, reducedMotion: false, sensitivity: 1 };
/* Duas falhas reais aqui: o modo privado do Safari estoura na gravação, e um
   valor corrompido derrubava o lab já no construtor, antes de qualquer tela. */
export function loadSettings(storage) {
    try {
        const raw = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}') || {};
        return { quality: ['auto', 'low', 'medium', 'high'].includes(raw.quality) ? raw.quality : 'auto', volume: Number.isFinite(raw.volume) ? clamp(raw.volume, 0, 100) : 70, best: Number.isFinite(raw.best) ? Math.max(0, raw.best) : 0, muted: raw.muted === true, reducedMotion: raw.reducedMotion === true, sensitivity: Number.isFinite(raw.sensitivity) ? clamp(raw.sensitivity, 0.4, 2) : 1 };
    } catch { return { ...SETTINGS_DEFAULT }; }
}
export function saveSettings(storage, settings) { try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* armazenamento indisponível */ } }
export function loadJourney(storage) {
    try {
        const s = JSON.parse(storage.getItem('rastro-vermelho:journey:v1'));
        if (!s || !Number.isInteger(s.stage) || s.stage < 0 || s.stage > LANDMARKS.length) return null;
        // Resume from the last safe checkpoint, never from a saved combat coordinate.
        return { stage: s.stage, money: clamp(Number(s.money) || 0, 0, 100000), distance: clamp(Number(s.distance) || 0, 0, 1e8), kills: clamp(Number(s.kills) || 0, 0, 100000) };
    } catch { return null; }
}
export function saveJourney(storage, stage, p) { try { storage.setItem('rastro-vermelho:journey:v1', JSON.stringify({ stage, money: p.money, distance: p.distance, kills: p.kills })); } catch { /* A jornada continua sem armazenamento. */ } }
