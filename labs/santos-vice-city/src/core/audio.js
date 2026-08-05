// core/audio.js — synth PSG + scheduler de tracker + SFX. Teto: ~330 linhas.
// FASE 0 STUB: estrutura pronta, música e SFX tocam silenciosamente na Fase 2.

export class AudioEngine {
    constructor(ctx = null) {
        this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.muted = false;
    }

    setMute(mute) { this.muted = mute; this.masterGain.gain.setValueAtTime(mute ? 0 : 1, this.ctx.currentTime); }
    setVolume(vol) { this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime); }

    play(id) { /* stub */ }
    playSong(name) { /* stub */ }
    stopSong() { /* stub */ }
    unlock() { /* stub */ }
}

export function createAudio() {
    return new AudioEngine();
}
