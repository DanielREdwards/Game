// Cenário: quarteirão de Mong Kok numa noite de chuva — beco, Rua Fa Yuen, mercado noturno e
// templo de Tin Hau. Toda a geometria e todas as texturas são procedurais.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as T from './textures.js';
import { mulberry32 } from './util.js';
import { Batch, facadeKit, shopKit, SOURCES, LAMPS } from './world/kit.js';
import { buildAlley } from './world/alley.js';
import { buildStreet } from './world/street.js';
import { buildMarket } from './world/market.js';
import { buildTemple, TEMPLE_SMOKE, BLOSSOM } from './world/temple.js';

// Chão: retângulo que cobre todo o quarteirão.
const GROUND = { x0: -56, x1: 56, z0: -12, z1: 36 };
const GW = GROUND.x1 - GROUND.x0, GD = GROUND.z1 - GROUND.z0;
const GCX = (GROUND.x0 + GROUND.x1) / 2, GCZ = (GROUND.z0 + GROUND.z1) / 2;

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
  scene.fog = new THREE.FogExp2(0x150e24, 0.022);
  SOURCES.length = 0;
  LAMPS.length = 0;

  addSky(scene);
  scene.add(new THREE.HemisphereLight(0x6a58a0, 0x140c1a, 0.7));
  const moon = new THREE.DirectionalLight(0x8ea6ff, 0.45);
  moon.position.set(-3, 14, 12);
  scene.add(moon);

  const batch = new Batch();
  const ctx = { scene, rng, batch, ups, flicker: [], kit: facadeKit(rng), sk: shopKit(rng) };
  const reflector = addGround(scene, rng, renderer, ups, batch);
  buildAlley(ctx);
  buildStreet(ctx);
  buildMarket(ctx);
  buildTemple(ctx);
  batch.flush(scene, { shadow: false, receive: true });
  ups.push((dt, t) => { for (const f of ctx.flicker) f(t); });

  const pool = lightPool(scene, 8);
  const lampLight = shadowLamp(scene);
  addRain(scene, ups);
  addSmoke(scene, rng, ups);
  const petals = addPetals(scene, rng);

  const focus = new THREE.Vector3();
  return {
    reflector,
    wind: 0,
    update(dt, t, camera, target) {
      if (target) focus.copy(target);
      else if (camera) focus.copy(camera.position);
      pool(dt, focus);
      lampLight(dt, focus);
      petals(dt, t, this.wind);
      for (const u of ups) u(dt, t, camera, this.wind);
    },
    resize(w, h, pr) {
      const rt = reflector.getRenderTarget();
      rt.setSize(Math.min(1280, Math.round(w * pr * 0.5)), Math.min(1024, Math.round(h * pr * 0.5)));
    },
  };
}

// ------------------------------------------------------------ céu

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
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), m);
  sky.renderOrder = -1;
  sky.position.set(0, 0, 12);
  scene.add(sky);
}

// ------------------------------------------------------------ luzes

// Oito luzes pontuais reais redistribuídas entre as fontes mais próximas, com transição suave
// (o número de luzes nunca muda, então os sombreadores não são recompilados).
function lightPool(scene, n) {
  const pool = [];
  for (let i = 0; i < n; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 14, 2);
    scene.add(l);
    pool.push({ l, src: null, k: 0, leaving: false });
  }
  let timer = 0, want = [];
  return (dt, focus) => {
    if ((timer -= dt) <= 0) {
      timer = 0.25;
      want = SOURCES.map((s) => [s, s.intensity / (1 + s.pos.distanceToSquared(focus) / 30)])
        .sort((a, b) => b[1] - a[1]).slice(0, n).map((a) => a[0]);
      for (const p of pool) if (p.src && !want.includes(p.src)) p.leaving = true;
    }
    for (const p of pool) {
      if (p.leaving) {
        p.k -= dt * 3;
        if (p.k <= 0) { p.k = 0; p.src = null; p.leaving = false; }
      } else if (p.src) p.k = Math.min(1, p.k + dt * 2.5);
      if (!p.src) {
        const s = want.find((w) => !pool.some((q) => q.src === w));
        if (s) {
          p.src = s;
          p.k = 0;
          p.l.position.copy(s.pos);
          p.l.color.copy(s.color);
          p.l.distance = s.range;
        }
      }
      p.l.intensity = p.src ? p.src.intensity * p.k : 0;
    }
  };
}

