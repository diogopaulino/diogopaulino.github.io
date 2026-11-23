/**
 * Neon Rider — física da moto em unidades SI (m, s, kg, N, rad).
 * Módulo puro (sem three.js): roda igual no navegador e no Node para teste numérico.
 *
 * CONVENÇÕES
 *   • A avenida é reta e corre no eixo −Z; x é lateral (direita +).
 *   • `v` é a velocidade escalar da moto (m/s); `vy` é a componente lateral (m/s).
 *     Avanço no eixo da avenida: vz = √(v² − vy²).
 *   • Passo fixo `h` (main.js usa 1/120 s com acumulador + interpolação).
 *
 * LONGITUDINAL (2ª lei de Newton: m·a = F_motor − F_aero − F_rolamento − F_freio)
 *   rpm         = v / r_roda · i_total · 60 / 2π         (i_total = primária · marcha · final)
 *   F_motor     = T(rpm) · acelerador · (1 + nitro) · i_total · η / r_roda
 *   F_aero      = ½ · ρ · CdA · v²                        (ρ = 1,2 kg/m³)
 *   F_rolamento = Crr · m · g
 *   Embreagem: abaixo da rotação de largada a embreagem patina e o motor fica na rotação de largada.
 *   Controle de empinada: a_motor ≤ limiteLargada · g (o piloto/eletrônica segura a frente no chão).
 *   Freio de motor (acelerador fechado): T = −k · T_pico · rpm/redline.
 *
 * FREIO COM TRANSFERÊNCIA DE CARGA
 *   Ao frear com desaceleração a, a carga migra para a frente:
 *     N_dianteira = m · (g · b + h · a) / L        N_traseira = m · (g · a_f − h · a) / L
 *   (L = entre-eixos, h = altura do CG, a_f = CG→eixo dianteiro, b = CG→eixo traseiro).
 *   A traseira levanta (stoppie) quando N_traseira = 0 → a = g · a_f / h. O ABS limita a
 *   desaceleração a min(μ · g, 0,97 · g · a_f / h) ≈ 1,05 g. A mesma conta dá o mergulho visual do garfo.
 *
 * LATERAL E INCLINAÇÃO
 *   Em curva estável, a inclinação φ equilibra gravidade e centrífuga:
 *     tan φ = v² / (g · r) = a_lat / g     →     a_lat = g · tan φ
 *   O jogador pede velocidade lateral (troca de faixa); um controlador converte em a_lat desejada,
 *   que vira φ_alvo = atan(a_lat / g). A moto rola até φ_alvo com taxa limitada (giroscópio:
 *   quanto mais rápido, mais devagar ela deita). |φ| ≤ 48°.
 *
 * CÍRCULO DE ATRITO (pneu só tem μ · m · g de força para dividir)
 *   √(a_long² + a_lat²) ≤ μ · g
 *   A inclinação atual tem prioridade (é física: deitada, a moto precisa daquela força lateral);
 *   o freio/motor usa o que sobra — como o ABS de curva. E ao frear forte quase não sobra
 *   aderência para deitar: frear reto, depois desviar.
 */

export const G = 9.81;
export const RHO = 1.2;
export const KMH = 3.6;
const TAU = Math.PI * 2;
const RPM_PER_RADS = 60 / TAU;

/**
 * Motos (uma por dificuldade). Números de catálogo arredondados de motos reais da categoria.
 * torque: pares [rpm, N·m] interpolados linearmente.
 */
