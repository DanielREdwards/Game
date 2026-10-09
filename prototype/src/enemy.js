// Família Vittore: rondam em círculo, atacam um por vez (fichas de ataque) e anunciam cada golpe.
// 危 = golpe corpo a corpo (contra-atacar). 閃 = disparo (esquivar).
import * as THREE from 'three';
import { Fighter } from './fighter.js';
import {
  E_WIND, E_STRIKE, B_WIND, B_STRIKE, HIT_HEAD, HIT_BODY, E_TAUNT, G_STANCE, G_AIM, P_STANCE, P_AIM,
  lerpPose, idlePose, shufflePose, runPose,
} from './poses.js';
import { clamp, damp, rand, flatDist, smooth } from './util.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const tmp3 = new THREE.Vector3();

const KINDS = {
  vittore: {
    hp: 10, scale: 1.01, wind: 1.0, dmg: 18, speed: 3.9, melee: [B_WIND, B_STRIKE], stance: G_STANCE, aimPose: G_AIM,
    shoot: 0.45, aim: 1.0, shots: 5, every: 0.075, bullet: 5, ring: [3.4, 4.6], boss: true,
  },
  moretti: {
    hp: 6, scale: 0.99, wind: 0.75, dmg: 12, speed: 5.2, melee: [E_WIND, E_STRIKE], stance: P_STANCE, aimPose: P_AIM,
    shoot: 0.5, aim: 0.75, shots: 2, every: 0.22, bullet: 9, ring: [2.8, 3.8],
  },
  ricci: {
    hp: 7, scale: 1.03, wind: 0.9, dmg: 14, speed: 4.4, melee: [E_WIND, E_STRIKE], stance: G_STANCE, aimPose: G_AIM,
    shoot: 0.7, aim: 0.9, shots: 6, every: 0.075, bullet: 5, ring: [3.8, 5.0],
  },
};

