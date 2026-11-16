/**
 * audio — ambiência portuária 100% sintetizada (A01–A02), sem arquivos.
 *   mar/vento  : ruído rosa filtrado (passa-banda), mais forte no mar aberto
 *   pad        : quinta aberta em Ré (73/110/147 Hz), original, sem melodia citada
 *   gaivotas   : glissando senoidal 1,4 kHz → 0,8 kHz com vibrato
 *   apito      : dois dentes-de-serra (155 + 233 Hz) com ataque lento — soa aos 96 s e 104 s
 *   sino       : parciais inarmônicos (1 : 2,76 : 5,4) decaindo — cais, na atracação
 *   locomotiva : rajadas de ruído em 4 tempos (chuff) no capítulo do Valongo
 */

export function createAudio() {
    const st = { ctx: null, enabled: true, volume: 0.7, master: null, started: false, gull: 3, chuff: 0, lastT: 0, fired: new Set() };

    function noiseBuffer(actx, seconds) {
        const n = actx.sampleRate * seconds;
        const buf = actx.createBuffer(1, n, actx.sampleRate);
        const d = buf.getChannelData(0);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        for (let i = 0; i < n; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.997 * b0 + w * 0.03;
            b1 = 0.985 * b1 + w * 0.05;
            b2 = 0.95 * b2 + w * 0.09;
            d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6;
        }
        return buf;
    }

    function init() {
        if (st.ctx) {
            if (st.ctx.state === 'suspended') st.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const a = new Ctx();
        st.ctx = a;
        st.master = a.createGain();
        st.master.gain.value = st.enabled ? st.volume : 0;
        const comp = a.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 3;
        st.master.connect(comp);
        comp.connect(a.destination);
        st.amb = a.createGain();
        st.amb.gain.value = 0.6;
        st.sfx = a.createGain();
        st.sfx.gain.value = 0.5;
        st.amb.connect(st.master);
        st.sfx.connect(st.master);
        st.noise = noiseBuffer(a, 3);

        const padF = a.createBiquadFilter();
        padF.type = 'lowpass';
        padF.frequency.value = 460;
        padF.connect(st.amb);
        for (const [f, g] of [[73.42, 0.06], [110, 0.04], [146.83, 0.022], [220.4, 0.008]]) {
            const o = a.createOscillator();
            o.type = 'sine';
            o.frequency.value = f;
            const gg = a.createGain();
            gg.gain.value = g;
            o.connect(gg);
            gg.connect(padF);
            o.start();
        }

        const mk = (freq, q, gain) => {
            const src = a.createBufferSource();
            src.buffer = st.noise;
            src.loop = true;
            const f = a.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.value = freq;
            f.Q.value = q;
            const g = a.createGain();
            g.gain.value = gain;
            src.connect(f);
            f.connect(g);
            g.connect(st.amb);
            src.start();
            return { f, g };
        };
        st.sea = mk(380, 0.5, 0.16);
        st.hiss = mk(2400, 0.8, 0.02);
        // marola: LFO lento abrindo o filtro do mar
        const lfo = a.createOscillator();
        lfo.frequency.value = 0.13;
        const lg = a.createGain();
        lg.gain.value = 140;
        lfo.connect(lg);
        lg.connect(st.sea.f.frequency);
        lfo.start();
        st.started = true;
    }

    function gull() {
        const a = st.ctx;
        const t0 = a.currentTime;
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            const o = a.createOscillator();
            o.type = 'triangle';
            const g = a.createGain();
            const s = t0 + i * 0.32;
            const base = 1300 + Math.random() * 500;
            o.frequency.setValueAtTime(base, s);
            o.frequency.linearRampToValueAtTime(base * 1.25, s + 0.07);
            o.frequency.exponentialRampToValueAtTime(base * 0.6, s + 0.3);
            g.gain.setValueAtTime(0.0001, s);
            g.gain.exponentialRampToValueAtTime(0.045, s + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, s + 0.3);
            o.connect(g);
            g.connect(st.sfx);
            o.start(s);
            o.stop(s + 0.35);
        }
    }

    function horn(dur = 2.6) {
        const a = st.ctx;
        const t0 = a.currentTime;
        const f = a.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.35);
        g.gain.setValueAtTime(0.22, t0 + dur - 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        f.connect(g);
        g.connect(st.sfx);
        for (const hz of [155, 233, 156.2]) {
            const o = a.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(hz * 0.94, t0);
            o.frequency.linearRampToValueAtTime(hz, t0 + 0.4);
            o.connect(f);
            o.start(t0);
            o.stop(t0 + dur + 0.05);
        }
    }

    function bell() {
        const a = st.ctx;
        const t0 = a.currentTime;
        for (const [m, g0, d] of [[1, 0.09, 2.2], [2.76, 0.05, 1.4], [5.4, 0.025, 0.8]]) {
            const o = a.createOscillator();
            o.type = 'sine';
            o.frequency.value = 620 * m;
            const g = a.createGain();
            g.gain.setValueAtTime(g0, t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
            o.connect(g);
            g.connect(st.sfx);
            o.start(t0);
            o.stop(t0 + d + 0.05);
        }
    }

    function chuff(strength) {
        const a = st.ctx;
        const t0 = a.currentTime;
        const src = a.createBufferSource();
        src.buffer = st.noise;
        const f = a.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 520;
        f.Q.value = 0.9;
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.11 * strength, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
        src.connect(f);
        f.connect(g);
        g.connect(st.sfx);
        src.start(t0, Math.random() * 2);
        src.stop(t0 + 0.3);
    }

    // eventos pontuais do filme: [tempo, ação]
    const CUES = [[96, () => horn(2.8)], [101.5, () => horn(1.2)], [112, bell], [113.2, bell], [126, bell], [149, () => horn(0.9)]];

    return {
        init,
        setVolume(v) {
            st.volume = v;
            if (st.master) st.master.gain.value = st.enabled ? v : 0;
        },
        setEnabled(on) {
            st.enabled = on;
            if (st.master) st.master.gain.value = on ? st.volume : 0;
        },
        get enabled() { return st.enabled; },
        update(t, dt, chapterId, playing) {
            if (!st.started || !playing) return;
            if (t < st.lastT) st.fired.clear(); // reinício / seek para trás
            st.lastT = t;
            const sea = chapterId === 'sea' ? 0.22 : chapterId === 'estuary' ? 0.16 : chapterId === 'rise' ? 0.08 : 0.1;
            st.sea.g.gain.value += (sea - st.sea.g.gain.value) * 0.03;
            const hiss = chapterId === 'port' || chapterId === 'dock' ? 0.035 : chapterId === 'rail' ? 0.05 : 0.012;
            st.hiss.g.gain.value += (hiss - st.hiss.g.gain.value) * 0.03;
            if (!st.enabled) return;
            st.gull -= dt;
            if (st.gull <= 0) {
                gull();
                st.gull = 3 + Math.random() * 7;
            }
            for (let i = 0; i < CUES.length; i++) {
                if (t >= CUES[i][0] && t < CUES[i][0] + 1 && !st.fired.has(i)) {
                    st.fired.add(i);
                    CUES[i][1]();
                }
            }
            if (chapterId === 'rail') {
                st.chuff -= dt;
                if (st.chuff <= 0) {
                    const k = Math.min(1, Math.max(0, (t - 150) / 8));
                    chuff(0.6 + k * 0.4);
                    st.chuff = 0.55 - k * 0.3;
                }
            }
        },
        dispose() {
            try { st.ctx?.close(); } catch { /* já fechado */ }
        }
    };
}