export const BIKES = {
    naked: {
        id: 'naked',
        name: 'Naked 700',
        mass: 264,                 // 184 kg moto + 80 kg piloto
        torque: [[1000, 30], [3000, 52], [5000, 62], [6500, 68], [8000, 63], [8750, 60], [10000, 48], [10300, 40]],
        idle: 1300,
        launch: 5200,              // rotação em que a embreagem segura a largada
        redline: 9800,
        limiter: 10200,
        gears: [2.846, 2.125, 1.632, 1.3, 1.091, 0.964],
        primary: 1.925,
        final: 2.687,
        wheelRadius: 0.31,
        eta: 0.9,
        cda: 0.5,                  // piloto sentado ereto
        crr: 0.018,
        mu: 1.05,
        launchG: 0.74,
        wheelbase: 1.4,
        cogHeight: 0.66,
        cogToFront: 0.69,
        engineBrake: 0.16
    },
    sport: {
        id: 'sport',
        name: 'Street 765',
        mass: 268,
        torque: [[1500, 34], [4000, 55], [6000, 64], [8000, 72], [9500, 79], [11000, 78], [11750, 77], [12650, 66], [13000, 56]],
        idle: 1400,
        launch: 6800,
        redline: 12300,
        limiter: 12650,
        gears: [2.615, 2.0, 1.684, 1.45, 1.3, 1.19],
        primary: 1.85,
        final: 2.875,
        wheelRadius: 0.31,
        eta: 0.9,
        cda: 0.42,
        crr: 0.016,
        mu: 1.1,
        launchG: 0.86,
        wheelbase: 1.41,
        cogHeight: 0.63,
        cogToFront: 0.7,
        engineBrake: 0.15
    },
    superbike: {
        id: 'superbike',
        name: 'Superbike 1000',
        mass: 277,
        torque: [[2000, 52], [5000, 78], [7000, 92], [9000, 104], [11000, 113], [12500, 110], [13500, 107.5], [14600, 95], [15000, 80]],
        idle: 1500,
        launch: 8000,
        redline: 14200,
        limiter: 14600,
        gears: [2.647, 2.091, 1.727, 1.5, 1.36, 1.261],
        primary: 1.652,
        final: 2.471,
        wheelRadius: 0.31,
        eta: 0.91,
        cda: 0.36,                 // piloto deitado na carenagem
        crr: 0.015,
        mu: 1.12,
        launchG: 0.95,
        wheelbase: 1.44,
        cogHeight: 0.62,
        cogToFront: 0.71,
        engineBrake: 0.14
    }
};

/** Nitro (N₂O): +35 % de torque enquanto há carga. Esvazia em 4,5 s, recarrega em ~18 s. */
export const NITRO = { boost: 0.35, drain: 1 / 4.5, recharge: 1 / 18 };

/** Inclinação máxima e dinâmica de rolagem. */
export const LEAN = {
    max: 48 * Math.PI / 180,
    gain: 12,             // 1/s — quão rápido a moto persegue φ_alvo
    rollRate: 3.4,        // rad/s parado; cai com a velocidade: rollRate / (1 + v / 45) (≈ 85°/s a 150 km/h)
    lateralMax: 4.6,      // m/s de deslocamento lateral pedido no esterço máximo (≈ 0,8 s por faixa)
    lateralGain: 2.6      // 1/s — controlador vy → a_lat
};

/** Tempo do quickshifter (corte de ignição na troca para cima). */
const SHIFT_TIME = 0.055;

export function torqueAt(bike, rpm) {
    const t = bike.torque;
    if (rpm <= t[0][0]) return t[0][1];
    for (let i = 1; i < t.length; i++) {
        if (rpm <= t[i][0]) {
            const [r0, n0] = t[i - 1];
            const [r1, n1] = t[i];
            return n0 + (n1 - n0) * (rpm - r0) / (r1 - r0);
        }
    }
    return t[t.length - 1][1];
}

export class BikePhysics {
    constructor(bike = BIKES.sport) {
        this.setBike(bike);
        this.reset();
    }

    setBike(bike) {
        this.bike = bike;
        const b = bike;
        this.ratios = b.gears.map((g) => g * b.primary * b.final);
        let peak = 0;
        for (const [, nm] of b.torque) peak = Math.max(peak, nm);
        this.peakTorque = peak;
        // ABS: min(μg, 0,97 · limite de stoppie g·a_f/h)
        this.brakeMax = Math.min(b.mu * G, 0.97 * G * b.cogToFront / b.cogHeight);
        this.topSpeed = this.estimateTopSpeed();
    }

    reset(v0 = 0) {
        this.x = 0;
        this.z = 0;
        this.v = v0;
        this.vy = 0;
        this.lean = 0;          // rad, + = deitada para a direita
        this.aLong = 0;         // m/s² (+ acelerando)
        this.aLat = 0;          // m/s²
        this.gear = 1;
        this.rpm = this.bike.idle;
        this.shiftT = 0;
        this.shifted = 0;       // +1/−1 no passo em que trocou (para som/HUD)
        this.nitro = 1;
        this.nitroOn = false;
        this.gripUse = 0;       // 0..1 do círculo de atrito
        this.limiter = false;
        this.scrape = 0;        // > 0 enquanto raspa no meio-fio
        this.pitch = 0;         // rad, mergulho (+) / agachamento (−) da suspensão, visual
        this.distance = 0;
        if (v0 > 0) this.gear = this.bestGear(v0);
        this.rpm = Math.max(this.bike.idle, this.wheelRpm(this.gear));
    }

