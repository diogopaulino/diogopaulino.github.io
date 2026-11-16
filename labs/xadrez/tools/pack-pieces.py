"""Pack the credited glTF geometry (optionally pre-simplified, see below).
Usage: python3 pack-pieces.py /path/ABeautifulGame.gltf /path/ABeautifulGame.bin

Optional offline pre-pass (keeps UVs/normals, bounds the geometric error to
0.05% of each mesh so 32 pieces stay near 400k triangles instead of 1.4M):
  npx @gltf-transform/cli weld in.gltf welded.gltf
  npx @gltf-transform/cli simplify welded.gltf out.gltf --ratio 0.15 --error 0.0005
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


def read_mesh(mesh_index, offset=(0, 0, 0)):
    primitive = source['meshes'][mesh_index]['primitives'][0]
    positions = accessor(primitive['attributes']['POSITION'])
    positions = [v + offset[i % 3] for i, v in enumerate(positions)]
    return (positions, accessor(primitive['attributes']['NORMAL']),
            accessor(primitive['attributes']['TEXCOORD_0']), accessor(primitive['indices']))


def node_translation(name):
    return next(n.get('translation', [0, 0, 0]) for n in source['nodes'] if n.get('name') == name)


# O peão do conjunto original tem duas malhas: corpo torneado e a esfera do
# topo (um nó irmão deslocado). Aqui as duas viram uma peça só, na origem.
# Alturas em casas (1 u): proporção original em relação ao rei de 1,8 u.
PIECES = [('k', [0], 1.8), ('q', [2], 1.58), ('r', [9], 1.13), ('n', [11], 1.19), ('b', [13], 1.45), ('p', [6, 5], 0.79)]
for kind, mesh_indices, height in PIECES:
    positions, normals, uvs, indices = read_mesh(mesh_indices[0])
    for extra in mesh_indices[1:]:
        ep, en, eu, ei = read_mesh(extra, node_translation('Pawn_Top_W1'))
        base = len(positions) // 3
        positions += ep; normals += en; uvs += eu; indices += [i + base for i in ei]
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
