"""Rig definitions for the Rock Kombat cutout sprite pipeline.

Every coordinate here is normalised (0..1) against the *trimmed* base pose, so the
numbers stay valid if the source art is ever re-exported at another resolution.

  box    (x0, y0, x1, y1)  region of the base pose that belongs to this part
  pivot  (x, y)            joint the part rotates around (its parent's socket)
  parent                   part whose transform this one inherits
  z                        paint order, low to high

Parts overlap generously towards their pivot: the extra material is what keeps a
rotated limb from tearing a hole open at the joint.
"""

# Bottom-of-image cleanup. Below `y`, keep only pixels inside one of the `keep`
# x-bands. This strips the stone slab baked under Kurt and the dust flicks under
# Lennon without touching the boots.
CLEANUP = {
    # Kurt's base is a clean chroma-key render, so nothing to strip.
    'kurt': None,
    'axl': None,
    'lennon': {'y': 0.900, 'keep': [(0.120, 0.400), (0.560, 0.900)]},
}

# Side flicks / speed lines that sit away from the body and read as dirt.
SIDE_TRIM = {
    'kurt': [],
    'axl': [],
    'lennon': [(0.760, 0.240, 1.000, 0.560), (0.000, 0.240, 0.120, 0.560)],
}

RIGS = {
    # ------------------------------------------------------------------ KURT
    # The illustrated Kurt poses all have a stone slab painted under the boots
    # that rotates with the legs once they are cut apart. This chroma-key render
    # is the only clean full-body Kurt in the set -- and it is already in profile
    # facing right, which suits a side-on fighter better than the front-on art.
    'kurt': {
        'src': 'sprite-kurt.png',
        'parts': {
            'legBackUpper': dict(box=(0.440, 0.500, 0.840, 0.780), pivot=(0.560, 0.560), parent='pelvis', z=0),
            'legBackLower': dict(box=(0.540, 0.700, 0.980, 1.000), pivot=(0.700, 0.760), parent='legBackUpper', z=1),
            'armBackUpper': dict(box=(0.600, 0.160, 0.900, 0.360), pivot=(0.680, 0.230), parent='torso', z=2),
            'armBackLower': dict(box=(0.720, 0.140, 1.000, 0.360), pivot=(0.840, 0.310), parent='armBackUpper', z=3),
            'legFrontUpper': dict(box=(0.080, 0.500, 0.520, 0.780), pivot=(0.420, 0.560), parent='pelvis', z=4),
            'legFrontLower': dict(box=(0.000, 0.700, 0.420, 1.000), pivot=(0.260, 0.760), parent='legFrontUpper', z=5),
            'pelvis': dict(box=(0.200, 0.460, 0.800, 0.680), pivot=(0.500, 0.550), parent=None, z=6),
            'torso': dict(box=(0.160, 0.120, 0.820, 0.600), pivot=(0.480, 0.550), parent='pelvis', z=7),
            'head': dict(box=(0.380, 0.000, 0.820, 0.215), pivot=(0.580, 0.190), parent='torso', z=8),
            'armFrontUpper': dict(box=(0.200, 0.160, 0.520, 0.380), pivot=(0.440, 0.230), parent='torso', z=9),
            'armFrontLower': dict(box=(0.180, 0.200, 0.560, 0.420), pivot=(0.280, 0.350), parent='armFrontUpper', z=10),
        },
    },
    # ------------------------------------------------------------------- AXL
    'axl': {
        'src': 'sprite-axl.png',
        'parts': {
            'legBackUpper': dict(box=(0.480, 0.480, 0.760, 0.700), pivot=(0.560, 0.520), parent='pelvis', z=0),
            'legBackLower': dict(box=(0.620, 0.650, 0.980, 0.980), pivot=(0.760, 0.700), parent='legBackUpper', z=1),
            'armBackUpper': dict(box=(0.660, 0.140, 0.870, 0.330), pivot=(0.700, 0.190), parent='torso', z=2),
            'armBackLower': dict(box=(0.760, 0.050, 0.980, 0.300), pivot=(0.860, 0.270), parent='armBackUpper', z=3),
            'legFrontUpper': dict(box=(0.240, 0.480, 0.520, 0.700), pivot=(0.440, 0.520), parent='pelvis', z=4),
            'legFrontLower': dict(box=(0.020, 0.650, 0.380, 0.980), pivot=(0.240, 0.700), parent='legFrontUpper', z=5),
            'pelvis': dict(box=(0.200, 0.420, 0.780, 0.620), pivot=(0.500, 0.470), parent=None, z=6),
            'torso': dict(box=(0.250, 0.120, 0.760, 0.500), pivot=(0.500, 0.460), parent='pelvis', z=7),
            'head': dict(box=(0.300, 0.000, 0.660, 0.160), pivot=(0.490, 0.140), parent='torso', z=8),
            'armFrontUpper': dict(box=(0.120, 0.140, 0.340, 0.330), pivot=(0.310, 0.190), parent='torso', z=9),
            'armFrontLower': dict(box=(0.060, 0.040, 0.290, 0.300), pivot=(0.170, 0.270), parent='armFrontUpper', z=10),
        },
    },
    # ---------------------------------------------------------------- LENNON
    'lennon': {
        'src': 'sprite-lennon.png',
        'parts': {
            'legBackUpper': dict(box=(0.480, 0.480, 0.780, 0.720), pivot=(0.560, 0.520), parent='pelvis', z=0),
            'legBackLower': dict(box=(0.560, 0.670, 0.880, 0.990), pivot=(0.700, 0.720), parent='legBackUpper', z=1),
            'armBackUpper': dict(box=(0.560, 0.150, 0.780, 0.330), pivot=(0.620, 0.200), parent='torso', z=2),
            'armBackLower': dict(box=(0.480, 0.230, 0.760, 0.400), pivot=(0.700, 0.290), parent='armBackUpper', z=3),
            'legFrontUpper': dict(box=(0.220, 0.480, 0.520, 0.720), pivot=(0.440, 0.520), parent='pelvis', z=4),
            'legFrontLower': dict(box=(0.100, 0.670, 0.420, 0.990), pivot=(0.280, 0.720), parent='legFrontUpper', z=5),
            'pelvis': dict(box=(0.220, 0.420, 0.760, 0.600), pivot=(0.490, 0.470), parent=None, z=6),
            'torso': dict(box=(0.240, 0.130, 0.740, 0.490), pivot=(0.490, 0.450), parent='pelvis', z=7),
            'head': dict(box=(0.280, 0.000, 0.640, 0.170), pivot=(0.470, 0.150), parent='torso', z=8),
            'armFrontUpper': dict(box=(0.190, 0.150, 0.400, 0.330), pivot=(0.360, 0.200), parent='torso', z=9),
            'armFrontLower': dict(box=(0.180, 0.200, 0.440, 0.390), pivot=(0.280, 0.290), parent='armFrontUpper', z=10),
        },
    },
}

# Painted back to front. Both fists sit in front of the chest in every base pose,
# so the arms ride above the torso. `armBack*` / `legBack*` are the limbs on the
# viewer's right, which is the direction the fighter faces once the game applies
# its horizontal flip -- so those are the ones that lead punches and kicks, and a
# clip can lift them with `front` when they swing past the body.
Z_ORDER = [
    'armBackUpper', 'armBackLower',
    'legBackUpper', 'legBackLower',
    'legFrontUpper', 'legFrontLower',
    'pelvis', 'torso', 'head',
    'armFrontUpper', 'armFrontLower',
]
