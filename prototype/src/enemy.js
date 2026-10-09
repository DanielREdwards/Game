// Capangas: rondam em círculo, atacam um por vez (fichas de ataque) e sinalizam o golpe com 危.
import * as THREE from 'three';
import { Fighter } from './fighter.js';
import {
  E_STANCE, E_TAUNT, E_WIND, E_STRIKE, B_WIND, B_STRIKE, HIT_HEAD, HIT_BODY,
  lerpPose, idlePose, shufflePose, runPose,
} from './poses.js';
import { clamp, damp, rand, flatDist, smooth } from './util.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

const OUTFITS = {
  floral: {
    rim: 0xff6fb0, rimStrength: 0.5,
    mats: {
      skin: { color: 0xb97b55, roughness: 0.55 },
      shirt: { color: 0xffffff, roughness: 0.65 },
      pants: { color: 0xb7a888, roughness: 0.8 },
      shoes: { color: 0x3b2a1f, roughness: 0.4 },
      hair: { color: 0xb4632a, roughness: 0.5 },
      shades: { color: 0x050505, roughness: 0.08, metalness: 0.6 },
    },
    parts: {
      pelvis: 'pants', abdomen: 'shirt', chest: 'shirt', neck: 'skin', head: 'skin', upperArm: 'shirt',
      forearm: 'skin', hand: 'skin', thigh: 'pants', shin: 'pants', foot: 'shoes', hair: 'hair',
    },
    extras: { hair: 'short', shades: 'shades' },
    tex: { shirt: 'floral' },
  },
  track: {
    rim: 0x7dffb0, rimStrength: 0.45,
    mats: {
      skin: { color: 0xd19a74, roughness: 0.55 },
      suit: { color: 0xffffff, roughness: 0.5 },
      shoes: { color: 0xe9e9e9, roughness: 0.5 },
      hair: { color: 0x111111, roughness: 0.6 },
    },
    parts: {
      pelvis: 'suit', abdomen: 'suit', chest: 'suit', neck: 'skin', head: 'skin', upperArm: 'suit',
      forearm: 'suit', hand: 'skin', thigh: 'suit', shin: 'suit', foot: 'shoes', hair: 'hair',
    },
    extras: { hair: 'short' },
    tex: { suit: 'track' },
  },
  brute: {
    rim: 0xffb04a, rimStrength: 0.5, wide: 1.15,
    mats: {
      skin: { color: 0xa86f4c, roughness: 0.5 },
      tank: { color: 0xeeeae2, roughness: 0.75 },
      pants: { color: 0x2c3138, roughness: 0.75 },
      shoes: { color: 0x151515, roughness: 0.4 },
      gold: { color: 0xffc35a, roughness: 0.22, metalness: 1 },
    },
    parts: {
      pelvis: 'pants', abdomen: 'tank', chest: 'tank', neck: 'skin', head: 'skin', upperArm: 'skin',
      forearm: 'skin', hand: 'skin', thigh: 'pants', shin: 'pants', foot: 'shoes', hair: 'skin',
    },
    extras: { hair: 'bald', chain: 'gold' },
  },
};

const KINDS = {
  floral: { hp: 5, scale: 1.0, wind: 0.85, dmg: 12, speed: 4.6, poses: [E_WIND, E_STRIKE] },
  track: { hp: 5, scale: 0.97, wind: 0.8, dmg: 12, speed: 4.9, poses: [E_WIND, E_STRIKE] },
  brute: { hp: 8, scale: 1.14, wind: 1.05, dmg: 20, speed: 3.8, poses: [B_WIND, B_STRIKE] },
};

