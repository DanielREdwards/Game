// Elenco: proporções do corpo, rosto, pintura do figurino e acessórios de cada personagem.
// Wei Leo vem de um modelo pronto (assets/wei-leo.glb): base humana CC0 ajustada à ficha do titular,
// com a pele projetada da própria ficha (ver tools/wei-leo/). Os demais seguem a arte conceitual
// em docs/arte-conceitual/ e a especificação dos soldados (docs/sala-limpa/ESPECIFICACAO-PERSONAGENS.md).
import { TextureLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildGeometries } from './body/factory.js';
import { paintBody, paintHead, eyeTex, hairTex } from './body/paint.js';

const CAST = {
  hero: {
    name: 'Wei Leo', rim: 0x5fe8ff, rimStrength: 0.22, scale: 1,
    model: ['../assets/wei-leo.glb', '../assets/wei-leo.glb.json'],
    // versão esculpida, usada só se o modelo não puder ser carregado
    fallback: {
      rimStrength: 0.28,
      body: ['athlete', { wide: 1.1 }],
      head: { jaw: 1.06, chin: 1.05, brow: 1.15, nose: 1.0, cheek: 1.04 },
      hair: 'textured', hairColor: 0x0b0a0a,
      paint: { kind: 'hero', skin: '#c8946c' },
      face: { seed: 5, skin: '#c8946c', iris: '#24160d', hair: '#0d0b0a', hairTop: 0.16, shaved: true, brow: '#0d0b0a', browW: 8, scar: true },
      acc: { chain: true, tag: true, earrings: true },
    },
  },
  vittore: {
    name: 'Don Vittore', rim: 0xff5a48, rimStrength: 0.3, scale: 1.01, weapon: 'tommy',
    body: ['suit', { wide: 1.05 }],
    head: { jaw: 1.12, chin: 1.1, beard: 'full', nose: 1.15, brow: 1.2, cheek: 1.05, face: 0.004 },
    paint: {
      kind: 'suit', seed: 41, skin: '#c08a66', base: '#6e0f15', stripe: 'rgba(255,210,210,0.3)', shirt: '#efeae0', collar: '#efeae0',
      tie: '#3e080c', vest: '#5c0c12', square: '#b0141c', watch: '#d4a53c', cuff: '#efeae0', shoes: 'dress',
    },
    face: { seed: 41, skin: '#c08a66', iris: '#3d2a1a', hair: '#3a3530', hairTop: 0.15, beard: '#4a433d', brow: '#2d2824', browW: 9 },
    acc: { hat: ['fedora', '#5e0c12'], shades: true, smoke: 'cigar' },
  },
  moretti: {
    name: 'Luca Moretti', rim: 0x6aa8ff, rimStrength: 0.3, scale: 0.99, weapon: 'pistol',
    body: ['suit', { wide: 1.0 }],
    head: { jaw: 1.04, chin: 1.08, nose: 1.05, brow: 1.05 },
    paint: {
      kind: 'suit', seed: 42, skin: '#c99a76', base: '#18286a', stripe: 'rgba(225,232,255,0.32)', shirt: '#26387a', collar: '#26387a',
      tie: '#efeae0', vest: '#142158', square: '#efeae0', watch: '#d4a53c', cuff: '#26387a', shoes: 'spectator', neckInk: true,
    },
    face: { seed: 42, skin: '#c99a76', iris: '#4f4026', hair: '#2b1d14', hairTop: 0.15, brow: '#2b1d14', browW: 7, stubble: true, neckInk: true },
    acc: { hat: ['fedora', '#e6dcc4'], smoke: 'cigarette' },
  },
  ricci: {
    name: 'Salvatore Ricci', rim: 0x6dffa0, rimStrength: 0.3, scale: 1.03, weapon: 'tommy',
    body: ['suit', { wide: 1.06, coat: true, gloves: true }],
    head: { jaw: 1.0, chin: 1.12, nose: 1.2, brow: 1.15, face: 0.008 },
    paint: {
      kind: 'suit', seed: 43, skin: '#bf8c68', base: '#173a26', stripe: 'rgba(200,255,220,0.15)', shirt: '#161618', collar: '#161618',
      tie: '#6d5a1e', tiePattern: '#d4a53c', brooch: '#d4a53c', coat: '#15110f', cuff: '#161618', gloves: true, shoes: 'dress',
    },
    face: { seed: 43, skin: '#bf8c68', iris: '#2e2016', hair: '#1c1612', hairTop: 0.15, brow: '#1c1612', browW: 8, stubble: true },
    acc: { hat: ['fedora', '#16301f'], shades: true, smoke: 'cigarette' },
  },
  soldato: {
    name: 'Soldado', rim: 0xffb27a, rimStrength: 0.2, scale: 0.99,
    body: ['goon', { wide: 1.0 }],
    head: { jaw: 1.1, nose: 1.1, brow: 1.1, cheek: 1.06 },
    paint: { kind: 'goon', seed: 51, skin: '#c89470', shirt: '#d8cfb8', suspenders: '#4a2e1c', pants: '#5a4330' },
    face: { seed: 51, skin: '#c89470', iris: '#3a2a1c', hair: '#3b2a1e', hairTop: 0.15, brow: '#3b2a1e', stubble: true },
    acc: { hat: ['cap', '#5b5650'] },
  },
  soldato2: {
    name: 'Soldado', rim: 0xffb27a, rimStrength: 0.2, scale: 1.0,
    body: ['goon', { wide: 1.0 }],
    head: { jaw: 0.98, nose: 0.95, chin: 0.95, brow: 1.0 },
    paint: { kind: 'goon', seed: 52, skin: '#b98763', shirt: '#9fb3cf', shirtStripe: 'rgba(40,60,110,0.45)', vest: '#55585e', pants: '#4a4d52' },
    face: { seed: 52, skin: '#b98763', iris: '#2c2118', hair: '#1e1612', hairTop: 0.15, brow: '#1e1612', stubble: true, browW: 6 },
    acc: { hat: ['cap', '#2a2c30'] },
  },
  piper: {
    name: 'Soldado com cano', rim: 0xffb27a, rimStrength: 0.2, scale: 1.0, weapon: 'pipe',
    body: ['goon', { wide: 1.0 }],
    head: { jaw: 1.08, nose: 1.25, brow: 1.2, face: 0.006 },
    paint: { kind: 'goon', seed: 53, skin: '#c49068', shirt: '#e6e2d6', vest: '#24262b', pants: '#26282c' },
    face: { seed: 53, skin: '#c49068', iris: '#41503a', hair: '#5a3a22', hairTop: 0.15, brow: '#4a2f1c', stubble: true },
    acc: { hat: ['cap', '#4a3a2a'] },
  },
  brute: {
    name: 'Brutamontes', rim: 0xffb27a, rimStrength: 0.2, scale: 1.06,
    body: ['goon', { wide: 1.2, big: true, bare: true }],
    head: { jaw: 1.22, chin: 1.15, neck: 0.068, nose: 1.15, brow: 1.3, cheek: 1.1 },
    paint: { kind: 'goon', seed: 54, skin: '#b88360', shirt: '#ecebe4', tank: true, suspenders: '#2b2b2e', pants: '#3a3f47' },
    face: { seed: 54, skin: '#b88360', iris: '#2a1d14', bald: true, stubble: true, brow: '#2a201a', browW: 9 },
    acc: {},
  },
};

