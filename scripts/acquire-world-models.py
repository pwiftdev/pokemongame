"""Package selected CC0 environment models with local, bounded-size textures."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.parse
import urllib.request
import zipfile
import importlib.util

_spec = importlib.util.spec_from_file_location("world_style", Path(__file__).with_name("style-world-models.py"))
_style = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_style)

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'evidence/world-source'
DEST = ROOT / 'apps/client/public/assets/world'
CACHE.mkdir(parents=True, exist_ok=True)
DEST.mkdir(parents=True, exist_ok=True)
REVISION = 'db3df04d1e4714298a09510b26fb6de6645138a2'
RAW = f'https://raw.githubusercontent.com/agentkaerf/FreeModels/{REVISION}/'
PACKS = {
    'nature': ('https://kenney.nl/assets/nature-kit', 'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip', 'Models/GLTF format/'),
    'castle': ('https://kenney.nl/assets/castle-kit', 'https://kenney.nl/media/pages/assets/castle-kit/a395102d20-1711543616/kenney_castle-kit.zip', 'Models/GLB format/'),
}
SELECTION = {
    'nature': {'CactusTall':'cactus_tall','CactusSmall':'cactus_short','WaterLily':'lily_large','Reeds':'plant_flatTall','FallenLog':'log_large','LogPile':'log_stack','OldStump':'stump_old','Campfire':'campfire_stones','ExpeditionTent':'tent_detailedOpen','Wheat':'crops_wheatStageB','Corn':'crops_cornStageD','Pumpkin':'crop_pumpkin','StandingStone':'rock_tallF','Canoe':'canoe'},
    'castle': {'Watchtower':'tower-square','CastleWall':'wall-half','StoneGate':'wall-doorway','Pennant':'flag-pennant'},
    'ultimate': {'SilverBirch':'BirchTree_1','GoldenMaple':'MapleTree_2','BareTree':'DeadTree_4','Wildflowers':'Flower_5_Clump'},
    'pirate': {'CoastalCliff':'Environment_Cliff1','MesaCliff':'Environment_Cliff2','FishingDock':'Environment_Dock','BrokenDock':'Environment_Dock_Broken','OasisPalm':'Environment_PalmTree_1','AncientBones':'Environment_LargeBones'},
}
for pack, (_, url, _) in PACKS.items():
    archive = ROOT / f'evidence/kenney-{pack}.zip'
    if not archive.exists():
        archive.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    with zipfile.ZipFile(archive) as source:
        folder = CACHE / pack
        folder.mkdir(exist_ok=True)
        for name in source.namelist():
            if not (folder / name).resolve().is_relative_to(folder.resolve()):
                raise ValueError('Unsafe archive member')
        source.extractall(folder)


def acquire(job):
    pack, name, original = job
    target = DEST / f'{name}.glb'
    if pack in PACKS:
        source_url, download, prefix = PACKS[pack]
        source = CACHE / pack / (prefix + original + '.glb')
        creator = 'Kenney'
    else:
        directory = 'Ultimate Stylized Nature - May 2022' if pack == 'ultimate' else 'Pirate Kit - Nov 2023'
        source_url = 'https://quaternius.com/packs/' + ('ultimatestylizednature.html' if pack == 'ultimate' else 'piratekit.html')
        download = RAW + urllib.parse.quote(f'{directory}/glTF/{original}.gltf')
        folder = CACHE / name
        folder.mkdir(exist_ok=True)
        source = folder / (original + '.gltf')
        document = json.load(urllib.request.urlopen(download, timeout=60))
        for item in document.get('buffers', []) + document.get('images', []):
            uri = item.get('uri', '')
            if not uri or uri.startswith('data:'):
                continue
            path = folder / Path(uri).name
            path.write_bytes(urllib.request.urlopen(urllib.parse.urljoin(download, urllib.parse.quote(uri)), timeout=60).read())
            item['uri'] = path.name
            if item in document.get('images', []):
                subprocess.run(['sips', '-Z', '512', str(path)], check=True, stdout=subprocess.DEVNULL)
        source.write_text(json.dumps(document))
        creator = 'Quaternius'
    subprocess.run(['npx', '--yes', '@gltf-transform/cli@4.2.1', 'copy', str(source), str(target)], check=True, stdout=subprocess.DEVNULL)
    _style.style(target)
    raw = target.read_bytes()
    print(f'{name}: {len(raw)} bytes', flush=True)
    return {'name':name,'path':str(target.relative_to(ROOT)), 'creator':creator,'source':source_url,'download':download,'license':'CC0-1.0','kind':'model','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'generatedBy':'scripts/acquire-world-models.py','modifications':'Packed as GLB with local textures; Quaternius textures resized to at most 512 pixels; selected props use the island material palette'}


jobs = [(pack, name, original) for pack, models in SELECTION.items() for name, original in models.items()]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    entries = list(executor.map(acquire, jobs))
manifest_path = ROOT / 'ASSET_MANIFEST.json'
manifest = json.loads(manifest_path.read_text())
paths = {entry['path'] for entry in entries}
manifest = [entry for entry in manifest if entry['path'] not in paths] + entries
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
(ROOT / 'apps/client/src/render/world-models.json').write_text(json.dumps([entry['name'] for entry in entries], indent=2) + '\n')