// Luz de poste com sombra: acompanha o poste mais próximo do protagonista, com troca suave.
function shadowLamp(scene) {
  const spot = new THREE.SpotLight(0xffa457, 0, 30, 0.75, 0.65, 1.6);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.03;
  spot.shadow.camera.near = 1;
  spot.shadow.camera.far = 24;
  scene.add(spot, spot.target);
  let cur = null, k = 0;
  return (dt, focus) => {
    let best = null, bd = Infinity;
    for (const L of LAMPS) {
      const d = (L.target.x - focus.x) ** 2 + (L.target.z - focus.z) ** 2;
      if (d < bd) { bd = d; best = L; }
    }
    if (!best) return;
    if (best !== cur) {
      k -= dt * 3;
      if (k <= 0 || !cur) {
        k = 0;
        cur = best;
        spot.position.copy(cur.pos);
        spot.target.position.copy(cur.target);
        spot.target.updateMatrixWorld();
        spot.color.copy(cur.color);
      }
    } else k = Math.min(1, k + dt * 2);
    spot.intensity = cur.power * k * 0.75;
  };
}

// ------------------------------------------------------------ chão molhado

const w2c = (x, z, W, H) => [((x - GROUND.x0) / GW) * W, ((z - GROUND.z0) / GD) * H];

