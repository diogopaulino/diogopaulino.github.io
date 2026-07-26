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
    """Six-frame breathing loop: chest lifts, shoulders settle, weight sways."""
    frames = []
    for i in range(6):
        t = i / 6.0
        breathe = math.sin(t * math.tau)
        sway = math.sin(t * math.tau + 0.6)
        frames.append({
            'hold': 7,
            'pelvis': (0.0, sway * 0.8, -breathe * 1.2),
            'torso': (sway * 0.7, 0.0, -breathe * 2.4),
            'head': (-sway * 0.9, 0.0, -breathe * 1.0),
            'armBackUpper': (-breathe * 2.2, 0.0, -breathe * 1.4),
            'armBackLower': (breathe * 3.0, 0.0, 0.0),
            'armFrontUpper': (breathe * 2.0, 0.0, -breathe * 1.2),
            'armFrontLower': (-breathe * 2.6, 0.0, 0.0),
        })
    return frames


def _walk():
    """Eight-frame cycle: contact, pass, contact, pass, with a two-beat body bob."""
    frames = []
    for i in range(8):
        t = i / 8.0
        swing = math.sin(t * math.tau)          # thigh drive, one per cycle
        bob = -abs(math.cos(t * math.tau)) * 5  # body dips on each foot plant
        frames.append({
            'hold': 5,
            'pelvis': (swing * 1.2, swing * 2.5, bob + 4),
            'torso': (-swing * 1.6, 0.0, 0.0),
            'head': (swing * 1.2, 0.0, 0.0),
            # Legs drive in opposition.
            'legBackUpper': (-swing * 16, 0.0, 0.0),
            'legBackLower': (max(0.0, swing) * 20, 0.0, 0.0),
            'legFrontUpper': (swing * 16, 0.0, 0.0),
            'legFrontLower': (max(0.0, -swing) * 20, 0.0, 0.0),
            # Arms counter-swing to keep the torso balanced.
            'armBackUpper': (swing * 9, 0.0, 0.0),
            'armBackLower': (swing * 5, 0.0, 0.0),
            'armFrontUpper': (-swing * 9, 0.0, 0.0),
            'armFrontLower': (-swing * 5, 0.0, 0.0),
        })
    return frames


def _punch():
    """Windup, drive, full extension, settle, recover.

    The guard pose holds the forearm pointing straight up, so an extended punch
    needs roughly +100 deg on the elbow to swing it out to horizontal -- the
    shoulder only contributes about -35.
    """
    lead = ['armBackUpper', 'armBackLower']
    return [
        # anticipation: shoulder loads back, weight sinks
        {'hold': 4, 'front': lead,
         'pelvis': (0, -5, 2), 'torso': (-3.5, -3, 1), 'head': (2, -1, 0),
         'armBackUpper': (12, -8, 2), 'armBackLower': (-14, -4, 1),
         'armFrontUpper': (-6, 2, 0), 'legBackUpper': (5, 0, 0)},
        # drive: hips open, elbow unfolds
        {'hold': 3, 'front': lead,
         'pelvis': (0, 8, 0), 'torso': (4.5, 6, -1), 'head': (-3, 2, 0),
         'armBackUpper': (-22, 22, 4), 'armBackLower': (58, 6, 2),
         'armFrontUpper': (8, -3, 0), 'legBackUpper': (-8, 0, 0)},
        # extension: peak reach, body fully committed
        {'hold': 4, 'front': lead,
         'pelvis': (0, 13, 1), 'torso': (6.5, 9, 0), 'head': (-4, 3, 0),
         'armBackUpper': (-35, 40, 6), 'armBackLower': (105, 10, 3),
         'armFrontUpper': (12, -5, 1), 'legBackUpper': (-12, 0, 0),
         'legFrontUpper': (6, 0, 0)},
        # settle: arm still out, weight starts returning
        {'hold': 4, 'front': lead,
         'pelvis': (0, 7, 1), 'torso': (3.5, 5, 0), 'head': (-2, 2, 0),
         'armBackUpper': (-24, 26, 4), 'armBackLower': (72, 8, 2),
         'armFrontUpper': (7, -3, 0), 'legBackUpper': (-6, 0, 0)},
        # recovery: back to guard
        {'hold': 3, 'front': lead,
         'pelvis': (0, 2, 0), 'torso': (1, 1, 0),
         'armBackUpper': (-8, 8, 1), 'armBackLower': (22, 3, 0)},
    ]


