"""Animation clips for the cutout rig.

Each clip is a list of frames. A frame is:

    {'hold': ticks, 'front': [parts drawn on top], **{part: (deg, dx, dy)}}

`hold` is how many 60 Hz ticks the frame stays on screen. Angles are degrees,
positive = clockwise on screen. Translations are pixels in the base-pose canvas
(roughly 300 x 452), applied in the parent's frame.

The fighters all share one front-facing guard stance, so one set of clips drives
all three. Amplitudes stay moderate on purpose: a cutout limb that swings too far
stops reading as a body and starts reading as a rotated sticker.

`legBack*` / `armBack*` are the viewer-right limbs, which lead every attack
because the game flips the sprite to face its opponent.
"""

import math

# Root offsets are applied to `pelvis`, which every other part inherits.


def _idle():
    """Ready-stance breathe: slight crouch pulse, weight rocks. Arms stay close
    to the photographed guard so cutout seams don't open on every breath."""
    frames = []
    for i in range(6):
        t = i / 6.0
        breathe = math.sin(t * math.tau)
        sway = math.sin(t * math.tau + 0.6)
        frames.append({
            'hold': 8,
            'pelvis': (0.0, sway * 0.9, 2.0 - breathe * 1.6),
            'torso': (sway * 0.7, 0.0, -breathe * 1.6),
            'head': (-sway * 0.6, 0.0, -breathe * 0.6),
            'armBackUpper': (-breathe * 1.8, 0.0, -breathe * 1.0),
            'armBackLower': (breathe * 2.2, 0.0, 0.0),
            'armFrontUpper': (breathe * 1.6, 0.0, -breathe * 0.8),
            'armFrontLower': (-breathe * 2.0, 0.0, 0.0),
            'legBackUpper': (2.0, 0.0, 0.0),
            'legFrontUpper': (-2.0, 0.0, 0.0),
        })
    return frames


def _walk():
    """Eight-frame cycle with a clearer step and counter-swinging arms."""
    frames = []
    for i in range(8):
        t = i / 8.0
        swing = math.sin(t * math.tau)
        bob = -abs(math.cos(t * math.tau)) * 4.5
        frames.append({
            'hold': 4,
            'pelvis': (swing * 1.4, swing * 2.0, bob + 3.5),
            'torso': (-swing * 2.0, 0.0, 0.0),
            'head': (swing * 1.4, 0.0, 0.0),
            'legBackUpper': (-swing * 22, 0.0, 0.0),
            'legBackLower': (max(0.0, swing) * 28, 0.0, 0.0),
            'legFrontUpper': (swing * 22, 0.0, 0.0),
            'legFrontLower': (max(0.0, -swing) * 28, 0.0, 0.0),
            'armBackUpper': (swing * 14, 0.0, 0.0),
            'armBackLower': (swing * 8, 0.0, 0.0),
            'armFrontUpper': (-swing * 14, 0.0, 0.0),
            'armFrontLower': (-swing * 8, 0.0, 0.0),
        })
    return frames


def _punch():
    """Compact jab: shove the lead arm forward with modest rotation so the
    cutout seam stays hidden under the moving fist."""
    lead = ['armBackUpper', 'armBackLower']
    return [
        {'hold': 3, 'front': lead,
         'pelvis': (0, -3, 2), 'torso': (-2, -2, 1), 'head': (1, 0, 0),
         'armBackUpper': (6, -4, 1), 'armBackLower': (-6, -2, 0),
         'armFrontUpper': (-3, 1, 0), 'legBackUpper': (3, 0, 0)},
        {'hold': 2, 'front': lead,
         'pelvis': (0, 5, 0), 'torso': (2.5, 4, 0), 'head': (-2, 1, 0),
         'armBackUpper': (-12, 14, 2), 'armBackLower': (42, 6, 1),
         'armFrontUpper': (4, -2, 0), 'legBackUpper': (-4, 0, 0)},
        {'hold': 4, 'front': lead,
         'pelvis': (0, 9, 1), 'torso': (4, 6, 0), 'head': (-2.5, 2, 0),
         'armBackUpper': (-20, 26, 3), 'armBackLower': (78, 10, 2),
         'armFrontUpper': (7, -3, 0), 'legBackUpper': (-7, 0, 0),
         'legFrontUpper': (4, 0, 0)},
        {'hold': 3, 'front': lead,
         'pelvis': (0, 4, 1), 'torso': (2, 3, 0), 'head': (-1, 1, 0),
         'armBackUpper': (-12, 14, 2), 'armBackLower': (42, 6, 1),
         'armFrontUpper': (4, -2, 0), 'legBackUpper': (-3, 0, 0)},
        {'hold': 3, 'front': lead,
         'pelvis': (0, 1, 0), 'torso': (0.5, 1, 0),
         'armBackUpper': (-3, 3, 0), 'armBackLower': (10, 2, 0)},
    ]


