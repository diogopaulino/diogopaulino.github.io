(function () {
    'use strict';

    /**
     * Gravity — sandbox orbital 2D de N corpos.
     *
     * Este arquivo tem duas metades:
     *   1. Physics (entre @@physics-begin / @@physics-end): núcleo puro, sem DOM.
     *      Pode ser extraído e testado no Node (o teste numérico faz isso).
     *   2. UI: canvas, câmera, HUD, entrada (mouse, toque, teclado) e persistência.
     *
     * Resumo das fórmulas (detalhes junto de cada função):
     *   Unidades:          UA, M☉, ano  →  G = 4π² UA³/(M☉·ano²), c = 63 241,077 UA/ano
     *   Plummer:           a = G m r⃗ / (r² + ε²)^{3/2},   Φ = −G m / √(r² + ε²)
     *   Integrador:        leapfrog KDK (velocity Verlet), dt fixo por cenário + acumulador
     *   Energia:           E = Σ ½ m v² − Σ_{i<j} G mᵢ mⱼ / √(r²+ε²)
     *   Órbita circular:   v = √(G M r² / (r²+ε²)^{3/2})  (= √(GM/r) quando ε ≪ r)
     *   Kepler:            E − e sen E = M  (Newton)  →  estado cartesiano
     *   Fusão inelástica:  m = m₁+m₂,  p⃗ = p⃗₁+p⃗₂,  R³ = R₁³+R₂³,  ΔK = −½ μ v_rel²
     *   Buraco negro:      r_s = 2GM/c²,  ISCO = 3 r_s,  captura ao cruzar r_s
     *   Maré (estrela):    r_t = R★ (M_BN / m★)^{1/3}
     *   Estilingue:        v = v_hospedeiro + Δarrasto / τ,  τ = r / v_circ(r)
     */

    /* @@physics-begin */
    const Physics = (function () {
        /* Sistema de unidades declarado (o mesmo em todos os cenários):
             comprimento  1 UA   = 1,495 978 707 × 10¹¹ m
             massa        1 M☉   = 1,988 47 × 10³⁰ kg
             tempo        1 ano  = 365,25 d (juliano)
           Com isso a 3ª lei de Kepler vira P² = a³ / M (P em anos, a em UA, M em M☉),
           o que fixa G = 4π² ≈ 39,478 UA³ M☉⁻¹ ano⁻².
           c = 299 792 458 m/s = 63 241,077 UA/ano;  1 UA/ano = 4,740 47 km/s. */
        const TAU = Math.PI * 2;
        const G = 4 * Math.PI * Math.PI;
        const C_LIGHT = 63241.07708426628;
        const KMS_PER_AU_YR = 4.740470463533348;
        const KM = 1 / 149597870.7;              // UA por km
        const KPC = 206264806.24709636;          // UA por kpc
        const R_SUN = 696000 * KM;               // 0,004 65 UA
        const M_EARTH = 3.003489e-6;
        const M_JUP = 9.547919e-4;
        const MAX_BODIES = 48;
        const TRAIL_N = 240;
        const DEG = Math.PI / 180;

        let nextId = 1;

        /** Raio de Schwarzschild r_s = 2GM/c² (UA). 1 M☉ → 1,97·10⁻⁸ UA ≈ 2,95 km. */
        function schwarzschild(m) {
            return (2 * G * m) / (C_LIGHT * C_LIGHT);
        }

        function createWorld(pcap) {
            return {
                bodies: [],
                P: {
                    n: 0,
                    cap: pcap,
                    x: new Float64Array(pcap),
                    y: new Float64Array(pcap),
                    vx: new Float64Array(pcap),
                    vy: new Float64Array(pcap),
                    ax: new Float64Array(pcap),
                    ay: new Float64Array(pcap),
                    col: new Uint8Array(pcap),
                    sz: new Float32Array(pcap)
                },
                t: 0,
                dt: 1e-3,
                eps2: 1e-12,
                cull2: Infinity,
                collide: true,
                well: { on: false, x: 0, y: 0, m: 0, eps2: 1 },
                pairs: new Int32Array(256),   // contatos detectados no drift (i, j)
                nPairs: 0,
                tde: new Int32Array(32),      // rompimentos de maré pendentes (estrela, BN)
                nTde: 0,
                tdeCol: 0,
                E0: 0, eShift: 0,             // energia de referência e saltos de eventos
                Escale: 0,                    // escala |E| para a deriva relativa (ver rescale)
                P0x: 0, P0y: 0, pShiftX: 0, pShiftY: 0,
                dissipated: 0,                // energia cinética perdida em fusões
                captured: 0,
                onMerge: null,
                onDisrupt: null,
                onCapture: null
            };
        }

        /** Corpo massivo. R = raio de colisão (UA): físico × fator de realce, ou r_s no BN. */
        function addBody(w, o) {
            if (w.bodies.length >= MAX_BODIES) return null;
            const b = {
                id: nextId++,
                x: o.x || 0, y: o.y || 0, vx: o.vx || 0, vy: o.vy || 0, ax: 0, ay: 0,
                m: o.m,
                kind: o.kind || 'planet',
                tex: o.tex || o.kind || 'planet',
                name: o.name || '',
                color: o.color || '#cbd5e1',
                vis: o.vis || 3,
                Rphys: o.R || 0,
                inflate: o.inflate || 1,
                R: 0,
                alive: true,
                flash: 0,
                spin: Math.random() * TAU,
                trail: new Float64Array(TRAIL_N * 2),
                tHead: 0,
                tLen: 0,
                tLast: -Infinity
            };
            setRadius(b);
            w.bodies.push(b);
            return b;
        }

        function setRadius(b) {
            b.R = b.kind === 'blackhole' ? schwarzschild(b.m) : b.Rphys * b.inflate;
        }

        /** Poeira = partícula-teste: sente a gravidade dos corpos, mas não tem massa. */
        function addParticle(w, x, y, vx, vy, col, sz) {
            const P = w.P;
            if (P.n >= P.cap) return -1;
            const i = P.n++;
            P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
            P.ax[i] = 0; P.ay[i] = 0;
            P.col[i] = col; P.sz[i] = sz;
            return i;
        }

        function removeParticle(P, i) {
            const last = --P.n;
            if (i === last) return;
            P.x[i] = P.x[last]; P.y[i] = P.y[last];
            P.vx[i] = P.vx[last]; P.vy[i] = P.vy[last];
            P.ax[i] = P.ax[last]; P.ay[i] = P.ay[last];
            P.col[i] = P.col[last]; P.sz[i] = P.sz[last];
        }

        /* Aceleração com amortecimento de Plummer:
             a⃗ᵢ = Σⱼ G mⱼ (r⃗ⱼ − r⃗ᵢ) / (|r⃗ⱼ − r⃗ᵢ|² + ε²)^{3/2}
           ε (softening) evita a singularidade em r → 0 e é o mesmo usado no
           potencial da energia, então E continua sendo a grandeza conservada.
           Cada par é visitado uma vez e recebe forças iguais e opostas
           (3ª lei) → o momento total é conservado até o arredondamento. */
        function accelBodies(w) {
            const B = w.bodies;
            const n = B.length;
            const eps2 = w.eps2;
            for (let i = 0; i < n; i++) { B[i].ax = 0; B[i].ay = 0; }
            for (let i = 0; i < n; i++) {
                const a = B[i];
                const xi = a.x, yi = a.y, mi = a.m;
                let axi = a.ax, ayi = a.ay;
                for (let j = i + 1; j < n; j++) {
                    const b = B[j];
                    const dx = b.x - xi;
                    const dy = b.y - yi;
                    const r2 = dx * dx + dy * dy + eps2;
                    const inv = G / (r2 * Math.sqrt(r2));
                    axi += b.m * inv * dx;
                    ayi += b.m * inv * dy;
                    b.ax -= mi * inv * dx;
                    b.ay -= mi * inv * dy;
                }
                a.ax = axi;
                a.ay = ayi;
            }
            const wl = w.well;
            if (wl.on) {
                for (let i = 0; i < n; i++) {
                    const b = B[i];
                    const dx = wl.x - b.x;
                    const dy = wl.y - b.y;
                    const r2 = dx * dx + dy * dy + wl.eps2;
                    const inv = (G * wl.m) / (r2 * Math.sqrt(r2));
                    b.ax += inv * dx;
                    b.ay += inv * dy;
                }
            }
        }

        function accelParticles(w) {
            const B = w.bodies;
            const nb = B.length;
            const P = w.P;
            const px = P.x, py = P.y, pax = P.ax, pay = P.ay;
            const eps2 = w.eps2;
            const wl = w.well;
            for (let i = 0; i < P.n; i++) {
                const x = px[i], y = py[i];
                let ax = 0, ay = 0;
                for (let j = 0; j < nb; j++) {
                    const b = B[j];
                    const dx = b.x - x;
                    const dy = b.y - y;
                    const r2 = dx * dx + dy * dy + eps2;
                    const inv = (G * b.m) / (r2 * Math.sqrt(r2));
                    ax += inv * dx;
                    ay += inv * dy;
                }
                if (wl.on) {
                    const dx = wl.x - x;
                    const dy = wl.y - y;
                    const r2 = dx * dx + dy * dy + wl.eps2;
                    const inv = (G * wl.m) / (r2 * Math.sqrt(r2));
                    ax += inv * dx;
                    ay += inv * dy;
                }
                pax[i] = ax;
                pay[i] = ay;
            }
        }

        function computeAccel(w) {
            accelBodies(w);
            accelParticles(w);
        }

        /* Leapfrog KDK (kick-drift-kick, equivalente ao velocity Verlet):
             v ← v + a(x) dt/2      (meio chute)
             x ← x + v dt           (deriva: movimento retilíneo exato)
             v ← v + a(x) dt/2      (meio chute com a nova aceleração)
           É simplético e reversível no tempo: a energia não deriva, apenas
           oscila com amplitude O(dt²). Por isso dt é FIXO por cenário (mudar
           dt a cada quadro quebraria a simpleticidade); a velocidade da
           simulação muda o número de passos por quadro, nunca o dt.

           Colisões: no drift a velocidade é constante, então a menor distância
           entre dois corpos no intervalo [0, dt] tem forma fechada:
             t* = clamp(−(Δr⃗·Δv⃗)/|Δv⃗|², 0, dt),  d_min = |Δr⃗ + Δv⃗ t*|
           Isso evita "tunelamento" de corpos rápidos (detecção contínua). */
        function step(w) {
            const B = w.bodies;
            const nb = B.length;
            const P = w.P;
            const dt = w.dt;
            const h = 0.5 * dt;
            const px = P.x, py = P.y, pvx = P.vx, pvy = P.vy, pax = P.ax, pay = P.ay;

            for (let i = 0; i < nb; i++) {
                const b = B[i];
                b.vx += b.ax * h;
                b.vy += b.ay * h;
            }
            for (let i = 0; i < P.n; i++) {
                pvx[i] += pax[i] * h;
                pvy[i] += pay[i] * h;
            }

            // Poeira: captura contínua pelos corpos (antes de os corpos andarem) + deriva.
            const cull2 = w.cull2;
            for (let i = P.n - 1; i >= 0; i--) {
                const x = px[i], y = py[i], vx = pvx[i], vy = pvy[i];
                let hit = null;
                for (let j = 0; j < nb; j++) {
                    const b = B[j];
                    const R = b.R;
                    if (R <= 0) continue;
                    const dx = x - b.x;
                    const dy = y - b.y;
                    const dvx = vx - b.vx;
                    const dvy = vy - b.vy;
                    const reach = R + (Math.abs(dvx) + Math.abs(dvy)) * dt;
                    const d2 = dx * dx + dy * dy;
                    if (d2 > reach * reach) continue;
                    const dv2 = dvx * dvx + dvy * dvy;
                    let t = dv2 > 0 ? -(dx * dvx + dy * dvy) / dv2 : 0;
                    if (t < 0) t = 0; else if (t > dt) t = dt;
                    const cx = dx + dvx * t;
                    const cy = dy + dvy * t;
                    if (cx * cx + cy * cy <= R * R) { hit = b; break; }
                }
                if (hit) {
                    hit.flash = 1;
                    w.captured++;
                    if (w.onCapture) w.onCapture(hit);
                    removeParticle(P, i);
                    continue;
                }
                const nx = x + vx * dt;
                const ny = y + vy * dt;
                if (nx * nx + ny * ny > cull2) {
                    removeParticle(P, i);
                    continue;
                }
                px[i] = nx;
                py[i] = ny;
            }

            // Corpos: contatos no intervalo de deriva (posições ainda pré-drift).
            w.nPairs = 0;
            if (w.collide && nb > 1) {
                const pairs = w.pairs;
                for (let i = 0; i < nb; i++) {
                    const a = B[i];
                    for (let j = i + 1; j < nb; j++) {
                        const b = B[j];
                        const R = a.R + b.R;
                        if (R <= 0) continue;
                        const dx = b.x - a.x;
                        const dy = b.y - a.y;
                        const dvx = b.vx - a.vx;
                        const dvy = b.vy - a.vy;
                        const reach = R + (Math.abs(dvx) + Math.abs(dvy)) * dt;
                        const d2 = dx * dx + dy * dy;
                        if (d2 > reach * reach) continue;
                        const dv2 = dvx * dvx + dvy * dvy;
                        let t = dv2 > 0 ? -(dx * dvx + dy * dvy) / dv2 : 0;
                        if (t < 0) t = 0; else if (t > dt) t = dt;
                        const cx = dx + dvx * t;
                        const cy = dy + dvy * t;
                        if (cx * cx + cy * cy <= R * R && w.nPairs * 2 < pairs.length) {
                            pairs[w.nPairs * 2] = i;
                            pairs[w.nPairs * 2 + 1] = j;
                            w.nPairs++;
                        }
                    }
                }
            }

            for (let i = 0; i < nb; i++) {
                const b = B[i];
                b.x += b.vx * dt;
                b.y += b.vy * dt;
            }

            /* Rompimento de maré: uma estrela de raio R★ e massa m★ perto de um
               buraco negro de massa M é desfeita quando r < r_t = R★ (M/m★)^{1/3}
               (a maré M R★ / r³ supera a autogravidade m★ / R★²). */
            w.nTde = 0;
            for (let i = 0; i < nb; i++) {
                const bh = B[i];
                if (bh.kind !== 'blackhole') continue;
                for (let j = 0; j < nb; j++) {
                    const s = B[j];
                    if ((s.kind !== 'star' && s.kind !== 'sun') || s.Rphys <= 0 || s.m * 10 > bh.m) continue;
                    const dx = s.x - bh.x;
                    const dy = s.y - bh.y;
                    const rt = s.Rphys * Math.cbrt(bh.m / s.m);
                    if (dx * dx + dy * dy < rt * rt && w.nTde * 2 < w.tde.length) {
                        w.tde[w.nTde * 2] = j;
                        w.tde[w.nTde * 2 + 1] = i;
                        w.nTde++;
                    }
                }
            }

            accelBodies(w);
            accelParticles(w);

            for (let i = 0; i < nb; i++) {
                const b = B[i];
                b.vx += b.ax * h;
                b.vy += b.ay * h;
            }
            for (let i = 0; i < P.n; i++) {
                pvx[i] += pax[i] * h;
                pvy[i] += pay[i] * h;
            }
            w.t += dt;

            if (w.nPairs || w.nTde) resolveEvents(w);
        }

        /* Fusões e rompimentos acontecem no fim do passo (posições e velocidades
           sincronizadas). O salto de energia/momento causado pelo evento é
           somado em eShift/pShift: assim ΔE/E₀ no HUD mede só o erro do
           integrador, não a energia dissipada de propósito numa colisão. */
        const _m0 = { px: 0, py: 0, sum: 0 };
        const _m1 = { px: 0, py: 0, sum: 0 };
        function resolveEvents(w) {
            const B = w.bodies;
            const e0 = energy(w);
            momentum(w, _m0);
            for (let k = 0; k < w.nPairs; k++) {
                const a = B[w.pairs[k * 2]];
                const b = B[w.pairs[k * 2 + 1]];
                if (a && b && a.alive && b.alive) merge(w, a, b);
            }
            for (let k = 0; k < w.nTde; k++) {
                const s = B[w.tde[k * 2]];
                const bh = B[w.tde[k * 2 + 1]];
                if (s && bh && s.alive && bh.alive) disrupt(w, s, bh);
            }
            w.nPairs = 0;
            w.nTde = 0;
            prune(w);
            computeAccel(w);
            w.eShift += energy(w) - e0;
            momentum(w, _m1);
            w.pShiftX += _m1.px - _m0.px;
            w.pShiftY += _m1.py - _m0.py;
            rescale(w);
        }

        /* Escala da deriva: ΔE/E₀ = (E − E_ref) / E_escala, com
             E_ref    = E₀ + Σ saltos de eventos
             E_escala = max(|E₀|, |E_ref| após cada evento)
           Sem eventos isso é exatamente (E − E₀)/|E₀|. O máximo evita que um
           evento que leve E_ref para perto de zero amplifique artificialmente o
           erro; com menos de 2 corpos não há o que conservar (escala zera). */
        function rescale(w) {
            if (w.bodies.length < 2) { w.Escale = 0; return; }
            w.Escale = Math.max(w.Escale, Math.abs(w.E0 + w.eShift));
        }

        function relDrift(w, E) {
            if (w.bodies.length < 2 || !(w.Escale > 0)) return NaN;
            return (E - (w.E0 + w.eShift)) / w.Escale;
        }

        /* Colisão perfeitamente inelástica (fusão):
             m  = m₁ + m₂
             x⃗  = (m₁x⃗₁ + m₂x⃗₂)/m          (centro de massa)
             v⃗  = (m₁v⃗₁ + m₂v⃗₂)/m          (momento linear conservado exatamente)
             R³ = R₁³ + R₂³                  (volume conservado; BN usa r_s(m))
             ΔK = −½ μ |v⃗₁ − v⃗₂|²,  μ = m₁m₂/m   (vira calor/luz — "dissipada") */
        function merge(w, a, b) {
            const aBH = a.kind === 'blackhole';
            const bBH = b.kind === 'blackhole';
            if ((bBH && !aBH) || (aBH === bBH && b.m > a.m)) { const t = a; a = b; b = t; }
            const m = a.m + b.m;
            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            w.dissipated += 0.5 * ((a.m * b.m) / m) * (dvx * dvx + dvy * dvy);
            a.x = (a.m * a.x + b.m * b.x) / m;
            a.y = (a.m * a.y + b.m * b.y) / m;
            a.vx = (a.m * a.vx + b.m * b.vx) / m;
            a.vy = (a.m * a.vy + b.m * b.vy) / m;
            a.Rphys = Math.cbrt(a.Rphys * a.Rphys * a.Rphys + b.Rphys * b.Rphys * b.Rphys);
            a.vis = Math.min(18, Math.cbrt(a.vis * a.vis * a.vis + b.vis * b.vis * b.vis));
            a.inflate = Math.max(a.inflate, b.inflate);
            a.m = m;
            // Acima de ~0,075 M☉ a fusão de hidrogênio acende: o corpo vira estrela.
            if (a.kind !== 'blackhole' && a.kind !== 'star' && a.kind !== 'sun' && m >= 0.075) {
                a.kind = 'star';
                a.tex = 'star';
                if (a.Rphys < R_SUN * 0.1) a.Rphys = R_SUN * Math.pow(m, 0.8);
            }
            setRadius(a);
            a.flash = 1;
            if (!a.name) a.name = b.name;
            b.alive = false;
            if (w.onMerge) w.onMerge(a, b);
        }

        /* Aproximação "congelada" (frozen-in) do rompimento de maré: cada pedaço
           herda a velocidade da estrela e um deslocamento radial δr ∈ [−R★, R★].
           A dispersão de energia específica resultante é ΔE ≈ G M δr / r², o que
           estica a corrente de detritos ao longo da órbita. Os traçadores não
           têm massa (m★/M_BN ~ 10⁻⁷ no cenário). */
        function disrupt(w, s, bh) {
            const dx = s.x - bh.x;
            const dy = s.y - bh.y;
            const r = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / r, uy = dy / r;
            const n = Math.min(180, w.P.cap - w.P.n);
            for (let k = 0; k < n; k++) {
                const f = n > 1 ? (k / (n - 1)) * 2 - 1 : 0;
                const off = f * s.Rphys * 1.4;
                const lat = (Math.random() - 0.5) * s.Rphys * 0.6;
                addParticle(w, s.x + ux * off - uy * lat, s.y + uy * off + ux * lat, s.vx, s.vy, w.tdeCol, 1 + Math.random() * 1.2);
            }
            s.alive = false;
            if (w.onDisrupt) w.onDisrupt(s, bh);
        }

        function prune(w) {
            const B = w.bodies;
            let k = 0;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                if (b.alive && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy)) B[k++] = b;
                else b.alive = false;
            }
            B.length = k;
        }

        /** E = Σ ½ m v² − Σ_{i<j} G mᵢ mⱼ / √(r² + ε²)  (poço temporário excluído). */
        function energy(w) {
            const B = w.bodies;
            const n = B.length;
            let K = 0, U = 0;
            for (let i = 0; i < n; i++) {
                const a = B[i];
                K += 0.5 * a.m * (a.vx * a.vx + a.vy * a.vy);
                for (let j = i + 1; j < n; j++) {
                    const b = B[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    U -= (G * a.m * b.m) / Math.sqrt(dx * dx + dy * dy + w.eps2);
                }
            }
            return K + U;
        }

        /** P⃗ = Σ m v⃗ ;  sum = Σ |m v⃗| (escala para a deriva relativa). */
        function momentum(w, out) {
            const B = w.bodies;
            let px = 0, py = 0, sum = 0;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                const qx = b.m * b.vx;
                const qy = b.m * b.vy;
                px += qx;
                py += qy;
                sum += Math.sqrt(qx * qx + qy * qy);
            }
            out.px = px;
            out.py = py;
            out.sum = sum;
            return out;
        }

        /** Envolve uma edição do usuário: desconta da referência o salto de E e P. */
        function edit(w, fn) {
            const e0 = energy(w);
            momentum(w, _m0);
            fn();
            prune(w);
            computeAccel(w);
            w.eShift += energy(w) - e0;
            momentum(w, _m1);
            w.pShiftX += _m1.px - _m0.px;
            w.pShiftY += _m1.py - _m0.py;
            rescale(w);
        }

        /** Fixa a referência de conservação (início do cenário). */
        function baseline(w) {
            computeAccel(w);
            w.E0 = energy(w);
            momentum(w, _m0);
            w.P0x = _m0.px;
            w.P0y = _m0.py;
            w.eShift = 0;
            w.pShiftX = 0;
            w.pShiftY = 0;
            w.dissipated = 0;
            w.captured = 0;
            w.Escale = w.bodies.length < 2 ? 0 : Math.abs(w.E0);
        }

        /** Move a origem para o centro de massa e zera o momento total (CM em repouso). */
        function toBarycenter(w) {
            const B = w.bodies;
            let M = 0, X = 0, Y = 0, VX = 0, VY = 0;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                M += b.m; X += b.m * b.x; Y += b.m * b.y; VX += b.m * b.vx; VY += b.m * b.vy;
            }
            if (M <= 0) return;
            X /= M; Y /= M; VX /= M; VY /= M;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                b.x -= X; b.y -= Y; b.vx -= VX; b.vy -= VY;
            }
            const P = w.P;
            for (let i = 0; i < P.n; i++) {
                P.x[i] -= X; P.y[i] -= Y; P.vx[i] -= VX; P.vy[i] -= VY;
            }
        }

        /** Velocidade circular com Plummer: v² = G M r² / (r² + ε²)^{3/2}. */
        function vCirc(M, r, eps2) {
            const r2 = r * r;
            const d2 = r2 + eps2;
            return Math.sqrt((G * M * r2) / (d2 * Math.sqrt(d2)));
        }

        /* Elementos keplerianos → estado cartesiano (relativo ao foco).
             E − e sen E = M                     (equação de Kepler, Newton)
             x' = a (cos E − e),   y' = b sen E,   b = a √(1−e²)
             ẋ' = −n a² sen E / r, ẏ' = n a b cos E / r,  n = √(μ/a³), r = a(1 − e cos E)
           Depois gira pela longitude do periélio ϖ. retro=true inverte o sentido. */
        function solveKepler(M, e) {
            M = ((M % TAU) + TAU) % TAU;
            let E = e < 0.8 ? M : Math.PI;
            for (let k = 0; k < 50; k++) {
                const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
                E -= d;
                if (Math.abs(d) < 1e-14) break;
            }
            return E;
        }

        function meanFromTrue(f, e) {
            const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(f / 2));
            return E - e * Math.sin(E);
        }

        function kepler(mu, a, e, varpi, M, out, retro) {
            const E = solveKepler(M, e);
            const cE = Math.cos(E), sE = Math.sin(E);
            const b = a * Math.sqrt(1 - e * e);
            const r = a * (1 - e * cE);
            const n = Math.sqrt(mu / (a * a * a));
            let xp = a * (cE - e);
            let yp = b * sE;
            let vxp = (-n * a * a * sE) / r;
            let vyp = (n * a * b * cE) / r;
            if (retro) { yp = -yp; vyp = -vyp; }
            const cw = Math.cos(varpi), sw = Math.sin(varpi);
            out.x = xp * cw - yp * sw;
            out.y = xp * sw + yp * cw;
            out.vx = vxp * cw - vyp * sw;
            out.vy = vxp * sw + vyp * cw;
            return out;
        }

        /* Órbita osculante de (r⃗, v⃗) relativo a um hospedeiro, μ = G(m + M):
             ε = v²/2 − μ/r,  a = −μ/(2ε),  h = r × v,  e = √(1 + 2εh²/μ²),
             P = 2π √(a³/μ) se ε < 0 (ligado). */
        function elements(mu, rx, ry, vx, vy, out) {
            const r = Math.sqrt(rx * rx + ry * ry);
            const v2 = vx * vx + vy * vy;
            const en = v2 / 2 - mu / r;
            const hz = rx * vy - ry * vx;
            out.r = r;
            out.energy = en;
            out.bound = en < 0;
            out.a = en < 0 ? -mu / (2 * en) : Infinity;
            out.e = Math.sqrt(Math.max(0, 1 + (2 * en * hz * hz) / (mu * mu)));
            out.period = en < 0 ? TAU * Math.sqrt((out.a * out.a * out.a) / mu) : Infinity;
            out.retro = hz < 0;
            return out;
        }

        /** Corpo que mais acelera o ponto (x, y): argmax G m / r². */
        function dominant(w, x, y, exclude) {
            const B = w.bodies;
            let best = null;
            let bestA = 0;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                if (b === exclude) continue;
                const dx = b.x - x;
                const dy = b.y - y;
                const acc = b.m / (dx * dx + dy * dy + w.eps2);
                if (acc > bestA) { bestA = acc; best = b; }
            }
            return best;
        }

        /* Hospedeiro orbital de um ponto (para lançar, semear poeira e o inspetor).
           Cada corpo c domina sua esfera de Hill em relação ao corpo mais pesado:
             r_H = d(c, pai) · (m_c / 3 m_pai)^{1/3}
           Vence a esfera mais justa que contém o ponto (a Lua orbita a Terra,
           não o Sol, mesmo o Sol puxando mais). Fora de todas, usa a massa
           envolvida a partir do centro de massa (monopolo) — p.ex. poeira
           circumbinária orbita o par, não uma das estrelas. */
        function hostAt(w, x, y, exclude, out) {
            const B = w.bodies;
            let h1 = null, h2 = null;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                if (b === exclude) continue;
                if (!h1 || b.m > h1.m) { h2 = h1; h1 = b; } else if (!h2 || b.m > h2.m) h2 = b;
            }
            out.body = null;
            if (!h1) { out.m = 0; out.x = 0; out.y = 0; out.vx = 0; out.vy = 0; return out; }
            let best = null, bestR = Infinity;
            for (let i = 0; i < B.length; i++) {
                const c = B[i];
                if (c === exclude || (exclude && c.m <= exclude.m)) continue;
                const parent = c === h1 ? h2 : h1;
                let rH = Infinity;
                if (parent) {
                    const pdx = c.x - parent.x, pdy = c.y - parent.y;
                    rH = Math.sqrt(pdx * pdx + pdy * pdy) * Math.cbrt(c.m / (3 * parent.m));
                }
                const dx = x - c.x, dy = y - c.y;
                if (dx * dx + dy * dy < rH * rH && rH < bestR) { best = c; bestR = rH; }
            }
            if (best) {
                out.body = best; out.m = best.m; out.x = best.x; out.y = best.y; out.vx = best.vx; out.vy = best.vy;
                return out;
            }
            let M = 0, X = 0, Y = 0, VX = 0, VY = 0;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                if (b === exclude) continue;
                M += b.m; X += b.m * b.x; Y += b.m * b.y; VX += b.m * b.vx; VY += b.m * b.vy;
            }
            X /= M; Y /= M; VX /= M; VY /= M;
            const r2 = (x - X) * (x - X) + (y - Y) * (y - Y);
            let Min = 0;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                if (b === exclude) continue;
                if ((b.x - X) * (b.x - X) + (b.y - Y) * (b.y - Y) < r2) Min += b.m;
            }
            out.m = Min > 0 ? Min : M; out.x = X; out.y = Y; out.vx = VX; out.vy = VY;
            return out;
        }

        /** Sentido de rotação dominante (sinal de L_z total); +1 = anti-horário. */
        function spinSign(w) {
            const B = w.bodies;
            let L = 0;
            for (let i = 0; i < B.length; i++) {
                const b = B[i];
                L += b.m * (b.x * b.vy - b.y * b.vx);
            }
            return L < 0 ? -1 : 1;
        }

        /* Raio físico a partir da massa (UA):
             rochoso   ρ = 5,5 g/cm³  →  R = (3m / 4πρ)^{1/3}
             gasoso    R ≈ R♃ (m/M♃)^{0,45}, saturando em R♃ (degenerescência)
             estrela   R ≈ R☉ (m/M☉)^{0,8}  (sequência principal) */
        function radiusFor(m, kind) {
            if (kind === 'blackhole') return 0;
            if (kind === 'star' || kind === 'sun' || m >= 0.075) return R_SUN * Math.pow(m, 0.8);
            if (m >= 3e-5) return 69911 * KM * Math.pow(Math.min(1, m / M_JUP), 0.45);
            const kg = m * 1.98847e30;
            const meters = Math.cbrt((3 * kg) / (4 * Math.PI * 5500));
            return (meters / 1000) * KM;
        }

        return {
            TAU, G, C_LIGHT, KMS_PER_AU_YR, KM, KPC, R_SUN, M_EARTH, M_JUP, MAX_BODIES, TRAIL_N, DEG,
            schwarzschild, createWorld, addBody, addParticle, removeParticle, setRadius, hostAt,
            accelBodies, accelParticles, computeAccel, step, energy, momentum, edit, baseline, rescale, relDrift,
            toBarycenter, vCirc, kepler, meanFromTrue, elements, dominant, spinSign, radiusFor, prune
        };
    })();

    /* ---- Cenários (dados reais onde existem; tudo nas mesmas unidades) ----
       Cada cenário declara:
         dt    passo fixo (anos) — ~150+ passos na órbita mais rápida que importa
         eps   softening de Plummer (UA) — muito menor que as separações relevantes
         rate  anos simulados por segundo real na velocidade 1×
         fit   raio (UA) enquadrado pela câmera ao carregar
         cull  raio além do qual a poeira é descartada
         well  massa (M☉) do poço gravitacional temporário (ferramenta A)
         spawn massas oferecidas ao lançar corpos */
    const Scenes = (function () {
        const P = Physics;
        const G = P.G;
        const KM = P.KM;
        const KPC = P.KPC;
        const DEG = P.DEG;
        const TAU = P.TAU;
        const S = { x: 0, y: 0, vx: 0, vy: 0 };

        const PRESET_SOLAR = [
            { label: 'Lua', m: 3.694e-8 },
            { label: 'Terra', m: 3.003e-6 },
            { label: 'Júpiter', m: 9.548e-4 },
            { label: 'Anã vermelha', m: 0.15 },
            { label: 'Buraco negro', m: 10, kind: 'blackhole' }
        ];

        function rand(a, b) { return a + Math.random() * (b - a); }

        /* Sistema Solar em J2000: semieixo a, excentricidade e, longitude do
           periélio ϖ e longitude média L (Standish, JPL). Anomalia média
           M = L − ϖ. Lua no baricentro Terra-Lua (hierárquico). */
        const PLANETS = [
            ['Mercúrio', 1.6601e-7, 0.38709927, 0.20563593, 77.45779628, 252.2503235, 2439.7, '#9ca3af', 'planet', 2.8],
            ['Vênus', 2.4478e-6, 0.72333566, 0.00677672, 131.60246718, 181.9790995, 6051.8, '#f59e0b', 'planet', 4],
            ['Terra', 3.0035e-6, 1.00000261, 0.01671123, 102.93768193, 100.46457166, 6371, '#3b82f6', 'earth', 4.2],
            ['Marte', 3.2272e-7, 1.52371034, 0.0933941, 336.05637041, 355.44656795, 3389.5, '#ef4444', 'mars', 3.4],
            ['Júpiter', 9.5479e-4, 5.202887, 0.04838624, 14.72847983, 34.39644051, 69911, '#e8b86a', 'jupiter', 7],
            ['Saturno', 2.8589e-4, 9.53667594, 0.05386179, 92.59887831, 49.95424423, 58232, '#f5d0a6', 'saturn', 6.4],
            ['Urano', 4.3662e-5, 19.18916464, 0.04725744, 170.9542763, 313.23810451, 25362, '#7dd3fc', 'ice', 5],
            ['Netuno', 5.1514e-5, 30.06992276, 0.00859048, 44.96476227, 304.87997031, 24622, '#2563eb', 'ice', 5]
        ];

        function sun(w, name) {
            return P.addBody(w, { m: 1, kind: 'sun', name: name || 'Sol', color: '#ffd35c', vis: 11, R: P.R_SUN });
        }

        function ringOf(w, host, r0, r1, n, cols, szMin, szMax, ecc) {
            for (let i = 0; i < n; i++) {
                const r = r0 + Math.random() * (r1 - r0);
                const a = Math.random() * TAU;
                const v = P.vCirc(host.m, r, w.eps2) * (1 + (ecc ? (Math.random() - 0.5) * ecc : 0));
                P.addParticle(
                    w,
                    host.x + Math.cos(a) * r,
                    host.y + Math.sin(a) * r,
                    host.vx - Math.sin(a) * v,
                    host.vy + Math.cos(a) * v,
                    cols[i % cols.length],
                    rand(szMin, szMax)
                );
            }
        }

        const list = [
            {
                id: 'solar', name: 'Sistema Solar', chip: '#ffd35c',
                toast: 'Massas e órbitas reais (J2000). Pinça ou roda para ver Saturno a Netuno.',
                dt: 2.5e-4, eps: 5e-5, rate: 0.25, fit: 5.8, cull: 400, well: 1,
                spawn: PRESET_SOLAR, spawnDefault: 1,
                build(w, c) {
                    const s = sun(w);
                    for (let i = 0; i < PLANETS.length; i++) {
                        const p = PLANETS[i];
                        const name = p[0], m = p[1], a = p[2], e = p[3], varpi = p[4] * DEG, M = (p[5] - p[4]) * DEG;
                        if (name === 'Terra') {
                            // Baricentro Terra-Lua na órbita; Terra e Lua repartem a separação pelas massas.
                            const mL = 3.6943e-8;
                            P.kepler(G * (1 + m + mL), a, e, varpi, M, S);
                            const bx = S.x, by = S.y, bvx = S.vx, bvy = S.vy;
                            P.kepler(G * (m + mL), 384400 * KM, 0.0549, 0.4, 1.7, S);
                            const fE = mL / (m + mL), fL = m / (m + mL);
                            P.addBody(w, { x: bx - S.x * fE, y: by - S.y * fE, vx: bvx - S.vx * fE, vy: bvy - S.vy * fE, m, kind: 'planet', tex: 'earth', name, color: p[7], vis: p[9], R: p[6] * KM });
                            P.addBody(w, { x: bx + S.x * fL, y: by + S.y * fL, vx: bvx + S.vx * fL, vy: bvy + S.vy * fL, m: mL, kind: 'moon', tex: 'moon', name: 'Lua', color: '#cbd5e1', vis: 2.2, R: 1737.4 * KM });
                            continue;
                        }
                        P.kepler(G * (1 + m), a, e, varpi, M, S);
                        P.addBody(w, { x: S.x, y: S.y, vx: S.vx, vy: S.vy, m, kind: 'planet', tex: p[8], name, color: p[7], vis: p[9], R: p[6] * KM });
                    }
                    // Cometas: Halley (retrógrado, i = 162°) e Encke, ambos a caminho do periélio.
                    P.kepler(G, 17.834, 0.96714, 169.75 * DEG, -20 * DEG, S, true);
                    P.addBody(w, { x: S.x, y: S.y, vx: S.vx, vy: S.vy, m: 1.1e-16, kind: 'comet', tex: 'comet', name: 'Halley', color: '#e0f2fe', vis: 2.2, R: 5.5 * KM });
                    P.kepler(G, 2.2152, 0.8483, 161.1 * DEG, -40 * DEG, S);
                    P.addBody(w, { x: S.x, y: S.y, vx: S.vx, vy: S.vy, m: 4.6e-18, kind: 'comet', tex: 'comet', name: 'Encke', color: '#bae6fd', vis: 2, R: 2.4 * KM });

                    // Cinturão principal: 2,1–3,3 UA, e ≤ 0,15, fases aleatórias.
                    const belt = [c.col('#c4b5fd'), c.col('#a8a29e'), c.col('#fde68a')];
                    for (let i = 0; i < 230; i++) {
                        P.kepler(G, rand(2.1, 3.3), Math.random() * 0.15, Math.random() * TAU, Math.random() * TAU, S);
                        P.addParticle(w, S.x, S.y, S.vx, S.vy, belt[i % 3], rand(0.8, 1.6));
                    }
                    // Troianos: L4 e L5 de Júpiter (±60° na mesma órbita) — estáveis de verdade.
                    const jup = w.bodies.find((b) => b.name === 'Júpiter');
                    const troj = c.col('#86efac');
                    for (let i = 0; i < 40; i++) {
                        const ang = (i % 2 ? 60 : -60) * DEG + (Math.random() - 0.5) * 0.35;
                        const k = 1 + (Math.random() - 0.5) * 0.04;
                        const ca = Math.cos(ang), sa = Math.sin(ang);
                        P.addParticle(w, (jup.x * ca - jup.y * sa) * k, (jup.x * sa + jup.y * ca) * k, (jup.vx * ca - jup.vy * sa) / Math.sqrt(k), (jup.vx * sa + jup.vy * ca) / Math.sqrt(k), troj, rand(0.9, 1.5));
                    }
                    void s;
                }
            },
            {
                id: 'binary', name: 'Binárias', chip: '#60a5fa',
                toast: 'α Centauri A e B: e = 0,52, período de 80 anos. Discos se truncam no periastro.',
                dt: 2e-3, eps: 1e-4, rate: 4, fit: 24, cull: 3000, well: 2,
                spawn: PRESET_SOLAR, spawnDefault: 1,
                build(w, c) {
                    /* Órbita relativa de α Cen AB (Pourbaix & Boffin 2016):
                       a = 23,3 UA, e = 0,5179, mA = 1,0788 M☉, mB = 0,9092 M☉.
                       A = −(mB/M) r⃗_rel, B = +(mA/M) r⃗_rel → centro de massa em repouso. */
                    const mA = 1.0788, mB = 0.9092, M = mA + mB;
                    P.kepler(G * M, 23.3, 0.5179, 0.3, 2.4, S);
                    const A = P.addBody(w, { x: -S.x * mB / M, y: -S.y * mB / M, vx: -S.vx * mB / M, vy: -S.vy * mB / M, m: mA, kind: 'star', name: 'α Cen A', color: '#fde68a', vis: 10, R: 1.2175 * P.R_SUN });
                    const B = P.addBody(w, { x: S.x * mA / M, y: S.y * mA / M, vx: S.vx * mA / M, vy: S.vy * mA / M, m: mB, kind: 'star', name: 'α Cen B', color: '#fdba74', vis: 9, R: 0.8591 * P.R_SUN });
                    // Planeta hipotético tipo S (órbita só de A), dentro do limite de estabilidade (~2,8 UA).
                    P.kepler(G * (mA + 3e-6), 1.25, 0, 0, 0, S);
                    P.addBody(w, { x: A.x + S.x, y: A.y + S.y, vx: A.vx + S.vx, vy: A.vy + S.vy, m: 3e-6, kind: 'planet', tex: 'earth', name: 'Planeta S', color: '#3b82f6', vis: 3.6, R: 6371 * KM });
                    const ca = [c.theme(0), c.theme(1), c.theme(2)];
                    const cb = [c.theme(3), c.theme(4), c.theme(1)];
                    ringOf(w, A, 0.6, 2.6, 110, ca, 0.8, 1.6);
                    ringOf(w, B, 0.6, 2.4, 100, cb, 0.8, 1.6);
                    // Anel circumbinário (tipo P), além do limite crítico ~3a.
                    ringOf(w, { x: 0, y: 0, vx: 0, vy: 0, m: M }, 75, 115, 150, [c.theme(0), c.theme(2), c.theme(4)], 0.9, 1.8);
                }
            },
            {
                id: 'blackhole', name: 'Buraco Negro', chip: '#fb923c',
                toast: 'Sgr A*: 4,3 milhões de M☉, r_s = 0,085 UA. Uma estrela passa do raio de maré.',
                dt: 2.5e-7, eps: 0.01, rate: 6e-5, fit: 2.6, cull: 40, well: 1e6,
                spawn: [
                    { label: 'Júpiter', m: 9.548e-4 },
                    { label: 'Sol', m: 1 },
                    { label: 'Gigante 10 M☉', m: 10 },
                    { label: 'BN 4·10⁵ M☉', m: 4e5, kind: 'blackhole' }
                ],
                spawnDefault: 1,
                build(w, c) {
                    /* Sgr A* (GRAVITY 2019): M = 4,297·10⁶ M☉ → r_s = 2GM/c² = 0,0848 UA,
                       ISCO = 3 r_s = 0,254 UA. Gravidade newtoniana; a captura acontece
                       ao cruzar o horizonte r_s. O disco começa na ISCO, onde na
                       Relatividade Geral termina a última órbita circular estável. */
                    const bh = P.addBody(w, { m: 4.297e6, kind: 'blackhole', name: 'Sgr A*', color: '#1a1a2e', vis: 6 });
                    const isco = 3 * bh.R;
                    ringOf(w, bh, isco * 1.02, 1.6, 300, [c.col('#fde68a'), c.col('#fb923c'), c.col('#a78bfa'), c.col('#f97316')], 0.8, 1.7);
                    /* Estrela tipo Sol numa órbita excêntrica: q = 0,45 UA < r_t = R☉ (M/m)^{1/3} ≈ 0,76 UA.
                       Começa a f = −140° (a caminho do pericentro). */
                    const a = 3.2, e = 1 - 0.45 / a;
                    P.kepler(G * (bh.m + 1), a, e, 200 * DEG, P.meanFromTrue(-140 * DEG, e), S);
                    P.addBody(w, { x: S.x, y: S.y, vx: S.vx, vy: S.vy, m: 1, kind: 'star', name: 'S★', color: '#fde68a', vis: 6, R: P.R_SUN });
                    w.tdeCol = c.col('#fff1c1');
                }
            },
            {
                id: 'galaxy', name: 'Colisão', chip: '#e879f9',
                toast: 'Encontro de galáxias à la Toomre & Toomre (1972): o disco prógrado solta caudas de maré.',
                dt: 5e5, eps: 1.5 * KPC, rate: 8e7, fit: 45 * KPC, cull: 600 * KPC, well: 5e10,
                spawn: [
                    { label: 'Aglomerado 10⁸', m: 1e8, kind: 'star', tex: 'core', R: 0.3 * KPC, vis: 3 },
                    { label: 'Anã 10⁹', m: 1e9, kind: 'star', tex: 'core', R: 0.8 * KPC, vis: 5 },
                    { label: 'Galáxia 10¹⁰', m: 1e10, kind: 'star', tex: 'core', R: 1.5 * KPC, vis: 7 },
                    { label: 'BN 10⁹', m: 1e9, kind: 'blackhole' }
                ],
                spawnDefault: 1,
                build(w, c) {
                    /* Toomre: núcleos pontuais (halo amortecido por ε = 1,5 kpc) e
                       discos de partículas-teste em órbitas circulares. Órbita
                       relativa ligada (v = 0,75 v_esc, quase parabólica como nos
                       encontros reais) com pericentro q:
                         ε = v²/2 − GM/r₀,  h² = 2q²(ε + GM/q),  v_t = h/r₀,  v_r = −√(v² − v_t²) */
                    const m1 = 1e11, m2 = 4e10, M = m1 + m2;
                    const q = 20 * KPC, r0 = 75 * KPC;
                    const v = 0.75 * Math.sqrt((2 * G * M) / r0);
                    const en = (v * v) / 2 - (G * M) / r0;
                    const vt = Math.sqrt(2 * q * q * (en + (G * M) / q)) / r0;
                    const vr = -Math.sqrt(Math.max(0, v * v - vt * vt));
                    const th = 200 * DEG;
                    const ux = Math.cos(th), uy = Math.sin(th);
                    const rx = ux * r0, ry = uy * r0;
                    const rvx = ux * vr - uy * vt, rvy = uy * vr + ux * vt;
                    const A = P.addBody(w, { x: -rx * m2 / M, y: -ry * m2 / M, vx: -rvx * m2 / M, vy: -rvy * m2 / M, m: m1, kind: 'star', tex: 'core', name: 'Azul', color: '#93c5fd', vis: 9, R: 2 * KPC });
                    const B = P.addBody(w, { x: rx * m1 / M, y: ry * m1 / M, vx: rvx * m1 / M, vy: rvy * m1 / M, m: m2, kind: 'star', tex: 'core', name: 'Magenta', color: '#f0abfc', vis: 7, R: 1.4 * KPC });
                    // Disco A prógrado (mesmo sentido da órbita) → caudas; disco B retrógrado → quase intacto.
                    disk(w, A, 3 * KPC, 16 * KPC, 330, [c.theme(0), c.theme(1), c.col('#bfdbfe')], 1);
                    disk(w, B, 2.5 * KPC, 11 * KPC, 230, [c.theme(3), c.theme(2), c.col('#f5d0fe')], -1);
                }
            },
            {
                id: 'threebody', name: 'Três Corpos', chip: '#34d399',
                toast: 'Figura-8 de Chenciner–Montgomery: três sóis numa única curva.',
                dt: 2.5e-4, eps: 1e-6, rate: 0.25, fit: 1.7, cull: 200, well: 1,
                spawn: [
                    { label: 'Terra', m: 3.003e-6 },
                    { label: 'Júpiter', m: 9.548e-4 },
                    { label: 'Anã vermelha', m: 0.15 },
                    { label: 'Sol', m: 1 }
                ],
                spawnDefault: 1,
                build(w, c) {
                    /* Chenciner & Montgomery (2000), em G = m = 1:
                         x₁ = −x₂ = (0,97000436, −0,24308753), x₃ = 0
                         v₃ = (−0,93240737, −0,86473146), v₁ = v₂ = −v₃/2,  T = 6,32591398
                       Escala para m = 1 M☉ e L = 1 UA: v × √(Gm/L) = v × 2π; T → 1,0068 ano. */
                    const k = Math.sqrt(G);
                    const x1 = 0.97000436, y1 = -0.24308753;
                    const v3x = -0.93240737, v3y = -0.86473146;
                    const R = P.R_SUN;
                    P.addBody(w, { x: x1, y: y1, vx: -v3x / 2 * k, vy: -v3y / 2 * k, m: 1, kind: 'sun', name: 'Alfa', color: '#fde68a', vis: 8, R });
                    P.addBody(w, { x: -x1, y: -y1, vx: -v3x / 2 * k, vy: -v3y / 2 * k, m: 1, kind: 'sun', name: 'Beta', color: '#67e8f9', vis: 8, R });
                    P.addBody(w, { x: 0, y: 0, vx: v3x * k, vy: v3y * k, m: 1, kind: 'sun', name: 'Gama', color: '#f9a8d4', vis: 8, R });
                    ringOf(w, { x: 0, y: 0, vx: 0, vy: 0, m: 3 }, 2.6, 3.6, 110, [c.theme(0), c.theme(1), c.theme(2), c.theme(3)], 0.8, 1.5);
                }
            },
            {
                id: 'rings', name: 'Anéis', chip: '#fbbf24',
                toast: 'Saturno real: anéis C, B, A e F, divisão de Cassini, pastoras e luas.',
                dt: 4e-6, eps: 50 * KM, rate: 5e-4, fit: 300000 * KM, cull: 0.05, well: 2.858e-4,
                spawn: [
                    { label: 'Pastora', m: 8e-14 },
                    { label: 'Mimas', m: 1.8855e-11 },
                    { label: 'Titã', m: 6.765e-8 },
                    { label: 'Terra', m: 3.003e-6 }
                ],
                spawnDefault: 1,
                build(w, c) {
                    /* Saturno: M = 2,858·10⁻⁴ M☉, R = 60 268 km. Anéis (km):
                       C 74 658–92 000, B 92 000–117 580, Cassini 117 580–122 170 (vazia),
                       A 122 170–136 775, F 140 180. Luas com a (km) e massas reais. */
                    const sat = P.addBody(w, { m: 2.858e-4, kind: 'planet', tex: 'saturn-body', name: 'Saturno', color: '#f5d0a6', vis: 10, R: 60268 * KM });
                    ringOf(w, sat, 74658 * KM, 92000 * KM, 80, [c.col('#a8a29e'), c.col('#78716c')], 0.7, 1.2);
                    ringOf(w, sat, 92000 * KM, 117580 * KM, 230, [c.col('#fde68a'), c.col('#f5e7c6'), c.col('#fcd34d')], 0.8, 1.6);
                    ringOf(w, sat, 122170 * KM, 136775 * KM, 170, [c.col('#e7e5e4'), c.col('#fef3c7')], 0.8, 1.4);
                    ringOf(w, sat, 139900 * KM, 140500 * KM, 50, [c.col('#e0f2fe')], 0.7, 1.1);
                    const moons = [
                        ['Prometeu', 8.02e-14, 139380, 0.0022, 86],
                        ['Pandora', 6.89e-14, 141720, 0.0042, 81],
                        ['Mimas', 1.8855e-11, 185539, 0.0196, 198],
                        ['Encélado', 5.4324e-11, 237948, 0.0047, 252],
                        ['Tétis', 3.1052e-10, 294619, 0.0001, 531],
                        ['Dione', 5.509e-10, 377396, 0.0022, 561],
                        ['Reia', 1.15995e-9, 527108, 0.0013, 764],
                        ['Titã', 6.765e-8, 1221870, 0.0288, 2575]
                    ];
                    for (let i = 0; i < moons.length; i++) {
                        const mo = moons[i];
                        P.kepler(G * (sat.m + mo[1]), mo[2] * KM, mo[3], i * 1.3, i * 2.1 + 0.5, S);
                        P.addBody(w, { x: S.x, y: S.y, vx: S.vx, vy: S.vy, m: mo[1], kind: 'moon', tex: i === 7 ? 'titan' : 'moon', name: mo[0], color: i === 7 ? '#fbbf24' : '#cbd5e1', vis: i < 2 ? 1.6 : (i === 7 ? 3.6 : 2.4), R: mo[4] * KM });
                    }
                }
            },
            {
                id: 'chaos', name: 'Caos', chip: '#f472b6',
                toast: 'Aglomerado frio (Q = 0,3): colapsa, funde estrelas e ejeta as leves.',
                dt: 1e-4, eps: 0.02, rate: 1.5, fit: 10, cull: 800, well: 3,
                spawn: [
                    { label: 'Júpiter', m: 9.548e-4 },
                    { label: 'Anã vermelha', m: 0.2 },
                    { label: 'Sol', m: 1 },
                    { label: 'Buraco negro', m: 10, kind: 'blackhole' }
                ],
                spawnDefault: 2,
                build(w, c) {
                    /* 8 estrelas, m log-uniforme em [0,3; 3] M☉, posições num disco de 8 UA.
                       Velocidades aleatórias reescaladas para a razão virial Q = K/|U| = 0,3
                       (sub-virial → colapso). Raio de colisão realçado f = 25 (técnica de
                       Kokubo & Ida para acelerar encontros) — sem isso fusões estelares
                       seriam raríssimas na escala de segundos. */
                    const n = 8;
                    const cols = ['#fde68a', '#93c5fd', '#f9a8d4', '#86efac', '#fdba74', '#c4b5fd', '#67e8f9', '#fca5a5'];
                    let tries = 0;
                    while (w.bodies.length < n && tries++ < 500) {
                        const r = 8 * Math.sqrt(Math.random());
                        const a = Math.random() * TAU;
                        const x = Math.cos(a) * r, y = Math.sin(a) * r;
                        let ok = true;
                        for (let j = 0; j < w.bodies.length; j++) {
                            if (Math.hypot(w.bodies[j].x - x, w.bodies[j].y - y) < 1.6) { ok = false; break; }
                        }
                        if (!ok) continue;
                        const isBH = w.bodies.length === 0 && Math.random() < 0.35;
                        const m = isBH ? 8 : Math.exp(rand(Math.log(0.3), Math.log(3)));
                        const i = w.bodies.length;
                        P.addBody(w, {
                            x, y, vx: rand(-1, 1), vy: rand(-1, 1), m,
                            kind: isBH ? 'blackhole' : 'star',
                            name: isBH ? 'Poço' : 'Astro ' + (i + 1),
                            color: cols[i % cols.length],
                            vis: isBH ? 6 : 5 + 2 * Math.log10(m * 10),
                            R: isBH ? 0 : P.R_SUN * Math.pow(m, 0.8),
                            inflate: 25
                        });
                    }
                    P.toBarycenter(w);
                    // Reescala virial: v ← v √(Q |U| / K).
                    let K = 0;
                    for (let i = 0; i < w.bodies.length; i++) {
                        const b = w.bodies[i];
                        K += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
                    }
                    const U = P.energy(w) - K;
                    const f = Math.sqrt((0.3 * Math.abs(U)) / Math.max(K, 1e-30));
                    for (let i = 0; i < w.bodies.length; i++) { w.bodies[i].vx *= f; w.bodies[i].vy *= f; }
                    let M = 0;
                    for (let i = 0; i < w.bodies.length; i++) M += w.bodies[i].m;
                    ringOf(w, { x: 0, y: 0, vx: 0, vy: 0, m: M }, 3, 14, 170, [c.theme(0), c.theme(1), c.theme(2), c.theme(3), c.theme(4)], 0.8, 1.6, 0.4);
                }
            },
            {
                id: 'classic', name: 'Sandbox', chip: '#94a3b8',
                toast: 'Uma estrela e espaço vazio. Arraste para lançar; toque rápido = órbita circular.',
                dt: 2.5e-4, eps: 5e-5, rate: 0.25, fit: 3, cull: 400, well: 1,
                spawn: PRESET_SOLAR, spawnDefault: 1,
                build(w) {
                    sun(w);
                }
            }
        ];

        function disk(w, host, r0, r1, n, cols, dir) {
            for (let i = 0; i < n; i++) {
                const t = i / n;
                const r = r0 + (r1 - r0) * Math.sqrt(t * 0.98 + Math.random() * 0.02);
                const a = Math.random() * TAU;
                const v = P.vCirc(host.m, r, w.eps2) * dir;
                P.addParticle(w, host.x + Math.cos(a) * r, host.y + Math.sin(a) * r, host.vx - Math.sin(a) * v, host.vy + Math.cos(a) * v, cols[i % cols.length], rand(0.8, 1.7));
            }
        }

        function byId(id) {
            for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
            return null;
        }

        /** Prepara o mundo para um cenário: parâmetros, construção, CM em repouso, referência de E e P. */
        function load(w, sc, ctx) {
            w.bodies.length = 0;
            w.P.n = 0;
            w.t = 0;
            w.dt = sc.dt;
            w.eps2 = sc.eps * sc.eps;
            w.cull2 = sc.cull * sc.cull;
            w.well.on = false;
            w.well.eps2 = (sc.fit * 0.03) * (sc.fit * 0.03);
            w.tdeCol = 0;
            sc.build(w, ctx);
            Physics.toBarycenter(w);
            Physics.baseline(w);
        }

        return { list, byId, load };
    })();
    /* @@physics-end */

    // =====================================================================
    // UI
    // =====================================================================
    const TAU = Physics.TAU;
    const G = Physics.G;
    const MAX_PARTICLES = 1400;
    const MAX_FRAME_DT = 1 / 20;          // dt real do quadro limitado a 50 ms
    const STEP_BUDGET = 1.6e6;            // interações par-a-par por quadro (teto inicial de CPU)
    const SPEEDS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32, 64];
    const SPEED_DEFAULT = 4;
    const STORE_KEY = 'gravity.settings.v3';
    const TRAIL_N = Physics.TRAIL_N;

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const reduceMotionMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const coarseMQ = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
    let reduceMotion = !!(reduceMotionMQ && reduceMotionMQ.matches);

    let width = 0;
    let height = 0;
    let dpr = 1;
    let uiK = 1;

    const world = Physics.createWorld(MAX_PARTICLES);
    let scene = Scenes.list[0];
    let running = true;
    let acc = 0;               // tempo simulado acumulado ainda não integrado (anos)
    let limited = false;       // CPU não deu conta da velocidade pedida
    let stepsLastFrame = 0;
    let selected = null;
    let mouseMode = 'body';
    let camTouched = false;

    const cam = { x: 0, y: 0, s: 1, follow: false, vcx: 0, vcy: 0, fitR: 100, lastX: 0, lastY: 0 };

    const themes = {
        nebula: ['#c4b5fd', '#67e8f9', '#fde68a', '#f9a8d4', '#93c5fd'],
        neon: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'],
        fire: ['#ff4d00', '#ff9900', '#ffcc00', '#ff6b6b', '#fff3bf'],
        ice: ['#67e8f9', '#38bdf8', '#818cf8', '#e0f2fe', '#a5f3fc'],
        sunset: ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'],
        ocean: ['#00b4d8', '#90e0ef', '#0077b6', '#caf0f8', '#48bfe3'],
        galaxy: ['#c77dff', '#e0aaff', '#9d4edd', '#7b2cbf', '#ffd6ff'],
        aurora: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5', '#fee440']
    };

    /* Paleta da poeira: índices 0–4 = tema atual (trocar o tema recolore tudo),
       5+ = cores fixas de cenário (anéis, cinturão, disco de acreção). */
    const palette = themes.nebula.slice();
    const fixedColor = new Map();
    const paletteCount = new Int32Array(64);
    const sceneCtx = {
        theme: (i) => i % 5,
        col(hex) {
            if (fixedColor.has(hex)) return fixedColor.get(hex);
            if (palette.length >= 64) return 0;
            palette.push(hex);
            fixedColor.set(hex, palette.length - 1);
            return palette.length - 1;
        }
    };
    const SPEED_HUES = [];
    for (let i = 0; i < 8; i++) SPEED_HUES.push(`hsl(${Math.round(262 - i * 34)}, 92%, 64%)`);

    // ---- Configurações persistidas ----
    const settings = {
        theme: 'nebula',
        trails: true,
        labels: true,
        predict: true,
        collide: true,
        glow: true,
        stars: true,
        velColor: false,
        additive: false,
        spread: 8,
        speed: {},
        mass: {},
        hintSeen: false
    };

    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data && typeof data === 'object') {
                for (const k of Object.keys(settings)) {
                    if (k in data && typeof data[k] === typeof settings[k]) settings[k] = data[k];
                }
            }
            if (!themes[settings.theme]) settings.theme = 'nebula';
        } catch (err) {
            /* armazenamento indisponível (modo privado) — segue com o padrão */
        }
    }

    let saveTimer = 0;
    function saveSettings() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (err) { /* sem persistência */ }
        }, 200);
    }

    function applyTheme(name) {
        const t = themes[name] || themes.nebula;
        for (let i = 0; i < 5; i++) palette[i] = t[i];
    }

    // ---- Formatação (pt-BR) ----
    const nf3 = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 3 });
    const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

    function fmtNum(v) {
        return nf3.format(v);
    }

    function fmtSci(v, digits) {
        if (!Number.isFinite(v)) return '—';
        if (v === 0) return '0';
        const a = Math.abs(v);
        const ex = Math.floor(Math.log10(a));
        if (ex >= -2 && ex <= 3) return nf3.format(v);
        const mant = v / Math.pow(10, ex);
        const m = mant.toFixed(digits == null ? 1 : digits).replace('.', ',');
        return m + '·10' + String(ex).split('').map((ch) => SUP[ch]).join('');
    }

    const YEAR_S = 31557600;
    function fmtDuration(years) {
        const s = years * YEAR_S;
        if (s < 90) return fmtNum(s) + ' s';
        if (s < 5400) return fmtNum(s / 60) + ' min';
        if (s < 172800) return fmtNum(s / 3600) + ' h';
        if (s < 86400 * 60) return fmtNum(s / 86400) + ' dias';
        if (years < 2) return fmtNum(years * 12) + ' meses';
        if (years < 2000) return fmtNum(years) + ' anos';
        if (years < 2e6) return fmtNum(years / 1e3) + ' mil anos';
        if (years < 2e9) return fmtNum(years / 1e6) + ' mi de anos';
        return fmtNum(years / 1e9) + ' bi de anos';
    }

    function fmtLen(au) {
        const km = au / Physics.KM;
        if (au < 0.02) return fmtNum(km) + ' km';
        if (au < 2e4) return fmtNum(au) + ' UA';
        const pc = au / 206264.806;
        if (pc < 1000) return fmtNum(pc) + ' pc';
        return fmtNum(pc / 1000) + ' kpc';
    }

    function fmtMass(m) {
        if (m >= 0.05) return (m >= 1e4 ? fmtSci(m) : fmtNum(m)) + ' M☉';
        if (m >= 0.1 * Physics.M_JUP) return fmtNum(m / Physics.M_JUP) + ' M♃';
        if (m >= 1e-4 * Physics.M_EARTH) return fmtNum(m / Physics.M_EARTH) + ' M⊕';
        return fmtSci(m * 1.98847e30) + ' kg';
    }

    function fmtVel(v) {
        const kms = v * Physics.KMS_PER_AU_YR;
        if (kms < 1) return fmtNum(kms * 1000) + ' m/s';
        return fmtNum(kms) + ' km/s';
    }

    const KIND_LABEL = {
        sun: 'Estrela', star: 'Estrela', blackhole: 'Buraco negro', planet: 'Planeta', moon: 'Lua', comet: 'Cometa'
    };

    // ---- Câmera (mundo com y para cima → tela com y para baixo) ----
    function sx(x) { return cam.vcx + (x - cam.x) * cam.s; }
    function sy(y) { return cam.vcy - (y - cam.y) * cam.s; }
    function wx(px) { return cam.x + (px - cam.vcx) / cam.s; }
    function wy(py) { return cam.y - (py - cam.vcy) / cam.s; }

    function fitScale() {
        return cam.fitR / scene.fit;
    }

    function clampScale(s) {
        const f = fitScale();
        return Math.max(f / 25, Math.min(f * 20000, s));
    }

    function zoomAt(px, py, factor) {
        const bx = wx(px), by = wy(py);
        cam.s = clampScale(cam.s * factor);
        cam.x += bx - wx(px);
        cam.y += by - wy(py);
        camTouched = true;
    }

    /** Área livre entre o HUD (topo) e o dock (base): o cenário é enquadrado nela. */
    function measureView() {
        const hud = document.getElementById('hud');
        const dock = document.getElementById('dock');
        let top = 0;
        let bottom = height;
        try {
            // Em paisagem curta o HUD é uma faixa fina e translúcida: enquadra a partir do header.
            const short = height < 520 && width > height;
            const hr = (short ? document.querySelector('header') || hud : hud).getBoundingClientRect();
            const dr = dock.getBoundingClientRect();
            top = hr.bottom + 6;
            bottom = dr.top - 6;
        } catch (err) { /* sem layout ainda */ }
        if (bottom - top < 140) { top = 0; bottom = height; }
        cam.vcx = width / 2;
        cam.vcy = (top + bottom) / 2;
        cam.fitR = Math.max(60, Math.min(width / 2 - 12, (bottom - top) / 2) * 0.94);
    }

    function fitCamera() {
        measureView();
        cam.x = 0;
        cam.y = 0;
        cam.s = fitScale();
        cam.follow = false;
        camTouched = false;
        syncFollowBtn();
    }

    function resize() {
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;
        if (cssW === 0 || cssH === 0) return;
        const oldMin = Math.min(width, height);
        const ratio = window.devicePixelRatio || 1;
        // iPhone: N-corpos + trails a 3× DPR derrete a bateria; 1.25× basta.
        const appleTouch = /iP(hone|ad|od)/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        dpr = Math.min(ratio, appleTouch ? 1.25 : (cssW < 768 ? 1.75 : 2));
        width = cssW;
        height = cssH;
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        uiK = Math.max(0.62, Math.min(1.15, Math.min(cssW, cssH) / 820));
        generateStars();
        generateNebula();
        if (!oldMin || !camTouched) {
            fitCamera();
        } else {
            const prevFit = cam.fitR;
            measureView();
            cam.s = clampScale(cam.s * (cam.fitR / prevFit));
        }
        syncDockVar();
    }

    // ---- Starfield + nebula ----
    let stars = [];
    let nebulaCanvas = null;

    function generateStars() {
        stars = [];
        const count = Math.min(260, Math.floor((width * height) / 6500));
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.3 + 0.2,
                phase: Math.random() * TAU,
                speed: 0.4 + Math.random() * 1.6,
                par: 0.15 + Math.random() * 0.55,
                tint: Math.random() < 0.12 ? '#c4b5fd' : Math.random() < 0.08 ? '#fde68a' : '#ffffff'
            });
        }
    }

    function generateNebula() {
        const nebula = [
            { x: 0.18, y: 0.28, r: 0.42, c: 'rgba(88, 40, 160, 0.16)' },
            { x: 0.78, y: 0.22, r: 0.38, c: 'rgba(20, 80, 160, 0.14)' },
            { x: 0.62, y: 0.78, r: 0.44, c: 'rgba(160, 40, 90, 0.1)' },
            { x: 0.28, y: 0.72, r: 0.32, c: 'rgba(20, 140, 150, 0.1)' }
        ];
        if (!nebulaCanvas) nebulaCanvas = document.createElement('canvas');
        const pad = 120;
        nebulaCanvas.width = Math.max(1, width + pad * 2);
        nebulaCanvas.height = Math.max(1, height + pad * 2);
        const nctx = nebulaCanvas.getContext('2d');
        nctx.clearRect(0, 0, nebulaCanvas.width, nebulaCanvas.height);
        for (let i = 0; i < nebula.length; i++) {
            const n = nebula[i];
            const x = pad + n.x * width;
            const y = pad + n.y * height;
            const rad = n.r * Math.max(width, height);
            const g = nctx.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, n.c);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            nctx.fillStyle = g;
            nctx.beginPath();
            nctx.arc(x, y, rad, 0, TAU);
            nctx.fill();
        }
    }

    function drawBackdrop(t) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#04040c';
        ctx.fillRect(0, 0, width, height);

        // Paralaxe em pixels de tela: independe da escala física do cenário.
        const panX = cam.x * cam.s;
        const panY = -cam.y * cam.s;
        if (nebulaCanvas) {
            const ox = Math.max(-110, Math.min(110, -panX * 0.03));
            const oy = Math.max(-110, Math.min(110, -panY * 0.03));
            ctx.drawImage(nebulaCanvas, ox - 120, oy - 120, width + 240, height + 240);
        }

        if (!settings.stars) return;
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            let x = s.x - panX * s.par * 0.06;
            let y = s.y - panY * s.par * 0.06;
            x = ((x % width) + width) % width;
            y = ((y % height) + height) % height;
            const tw = reduceMotion ? 0.75 : 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * 0.0007 * s.speed + s.phase));
            ctx.globalAlpha = tw * 0.85;
            ctx.fillStyle = s.tint;
            ctx.beginPath();
            ctx.arc(x, y, s.r, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Sprites (cache por cor) ----
    const glowCache = new Map();
    const surfaceCache = new Map();

    function getGlowSprite(color) {
        if (glowCache.has(color)) return glowCache.get(color);
        const size = 128;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const gctx = c.getContext('2d');
        const g = gctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size / 2);
        g.addColorStop(0, color);
        g.addColorStop(0.4, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        gctx.fillStyle = g;
        gctx.fillRect(0, 0, size, size);
        glowCache.set(color, c);
        return c;
    }

    function getPlanetSurfaceSprite(key, builder) {
        if (surfaceCache.has(key)) return surfaceCache.get(key);
        const size = 128;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const sctx = c.getContext('2d');
        builder(sctx, size / 2, size / 2, size * 0.46);
        surfaceCache.set(key, c);
        return c;
    }

    const rgbCache = new Map();
    function colorAlpha(hex, a) {
        let rgb = rgbCache.get(hex);
        if (!rgb) {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            rgb = m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : '255, 255, 255';
            rgbCache.set(hex, rgb);
        }
        return `rgba(${rgb}, ${a})`;
    }

    function drawGlow(s, r, color, mul) {
        if (!settings.glow) return;
        const outer = r * mul * 1.2;
        const sprite = getGlowSprite(color);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(sprite, s.x - outer, s.y - outer, outer * 2, outer * 2);
        ctx.globalAlpha = 1;
    }

    function drawSun(s, r, b) {
        const t = b.spin;
        const glowR = r * (2.6 + Math.sin(t * 2) * 0.12 + b.flash * 0.4);
        drawGlow(s, r, colorAlpha(b.color, 0.75), glowR / r);

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(t * 0.4);
        ctx.strokeStyle = colorAlpha(b.color, 0.22);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.2, r * 0.12);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = i * TAU / 10;
            const len = r * (1.55 + 0.35 * Math.sin(t * 3 + i));
            ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
            ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        }
        ctx.stroke();
        ctx.restore();

        const sunSprite = getPlanetSurfaceSprite('sun:' + b.color, (sctx, cx, cy, cr) => {
            const core = sctx.createRadialGradient(cx - cr * 0.2, cy - cr * 0.2, cr * 0.1, cx, cy, cr);
            core.addColorStop(0, '#fff7d1');
            core.addColorStop(0.45, b.color);
            core.addColorStop(1, '#ea580c');
            sctx.fillStyle = core;
            sctx.beginPath();
            sctx.arc(cx, cy, cr, 0, TAU);
            sctx.fill();
        });
        const d = r / 0.46;
        ctx.drawImage(sunSprite, s.x - d / 2, s.y - d / 2, d, d);
    }

    /* Núcleo galáctico: bojo difuso (perfil ~ exponencial) em vez de disco sólido. */
    function drawCore(s, r, b) {
        drawGlow(s, r, colorAlpha(b.color, 0.5), 4.2);
        drawGlow(s, r, 'rgba(255, 250, 235, 0.85)', 1.4 + b.flash * 0.5);
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(1.5, r * 0.35), 0, TAU);
        ctx.fill();
    }

    function drawBlackHole(s, r, b) {
        drawGlow(s, r, 'rgba(255, 160, 70, 0.55)', 2.8 + b.flash * 0.6);

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(b.spin * 0.7);
        ctx.scale(1, 0.34);
        const disk = ctx.createRadialGradient(0, 0, r * 0.85, 0, 0, r * 2.7);
        disk.addColorStop(0, 'rgba(0,0,0,0)');
        disk.addColorStop(0.22, 'rgba(255, 244, 200, 0.95)');
        disk.addColorStop(0.42, 'rgba(255, 140, 50, 0.7)');
        disk.addColorStop(0.7, 'rgba(90, 120, 255, 0.32)');
        disk.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = disk;
        ctx.beginPath();
        ctx.arc(0, 0, r * 2.7, 0, TAU);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(160, 190, 255, 0.28)';
        ctx.lineWidth = Math.max(1.5, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - r * 3.6);
        ctx.lineTo(s.x, s.y - r * 1.15);
        ctx.moveTo(s.x, s.y + r * 1.15);
        ctx.lineTo(s.x, s.y + r * 3.6);
        ctx.stroke();

        // Anel de fótons (~1,5 r_s visto de longe, a sombra aparente tem ~2,6 r_s).
        ctx.strokeStyle = 'rgba(255, 220, 170, 0.9)';
        ctx.lineWidth = Math.max(1.4, r * 0.08);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 1.18, 0, TAU);
        ctx.stroke();

        ctx.fillStyle = '#010104';
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.fill();
    }

    function drawPlanet(s, r, b) {
        drawGlow(s, r, colorAlpha(b.color, 0.62), 2.45 + b.flash * 0.5);
        const sprite = getPlanetSurfaceSprite('planet:' + b.color, (sctx, cx, cy, cr) => {
            const g = sctx.createRadialGradient(cx - cr * 0.3, cy - cr * 0.35, cr * 0.1, cx, cy, cr);
            g.addColorStop(0, 'rgba(255,255,255,0.55)');
            g.addColorStop(0.35, b.color);
            g.addColorStop(1, 'rgba(0,0,0,0.55)');
            sctx.fillStyle = g;
            sctx.beginPath();
            sctx.arc(cx, cy, cr, 0, TAU);
            sctx.fill();
        });
        const d = r / 0.46;
        ctx.drawImage(sprite, s.x - d / 2, s.y - d / 2, d, d);
    }

    function drawMars(s, r, b) {
        // Atmosfera âmbar empoeirada
        drawGlow(s, r, 'rgba(234, 88, 12, 0.48)', 1.9 + b.flash * 0.4);
        const sprite = getPlanetSurfaceSprite('mars', (sctx, cx, cy, cr) => {
            sctx.save();
            sctx.beginPath();
            sctx.arc(cx, cy, cr, 0, TAU);
            sctx.clip();

            const base = sctx.createRadialGradient(cx - cr * 0.28, cy - cr * 0.28, cr * 0.1, cx, cy, cr);
            base.addColorStop(0, '#fb923c');
            base.addColorStop(0.5, '#c2410c');
            base.addColorStop(1, '#431407');
            sctx.fillStyle = base;
            sctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);

            // Cânions escuros Valles Marineris
            sctx.strokeStyle = 'rgba(67, 20, 7, 0.72)';
            sctx.lineWidth = cr * 0.11;
            sctx.lineCap = 'round';
            sctx.beginPath();
            sctx.moveTo(cx - cr * 0.65, cy + cr * 0.08);
            sctx.quadraticCurveTo(cx - cr * 0.05, cy - cr * 0.06, cx + cr * 0.58, cy + cr * 0.14);
            sctx.stroke();

            // Crateras marcianas
            const craters = [
                [-0.32, -0.22, 0.18],
                [0.28, 0.34, 0.22],
                [-0.18, 0.42, 0.14]
            ];
            for (const [ox, oy, crR] of craters) {
                sctx.fillStyle = 'rgba(67, 20, 7, 0.45)';
                sctx.beginPath();
                sctx.arc(cx + ox * cr, cy + oy * cr, crR * cr, 0, TAU);
                sctx.fill();
                sctx.strokeStyle = 'rgba(254, 215, 170, 0.35)';
                sctx.lineWidth = Math.max(1, cr * 0.04);
                sctx.beginPath();
                sctx.arc(cx + ox * cr, cy + oy * cr, crR * cr, Math.PI * 0.8, Math.PI * 1.7);
                sctx.stroke();
            }

            // Calotas polares brancas
            sctx.fillStyle = 'rgba(255, 247, 237, 0.88)';
            sctx.beginPath();
            sctx.ellipse(cx, cy - cr * 0.88, cr * 0.42, cr * 0.16, 0, 0, TAU);
            sctx.fill();
            sctx.beginPath();
            sctx.ellipse(cx, cy + cr * 0.91, cr * 0.3, cr * 0.11, 0, 0, TAU);
            sctx.fill();
            sctx.restore();
        });
        const d = r / 0.46;
        ctx.drawImage(sprite, s.x - d / 2, s.y - d / 2, d, d);
    }

    function drawIce(s, r, b) {
        // Mundo glacial estilo Europa / Urano com fissuras ciano e reflexo cristalino
        drawGlow(s, r, 'rgba(56, 189, 248, 0.52)', 2.1 + b.flash * 0.4);
        const sprite = getPlanetSurfaceSprite('ice:' + b.color, (sctx, cx, cy, cr) => {
            sctx.save();
            sctx.beginPath();
            sctx.arc(cx, cy, cr, 0, TAU);
            sctx.clip();

            const base = sctx.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, cr * 0.08, cx, cy, cr);
            base.addColorStop(0, '#f0f9ff');
            base.addColorStop(0.45, b.color || '#7dd3fc');
            base.addColorStop(1, '#0c4a6e');
            sctx.fillStyle = base;
            sctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);

            // Fissuras glaciais ciano cruzadas (Europa lineae)
            sctx.strokeStyle = 'rgba(14, 116, 144, 0.62)';
            sctx.lineWidth = Math.max(1.2, cr * 0.06);
            const lines = [
                [-0.8, -0.3, 0.1, 0.05, 0.85, -0.2],
                [-0.7, 0.35, -0.1, 0.12, 0.75, 0.45],
                [-0.35, -0.85, 0.05, -0.1, 0.35, 0.85]
            ];
            for (const [x0, y0, cx1, cy1, x1, y1] of lines) {
                sctx.beginPath();
                sctx.moveTo(cx + x0 * cr, cy + y0 * cr);
                sctx.quadraticCurveTo(cx + cx1 * cr, cy + cy1 * cr, cx + x1 * cr, cy + y1 * cr);
                sctx.stroke();
            }

            // Brilho especular cristalino
            sctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            sctx.beginPath();
            sctx.ellipse(cx - cr * 0.32, cy - cr * 0.34, cr * 0.24, cr * 0.12, -0.6, 0, TAU);
            sctx.fill();
            sctx.restore();
        });
        const d = r / 0.46;
        ctx.drawImage(sprite, s.x - d / 2, s.y - d / 2, d, d);
    }

    function drawMoon(s, r, b) {
        drawGlow(s, r, 'rgba(203, 213, 225, 0.35)', 1.65 + b.flash * 0.4);
        const sprite = getPlanetSurfaceSprite('moon', (sctx, cx, cy, cr) => {
            sctx.save();
            sctx.beginPath();
            sctx.arc(cx, cy, cr, 0, TAU);
            sctx.clip();

            const base = sctx.createRadialGradient(cx - cr * 0.28, cy - cr * 0.28, cr * 0.08, cx, cy, cr);
            base.addColorStop(0, '#f1f5f9');
            base.addColorStop(0.55, '#94a3b8');
            base.addColorStop(1, '#334155');
            sctx.fillStyle = base;
            sctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);

            // Mares basálticos lunares
            sctx.fillStyle = 'rgba(51, 65, 85, 0.42)';
            sctx.beginPath();
            sctx.ellipse(cx - cr * 0.2, cy - cr * 0.12, cr * 0.36, cr * 0.26, 0.3, 0, TAU);
            sctx.fill();
            sctx.beginPath();
            sctx.ellipse(cx + cr * 0.22, cy + cr * 0.18, cr * 0.28, cr * 0.22, -0.2, 0, TAU);
            sctx.fill();

            // Crateras com sombra interna e aro iluminado
            const craters = [
                [-0.28, 0.28, 0.2],
                [0.3, -0.24, 0.16],
                [0.05, 0.42, 0.13],
                [-0.36, -0.32, 0.12]
            ];
            for (const [ox, oy, crR] of craters) {
                const x = cx + ox * cr;
                const y = cy + oy * cr;
                const rad = crR * cr;
                sctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
                sctx.beginPath();
                sctx.arc(x, y, rad, 0, TAU);
                sctx.fill();
                sctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
                sctx.lineWidth = Math.max(1, cr * 0.045);
                sctx.beginPath();
                sctx.arc(x, y, rad, -Math.PI * 0.15, Math.PI * 0.75);
                sctx.stroke();
            }
            sctx.restore();
        });
        const d = r / 0.46;
        ctx.drawImage(sprite, s.x - d / 2, s.y - d / 2, d, d);
    }

    function drawEarth(s, r, b) {
        drawGlow(s, r, 'rgba(80, 170, 255, 0.45)', 1.75 + b.flash * 0.4);

        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.clip();
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
        ctx.fillStyle = '#3d9a4a';
        blob(s.x + Math.cos(b.spin) * r * 0.15, s.y + Math.sin(b.spin * 0.7) * r * 0.1, r * 0.42);
        blob(s.x - r * 0.32, s.y + r * 0.22, r * 0.26);
        blob(s.x + r * 0.28, s.y + r * 0.3, r * 0.18);
        ctx.fillStyle = '#e8f4ff';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - r * 0.82, r * 0.42, r * 0.16, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + r * 0.86, r * 0.36, r * 0.13, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        blob(s.x + r * 0.1, s.y - r * 0.15, r * 0.2);
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.beginPath();
        ctx.arc(s.x - r * 0.28, s.y - r * 0.28, r * 0.2, 0, TAU);
        ctx.fill();
    }

    const JUPITER_BANDS = ['#d4924a', '#f0d0a0', '#c47a38', '#ead8b0', '#d9a056', '#b86a32'];
    const SATURN_BANDS = ['#e9cf9e', '#f6e6c2', '#d8b77f', '#f1dcb0', '#caa46a', '#e4c48f'];

    function drawJupiter(s, r, b) {
        drawGasGiant(s, r, b, '#e8b86a', JUPITER_BANDS, '#c4452d');
    }

    /* Gigante gasoso em faixas (Júpiter com a Grande Mancha; Saturno sem). */
    function drawGasGiant(s, r, b, baseColor, bands, spot) {
        drawGlow(s, r, colorAlpha(b.color, 0.4), 1.9 + b.flash * 0.4);
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.clip();
        ctx.fillStyle = baseColor;
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
        ctx.globalAlpha = 0.75;
        for (let i = 0; i < 7; i++) {
            ctx.fillStyle = bands[i % bands.length];
            ctx.fillRect(s.x - r, s.y - r + (i + 0.15 + Math.sin(b.spin + i) * 0.04) * r * 0.28, r * 2, r * 0.16);
        }
        ctx.globalAlpha = 1;
        if (spot) {
            ctx.fillStyle = spot;
            ctx.beginPath();
            ctx.ellipse(s.x + r * 0.32, s.y + r * 0.18, r * 0.28, r * 0.15, -0.3, 0, TAU);
            ctx.fill();
        }
        const shade = ctx.createRadialGradient(s.x - r * 0.35, s.y - r * 0.35, r * 0.2, s.x, s.y, r);
        shade.addColorStop(0, 'rgba(255,255,255,0.12)');
        shade.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = shade;
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
        ctx.restore();
    }

    function drawSaturn(s, r, b) {
        drawRings(s, r, b, 'back');
        drawPlanet(s, r, b);
        drawRings(s, r, b, 'front');
    }

    function drawRings(s, r, b, pass) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(-0.35);
        ctx.beginPath();
        if (pass === 'back') ctx.rect(-r * 4, -r * 4, r * 8, r * 4);
        else ctx.rect(-r * 4, 0, r * 8, r * 4);
        ctx.clip();
        ctx.scale(1, 0.32);
        const rings = [
            [r * 1.45, r * 1.7, 'rgba(232, 201, 148, 0.55)'],
            [r * 1.78, r * 2.05, 'rgba(210, 180, 130, 0.28)'],
            [r * 2.12, r * 2.45, 'rgba(245, 230, 190, 0.4)']
        ];
        for (let i = 0; i < rings.length; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, rings[i][1], 0, TAU);
            ctx.arc(0, 0, rings[i][0], 0, TAU, true);
            ctx.fillStyle = rings[i][2];
            ctx.fill();
        }
        ctx.restore();
    }

    /* Cometa: a cauda aponta para longe da estrela (pressão de radiação e
       vento solar), não para trás do movimento; cresce perto do periélio (∝ 1/r). */
    function drawCometBody(s, r, b) {
        const star = heaviest;
        let dx = 0, dy = -1, len = 12;
        if (star && star !== b) {
            const ex = b.x - star.x;
            const ey = b.y - star.y;
            const d = Math.sqrt(ex * ex + ey * ey) || 1;
            dx = ex / d;
            dy = -ey / d;
            len = Math.min(90, Math.max(8, (scene.fit * 0.35 / d) * 26 * uiK));
        }
        const tx = s.x + dx * len;
        const ty = s.y + dy * len;
        const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
        g.addColorStop(0, 'rgba(186, 230, 253, 0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1.5, r * 1.1);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        drawPlanet(s, r, b);
    }

    function blob(x, y, r) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.72, 0.4, 0, TAU);
        ctx.fill();
    }

    // ---- Ondas de choque (pool fixo, sem alocação por quadro) ----
    const shocks = [];
    for (let i = 0; i < 12; i++) shocks.push({ on: false, x: 0, y: 0, r: 0, max: 0, life: 0, color: '#fff' });

    function spawnShock(x, y, color, maxPx) {
        if (reduceMotion) return;
        let slot = shocks[0];
        for (let i = 0; i < shocks.length; i++) {
            if (!shocks[i].on) { slot = shocks[i]; break; }
        }
        slot.on = true;
        slot.x = x;
        slot.y = y;
        slot.r = 4;
        slot.max = maxPx;
        slot.life = 1;
        slot.color = color;
    }

    function drawShocks(dtReal) {
        for (let i = 0; i < shocks.length; i++) {
            const w = shocks[i];
            if (!w.on) continue;
            w.r += 160 * dtReal;
            w.life -= 1.1 * dtReal;
            if (w.life <= 0 || w.r > w.max) { w.on = false; continue; }
            ctx.strokeStyle = w.color;
            ctx.globalAlpha = w.life * 0.7;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx(w.x), sy(w.y), w.r, 0, TAU);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Desenho do mundo ----
    let heaviest = null;
    const SP = { x: 0, y: 0 };
    const labelX = new Float32Array(64);
    const labelY = new Float32Array(64);
    const order = [];

    function bodyRadiusPx(b) {
        if (b.kind === 'blackhole') return Math.max(b.R * cam.s, 5 * uiK);
        return Math.max(b.Rphys * cam.s, b.vis * uiK);
    }

    function drawParticles(ex) {
        const P = world.P;
        const n = P.n;
        if (!n) return;
        const px = P.x, py = P.y, pvx = P.vx, pvy = P.vy, col = P.col, sz = P.sz;
        const s = cam.s;
        const x0 = cam.vcx - cam.x * s;
        const y0 = cam.vcy + cam.y * s;
        const streak = settings.trails;
        // Rastro de poeira = borrão de movimento de ~2 quadros de tempo simulado (teto 8 px).
        const tau = streak ? (2 * rate()) / 60 : 0;
        const velColor = settings.velColor;
        const vRef = Math.sqrt(G * Math.max(1e-30, scene.well) / scene.fit) || 1;
        const groups = velColor ? 8 : palette.length;

        paletteCount.fill(0, 0, groups);
        for (let i = 0; i < n; i++) {
            let c = col[i];
            if (velColor) {
                const v = Math.sqrt(pvx[i] * pvx[i] + pvy[i] * pvy[i]) / vRef;
                c = Math.min(7, Math.floor(v * 3));
            }
            paletteCount[c]++;
        }

        ctx.globalCompositeOperation = settings.additive ? 'lighter' : 'source-over';
        ctx.lineCap = 'round';
        for (let c = 0; c < groups; c++) {
            if (!paletteCount[c]) continue;
            const color = velColor ? SPEED_HUES[c] : palette[c];
            if (streak) { ctx.strokeStyle = color; ctx.lineWidth = 1.5 * uiK; } else ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                let ci = col[i];
                if (velColor) {
                    const v = Math.sqrt(pvx[i] * pvx[i] + pvy[i] * pvy[i]) / vRef;
                    ci = Math.min(7, Math.floor(v * 3));
                }
                if (ci !== c) continue;
                const x = x0 + (px[i] + pvx[i] * ex) * s;
                const y = y0 - (py[i] + pvy[i] * ex) * s;
                if (x < -12 || x > width + 12 || y < -12 || y > height + 12) continue;
                if (streak) {
                    let dx = pvx[i] * tau * s;
                    let dy = -pvy[i] * tau * s;
                    const L = Math.sqrt(dx * dx + dy * dy);
                    if (L > 8) { dx *= 8 / L; dy *= 8 / L; }
                    ctx.moveTo(x - dx, y - dy);
                    ctx.lineTo(x + 0.01, y);
                } else {
                    const r = Math.max(0.6, sz[i] * uiK);
                    ctx.moveTo(x + r, y);
                    ctx.arc(x, y, r, 0, TAU);
                }
            }
            if (streak) ctx.stroke(); else ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    function pushTrail(b) {
        const i = b.tHead * 2;
        b.trail[i] = b.x;
        b.trail[i + 1] = b.y;
        b.tHead = (b.tHead + 1) % TRAIL_N;
        if (b.tLen < TRAIL_N) b.tLen++;
    }

    function sampleTrails(trailDt) {
        const B = world.bodies;
        for (let i = 0; i < B.length; i++) {
            const b = B[i];
            if (world.t - b.tLast >= (b.tDt || trailDt)) {
                b.tLast = world.t;
                pushTrail(b);
            }
        }
    }

    function drawTrail(b) {
        const n = b.tLen;
        if (n < 3) return;
        const bands = 3;
        const start = (b.tHead - n + TRAIL_N) % TRAIL_N;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let band = 0; band < bands; band++) {
            const i0 = Math.floor(((n - 1) * band) / bands);
            const i1 = Math.floor(((n - 1) * (band + 1)) / bands);
            if (i1 <= i0) continue;
            const tMid = (band + 0.5) / bands;
            ctx.beginPath();
            for (let k = i0; k <= i1; k++) {
                const idx = ((start + k) % TRAIL_N) * 2;
                const x = sx(b.trail[idx]);
                const y = sy(b.trail[idx + 1]);
                if (k === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = colorAlpha(b.color === '#1a1a2e' ? '#fb923c' : b.color, 0.08 + tMid * 0.42);
            ctx.lineWidth = Math.max(0.8, 0.6 + tMid * 1.4) * uiK;
            ctx.stroke();
        }
    }

    function drawBody(b, ex) {
        SP.x = sx(b.x + b.vx * ex);
        SP.y = sy(b.y + b.vy * ex);
        const r = bodyRadiusPx(b);
        if (SP.x < -r * 5 - 40 || SP.x > width + r * 5 + 40 || SP.y < -r * 5 - 40 || SP.y > height + r * 5 + 40) return false;

        switch (b.tex) {
            case 'blackhole': drawBlackHole(SP, r, b); break;
            case 'sun':
            case 'star': drawSun(SP, r, b); break;
            case 'core': drawCore(SP, r, b); break;
            case 'saturn': drawSaturn(SP, r, b); break;
            case 'saturn-body': drawGasGiant(SP, r, b, '#e9cf9e', SATURN_BANDS, null); break;
            case 'jupiter': drawJupiter(SP, r, b); break;
            case 'earth': drawEarth(SP, r, b); break;
            case 'mars': drawMars(SP, r, b); break;
            case 'ice': drawIce(SP, r, b); break;
            case 'moon': drawMoon(SP, r, b); break;
            case 'titan': drawPlanet(SP, r, b); break;
            case 'comet': drawCometBody(SP, r, b); break;
            default: drawPlanet(SP, r, b); break;
        }

        // ISCO tracejada quando o buraco negro aparece grande o bastante.
        if (b.kind === 'blackhole' && b.R * 3 * cam.s > 14) {
            ctx.strokeStyle = 'rgba(253, 186, 116, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.arc(SP.x, SP.y, b.R * 3 * cam.s, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (selected === b) {
            ctx.strokeStyle = 'rgba(253, 230, 138, 0.9)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(SP.x, SP.y, r + 7, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        return true;
    }

    function drawLabels(ex) {
        if (!settings.labels) return;
        const B = world.bodies;
        order.length = 0;
        for (let i = 0; i < B.length; i++) order.push(i);
        // Ordena por massa (maior primeiro) — inserção, sem alocação.
        for (let i = 1; i < order.length; i++) {
            const v = order[i];
            let j = i - 1;
            while (j >= 0 && B[order[j]].m < B[v].m) { order[j + 1] = order[j]; j--; }
            order[j + 1] = v;
        }
        ctx.font = `600 ${Math.round(11 * Math.max(0.9, uiK))}px "Space Grotesk", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        let placed = 0;
        for (let k = 0; k < order.length; k++) {
            const b = B[order[k]];
            if (!b.name) continue;
            const x = sx(b.x + b.vx * ex);
            const y = sy(b.y + b.vy * ex) + bodyRadiusPx(b) + 5;
            if (x < 0 || x > width || y < 0 || y > height) continue;
            let clash = false;
            for (let q = 0; q < placed; q++) {
                if (Math.abs(labelX[q] - x) < 46 && Math.abs(labelY[q] - y) < 13) { clash = true; break; }
            }
            if (clash && selected !== b) continue;
            if (placed < labelX.length) { labelX[placed] = x; labelY[placed] = y; placed++; }
            ctx.fillStyle = selected === b ? 'rgba(253, 230, 138, 0.95)' : 'rgba(255,255,255,0.72)';
            ctx.fillText(b.name, x, y);
        }
        ctx.textBaseline = 'alphabetic';
    }

    // ---- Interação: estilingue, previsão, poço, poeira, apagar ----
    const gesture = { kind: 'none', sx0: 0, sy0: 0, wx0: 0, wy0: 0, px: 0, py: 0, moved: false, lastSpawnX: 0, lastSpawnY: 0, wellE: 0 };
    const pointers = new Map();
    let pinch = null;
    const slingHint = document.getElementById('slingHint');

    const PRED_N = 480;
    const predX = new Float32Array(PRED_N);
    const predY = new Float32Array(PRED_N);
    let predLen = 0;
    let predHit = false;
    let predDirty = false;
    const pbx = new Float64Array(Physics.MAX_BODIES + 1);
    const pby = new Float64Array(Physics.MAX_BODIES + 1);
    const pbvx = new Float64Array(Physics.MAX_BODIES + 1);
    const pbvy = new Float64Array(Physics.MAX_BODIES + 1);
    const pbax = new Float64Array(Physics.MAX_BODIES + 1);
    const pbay = new Float64Array(Physics.MAX_BODIES + 1);
    const pbm = new Float64Array(Physics.MAX_BODIES + 1);
    const pbR = new Float64Array(Physics.MAX_BODIES + 1);
    const launch = { x: 0, y: 0, vx: 0, vy: 0, host: null, vc: 0, circ: false, escape: false };
    const HOST = { m: 0, x: 0, y: 0, vx: 0, vy: 0, body: null };
    const HOST2 = { m: 0, x: 0, y: 0, vx: 0, vy: 0, body: null };
    const EL = { r: 0, energy: 0, bound: false, a: 0, e: 0, period: 0, retro: false };

    function rate() {
        return scene.rate * SPEEDS[speedIdx()];
    }

    function speedIdx() {
        const v = settings.speed[scene.id];
        return typeof v === 'number' && v >= 0 && v < SPEEDS.length ? v : SPEED_DEFAULT;
    }

    function presetIdx() {
        const v = settings.mass[scene.id];
        return typeof v === 'number' && v >= 0 && v < scene.spawn.length ? v : scene.spawnDefault;
    }

    /* Velocidade de lançamento (estilingue, puxa para trás como num arco):
         hospedeiro h = corpo que mais acelera o ponto; r = distância a h
         v_c = √(G m_h r² / (r²+ε²)^{3/2}), τ = r / v_c (tempo dinâmico local)
         v⃗ = v⃗_h + (início − ponteiro) / τ
       Assim puxar uma distância igual a r dá exatamente a velocidade circular,
       em qualquer escala (Saturno ou galáxias). Toque sem arrastar = órbita circular. */
    function computeLaunch(curWX, curWY, dragPx) {
        const x = gesture.wx0, y = gesture.wy0;
        const host = Physics.hostAt(world, x, y, null, HOST).m > 0 ? HOST : null;
        launch.x = x;
        launch.y = y;
        launch.host = host;
        let tau;
        if (host) {
            const rx = x - host.x, ry = y - host.y;
            const r = Math.sqrt(rx * rx + ry * ry) || scene.fit * 0.1;
            const vc = Physics.vCirc(host.m, r, world.eps2);
            launch.vc = vc;
            tau = r / Math.max(vc, 1e-30);
            if (dragPx < 10) {
                const sgn = Physics.spinSign(world);
                launch.vx = host.vx - (ry / r) * vc * sgn;
                launch.vy = host.vy + (rx / r) * vc * sgn;
                launch.circ = true;
            } else {
                launch.vx = host.vx + (x - curWX) / tau;
                launch.vy = host.vy + (y - curWY) / tau;
                launch.circ = false;
            }
            const dvx = launch.vx - host.vx, dvy = launch.vy - host.vy;
            launch.escape = 0.5 * (dvx * dvx + dvy * dvy) - (G * host.m) / Math.sqrt(r * r + world.eps2) >= 0;
        } else {
            const vref = Math.sqrt((G * scene.well) / scene.fit);
            tau = scene.fit / vref;
            launch.vc = vref;
            launch.vx = (x - curWX) / tau;
            launch.vy = (y - curWY) / tau;
            launch.circ = false;
            launch.escape = true;
        }
    }

    /* Previsão: cópia do sistema (todos os corpos + o corpo novo, sem massa)
       integrada com o mesmo leapfrog à frente do tempo. É o mesmo modelo da
       simulação, então a linha tracejada é o futuro real (até uma colisão). */
    function computePrediction() {
        predDirty = false;
        predLen = 0;
        predHit = false;
        if (!settings.predict) return;
        const B = world.bodies;
        const nb = B.length;
        for (let i = 0; i < nb; i++) {
            const b = B[i];
            pbx[i] = b.x; pby[i] = b.y; pbvx[i] = b.vx; pbvy[i] = b.vy; pbm[i] = b.m; pbR[i] = b.R;
        }
        const t = nb;
        pbx[t] = launch.x; pby[t] = launch.y; pbvx[t] = launch.vx; pbvy[t] = launch.vy; pbm[t] = 0;
        const n = nb + 1;
        const eps2 = world.eps2;

        let horizon = rate() * 12;
        if (launch.host) {
            const h = launch.host;
            Physics.elements(G * h.m, launch.x - h.x, launch.y - h.y, launch.vx - h.vx, launch.vy - h.vy, EL);
            if (EL.bound) horizon = Math.min(EL.period * 1.02, rate() * 40);
        }
        const cost = (nb * nb) / 2 + nb + 1;
        let steps = Math.max(60, Math.min(4000, Math.floor(3.5e5 / cost)));
        let dtp = horizon / steps;
        const dtMax = world.dt * 24;
        if (dtp > dtMax) { dtp = dtMax; horizon = dtp * steps; }
        if (dtp < world.dt) { dtp = world.dt; steps = Math.max(2, Math.floor(horizon / dtp)); }
        const stride = Math.max(1, Math.ceil(steps / PRED_N));

        const accel = () => {
            for (let i = 0; i < n; i++) { pbax[i] = 0; pbay[i] = 0; }
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const dx = pbx[j] - pbx[i];
                    const dy = pby[j] - pby[i];
                    const r2 = dx * dx + dy * dy + eps2;
                    const inv = G / (r2 * Math.sqrt(r2));
                    pbax[i] += pbm[j] * inv * dx; pbay[i] += pbm[j] * inv * dy;
                    pbax[j] -= pbm[i] * inv * dx; pbay[j] -= pbm[i] * inv * dy;
                }
            }
        };
        accel();
        const h = dtp * 0.5;
        predX[predLen] = pbx[t]; predY[predLen] = pby[t]; predLen++;
        for (let k = 1; k <= steps && predLen < PRED_N; k++) {
            for (let i = 0; i < n; i++) {
                pbvx[i] += pbax[i] * h; pbvy[i] += pbay[i] * h;
                pbx[i] += pbvx[i] * dtp; pby[i] += pbvy[i] * dtp;
            }
            accel();
            for (let i = 0; i < n; i++) { pbvx[i] += pbax[i] * h; pbvy[i] += pbay[i] * h; }
            if (k % stride === 0) { predX[predLen] = pbx[t]; predY[predLen] = pby[t]; predLen++; }
            let hit = false;
            for (let i = 0; i < nb; i++) {
                const R = pbR[i] + bodyRForSpawn();
                const dx = pbx[t] - pbx[i];
                const dy = pby[t] - pby[i];
                if (dx * dx + dy * dy < R * R) { hit = true; break; }
            }
            if (hit) {
                predHit = true;
                predX[predLen] = pbx[t]; predY[predLen] = pby[t]; predLen++;
                break;
            }
        }
    }

    function bodyRForSpawn() {
        const p = scene.spawn[presetIdx()];
        if (p.kind === 'blackhole') return Physics.schwarzschild(p.m);
        return (p.R || Physics.radiusFor(p.m, p.kind)) * (scene.id === 'chaos' ? 25 : 1);
    }

    function drawSling() {
        if (gesture.kind !== 'sling') return;
        if (predDirty) computePrediction();
        const ax = sx(gesture.wx0), ay = sy(gesture.wy0);
        ctx.save();
        if (predLen > 1) {
            ctx.setLineDash([5, 6]);
            ctx.strokeStyle = launch.escape ? 'rgba(249, 168, 212, 0.85)' : 'rgba(134, 239, 172, 0.85)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(sx(predX[0]), sy(predY[0]));
            for (let i = 1; i < predLen; i++) ctx.lineTo(sx(predX[i]), sy(predY[i]));
            ctx.stroke();
            ctx.setLineDash([]);
            if (predHit) {
                const ex = sx(predX[predLen - 1]), ey = sy(predY[predLen - 1]);
                ctx.strokeStyle = 'rgba(251, 146, 60, 0.95)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ex - 5, ey - 5); ctx.lineTo(ex + 5, ey + 5);
                ctx.moveTo(ex + 5, ey - 5); ctx.lineTo(ex - 5, ey + 5);
                ctx.stroke();
            }
        }
        if (gesture.moved) {
            ctx.strokeStyle = 'rgba(253, 230, 138, 0.9)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(gesture.px, gesture.py);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        const p = scene.spawn[presetIdx()];
        const r = Math.max(3, (p.vis || visFor(p.m, p.kind)) * uiK);
        ctx.fillStyle = 'rgba(253, 230, 138, 0.22)';
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    function updateSlingHint() {
        if (gesture.kind !== 'sling') { slingHint.classList.remove('visible'); return; }
        const ax = sx(gesture.wx0), ay = sy(gesture.wy0);
        const h = launch.host;
        const vrel = h ? Math.hypot(launch.vx - h.vx, launch.vy - h.vy) : Math.hypot(launch.vx, launch.vy);
        const ratio = launch.vc > 0 ? vrel / launch.vc : 0;
        let txt = fmtVel(vrel) + ' · ' + nf3.format(ratio) + ' v_circ';
        txt += launch.escape ? ' · escapa' : launch.circ ? ' · órbita circular' : ' · órbita';
        if (h && h.body && h.body.name) txt += ' de ' + h.body.name;
        slingHint.textContent = txt;
        slingHint.style.left = Math.max(80, Math.min(width - 80, ax)) + 'px';
        slingHint.style.top = Math.max(70, ay) + 'px';
        slingHint.classList.add('visible');
    }

    function visFor(m, kind) {
        if (kind === 'blackhole') return 6;
        if (kind === 'star' || m >= 0.075) return Math.max(5, Math.min(12, 8 + 2.2 * Math.log10(m)));
        return Math.max(2.2, Math.min(8, 2.2 + 0.9 * Math.log10(m / 1e-8)));
    }

    let spawnCounter = 0;
    function launchBody() {
        const p = scene.spawn[presetIdx()];
        let kind = p.kind || (p.m >= 0.075 ? 'star' : 'planet');
        let tex = p.tex || kind;
        if (kind === 'planet') {
            if (p.m >= 3e-5) tex = 'jupiter';
            else {
                const opts = ['planet', 'mars', 'ice', 'earth'];
                tex = opts[spawnCounter % opts.length];
            }
        }
        const colors = themes[settings.theme] || themes.nebula;
        const color = kind === 'blackhole' ? '#1a1a2e' : colors[spawnCounter % colors.length];
        spawnCounter++;
        pushUndo();
        let made = null;
        Physics.edit(world, () => {
            made = Physics.addBody(world, {
                x: launch.x, y: launch.y, vx: launch.vx, vy: launch.vy,
                m: p.m, kind, tex, color,
                name: p.label + ' ' + spawnCounter,
                vis: p.vis || visFor(p.m, kind),
                R: p.R || Physics.radiusFor(p.m, kind),
                inflate: scene.id === 'chaos' ? 25 : 1
            });
        });
        if (!made) toast('Limite de ' + Physics.MAX_BODIES + ' corpos atingido.');
        else {
            setTrailDt(made);
            spawnShock(made.x, made.y, 'rgba(253, 230, 138, 0.7)', 60);
        }
    }

    /* Poeira semeada já nasce em órbita do corpo dominante (v_circ local),
       com dispersão aleatória proporcional ao ajuste "Dispersão". */
    function spawnDustAt(x, y, count) {
        const host = Physics.hostAt(world, x, y, null, HOST2).m > 0 ? HOST2 : null;
        const spread = settings.spread / 100;
        const sgn = Physics.spinSign(world);
        const jitterR = 10 / cam.s;
        for (let i = 0; i < count; i++) {
            const px = x + (Math.random() - 0.5) * jitterR;
            const py = y + (Math.random() - 0.5) * jitterR;
            let vx = 0, vy = 0, vc = 0;
            if (host) {
                const rx = px - host.x, ry = py - host.y;
                const r = Math.sqrt(rx * rx + ry * ry) || 1e-9;
                vc = Physics.vCirc(host.m, r, world.eps2);
                vx = host.vx - (ry / r) * vc * sgn;
                vy = host.vy + (rx / r) * vc * sgn;
            } else {
                vc = Math.sqrt((G * scene.well) / scene.fit);
            }
            vx += (Math.random() + Math.random() - 1) * spread * vc;
            vy += (Math.random() + Math.random() - 1) * spread * vc;
            const idx = Physics.addParticle(world, px, py, vx, vy, Math.floor(Math.random() * 5), 0.9 + Math.random() * 1.2);
            if (idx < 0) break;
        }
        Physics.accelParticles(world);
    }

    function eraseAt(px, py) {
        const B = world.bodies;
        let removed = false;
        for (let i = 0; i < B.length; i++) {
            const b = B[i];
            const d = Math.hypot(sx(b.x) - px, sy(b.y) - py);
            if (d < bodyRadiusPx(b) + 16) {
                if (!removed) Physics.edit(world, () => {
                    for (let j = 0; j < B.length; j++) {
                        const c = B[j];
                        if (Math.hypot(sx(c.x) - px, sy(c.y) - py) < bodyRadiusPx(c) + 16) {
                            c.alive = false;
                            spawnShock(c.x, c.y, colorAlpha(c.color === '#1a1a2e' ? '#fb923c' : c.color, 0.6), 50);
                        }
                    }
                });
                removed = true;
                break;
            }
        }
        const P = world.P;
        const R2 = 26 * 26;
        for (let i = P.n - 1; i >= 0; i--) {
            const dx = sx(P.x[i]) - px;
            const dy = sy(P.y[i]) - py;
            if (dx * dx + dy * dy < R2) Physics.removeParticle(P, i);
        }
        if (selected && !selected.alive) { selected = null; syncInspect(); }
    }

    function hitBody(px, py) {
        const B = world.bodies;
        let best = null;
        let bestD = Infinity;
        for (let i = 0; i < B.length; i++) {
            const b = B[i];
            const d = Math.hypot(sx(b.x) - px, sy(b.y) - py);
            const pad = Math.max(16, bodyRadiusPx(b) + 8);
            if (d < pad && d < bestD) { best = b; bestD = d; }
        }
        return best;
    }

    function wellOn(x, y) {
        const wl = world.well;
        gesture.wellE = Physics.energy(world);
        Physics.momentum(world, MOM);
        gesture.wellPx = MOM.px;
        gesture.wellPy = MOM.py;
        wl.on = true;
        wl.x = x;
        wl.y = y;
        wl.m = scene.well;
        Physics.computeAccel(world);
    }

    /* O poço é uma força externa dependente do tempo: injeta energia e momento.
       Ao soltar, o salto acumulado vai para eShift/pShift (não conta como erro). */
    function wellOff() {
        const wl = world.well;
        if (!wl.on) return;
        wl.on = false;
        Physics.computeAccel(world);
        world.eShift += Physics.energy(world) - gesture.wellE;
        Physics.momentum(world, MOM);
        world.pShiftX += MOM.px - gesture.wellPx;
        world.pShiftY += MOM.py - gesture.wellPy;
        Physics.rescale(world);
    }

    function selectBody(b) {
        selected = b;
        syncInspect();
    }

    function beginGesture(px, py, pan) {
        gesture.sx0 = px;
        gesture.sy0 = py;
        gesture.px = px;
        gesture.py = py;
        gesture.wx0 = wx(px);
        gesture.wy0 = wy(py);
        gesture.moved = false;
        const hit = hitBody(px, py);

        if (pan || mouseMode === 'pan') {
            if (hit) selectBody(hit);
            gesture.kind = 'pan';
            return;
        }
        if (mouseMode === 'body') {
            if (hit) {
                selectBody(hit);
                gesture.kind = 'pan';
                return;
            }
            gesture.kind = 'sling';
            computeLaunch(gesture.wx0, gesture.wy0, 0);
            predDirty = true;
            updateSlingHint();
            return;
        }
        if (mouseMode === 'spawn') {
            if (hit) {
                selectBody(hit);
                gesture.kind = 'pan';
                return;
            }
            pushUndo();
            gesture.kind = 'spawn';
            gesture.lastSpawnX = px;
            gesture.lastSpawnY = py;
            spawnDustAt(gesture.wx0, gesture.wy0, 10);
            return;
        }
        if (mouseMode === 'erase') {
            pushUndo();
            gesture.kind = 'erase';
            eraseAt(px, py);
            return;
        }
        if (mouseMode === 'attract') {
            pushUndo();
            gesture.kind = 'well';
            wellOn(gesture.wx0, gesture.wy0);
        }
    }

    function moveGesture(px, py) {
        const dx = px - gesture.px;
        const dy = py - gesture.py;
        gesture.px = px;
        gesture.py = py;
        if (Math.hypot(px - gesture.sx0, py - gesture.sy0) > 6) gesture.moved = true;
        switch (gesture.kind) {
            case 'pan':
                if (!gesture.moved) return;
                cam.x -= dx / cam.s;
                cam.y += dy / cam.s;
                cam.follow = false;
                camTouched = true;
                syncFollowBtn();
                break;
            case 'sling':
                computeLaunch(wx(px), wy(py), Math.hypot(px - gesture.sx0, py - gesture.sy0));
                predDirty = true;
                updateSlingHint();
                break;
            case 'spawn':
                if (Math.hypot(px - gesture.lastSpawnX, py - gesture.lastSpawnY) > 8) {
                    gesture.lastSpawnX = px;
                    gesture.lastSpawnY = py;
                    spawnDustAt(wx(px), wy(py), 4);
                }
                break;
            case 'erase':
                eraseAt(px, py);
                break;
            case 'well':
                world.well.x = wx(px);
                world.well.y = wy(py);
                break;
        }
    }

    function endGesture(commit) {
        if (gesture.kind === 'sling' && commit !== false) {
            computeLaunch(wx(gesture.px), wy(gesture.py), Math.hypot(gesture.px - gesture.sx0, gesture.py - gesture.sy0));
            launchBody();
        }
        if (gesture.kind === 'well') wellOff();
        gesture.kind = 'none';
        predLen = 0;
        slingHint.classList.remove('visible');
    }

    function canvasPoint(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const gravityPointerOpts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const p = canvasPoint(e);
        // Capture só mouse/caneta — no iOS o capture do 1º dedo impede a pinça.
        if (e.pointerType !== 'touch') {
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        }
        pointers.set(e.pointerId, p);
        dismissHint();
        if (pointers.size === 2) {
            endGesture(false);
            const it = pointers.values();
            const a = it.next().value;
            const b = it.next().value;
            pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
            return;
        }
        if (pointers.size > 2) return;
        const pan = e.button === 1 || e.button === 2 || e.shiftKey;
        beginGesture(p.x, p.y, pan);
    }, gravityPointerOpts);

    function onGravityPointerMove(e) {
        if (!pointers.has(e.pointerId)) return;
        e.preventDefault();
        const p = canvasPoint(e);
        pointers.set(e.pointerId, p);
        if (pinch && pointers.size >= 2) {
            const it = pointers.values();
            const a = it.next().value;
            const b = it.next().value;
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            zoomAt(mx, my, dist / Math.max(1, pinch.dist));
            cam.x -= (mx - pinch.mx) / cam.s;
            cam.y += (my - pinch.my) / cam.s;
            pinch.dist = dist;
            pinch.mx = mx;
            pinch.my = my;
            cam.follow = false;
            syncFollowBtn();
            return;
        }
        if (pinch) return;
        moveGesture(p.x, p.y);
    }
    window.addEventListener('pointermove', onGravityPointerMove, gravityPointerOpts);

    function pointerEnd(e) {
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        if (pinch) {
            if (pointers.size === 0) pinch = null;
            return;
        }
        if (pointers.size === 0) endGesture(e.type !== 'pointercancel');
    }
    window.addEventListener('pointerup', pointerEnd);
    window.addEventListener('pointercancel', pointerEnd);
    canvas.addEventListener('lostpointercapture', (e) => {
        if (pointers.has(e.pointerId)) pointerEnd(e);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); }, gravityPointerOpts);
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, gravityPointerOpts);
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const p = canvasPoint(e);
        const k = Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.0022);
        zoomAt(p.x, p.y, k);
    }, { passive: false });

    function cancelInput() {
        pointers.clear();
        pinch = null;
        endGesture(false);
        keysHeld.clear();
    }

    // ---- Desfazer (snapshots só em ações do usuário, nunca por quadro) ----
    const undoStack = [];
    const UNDO_MAX = 16;

    function cloneBody(b) {
        const c = Object.assign({}, b);
        c.trail = b.trail.slice();
        return c;
    }

    function pushUndo() {
        const P = world.P;
        const n = P.n;
        undoStack.push({
            scene: scene.id,
            bodies: world.bodies.map(cloneBody),
            n,
            x: P.x.slice(0, n), y: P.y.slice(0, n), vx: P.vx.slice(0, n), vy: P.vy.slice(0, n),
            col: P.col.slice(0, n), sz: P.sz.slice(0, n),
            t: world.t, E0: world.E0, eShift: world.eShift, P0x: world.P0x, P0y: world.P0y,
            pShiftX: world.pShiftX, pShiftY: world.pShiftY, dissipated: world.dissipated, tdeCol: world.tdeCol, Escale: world.Escale
        });
        if (undoStack.length > UNDO_MAX) undoStack.shift();
        undoBtn.disabled = false;
    }

    function undo() {
        const s = undoStack.pop();
        undoBtn.disabled = undoStack.length === 0;
        if (!s) return;
        cancelInput();
        if (s.scene !== scene.id) setScene(Scenes.byId(s.scene), false);
        world.bodies.length = 0;
        for (let i = 0; i < s.bodies.length; i++) world.bodies.push(s.bodies[i]);
        const P = world.P;
        P.n = s.n;
        P.x.set(s.x); P.y.set(s.y); P.vx.set(s.vx); P.vy.set(s.vy); P.col.set(s.col); P.sz.set(s.sz);
        world.t = s.t;
        world.E0 = s.E0; world.eShift = s.eShift; world.P0x = s.P0x; world.P0y = s.P0y;
        world.pShiftX = s.pShiftX; world.pShiftY = s.pShiftY; world.dissipated = s.dissipated; world.tdeCol = s.tdeCol; world.Escale = s.Escale;
        world.well.on = false;
        Physics.computeAccel(world);
        selected = null;
        syncInspect();
        acc = 0;
        toast('Desfeito.');
    }

    // ---- Cenários ----
    function setScene(sc, build) {
        scene = sc;
        world.dt = sc.dt;
        world.eps2 = sc.eps * sc.eps;
        world.cull2 = sc.cull * sc.cull;
        world.collide = settings.collide;
        world.well.eps2 = (sc.fit * 0.03) * (sc.fit * 0.03);
        if (build) Scenes.load(world, sc, sceneCtx);
        world.collide = settings.collide;
        document.querySelectorAll('.scene-chip[data-scenario]').forEach((btn) => {
            const on = btn.dataset.scenario === sc.id;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        hudScene.textContent = sc.name;
        buildMassSeg();
        syncRate();
    }

    function loadScenario(id, opts) {
        const sc = Scenes.byId(id) || Scenes.list[0];
        cancelInput();
        if (opts && opts.undoable) pushUndo();
        setScene(sc, true);
        acc = 0;
        selected = null;
        syncInspect();
        // Rastros: ~240 amostras cobrem ~1,3 órbita do corpo de referência do cenário.
        trailDt = sc.rate * 0.06;
        for (let i = 0; i < world.bodies.length; i++) {
            setTrailDt(world.bodies[i]);
            pushTrail(world.bodies[i]);
        }
        fitCamera();
        try { if (history.replaceState) history.replaceState(null, '', '#' + sc.id); } catch (err) { /* ok */ }
        if (!opts || !opts.silent) toast(sc.toast);
        hudDirty = true;
    }

    let trailDt = 0.015;

    /* Amostragem do rastro por corpo: ~90 pontos por órbita própria (P em torno
       do hospedeiro), limitada ao passo do cenário — a Lua não vira polígono. */
    function setTrailDt(b) {
        b.tDt = trailDt;
        if (world.bodies.length < 2) return;
        const host = Physics.hostAt(world, b.x, b.y, b, HOST2);
        if (!(host.m > 0)) return;
        Physics.elements(G * (b.m + host.m), b.x - host.x, b.y - host.y, b.vx - host.vx, b.vy - host.vy, EL);
        if (EL.bound && Number.isFinite(EL.period)) b.tDt = Math.max(world.dt, Math.min(trailDt, EL.period / 90));
    }

    // ---- Loop ----
    let lastNow = 0;
    let fps = 60;
    let fpsFrames = 0;
    let fpsT = 0;
    let hudT = 0;
    let hudDirty = true;
    const MOM = { px: 0, py: 0, sum: 0 };

    /* Orçamento adaptativo: se a física passar de ~9 ms por quadro (aparelho
       fraco), o teto de interações cai; se sobrar folga, sobe devagar. Quando o
       teto corta passos, o tempo simulado anda mais devagar que o pedido
       (selo "CPU no limite") — nunca aumentamos o dt, que quebraria a conservação. */
    let budget = STEP_BUDGET;
    function maxSteps() {
        const nb = world.bodies.length;
        const cost = (nb * nb) / 2 + world.P.n * Math.max(1, nb) + 8;
        return Math.max(1, Math.min(4000, Math.floor(budget / cost)));
    }

    function tuneBudget(ms, steps) {
        if (steps < 2) return;
        if (ms > 9) budget = Math.max(1.5e5, budget * 0.85);
        else if (ms < 5) budget = Math.min(4e6, budget * 1.03);
    }

    function simulate(n) {
        for (let i = 0; i < n; i++) {
            Physics.step(world);
            sampleTrails(trailDt);
        }
    }

    function frame(now) {
        let dtReal = lastNow ? (now - lastNow) / 1000 : 0;
        lastNow = now;
        if (!(dtReal > 0)) dtReal = 0;
        if (dtReal > MAX_FRAME_DT) dtReal = MAX_FRAME_DT;

        fpsFrames++;
        if (now - fpsT > 500) {
            fps = Math.round((fpsFrames * 1000) / (now - fpsT));
            fpsFrames = 0;
            fpsT = now;
        }

        try {
            if (running) {
                const t0 = performance.now();
                acc += dtReal * rate();
                const need = Math.floor(acc / world.dt);
                const cap = maxSteps();
                if (need > cap) {
                    simulate(cap);
                    acc = 0;
                    limited = true;
                    stepsLastFrame = cap;
                } else {
                    simulate(need);
                    acc -= need * world.dt;
                    limited = false;
                    stepsLastFrame = need;
                }
                tuneBudget(performance.now() - t0, stepsLastFrame);
                if (gesture.kind === 'sling') predDirty = true;
            }
            if (world.bodies.length && (world.bodies.some(notFinite))) {
                Physics.edit(world, () => {});
                if (selected && !selected.alive) { selected = null; syncInspect(); }
            }
        } catch (err) {
            console.error(err);
            running = false;
            syncPlay();
        }

        // Câmera seguindo: acompanha o deslocamento do alvo e converge sem atraso acumulado.
        if (cam.follow && selected && selected.alive) {
            const k = reduceMotion ? 1 : 1 - Math.exp(-10 * dtReal);
            cam.x += selected.x - cam.lastX + (selected.x - cam.x) * k;
            cam.y += selected.y - cam.lastY + (selected.y - cam.y) * k;
            cam.lastX = selected.x;
            cam.lastY = selected.y;
        }

        render(now, dtReal);

        if (now - hudT > 250 || hudDirty) {
            hudT = now;
            hudDirty = false;
            updateHud();
        }
    }

    function notFinite(b) {
        return !Number.isFinite(b.x) || !Number.isFinite(b.y);
    }

    function render(now, dtReal) {
        const ex = running ? acc : 0;
        drawBackdrop(now);

        heaviest = null;
        const B = world.bodies;
        for (let i = 0; i < B.length; i++) {
            const b = B[i];
            if (!heaviest || b.m > heaviest.m) heaviest = b;
            if (!reduceMotion) b.spin += dtReal * 0.6;
            if (b.flash > 0) b.flash = Math.max(0, b.flash - dtReal * 2.2);
        }

        drawParticles(ex);
        if (settings.trails) for (let i = 0; i < B.length; i++) drawTrail(B[i]);
        for (let i = 0; i < B.length; i++) drawBody(B[i], ex);
        drawLabels(ex);
        drawShocks(dtReal);
        drawWell();
        drawSling();
    }

    function drawWell() {
        const wl = world.well;
        if (!wl.on) return;
        const x = sx(wl.x), y = sy(wl.y);
        const g = ctx.createRadialGradient(x, y, 6, x, y, 90);
        g.addColorStop(0, 'rgba(103, 232, 249, 0.32)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 90, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(103, 232, 249, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, TAU);
        ctx.stroke();
    }

    // ---- HUD ----
    const hudScene = document.getElementById('hudScene');
    const hudBadge = document.getElementById('hudBadge');
    const tmTime = document.getElementById('tmTime');
    const tmEnergy = document.getElementById('tmEnergy');
    const tmDrift = document.getElementById('tmDrift');
    const tmDriftCell = document.getElementById('tmDriftCell');
    const tmMomentum = document.getElementById('tmMomentum');
    const rateLabel = document.getElementById('rateLabel');
    const diagEl = document.getElementById('diag');

    function setText(el, txt) {
        if (el.textContent !== txt) el.textContent = txt;
    }

    function updateHud() {
        setText(tmTime, fmtDuration(world.t).replace(/^0 s$/, '0'));
        const nb = world.bodies.length;
        const E = Physics.energy(world);
        setText(tmEnergy, nb ? fmtSci(E) : '—');
        let cls = 'ok';
        const d = Physics.relDrift(world, E);
        if (world.well.on) {
            setText(tmDrift, 'poço ativo');
            cls = 'warn';
        } else if (!Number.isFinite(d)) {
            setText(tmDrift, '—');
        } else {
            const ad = Math.abs(d);
            setText(tmDrift, (d >= 0 ? '+' : '') + fmtSci(d));
            cls = ad < 1e-5 ? 'ok' : ad < 1e-2 ? 'warn' : 'bad';
        }
        if (tmDriftCell.dataset.state !== cls) tmDriftCell.dataset.state = cls;
        Physics.momentum(world, MOM);
        if (world.well.on) {
            setText(tmMomentum, '—');
        } else if (nb && MOM.sum > 0) {
            const dpx = MOM.px - world.P0x - world.pShiftX;
            const dpy = MOM.py - world.P0y - world.pShiftY;
            setText(tmMomentum, fmtSci(Math.hypot(dpx, dpy) / MOM.sum));
        } else {
            setText(tmMomentum, '—');
        }

        let badge = '';
        if (!running) badge = 'Pausado';
        else if (limited) badge = 'CPU no limite';
        hudBadge.hidden = !badge;
        if (badge) setText(hudBadge, badge);
        hudBadge.dataset.kind = !running ? 'pause' : 'limit';

        if (!tunePanel.hidden) {
            setText(diagEl,
                `G = 4π² UA³/(M☉·ano²) · dt = ${fmtDuration(world.dt)} · ε = ${fmtLen(Math.sqrt(world.eps2))} · ` +
                `${stepsLastFrame} passos/quadro · ${fps} fps · ${nb} corpos · ${world.P.n} poeira` +
                (world.dissipated > 0 ? ` · dissipado em fusões ${fmtSci(world.dissipated)}` : ''));
        }
        if (selected) updateInspectMeta();
    }

    function syncRate() {
        const idx = speedIdx();
        rateLabel.value = '1 s ≈ ' + fmtDuration(rate());
        rateLabel.textContent = rateLabel.value;
        slowerBtn.disabled = idx <= 0;
        fasterBtn.disabled = idx >= SPEEDS.length - 1;
        slowerBtn.setAttribute('aria-label', 'Mais devagar (agora 1 s ≈ ' + fmtDuration(rate()) + ')');
    }

    function changeSpeed(delta) {
        const idx = Math.max(0, Math.min(SPEEDS.length - 1, speedIdx() + delta));
        settings.speed[scene.id] = idx;
        saveSettings();
        syncRate();
    }

    // ---- Inspetor ----
    const inspectEl = document.getElementById('inspect');
    const inspectName = document.getElementById('inspectName');
    const inspectMeta = document.getElementById('inspectMeta');
    const inspectOrbit = document.getElementById('inspectOrbit');
    const inspectSwatch = document.getElementById('inspectSwatch');
    const followBtn = document.getElementById('followBtn');

    function updateInspectMeta() {
        const b = selected;
        if (!b || !b.alive) { syncInspect(); return; }
        const speed = Math.hypot(b.vx, b.vy);
        const kind = b.tex === 'core' ? 'Núcleo galáctico' : (KIND_LABEL[b.kind] || 'Corpo');
        setText(inspectMeta, `${kind} · ${fmtMass(b.m)} · ${fmtVel(speed)}`);
        let orbit = '';
        if (b.kind === 'blackhole') {
            orbit = `r_s ${fmtLen(b.R)} · ISCO ${fmtLen(b.R * 3)}`;
        }
        if (b === heaviest || world.bodies.length < 2) {
            const part = 'a ' + fmtLen(Math.hypot(b.x, b.y)) + ' do centro de massa';
            orbit = orbit ? orbit + ' · ' + part : part;
        } else {
            const host = Physics.hostAt(world, b.x, b.y, b, HOST2);
            const hn = host.body ? host.body.name || 'hospedeiro' : 'sistema';
            Physics.elements(G * (b.m + host.m), b.x - host.x, b.y - host.y, b.vx - host.vx, b.vy - host.vy, EL);
            const part = EL.bound
                ? `em torno de ${hn}: a ${fmtLen(EL.a)} · e ${nf3.format(EL.e)} · P ${fmtDuration(EL.period)}`
                : `escapando de ${hn} · r ${fmtLen(EL.r)}`;
            orbit = orbit ? orbit + ' · ' + part : part;
        }
        setText(inspectOrbit, orbit);
    }

    function syncInspect() {
        if (!selected || !selected.alive || world.bodies.indexOf(selected) === -1) {
            selected = null;
            inspectEl.hidden = true;
            cam.follow = false;
            syncFollowBtn();
            return;
        }
        inspectEl.hidden = false;
        inspectName.textContent = selected.name || 'Corpo';
        inspectSwatch.style.background = selected.kind === 'blackhole' ? 'radial-gradient(circle, #000 45%, #fb923c 70%, transparent 72%)' : selected.color;
        updateInspectMeta();
        syncFollowBtn();
    }

    function syncFollowBtn() {
        const on = cam.follow && !!selected;
        followBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        followBtn.textContent = on ? 'Seguindo' : 'Seguir';
    }

    followBtn.addEventListener('click', () => {
        if (!selected) return;
        cam.follow = !cam.follow;
        cam.lastX = selected.x;
        cam.lastY = selected.y;
        camTouched = true;
        syncFollowBtn();
    });
    document.getElementById('inspectClose').addEventListener('click', () => {
        selected = null;
        syncInspect();
    });

    // ---- Toast / dica ----
    const toastEl = document.getElementById('toast');
    let toastTimer = 0;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
    }

    const hintEl = document.getElementById('hint');
    const hintText = document.getElementById('hintText');
    function dismissHint() {
        if (hintEl.classList.contains('gone')) return;
        hintEl.classList.add('gone');
        if (!settings.hintSeen) { settings.hintSeen = true; saveSettings(); }
    }

    // ---- Dock / controles ----
    const sceneRail = document.getElementById('sceneRail');
    const massSeg = document.getElementById('massSeg');
    const toggleTune = document.getElementById('toggleTune');
    const tunePanel = document.getElementById('tunePanel');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const stepBtn = document.getElementById('stepBtn');
    const undoBtn = document.getElementById('undoBtn');
    const restartBtn = document.getElementById('restartBtn');
    const clearBtn = document.getElementById('clear');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const fitBtn = document.getElementById('fitBtn');
    const slowerBtn = document.getElementById('slowerBtn');
    const fasterBtn = document.getElementById('fasterBtn');
    const themeSelect = document.getElementById('theme-select');
    const spreadInput = document.getElementById('spread');
    const spreadValue = document.getElementById('spreadValue');

    Scenes.list.forEach((sc, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'scene-chip';
        btn.dataset.scenario = sc.id;
        btn.setAttribute('aria-pressed', 'false');
        btn.title = `${sc.name} (${i + 1})`;
        btn.innerHTML = `<span class="scene-swatch" style="--chip:${sc.chip}"></span><span class="scene-name">${sc.name}</span>`;
        btn.addEventListener('click', () => loadScenario(sc.id, { undoable: true }));
        sceneRail.appendChild(btn);
    });
    const randomChip = document.createElement('button');
    randomChip.type = 'button';
    randomChip.className = 'scene-chip random';
    randomChip.id = 'random';
    randomChip.title = 'Cenário aleatório (Shift+R)';
    randomChip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg><span class="scene-name">Aleatório</span>';
    randomChip.addEventListener('click', randomScene);
    sceneRail.appendChild(randomChip);

    function randomScene() {
        const keys = Object.keys(themes);
        settings.theme = keys[Math.floor(Math.random() * keys.length)];
        themeSelect.value = settings.theme;
        applyTheme(settings.theme);
        const others = Scenes.list.filter((s) => s.id !== scene.id);
        loadScenario(others[Math.floor(Math.random() * others.length)].id, { undoable: true });
        saveSettings();
    }

    function buildMassSeg() {
        massSeg.textContent = '';
        const cur = presetIdx();
        scene.spawn.forEach((p, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'seg-btn' + (i === cur ? ' active' : '');
            b.setAttribute('aria-pressed', i === cur ? 'true' : 'false');
            b.textContent = p.label;
            b.title = fmtMass(p.m);
            b.addEventListener('click', () => {
                settings.mass[scene.id] = i;
                saveSettings();
                massSeg.querySelectorAll('.seg-btn').forEach((x, k) => {
                    x.classList.toggle('active', k === i);
                    x.setAttribute('aria-pressed', k === i ? 'true' : 'false');
                });
            });
            massSeg.appendChild(b);
        });
    }

    function setMode(mode) {
        mouseMode = mode;
        cancelInput();
        document.querySelectorAll('.tool-btn[data-mode]').forEach((b) => {
            const on = b.dataset.mode === mode;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        canvas.dataset.mode = mode;
        const tips = {
            pan: 'Arraste para mover a câmera · toque num astro para inspecionar',
            body: 'Arraste para trás e solte (estilingue) · toque rápido = órbita circular',
            spawn: 'Pinte poeira: ela nasce em órbita do astro mais próximo',
            attract: 'Segure para criar um poço gravitacional temporário',
            erase: 'Passe por cima para apagar corpos e poeira'
        };
        if (tips[mode]) setText(hintText, tips[mode]);
    }

    document.querySelectorAll('.tool-btn[data-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
            setMode(btn.dataset.mode);
            toast(btn.getAttribute('aria-label') + ': ' + hintText.textContent);
        });
    });

    function syncPlay() {
        playPauseBtn.setAttribute('aria-label', running ? 'Pausar' : 'Retomar');
        playPauseBtn.title = running ? 'Pausar (Espaço)' : 'Retomar (Espaço)';
        playPauseBtn.classList.toggle('paused', !running);
        hudDirty = true;
    }

    function setRunning(next) {
        running = next;
        acc = 0;
        syncPlay();
    }

    /* Passo-a-passo: avança o equivalente a um quadro (1/60 s) na velocidade atual. */
    function stepOnce() {
        if (running) setRunning(false);
        const n = Math.max(1, Math.min(maxSteps(), Math.round(rate() / 60 / world.dt)));
        try { simulate(n); } catch (err) { console.error(err); }
        stepsLastFrame = n;
        hudDirty = true;
    }

    function clearAll() {
        pushUndo();
        cancelInput();
        Physics.edit(world, () => {
            for (let i = 0; i < world.bodies.length; i++) world.bodies[i].alive = false;
            world.P.n = 0;
        });
        selected = null;
        syncInspect();
        toast('Espaço vazio. Desfazer (Ctrl+Z) traz tudo de volta.');
    }

    playPauseBtn.addEventListener('click', () => setRunning(!running));
    stepBtn.addEventListener('click', stepOnce);
    undoBtn.addEventListener('click', undo);
    restartBtn.addEventListener('click', () => loadScenario(scene.id, { undoable: true }));
    clearBtn.addEventListener('click', clearAll);
    slowerBtn.addEventListener('click', () => changeSpeed(-1));
    fasterBtn.addEventListener('click', () => changeSpeed(1));
    fitBtn.addEventListener('click', fitCamera);

    toggleTune.addEventListener('click', () => {
        const open = tunePanel.hidden;
        tunePanel.hidden = !open;
        toggleTune.setAttribute('aria-expanded', open ? 'true' : 'false');
        hudDirty = true;
    });

    function bindCheck(id, key, after) {
        const el = document.getElementById(id);
        el.checked = !!settings[key];
        el.addEventListener('change', () => {
            settings[key] = el.checked;
            saveSettings();
            if (after) after();
        });
        return el;
    }
    const trailsCheckbox = bindCheck('orbits', 'trails');
    const labelsCheckbox = bindCheck('labels', 'labels');
    bindCheck('predict', 'predict', () => { predDirty = true; });
    bindCheck('collide', 'collide', () => { world.collide = settings.collide; });
    bindCheck('glow', 'glow');
    bindCheck('stars', 'stars');
    bindCheck('velocityColor', 'velColor');
    bindCheck('additive', 'additive');

    themeSelect.addEventListener('change', () => {
        settings.theme = themeSelect.value;
        applyTheme(settings.theme);
        saveSettings();
    });
    spreadInput.addEventListener('input', () => {
        settings.spread = parseFloat(spreadInput.value) || 0;
        spreadValue.textContent = settings.spread + '%';
        saveSettings();
    });

    const canFs = Boolean(
        document.fullscreenEnabled || document.webkitFullscreenEnabled
    ) && typeof (document.documentElement.requestFullscreen
        || document.documentElement.webkitRequestFullscreen) === 'function';
    if (!canFs) {
        // iOS Safari: sem Fullscreen API de página — esconde o botão.
        fullscreenBtn.hidden = true;
    } else {
        fullscreenBtn.addEventListener('click', () => {
            const root = document.documentElement;
            const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
            if (!isFull) {
                const req = root.requestFullscreen || root.webkitRequestFullscreen;
                if (req) {
                    const p = req.call(root);
                    if (p && p.then) p.then(() => document.body.classList.add('fullscreen')).catch(() => {});
                    else document.body.classList.add('fullscreen');
                }
            } else {
                const exit = document.exitFullscreen || document.webkitExitFullscreen;
                if (exit) {
                    const p = exit.call(document);
                    if (p && p.then) p.then(() => document.body.classList.remove('fullscreen')).catch(() => {});
                    else document.body.classList.remove('fullscreen');
                }
            }
        });
    }
    const syncFs = () => {
        document.body.classList.toggle(
            'fullscreen',
            Boolean(document.fullscreenElement || document.webkitFullscreenElement)
        );
    };
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);

    // ---- Teclado ----
    const modeKeys = { v: 'pan', w: 'body', q: 'spawn', a: 'attract', x: 'erase' };
    const keysHeld = new Set();

    document.addEventListener('keydown', (e) => {
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        const k = e.key;
        if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) {
            e.preventDefault();
            undo();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (k === ' ' || e.code === 'Space') {
            if (tag === 'BUTTON') return;
            e.preventDefault();
            setRunning(!running);
        } else if (k === 'n' || k === 'N' || k === '.') {
            stepOnce();
        } else if (k === '[') {
            changeSpeed(-1);
        } else if (k === ']') {
            changeSpeed(1);
        } else if (k === '+' || k === '=') {
            zoomAt(cam.vcx, cam.vcy, 1.25);
        } else if (k === '-' || k === '_') {
            zoomAt(cam.vcx, cam.vcy, 0.8);
        } else if (k === '0') {
            fitCamera();
        } else if (k === 'R') {
            randomScene();
        } else if (k === 'r') {
            loadScenario(scene.id, { undoable: true });
        } else if (k === 'c' || k === 'C') {
            clearAll();
        } else if ((k === 'f' || k === 'F') && !fullscreenBtn.hidden) {
            fullscreenBtn.click();
        } else if (k === 't' || k === 'T') {
            trailsCheckbox.click();
            toast(settings.trails ? 'Rastros ligados.' : 'Rastros desligados.');
        } else if (k === 'l' || k === 'L') {
            labelsCheckbox.click();
        } else if (k === 'u' || k === 'U') {
            undo();
        } else if (k === 'Escape') {
            if (gesture.kind !== 'none') endGesture(false);
            else if (!tunePanel.hidden) toggleTune.click();
            else if (selected) { selected = null; syncInspect(); }
        } else if (k >= '1' && k <= '8') {
            const sc = Scenes.list[parseInt(k, 10) - 1];
            if (sc) loadScenario(sc.id, { undoable: true });
        } else if (k.startsWith('Arrow')) {
            e.preventDefault();
            const d = 60 / cam.s;
            if (k === 'ArrowLeft') cam.x -= d;
            if (k === 'ArrowRight') cam.x += d;
            if (k === 'ArrowUp') cam.y += d;
            if (k === 'ArrowDown') cam.y -= d;
            cam.follow = false;
            camTouched = true;
            syncFollowBtn();
        } else if (modeKeys[k.toLowerCase()]) {
            setMode(modeKeys[k.toLowerCase()]);
        }
    });

    // Aba oculta / janela sem foco: solta gestos e zera o relógio (sem salto de tempo).
    document.addEventListener('visibilitychange', () => {
        lastNow = 0;
        if (document.hidden) cancelInput();
    });
    window.addEventListener('blur', () => {
        cancelInput();
        lastNow = 0;
    });
    if (reduceMotionMQ && reduceMotionMQ.addEventListener) {
        reduceMotionMQ.addEventListener('change', (e) => { reduceMotion = e.matches; });
    }

    // --dock-h: o inspetor e o toast ficam logo acima do dock (que muda de altura).
    const dockEl = document.getElementById('dock');
    function syncDockVar() {
        const r = dockEl.getBoundingClientRect();
        document.documentElement.style.setProperty('--dock-h', Math.max(0, height - r.top) + 'px');
    }
    if (window.ResizeObserver) new ResizeObserver(syncDockVar).observe(dockEl);

    // ---- Física → UI (efeitos de eventos) ----
    world.onMerge = (keep, eaten) => {
        spawnShock(keep.x, keep.y, colorAlpha(keep.kind === 'blackhole' ? '#fb923c' : keep.color, 0.85), 140);
        if (selected === eaten) { selected = keep; syncInspect(); }
        if (eaten.name && keep.name) toast(`Fusão: ${keep.name} absorveu ${eaten.name} (momento conservado).`);
    };
    world.onDisrupt = (star, bh) => {
        spawnShock(star.x, star.y, 'rgba(255, 241, 193, 0.9)', 160);
        if (selected === star) { selected = null; syncInspect(); }
        toast(`Rompimento de maré: ${star.name || 'a estrela'} cruzou r_t de ${bh.name || 'buraco negro'}.`);
    };

    // ---- Início ----
    loadSettings();
    applyTheme(settings.theme);
    themeSelect.value = settings.theme;
    spreadInput.value = String(settings.spread);
    spreadValue.textContent = settings.spread + '%';
    world.collide = settings.collide;
    if (coarseMQ && coarseMQ.matches) setText(hintText, 'Arraste para lançar um planeta · toque rápido = órbita circular · pinça para zoom');
    else setText(hintText, 'Arraste para lançar um planeta · clique rápido = órbita circular · roda para zoom · Espaço pausa');
    if (settings.hintSeen) hintEl.classList.add('quick');
    setMode('body');
    syncPlay();

    if (window.LabRuntime) LabRuntime.debounceResize(resize);
    else window.addEventListener('resize', resize);
    window.addEventListener('load', () => { if (!camTouched) resize(); });

    const hashScene = (location.hash || '').replace('#', '');
    resize();
    loadScenario(Scenes.byId(hashScene) ? hashScene : 'solar', { silent: false });
    window.addEventListener('hashchange', () => {
        const id = (location.hash || '').replace('#', '');
        if (Scenes.byId(id) && id !== scene.id) loadScenario(id, { undoable: true });
    });

    if (window.LabRuntime) {
        LabRuntime.createLoop(frame).start();
    } else {
        const fallbackLoop = (now) => {
            if (!document.hidden) frame(now);
            requestAnimationFrame(fallbackLoop);
        };
        requestAnimationFrame(fallbackLoop);
    }
})();
