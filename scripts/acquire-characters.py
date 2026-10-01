"""Assemble CC0 modular avatars. Requires free Standard archives, macOS sips and glTF Transform."""
import concurrent.futures
import copy
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / 'evidence/character-sources'
OUT = ROOT / 'apps/client/public/assets/characters'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('character_gltf', pathlib.Path(__file__).with_name('character-gltf.py'))
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
Document = module.Document
REVISION = 'db3df04d1e4714298a09510b26fb6de6645138a2'
RAW = f'https://raw.githubusercontent.com/agentkaerf/FreeModels/{REVISION}/'
PACK = 'Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/'
BASE = CACHE / 'base/Universal Base Characters[Standard]'
HAIR = BASE / 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)'
ANIM = next((CACHE / 'animations').rglob('UAL1_Standard.glb'), None)
if not BASE.exists() or ANIM is None:
    raise SystemExit('Extract the free Standard source archives first. See docs/CHARACTER_CUSTOMIZATION.md.')
UAL2 = CACHE / 'UAL2_Standard.glb'
if not UAL2.exists():
    path = 'Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'
    UAL2.write_bytes(urllib.request.urlopen(RAW+urllib.parse.quote(path), timeout=60).read())
ALIASES = {'Idle_Loop':['Idle'], 'Sword_Idle':['Idle_Armed'], 'Idle_Torch_Loop':['Idle_Staff'], 'Walk_Loop':['Walking_A'], 'Jog_Fwd_Loop':['Running_A'], 'Sprint_Loop':['Running_B'], 'Hit_Chest':['Hit_A'], 'Death01':['Death_A'], 'Jump_Start':['Jump_Start'], 'Jump_Loop':['Jump_Idle'], 'Jump_Land':['Jump_Land'], 'Spell_Simple_Enter':['Spellcast_Raise','Spellcast_Long'], 'Spell_Simple_Shoot':['Spellcast_Shoot']}
SWORD = {'Idle_Shield_Loop':['Idle_Shield'], 'TreeChopping_Loop':['2H_Melee_Attack_Chop'], 'Sword_Block':['Block'], 'Shield_OneShot':['Block_Attack'], 'Sword_Regular_A':['1H_Melee_Attack_Slice_Diagonal','Dualwield_Melee_Attack_Stab','2H_Melee_Attack_Slice'], 'Sword_Regular_B':['1H_Melee_Attack_Slice_Horizontal','Dualwield_Melee_Attack_Slice'], 'Sword_Regular_C':['1H_Melee_Attack_Chop','Dualwield_Melee_Attack_Chop','2H_Melee_Attack_Spin']}


def download(path):
    local = CACHE / 'outfits' / pathlib.Path(path).name
    local.parent.mkdir(exist_ok=True)
    if not local.exists():local.write_bytes(urllib.request.urlopen(RAW+urllib.parse.quote(path),timeout=60).read())
    return local


def outfit(gender, style):
    file = download(PACK+f'{gender}_{style}.gltf')
    data = json.loads(file.read_text())
    def dependency(item):
        path=download(PACK+item['uri'])
        if path.suffix=='.png':
            small=path.with_name('small-'+path.name)
            if not small.exists():subprocess.run(['sips','-Z','512',str(path),'--out',str(small)],check=True,stdout=subprocess.DEVNULL)
            return item,small.name
        return item,path.name
    for item,name in concurrent.futures.ThreadPoolExecutor(4).map(dependency,data.get('buffers',[])+data.get('images',[])):item['uri']=name
    prepared=file.with_name('prepared-'+file.name);prepared.write_text(json.dumps(data))
    return Document(prepared)


def remap_skin(doc, offsets, joints):
    for skin in doc.data['skins'][offsets['skins']:]:
        skin['joints']=[joints[doc.data['nodes'][j]['name']] for j in skin['joints']]
        skin['skeleton']=joints['root']


def attach(doc, source, joints, label):
    offsets=doc.merge(source)
    remap_skin(doc,offsets,joints)
    root=doc.data['nodes'][doc.data['scenes'][0]['nodes'][0]]
    for index,node in enumerate(doc.data['nodes'][offsets['nodes']:], offsets['nodes']):
        if 'mesh' in node:
            node['name']=label+node['name']
            root['children'].append(index)
    return offsets


