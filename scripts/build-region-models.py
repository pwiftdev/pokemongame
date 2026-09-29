"""Derive material variants from the pinned Quaternius meshes without duplicating geometry design."""
import hashlib,json,pathlib,struct
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'ASSET_MANIFEST.json').read_text())
variants=[('SnowPine','Pine_1','Leaves',[.79,.86,.9,1]),('AutumnTree','CommonTree_1','Leaves',[.78,.34,.10,1]),('MoonTree','TwistedTree_1','Leaves',[.3,.52,.66,1]),('Sandstone','Rock_Medium_1','Rocks',[.68,.40,.20,1])]
for name,source,material,color in variants:
 source_path=f'apps/client/public/assets/nature/{source}.glb';raw=(root/source_path).read_bytes();length=struct.unpack_from('<I',raw,12)[0];model=json.loads(raw[20:20+length]);binary=raw[20+length:]
 for mat in model['materials']:
  if material in mat['name']:
   pbr=mat['pbrMetallicRoughness'];pbr.pop('baseColorTexture',None);pbr['baseColorFactor']=color
 document=json.dumps(model,separators=(',',':')).encode();document+=b' '*(-len(document)%4)
 output=struct.pack('<III',0x46546c67,2,20+len(document)+len(binary))+struct.pack('<II',len(document),0x4e4f534a)+document+binary
 path=f'apps/client/public/assets/nature/{name}.glb';(root/path).write_bytes(output);original=next(e for e in manifest if e['path']==source_path);entry={**original,'name':name,'path':path,'bytes':len(output),'sha256':hashlib.sha256(output).hexdigest(),'generatedBy':'scripts/build-region-models.py','modifications':'Material colors adjusted for region; original mesh, rig and remaining textures unchanged'};entry.pop('download',None);manifest=[e for e in manifest if e['path']!=path];manifest.append(entry)
(root/'ASSET_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