def _kick():
    """Chamber, snap out, hold the extension, retract.

    The shin hangs straight down at rest, so a locked-out side kick sits near
    -50 on the hip and -30 on the knee.
    """
    lead = ['legBackUpper', 'legBackLower']
    return [
        # chamber: knee lifts, heel tucks, torso leans away for balance
        {'hold': 4, 'front': lead,
         'pelvis': (0, -6, -3), 'torso': (-7, -5, 0), 'head': (4, -2, 0),
         'legBackUpper': (-30, 4, -6), 'legBackLower': (30, 0, 0),
         'armBackUpper': (12, -4, 0), 'armFrontUpper': (-10, -3, 0)},
        # snap: shin whips out
        {'hold': 3, 'front': lead,
         'pelvis': (0, 2, -5), 'torso': (-11, -6, -1), 'head': (7, -3, 0),
         'legBackUpper': (-44, 10, -8), 'legBackLower': (-8, 4, -1),
         'armBackUpper': (20, -8, 0), 'armFrontUpper': (-16, -6, 0)},
        # extension: leg locked out at full reach
        {'hold': 4, 'front': lead,
         'pelvis': (0, 4, -6), 'torso': (-14, -8, -1), 'head': (8, -4, 0),
         'legBackUpper': (-50, 14, -8), 'legBackLower': (-32, 6, -2),
         'armBackUpper': (22, -9, 0), 'armFrontUpper': (-18, -7, 0)},
        # retract
        {'hold': 4, 'front': lead,
         'pelvis': (0, 0, -3), 'torso': (-8, -5, 0), 'head': (5, -2, 0),
         'legBackUpper': (-32, 8, -6), 'legBackLower': (12, 3, -1),
         'armBackUpper': (14, -5, 0), 'armFrontUpper': (-11, -4, 0)},
        # plant
        {'hold': 3,
         'pelvis': (0, -1, 1), 'torso': (-2, -1, 0),
         'legBackUpper': (-8, 0, -1), 'legBackLower': (6, 0, 0)},
    ]


def _block():
    """Two-frame guard: hunch down, tuck both forearms across the body."""
    return [
        {'hold': 6,
         'pelvis': (0, -6, 8), 'torso': (-5, -4, 3), 'head': (4, -2, 2),
         'armBackUpper': (16, -10, -2), 'armBackLower': (26, -14, -4),
         'armFrontUpper': (-14, 8, -2), 'armFrontLower': (-22, 12, -4),
         'legBackUpper': (6, 0, 0), 'legFrontUpper': (-6, 0, 0)},
        {'hold': 6,
         'pelvis': (0, -7, 10), 'torso': (-6, -5, 4), 'head': (5, -2, 3),
         'armBackUpper': (18, -11, -3), 'armBackLower': (29, -16, -5),
         'armFrontUpper': (-16, 9, -3), 'armFrontLower': (-25, 14, -5),
         'legBackUpper': (7, 0, 0), 'legFrontUpper': (-7, 0, 0)},
    ]


def _hit():
    """Head snaps back, torso folds, arms fly loose."""
    return [
        {'hold': 4,
         'pelvis': (0, -10, 2), 'torso': (-11, -8, 2), 'head': (-14, -6, 3),
         'armBackUpper': (-22, -6, -6), 'armBackLower': (-16, -4, -4),
         'armFrontUpper': (24, -8, -6), 'armFrontLower': (18, -6, -4),
         'legBackUpper': (10, 0, 0)},
        {'hold': 4,
         'pelvis': (0, -14, 5), 'torso': (-15, -11, 4), 'head': (-19, -9, 5),
         'armBackUpper': (-30, -9, -9), 'armBackLower': (-22, -6, -6),
         'armFrontUpper': (32, -11, -9), 'armFrontLower': (25, -8, -6),
         'legBackUpper': (14, 0, 0), 'legFrontUpper': (-8, 0, 0)},
        {'hold': 5,
         'pelvis': (0, -6, 3), 'torso': (-7, -5, 2), 'head': (-9, -4, 2),
         'armBackUpper': (-14, -4, -4), 'armBackLower': (-10, -3, -2),
         'armFrontUpper': (15, -5, -4), 'armFrontLower': (12, -4, -2),
         'legBackUpper': (6, 0, 0)},
    ]