def head(gender):
    doc=Document(BASE / f'Base Characters/Godot - UE/Superhero_{gender}_FullBody.gltf')
    for node in doc.data['nodes']:
        if 'mesh' not in node:continue
        node['name']='Eyes' if node['name']=='Eyes' else 'Brows' if node['name']=='Eyebrows' else 'Head'
        if node['name']!='Head':continue
        skin=doc.data['skins'][node['skin']]
        neck={i for i,n in enumerate(skin['joints']) if doc.data['nodes'][n]['name'] in ['Head','neck_01']}
        for p in doc.data['meshes'][node['mesh']]['primitives']:
            indices=[v[0] for v in doc.values(p['indices'])]
            joints=doc.values(p['attributes']['JOINTS_0']);weights=doc.values(p['attributes']['WEIGHTS_0'])
            keep=[sum(w for j,w in zip(js,ws) if j in neck)>.48 for js,ws in zip(joints,weights)]
            trimmed=[]
            for i in range(0,len(indices),3):
                triangle=indices[i:i+3]
                if all(keep[v] for v in triangle):trimmed.extend((v,) for v in triangle)
            p['indices']=doc.accessor(trimmed,'SCALAR',5125)
    for m in doc.data['materials']:
        m['name']='Skin' if 'Superhero' in m['name'] else 'Eyes' if 'Eyes' in m['name'] else 'Hair'
        if m['name']=='Skin':
            texture=doc.data['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]
            original=BASE / 'Base Characters/Textures' / ('T_Superhero_Male_Ligh.png' if gender=='Male' else 'T_Superhero_Female_Light_BaseColor.png')
            small=CACHE / f'{gender}-skin.png';subprocess.run(['sips','-Z','512',str(original),'--out',str(small)],check=True,stdout=subprocess.DEVNULL)
            image=doc.data['images'][texture['source']];image['bufferView']=doc.view(small.read_bytes())
    return doc


def animations(doc, file, aliases, joints):
    source=Document(file)
    source.data['animations']=[a for a in source.data['animations'] if a['name'] in aliases]
    offsets=doc.merge(source)
    old=doc.data['animations'][offsets['animations']:];doc.data['animations']=doc.data['animations'][:offsets['animations']]
    for animation in old:
        for channel in animation['channels']:
            node=doc.data['nodes'][channel['target']['node']]
            target=doc.data['nodes'][joints[node['name']]]
            channel['target']['node']=joints[node['name']]
            if channel['target']['path']=='translation':
                sampler=animation['samplers'][channel['sampler']]
                a=node.get('translation',[0,0,0]);b=target.get('translation',[0,0,0])
                values=[tuple(v[i]+b[i]-a[i] for i in range(3)) for v in doc.values(sampler['output'])]
                sampler['output']=doc.accessor(values)
        for name in aliases[animation['name']]:
            item=copy.deepcopy(animation);item['name']=name;doc.data['animations'].append(item)


def remove_static_channels(doc):
    changing=set()
    defaults={'translation':(0,0,0),'rotation':(0,0,0,1),'scale':(1,1,1)}
    for animation in doc.data['animations']:
        for channel in animation['channels']:
            target=channel['target']; key=(target['node'],target['path'])
            rest=doc.data['nodes'][key[0]].get(key[1],defaults[key[1]])
            values=doc.values(animation['samplers'][channel['sampler']]['output'])
            if any(any(abs(a-b)>1e-5 for a,b in zip(value,rest)) for value in values):changing.add(key)
    for animation in doc.data['animations']:
        animation['channels']=[channel for channel in animation['channels'] if (channel['target']['node'],channel['target']['path']) in changing]
        used=sorted({channel['sampler'] for channel in animation['channels']})
        mapping={old:new for new,old in enumerate(used)}
        animation['samplers']=[animation['samplers'][i] for i in used]
        for channel in animation['channels']:channel['sampler']=mapping[channel['sampler']]


def reachable_nodes(doc):
    keep=set()
    def visit(index):
        if index in keep:return
        keep.add(index)
        for child in doc.data['nodes'][index].get('children',[]):visit(child)
    for scene in doc.data['scenes']:
        for index in scene['nodes']:visit(index)
    nodes=sorted(keep);mapping={old:new for new,old in enumerate(nodes)}
    skins=sorted({doc.data['nodes'][i]['skin'] for i in nodes if 'skin' in doc.data['nodes'][i]})
    skinmap={old:new for new,old in enumerate(skins)}
    doc.data['nodes']=[doc.data['nodes'][i] for i in nodes]
    for node in doc.data['nodes']:
        if 'children' in node:node['children']=[mapping[i] for i in node['children']]
        if 'skin' in node:node['skin']=skinmap[node['skin']]
    doc.data['skins']=[doc.data['skins'][i] for i in skins]
    for skin in doc.data['skins']:
        skin['joints']=[mapping[i] for i in skin['joints']]
        if 'skeleton' in skin:skin['skeleton']=mapping[skin['skeleton']]
    for animation in doc.data['animations']:
        for channel in animation['channels']:channel['target']['node']=mapping[channel['target']['node']]
    for scene in doc.data['scenes']:scene['nodes']=[mapping[i] for i in scene['nodes']]


def compact(source, target):
    for command, options in [('weld',[]),('dedup',[]),('prune',[]),('resample',[]),('resize',['--width','512','--height','512']),('webp',['--quality','85'])]:
        subprocess.run(['npx','--yes','@gltf-transform/cli@4.2.1',command,str(source),str(target),*options],check=True,stdout=subprocess.DEVNULL)
        source=target


def build(gender):
    doc=outfit(gender,'Ranger')
    joints={n['name']:i for i,n in enumerate(doc.data['nodes']) if i in doc.data['skins'][0]['joints']}
    for n in doc.data['nodes']:
        if 'mesh' in n:n['name']='Ranger:'+n['name']
    attach(doc,outfit(gender,'Peasant'),joints,'Peasant:')
    attach(doc,head(gender),joints,'Avatar:')
    for name in ['Hair_Buzzed','Hair_BuzzedFemale','Hair_SimpleParted','Hair_Long','Hair_Buns','Hair_Beard']:
        part=Document(HAIR/(name+'.gltf'))
        for m in part.data['materials']:m['name']='Hair'
        attach(doc,part,joints,'Hair:')
    for m in doc.data['materials']:
        if 'Regular' in m['name']:m['name']='Hands'
        elif 'Ranger' in m['name']:m['name']='Ranger cloth'
        elif 'Peasant' in m['name']:m['name']='Peasant cloth'
        m['doubleSided']=False
    animations(doc,ANIM,ALIASES,joints)
    animations(doc,CACHE/'UAL2_Standard.glb',SWORD,joints)
    remove_static_channels(doc)
    reachable_nodes(doc)
    raw=CACHE/f'{gender}-assembled.glb';doc.write(raw)
    target=OUT/f'{gender}.glb'
    compact(raw,target)
    data=target.read_bytes();print(gender,len(data),'bytes',flush=True)
    return {'name':f'Custom{gender}','path':str(target.relative_to(ROOT)),'creator':'Quaternius','source':'https://quaternius.com/packs/universalbasecharacters.html','download':'https://quaternius.itch.io/universal-base-characters','license':'CC0-1.0','kind':'model','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'generatedBy':'scripts/acquire-characters.py','modifications':'Head extracted from base; modular hairstyles and fantasy outfits attached to a shared rig; UAL animations mapped to game clips; textures limited to 512px. See CHARACTER_CREDITS.txt for all sources.'}

def equipment():
    doc=Document(ROOT/'apps/client/public/assets/heroes/Knight.glb')
    selected={'1H_Sword','Badge_Shield'}
    roots=[i for i,n in enumerate(doc.data['nodes']) if n.get('name') in selected]
    for name, weapons in [('Mage',['2H_Staff']),('Rogue',['Knife','Knife_Offhand']),('Barbarian',['2H_Axe'])]:
        part=Document(ROOT/f'apps/client/public/assets/heroes/{name}.glb')
        offsets=doc.merge(part)
        roots.extend(i for i,n in enumerate(doc.data['nodes']) if i>=offsets['nodes'] and n.get('name') in weapons)
    doc.data['scenes']=[{'nodes':roots}];doc.data['scene']=0;doc.data['animations']=[]
    reachable_nodes(doc)
    raw=CACHE/'equipment.glb';doc.write(raw);target=OUT/'Equipment.glb'
    subprocess.run(['npx','--yes','@gltf-transform/cli@4.2.1','prune',str(raw),str(target)],check=True,stdout=subprocess.DEVNULL)
    data=target.read_bytes()
    return {'name':'CustomEquipment','path':str(target.relative_to(ROOT)),'creator':'Kay Lousberg','source':'https://kaylousberg.itch.io/kaykit-adventurers','license':'CC0-1.0','kind':'model','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'generatedBy':'scripts/acquire-characters.py','modifications':'Six existing class weapon meshes extracted for attachment to the modular character hands.'}

entries=[build(gender) for gender in ['Male','Female']]+[equipment()]
p=ROOT/'ASSET_MANIFEST.json';manifest=json.loads(p.read_text());paths={e['path'] for e in entries};p.write_text(json.dumps([e for e in manifest if e['path'] not in paths]+entries,indent=2)+'\n')
