#!/usr/bin/env python3
"""Build the Rock Kombat stage background photos.

    python3 tools/build-stages.py

Turns the CC-licensed source photos in tools/source-photos/ (see CREDITS.md
for provenance) into the three backdrop plates the game blits behind its
procedural floor/props/crowd layers: assets/stage-{stadium,club,woodstock}.webp.

Each photo is cropped to the stage canvas's aspect ratio, blurred a little
(depth cue, and it blurs any recognisable faces into the general bokeh of a
concert crowd), colour-graded per venue and darkened/vignetted so the fighters
and HUD read clearly on top of it. The bottom band gets extra darkening since
that's where the game's own floor gradient and neon ground line are drawn on
top in script.js.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

STAGE_W = 1360
STAGE_H = 600
ASPECT = STAGE_W / STAGE_H

    'stadium': {
        'src': 'stadium-src.jpg',
        # Cool magenta/cyan arena wash — keep photos readable (MK digitized stages).
        'tint': (150, 90, 220), 'tint_amount': 0.14,
        'darken': 0.32, 'blur': 0.8,
        'crop_bias_y': -0.06,
        'center_dim': 0.0,
    },
    'club': {
        'src': 'club-src.jpg',
        # Warm amber/red dive-bar wash.
        'tint': (255, 90, 60), 'tint_amount': 0.16,
        'darken': 0.40, 'blur': 1.4,
        'crop_bias_y': -0.10,
        'center_dim': 0.35,
    },
    'woodstock': {
        'src': 'woodstock-src.jpg',
        # Golden-hour push — source is already warm.
        'tint': (255, 150, 60), 'tint_amount': 0.12,
        'darken': 0.34, 'blur': 1.2,
        'crop_bias_y': -0.08,
        'center_dim': 0.30,
    },
}


def crop_to_aspect(im, aspect, bias_y=0.0):
    w, h = im.size
    src_aspect = w / h
    if src_aspect > aspect:
        # Source is wider than target: crop the sides.
        new_w = round(h * aspect)
        x0 = (w - new_w) // 2
        box = (x0, 0, x0 + new_w, h)
    else:
        # Source is taller than target: crop top/bottom.
        new_h = round(w / aspect)
        y0 = (h - new_h) // 2 + round(bias_y * h)
        y0 = max(0, min(h - new_h, y0))
        box = (0, y0, w, y0 + new_h)
    return im.crop(box)


def tint_and_darken(im, tint, tint_amount, darken):
    arr = np.array(im).astype(np.float32)
    tint_arr = np.array(tint, dtype=np.float32)
    # Screen the tint in (brightens toward the tint colour in highlights,
    # leaves shadows mostly alone) then pull everything down uniformly --
    # reads as a colour-graded stage wash rather than a flat colour filter.
    screened = 255 - (255 - arr) * (255 - tint_arr) / 255
    arr = arr * (1 - tint_amount) + screened * tint_amount
    arr *= (1 - darken)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def vignette(im, strength=0.35):
    w, h = im.size
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2, h / 2
    dist = np.sqrt(((xx - cx) / (w / 2)) ** 2 + ((yy - cy) / (h / 2)) ** 2)
    falloff = np.clip(1 - strength * np.clip(dist - 0.35, 0, None), 0, 1)
    arr = np.array(im).astype(np.float32)
    arr *= falloff[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def center_dim(im, amount):
    """Extra darkening in a horizontal band across the middle of the frame --
    exactly where the two fighters stand -- so a photographed performer
    caught front-and-centre doesn't read as a third figure in the scene."""
    if amount <= 0:
        return im
    w, h = im.size
    xx = np.arange(w)
    cx = w / 2
    # Wide, soft falloff: strong through the middle third, gone by the edges.
    falloff = np.clip(1 - np.abs(xx - cx) / (w * 0.38), 0, 1) ** 1.5
    dim = 1 - amount * falloff
    arr = np.array(im).astype(np.float32)
    arr *= dim[None, :, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def darken_floor_band(im, band_frac=0.30, extra=0.55):
    """Extra gradient darkening on the bottom band where the procedural
    floor/neon line gets drawn on top, so the seam disappears."""
    w, h = im.size
    band_h = round(h * band_frac)
    arr = np.array(im).astype(np.float32)
    ramp = np.linspace(0, extra, band_h, dtype=np.float32)
    arr[h - band_h:, :, :3] *= (1 - ramp)[:, None, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def build_stage(name, cfg, source_dir, out_dir):
    im = Image.open(source_dir / cfg['src']).convert('RGB')
    im = crop_to_aspect(im, ASPECT, cfg.get('crop_bias_y', 0.0))
    im = im.resize((STAGE_W, STAGE_H), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(cfg['blur']))
    im = ImageEnhance.Contrast(im).enhance(1.12)
    im = ImageEnhance.Color(im).enhance(1.15)
    im = ImageEnhance.Sharpness(im).enhance(1.25)
    im = tint_and_darken(im, cfg['tint'], cfg['tint_amount'], cfg['darken'])
    im = center_dim(im, cfg.get('center_dim', 0.0))
    im = vignette(im, 0.26)
    im = darken_floor_band(im)

    out = out_dir / f'stage-{name}.webp'
    im.save(out, 'WEBP', quality=88, method=6)
    return out


def main():
    root = Path(__file__).resolve().parent.parent
    source_dir = Path(__file__).resolve().parent / 'source-photos'
    out_dir = root / 'assets'

    total = 0
    for name, cfg in STAGES.items():
        out = build_stage(name, cfg, source_dir, out_dir)
        size = out.stat().st_size
        total += size
        print(f'{name:9s} -> {out.name}  {size / 1024:6.1f} KB')

    print(f'\ntotal stage payload: {total / 1024:.1f} KB')


if __name__ == '__main__':
    main()