def _kick():
    """Chambered side kick with restrained hip rotation so the shin stays
    attached to the thigh cutout."""
    lead = ['legBackUpper', 'legBackLower']
    return [
        {'hold': 4, 'front': lead,
         'pelvis': (0, -3, -2), 'torso': (-4, -3, 0), 'head': (2, -1, 0),
         'legBackUpper': (-18, 2, -3), 'legBackLower': (22, 0, 0),
         'armBackUpper': (8, -2, 0), 'armFrontUpper': (-6, -2, 0)},
        {'hold': 3, 'front': lead,
         'pelvis': (0, 2, -3), 'torso': (-6, -4, -1), 'head': (4, -2, 0),
         'legBackUpper': (-28, 6, -4), 'legBackLower': (-4, 3, -1),
         'armBackUpper': (12, -4, 0), 'armFrontUpper': (-10, -3, 0)},
        {'hold': 4, 'front': lead,
         'pelvis': (0, 3, -4), 'torso': (-8, -5, -1), 'head': (5, -2, 0),
         'legBackUpper': (-34, 10, -5), 'legBackLower': (-18, 4, -1),
         'armBackUpper': (14, -5, 0), 'armFrontUpper': (-11, -4, 0)},
        {'hold': 3, 'front': lead,
         'pelvis': (0, 0, -2), 'torso': (-4, -3, 0), 'head': (2, -1, 0),
         'legBackUpper': (-18, 4, -2), 'legBackLower': (8, 2, 0),
         'armBackUpper': (8, -2, 0), 'armFrontUpper': (-6, -2, 0)},
        {'hold': 3,
         'pelvis': (0, 0, 1), 'torso': (-1, 0, 0),
         'legBackUpper': (-3, 0, 0), 'legBackLower': (3, 0, 0)},
    ]


def _block():
    """Tight high guard: both forearms across the face, weight sunk."""
    return [
        {'hold': 5,
         'pelvis': (0, -4, 10), 'torso': (-4, -3, 4), 'head': (3, -1, 2),
         'armBackUpper': (20, -12, -2), 'armBackLower': (34, -10, -3),
         'armFrontUpper': (-18, 10, -2), 'armFrontLower': (-28, 10, -3),
         'legBackUpper': (5, 0, 0), 'legFrontUpper': (-5, 0, 0)},
        {'hold': 5,
         'pelvis': (0, -5, 12), 'torso': (-5, -4, 5), 'head': (4, -2, 2),
         'armBackUpper': (22, -13, -3), 'armBackLower': (38, -12, -4),
         'armFrontUpper': (-20, 11, -3), 'armFrontLower': (-32, 12, -4),
         'legBackUpper': (6, 0, 0), 'legFrontUpper': (-6, 0, 0)},
    ]


def _hit():
    """Recoil: head snaps, torso folds, arms open."""
    return [
        {'hold': 3,
         'pelvis': (0, -8, 2), 'torso': (-8, -6, 2), 'head': (-12, -5, 2),
         'armBackUpper': (-16, -4, -4), 'armBackLower': (-12, -3, -2),
         'armFrontUpper': (18, -6, -4), 'armFrontLower': (14, -4, -2),
         'legBackUpper': (8, 0, 0)},
        {'hold': 4,
         'pelvis': (0, -12, 4), 'torso': (-12, -9, 3), 'head': (-16, -7, 4),
         'armBackUpper': (-24, -7, -7), 'armBackLower': (-18, -5, -4),
         'armFrontUpper': (26, -9, -7), 'armFrontLower': (20, -6, -4),
         'legBackUpper': (12, 0, 0), 'legFrontUpper': (-6, 0, 0)},
        {'hold': 4,
         'pelvis': (0, -4, 2), 'torso': (-5, -3, 1), 'head': (-6, -3, 1),
         'armBackUpper': (-10, -3, -3), 'armBackLower': (-8, -2, -1),
         'armFrontUpper': (12, -4, -3), 'armFrontLower': (8, -3, -1),
         'legBackUpper': (4, 0, 0)},
    ]


