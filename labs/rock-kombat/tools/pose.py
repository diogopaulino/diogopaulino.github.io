"""Forward-kinematics posing for the cutout rig.

A pose is `{part_name: (angle_deg, dx, dy)}` expressed in the parent's frame.
Parts inherit their parent's transform, so rotating `torso` carries the head and
both arms with it, exactly like a bone chain.
"""

import math

import numpy as np
from PIL import Image

from rig import RIGS, Z_ORDER


def _mat(angle_deg, dx, dy, px, py):
    """Rotate about (px, py) then translate."""
    t = math.radians(angle_deg)
    cos, sin = math.cos(t), math.sin(t)
    # Translate(p) . Translate(d) . Rotate(t) . Translate(-p)
    return np.array([
        [cos, -sin, px + dx - cos * px + sin * py],
        [sin, cos, py + dy - sin * px - cos * py],
        [0.0, 0.0, 1.0],
    ])


def world_transforms(who, pose, size):
    """Resolve every part's world matrix for one pose."""
    w, h = size
    specs = RIGS[who]['parts']
    out = {}

    def resolve(name):
        if name in out:
            return out[name]
        spec = specs[name]
        angle, dx, dy = pose.get(name) or (0.0, 0.0, 0.0)
        px, py = spec['pivot'][0] * w, spec['pivot'][1] * h
        local = _mat(angle, dx, dy, px, py)
        parent = spec['parent']
        out[name] = (resolve(parent) @ local) if parent else local
        return out[name]

    for name in specs:
        resolve(name)
    return out


def render_pose(who, layers, pose, size, pad=(160, 120, 160, 40)):
    """Composite the rig into one RGBA frame.

    `pad` is (left, top, right, bottom) headroom so extended limbs are not
    clipped. Returns the padded frame plus the origin of the base pose inside it.
    """
    w, h = size
    pl, pt, pr, pb = pad
    canvas = Image.new('RGBA', (w + pl + pr, h + pt + pb), (0, 0, 0, 0))
    mats = world_transforms(who, pose, size)

    offset = np.array([[1.0, 0.0, pl], [0.0, 1.0, pt], [0.0, 0.0, 1.0]])

    # A clip can lift limbs to the top for the frames where they swing past the
    # body -- a leading fist has to cross in front of the chest, not behind it.
    front = pose.get('front', ())
    order = [n for n in Z_ORDER if n not in front] + [n for n in Z_ORDER if n in front]

    for name in order:
        if name not in layers:
            continue
        forward = offset @ mats[name]
        inv = np.linalg.inv(forward)
        placed = layers[name].transform(
            canvas.size, Image.AFFINE,
            (inv[0, 0], inv[0, 1], inv[0, 2], inv[1, 0], inv[1, 1], inv[1, 2]),
            resample=Image.BICUBIC,
        )
        canvas.alpha_composite(placed)

    return canvas, (pl, pt)
