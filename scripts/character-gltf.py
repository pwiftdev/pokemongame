"""Small glTF helpers for the reproducible character assembly pipeline."""
import copy
import json
import pathlib
import struct

SIZES = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
FORMATS = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}

class Document:
    def __init__(self, path):
        self.path = pathlib.Path(path)
        raw = self.path.read_bytes()
        if self.path.suffix == '.glb':
            length = struct.unpack_from('<I', raw, 12)[0]
            self.data = json.loads(raw[20:20+length])
            self.binary = bytearray(raw[28+length:])
        else:
            self.data = json.loads(raw)
            self.binary = bytearray((self.path.parent / self.data['buffers'][0]['uri']).read_bytes())
        for image in self.data.get('images', []):
            if 'uri' in image:
                file = self.path.parent / image.pop('uri')
                if not file.exists():
                    name = file.name.replace('_png', '').replace('_jpg', '')
                    file = next((candidate for parent in list(self.path.parents)[:3] for candidate in parent.rglob(name)), file)
                image['bufferView'] = self.view(file.read_bytes())
                image['mimeType'] = 'image/png' if file.suffix.lower() == '.png' else 'image/jpeg'
        self.data['buffers'] = [{'byteLength': len(self.binary)}]

    def view(self, data):
        self.binary += b'\0' * (-len(self.binary) % 4)
        views = self.data.setdefault('bufferViews', [])
        views.append({'buffer': 0, 'byteOffset': len(self.binary), 'byteLength': len(data)})
        self.binary += data
        return len(views)-1

    def values(self, index):
        a = self.data['accessors'][index]
        v = self.data['bufferViews'][a['bufferView']]
        fmt = '<' + FORMATS[a['componentType']] * SIZES[a['type']]
        stride = v.get('byteStride', struct.calcsize(fmt))
        offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from(fmt, self.binary, offset+i*stride) for i in range(a['count'])]

    def accessor(self, values, kind='VEC3', component=5126):
        fmt = '<' + FORMATS[component] * SIZES[kind]
        data = b''.join(struct.pack(fmt, *value) for value in values)
        accessors = self.data.setdefault('accessors', [])
        accessors.append({'bufferView': self.view(data), 'componentType': component, 'count': len(values), 'type': kind,
                          'min': [min(v[i] for v in values) for i in range(SIZES[kind])],
                          'max': [max(v[i] for v in values) for i in range(SIZES[kind])]})
        return len(accessors)-1

    def merge(self, other):
        d = copy.deepcopy(other.data)
        keys = ['bufferViews', 'accessors', 'images', 'textures', 'samplers', 'materials', 'meshes', 'nodes', 'skins', 'animations']
        offsets = {k: len(self.data.setdefault(k, [])) for k in keys}
        self.binary += b'\0' * (-len(self.binary) % 4)
        start = len(self.binary)
        self.binary += other.binary
        for v in d.get('bufferViews', []): v['byteOffset'] = v.get('byteOffset', 0)+start; v['buffer'] = 0
        for a in d.get('accessors', []):
            if 'bufferView' in a: a['bufferView'] += offsets['bufferViews']
        for i in d.get('images', []): i['bufferView'] += offsets['bufferViews']
        for t in d.get('textures', []):
            for key, table in [('source','images'), ('sampler','samplers')]:
                if key in t: t[key] += offsets[table]
        def textures(value):
            if isinstance(value, dict):
                for k,v in value.items():
                    if k.endswith('Texture') and isinstance(v,dict) and 'index' in v: v['index'] += offsets['textures']
                    else: textures(v)
        for m in d.get('materials', []): textures(m)
        for m in d.get('meshes', []):
            for p in m['primitives']:
                for attrs in [p['attributes']] + p.get('targets', []):
                    for k in attrs: attrs[k] += offsets['accessors']
                if 'indices' in p:p['indices'] += offsets['accessors']
                if 'material' in p:p['material'] += offsets['materials']
        for n in d.get('nodes', []):
            for key, table in [('mesh','meshes'), ('skin','skins')]:
                if key in n:n[key] += offsets[table]
            if 'children' in n:n['children'] = [x+offsets['nodes'] for x in n['children']]
        for skin in d.get('skins', []):
            skin['joints'] = [j+offsets['nodes'] for j in skin['joints']]
            if 'skeleton' in skin:skin['skeleton'] += offsets['nodes']
            skin['inverseBindMatrices'] += offsets['accessors']
        for a in d.get('animations', []):
            for s in a['samplers']:
                s['input'] += offsets['accessors']; s['output'] += offsets['accessors']
            for c in a['channels']:c['target']['node'] += offsets['nodes']
        for key in keys:self.data[key] += d.get(key, [])
        return offsets

    def write(self, path):
        self.binary += b'\0' * (-len(self.binary) % 4)
        self.data['buffers'] = [{'byteLength': len(self.binary)}]
        text = json.dumps(self.data, separators=(',', ':')).encode()
        text += b' ' * (-len(text) % 4)
        raw = struct.pack('<III', 0x46546c67, 2, 28+len(text)+len(self.binary))
        raw += struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(self.binary),0x004e4942)+self.binary
        pathlib.Path(path).write_bytes(raw)
