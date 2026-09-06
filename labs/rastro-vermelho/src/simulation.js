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
    return { x: roadX(24), z: 20, yaw: 0, speed: 0, distance: 0, stamina: 100, health: 100, focus: 100, ammo: 6, reload: 0, cooldown: 0, cruise: false, tired: false, money: 0, kills: 0, phase: 0 };
}
/** Acceleration, slope resistance and stamina use dt; a held spur cannot bypass exhaustion.
 * Gallop 11 m/s, sprint 17 m/s; stamina -17/s sprinting, +10/s walking, +5/s trotting.
 * Exhaustion has hysteresis: sprint is unavailable until stamina has recovered to 28%.
 */
export function stepRiding(p, input, dt, colliders = []) {
    const throttle = clamp(input.throttle, -1, 1), steer = clamp(input.steer, -1, 1);
    if (p.stamina <= 1) p.tired = true;
    if (p.stamina >= 28) p.tired = false;
    const sprint = input.sprint && !p.tired && throttle >= 0;
    let target = throttle < -0.1 ? 0 : sprint ? 17 : throttle > 0.1 ? 11 * throttle : p.cruise ? 8 : 0;
    const y = terrainHeight(p.x, p.z);
    const grade = (terrainHeight(p.x + Math.sin(p.yaw) * 2, p.z + Math.cos(p.yaw) * 2) - y) / 2;
    target *= clamp(1 - Math.max(0, grade) * 0.65, 0.35, 1);
    p.speed = damp(p.speed, target, target < p.speed ? 3.8 : 1.35, dt);
    if (p.speed < 0.04) p.speed = 0;
    p.yaw += steer * dt * (0.65 + 0.7 * clamp(p.speed / 9, 0, 1)) / (1 + p.speed * 0.022);
    const nx = p.x + Math.sin(p.yaw) * p.speed * dt, nz = p.z + Math.cos(p.yaw) * p.speed * dt;
    const obstacle = colliders.some(o => Math.hypot(nx - o.x, nz - o.z) < o.radius + 0.65);
    const steep = Math.abs(terrainHeight(nx, nz) - y) > Math.max(0.6, p.speed * dt * 0.9);
    if (obstacle || steep) p.speed = damp(p.speed, 0, 16, dt);
    else { p.distance += Math.hypot(nx - p.x, nz - p.z); p.x = nx; p.z = nz; }
    p.stamina = clamp(p.stamina + (sprint && p.speed > 10 ? -17 : p.speed < 5 ? 10 : p.speed < 10 ? 5 : -1) * dt, 0, 100);
    p.phase += p.speed * dt;
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.reload > 0) { p.reload = Math.max(0, p.reload - dt); if (p.reload === 0) p.ammo = 6; }
    return { obstacle, grade };
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