    wheelRpm(gear) {
        return (this.v / this.bike.wheelRadius) * this.ratios[gear - 1] * RPM_PER_RADS;
    }

    /** Maior marcha que ainda deixa o motor acima de 55 % do corte. */
    bestGear(v) {
        const b = this.bike;
        for (let g = b.gears.length; g >= 1; g--) {
            const rpm = (v / b.wheelRadius) * this.ratios[g - 1] * RPM_PER_RADS;
            if (rpm >= b.redline * 0.55 || g === 1) return g;
        }
        return 1;
    }

    /** Velocidade máxima teórica: onde F_motor (melhor marcha) = arrasto + rolamento. */
    estimateTopSpeed() {
        const b = this.bike;
        let best = 0;
        for (let v = 10; v < 120; v += 0.25) {
            let drive = 0;
            for (let g = 0; g < this.ratios.length; g++) {
                const rpm = (v / b.wheelRadius) * this.ratios[g] * RPM_PER_RADS;
                if (rpm > b.limiter) continue;
                drive = Math.max(drive, torqueAt(b, rpm) * this.ratios[g] * b.eta / b.wheelRadius);
            }
            const resist = 0.5 * RHO * b.cda * v * v + b.crr * b.mass * G;
            if (drive > resist) best = v;
        }
        return best;
    }

