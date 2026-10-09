# Gravador mínimo de glTF 2.0 binário (.glb): malhas com pele, esqueleto, materiais PBR e imagens embutidas.
import json, struct, numpy as np

FLOAT, USHORT, UINT, UBYTE = 5126, 5123, 5125, 5121
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963


def quat_from_mat(m):
    t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1.0) * 2
        w, x, y, z = 0.25 * s, (m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = np.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w, x, y, z = (m[2, 1] - m[1, 2]) / s, 0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = np.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w, x, y, z = (m[0, 2] - m[2, 0]) / s, (m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s
    else:
        s = np.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w, x, y, z = (m[1, 0] - m[0, 1]) / s, (m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s
    q = np.array([x, y, z, w])
    return q / np.linalg.norm(q)


class GLB:
    def __init__(self):
        self.j = dict(asset=dict(version='2.0', generator='Noite em Mong Kok — tools/wei-leo'), scenes=[dict(nodes=[])], scene=0,
                      nodes=[], meshes=[], accessors=[], bufferViews=[], buffers=[], materials=[], textures=[], images=[], samplers=[], skins=[])
        self.bin = bytearray()

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin += b'\0'
        off = len(self.bin)
        self.bin += data
        v = dict(buffer=0, byteOffset=off, byteLength=len(data))
        if target:
            v['target'] = target
        self.j['bufferViews'].append(v)
        return len(self.j['bufferViews']) - 1

    def accessor(self, arr, ctype, atype, target=None, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr)
        view = self._view(arr.tobytes(), target)
        count = arr.shape[0]
        a = dict(bufferView=view, componentType=ctype, count=int(count), type=atype)
        if normalized:
            a['normalized'] = True
        if minmax:
            a['min'] = [float(x) for x in arr.reshape(count, -1).min(0)]
            a['max'] = [float(x) for x in arr.reshape(count, -1).max(0)]
        self.j['accessors'].append(a)
        return len(self.j['accessors']) - 1

    def image(self, data, mime='image/jpeg', name=None):
        view = self._view(data)
        img = dict(bufferView=view, mimeType=mime)
        if name:
            img['name'] = name
        self.j['images'].append(img)
        if not self.j['samplers']:
            self.j['samplers'].append(dict(magFilter=9729, minFilter=9987, wrapS=33071, wrapT=33071))
        self.j['textures'].append(dict(source=len(self.j['images']) - 1, sampler=0))
        return len(self.j['textures']) - 1

    def material(self, name, color=(1, 1, 1, 1), tex=None, normal=None, mr=None, metallic=0.0, roughness=0.8, alpha=None, double=False, extras=None):
        pbr = dict(baseColorFactor=list(color), metallicFactor=metallic, roughnessFactor=roughness)
        if tex is not None:
            pbr['baseColorTexture'] = dict(index=tex)
        if mr is not None:
            pbr['metallicRoughnessTexture'] = dict(index=mr)
        m = dict(name=name, pbrMetallicRoughness=pbr)
        if normal is not None:
            m['normalTexture'] = dict(index=normal)
        if alpha:
            m['alphaMode'] = alpha[0]
            if alpha[0] == 'MASK':
                m['alphaCutoff'] = alpha[1]
        if double:
            m['doubleSided'] = True
        if extras:
            m['extras'] = extras
        self.j['materials'].append(m)
        return len(self.j['materials']) - 1

    def mesh(self, name, prims):
        """prims: lista de dict(pos, nrm, uv, idx, mat, joints=None, weights=None)."""
        P = []
        for p in prims:
            attr = dict(POSITION=self.accessor(p['pos'].astype(np.float32), FLOAT, 'VEC3', ARRAY_BUFFER, minmax=True))
            if p.get('nrm') is not None:
                attr['NORMAL'] = self.accessor(p['nrm'].astype(np.float32), FLOAT, 'VEC3', ARRAY_BUFFER)
            if p.get('uv') is not None:
                attr['TEXCOORD_0'] = self.accessor(p['uv'].astype(np.float32), FLOAT, 'VEC2', ARRAY_BUFFER)
            if p.get('joints') is not None:
                attr['JOINTS_0'] = self.accessor(p['joints'].astype(np.uint8), UBYTE, 'VEC4', ARRAY_BUFFER)
                attr['WEIGHTS_0'] = self.accessor(p['weights'].astype(np.float32), FLOAT, 'VEC4', ARRAY_BUFFER)
            idx = p['idx'].astype(np.uint32 if p['pos'].shape[0] > 65535 else np.uint16).reshape(-1)
            prim = dict(attributes=attr, indices=self.accessor(idx, UINT if idx.dtype == np.uint32 else USHORT, 'SCALAR', ELEMENT_ARRAY_BUFFER), material=p['mat'])
            P.append(prim)
        self.j['meshes'].append(dict(name=name, primitives=P))
        return len(self.j['meshes']) - 1

    def node(self, name, t=None, r=None, mesh=None, skin=None, children=None, extras=None):
        n = dict(name=name)
        if t is not None:
            n['translation'] = [float(x) for x in t]
        if r is not None:
            n['rotation'] = [float(x) for x in r]
        if mesh is not None:
            n['mesh'] = mesh
        if skin is not None:
            n['skin'] = skin
        if children:
            n['children'] = children
        if extras:
            n['extras'] = extras
        self.j['nodes'].append(n)
        return len(self.j['nodes']) - 1

    def skin(self, joints, ibms, skeleton=None):
        acc = self.accessor(np.array([m.T.reshape(-1) for m in ibms], np.float32), FLOAT, 'MAT4')
        s = dict(joints=joints, inverseBindMatrices=acc)
        if skeleton is not None:
            s['skeleton'] = skeleton
        self.j['skins'].append(s)
        return len(self.j['skins']) - 1

    def save(self, path):
        for k in [k for k, v in self.j.items() if isinstance(v, list) and not v]:
            del self.j[k]
        while len(self.bin) % 4:
            self.bin += b'\0'
        self.j['buffers'] = [dict(byteLength=len(self.bin))]
        js = json.dumps(self.j, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin))
        out += struct.pack('<II', len(js), 0x4E4F534A) + js
        out += struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out)
        return len(out)
