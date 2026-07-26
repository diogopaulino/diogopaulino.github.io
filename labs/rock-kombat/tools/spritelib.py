"""Shared image helpers for the Rock Kombat sprite pipeline."""

import numpy as np
from PIL import Image, ImageFilter

from rig import CLEANUP, SIDE_TRIM, RIGS

# Character height, in pixels, of every baked frame. The arena renders fighters
# around 230 logical px tall on a 960x540 stage, so this is a 2x master.
TARGET_HEIGHT = 452


def _alpha_of(im):
    """Return the alpha channel, deriving one by chroma key if the art has none."""
    arr = np.array(im)
    alpha = arr[..., 3]
    if alpha.min() == 255:
        r = arr[..., 0].astype(np.int16)
        g = arr[..., 1].astype(np.int16)
        b = arr[..., 2].astype(np.int16)
        green = (g > 120) & (g > r * 1.3) & (g > b * 1.3)
        white = (r > 235) & (g > 235) & (b > 235)
        alpha = np.where(green | white, 0, 255).astype(np.uint8)
    return arr, alpha


def _despill(arr, alpha):
    """Pull green fringing out of edge pixels left behind by a chroma key."""
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    spill = (g > r + 18) & (g > b + 18) & (alpha > 0)
    ceiling = np.maximum(r, b) + 12
    arr[..., 1] = np.where(spill, np.minimum(g, ceiling), g).astype(np.uint8)
    return arr


def load_base(who, assets_dir):
    """Load a fighter's base pose, cleaned, trimmed and scaled to TARGET_HEIGHT.

    Returns (image, scale) where scale converts source px to output px.
    """
    src = assets_dir / RIGS[who]['src']
    im = Image.open(src).convert('RGBA')
    arr, alpha = _alpha_of(im)
    arr = _despill(arr, alpha)
    arr[..., 3] = alpha

    h, w = alpha.shape

    # Drop the ground slab / dust baked into the bottom of some poses.
    rule = CLEANUP.get(who)
    if rule:
        y_cut = int(h * rule['y'])
        band = np.zeros(w, dtype=bool)
        for x0, x1 in rule['keep']:
            band[int(w * x0):int(w * x1)] = True
        arr[y_cut:, ~band, 3] = 0

    # Drop decorative speed lines floating beside the body.
    for x0, y0, x1, y1 in SIDE_TRIM.get(who, []):
        arr[int(h * y0):int(h * y1), int(w * x0):int(w * x1), 3] = 0

    # Dissolve the last few rows so any floor residue fades out at the sole line
    # instead of ending on a hard horizontal cut.
    fade_from = int(h * 0.965)
    ramp = np.linspace(1.0, 0.0, h - fade_from, dtype=np.float32)[:, None]
    arr[fade_from:, :, 3] = (arr[fade_from:, :, 3].astype(np.float32) * ramp).astype(np.uint8)

    im = Image.fromarray(arr)

    # Soften the hard edges the cleanup just introduced.
    a = im.getchannel('A').filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(a)

    mask = np.array(im)[..., 3] > 40
    ys, xs = np.where(mask)
    im = im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))

    scale = TARGET_HEIGHT / im.height
    return im.resize((max(1, round(im.width * scale)), TARGET_HEIGHT), Image.LANCZOS), scale


def _box_mask(w, h, box):
    """Near-hard-edged mask for a normalised (x0,y0,x1,y1) box.

    A 1px blur plus a smoothstep collapses what used to be an 8-10px feather
    ramp down to about a pixel, so two overlapping parts read as one opaque
    surface instead of both fading to 75% where they meet.
    """
    x0, y0, x1, y1 = box
    bx0, by0 = int(w * x0), int(h * y0)
    bx1, by1 = int(w * x1), int(h * y1)
    m = np.zeros((h, w), dtype=np.float32)
    m[by0:by1, bx0:bx1] = 1.0
    soft = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    soft = np.array(soft).astype(np.float32) / 255.0
    return np.clip((soft - 0.35) / 0.30, 0.0, 1.0)


def _disk_mask(w, h, cx, cy, radius):
    yy, xx = np.mgrid[0:h, 0:w]
    return (((xx - cx) ** 2 + (yy - cy) ** 2) <= radius ** 2).astype(np.float32)


def cut_parts(who, base):
    """Slice the base pose into rig parts.

    Each part comes back as a full-canvas RGBA layer so later affine transforms
    can be expressed in one shared coordinate space. Parts are only allowed to
    overlap their parent and direct children (sharing a joint) -- everyone else
    is clipped out of the layer except in a small disc around *their own*
    pivot, which is what stopped e.g. the torso from carrying a baked-in copy
    of the forearm that then doubled up once the real forearm rotated away.
    """
    w, h = base.size
    src_alpha = np.array(base)[..., 3].astype(np.float32)
    parts_spec = RIGS[who]['parts']
    joint_radius = 0.07 * min(w, h)
    box_masks = {name: _box_mask(w, h, spec['box']) for name, spec in parts_spec.items()}
    layers = {}

    # A flat pose only has one pixel value per coordinate: wherever two parts'
    # boxes overlap, that pixel is really whichever part paints on top in the
    # final rig (its higher z). So for each part we clip out the footprint of
    # every part drawn *after* it, keeping a small disc around the pivot only
    # when the two are directly jointed (parent/child) -- that disc is the
    # actual shared joint, everything else is the other part's content baked
    # into a layer that will never legitimately show it.
    for name, spec in parts_spec.items():
        mask = box_masks[name].copy()

        for other_name, other_spec in parts_spec.items():
            if other_name == name or other_spec['z'] <= spec['z']:
                continue
            direct = other_spec['parent'] == name or spec['parent'] == other_name
            exclude = box_masks[other_name]
            if direct:
                child_spec = other_spec if other_spec['parent'] == name else spec
                px = child_spec['pivot'][0] * w
                py = child_spec['pivot'][1] * h
                disk = _disk_mask(w, h, px, py, joint_radius)
                exclude = exclude * (1.0 - disk)
            mask = np.clip(mask - exclude, 0.0, 1.0)

        combined = mask * src_alpha

        layer = np.array(base).copy()
        layer[..., 3] = np.clip(combined, 0, 255).astype(np.uint8)
        layers[name] = Image.fromarray(layer)

    return layers
