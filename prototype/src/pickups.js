// Armas do chão (especificação de combate, seção 13): poucas unidades espalhadas pelo mapa, com
// brilho discreto. Pegar e largar com E / RB / PEGAR; cada golpe certeiro gasta um uso.
import * as THREE from 'three';
import { ITEM_MODELS } from './weapons.js';
import { resolve } from './map.js';

export const WEAPONS = {
  bottle: { name: 'Garrafa', cjk: '瓶', uses: 1, dmg: 4, reach: 0, knock: true, sound: 'glass' },
  stick: { name: 'Pau', cjk: '棍', uses: 4, dmg: 2, reach: 0.25, sound: 'wood' },
  crowbar: { name: 'Pé de cabra', cjk: '撬', uses: 8, dmg: 3, reach: 0.1, knockEvery: 3, sound: 'metal' },
  pipe: { name: 'Cano', cjk: '管', uses: 6, dmg: 2.5, reach: 0.1, sound: 'metal' },
};

// Posições iniciais: duas por zona, longe do centro das lutas.
const PLACES = [
  ['bottle', -6.4, -3.4], ['stick', 6.3, 7.4],
  ['crowbar', -11.5, 18.2], ['bottle', 8.0, 29.9],
  ['bottle', 31.0, 19.3], ['stick', 41.5, 28.6],
  ['stick', -44.2, 9.6], ['crowbar', -33.6, 5.0],
];

const glowGeo = new THREE.CircleGeometry(0.55, 32).rotateX(-Math.PI / 2);

export class Pickups {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(1.0, 0.82, 0.45) } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vU;
        void main(){ float r = length(vU - 0.5) * 2.0; float ring = smoothstep(1.0, 0.75, r) * smoothstep(0.35, 0.8, r);
          float a = (ring * 0.9 + smoothstep(1.0, 0.0, r) * 0.25) * (0.55 + 0.45 * sin(uT * 3.0)); gl_FragColor = vec4(uC * a, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  }

  reset() {
    for (const it of this.items) this.game.scene.remove(it.group);
    this.items = [];
    for (const [type, x, z] of PLACES) this.place(type, x, z);
  }

  place(type, x, z, uses = WEAPONS[type].uses, toss = false) {
    const group = new THREE.Group();
    const model = ITEM_MODELS[type]();
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const holder = new THREE.Group();
    holder.add(model);
    holder.position.y = type === 'bottle' ? 0.034 : 0.026;
    holder.rotation.y = Math.random() * Math.PI * 2;
    model.position.z = -0.25;
    group.add(holder);
    const glow = new THREE.Mesh(glowGeo, this.glowMat);
    glow.position.y = 0.015;
    glow.renderOrder = 3;
    group.add(glow);
    const p = resolve({ x, z }, 0.2);
    group.position.set(p.x, 0, p.z);
    this.game.scene.add(group);
    const it = { type, uses, group, holder, pos: group.position, t: toss ? 0 : 1 };
    this.items.push(it);
    return it;
  }

  // Arma largada (por capanga nocauteado ou pelo protagonista).
  drop(type, pos, uses) {
    const a = Math.random() * Math.PI * 2;
    return this.place(type, pos.x + Math.cos(a) * 0.5, pos.z + Math.sin(a) * 0.5, uses ?? WEAPONS[type].uses, true);
  }

  nearest(pos, max = 1.7) {
    let best = null, bd = max * max;
    for (const it of this.items) {
      const d = (it.pos.x - pos.x) ** 2 + (it.pos.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  take(it) {
    this.game.scene.remove(it.group);
    this.items.splice(this.items.indexOf(it), 1);
    return { type: it.type, uses: it.uses };
  }

  update(dt, t) {
    this.glowMat.uniforms.uT.value = t;
    for (const it of this.items) {
      if (it.t < 1) {
        // pequeno arremesso ao cair
        it.t = Math.min(1, it.t + dt * 2.5);
        it.holder.position.y = 0.03 + Math.sin(Math.PI * it.t) * 0.5;
        it.holder.rotation.x = (1 - it.t) * 6;
      }
    }
  }
}