const bodyKey = (b) => 'body:' + b[0] + JSON.stringify(b[1]);
const headKey = (h) => 'head:' + JSON.stringify(h);

// Gera malhas (em paralelo) e pinta texturas dos personagens esculpidos. list: [[id, especificação], ...].
async function sculpt(list, onProgress) {
  const jobs = new Map();
  for (const [, c] of list) {
    jobs.set(bodyKey(c.body), { key: bodyKey(c.body), kind: 'body', args: c.body });
    jobs.set(headKey(c.head), { key: headKey(c.head), kind: 'head', args: [c.head] });
    if (c.hair) jobs.set('hair:' + c.hair, { key: 'hair:' + c.hair, kind: 'hair', args: [c.hair] });
  }
  let geoP = 0, paintP = 0;
  const report = () => onProgress(geoP * 0.75 + paintP * 0.25);
  const pending = buildGeometries([...jobs.values()], (p) => { geoP = p; report(); });
  const tex = {};
  for (let i = 0; i < list.length; i++) {
    const [id, c] = list[i];
    const hair = c.hair ? hairTex(c.face.hair, c.face.seed) : null;
    tex[id] = { ...paintBody(c.paint), head: paintHead(c.face), eye: eyeTex(c.face.iris), hair: hair?.map, hairN: hair?.normalMap };
    paintP = (i + 1) / list.length;
    report();
    await new Promise((r) => setTimeout(r, 0));
  }
  const geos = await pending;
  const looks = {};
  for (const [id, c] of list) {
    looks[id] = {
      ...c,
      id,
      wide: c.body[1].wide,
      tex: tex[id],
      assets: {
        body: geos.get(bodyKey(c.body)),
        head: geos.get(headKey(c.head)),
        hair: c.hair ? geos.get('hair:' + c.hair) : null,
      },
    };
  }
  return looks;
}

// Baixa um modelo pronto: o .glb ou, onde o servidor não entrega .glb (como na página publicada), o mesmo
// arquivo em base64 dentro de um .json ({ "glb": "..." }, gerado por tools/wei-leo/pack.py).
// As texturas embutidas são abertas como imagem (<img>), não por fetch.
async function loadModel(urls) {
  const loader = new GLTFLoader();
  loader.register((parser) => {
    parser.textureLoader = new TextureLoader(parser.options.manager);
    return { name: 'texturas-por-imagem' };
  });
  let error;
  for (const url of urls) {
    try {
      const res = await fetch(new URL(url, import.meta.url));
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      let data;
      if (url.endsWith('.json')) {
        const bin = atob((await res.json()).glb);
        data = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
        data = data.buffer;
      } else data = await res.arrayBuffer();
      return await loader.parseAsync(data, '');
    } catch (e) {
      error = e;
    }
  }
  throw error;
}

// Prepara todos os visuais: modelos prontos baixam enquanto os demais são gerados.
export async function loadCharacters(onProgress = () => {}) {
  const entries = Object.entries(CAST);
  const models = {};
  const files = Promise.all(entries.filter(([, c]) => c.model).map(([id, c]) => loadModel(c.model)
    .then((g) => { models[id] = g; })
    .catch((err) => console.warn(`Modelo de ${c.name} indisponível; usando a versão esculpida.`, err?.message || err))));
  const looks = await sculpt(entries.filter(([, c]) => !c.model), (p) => onProgress(p * 0.9));
  await files;
  for (const [id, c] of entries) {
    if (!c.model) continue;
    if (models[id]) looks[id] = { ...c, id, gltf: models[id] };
    else Object.assign(looks, await sculpt([[id, { ...c, ...c.fallback }]], () => {}));
  }
  onProgress(1);
  return looks;
}
