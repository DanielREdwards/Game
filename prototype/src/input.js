// Entrada unificada: teclado, mouse, controle (Gamepad API) e toque.

const KEYS = {
  KeyJ: 'attack', KeyK: 'counter', Space: 'dodge', KeyL: 'dodge', KeyF: 'finisher', KeyI: 'finisher',
  KeyH: 'heal', KeyE: 'pickup', KeyC: 'cinema', Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute', KeyR: 'restart', Enter: 'confirm',
};
// Botões no layout padrão de controle: 0 = A/✕, 1 = B/○, 2 = X/□, 3 = Y/△, 4 = LB, 5 = RB, 8 = Select, 9 = Start.
const PAD = { 0: 'dodge', 1: 'finisher', 2: 'attack', 3: 'counter', 4: 'heal', 5: 'pickup', 8: 'cinema', 9: 'pause' };
// Ações que podem ser "seguradas" (confronto): teclas, botão do mouse, botão do controle, botão de toque.
const HOLD = { counter: { keys: ['KeyK'], mouse: 2, pad: 3 } };

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.move = { x: 0, y: 0 };
    this.cam = 0;
    this.stick = { x: 0, y: 0 };
    this.padPrev = {};
    this.touchUI = false;
    this.mouseDown = new Set();
    this.touchHeld = new Set();
    this.padHeld = new Set();
    this.look = 0;
    this.locked = false;

    addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat && KEYS[e.code]) this.pressed.add(KEYS[e.code]);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouseDown.add(e.button);
      if (e.button === 0) this.pressed.add('attack');
      if (e.button === 2) this.pressed.add('counter');
      // primeira interação: trava o ponteiro para girar a câmera com o mouse
      if (this.wantLock && !this.locked && canvas.requestPointerLock) {
        try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* sem suporte */ }
      }
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.mouseDown.delete(e.button); });
    addEventListener('mousemove', (e) => { if (this.locked) this.look += e.movementX || 0; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && this.wantLock) this.pressed.add('unlock');
    });

    this.setupTouch();
  }

  setupTouch() {
    const pad = document.getElementById('touch');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    if (!pad || !stick) return;
    const show = () => {
      if (this.touchUI) return;
      this.touchUI = true;
      pad.hidden = false;
      document.body.classList.add('touch');
    };
    if (matchMedia('(pointer: coarse)').matches) show();
    addEventListener('touchstart', show, { passive: true });

    let id = null, ox = 0, oy = 0;
    const R = 46;
    stick.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      const r = stick.getBoundingClientRect();
      ox = r.left + r.width / 2;
      oy = r.top + r.height / 2;
      stick.setPointerCapture(id);
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / R;
      this.stick.y = -dy / R;
    };
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      this.stick.x = this.stick.y = 0;
    };
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    for (const b of pad.querySelectorAll('button[data-act]')) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.pressed.add(b.dataset.act);
        this.touchHeld.add(b.dataset.act);
        b.classList.add('on');
      });
      const off = () => { b.classList.remove('on'); this.touchHeld.delete(b.dataset.act); };
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
    }
    // arrastar na metade direita da tela gira a câmera
    const scene = document.getElementById('scene');
    let lid = null, lx = 0;
    scene.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || e.clientX < innerWidth * 0.4) return;
      lid = e.pointerId; lx = e.clientX;
    });
    scene.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      this.look += (e.clientX - lx) * 1.6;
      lx = e.clientX;
    });
    const lend = (e) => { if (e.pointerId === lid) lid = null; };
    scene.addEventListener('pointerup', lend);
    scene.addEventListener('pointercancel', lend);
  }

  // Ação mantida pressionada (teclado, mouse, controle ou toque).
  held(a) {
    const h = HOLD[a];
    if (!h) return false;
    return h.keys.some((k) => this.down.has(k)) || this.mouseDown.has(h.mouse) || this.padHeld.has(h.pad) || this.touchHeld.has(a);
  }

  update() {
    const k = this.down;
    let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let cam = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyQ') ? 1 : 0);
    x += this.stick.x;
    y += this.stick.y;
    let pads = [];
    try {
      // Em iframes sem permissão de "gamepad" o navegador lança SecurityError.
      pads = navigator.getGamepads ? navigator.getGamepads() : [];
    } catch {
      pads = [];
    }
    for (const p of pads) {
      if (!p) continue;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      x += dz(p.axes[0] || 0);
      y -= dz(p.axes[1] || 0);
      cam += dz(p.axes[2] || 0);
      for (const [i, act] of Object.entries(PAD)) {
        const on = !!(p.buttons[i] && p.buttons[i].pressed);
        const key = p.index + ':' + i;
        if (on && !this.padPrev[key]) this.pressed.add(act);
        if (on) this.padHeld.add(+i); else this.padHeld.delete(+i);
        this.padPrev[key] = on;
      }
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.x = x;
    this.move.y = y;
    this.cam = Math.max(-1, Math.min(1, cam));
  }

  take(a) {
    if (!this.pressed.has(a)) return false;
    this.pressed.delete(a);
    return true;
  }

  // Giro acumulado do mouse/toque desde a última leitura (em pixels).
  takeLook() {
    const v = this.look;
    this.look = 0;
    return v;
  }

  endFrame() {
    this.pressed.clear();
  }
}
