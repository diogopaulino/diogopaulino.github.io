/**
 * audio — ambiência portuária procedural (A01–A02).
 * Água, vapor, gaivotas sintéticas, pad matinal original.
 */

export function create(ctx) {
    const state = {
        ctx: null,
        enabled: true,
        volume: 0.7,
        master: null,
        started: false,
        gullTimer: 0
    };

    function init() {
        if (state.ctx) {
            if (state.ctx.state === 'suspended') state.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const actx = new Ctx();
        state.ctx = actx;

        state.master = actx.createGain();
        state.master.gain.value = state.enabled ? state.volume : 0;
        const comp = actx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 3;
        state.master.connect(comp);
        comp.connect(actx.destination);

        state.amb = actx.createGain();
        state.amb.gain.value = 0.55;
        state.sfx = actx.createGain();
        state.sfx.gain.value = 0.45;
        state.amb.connect(state.master);
        state.sfx.connect(state.master);

        // Pad matinal — quinta aberta, sem melodia citada
        const padFilter = actx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 480;
        padFilter.connect(state.amb);

        for (const [freq, gain] of [[73.42, 0.07], [110, 0.045], [146.83, 0.025]]) {
            const o = actx.createOscillator();
            o.type = 'sine';
            o.frequency.value = freq;
            const g = actx.createGain();
            g.gain.value = gain;
            o.connect(g);
            g.connect(padFilter);
            o.start();
        }

        // Ruído de água / vento
        const bufferSize = actx.sampleRate * 3;
        const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
        const noise = actx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const noiseFilter = actx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 420;
        noiseFilter.Q.value = 0.6;
        const noiseGain = actx.createGain();
        noiseGain.gain.value = 0.08;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(state.amb);
        noise.start();
        state.noiseGain = noiseGain;

        // Pulso de vapor grave
        const steam = actx.createOscillator();
        steam.type = 'sawtooth';
        steam.frequency.value = 45;
        const steamF = actx.createBiquadFilter();
        steamF.type = 'lowpass';
        steamF.frequency.value = 120;
        const steamG = actx.createGain();
        steamG.gain.value = 0.02;
        steam.connect(steamF);
        steamF.connect(steamG);
        steamG.connect(state.amb);
        steam.start();
        state.steamG = steamG;

        state.started = true;
    }

    function cryGull() {
        if (!state.ctx || !state.enabled) return;
        const actx = state.ctx;
        const t0 = actx.currentTime;
        const o = actx.createOscillator();
        o.type = 'sine';
        const g = actx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.06, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
        o.frequency.setValueAtTime(1200 + Math.random() * 400, t0);
        o.frequency.exponentialRampToValueAtTime(700 + Math.random() * 200, t0 + 0.4);
        o.connect(g);
        g.connect(state.sfx);
        o.start(t0);
        o.stop(t0 + 0.6);
    }

    return {
        init,
        setVolume(v) {
            state.volume = v;
            if (state.master) state.master.gain.value = state.enabled ? v : 0;
        },
        setEnabled(on) {
            state.enabled = on;
            if (on) init();
            if (state.master) state.master.gain.value = on ? state.volume : 0;
        },
        get enabled() { return state.enabled; },
        update(t, dt, chapterId) {
            if (!state.started) return;
            // Mais água no mar, mais vapor no porto
            if (state.noiseGain) {
                const target = chapterId === 'sea' || chapterId === 'estuary' ? 0.1 : 0.06;
                state.noiseGain.gain.value += (target - state.noiseGain.gain.value) * 0.02;
            }
            if (state.steamG) {
                const target = chapterId === 'port' || chapterId === 'dock' ? 0.035 : 0.015;
                state.steamG.gain.value += (target - state.steamG.gain.value) * 0.02;
            }
            state.gullTimer -= dt;
            if (state.gullTimer <= 0) {
                cryGull();
                state.gullTimer = 4 + Math.random() * 8;
            }
            void t;
            void ctx;
        },
        dispose() {
            try { state.ctx?.close(); } catch { /* */ }
        }
    };
}
