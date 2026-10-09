// Parâmetros globais do protótipo.

export const CJK_FONT =
  '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", "Hiragino Sans", "WenQuanYi Zen Hei", sans-serif';

export const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