    /**
     * Um passo de integração (Euler semi-implícito).
     * c = { throttle 0..1, brake 0..1, steer −1..1, nitro bool }
     */
    step(h, c, halfWidth = Infinity) {
        const b = this.bike;
        const m = b.mass;
        const muG = b.mu * G;
        this.shifted = 0;

        // ---------- motor e câmbio ----------
        const throttle = c.throttle;
        const wheelRpm = this.wheelRpm(this.gear);
        // embreagem patinando na largada (1ª marcha, abaixo da rotação de largada)
        const slipping = this.gear === 1 && wheelRpm < b.launch && throttle > 0.05;
        let rpmTarget = slipping ? Math.max(wheelRpm, b.idle + (b.launch - b.idle) * throttle) : Math.max(wheelRpm, b.idle);
        // ponteiro do conta-giros com inércia curta (o motor não teleporta de rotação)
        this.rpm += (rpmTarget - this.rpm) * Math.min(1, h * 18);

        this.nitroOn = Boolean(c.nitro) && this.nitro > 0.01 && throttle > 0.05 && this.v > 2;
        if (this.nitroOn) this.nitro = Math.max(0, this.nitro - NITRO.drain * h);
        else this.nitro = Math.min(1, this.nitro + NITRO.recharge * h);

        let engineForce = 0;
        this.limiter = this.rpm >= b.limiter - 20;
        if (this.shiftT > 0) {
            this.shiftT -= h;                       // corte de ignição do quickshifter
        } else if (throttle > 0.01) {
            if (!this.limiter) {
                const torque = torqueAt(b, this.rpm) * throttle * (this.nitroOn ? 1 + NITRO.boost : 1);
                engineForce = torque * this.ratios[this.gear - 1] * b.eta / b.wheelRadius;
            }
        } else if (this.v > 1) {
            // freio de motor (embreagem deslizante limita a ~0,25 g)
            const eb = b.engineBrake * this.peakTorque * (this.rpm / b.redline) * this.ratios[this.gear - 1] / b.wheelRadius;
            engineForce = -Math.min(eb, 0.25 * m * G);
        }
        // controle de empinada / tração: a_motor ≤ launchG · g
        engineForce = Math.min(engineForce, b.launchG * m * G);

        // ---------- forças resistivas ----------
        const aero = 0.5 * RHO * b.cda * this.v * this.v;
        const roll = this.v > 0.05 ? b.crr * m * G : 0;
        let brakeDecel = c.brake * this.brakeMax;

        // ---------- círculo de atrito ----------
        // a lateral atual (inclinação) consome aderência primeiro; freio e motor usam o resto
        const latUse = Math.min(Math.abs(this.aLat), muG);
        const longAvail = Math.sqrt(Math.max(0, muG * muG - latUse * latUse));
        // motor e freio passam pelo mesmo par de pneus: o total é limitado pelo ABS e pelo que sobra do círculo
        const tireMin = -Math.min(longAvail, this.brakeMax);
        const tireAccel = Math.max(tireMin, Math.min(engineForce / m - brakeDecel, longAvail));

        let a = tireAccel - (aero + roll) / m;
        if (this.v <= 0 && a < 0) a = 0;
        this.v = Math.max(0, this.v + a * h);
        this.aLong = a;

        // ---------- troca automática (quickshifter + blipper) ----------
        const n = b.gears.length;
        const rpmNow = this.wheelRpm(this.gear);
        if (this.gear < n && rpmNow >= b.redline && throttle > 0.05) {
            this.gear += 1;
            this.shiftT = SHIFT_TIME;
            this.shifted = 1;
        } else if (this.gear > 1) {
            // reduz quando cai abaixo de 45 % do redline (60 % se freando), sem passar do corte na marcha de baixo
            const down = b.redline * (c.brake > 0.1 ? 0.6 : 0.45);
            const lower = (this.v / b.wheelRadius) * this.ratios[this.gear - 2] * RPM_PER_RADS;
            if (rpmNow < down && lower < b.redline * 0.92) {
                this.gear -= 1;
                this.shifted = -1;
            }
        }

        // ---------- lateral: velocidade lateral pedida → a_lat → inclinação ----------
        const vyMax = Math.min(LEAN.lateralMax, this.v * 0.45);
        const vyWant = c.steer * vyMax;
        let aWant = (vyWant - this.vy) * LEAN.lateralGain * (1 + this.v / 60);
        // o que o pneu aguenta depois da aceleração/frenagem (círculo de atrito, outra direção)
        const longUse = Math.min(Math.abs(tireAccel), muG);
        const latAvail = Math.min(G * Math.tan(LEAN.max), Math.sqrt(Math.max(0, muG * muG - longUse * longUse)));
        aWant = Math.max(-latAvail, Math.min(latAvail, aWant));
        const leanWant = Math.atan(aWant / G);
        const rollMax = LEAN.rollRate / (1 + this.v / 45);
        const dLean = Math.max(-rollMax, Math.min(rollMax, (leanWant - this.lean) * LEAN.gain));
        this.lean += dLean * h;
        if (this.v < 0.5) this.lean *= 1 - Math.min(1, h * 6);
        this.lean = Math.max(-LEAN.max, Math.min(LEAN.max, this.lean));
        // a_lat = g · tan φ (equilíbrio de curva); parado não há curva
        this.aLat = this.v > 0.5 ? G * Math.tan(this.lean) : 0;
        this.vy += this.aLat * h;
        if (this.v < 0.5) this.vy = 0;
        this.vy = Math.max(-this.v, Math.min(this.v, this.vy));

        // ---------- integração de posição ----------
        const vz = Math.sqrt(Math.max(0, this.v * this.v - this.vy * this.vy));
        this.x += this.vy * h;
        this.z -= vz * h;
        this.distance += vz * h;

        // meio-fio: encosta, zera o lateral para fora, perde 35 %/s de velocidade raspando
        this.scrape = 0;
        if (this.x > halfWidth || this.x < -halfWidth) {
            const side = Math.sign(this.x);
            this.x = side * halfWidth;
            if (Math.sign(this.vy) === side) {
                this.scrape = Math.abs(this.vy);
                this.vy = 0;
                this.lean *= 0.5;
            }
            if (this.v > 3) {
                this.v *= 1 - 0.35 * h;
                this.scrape = Math.max(this.scrape, 0.5);
            }
        }

        // ---------- carga e suspensão (visual) ----------
        // pitch ≈ transferência de carga: ΔN/m·g = h·a/L ; 1 g de freio ≈ 3,5° de mergulho do garfo
        const transfer = (b.cogHeight * -a) / (b.wheelbase * G);
        this.pitch += (transfer * 0.14 - this.pitch) * Math.min(1, h * 10);
        this.gripUse = Math.min(1, Math.sqrt(a * a + this.aLat * this.aLat) / muG);
    }

    /** Batida: a moto sai com a velocidade dada e o lateral zerado (o piloto segura e endireita). */
    impact(newSpeed, push = 0) {
        this.v = Math.max(0, newSpeed);
        this.vy = push;
        this.lean *= 0.3;
        this.gear = this.bestGear(this.v);
    }

    /** Pneu-dianteiro: força normal em cada eixo (N) para a desaceleração atual. */
    axleLoads() {
        const b = this.bike;
        const a = -this.aLong;
        const nf = b.mass * (G * (b.wheelbase - b.cogToFront) + b.cogHeight * a) / b.wheelbase;
        return { front: nf, rear: b.mass * G - nf };
    }
}
