"""Rig definitions for the Rock Kombat cutout sprite pipeline.

Every coordinate here is normalised (0..1) against the *trimmed* base pose, so the
numbers stay valid if the source art is ever re-exported at another resolution.

  box    (x0, y0, x1, y1)  region of the base pose that belongs to this part
  pivot  (x, y)            joint the part rotates around (its parent's socket)
  parent                   part whose transform this one inherits
  z                        paint order, low to high

Parts overlap generously towards their pivot: the extra material is what keeps a
rotated limb from tearing a hole open at the joint.

All three base poses face the viewer's LEFT. Viewer-right limbs (`armBack*`,
`legBack*`) become the lead after the arena flips the sprite to face the
opponent -- those boxes must capture a real forearm/shin, not the face.
"""

CLEANUP = {
    'kurt': None,
    'axl': None,
    'lennon': {'y': 0.900, 'keep': [(0.120, 0.400), (0.560, 0.900)]},
}

SIDE_TRIM = {
    'kurt': [],
    'axl': [],
    'lennon': [(0.760, 0.240, 1.000, 0.560), (0.000, 0.240, 0.120, 0.560)],
}

RIGS = {
    # ------------------------------------------------------------------ KURT
    # Fists sit near the jaw. Arm boxes stay below the head box (y > ~0.20)
    # so a punch never carries a floating face fragment.
    'kurt': {
        'src': 'sprite-kurt.png',
        'parts': {
            'legBackUpper': dict(box=(0.430, 0.490, 0.820, 0.760), pivot=(0.560, 0.555), parent='pelvis', z=0),
            'legBackLower': dict(box=(0.540, 0.700, 0.990, 1.000), pivot=(0.700, 0.760), parent='legBackUpper', z=1),
            'armBackUpper': dict(box=(0.560, 0.180, 0.840, 0.360), pivot=(0.660, 0.235), parent='torso', z=2),
            'armBackLower': dict(box=(0.620, 0.160, 0.860, 0.360), pivot=(0.760, 0.290), parent='armBackUpper', z=3),
            'legFrontUpper': dict(box=(0.070, 0.490, 0.520, 0.760), pivot=(0.420, 0.555), parent='pelvis', z=4),
            'legFrontLower': dict(box=(0.000, 0.700, 0.430, 1.000), pivot=(0.260, 0.760), parent='legFrontUpper', z=5),
            'pelvis': dict(box=(0.180, 0.450, 0.800, 0.660), pivot=(0.500, 0.545), parent=None, z=6),
            'torso': dict(box=(0.180, 0.120, 0.780, 0.560), pivot=(0.490, 0.545), parent='pelvis', z=7),
            'head': dict(box=(0.360, 0.000, 0.820, 0.215), pivot=(0.570, 0.185), parent='torso', z=8),
            'armFrontUpper': dict(box=(0.150, 0.180, 0.460, 0.400), pivot=(0.400, 0.240), parent='torso', z=9),
            'armFrontLower': dict(box=(0.120, 0.200, 0.480, 0.430), pivot=(0.280, 0.345), parent='armFrontUpper', z=10),
        },
    },
    # ------------------------------------------------------------------- AXL
    'axl': {
        'src': 'sprite-axl.png',
        'parts': {
            'legBackUpper': dict(box=(0.460, 0.470, 0.780, 0.720), pivot=(0.560, 0.520), parent='pelvis', z=0),
            'legBackLower': dict(box=(0.600, 0.650, 0.990, 0.990), pivot=(0.760, 0.700), parent='legBackUpper', z=1),
            'armBackUpper': dict(box=(0.620, 0.150, 0.870, 0.350), pivot=(0.700, 0.200), parent='torso', z=2),
            'armBackLower': dict(box=(0.720, 0.080, 0.970, 0.320), pivot=(0.840, 0.255), parent='armBackUpper', z=3),
            'legFrontUpper': dict(box=(0.210, 0.470, 0.540, 0.720), pivot=(0.440, 0.520), parent='pelvis', z=4),
            'legFrontLower': dict(box=(0.010, 0.650, 0.400, 0.990), pivot=(0.240, 0.700), parent='legFrontUpper', z=5),
            'pelvis': dict(box=(0.200, 0.410, 0.780, 0.620), pivot=(0.500, 0.470), parent=None, z=6),
            'torso': dict(box=(0.260, 0.120, 0.740, 0.500), pivot=(0.500, 0.460), parent='pelvis', z=7),
            'head': dict(box=(0.300, 0.000, 0.680, 0.170), pivot=(0.490, 0.145), parent='torso', z=8),
            'armFrontUpper': dict(box=(0.090, 0.140, 0.350, 0.350), pivot=(0.300, 0.200), parent='torso', z=9),
            'armFrontLower': dict(box=(0.020, 0.050, 0.300, 0.320), pivot=(0.170, 0.270), parent='armFrontUpper', z=10),
        },
    },
    # ---------------------------------------------------------------- LENNON
    'lennon': {
        'src': 'sprite-lennon.png',
        'parts': {
            'legBackUpper': dict(box=(0.460, 0.470, 0.800, 0.740), pivot=(0.560, 0.520), parent='pelvis', z=0),
            'legBackLower': dict(box=(0.550, 0.670, 0.910, 1.000), pivot=(0.700, 0.720), parent='legBackUpper', z=1),
            'armBackUpper': dict(box=(0.560, 0.160, 0.820, 0.350), pivot=(0.640, 0.210), parent='torso', z=2),
            'armBackLower': dict(box=(0.620, 0.180, 0.860, 0.400), pivot=(0.740, 0.295), parent='armBackUpper', z=3),
            'legFrontUpper': dict(box=(0.190, 0.470, 0.540, 0.740), pivot=(0.440, 0.520), parent='pelvis', z=4),
            'legFrontLower': dict(box=(0.080, 0.670, 0.450, 1.000), pivot=(0.280, 0.720), parent='legFrontUpper', z=5),
            'pelvis': dict(box=(0.210, 0.410, 0.760, 0.600), pivot=(0.490, 0.470), parent=None, z=6),
            'torso': dict(box=(0.250, 0.130, 0.720, 0.490), pivot=(0.490, 0.450), parent='pelvis', z=7),
            'head': dict(box=(0.280, 0.000, 0.640, 0.175), pivot=(0.470, 0.155), parent='torso', z=8),
            'armFrontUpper': dict(box=(0.140, 0.150, 0.400, 0.350), pivot=(0.340, 0.210), parent='torso', z=9),
            'armFrontLower': dict(box=(0.120, 0.180, 0.440, 0.410), pivot=(0.260, 0.300), parent='armFrontUpper', z=10),
        },
    },
}

Z_ORDER = [
    'armBackUpper', 'armBackLower',
    'legBackUpper', 'legBackLower',
    'legFrontUpper', 'legFrontLower',
    'pelvis', 'torso', 'head',
    'armFrontUpper', 'armFrontLower',
]
