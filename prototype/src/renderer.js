// Renderização: HDR + bloom + gradação de cor cinematográfica e resolução adaptativa.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { REDUCED_MOTION } from './config.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberr: { value: 0.0025 },
    uVignette: { value: 0.6 },
    uGrain: { value: 0.03 },
    uPunch: { value: 0 },
    uBW: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAberr, uVignette, uGrain, uPunch, uBW; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * (uAberr + uPunch * 0.005) * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(0.9, 1.0, 1.1), 0.55 * (1.0 - l));
      col += vec3(0.008, 0.004, 0.016);
      col = mix(col, col * vec3(1.06, 1.0, 0.94), smoothstep(0.5, 1.0, l));
      // modo cinema P&B: luminância com contraste de filme, grão e vinheta mais fortes
      float y = dot(col, vec3(0.3, 0.59, 0.11));
      y = smoothstep(0.02, 0.95, y);
      y = pow(y, 0.92);
      col = mix(col, vec3(y), uBW);
      float flick = 1.0 + uBW * 0.025 * sin(uTime * 37.0);
      col *= flick;
      col *= 1.0 - (uVignette + uBW * 0.35) * smoothstep(0.12, 0.62, r2 * 1.6);
      col += uPunch * 0.035 * vec3(1.0, 0.95, 0.9);
      col += (hash(vUv * uRes + fract(uTime * 7.31)) - 0.5) * (uGrain + uBW * 0.05);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Renderer {
  constructor(canvas, scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxPR = Math.min(window.devicePixelRatio || 1, 1.75);
    this.pr = Math.min(this.maxPR, 1.25);
    r.setPixelRatio(this.pr);

    const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
    const comp = (this.composer = new EffectComposer(r, rt));
    comp.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.72, 0.5, 1.0);
    comp.addPass(this.bloom);
    comp.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    comp.addPass(this.grade);

    this.punchV = 0;
    this.frames = 0;
    this.acc = 0;
    this.stable = 0;
    this.onResize = null;
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.grade.uniforms.uRes.value.set(w * this.pr, h * this.pr);
    if (this.onResize) this.onResize(w, h, this.pr);
  }

  punch(v) {
    if (!REDUCED_MOTION) this.punchV = Math.max(this.punchV, v);
  }

  // Ajusta a resolução interna para manter a fluidez em máquinas mais modestas.
  adapt(dt) {
    this.acc += dt;
    this.frames++;
    if (this.acc < 1.5) return;
    const ms = (this.acc / this.frames) * 1000;
    this.acc = 0;
    this.frames = 0;
    if (ms > 24 && this.pr > 0.6) {
      this.pr = Math.max(0.6, this.pr - 0.15);
      this.stable = 0;
      this.resize();
    } else if (ms < 14 && this.pr < this.maxPR) {
      if (++this.stable >= 3) {
        this.pr = Math.min(this.maxPR, this.pr + 0.1);
        this.stable = 0;
        this.resize();
      }
    } else this.stable = 0;
  }

  tick(dt) {
    this.punchV = Math.max(0, this.punchV - dt * 4);
    const u = this.grade.uniforms.uBW;
    u.value += ((this.bw ? 1 : 0) - u.value) * (1 - Math.exp(-4 * dt));
  }

  // Modo cinema em preto e branco (alternado com C).
  toggleBW() {
    this.bw = !this.bw;
    return this.bw;
  }

  render(dt) {
    const u = this.grade.uniforms;
    u.uTime.value += dt;
    u.uPunch.value = this.punchV;
    this.composer.render(dt);
    this.adapt(dt);
  }
}