def _jump():
    """Crouch, tuck at apex, prepare to land — keep limbs close to the body."""
    return [
        {'hold': 3,
         'pelvis': (0, 0, 14), 'torso': (-2, 0, 4),
         'legBackUpper': (16, 0, 0), 'legBackLower': (-22, 0, 0),
         'legFrontUpper': (-16, 0, 0), 'legFrontLower': (22, 0, 0),
         'armBackUpper': (8, 0, 3), 'armFrontUpper': (-8, 0, 3)},
        {'hold': 8,
         'pelvis': (0, 1, -4), 'torso': (1, 0, -2), 'head': (-1, 0, -1),
         'legBackUpper': (-18, 1, 1), 'legBackLower': (32, 0, 0),
         'legFrontUpper': (14, -1, 1), 'legFrontLower': (24, 0, 0),
         'armBackUpper': (-12, 3, -4), 'armBackLower': (-8, 2, -2),
         'armFrontUpper': (12, -3, -4), 'armFrontLower': (8, -2, -2)},
        {'hold': 5,
         'pelvis': (0, 0, 3), 'torso': (-1, 0, 1),
         'legBackUpper': (-6, 0, 1), 'legBackLower': (12, 0, 0),
         'legFrontUpper': (6, 0, 1), 'legFrontLower': (10, 0, 0),
         'armBackUpper': (-6, 1, 1), 'armFrontUpper': (6, -1, 1)},
    ]


def _special():
    """Wind up both arms, explosive release toward the opponent."""
    lead = ['armBackUpper', 'armBackLower', 'armFrontUpper', 'armFrontLower']
    return [
        {'hold': 5, 'front': lead,
         'pelvis': (0, -10, 12), 'torso': (-7, -7, 5), 'head': (5, -3, 2),
         'armBackUpper': (18, -12, 2), 'armBackLower': (16, -8, 2),
         'armFrontUpper': (-14, 8, 2), 'armFrontLower': (-12, 6, 2),
         'legBackUpper': (8, 0, 0), 'legFrontUpper': (-8, 0, 0)},
        {'hold': 4, 'front': lead,
         'pelvis': (0, -14, 14), 'torso': (-10, -10, 6), 'head': (7, -4, 3),
         'armBackUpper': (26, -16, 3), 'armBackLower': (22, -12, 2),
         'armFrontUpper': (-20, 12, 3), 'armFrontLower': (-18, 9, 2),
         'legBackUpper': (10, 0, 0), 'legFrontUpper': (-10, 0, 0)},
        # release
        {'hold': 3, 'front': lead,
         'pelvis': (0, 8, -3), 'torso': (6, 7, -2), 'head': (-5, 2, -1),
         'armBackUpper': (-24, 26, -6), 'armBackLower': (70, 8, -4),
         'armFrontUpper': (14, -8, -4), 'armFrontLower': (-12, -3, -2),
         'legBackUpper': (-10, 0, 0)},
        {'hold': 5, 'front': lead,
         'pelvis': (0, 14, -5), 'torso': (8, 10, -3), 'head': (-7, 4, -2),
         'armBackUpper': (-36, 38, -10), 'armBackLower': (100, 10, -5),
         'armFrontUpper': (20, -10, -6), 'armFrontLower': (-20, -5, -3),
         'legBackUpper': (-14, 0, 0), 'legFrontUpper': (6, 0, 0)},
        {'hold': 4, 'front': lead,
         'pelvis': (0, 7, -2), 'torso': (4, 5, -1), 'head': (-3, 2, -1),
         'armBackUpper': (-20, 22, -5), 'armBackLower': (60, 6, -3),
         'armFrontUpper': (12, -6, -3), 'armFrontLower': (-10, -3, -2),
         'legBackUpper': (-8, 0, 0)},
        {'hold': 4,
         'pelvis': (0, 2, 1), 'torso': (1, 1, 0),
         'armBackUpper': (-6, 6, -1), 'armBackLower': (16, 2, 0),
         'armFrontUpper': (3, -2, -1), 'armFrontLower': (-3, -1, 0)},
    ]


CLIPS = {
    'idle': {'frames': _idle(), 'loop': True},
    'walk': {'frames': _walk(), 'loop': True},
    'punch': {'frames': _punch(), 'loop': False},
    'kick': {'frames': _kick(), 'loop': False},
    'block': {'frames': _block(), 'loop': True},
    'hit': {'frames': _hit(), 'loop': False},
    'jump': {'frames': _jump(), 'loop': False},
    'special': {'frames': _special(), 'loop': False},
}
