// Web Worker: gera malhas de corpo, cabeça e cabelo fora da thread principal.
import { buildBody, buildHead, buildHair } from './humanoid.js';

const JOBS = { body: buildBody, head: buildHead, hair: buildHair };

self.onmessage = (e) => {
  const { kind, args } = e.data;
  const r = JOBS[kind](...args);
  self.postMessage(r, Object.values(r.arrays).map((a) => a.buffer));
};
