"""Baixa o glTF 1k de um asset do Poly Haven para um diretório vazio. Uso: fetch.py <id> <destino>"""
import json, sys, os, urllib.request
aid, dest = sys.argv[1], sys.argv[2]
os.makedirs(dest, exist_ok=False)
def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'asset-fetch'})
    return urllib.request.urlopen(req, timeout=120).read()
files = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))
g = files['gltf']['1k']['gltf']
open(os.path.join(dest, f'{aid}.gltf'), 'wb').write(get(g['url']))
for rel, info in g.get('include', {}).items():
    rel = os.path.normpath(rel)
    assert not rel.startswith('..') and not os.path.isabs(rel)
    p = os.path.join(dest, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb').write(get(info['url']))
print(aid, 'ok')
