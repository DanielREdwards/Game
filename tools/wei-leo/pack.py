# Empacota o .glb em base64 dentro de um .json ({"glb": "..."}) para servidores que não entregam .glb
# (por exemplo, a página publicada do protótipo). O jogo tenta o .glb primeiro e depois este .json.
import base64, json, sys
import paths

src = sys.argv[1] if len(sys.argv) > 1 else paths.ASSET
dst = sys.argv[2] if len(sys.argv) > 2 else src + '.json'
data = open(src, 'rb').read()
json.dump({'glb': base64.b64encode(data).decode('ascii')}, open(dst, 'w'))
print(dst, len(data), 'bytes ->', len(open(dst).read()), 'caracteres')