export class Enemy extends Fighter {
  constructor(game, kind, spawn, index) {
    super(game, game.looks[kind], KINDS[kind].scale);
    this.kind = kind;
    this.cfg = KINDS[kind];
    this.name = game.looks[kind].name;
    this.index = index;
    this.spawn = new THREE.Vector3(...spawn);
    this.stance = this.cfg.stance;
    this.radius = 0.42 * this.scale;
    this.vel = new THREE.Vector3();
    this.aimDir = new THREE.Vector3();

    this.tele = new THREE.Sprite(new THREE.SpriteMaterial({
      map: game.fx.dangerTex, color: new THREE.Color(3, 1.2, 0.3), transparent: true, depthTest: false, depthWrite: false,
    }));
    this.tele.renderOrder = 20;
    this.ring = new THREE.Mesh(game.fx.ringGeo, new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 0.5, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 3;
    this.sight = new THREE.Mesh(game.fx.unitBox, new THREE.MeshBasicMaterial({
      color: new THREE.Color(3, 0.25, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.sight.renderOrder = 6;
    game.scene.add(this.tele, this.ring, this.sight);
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
    this.ringDist = rand(...this.cfg.ring);
    this.phase = rand(0, 6);
    this.smokeT = rand(0, 1);
    this.rig.tilt.rotation.x = 0;
    this.flash = 0;
    this.setState('intro');
    this.hideTelegraph();
  }

  get targetable() {
    return this.hp > 0 && !['knockdown', 'down', 'getup', 'ko'].includes(this.state);
  }
  get solid() { return this.targetable || this.state === 'stagger'; }

  giveToken() {
    this.token = true;
    const d = flatDist(this.pos, this.game.player.pos);
    if (d > 2.2 && Math.random() < this.cfg.shoot) {
      this.setState('aim');
      this.game.sfx.cock();
    } else this.setState('approach');
  }

  releaseToken() {
    this.token = false;
  }

  // Congela o inimigo enquanto o contra-ataque do protagonista acontece.
  stagger(dur = 0.9) {
    this.staggerDur = dur;
    this.hideTelegraph();
    this.setState('stagger');
  }

  hideTelegraph() {
    this.tele.visible = this.ring.visible = this.sight.visible = false;
  }

  takeHit(attacker, move) {
    const g = this.game;
    this.hp -= move.dmg;
    this.flash = 1;
    this.releaseToken();
    this.hideTelegraph();
    if (this.cfg.boss) g.hud.boss(Math.max(0, this.hp) / this.cfg.hp);
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
        lerpPose(E_TAUNT, this.stance, smooth(clamp((this.t - 0.6 - this.index * 0.3) / 0.6, 0, 1)), this.pose);
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
          this.ringDist = rand(...this.cfg.ring);
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
        shufflePose(idlePose(this.stance, this.t + this.index), this.phase, clamp(sp / 1.6, 0, 1), this.pose);
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
        lerpPose(this.stance, this.cfg.melee[0], smooth(clamp(p / 0.45, 0, 1)), this.pose);
        this.pose.chest[2] += Math.sin(this.t * 40) * 0.015;
        this.sharp = 12;
        this.showDanger(p);
        if (p >= 1) {
          this.hideTelegraph();
          this.setState('strike');
          this.forward(this.kb).multiplyScalar(3.5);
          g.sfx.whoosh(this.kind === 'vittore');
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
        lerpPose(this.pose, this.cfg.melee[1], 1, this.pose);
        this.sharp = 34;
        if (this.t > 0.22) this.setState('recover');
        break;
      }
      case 'aim': {
        const p = clamp(this.t / this.cfg.aim, 0, 1);
        this.face(pl.pos, 8, dt);
        lerpPose(this.stance, this.cfg.aimPose, smooth(clamp(p / 0.35, 0, 1)), this.pose);
        this.sharp = 12;
        this.showAim(p);
        if (p >= 1) this.beginFire();
        break;
      }
      case 'fire': {
        lerpPose(this.cfg.aimPose, this.cfg.aimPose, 0, this.pose);
        this.pose.chest[0] -= this.recoil * 0.12;
        this.pose.rEl[0] -= this.recoil * 0.25;
        this.recoil = Math.max(0, this.recoil - dt * 14);
        this.sharp = 30;
        this.shotT -= dt;
        if (this.shotsLeft > 0 && this.shotT <= 0) {
          this.fireShot();
          this.shotsLeft--;
          this.shotT = this.cfg.every;
        }
        if (this.shotsLeft <= 0 && this.shotT <= -0.15) {
          if (this.dodged && !this.landedShots) {
            g.hud.callout('ESQUIVA', 'jade');
            g.stats.dodged++;
          }
          this.setState('recover');
        }
        break;
      }
      case 'recover': {
        const from = this.prevAttack === 'fire' ? this.cfg.aimPose : this.cfg.melee[1];
        lerpPose(from, this.stance, smooth(clamp(this.t / 0.5, 0, 1)), this.pose);
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
    if (this.state === 'strike' || this.state === 'fire') this.prevAttack = this.state;
    if (this.targetable) this.clampArena();
    this.syncRig(dt);
    if (this.rig.ember && this.hp > 0 && (this.smokeT -= dt) <= 0) {
      this.smokeT = rand(0.25, 0.5);
      g.fx.puff(this.rig.ember.getWorldPosition(tmp3));
    }
  }

  // ------------------------------------------------------------ disparos

  beginFire() {
    const pl = this.game.player;
    this.rig.muzzle.getWorldPosition(tmp);
    tmp2.set(pl.pos.x, 1.25, pl.pos.z);
    this.aimDir.subVectors(tmp2, tmp).normalize();
    this.shotsLeft = this.cfg.shots;
    this.shotT = 0;
    this.recoil = 0;
    this.dodged = false;
    this.landedShots = 0;
    this.hideTelegraph();
    this.setState('fire');
  }

  fireShot() {
    const g = this.game, pl = g.player;
    const m = this.rig.muzzle.getWorldPosition(tmp).clone();
    const dir = tmp2.copy(this.aimDir);
    dir.x += rand(-0.03, 0.03);
    dir.y += rand(-0.02, 0.02);
    dir.z += rand(-0.03, 0.03);
    dir.normalize();
    // distância entre o tronco do protagonista e a linha do disparo
    const chest = tmp3.set(pl.pos.x, 1.25 + pl.pos.y, pl.pos.z);
    const along = chest.clone().sub(m).dot(dir);
    const closest = m.clone().addScaledVector(dir, Math.max(0, along));
    const miss = closest.distanceTo(chest);
    let end;
    if (along > 0 && miss < 0.38 && pl.inv <= 0 && pl.state !== 'down') {
      end = chest.clone();
      if (pl.takeHit(this, this.cfg.bullet, { bullet: true })) this.landedShots++;
    } else {
      if (along > 0 && miss < 1.6 && (pl.state === 'dodge' || pl.inv > 0)) this.dodged = true;
      let len = 18;
      if (dir.y < -1e-3) len = Math.min(len, -m.y / dir.y);
      end = m.clone().addScaledVector(dir, len);
      if (end.y < 0.05) g.fx.ricochet(end);
    }
    this.recoil = 1;
    g.fx.muzzle(m);
    g.fx.tracer(m, end);
    g.sfx.gunshot(this.cfg.shots > 2);
    g.cam.shake(0.05);
  }

  // ------------------------------------------------------------ avisos

  showDanger(p) {
    const head = this.rig.world('head', tmp);
    this.tele.material.map = this.game.fx.dangerTex;
    this.tele.visible = this.ring.visible = true;
    this.tele.position.set(head.x, head.y + 0.62, head.z);
    const s = 0.46 + Math.sin(this.t * 26) * 0.05;
    this.tele.scale.set(s, s, 1);
    this.tele.material.color.setRGB(2.6 + p * 1.2, 1.3 - p * 1.0, 0.25);
    this.ring.material.color.setRGB(2.4, 0.5, 0.2);
    this.ring.position.set(this.pos.x, 0.03, this.pos.z);
    this.ring.scale.setScalar(1.5 - p * 1.0);
    this.ring.material.opacity = 0.35 + p * 0.65;
  }

  showAim(p) {
    const pl = this.game.player;
    const head = this.rig.world('head', tmp);
    this.tele.material.map = this.game.fx.dodgeTex;
    this.tele.visible = this.ring.visible = this.sight.visible = true;
    this.tele.position.set(head.x, head.y + 0.62, head.z);
    const s = 0.46 + Math.sin(this.t * 30) * 0.05;
    this.tele.scale.set(s, s, 1);
    this.tele.material.color.setRGB(1.2 + p, 2.4 + p * 0.6, 2.8 + p * 0.6);
    this.ring.material.color.setRGB(0.4, 2.0, 2.6);
    this.ring.position.set(pl.pos.x, 0.035, pl.pos.z);
    this.ring.scale.setScalar(1.6 - p * 1.1);
    this.ring.material.opacity = 0.3 + p * 0.7;
    const m = this.rig.muzzle.getWorldPosition(tmp2);
    const c = tmp3.set(pl.pos.x, 1.25, pl.pos.z);
    const len = m.distanceTo(c);
    this.sight.position.lerpVectors(m, c, 0.5);
    this.sight.lookAt(c);
    this.sight.scale.set(0.012, 0.012, len);
    this.sight.material.opacity = (0.15 + p * 0.85) * (0.75 + Math.sin(this.t * 60) * 0.25);
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
