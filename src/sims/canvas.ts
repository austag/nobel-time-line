// 캔버스 공통 도구. 색은 styles.css의 변수에서 읽어 노트 디자인과 맞춘다.
// 규칙: 글씨는 잉크색과 파란색만, 빨간색은 그림(빛, 강조 도형)에만 쓴다.

export const TAU = Math.PI * 2;
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Palette {
  paper: string;
  surface: string;
  ink: string;
  blue: string;
  red: string;
  grid: string;
  dark: boolean;
  body: string;
  title: string;
}

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const g = (n: string) => cs.getPropertyValue(n).trim();
  return {
    paper: g('--paper'),
    surface: g('--surface'),
    ink: g('--ink'),
    blue: g('--blue'),
    red: g('--red'),
    grid: g('--grid'),
    dark: document.documentElement.dataset.theme === 'dark',
    body: g('--body'),
    title: g('--title'),
  };
}

/** #RRGGBB 를 투명도가 있는 색으로 */
export function alpha(col: string, a: number): string {
  if (!col.startsWith('#') || col.length !== 7) return col;
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 두 #RRGGBB 색 사이를 섞는다 */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, clamp(t, 0, 1)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export interface Canvas {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  destroy(): void;
}

/** 감싸는 요소 크기에 맞춰 자동으로 크기가 바뀌는 캔버스 */
export function makeCanvas(wrap: HTMLElement, label: string): Canvas {
  const cv = document.createElement('canvas');
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', label);
  wrap.append(cv);
  const o: Canvas = { cv, ctx: cv.getContext('2d')!, w: 1, h: 1, destroy: () => {} };
  const fit = () => {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    o.w = Math.max(1, r.width);
    o.h = Math.max(1, r.height);
    cv.width = Math.round(o.w * dpr);
    cv.height = Math.round(o.h * dpr);
    o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(wrap);
  o.destroy = () => {
    ro.disconnect();
    cv.remove();
  };
  return o;
}

export function text(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  s: string,
  x: number,
  y: number,
  o: { color?: string; size?: number; align?: CanvasTextAlign; base?: CanvasTextBaseline; title?: boolean } = {},
): void {
  ctx.save();
  ctx.fillStyle = o.color ?? pal.ink;
  // 제목 글꼴에는 그리스 문자와 ° 같은 기호가 없어서, 그런 글자가 있으면 본문 글꼴로 쓴다.
  const plain = /^[\u0020-\u007e\uac00-\ud7a3\u3131-\u318e]*$/.test(s) && !/[°]/.test(s);
  ctx.font = `${o.size ?? 14}px ${o.title && plain ? pal.title : pal.body}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.base ?? 'alphabetic';
  ctx.fillText(s, x, y);
  ctx.restore();
}

export function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col: string, dashed = false): void {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 13 * Math.cos(a - 0.4), y2 - 13 * Math.sin(a - 0.4));
  ctx.lineTo(x2 - 13 * Math.cos(a + 0.4), y2 - 13 * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
/** 10의 거듭제곱 표기: pow10(7) → "10⁷" */
export function pow10(e: number): string {
  return '10' + String(e).split('').map((c) => SUP[c] ?? c).join('');
}
