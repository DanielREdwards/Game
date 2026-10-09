// Fábrica de personagens: gera as malhas (em Web Workers quando possível) e monta esqueletos.
import * as THREE from 'three';
import { ARM_A, LEG_A, SEG, SKEL, buildBody, buildHead, buildHair } from './humanoid.js';

const JOBS = { body: buildBody, head: buildHead, hair: buildHair };

// Esqueleto de ossos na pose de ligação (pose "A"), com as mesmas medidas de jointsOf() em humanoid.js.
export function makeSkeleton(wide = 1) {
  const B = {};
  const list = [];
  const bone = (name, parent, x, y, z, rz = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    b.rotation.z = rz;
    if (parent) parent.add(b);
    B[name] = b;
    list.push(b);
    return b;
  };
  const marker = (name, parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    B[name] = o;
  };
  const hips = bone('hips', null, 0, SKEL.HIPS, 0);
  const spine = bone('spine', hips, 0, SKEL.SPINE - SKEL.HIPS, 0);
  const chest = bone('chest', spine, 0, SKEL.CHEST - SKEL.SPINE, 0);
  const neck = bone('neck', chest, 0, SKEL.NECK - SKEL.CHEST, 0);
  bone('head', neck, 0, SKEL.HEAD - SKEL.NECK, 0);
  const sw = SKEL.SW * wide, hw = SKEL.HW * wide;
  for (const s of [1, -1]) {
    const p = s > 0 ? 'l' : 'r';
    const sh = bone(p + 'Sh', chest, sw * s, SKEL.SH_Y - SKEL.CHEST, 0, s * ARM_A);
    const el = bone(p + 'El', sh, 0, -SKEL.UPPER_ARM, 0);
    marker(p + 'Fist', el, 0, -SKEL.FOREARM, 0);
  }
  for (const s of [1, -1]) {
    const p = s > 0 ? 'l' : 'r';
    const hp = bone(p + 'Hip', hips, hw * s, -SEG.HIP_DROP, 0, s * LEG_A);
    const kn = bone(p + 'Kn', hp, 0, -SEG.UPPER, 0);
    const an = bone(p + 'Ank', kn, 0, -SEG.LOWER, 0, -s * LEG_A);
    marker(p + 'Foot', an, 0, -0.03, 0.1);
  }
  return { B, list };
}

function toBuffer(a) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
  if (a.skinIndex) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(a.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(a.skinWeight, 4));
  }
  g.computeBoundingSphere();
  return g;
}

const pause = () => new Promise((r) => setTimeout(r, 0));

// Gera todas as malhas pedidas. jobs: [{ key, kind: 'body'|'head'|'hair', args: [...] }].
export async function buildGeometries(jobs, onProgress = () => {}) {
  const results = new Map();
  let done = 0;
  const finish = (key, r) => {
    results.set(key, r);
    onProgress(++done / jobs.length);
  };
  let workers = [];
  try {
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < n; i++) workers.push(new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }));
  } catch {
    workers = [];
  }
  if (workers.length) {
    try {
      await new Promise((resolve, reject) => {
        let next = 0, active = 0;
        const timer = setTimeout(() => reject(new Error('tempo esgotado')), 45000);
        const pump = (w) => {
          if (next >= jobs.length) {
            if (active === 0) { clearTimeout(timer); resolve(); }
            return;
          }
          const job = jobs[next++];
          active++;
          w.onmessage = (e) => { active--; finish(job.key, e.data); pump(w); };
          w.onerror = (e) => { clearTimeout(timer); reject(e); };
          w.postMessage({ kind: job.kind, args: job.args });
        };
        workers.forEach(pump);
      });
    } catch (err) {
      console.warn('Geração em paralelo indisponível; usando a thread principal.', err?.message || err);
    } finally {
      workers.forEach((w) => w.terminate());
    }
  }
  for (const job of jobs) {
    if (results.has(job.key)) continue;
    finish(job.key, JOBS[job.kind](...job.args));
    await pause();
  }
  const out = new Map();
  for (const [k, r] of results) out.set(k, { geometry: toBuffer(r.arrays), J: r.J });
  return out;
}
