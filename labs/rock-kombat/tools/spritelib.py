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


def _box_mask(w, h, box, soft=1.0):
    """Mask for a normalised (x0,y0,x1,y1) box.

    `soft` is the Gaussian blur radius. Limbs use a harder edge so subtracting
    them from the torso doesn't leave a translucent gap at every seam.
    """
    x0, y0, x1, y1 = box
    bx0, by0 = int(w * x0), int(h * y0)
    bx1, by1 = int(w * x1), int(h * y1)
    m = np.zeros((h, w), dtype=np.float32)
    m[by0:by1, bx0:bx1] = 1.0
    if soft <= 0:
        return m
    soft_im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(soft))
    soft_arr = np.array(soft_im).astype(np.float32) / 255.0
    return np.clip((soft_arr - 0.35) / 0.30, 0.0, 1.0)


def _disk_mask(w, h, cx, cy, radius):
    yy, xx = np.mgrid[0:h, 0:w]
    return (((xx - cx) ** 2 + (yy - cy) ** 2) <= radius ** 2).astype(np.float32)


def cut_parts(who, base):
    """Slice the base pose into rig parts.

    Each part comes back as a full-canvas RGBA layer so later affine transforms
    can be expressed in one shared coordinate space.

    Cutting rules:
      1. Limbs own a hard core of their box (so a lead punch arm keeps its fist).
      2. Torso/pelvis/head keep everything else, plus a joint disc so seams don't
         open when a limb rotates a few degrees.
      3. Higher-z limbs still win overlaps against lower-z siblings (front arm
         over back arm) the way the paint order expects.
    """
    w, h = base.size
    src = np.array(base)
    src_alpha = src[..., 3].astype(np.float32)
    parts_spec = RIGS[who]['parts']
    joint_radius = 0.10 * min(w, h)

    BODY = {'pelvis', 'torso', 'head'}
    LIMBS = {n for n in parts_spec if n not in BODY}

    # Hard cores for limbs (almost no feather) + soft boxes for body.
    box_hard = {n: _box_mask(w, h, s['box'], soft=0.4 if n in LIMBS else 1.0)
                for n, s in parts_spec.items()}

    # Union of every limb core — body will yield this, except at joints.
    limb_union = np.zeros((h, w), dtype=np.float32)
    for n in LIMBS:
        limb_union = np.maximum(limb_union, box_hard[n])

    layers = {}
    for name, spec in parts_spec.items():
        mask = box_hard[name].copy()

        if name in BODY:
            # Body keeps joint discs so rotating a limb doesn't tear a hole
            # the size of the whole forearm out of the chest on frame 1.
            keep = np.zeros((h, w), dtype=np.float32)
            for limb_name, limb_spec in parts_spec.items():
                if limb_name not in LIMBS:
                    continue
                # Keep a disc around any joint that attaches this body part
                # to a limb (shoulder on torso, hip on pelvis).
                if limb_spec['parent'] == name or (
                        name == 'pelvis' and limb_spec['parent'] == 'pelvis'):
                    px = limb_spec['pivot'][0] * w
                    py = limb_spec['pivot'][1] * h
                    keep = np.maximum(keep, _disk_mask(w, h, px, py, joint_radius))
                # Head also keeps a disc around its own neck pivot.
                if name == 'head':
                    px = spec['pivot'][0] * w
                    py = spec['pivot'][1] * h
                    keep = np.maximum(keep, _disk_mask(w, h, px, py, joint_radius * 0.7))
            mask = np.clip(mask - limb_union * (1.0 - keep), 0.0, 1.0)

            # Head must not be eaten by arm boxes that brush the jawline —
            # re-assert the head box so jaw/hair stay on the head layer.
            if name == 'head':
                mask = np.maximum(mask, box_hard['head'])

        else:
            # Limbs yield to higher-z siblings (and to the head — never steal face).
            for other_name, other_spec in parts_spec.items():
                if other_name == name:
                    continue
                steals = (
                    (other_name == 'head')
                    or (other_name in LIMBS and other_spec['z'] > spec['z'])
                )
                if not steals:
                    continue
                direct = other_spec['parent'] == name or spec['parent'] == other_name
                exclude = box_hard[other_name]
                if direct:
                    child_spec = other_spec if other_spec['parent'] == name else spec
                    px = child_spec['pivot'][0] * w
                    py = child_spec['pivot'][1] * h
                    disk = _disk_mask(w, h, px, py, joint_radius * 0.85)
                    exclude = exclude * (1.0 - disk)
                mask = np.clip(mask - exclude, 0.0, 1.0)

        combined = mask * src_alpha
        layer = src.copy()
        layer[..., 3] = np.clip(combined, 0, 255).astype(np.uint8)
        layers[name] = Image.fromarray(layer)

    # Heal: any opaque source pixel that no part claimed gets assigned to the
    # torso (or pelvis if it's below the waist). Without this, soft-box seams
    # leave magenta-sized holes even in the identity pose.
    claimed = np.zeros((h, w), dtype=np.float32)
    for name in layers:
        claimed = np.maximum(claimed, np.array(layers[name])[..., 3].astype(np.float32))
    orphan = (src_alpha > 40) & (claimed < 40)
    if orphan.any():
        waist = int(h * 0.55)
        for name, y0, y1 in (('torso', 0, waist + int(h * 0.08)),
                             ('pelvis', waist - int(h * 0.05), h)):
            if name not in layers:
                continue
            layer = np.array(layers[name])
            band = orphan.copy()
            band[:y0, :] = False
            band[y1:, :] = False
            layer[band, :3] = src[band, :3]
            layer[band, 3] = src[band, 3]
            layers[name] = Image.fromarray(layer)
            orphan[band] = False
        # Anything still orphaned (boots, hair tips) goes to the nearest limb
        # by box centroid — keeps feet from vanishing.
        if orphan.any():
            for name, spec in parts_spec.items():
                if name not in LIMBS:
                    continue
                x0, y0, x1, y1 = spec['box']
                bx0, by0, bx1, by1 = int(w * x0), int(h * y0), int(w * x1), int(h * y1)
                region = orphan.copy()
                region[:by0, :] = False
                region[by1:, :] = False
                region[:, :bx0] = False
                region[:, bx1:] = False
                if not region.any():
                    continue
                layer = np.array(layers[name])
                layer[region, :3] = src[region, :3]
                layer[region, 3] = src[region, 3]
                layers[name] = Image.fromarray(layer)
                orphan[region] = False

    return layers