function puddles(rng) {
  const W = 2048, H = Math.round((2048 * GD) / GW), c = T.makeCanvas(W, H), g = c.getContext('2d');
  const ppm = W / GW;
  g.fillStyle = 'rgb(222,222,222)';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const x = rng() * W, y = rng() * H, r = 6 + rng() * 26, v = (150 + rng() * 70) | 0;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${v},${v},${v},0.6)`);
    gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const blob = (cx, cy, rx, ry, rot, core = 0.55) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.scale(Math.max(1, rx), Math.max(1, ry));
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(92,92,92,1)');
    gr.addColorStop(Math.max(core, 0.72), 'rgba(92,92,92,0.95)');
    gr.addColorStop(1, 'rgba(92,92,92,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const puddle = (x, z, rx, rz, rot) => {
    const [cx, cy] = w2c(x, z, W, H);
    blob(cx, cy, rx * ppm, rz * ppm, rot);
    for (let k = 0; k < 5; k++) {
      blob(cx + (rng() - 0.5) * rx * ppm * 1.4, cy + (rng() - 0.5) * rz * ppm * 1.4, rx * ppm * (0.3 + rng() * 0.4), rz * ppm * (0.3 + rng() * 0.4), rng() * 3, 0.4);
    }
  };
  const spots = [
    [-5.2, -4.6, 1.6, 0.9, 0.3], [3.8, -2.4, 1.3, 0.8, -0.4], [-1.6, 2.6, 2.0, 1.0, 0.2], [5.6, 4.2, 1.2, 0.9, 0.8], [0.6, -6.6, 2.4, 0.7, 0],
    [-6.4, 4.8, 1.1, 1.4, 0.5], [1.8, 7.6, 2.2, 1.1, -0.2], [-3.6, -1.0, 0.8, 0.6, 1.1], [6.6, -6.8, 1.4, 0.6, 0.1], [-2.5, 12.5, 1.8, 1.0, 0.4],
    [4.0, 14.0, 1.4, 0.8, -0.3], [-12, 22, 2.6, 1.0, 0.1], [6, 25.5, 2.2, 0.9, -0.2], [-30, 24, 3.0, 1.2, 0], [22, 23, 2.0, 1.0, 0.3],
    [33, 25, 2.4, 0.8, -0.1], [40, 22.5, 1.6, 0.9, 0.2], [-42, 21, 2.2, 1.0, 0.4], [-39, 12.5, 2.0, 1.1, 0.2], [-36.5, 6.5, 1.4, 0.8, -0.5],
    [-44, 10, 1.2, 0.9, 0.3], [-20, 26, 1.8, 0.7, 0], [15, 21, 1.2, 0.6, 0.2],
  ];
  for (const s of spots) puddle(...s);
  for (let i = 0; i < 140; i++) {
    const x = GROUND.x0 + rng() * GW, z = GROUND.z0 + rng() * GD;
    const [cx, cy] = w2c(x, z, W, H);
    blob(cx, cy, (0.3 + rng() * 0.8) * ppm, (0.2 + rng() * 0.5) * ppm, rng() * 3, 0.3);
  }
  // sarjetas encharcadas: junto às paredes do beco e ao meio-fio
  for (const x of [-8.6, 8.6]) for (let z = -8; z < 16; z += 0.7) { const [cx, cy] = w2c(x, z, W, H); blob(cx, cy, 0.5 * ppm, 0.6 * ppm, 0, 0.3); }
  for (const z of [19.3, 28.3]) for (let x = -50; x < 50; x += 0.8) { const [cx, cy] = w2c(x, z, W, H); blob(cx, cy, 0.7 * ppm, 0.28 * ppm, 0, 0.3); }
  return T.toTex(c, { srgb: false, aniso: 4 });
}

function addGround(scene, rng, renderer, ups, batch) {
  const asphalt = T.asphaltTex(rng);
  asphalt.repeat.set(GW / 3.4, GD / 3.4);
  const mask = puddles(rng);
  mask.channel = 1;
  const geo = new THREE.PlaneGeometry(GW, GD);
  geo.setAttribute('uv1', geo.attributes.uv.clone());
  const mat = new THREE.MeshStandardMaterial({ map: asphalt, roughnessMap: mask, roughness: 1, metalness: 0, color: 0xa4a2aa });
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n\tdiffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.38, 0.85, roughnessFactor));',
    );
  };
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(GCX, 0, GCZ);
  ground.receiveShadow = true;
  scene.add(ground);

  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const refl = new Reflector(new THREE.PlaneGeometry(GW, GD), {
    clipBias: 0.003,
    textureWidth: Math.max(256, Math.min(1280, (size.x * 0.5) | 0)),
    textureHeight: Math.max(256, Math.min(1024, (size.y * 0.5) | 0)),
    color: 0xffffff,
    shader: WetShader,
    multisample: 0,
  });
  refl.rotation.x = -Math.PI / 2;
  refl.position.set(GCX, 0.011, GCZ);
  refl.renderOrder = 2;
  const m = refl.material;
  m.transparent = true;
  m.blending = THREE.AdditiveBlending;
  m.depthWrite = false;
  m.uniforms.tMask.value = mask;
  scene.add(refl);
  ups.push((dt, t) => { m.uniforms.uTime.value = t; });

  // marcações do beco: faixas amarelas junto às paredes, bueiros e "慢" (devagar)
  const deco = (tex, w, h, x, z, rot = 0) => {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }));
    d.rotation.set(-Math.PI / 2, 0, rot);
    d.position.set(x, 0.003, z);
    d.receiveShadow = true;
    d.renderOrder = 1;
    scene.add(d);
    return d;
  };
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd8a51c, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const x of [-8.15, -7.95, 7.95, 8.15]) batch.add(new THREE.PlaneGeometry(0.1, 24).rotateX(-Math.PI / 2), yellow, x, 0.003, 3.6);
  const manhole = T.manholeTex();
  for (const [x, z, s] of [[-3.4, 1.2, 0.95], [4.6, -4.4, 0.8], [-14, 24.5, 0.9], [12, 21.5, 0.9], [-26, 26.5, 0.9], [36, 24, 0.9]]) deco(manhole, s, s, x, z);
  deco(T.paintTex('慢'), 2.4, 2.4, 0, 9.2);
  deco(T.paintTex('慢'), 2.4, 2.4, 0, 14.0);
  return refl;
}

// ------------------------------------------------------------ chuva, vapor, incenso e pétalas

function addRain(scene, ups) {
  const N = 4200;
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
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0.55, 0.62, 0.85) }, uWind: { value: 0 } },
    vertexShader: `
      attribute vec3 aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCam; uniform float uWind; varying float vA;
      void main() {
        float S = 26.0, H = 15.0;
        vec3 p;
        p.x = uCam.x + mod(aSeed.x * S - uCam.x, S) - S * 0.5;
        p.z = uCam.z + mod(aSeed.z * S - uCam.z, S) - S * 0.5;
        float y = mod(aSeed.y * H - uTime * (13.0 + aSeed.x * 4.0), H);
        p.y = y + aEnd * 0.42;
        p.x += aEnd * (0.06 + uWind * 0.25);
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
  ups.push((dt, t, cam, wind) => {
    m.uniforms.uTime.value = t;
    m.uniforms.uWind.value = wind || 0;
    if (cam) m.uniforms.uCam.value.copy(cam.position);
  });
}

