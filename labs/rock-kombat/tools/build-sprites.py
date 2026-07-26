#!/usr/bin/env python3
"""Build the Rock Kombat sprite atlases.

    python3 tools/build-sprites.py

For each fighter this cleans the base pose, slices it into rig parts, trims every
part to its own bounding box and packs them into one WebP. The companion
`atlas.json` carries the parts, the skeleton and every animation clip, so the
runtime can pose the rig itself.

Shipping the parts rather than baked frames is what keeps the download small: a
fighter's 11 parts are roughly one body's worth of pixels, where the 38 baked
frames they generate would be nearly forty times that. The browser composites the
skeleton into an offscreen buffer once per character per frame, which also lets
it interpolate between keyframes instead of stepping through fixed cels.
"""

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from clips import CLIPS
from rig import RIGS, Z_ORDER
from spritelib import cut_parts, load_base

ATLAS_MAX_WIDTH = 1024
PADDING = 2
WEBP_QUALITY = 82


def pack(items):
    """Shelf-pack (name, image) pairs, tallest first."""
    order = sorted(items, key=lambda kv: -kv[1].height)

    x = y = shelf_h = 0
    placements = {}
    width = 0

    for name, img in order:
        w, h = img.width + PADDING, img.height + PADDING
        if x + w > ATLAS_MAX_WIDTH and x > 0:
            x = 0
            y += shelf_h
            shelf_h = 0
        placements[name] = (x, y)
        x += w
        shelf_h = max(shelf_h, h)
        width = max(width, x)

    atlas = Image.new('RGBA', (width, y + shelf_h), (0, 0, 0, 0))
    for name, img in items:
        atlas.alpha_composite(img, placements[name])
    return atlas, placements


def build_fighter(who, assets):
    base, _ = load_base(who, assets)
    layers = cut_parts(who, base)

    trimmed = []
    offsets = {}
    for name in Z_ORDER:
        img = layers[name]
        bbox = img.getbbox()
        if bbox is None:
            raise RuntimeError(f'{who}: part {name!r} came out empty -- check its box in rig.py')
        trimmed.append((name, img.crop(bbox)))
        offsets[name] = (bbox[0], bbox[1])

    atlas, placements = pack(trimmed)

    parts = {}
    for name, img in trimmed:
        spec = RIGS[who]['parts'][name]
        px, py = placements[name]
        parts[name] = {
            # where this part lives in the atlas
            'x': px, 'y': py, 'w': img.width, 'h': img.height,
            # where it sits inside the base pose
            'ox': offsets[name][0], 'oy': offsets[name][1],
            # joint it rotates around, in base-pose pixels
            'px': round(spec['pivot'][0] * base.width, 2),
            'py': round(spec['pivot'][1] * base.height, 2),
            'parent': spec['parent'],
        }

    return atlas, {
        'image': f'atlas-{who}.webp',
        'base': [base.width, base.height],
        # ground line and horizontal centre of the base pose
        'anchor': [base.width / 2.0, base.height],
        'order': Z_ORDER,
        'parts': parts,
    }


def main():
    root = Path(__file__).resolve().parent.parent
    # Raw illustrated art lives outside `assets/` so it never ships to players --
    # only the baked atlases below do. See tools/source-art/ for provenance.
    source = Path(__file__).resolve().parent / 'source-art'
    assets = root / 'assets'

    manifest = {
        'fighters': {},
        'clips': {
            name: {
                'loop': clip['loop'],
                'frames': [
                    {
                        'hold': f.get('hold', 5),
                        'front': f.get('front', []),
                        'pose': {k: [round(v[0], 2), round(v[1], 2), round(v[2], 2)]
                                 for k, v in f.items() if k not in ('hold', 'front')},
                    }
                    for f in clip['frames']
                ],
            }
            for name, clip in CLIPS.items()
        },
    }

    total = 0
    for who in RIGS:
        atlas, meta = build_fighter(who, source)
        out = assets / f'atlas-{who}.webp'
        atlas.save(out, 'WEBP', quality=WEBP_QUALITY, method=6)
        size = out.stat().st_size
        total += size
        manifest['fighters'][who] = meta
        print(f'{who:8s} {len(meta["parts"]):2d} parts  atlas {atlas.width}x{atlas.height}  {size / 1024:6.1f} KB')

    out_json = assets / 'atlas.json'
    out_json.write_text(json.dumps(manifest, separators=(',', ':')))
    total += out_json.stat().st_size

    n_frames = sum(len(c['frames']) for c in CLIPS.values())
    print(f'\n{len(CLIPS)} clips / {n_frames} keyframes per fighter')
    print(f'total shipped sprite payload: {total / 1024:.1f} KB')


if __name__ == '__main__':
    main()
