// Visual dos personagens, interpretado da arte conceitual em docs/arte-conceitual/.
import * as THREE from 'three';
import * as B from './bodytex.js';

const n = (v) => new THREE.Vector2(v, v);

function hero() {
  const skin = '#c8946c';
  const torso = B.heroTorso(skin);
  const sleeve = B.heroSleeve(skin);
  return {
    name: 'Protagonista',
    rim: 0x5fe8ff, rimStrength: 0.5, wide: 1.1, arm: 1.06, leg: 1.18,
    mats: {
      skin: { map: B.plainSkin(skin), roughness: 0.42 },
      chest: { map: torso.chest.map, normalMap: torso.chest.normalMap, normalScale: n(0.7), roughness: 0.4 },
      abdomen: { map: torso.abdomen.map, normalMap: torso.abdomen.normalMap, normalScale: n(0.75), roughness: 0.4 },
      sleeveU: { map: sleeve.upper, roughness: 0.4 },
      sleeveL: { map: sleeve.lower, roughness: 0.4 },
      delt: { map: sleeve.shoulder, roughness: 0.4 },
      cargo: { map: B.cargoTex(), roughness: 0.92 },
      shoe: { map: B.shoeTex('sneaker'), roughness: 0.45 },
      sole: { color: 0xf0eee8, roughness: 0.6 },
      hair: { color: 0x0b0a0a, roughness: 0.65 },
      eye: { color: 0x120d0b, roughness: 0.15 },
      lip: { color: 0x8a4c3c, roughness: 0.5 },
      silver: { color: 0xd8dade, roughness: 0.16, metalness: 1 },
      leather: { color: 0x101012, roughness: 0.35 },
    },
    parts: {
      pelvis: 'cargo', abdomen: 'abdomen', chest: 'chest', neck: 'skin', head: 'skin',
      lDelt: 'delt', lUpper: 'sleeveU', lLower: 'sleeveL', rUpper: 'skin', rLower: 'skin',
      hand: 'skin', thigh: 'cargo', shin: 'cargo', foot: 'shoe', hair: 'hair',
    },
    hair: 'textured',
    face: { brow: 'hair' },
    cargo: 'cargo',
    sole: 'sole',
    acc: { belt: 'leather', buckle: 'silver', chain: 'silver', tag: true, earrings: 'silver' },
  };
}

function mobster(o) {
  const S = B.suitSet(o);
  const coat = !!o.coat;
  return {
    name: o.name,
    rim: o.rim, rimStrength: 0.45, wide: o.wide || 1.05, arm: 1.05, leg: 1.05,
    weapon: o.weapon,
    mats: {
      skin: { map: B.plainSkin(o.skin), roughness: 0.5 },
      neck: o.neckInk ? { map: B.neckInk(o.skin), roughness: 0.5 } : { map: B.plainSkin(o.skin), roughness: 0.5 },
      chest: { map: S.chest, roughness: 0.72 },
      abd: { map: S.abdomen, roughness: 0.72 },
      upper: { map: S.upper, roughness: 0.72 },
      lower: { map: S.lower, roughness: 0.72 },
      pants: { map: S.pants, roughness: 0.72 },
      coat: { color: new THREE.Color(o.coat || '#000000'), roughness: 0.78 },
      shirt: { color: new THREE.Color(o.cuff || '#eeeae2'), roughness: 0.6 },
      hat: { color: new THREE.Color(o.hat), roughness: 0.85 },
      band: { color: 0x0b0b0c, roughness: 0.6 },
      shades: { color: 0x050505, roughness: 0.05, metalness: 0.6 },
      shoe: { map: B.shoeTex(o.shoes), roughness: 0.18 },
      hair: { color: new THREE.Color(o.hair), roughness: 0.5 },
      beard: { color: new THREE.Color(o.beard || o.skin), roughness: 0.8 },
      eye: { color: 0x120d0b, roughness: 0.15 },
      lip: { color: 0x7a463a, roughness: 0.5 },
      cigar: { color: 0x5a3317, roughness: 0.7 },
      paper: { color: 0xeeeeea, roughness: 0.6 },
      glove: { color: 0x0d0d0f, roughness: 0.3 },
    },
    parts: {
      pelvis: 'pants', abdomen: 'abd', chest: 'chest', neck: 'neck', head: 'skin',
      lUpper: coat ? 'coat' : 'upper', rUpper: coat ? 'coat' : 'upper',
      lLower: coat ? 'coat' : 'lower', rLower: coat ? 'coat' : 'lower',
      hand: o.gloves ? 'glove' : 'skin', thigh: 'pants', shin: 'pants', foot: 'shoe', hair: 'hair',
    },
    hair: 'short',
    face: { brow: 'hair', beard: o.beard ? 'beard' : null, mustache: o.beard ? 'beard' : null },
    cuffs: coat ? null : 'shirt',
    acc: {
      hat: ['hat', 'band'],
      shades: o.shades ? 'shades' : null,
      smoke: o.smoke,
      skirt: coat ? ['coat', 0.8, 0.14] : ['pants', 0.24, 0.02],
    },
  };
}

// As texturas usam fontes CJK: chamar somente depois de carregá-las.
export function makeLooks() {
  return {
    hero: hero(),
    vittore: mobster({
      name: 'Don Vittore', seed: 41, rim: 0xff5a48, weapon: 'tommy',
      base: '#6e0f15', stripe: 'rgba(255,210,210,0.32)', shirt: '#efeae0', tie: '#3e080c', vest: '#5c0c12',
      square: '#b0141c', watch: '#d4a53c', hat: '#5e0c12', shades: true, smoke: 'cigar',
      beard: '#3b3632', hair: '#2a2622', skin: '#c08a66', shoes: 'black',
    }),
    moretti: mobster({
      name: 'Luca Moretti', seed: 42, rim: 0x6aa8ff, weapon: 'pistol', wide: 1.02,
      base: '#18286a', stripe: 'rgba(225,232,255,0.34)', shirt: '#26387a', tie: '#efeae0', vest: '#142158',
      square: '#efeae0', watch: '#d4a53c', hat: '#e6dcc4', smoke: 'cigarette', neckInk: true,
      hair: '#2b1d14', skin: '#c99a76', shoes: 'spectator', cuff: '#26387a',
    }),
    ricci: mobster({
      name: 'Salvatore Ricci', seed: 43, rim: 0x6dffa0, weapon: 'tommy', wide: 1.07,
      base: '#173a26', stripe: 'rgba(200,255,220,0.16)', shirt: '#161618', collar: '#101012', tie: '#6d5a1e', tiePattern: '#d4a53c',
      brooch: '#d4a53c', coat: '#15110f', hat: '#16301f', shades: true, smoke: 'cigarette', gloves: true,
      beard: '#1f1915', hair: '#1c1612', skin: '#bf8c68', shoes: 'black',
    }),
  };
}