function addSmoke(scene, rng, ups) {
  const tex = T.smokeTex(rng);
  const emitter = (x, y, z, { rate = 5, color = 0xd8c8e8, size = 1.4, rise = 0.6, life = 3.2, opacity = 0.16, spread = 0.3 } = {}) => {
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
    ups.push((dt, t, cam, wind) => {
      if (cam && Math.abs(cam.position.x - x) + Math.abs(cam.position.z - z) > 45) {
        for (const p of parts) p.s.visible = false;
        return;
      }
      acc += dt * rate;
      while (acc >= 1) {
        acc -= 1;
        const p = parts[cur];
        cur = (cur + 1) % parts.length;
        p.age = 0;
        p.vx = (rng() - 0.5) * 0.25 + 0.12 + (wind || 0) * 0.8;
        p.vz = (rng() - 0.5) * 0.25;
        p.rot = (rng() - 0.5) * 0.6;
        p.s.position.set(x + (rng() - 0.5) * spread, y, z + (rng() - 0.5) * spread);
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
  emitter(-14, 0.05, 24.5, { color: 0xd8c0a8, rate: 3, size: 1.5, opacity: 0.12 });
  emitter(12, 0.05, 21.5, { color: 0xc8b8e0, rate: 3, size: 1.4, opacity: 0.11 });
  emitter(26.8, 1.0, 29.2, { color: 0xffe0c8, rate: 4, size: 1.0, rise: 0.8, opacity: 0.14 });
  emitter(37.8, 1.0, 18.3, { color: 0xffe0c8, rate: 4, size: 1.0, rise: 0.8, opacity: 0.14 });
  for (const [x, y, z] of TEMPLE_SMOKE) emitter(x, y, z, { color: 0xb8b8c8, rate: 2.5, size: 0.7, rise: 0.45, life: 4, opacity: 0.12, spread: 0.1 });
}

// Pétalas de bauhínia caindo no pátio do templo (instanciadas).
function addPetals(scene, rng) {
  const N = 140;
  const geo = new THREE.PlaneGeometry(0.055, 0.075);
  const mat = new THREE.MeshStandardMaterial({ map: T.petalTex(), alphaTest: 0.5, color: 0xe07ab8, emissive: 0x5a1040, emissiveIntensity: 0.8, side: THREE.DoubleSide, roughness: 0.7 });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const P = [];
  for (let i = 0; i < N; i++) P.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(rng() * 6, rng() * 6, rng() * 6), w: 0.5 + rng(), age: rng() * 9, life: 6 + rng() * 4 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const respawn = (o) => {
    o.p.set(BLOSSOM.x + (rng() - 0.5) * 4, BLOSSOM.y + (rng() - 0.3) * 1.5, BLOSSOM.z + (rng() - 0.5) * 4);
    o.v.set((rng() - 0.5) * 0.3, -0.4 - rng() * 0.3, (rng() - 0.5) * 0.3);
    o.age = 0;
  };
  for (const o of P) respawn(o);
  return (dt, t, wind) => {
    for (let i = 0; i < N; i++) {
      const o = P[i];
      o.age += dt;
      if (o.age > o.life || o.p.y < 0.02) respawn(o);
      o.p.x += (o.v.x + Math.sin(t * 1.3 + i) * 0.25 - wind * 1.2) * dt;
      o.p.y += o.v.y * dt;
      o.p.z += (o.v.z + Math.cos(t * 1.1 + i * 0.7) * 0.25 + wind * 0.5) * dt;
      o.r.x += dt * o.w * 3;
      o.r.y += dt * o.w * 2;
      q.setFromEuler(e.set(o.r.x, o.r.y, o.r.z));
      m4.compose(o.p, q, one);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}
