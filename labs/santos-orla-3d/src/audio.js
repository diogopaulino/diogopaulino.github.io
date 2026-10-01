// Procedural ambience, never presented as a live or recorded Santos soundscape.
// Low-pass filtered pink-ish noise is amplitude-modulated as slow surf cycles.
export function create() {
  let ctx, gain, source, enabled = false;
  async function toggle() {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('audio');
      ctx = new AudioContext();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 8, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < channel.length; i++) { last = (last + (Math.random() * 2 - 1) * .03) / 1.03; channel[i] = last * 5; }
      source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 950;
      gain = ctx.createGain(); gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(ctx.destination); source.start();
    }
    await ctx.resume();
    enabled = !enabled;
    gain.gain.setTargetAtTime(enabled ? .15 : 0, ctx.currentTime, .4);
    return enabled;
  }
  function update(t) {
    if (enabled && ctx?.state === 'running') gain.gain.setTargetAtTime(document.hidden ? 0 : .09 + .08 * (1 + Math.sin(t * .55)) / 2, ctx.currentTime, .25);
  }
  return { toggle, update, dispose: () => ctx?.close() };
}
