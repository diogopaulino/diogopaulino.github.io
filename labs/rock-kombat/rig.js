/**
 * Rock Kombat skeletal sprite runtime.
 *
 * Loads the atlases produced by `tools/build-sprites.py` and poses each fighter
 * as a bone chain: every part inherits its parent's transform, so rotating the
 * torso carries the head and both arms with it.
 *
 * Each character is composited into its own offscreen buffer once per frame.
 * The arena then blits that buffer for the fighter, its floor reflection and any
 * after-images, so the eleven transformed draws are paid for exactly once.
 */
(function (global) {
  'use strict';

  // Headroom around the base pose so an extended kick or punch is not clipped.
  const PAD = { left: 150, top: 120, right: 150, bottom: 40 };

  /** 3x3 affine: rotate `deg` about (px,py), then translate by (dx,dy). */
  function jointMatrix(deg, dx, dy, px, py) {
    const t = deg * Math.PI / 180;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    return [
      cos, -sin, px + dx - cos * px + sin * py,
      sin, cos, py + dy - sin * px - cos * py,
    ];
  }

  function multiply(a, b) {
    return [
      a[0] * b[0] + a[1] * b[3], a[0] * b[1] + a[1] * b[4], a[0] * b[2] + a[1] * b[5] + a[2],
      a[3] * b[0] + a[4] * b[3], a[3] * b[1] + a[4] * b[4], a[3] * b[2] + a[4] * b[5] + a[5],
    ];
  }

  const IDENTITY = [1, 0, 0, 0, 1, 0];

  class Fighter {
    constructor(meta, image) {
      this.meta = meta;
      this.image = image;
      this.order = meta.order;
      this.parts = meta.parts;
      this.baseW = meta.base[0];
      this.baseH = meta.base[1];

      this.width = this.baseW + PAD.left + PAD.right;
      this.height = this.baseH + PAD.top + PAD.bottom;
      // Where the character's feet sit inside the buffer.
      this.anchorX = PAD.left + meta.anchor[0];
      this.anchorY = PAD.top + meta.anchor[1];

      this.buffer = document.createElement('canvas');
      this.buffer.width = this.width;
      this.buffer.height = this.height;
      this.bufferCtx = this.buffer.getContext('2d');

      this._matrices = Object.create(null);
    }

    /** Resolve every part's world matrix for `pose`. */
    _resolve(pose) {
      const mats = this._matrices;
      for (const name in this.parts) mats[name] = null;

      const build = (name) => {
        if (mats[name]) return mats[name];
        const part = this.parts[name];
        const p = pose[name];
        const local = p
          ? jointMatrix(p[0], p[1], p[2], part.px, part.py)
          : IDENTITY;
        mats[name] = part.parent ? multiply(build(part.parent), local) : local;
        return mats[name];
      };

      for (const name in this.parts) build(name);
      return mats;
    }

    /**
     * Draw the posed skeleton into this fighter's buffer.
     * `front` lifts limbs above the body for frames where they swing past it.
     */
    compose(pose, front) {
      const ctx = this.bufferCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      const mats = this._resolve(pose);
      const lifted = front && front.length ? front : null;
      const order = lifted
        ? this.order.filter(n => lifted.indexOf(n) === -1).concat(
          this.order.filter(n => lifted.indexOf(n) !== -1))
        : this.order;

      for (let i = 0; i < order.length; i++) {
        const name = order[i];
        const part = this.parts[name];
        const m = mats[name];
        ctx.setTransform(m[0], m[3], m[1], m[4], m[2] + PAD.left, m[5] + PAD.top);
        ctx.drawImage(this.image, part.x, part.y, part.w, part.h, part.ox, part.oy, part.w, part.h);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return this.buffer;
    }
  }

  /**
   * Plays a clip and blends between its keyframes.
   *
   * Keyframes carry a `hold` in 60 Hz ticks; sampling interpolates across that
   * hold so motion stays smooth at any refresh rate rather than stepping.
   */
  class Animator {
    constructor(clips) {
      this.clips = clips;
      this.name = null;
      this.frame = 0;
      this.tick = 0;
      this.done = false;
      this.play('idle');
    }

    play(name, restart) {
      if (!this.clips[name]) name = 'idle';
      if (this.name === name && !restart) return;
      this.name = name;
      this.frame = 0;
      this.tick = 0;
      this.done = false;
    }

    /** Advance one fixed 60 Hz step. */
    update() {
      const clip = this.clips[this.name];
      const frames = clip.frames;
      this.tick++;
      if (this.tick < frames[this.frame].hold) return;

      this.tick = 0;
      if (this.frame + 1 < frames.length) {
        this.frame++;
      } else if (clip.loop) {
        this.frame = 0;
      } else {
        this.done = true;
      }
    }

    /**
     * Current pose, blended toward the next keyframe.
     * `progress` (0..1) overrides the internal clock so an attack animation can
     * be driven straight off its hit timer.
     */
    sample(progress) {
      const clip = this.clips[this.name];
      const frames = clip.frames;

      let index, t;
      if (typeof progress === 'number') {
        const pos = Math.max(0, Math.min(0.9999, progress)) * frames.length;
        index = Math.floor(pos);
        t = pos - index;
      } else {
        index = this.frame;
        t = this.done ? 0 : this.tick / frames[index].hold;
      }

      const current = frames[index];
      const nextIndex = index + 1 < frames.length ? index + 1 : (clip.loop ? 0 : index);
      const next = frames[nextIndex];

      const pose = Object.create(null);
      const a = current.pose;
      const b = next.pose;

      for (const key in a) {
        const va = a[key];
        const vb = b[key] || [0, 0, 0];
        pose[key] = [
          va[0] + (vb[0] - va[0]) * t,
          va[1] + (vb[1] - va[1]) * t,
          va[2] + (vb[2] - va[2]) * t,
        ];
      }
      for (const key in b) {
        if (key in pose) continue;
        const vb = b[key];
        pose[key] = [vb[0] * t, vb[1] * t, vb[2] * t];
      }

      return { pose, front: current.front };
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load ${src}`));
      img.src = src;
    });
  }

  /** Load the manifest and every fighter atlas. */
  async function load(manifestUrl, baseUrl) {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`atlas manifest ${response.status}`);
    const manifest = await response.json();

    const fighters = Object.create(null);
    await Promise.all(Object.keys(manifest.fighters).map(async (id) => {
      const meta = manifest.fighters[id];
      fighters[id] = new Fighter(meta, await loadImage(baseUrl + meta.image));
    }));

    return { fighters, clips: manifest.clips, Animator };
  }

  global.RockKombatRig = { load, Animator, PAD };
})(window);
