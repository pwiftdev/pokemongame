"""Add compatible CC0 village modules; reuse the already packaged texture atlas files."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import struct
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'apps/client/public/assets/village'
REVISION = 'db3df04d1e4714298a09510b26fb6de6645138a2'
BASE = f'https://raw.githubusercontent.com/agentkaerf/FreeModels/{REVISION}/' + urllib.parse.quote('Medieval Village MegaKit[Standard]/glTF/')
MODELS = ['Roof_RoundTiles_4x4', 'Roof_RoundTiles_4x6', 'Roof_RoundTiles_6x4', 'Roof_Front_Brick4', 'Roof_Tower_RoundTiles', 'Wall_Plaster_Straight', 'Wall_UnevenBrick_Window_Wide_Flat', 'Wall_UnevenBrick_Door_Round', 'Prop_Chimney2', 'Roof_Wooden_2x1', 'Prop_Support', 'Floor_WoodDark', 'Balcony_Simple_Corner']

def acquire(name):
    url = BASE + name + '.gltf'
    doc = json.load(urllib.request.urlopen(url, timeout=60))
    if len(doc['buffers']) != 1:
        raise ValueError('Expected a single buffer')
    for image in doc.get('images', []):
        if not (DEST / image['uri']).is_file():
            raise ValueError('Package and credit missing texture first: ' + image['uri'])
    binary = urllib.request.urlopen(BASE + doc['buffers'][0].pop('uri'), timeout=60).read()
    binary += b'\0' * (-len(binary) % 4)
    text = json.dumps(doc, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    data = struct.pack('<III', 0x46546C67, 2, 28+len(text)+len(binary)) + struct.pack('<II',len(text),0x4E4F534A) + text + struct.pack('<II',len(binary),0x004E4942) + binary
    target = DEST / (name+'.glb'); target.write_bytes(data)
    print(name, len(data), flush=True)
    return {'name':name,'path':str(target.relative_to(ROOT)),'creator':'Quaternius','source':'https://quaternius.com/packs/medievalvillagemegakit.html','download':url,'license':'CC0-1.0','kind':'model','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'generatedBy':'scripts/acquire-village-details.py','modifications':'Packed as GLB. Reuses the existing locally packaged village textures.'}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        entries = list(pool.map(acquire, MODELS))
    path = ROOT/'ASSET_MANIFEST.json'; manifest=json.loads(path.read_text()); paths={entry['path'] for entry in entries}
    path.write_text(json.dumps([entry for entry in manifest if entry['path'] not in paths]+entries,indent=2)+'\n')
    (ROOT/'apps/client/src/render/village-models.json').write_text(json.dumps(MODELS,indent=2)+'\n')