def _jump():
    """Crouch, tuck at apex, reach for the landing."""
    return [
        {'hold': 4,
         'pelvis': (0, 0, 12), 'torso': (-3, 0, 5),
         'legBackUpper': (14, 0, 0), 'legBackLower': (-18, 0, 0),
         'legFrontUpper': (-14, 0, 0), 'legFrontLower': (18, 0, 0),
         'armBackUpper': (10, 0, 4), 'armFrontUpper': (-10, 0, 4)},
        {'hold': 8,
         'pelvis': (0, 2, -6), 'torso': (2, 0, -3), 'head': (-2, 0, -1),
         'legBackUpper': (-26, 2, 2), 'legBackLower': (40, 0, 0),
         'legFrontUpper': (18, -2, 2), 'legFrontLower': (30, 0, 0),
         'armBackUpper': (-18, 4, -6), 'armBackLower': (-12, 3, -3),
         'armFrontUpper': (16, -4, -6), 'armFrontLower': (10, -3, -3)},
        {'hold': 6,
         'pelvis': (0, 0, 2), 'torso': (-2, 0, 1),
         'legBackUpper': (-8, 0, 1), 'legBackLower': (14, 0, 0),
         'legFrontUpper': (8, 0, 1), 'legFrontLower': (12, 0, 0),
         'armBackUpper': (-8, 2, 2), 'armFrontUpper': (8, -2, 2)},
    ]


def _special():
    """Deep load, explosive two-arm release, long recovery."""
    lead = ['armBackUpper', 'armBackLower', 'armFrontUpper', 'armFrontLower']
    return [
        {'hold': 6, 'front': lead,
         'pelvis': (0, -12, 10), 'torso': (-9, -9, 5), 'head': (6, -4, 3),
         'armBackUpper': (22, -14, 2), 'armBackLower': (18, -10, 2),
         'armFrontUpper': (-18, 10, 2), 'armFrontLower': (-15, 8, 2),
         'legBackUpper': (10, 0, 0), 'legFrontUpper': (-10, 0, 0)},
        {'hold': 5, 'front': lead,
         'pelvis': (0, -16, 13), 'torso': (-13, -12, 7), 'head': (9, -6, 4),
         'armBackUpper': (30, -19, 3), 'armBackLower': (25, -14, 3),
         'armFrontUpper': (-25, 14, 3), 'armFrontLower': (-21, 11, 3),
         'legBackUpper': (13, 0, 0), 'legFrontUpper': (-13, 0, 0)},
        # release: lead arm drives out, off arm flings up and back
        {'hold': 4, 'front': lead,
         'pelvis': (0, 10, -4), 'torso': (7, 8, -3), 'head': (-6, 3, -2),
         'armBackUpper': (-30, 30, -8), 'armBackLower': (70, 8, -5),
         'armFrontUpper': (18, -10, -6), 'armFrontLower': (-16, -4, -3),
         'legBackUpper': (-12, 0, 0)},
        {'hold': 6, 'front': lead,
         'pelvis': (0, 16, -6), 'torso': (10, 12, -4), 'head': (-8, 5, -3),
         'armBackUpper': (-42, 46, -12), 'armBackLower': (112, 12, -7),
         'armFrontUpper': (24, -13, -8), 'armFrontLower': (-26, -6, -4),
         'legBackUpper': (-18, 0, 0), 'legFrontUpper': (8, 0, 0)},
        {'hold': 5, 'front': lead,
         'pelvis': (0, 9, -2), 'torso': (6, 7, -2), 'head': (-5, 3, -1),
         'armBackUpper': (-26, 28, -7), 'armBackLower': (76, 8, -4),
         'armFrontUpper': (16, -9, -5), 'armFrontLower': (-15, -4, -3),
         'legBackUpper': (-10, 0, 0)},
        {'hold': 5,
         'pelvis': (0, 3, 0), 'torso': (2, 2, 0),
         'armBackUpper': (-9, 10, -2), 'armBackLower': (24, 3, -1),
         'armFrontUpper': (5, -3, -2), 'armFrontLower': (-5, -1, -1)},
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