export class Enemy extends Fighter {
  constructor(game, kind, spawn, index) {
    const outfit = OUTFITS[kind];
    for (const [mat, which] of Object.entries(outfit.tex || {})) outfit.mats[mat].map = game.fx.clothTex[which];
    super(game, outfit, KINDS[kind].scale);
    this.kind = kind;
    this.cfg = KINDS[kind];
    this.index = index;
    this.spawn = new THREE.Vector3(...spawn);
    this.stance = E_STANCE;
    this.radius = 0.42 * this.scale;
    this.vel = new THREE.Vector3();

    this.tele = new THREE.Sprite(new THREE.SpriteMaterial({
      map: game.fx.dangerTex, color: new THREE.Color(3, 1.2, 0.3), transparent: true, depthTest: false, depthWrite: false,
    }));
    this.tele.renderOrder = 20;
    this.tele.visible = false;
    this.ring = new THREE.Mesh(game.fx.ringGeo, new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 0.5, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 3;
    this.ring.visible = false;
    game.scene.add(this.tele, this.ring);
    this.reset();
  }

  reset() {
    this.pos.copy(this.spawn);
    this.yaw = Math.atan2(-this.spawn.x, 3.6 - this.spawn.z);
    this.hp = this.cfg.hp;
    this.token = false;
    this.vel.set(0, 0, 0);
    this.strafe = this.index % 2 ? 1 : -1;
    this.strafeT = rand(0.5, 1.5);
    this.ringDist = rand(2.8, 3.6);
    this.phase = rand(0, 6);
    this.rig.tilt.rotation.x = 0;
    this.flash = 0;
    this.setState('intro');
    this.tele.visible = this.ring.visible = false;
  }

  get targetable() {
    return this.hp > 0 && !['knockdown', 'down', 'getup', 'ko'].includes(this.state);
  }
  get solid() { return this.targetable || this.state === 'stagger'; }

  giveToken() {
    this.token = true;
    this.setState('approach');
  }

  releaseToken() {
    this.token = false;
  }

  // Congela o capanga enquanto o contra-ataque do protagonista acontece.
  stagger(dur = 0.9) {
    this.staggerDur = dur;
    this.hideTelegraph();
    this.setState('stagger');
  }

  hideTelegraph() {
    this.tele.visible = this.ring.visible = false;
  }

  takeHit(attacker, move) {
    const g = this.game;
    this.hp -= move.dmg;
    this.flash = 1;
    this.releaseToken();
    this.hideTelegraph();
    if (this.hp <= 0 || move.knock) {
      this.beginFall(attacker.pos, move.dmg > 50 ? 7 : 5);
      this.setState('knockdown');
      if (this.hp <= 0) g.onEnemyDown(this);
      return;
    }
    this.face(attacker.pos, 1000, 1);
    this.forward(this.kb).multiplyScalar(-(move.kb || 0.3) * 7);
    this.hitPose = move.hitY < 1.2 ? HIT_BODY : HIT_HEAD;
    this.setState('hit');
  }

  // Empurrão sem dano (onda de choque da finalização).
  knockBack(from, power) {
    this.releaseToken();
    this.hideTelegraph();
    this.beginFall(from, power);
    this.setState('knockdown');
  }

  update(dt) {
    const g = this.game, pl = g.player;
    this.t += dt;
    const dist = flatDist(this.pos, pl.pos);
    switch (this.state) {
      case 'intro': {
        this.face(pl.pos, 4, dt);
        lerpPose(E_TAUNT, E_STANCE, smooth(clamp((this.t - 0.6 - this.index * 0.3) / 0.6, 0, 1)), this.pose);
        idlePose(this.pose, this.t + this.index, this.pose);
        this.sharp = 8;
        if (g.state === 'play' && this.t > 1.4 + this.index * 0.3) this.setState('circle');
        break;
      }
      case 'circle': {
        this.face(pl.pos, 7, dt);
        if ((this.strafeT -= dt) <= 0) {
          this.strafe = Math.random() < 0.2 ? 0 : Math.random() < 0.5 ? -1 : 1;
          this.strafeT = rand(1.1, 2.6);
          this.ringDist = rand(2.6, 3.7);
        }
        tmp.subVectors(pl.pos, this.pos).setY(0).normalize();
        const radial = clamp(dist - this.ringDist, -1, 1);
        tmp2.set(-tmp.z, 0, tmp.x).multiplyScalar(this.strafe * 1.2);
        tmp2.addScaledVector(tmp, radial * 2.0);
        this.vel.x = damp(this.vel.x, tmp2.x, 5, dt);
        this.vel.z = damp(this.vel.z, tmp2.z, 5, dt);
        if (!pl.alive || g.state !== 'play') this.vel.multiplyScalar(0.9);
        this.pos.addScaledVector(this.vel, dt);
        const sp = this.vel.length();
        this.phase += dt * (4 + sp * 3);
        shufflePose(idlePose(E_STANCE, this.t + this.index), this.phase, clamp(sp / 1.6, 0, 1), this.pose);
        this.sharp = 12;
        break;
      }
      case 'approach': {
        this.face(pl.pos, 10, dt);
        tmp.subVectors(pl.pos, this.pos).setY(0).normalize();
        this.pos.addScaledVector(tmp, this.cfg.speed * dt);
        this.phase += dt * 15;
        runPose(this.phase, 0.85, this.pose);
        this.sharp = 14;
        if (dist <= 1.5) {
          this.setState('windup');
          g.sfx.telegraph();
        } else if (this.t > 3 || !pl.alive) {
          this.releaseToken();
          this.setState('circle');
        }
        break;
      }
      case 'windup': {
        const W = this.cfg.wind, p = clamp(this.t / W, 0, 1);
        if (p < 0.75) this.face(pl.pos, 9, dt);
        if (dist > 1.6) {
          tmp.subVectors(pl.pos, this.pos).setY(0).normalize();
          this.pos.addScaledVector(tmp, Math.min(dist - 1.5, 3.0 * dt));
        }
        lerpPose(this.stance, this.cfg.poses[0], smooth(clamp(p / 0.45, 0, 1)), this.pose);
        this.pose.chest[2] += Math.sin(this.t * 40) * 0.015;
        this.sharp = 12;
        this.showTelegraph(p);
        if (p >= 1) {
          this.hideTelegraph();
          this.setState('strike');
          this.forward(this.kb).multiplyScalar(3.5);
          g.sfx.whoosh(this.kind === 'brute');
          tmp.subVectors(pl.pos, this.pos).setY(0);
          const d = tmp.length();
          const facing = d > 1e-3 ? tmp.divideScalar(d).dot(this.forward(tmp2)) : 1;
          if (d < 2.0 && facing > 0.45) pl.takeHit(this, this.cfg.dmg);
        }
        break;
      }
      case 'strike': {
        this.pos.addScaledVector(this.kb, dt);
        this.kb.multiplyScalar(Math.exp(-10 * dt));
        lerpPose(this.pose, this.cfg.poses[1], 1, this.pose);
        this.sharp = 34;
        if (this.t > 0.22) this.setState('recover');
        break;
      }
      case 'recover': {
        lerpPose(this.cfg.poses[1], this.stance, smooth(clamp(this.t / 0.5, 0, 1)), this.pose);
        this.sharp = 10;
        if (this.t > 0.55) { this.releaseToken(); this.setState('circle'); }
        break;
      }
      case 'stagger': {
        this.sharp = 6;
        if (this.t > this.staggerDur) this.setState('circle');
        break;
      }
      case 'hit': {
        this.pos.addScaledVector(this.kb, dt);
        this.kb.multiplyScalar(Math.exp(-8 * dt));
        const f = clamp(this.t / 0.34, 0, 1);
        lerpPose(this.hitPose, this.stance, smooth(f), this.pose);
        this.sharp = f < 0.25 ? 45 : 12;
        if (f >= 1) this.setState('circle');
        break;
      }
      case 'knockdown':
        if (this.updateFall(dt)) this.setState(this.hp > 0 ? 'down' : 'ko');
        break;
      case 'down':
        if (this.t > 1.4) this.setState('getup');
        break;
      case 'getup':
        if (this.updateGetup(dt)) this.setState('circle');
        break;
      case 'ko':
        break;
    }
    if (this.targetable) this.clampArena();
    this.syncRig(dt);
  }

  showTelegraph(p) {
    const head = this.rig.world('head', tmp);
    this.tele.visible = this.ring.visible = true;
    this.tele.position.set(head.x, head.y + 0.55, head.z);
    const s = 0.46 + Math.sin(this.t * 26) * 0.05;
    this.tele.scale.set(s, s, 1);
    this.tele.material.color.setRGB(2.6 + p * 1.2, 1.3 - p * 1.0, 0.25);
    this.ring.position.set(this.pos.x, 0.03, this.pos.z);
    this.ring.scale.setScalar(1.5 - p * 1.0);
    this.ring.material.opacity = 0.35 + p * 0.65;
  }
}

// Diretor de combate: concede "fichas" de ataque para que poucos inimigos ataquem ao mesmo tempo.
export class Director {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.cool = 2.2;
  }

  update(dt) {
    const g = this.game, pl = g.player;
    if (g.state !== 'play' || !pl.alive) return;
    if ((this.cool -= dt) > 0) return;
    if (pl.state === 'finisher' || pl.state === 'down') return;
    const alive = g.enemies.filter((e) => e.hp > 0);
    const busy = alive.filter((e) => e.token).length;
    const max = alive.length >= 3 && g.elapsed > 14 ? 2 : 1;
    if (busy >= max) return;
    const cands = alive.filter((e) => e.state === 'circle');
    if (!cands.length) return;
    pl.forward(tmp2);
    let total = 0;
    const w = cands.map((e) => {
      tmp.subVectors(e.pos, pl.pos).setY(0).normalize();
      const behind = tmp.dot(tmp2) < -0.2 ? 1.2 : 0;
      const v = 1 + behind + 1 / Math.max(1, flatDist(e.pos, pl.pos));
      total += v;
      return v;
    });
    let r = Math.random() * total;
    let pick = cands[0];
    for (let i = 0; i < cands.length; i++) if ((r -= w[i]) <= 0) { pick = cands[i]; break; }
    pick.giveToken();
    this.cool = alive.length === 1 ? rand(0.8, 1.5) : rand(0.6, 1.4);
  }
}
