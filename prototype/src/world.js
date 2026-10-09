// Cenário: beco sem saída em Mong Kok, noite de chuva. Toda a geometria é procedural.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as T from './textures.js';
import { mulberry32 } from './util.js';

const GROUND = { cx: 0, cz: 2, size: 24 };
const w2c = (x, z, S) => [
  ((x - (GROUND.cx - GROUND.size / 2)) / GROUND.size) * S,
  ((z - (GROUND.cz - GROUND.size / 2)) / GROUND.size) * S,
];

// Fachadas: origem, direção ao longo da parede (u) e normal voltada para o beco.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FR = {
  B: { o: V(-9, 0, -8.5), r: V(1, 0, 0), n: V(0, 0, 1), ry: 0 },
  L: { o: V(-9, 0, -8.5), r: V(0, 0, 1), n: V(1, 0, 0), ry: Math.PI / 2 },
  R: { o: V(9, 0, -8.5), r: V(0, 0, 1), n: V(-1, 0, 0), ry: -Math.PI / 2 },
};
const at = (fr, u, v, off = 0) => fr.o.clone().addScaledVector(fr.r, u).setY(v).addScaledVector(fr.n, off);

// Reflexo de asfalto molhado: espelho planar distorcido por gotas, modulado pela máscara de poças.
const WetShader = {
  name: 'WetReflector',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    tMask: { value: null }, uTime: { value: 0 }, uStrength: { value: 1 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUvR; varying vec2 vUv0; varying vec3 vWorld;
    void main() {
      vUvR = textureMatrix * vec4(position, 1.0);
      vUv0 = uv;
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D tMask; uniform float uTime; uniform float uStrength;
    varying vec4 vUvR; varying vec2 vUv0; varying vec3 vWorld;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec2 ripples(vec2 p, float t) {
      vec2 acc = vec2(0.0);
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 q = p * (1.7 + fi * 1.1) + fi * 7.3;
        vec2 id = floor(q);
        vec2 f = fract(q) - 0.5;
        float h = hash(id + fi * 13.1);
        vec2 o = vec2(hash(id + 3.1), hash(id + 5.7)) - 0.5;
        vec2 d = f - o * 0.6;
        float ph = fract(t * (0.8 + h * 0.5) + h);
        float r = length(d);
        float w = sin((r - ph * 0.55) * 70.0) * smoothstep(0.07, 0.0, abs(r - ph * 0.55)) * (1.0 - ph);
        acc += (d / max(r, 1e-3)) * w;
      }
      return acc;
    }
    void main() {
      float dry = texture2D(tMask, vUv0).g;
      float wet = 1.0 - smoothstep(0.4, 0.85, dry);
      vec2 rp = ripples(vWorld.xz, uTime);
      vec4 uv = vUvR;
      uv.xy += rp * (0.006 + 0.012 * wet) * vUvR.w;
      float br = mix(0.004, 0.022, 1.0 - wet) * vUvR.w;
      vec3 c = texture2DProj(tDiffuse, uv).rgb * 0.36;
      c += texture2DProj(tDiffuse, uv + vec4(br, 0.0, 0.0, 0.0)).rgb * 0.16;
      c += texture2DProj(tDiffuse, uv - vec4(br, 0.0, 0.0, 0.0)).rgb * 0.16;
      c += texture2DProj(tDiffuse, uv + vec4(0.0, br * 2.5, 0.0, 0.0)).rgb * 0.16;
      c += texture2DProj(tDiffuse, uv - vec4(0.0, br * 2.5, 0.0, 0.0)).rgb * 0.16;
      vec3 Vd = normalize(cameraPosition - vWorld);
      float fres = 0.04 + 0.96 * pow(1.0 - clamp(Vd.y, 0.0, 1.0), 5.0);
      float k = mix(0.1, 0.95, wet) * mix(0.45, 1.0, fres) * uStrength;
      gl_FragColor = vec4(c * k * color, 1.0);
    }`,
};

export function buildWorld(scene, renderer) {
  const rng = mulberry32(20240613);
  const ups = [];
  scene.background = new THREE.Color(0x07060c);
  scene.fog = new THREE.FogExp2(0x150e24, 0.024);

  addSky(scene);
  addLights(scene);
  const reflector = addGround(scene, rng, renderer, ups);
  addBuildings(scene, rng);
  addShops(scene, rng);
  addSigns(scene, rng, ups);
  addWallDetails(scene, rng, ups);
  addProps(scene, rng);
  addLamp(scene);
  addRain(scene, ups);
  addSteam(scene, rng, ups);

  return {
    reflector,
    update(dt, t, camera) { for (const u of ups) u(dt, t, camera); },
    resize(w, h, pr) {
      const rt = reflector.getRenderTarget();
      rt.setSize(Math.min(1280, Math.round(w * pr * 0.5)), Math.min(1024, Math.round(h * pr * 0.5)));
    },
  };
}

// ------------------------------------------------------------ céu e luzes

function addSky(scene) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vP; void main() {
      float h = normalize(vP).y;
      vec3 top = vec3(0.01, 0.008, 0.022), hor = vec3(0.17, 0.07, 0.17), low = vec3(0.22, 0.1, 0.06);
      vec3 c = mix(hor, top, smoothstep(0.0, 0.45, h));
      c = mix(low, c, smoothstep(-0.05, 0.1, h));
      gl_FragColor = vec4(c, 1.0);
    }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(95, 32, 16), m);
  sky.renderOrder = -1;
  scene.add(sky);
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0x6a58a0, 0x140c1a, 0.7));
  const dir = new THREE.DirectionalLight(0x8ea6ff, 0.45);
  dir.position.set(-3, 14, 12);
  scene.add(dir);
  const pts = [
    [0xff4a2e, 22, [-5.6, 2.8, -7.2]],
    [0x30f0d0, 20, [7.4, 5.2, -5.6]],
    [0xff3fa4, 26, [-7.3, 6.0, -4.0]],
    [0xffa83e, 22, [0.5, 8.0, -7.6]],
    [0xa35cff, 22, [-7.3, 7.0, 10]],
    [0x6dffb0, 14, [6.0, 2.7, -7.3]],
    [0xff5a3a, 16, [7.4, 6.5, 1.5]],
  ];
  for (const [c, i, p] of pts) {
    const l = new THREE.PointLight(c, i, 16, 2);
    l.position.set(...p);
    scene.add(l);
  }
}

// ------------------------------------------------------------ chão molhado

function addGround(scene, rng, renderer, ups) {
  const spots = [
    [-5.2, -4.6, 1.6, 0.9, 0.3], [3.8, -2.4, 1.3, 0.8, -0.4], [-1.6, 2.6, 2.0, 1.0, 0.2],
    [5.6, 4.2, 1.2, 0.9, 0.8], [0.6, -6.6, 2.4, 0.7, 0], [-6.4, 4.8, 1.1, 1.4, 0.5],
    [1.8, 7.6, 2.2, 1.1, -0.2], [-3.6, -1.0, 0.8, 0.6, 1.1], [6.6, -6.8, 1.4, 0.6, 0.1],
  ];
  const asphalt = T.asphaltTex(rng);
  const puddles = T.puddleTex(rng, w2c, spots);
  puddles.channel = 1;
  const geo = new THREE.PlaneGeometry(GROUND.size, GROUND.size);
  geo.setAttribute('uv1', geo.attributes.uv.clone());
  const mat = new THREE.MeshStandardMaterial({ map: asphalt, roughnessMap: puddles, roughness: 1, metalness: 0, color: 0xa4a2aa });
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n\tdiffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.38, 0.85, roughnessFactor));',
    );
  };
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(GROUND.cx, 0, GROUND.cz);
  ground.receiveShadow = true;
  scene.add(ground);

  const outer = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x17171c, roughness: 0.55 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.set(0, -0.02, 20);
  scene.add(outer);

  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const refl = new Reflector(new THREE.PlaneGeometry(GROUND.size, GROUND.size), {
    clipBias: 0.003,
    textureWidth: Math.max(256, Math.min(1280, (size.x * 0.5) | 0)),
    textureHeight: Math.max(256, Math.min(1024, (size.y * 0.5) | 0)),
    color: 0xffffff,
    shader: WetShader,
    multisample: 0,
  });
  refl.rotation.x = -Math.PI / 2;
  refl.position.set(GROUND.cx, 0.004, GROUND.cz);
  refl.renderOrder = 2;
  const m = refl.material;
  m.transparent = true;
  m.blending = THREE.AdditiveBlending;
  m.depthWrite = false;
  m.uniforms.tMask.value = puddles;
  scene.add(refl);
  ups.push((dt, t) => { m.uniforms.uTime.value = t; });

  // Marcações de solo: faixas amarelas, bueiro, grelhas e "慢" (devagar).
  const deco = (tex, w, h, x, z, rot = 0, opts = {}) => {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, ...opts,
    }));
    d.rotation.set(-Math.PI / 2, 0, rot);
    d.position.set(x, 0.002, z);
    d.receiveShadow = true;
    d.renderOrder = 1;
    scene.add(d);
    return d;
  };
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd8a51c, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const x of [-8.15, -7.95, 7.95, 8.15]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 21), yellow);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.002, 2.4);
    s.receiveShadow = true;
    scene.add(s);
  }
  deco(T.manholeTex(), 0.95, 0.95, -3.4, 1.2);
  deco(T.manholeTex(), 0.8, 0.8, 4.6, -4.4);
  deco(T.paintTex('慢'), 2.4, 2.4, 0, 9.2);
  return refl;
}

// ------------------------------------------------------------ prédios

function addBuildings(scene, rng) {
  const side = new THREE.MeshStandardMaterial({ color: 0x24222a, roughness: 0.95 });
  const make = (fr, u0, u1, h, base, cols, faceIndex) => {
    const w = u1 - u0;
    const { map, emissiveMap } = T.facadeTex(rng, w, h, { base, cols });
    const face = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.35, roughness: 0.85 });
    const geo = fr === FR.B ? new THREE.BoxGeometry(w, h, 8) : new THREE.BoxGeometry(8, h, w);
    const mats = [side, side, side, side, side, side];
    mats[faceIndex] = face;
    const m = new THREE.Mesh(geo, mats);
    m.position.copy(at(fr, (u0 + u1) / 2, h / 2, -4));
    m.receiveShadow = true;
    scene.add(m);
  };
  make(FR.B, 0, 6.5, 30, '#7f9488', 3, 4);
  make(FR.B, 6.5, 12.5, 36, '#a39a8a', 3, 4);
  make(FR.B, 12.5, 18, 27, '#8c8fa3', 3, 4);
  make(FR.L, 0, 8, 28, '#9b8f7d', 4, 0);
  make(FR.L, 8, 15, 22, '#7d8f99', 3, 0);
  make(FR.L, 15, 24.5, 33, '#a08c8c', 4, 0);
  make(FR.R, 0, 9, 34, '#8d9a8a', 4, 1);
  make(FR.R, 9, 16, 25, '#9a8a7a', 3, 1);
  make(FR.R, 16, 24.5, 30, '#7b8798', 4, 1);

  // Prédios do outro lado da avenida (visíveis ao girar a câmera).
  const far = [[-22, 28, 9, 38], [-12, 30, 8, 26], [-3, 27, 9, 44], [7, 29, 8, 30], [16, 27, 9, 36], [25, 30, 9, 24]];
  for (const [x, z, w, h] of far) {
    const { map, emissiveMap } = T.facadeTex(rng, w, h, { base: '#6f7280', cols: 3, shopH: 3, lit: 0.5 });
    const face = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.9 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), [side, side, side, side, side, face]);
    m.position.set(x, h / 2, z + 4);
    scene.add(m);
  }
}

// ------------------------------------------------------------ térreo: lojas e portas de aço

function addShops(scene, rng) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1a20, roughness: 0.6, metalness: 0.4 });
  const shutter = new THREE.MeshStandardMaterial({ map: T.shutterTex(rng), roughness: 0.45, metalness: 0.55 });
  const shutterB = new THREE.MeshStandardMaterial({ map: T.shutterTex(rng, '#6d6458'), roughness: 0.45, metalness: 0.5 });
  const plane = (w, h, mat, fr, u, v, off) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(at(fr, u, v, off));
    m.rotation.y = fr.ry;
    scene.add(m);
    return m;
  };
  const box = (w, h, d, mat, fr, u, v, off) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.copy(at(fr, u, v, off));
    m.rotation.y = fr.ry;
    m.castShadow = true;
    scene.add(m);
    return m;
  };
  const lit = (fr, u0, u1, kind, awning) => {
    const w = u1 - u0, u = (u0 + u1) / 2;
    const tex = T.interiorTex(rng, kind);
    const inner = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.92, 0.92, 0.92) });
    plane(w - 0.2, 2.9, inner, fr, u, 1.5, 0.02);
    for (const du of [-w / 2 + 0.06, -w / 6, w / 6, w / 2 - 0.06]) box(0.07, 3.0, 0.08, dark, fr, u + du, 1.5, 0.06);
    box(w, 0.1, 0.1, dark, fr, u, 3.0, 0.06);
    if (awning) {
      const aw = box(w + 0.2, 0.08, 1.1, new THREE.MeshStandardMaterial({ color: awning, roughness: 0.5 }), fr, u, 3.25, 0.55);
      aw.rotation.x = fr === FR.B ? 0.12 : 0;
      if (fr !== FR.B) aw.rotation.z = fr === FR.L ? -0.12 : 0.12;
    }
  };
  const closed = (fr, u0, u1, mat = shutter) => {
    const w = u1 - u0, u = (u0 + u1) / 2;
    const s = plane(w - 0.1, 3.2, mat, fr, u, 1.6, 0.03);
    s.receiveShadow = true;
    box(w, 0.32, 0.32, dark, fr, u, 3.3, 0.16);
  };
  lit(FR.B, 0.4, 5.8, 'cafe', 0x9d1d1d);
  closed(FR.B, 6.6, 12.4, shutterB);
  lit(FR.B, 13.0, 17.6, 'pharm', 0x1d6f4c);
  closed(FR.L, 0.4, 5.2);
  lit(FR.L, 5.6, 7.4, 'stair');
  lit(FR.L, 8.6, 14.6, 'mahjong', 0x7b1446);
  closed(FR.L, 15.4, 24.2, shutterB);
  closed(FR.R, 0.4, 6.4, shutterB);
  lit(FR.R, 6.8, 8.6, 'stair');
  lit(FR.R, 9.6, 15.6, 'massage', 0x5a1a6b);
  closed(FR.R, 16.4, 24.2);
}

// ------------------------------------------------------------ letreiros

const SIGNS = [
  { fr: 'B', u: 3.1, v: 3.95, w: 4.6, h: 0.85, text: '茶餐廳', style: 'box', plate: '#fff1d0', ink: '#c3161c', color: '#ff4a3d', glow: 1.5 },
  { fr: 'B', u: 9.5, v: 3.95, w: 3.4, h: 0.8, text: '粥麵飯', style: 'tube', color: '#3ef0d0', glow: 1.9, flicker: true },
  { fr: 'B', u: 15.3, v: 3.95, w: 3.6, h: 0.85, text: '藥房', style: 'box', plate: '#f4fff8', ink: '#0d8a4f', color: '#25d07a', glow: 1.45 },
  { fr: 'B', u: 9.5, v: 10.0, w: 2.0, h: 6.4, text: '金龍酒家', style: 'tube', color: '#ffb23e', glow: 2.0, vertical: true, off: 0.3 },
  { fr: 'B', u: 3.0, v: 9.0, w: 1.4, h: 4.4, text: '夜宵', style: 'box', plate: '#fff4dd', ink: '#1c47b8', color: '#4d7dff', glow: 1.3, vertical: true, off: 0.3 },
  { fr: 'L', u: 4.6, v: 7.2, w: 1.1, h: 4.2, text: '麻雀館', style: 'tube', color: '#ff3fa4', glow: 2.2, perp: true },
  { fr: 'L', u: 11.6, v: 3.95, w: 4.4, h: 0.8, text: '麻雀耍樂', style: 'tube', color: '#ff3fa4', glow: 1.7 },
  { fr: 'L', u: 12.0, v: 7.0, w: 1.0, h: 3.4, text: '旅館', style: 'box', plate: '#fff3d6', ink: '#1b3d9c', color: '#5c8dff', glow: 1.35, perp: true },
  { fr: 'L', u: 18.6, v: 8.0, w: 1.3, h: 5.2, text: '夜總會', style: 'tube', color: '#b35cff', glow: 2.2, perp: true, flicker: true },
  { fr: 'R', u: 3.2, v: 6.6, w: 1.0, h: 3.4, text: '按摩', style: 'tube', color: '#3ee6ff', glow: 2.0, perp: true },
  { fr: 'R', u: 3.4, v: 3.95, w: 3.0, h: 0.72, text: '24小時', style: 'tube', color: '#ff4a3d', glow: 1.7, flicker: true },
  { fr: 'R', u: 10.2, v: 7.6, w: 1.2, h: 4.6, text: '大押', style: 'box', plate: '#ffe7c7', ink: '#a3121a', color: '#ff5a3a', glow: 1.45, perp: true },
  { fr: 'R', u: 12.6, v: 3.95, w: 4.0, h: 0.8, text: '足底按摩', style: 'box', plate: '#ffe6f2', ink: '#b0105a', color: '#ff4fa0', glow: 1.3 },
  { fr: 'R', u: 19.2, v: 6.6, w: 1.0, h: 3.6, text: '糖水', style: 'tube', color: '#ffe14a', glow: 1.9, perp: true },
];

function addSigns(scene, rng, ups) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x18171d, roughness: 0.5, metalness: 0.6 });
  const flick = [];
  for (const s of SIGNS) {
    const fr = FR[s.fr];
    const vertical = !!(s.perp || s.vertical);
    const tex = T.neonTex(s.text, { color: s.color, vertical, w: s.w, h: s.h, style: s.style, plate: s.plate, ink: s.ink });
    const face = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(s.glow) });
    const mats = [metal, metal, metal, metal, face, face];
    let mesh;
    if (s.perp) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.16), mats);
      mesh.position.copy(at(fr, s.u, s.v, 0.35 + s.w / 2));
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), metal);
      arm.position.copy(at(fr, s.u, s.v + s.h / 2 - 0.2, 0.2));
      scene.add(arm);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.14), mats);
      mesh.position.copy(at(fr, s.u, s.v, s.off ?? 0.12));
      mesh.rotation.y = fr.ry;
    }
    scene.add(mesh);
    if (s.flicker) {
      const st = { until: 0, next: 1 + rng() * 3 };
      flick.push((t) => {
        if (t > st.next) {
          st.until = t + 0.04 + rng() * 0.14;
          st.next = t + (rng() < 0.6 ? 0.08 + rng() * 0.25 : 1.5 + rng() * 4);
        }
        face.color.setScalar(t < st.until ? s.glow * 0.1 : s.glow);
      });
    }
  }
  ups.push((dt, t) => { for (const f of flick) f(t); });
}

// ------------------------------------------------------------ detalhes de fachada e sobre o beco

function addWallDetails(scene, rng, ups) {
  // Aparelhos de ar-condicionado (instanciados)
  const acMat = [
    new THREE.MeshStandardMaterial({ color: 0xbdb9ae, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ map: T.acTex(), roughness: 0.7 }),
  ];
  const acGeo = new THREE.BoxGeometry(0.8, 0.55, 0.45);
  const N = 54;
  const acs = new THREE.InstancedMesh(acGeo, [acMat[0], acMat[0], acMat[0], acMat[0], acMat[1], acMat[0]], N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const frs = [FR.B, FR.L, FR.L, FR.R, FR.R];
  for (let i = 0; i < N; i++) {
    const fr = frs[i % frs.length];
    const len = fr === FR.B ? 18 : 16;
    const p = at(fr, 0.6 + rng() * (len - 1.2), 5.2 + Math.floor(rng() * 7) * 3.0 + 0.4, 0.25);
    q.setFromAxisAngle(V(0, 1, 0), fr.ry);
    m4.compose(p, q, sc);
    acs.setMatrixAt(i, m4);
  }
  scene.add(acs);

  // Cabos atravessando o beco
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 });
  for (let i = 0; i < 11; i++) {
    const z0 = -7.5 + i * 1.9 + rng() * 0.8, z1 = z0 + (rng() - 0.5) * 3;
    const y0 = 6 + rng() * 5, y1 = 6 + rng() * 5, sag = 0.5 + rng() * 1.2;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const f = k / 12;
      pts.push(V(-9 + 18 * f, y0 + (y1 - y0) * f - Math.sin(Math.PI * f) * sag, z0 + (z1 - z0) * f));
    }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016, 5), cableMat));
  }

  // Varais de roupa nas janelas da parede esquerda
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 0.4, metalness: 0.7 });
  const cloths = [];
  const clothCols = [0xd9d2c3, 0x3d5a80, 0xa63d40, 0xe9c46a, 0x2a2a2a, 0x7d8f69, 0xcfa5b4];
  for (let i = 0; i < 7; i++) {
    const u = 1 + rng() * 22, v = 8 + Math.floor(rng() * 5) * 3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 6), poleMat);
    pole.rotation.z = Math.PI / 2;
    pole.position.copy(at(FR.L, u, v, 0.8));
    scene.add(pole);
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.55 + rng() * 0.3), new THREE.MeshStandardMaterial({
        color: clothCols[(rng() * clothCols.length) | 0], roughness: 0.9, side: THREE.DoubleSide,
      }));
      const piv = new THREE.Group();
      piv.position.copy(at(FR.L, u + (rng() - 0.5) * 0.1, v, 0.25 + k * 0.48));
      c.position.y = -0.32;
      c.rotation.y = Math.PI / 2;
      piv.add(c);
      scene.add(piv);
      cloths.push({ piv, ph: rng() * 6 });
    }
  }
  ups.push((dt, t) => { for (const c of cloths) c.piv.rotation.z = Math.sin(t * 1.3 + c.ph) * 0.08; });

  // Andaime de bambu na parede direita
  const bamboo = new THREE.MeshStandardMaterial({ color: 0xb59a63, roughness: 0.6 });
  const vGeo = new THREE.CylinderGeometry(0.035, 0.035, 12, 6), hGeo = new THREE.CylinderGeometry(0.03, 0.03, 6.4, 6);
  const vCount = 14, hCount = 16;
  const bv = new THREE.InstancedMesh(vGeo, bamboo, vCount), bh = new THREE.InstancedMesh(hGeo, bamboo, hCount);
  let iv = 0, ih = 0;
  for (const off of [0.35, 0.95]) {
    for (let k = 0; k < 7; k++) { m4.makeTranslation(at(FR.R, 9.6 + k, 10.4, off)); bv.setMatrixAt(iv++, m4); }
    for (let k = 0; k < 8; k++) {
      q.setFromAxisAngle(V(1, 0, 0), Math.PI / 2);
      m4.compose(at(FR.R, 12.6, 5 + k * 1.5, off), q, sc);
      bh.setMatrixAt(ih++, m4);
    }
  }
  scene.add(bv, bh);

  // Calhas verticais
  const pipe = new THREE.MeshStandardMaterial({ color: 0x5b5f58, roughness: 0.5, metalness: 0.3 });
  for (const [fr, u] of [[FR.B, 6.5], [FR.B, 12.5], [FR.L, 8], [FR.L, 15], [FR.R, 9], [FR.R, 16]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 20, 8), pipe);
    p.position.copy(at(fr, u, 10, 0.12));
    scene.add(p);
  }
}

// ------------------------------------------------------------ adereços de rua

function addProps(scene, rng) {
  const add = (m, x, y, z, ry = 0) => {
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  // Mesas dobráveis e banquinhos plásticos do 茶餐廳
  const tableTop = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.6 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x777b80, roughness: 0.4, metalness: 0.6 });
  const stoolCols = [0xc8242a, 0x2456c8, 0xc8242a, 0x2a9a5a];
  for (const [x, z] of [[-7.1, -7.4], [-4.6, -7.5]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), tableTop), x, 0.74, z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.72, 8), leg), x, 0.36, z);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + rng();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.46, 12), new THREE.MeshStandardMaterial({
        color: stoolCols[(rng() * 4) | 0], roughness: 0.35,
      }));
      add(st, x + Math.cos(a) * 0.8, 0.23, z + Math.sin(a) * 0.55);
    }
  }
  // Caixotes, isopor e sacos de lixo junto às paredes
  const crate = new THREE.MeshStandardMaterial({ map: T.crateTex(rng), roughness: 0.85 });
  const foam = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.9 });
  const cardboard = new THREE.MeshStandardMaterial({ color: 0x9c7a52, roughness: 0.95 });
  const bags = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.18, metalness: 0.1 });
  for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), crate), -8.45, 0.225 + (i > 2 ? 0.45 : 0), -5.6 + (i % 3) * 0.62, rng() * 0.2);
  for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.4), foam), 8.4, 0.16 + Math.floor(i / 3) * 0.32, 3.6 + (i % 3) * 0.56, rng() * 0.1);
  for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), cardboard), 8.3, 0.2, -1.8 - i * 0.55, rng() * 0.4);
  const bagGeo = new THREE.SphereGeometry(0.32, 14, 10);
  for (const [x, z] of [[8.2, -6.6], [8.5, -6.1], [7.9, -6.9], [-8.3, 2.4], [-8.5, 2.9], [-8.2, 3.3]]) {
    const b = add(new THREE.Mesh(bagGeo, bags), x, 0.22, z, rng() * 3);
    b.scale.set(1, 0.72 + rng() * 0.2, 1);
  }

  // Táxi vermelho estacionado diante da porta de aço do fundo
  const taxi = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: 0xb3121a, roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xcfd2d6, roughness: 0.25, metalness: 0.8, clearcoat: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c12, roughness: 0.05, metalness: 0.9 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.62, 1.76), red);
  body.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.6), glass);
  cabin.position.set(-0.2, 1.17, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.5), silver);
  roof.position.set(-0.2, 1.44, 0);
  const signM = new THREE.MeshBasicMaterial({ map: T.taxiSignTex(), color: new THREE.Color(1.6, 1.6, 1.6) });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.3), [silver, silver, silver, silver, signM, signM]);
  sign.position.set(-0.2, 1.56, 0);
  const headM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.9, 2.4) });
  const tailM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.15, 0.1) });
  for (const z of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.32), headM);
    h.position.set(2.21, 0.72, z);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.3), tailM);
    tl.position.set(-2.21, 0.74, z);
    taxi.add(h, tl);
  }
  const wGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 18);
  for (const [x, z] of [[1.4, 0.82], [1.4, -0.82], [-1.4, 0.82], [-1.4, -0.82]]) {
    const w = new THREE.Mesh(wGeo, tire);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.33, z);
    taxi.add(w);
  }
  for (const m of [body, cabin, roof, sign]) { m.castShadow = true; taxi.add(m); }
  taxi.position.set(2.3, 0, -7.55);
  taxi.rotation.y = 0.04;
  scene.add(taxi);
}

// ------------------------------------------------------------ poste de luz com feixe volumétrico falso

function addLamp(scene) {
  const poleM = new THREE.MeshStandardMaterial({ color: 0x2f3a36, roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 7, 10), poleM);
  pole.position.set(8.5, 3.5, -2.6);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.08), poleM);
  arm.position.set(7.7, 6.9, -2.6);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.32), poleM);
  head.position.set(6.95, 6.82, -2.6);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.24), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.1, 1.5) }));
  bulb.position.set(6.95, 6.74, -2.6);
  scene.add(pole, arm, head, bulb);

  const spot = new THREE.SpotLight(0xffa457, 320, 30, 0.75, 0.65, 1.6);
  spot.position.set(6.95, 6.7, -2.6);
  spot.target.position.set(1.0, 0, -0.6);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.03;
  spot.shadow.camera.near = 1;
  spot.shadow.camera.far = 22;
  scene.add(spot, spot.target);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(3.4, 6.7, 40, 1, true),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1.0, 0.6, 0.28) }, uI: { value: 0.16 } },
      vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV;
        void main() { vH = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uI; varying float vH; varying vec3 vN; varying vec3 vV;
        void main() { float e = abs(dot(normalize(vN), normalize(vV))); float a = pow(e, 1.8) * pow(vH, 1.6) * uI; gl_FragColor = vec4(uColor * a, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  const dir = V(1.0 - 6.95, -6.7, -0.6 + 2.6).normalize();
  cone.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
  cone.position.set(6.95, 6.7, -2.6).addScaledVector(dir, 3.35);
  cone.renderOrder = 7;
  scene.add(cone);
}

// ------------------------------------------------------------ chuva e vapor

function addRain(scene, ups) {
  const N = 3800;
  const seed = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2), pos = new Float32Array(N * 2 * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random(), b = Math.random(), c = Math.random();
    for (let k = 0; k < 2; k++) {
      seed.set([a, b, c], (i * 2 + k) * 3);
      end[i * 2 + k] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0.55, 0.62, 0.85) } },
    vertexShader: `
      attribute vec3 aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA;
      void main() {
        float S = 24.0, H = 15.0;
        vec3 p;
        p.x = uCam.x + mod(aSeed.x * S - uCam.x, S) - S * 0.5;
        p.z = uCam.z + mod(aSeed.z * S - uCam.z, S) - S * 0.5;
        float y = mod(aSeed.y * H - uTime * (13.0 + aSeed.x * 4.0), H);
        p.y = y + aEnd * 0.42;
        p.x += aEnd * 0.06;
        vA = (1.0 - aEnd * 0.75) * smoothstep(0.0, 1.5, y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main() { gl_FragColor = vec4(uColor * vA * 0.42, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false;
  lines.renderOrder = 8;
  scene.add(lines);
  ups.push((dt, t, cam) => {
    m.uniforms.uTime.value = t;
    if (cam) m.uniforms.uCam.value.copy(cam.position);
  });
}

function addSteam(scene, rng, ups) {
  const tex = T.smokeTex(rng);
  const emitter = (x, y, z, { rate = 5, color = 0xd8c8e8, size = 1.4, rise = 0.6, life = 3.2, opacity = 0.16 } = {}) => {
    const parts = [];
    const n = Math.ceil(rate * life) + 2;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      s.renderOrder = 9;
      scene.add(s);
      parts.push({ s, age: 1e9, vx: 0, vz: 0, rot: 0 });
    }
    let acc = rng(), cur = 0;
    ups.push((dt) => {
      acc += dt * rate;
      while (acc >= 1) {
        acc -= 1;
        const p = parts[cur];
        cur = (cur + 1) % parts.length;
        p.age = 0;
        p.vx = (rng() - 0.5) * 0.25 + 0.12;
        p.vz = (rng() - 0.5) * 0.25;
        p.rot = (rng() - 0.5) * 0.6;
        p.s.position.set(x + (rng() - 0.5) * 0.3, y, z + (rng() - 0.5) * 0.3);
        p.s.material.rotation = rng() * 6;
        p.s.visible = true;
      }
      for (const p of parts) {
        if (p.age > life) { p.s.visible = false; continue; }
        p.age += dt;
        const f = p.age / life;
        p.s.position.x += p.vx * dt;
        p.s.position.z += p.vz * dt;
        p.s.position.y += rise * dt * (1 - f * 0.5);
        p.s.material.rotation += p.rot * dt;
        p.s.scale.setScalar(size * (0.35 + f * 1.6));
        p.s.material.opacity = opacity * Math.sin(Math.PI * Math.min(1, f));
      }
    });
  };
  emitter(-3.4, 0.05, 1.2, { color: 0xc9b8de, size: 1.6, opacity: 0.13 });
  emitter(-5.0, 3.4, -8.2, { color: 0xffc9b0, rate: 4, rise: 0.9, opacity: 0.12 });
  emitter(4.6, 0.05, -4.4, { color: 0xb8e8e0, rate: 3, size: 1.2, opacity: 0.1 });
}
