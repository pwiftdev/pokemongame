"""Apply the island palette to selected CC0 props without changing their meshes."""
import json
import struct
from pathlib import Path

PALETTE = {
    'Corn': {'grass': [0.3, 0.44, 0.19, 1]},
    'Wheat': {'woodInner': [0.67, 0.51, 0.26, 1], '_defaultMat': [0.77, 0.62, 0.35, 1]},
    'Reeds': {'leafsGreen': [0.27, 0.43, 0.22, 1]},
    'WaterLily': {'leafsGreen': [0.22, 0.43, 0.23, 1], 'leafsDark': [0.12, 0.29, 0.2, 1]},
    'CactusTall': {'leafsGreen': [0.25, 0.47, 0.33, 1], 'leafsDark': [0.2, 0.36, 0.26, 1]},
    'CactusSmall': {'leafsGreen': [0.25, 0.47, 0.33, 1], 'leafsDark': [0.2, 0.36, 0.26, 1]},
    'StandingStone': {'dirt': [0.40, 0.47, 0.48, 1], 'grass': [0.54, 0.62, 0.59, 1], '_defaultMat': [0.37, 0.44, 0.46, 1]},
    'Watchtower': {'colormap': [0.47, 0.48, 0.44, 1]},
    'CastleWall': {'colormap': [0.47, 0.48, 0.44, 1]},
    'StoneGate': {'colormap': [0.48, 0.51, 0.48, 1]},
}

def style(path):
    path = Path(path)
    if path.stem not in PALETTE:
        return
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    document = json.loads(raw[20:20+size])
    for material in document.get('materials', []):
        color = PALETTE[path.stem].get(material.get('name'))
        if color:
            pbr = material.setdefault('pbrMetallicRoughness', {})
            pbr.pop('baseColorTexture', None)
            pbr['baseColorFactor'] = color
            pbr['metallicFactor'] = 0
            pbr['roughnessFactor'] = 1
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    tail = raw[20+size:]
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 20+len(encoded)+len(tail)) + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + tail)

if __name__ == '__main__':
    import hashlib
    root = Path(__file__).resolve().parents[1]
    manifest_path = root / 'ASSET_MANIFEST.json'
    manifest = json.loads(manifest_path.read_text())
    for entry in manifest:
        if entry['path'].startswith('apps/client/public/assets/world/'):
            path = root / entry['path']
            style(path)
            raw = path.read_bytes()
            entry.update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
            if path.stem in PALETTE and 'island material palette' not in entry['modifications']:
                entry['modifications'] += '; island material palette'
    manifest_path.write_text(json.dumps(manifest, indent=2)+'\n')
