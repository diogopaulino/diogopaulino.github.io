"""Pack the credited glTF geometry without topology simplification.
Usage: python3 pack-pieces.py /path/ABeautifulGame.gltf /path/ABeautifulGame.bin
Positions/UVs use bounded 16-bit quantization, normals signed 16-bit.
No runtime dependencies; the browser uses its native gzip decoder.
"""
from pathlib import Path
import gzip
import json
import struct
import sys

source = json.loads(Path(sys.argv[1]).read_text())
binary = Path(sys.argv[2]).read_bytes()
output = Path(__file__).resolve().parents[1] / 'assets'
packed = bytearray()
layout = {'version': 2, 'pieces': {}}


def accessor(index):
    acc = source['accessors'][index]
    view = source['bufferViews'][acc['bufferView']]
    channels = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[acc['type']]
    code = {5123: 'H', 5125: 'I', 5126: 'f'}[acc['componentType']]
    offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    size = struct.calcsize(code) * channels
    stride = view.get('byteStride', size)
    values = []
    for i in range(acc['count']):
        values.extend(struct.unpack_from('<' + code * channels, binary, offset + i * stride))
    return values


def append(values, code):
    offset = len(packed)
    packed.extend(struct.pack('<' + code * len(values), *values))
    return [offset, len(values)]


for kind, mesh_index, height in [('k', 0, 1.8), ('q', 2, 1.58), ('r', 9, 1.13), ('n', 11, 1.3), ('b', 13, 1.45)]:
    primitive = source['meshes'][mesh_index]['primitives'][0]
    positions = accessor(primitive['attributes']['POSITION'])
    normals = accessor(primitive['attributes']['NORMAL'])
    uvs = accessor(primitive['attributes']['TEXCOORD_0'])
    indices = accessor(primitive['indices'])
    low = [min(positions[i::3]) for i in range(3)]
    high = [max(positions[i::3]) for i in range(3)]
    scale = height / (high[1] - low[1])
    center = [(high[0] + low[0]) / 2, low[1], (high[2] + low[2]) / 2]
    minimum = [(low[i] - center[i]) * scale for i in range(3)]
    extent = [(high[i] - low[i]) * scale for i in range(3)]
    qp = [round((v - low[i % 3]) / (high[i % 3] - low[i % 3]) * 65535) for i, v in enumerate(positions)]
    qn = [round(max(-1, min(1, v)) * 32767) for v in normals]
    uv_min = [min(uvs[i::2]) for i in range(2)]
    uv_extent = [max(uvs[i::2]) - uv_min[i] or 1 for i in range(2)]
    quv = [round((v - uv_min[i % 2]) / uv_extent[i % 2] * 65535) for i, v in enumerate(uvs)]
    assert max(indices) < 65536
    layout['pieces'][kind] = {
        'min': minimum, 'extent': extent, 'uvMin': uv_min, 'uvExtent': uv_extent,
        'positions': append(qp, 'H'), 'normals': append(qn, 'h'),
        'uvs': append(quv, 'H'), 'indices': append(indices, 'H')
    }
(output / 'staunton.bin.gz').write_bytes(gzip.compress(packed, compresslevel=9, mtime=0))
(output / 'staunton.json').write_text(json.dumps(layout, separators=(',', ':')) + '\n')
print(f'{len(packed):,} decoded bytes; {(output / "staunton.bin.gz").stat().st_size:,} gzip bytes')
