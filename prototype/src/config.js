// Parâmetros globais do protótipo.

// Área jogável do beco (metros). Fora dela ficam paredes, adereços e carros.
export const ARENA = { minX: -7.2, maxX: 7.2, minZ: -6.2, maxZ: 6.2 };

export const CJK_FONT =
  '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Hiragino Sans", "WenQuanYi Zen Hei", sans-serif';

export const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
