"""Keep the KayKit clips used by the game and prune their unused animation buffers."""
import hashlib,json,pathlib,struct,subprocess,tempfile,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'ASSET_MANIFEST.json').read_text())
clips=json.loads((root/'apps/client/src/render/hero-clips.json').read_text())
with tempfile.TemporaryDirectory() as folder:
 for entry in manifest:
  if '/heroes/' not in entry['path'] or entry['kind']!='model':continue
  raw=urllib.request.urlopen(entry['download'],timeout=90).read();length=struct.unpack_from('<I',raw,12)[0];model=json.loads(raw[20:20+length]);binary=raw[20+length:];keep=clips['common']+clips[entry['name']]
  model['animations']=[a for a in model['animations'] if a['name'] in keep]
  document=json.dumps(model,separators=(',',':')).encode();document+=b' '*(-len(document)%4)
  output=struct.pack('<III',0x46546c67,2,20+len(document)+len(binary))+struct.pack('<II',len(document),0x4e4f534a)+document+binary
  source=pathlib.Path(folder)/'source.glb';source.write_bytes(output);dest=root/entry['path']
  subprocess.run(['npx','--yes','@gltf-transform/cli@4.2.1','prune',str(source),str(dest)],check=True)
  entry['bytes']=dest.stat().st_size;entry['sha256']=hashlib.sha256(dest.read_bytes()).hexdigest();entry['generatedBy']='scripts/prepare-hero-models.py';entry['modifications']=f'Retained {len(keep)} authored locomotion, jump and combat clips for this class; pruned unused animation buffers. Embedded equipment, rig and mesh retained.'
(root/'ASSET_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
