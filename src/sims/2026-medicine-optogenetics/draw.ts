// 광유전학 체험에서 함께 쓰는 그림 도구: 예상 계기판, 흐르는 그래프, 조류, 알, 신경세포
import { TAU, alpha, clamp, text, type Palette } from '../canvas';
export { caption, pulse } from '../2026-chemistry-soai/draw';

export interface Dial {
  cx: number;
  cy: number;
  r: number;
  min: number;
  max: number;
  log?: boolean;
  ticks: number[];
  fmt: (v: number) => string;
}

const frac = (d: Dial, v: number) => {
  const x = clamp(v, d.min, d.max);
  return d.log ? Math.log(x / d.min) / Math.log(d.max / d.min) : (x - d.min) / (d.max - d.min);
};
const ang = (d: Dial, v: number) => Math.PI - frac(d, v) * Math.PI;

/** 반원 계기판. value 는 실제 바늘(파랑), pred 는 내 예상 바늘(점선) */
export function dial(c: CanvasRenderingContext2D, pal: Palette, d: Dial, o: { value?: number | null; pred?: number | null; label?: string; showValue?: boolean }): void {
  const { cx, cy, r } = d;
  const lw = Math.max(6, r * 0.13);
  c.save();
  c.lineWidth = lw;
  c.strokeStyle = alpha(pal.blue, 0.18);
  c.beginPath();
  c.arc(cx, cy, r, Math.PI, TAU);
  c.stroke();
  const fs = r < 50 ? 10 : 12;
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.5;
  for (const t of d.ticks) {
    const a = ang(d, t);
    const r1 = r + lw / 2;
    c.beginPath();
    c.moveTo(cx + r1 * Math.cos(a), cy - r1 * Math.sin(a));
    c.lineTo(cx + (r1 + 5) * Math.cos(a), cy - (r1 + 5) * Math.sin(a));
    c.stroke();
    text(c, pal, d.fmt(t), cx + (r1 + 14) * Math.cos(a), cy - (r1 + 14) * Math.sin(a) + 4, { size: fs, align: 'center' });
  }
  if (o.pred != null) {
    const a = ang(d, o.pred);
    c.strokeStyle = alpha(pal.ink, 0.6);
    c.lineWidth = 2.5;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + r * 0.92 * Math.cos(a), cy - r * 0.92 * Math.sin(a));
    c.stroke();
    c.setLineDash([]);
  }
  if (o.value != null) {
    const a = ang(d, o.value);
    c.strokeStyle = pal.blue;
    c.lineWidth = 3.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + r * 0.95 * Math.cos(a), cy - r * 0.95 * Math.sin(a));
    c.stroke();
  }
  c.fillStyle = pal.ink;
  c.beginPath();
  c.arc(cx, cy, 4.5, 0, TAU);
  c.fill();
  if (o.label) text(c, pal, o.label, cx, cy + fs + 12, { size: fs + 1, align: 'center', title: true });
  if (o.showValue !== false && o.value != null) text(c, pal, d.fmt(o.value), cx, cy + fs + (o.label ? 30 : 12), { size: fs + 1, align: 'center', color: pal.blue });
  c.restore();
}

/** 계기판 근처를 눌렀다면 그 자리의 값 */
export function dialHit(d: Dial, x: number, y: number): number | null {
  const dx = x - d.cx;
  const dy = d.cy - y;
  const r = Math.hypot(dx, dy);
  if (r > d.r * 1.4 || r < d.r * 0.15 || dy < -14) return null;
  return dialValue(d, x, y);
}

export function dialValue(d: Dial, x: number, y: number): number {
  const a = Math.atan2(Math.max(0, d.cy - y), x - d.cx);
  const f = clamp(1 - a / Math.PI, 0, 1);
  return d.log ? d.min * (d.max / d.min) ** f : d.min + f * (d.max - d.min);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inBox = (b: Box, x: number, y: number, pad = 0) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;

/** 흐르는 그래프 틀과 선. ys 는 0~1 사이 값(아래가 0) */
export function trace(c: CanvasRenderingContext2D, pal: Palette, b: Box, ys: number[], o: { col?: string; label?: string; zero?: number; lw?: number; frame?: boolean } = {}): void {
  c.save();
  if (o.frame !== false) {
    c.strokeStyle = alpha(pal.ink, 0.45);
    c.lineWidth = 1;
    c.strokeRect(b.x, b.y, b.w, b.h);
  }
  if (o.zero != null) {
    c.strokeStyle = alpha(pal.ink, 0.3);
    c.setLineDash([3, 4]);
    c.beginPath();
    c.moveTo(b.x, b.y + b.h * (1 - o.zero));
    c.lineTo(b.x + b.w, b.y + b.h * (1 - o.zero));
    c.stroke();
    c.setLineDash([]);
  }
  if (ys.length > 1) {
    c.strokeStyle = o.col ?? pal.blue;
    c.lineWidth = o.lw ?? 2;
    c.lineJoin = 'round';
    c.beginPath();
    ys.forEach((y, i) => {
      const xx = b.x + (i / (ys.length - 1)) * b.w;
      const yy = b.y + b.h * (1 - clamp(y, 0, 1));
      if (i === 0) c.moveTo(xx, yy);
      else c.lineTo(xx, yy);
    });
    c.stroke();
  }
  if (o.label) text(c, pal, o.label, b.x + 4, b.y - 6, { size: 11 });
  c.restore();
}

/** 클라미도모나스: 둥근 몸, 빨간 눈점, 편모 두 개 */
export function alga(c: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, heading: number, beat: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(heading);
  // 편모: 앞쪽(+x)으로 뻗어 평영하듯 젓는다
  c.strokeStyle = alpha(pal.ink, 0.7);
  c.lineWidth = Math.max(1, r * 0.14);
  const s = Math.sin(beat);
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(r * 0.9, side * r * 0.15);
    c.quadraticCurveTo(r * 1.8, side * r * (0.4 + 0.5 * s), r * 2.1, side * r * (1.2 + 0.5 * s));
    c.stroke();
  }
  c.fillStyle = alpha(pal.blue, 0.22);
  c.strokeStyle = pal.blue;
  c.lineWidth = Math.max(1.2, r * 0.16);
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.82, 0, 0, TAU);
  c.fill();
  c.stroke();
  // 눈점 (그림이라 빨강)
  c.fillStyle = pal.red;
  c.beginPath();
  c.arc(r * 0.15, -r * 0.55, Math.max(1.2, r * 0.2), 0, TAU);
  c.fill();
  c.restore();
}

/** 개구리 알: 위쪽 반은 짙고 아래쪽 반은 옅은 공. channels 0~1 은 막 위 문의 개수, open 은 열린 정도 */
export function egg(c: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, channels: number, open: number, hue: string | null): void {
  c.save();
  if (hue && open > 0.02) {
    c.fillStyle = alpha(hue, 0.12 + 0.2 * open);
    c.beginPath();
    c.arc(x, y, r * 1.35, 0, TAU);
    c.fill();
  }
  c.fillStyle = alpha(pal.ink, 0.08);
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.fillStyle = alpha(pal.ink, 0.28);
  c.beginPath();
  c.arc(x, y, r, Math.PI, TAU);
  c.closePath();
  c.fill();
  c.strokeStyle = pal.ink;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.stroke();
  const n = Math.round(channels * 22);
  for (let i = 0; i < n; i++) {
    const a = (i / 22) * TAU + 0.1;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    c.fillStyle = open > 0.3 ? pal.blue : alpha(pal.blue, 0.55);
    c.beginPath();
    c.arc(px, py, Math.max(2, r * 0.06), 0, TAU);
    c.fill();
  }
  c.restore();
}

/** 신경세포 하나: 몸, 가지돌기, 축삭. glow 0~1 은 발화 순간의 빛남 */
export function neuron(c: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, o: { chr: boolean; glow: number; dim?: boolean; seed?: number }): void {
  c.save();
  c.globalAlpha = o.dim ? 0.45 : 1;
  const k = o.seed ?? 0;
  c.strokeStyle = pal.ink;
  c.lineCap = 'round';
  c.lineWidth = Math.max(1.5, r * 0.16);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.6 + k;
    c.beginPath();
    c.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    c.quadraticCurveTo(x + r * 2 * Math.cos(a + 0.3), y + r * 2 * Math.sin(a + 0.3), x + r * 2.6 * Math.cos(a - 0.1), y + r * 2.6 * Math.sin(a - 0.1));
    c.stroke();
  }
  // 축삭
  c.beginPath();
  c.moveTo(x + r, y);
  c.bezierCurveTo(x + r * 3, y + r * 0.6, x + r * 4, y - r * 0.6, x + r * 5.5, y + r * 0.2);
  c.stroke();
  if (o.glow > 0.01) {
    c.fillStyle = alpha(pal.red, 0.45 * o.glow);
    c.beginPath();
    c.arc(x, y, r * (1.3 + o.glow * 0.8), 0, TAU);
    c.fill();
  }
  c.fillStyle = o.chr ? alpha(pal.blue, 0.3) : alpha(pal.ink, 0.1);
  c.strokeStyle = o.chr ? pal.blue : pal.ink;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.stroke();
  if (o.chr) {
    c.fillStyle = pal.blue;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      c.beginPath();
      c.arc(x + r * Math.cos(a), y + r * Math.sin(a), Math.max(1.5, r * 0.12), 0, TAU);
      c.fill();
    }
  }
  c.restore();
}

/** 위에서 비추는 원뿔 모양 빛 */
export function beam(c: CanvasRenderingContext2D, x: number, y0: number, y1: number, w0: number, w1: number, col: string, a: number): void {
  if (a <= 0.01) return;
  c.save();
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, alpha(col, 0.5 * a));
  g.addColorStop(1, alpha(col, 0.08 * a));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - w0 / 2, y0);
  c.lineTo(x + w0 / 2, y0);
  c.lineTo(x + w1 / 2, y1);
  c.lineTo(x - w1 / 2, y1);
  c.closePath();
  c.fill();
  c.restore();
}

/** 버튼 모양 사각형 (캔버스 안에서 누르는 곳) */
export function chip(c: CanvasRenderingContext2D, pal: Palette, b: Box, label: string, on = false, size = 13): void {
  c.save();
  c.fillStyle = on ? alpha(pal.blue, 0.18) : alpha(pal.surface || '#ffffff', 0.9);
  c.strokeStyle = on ? pal.blue : alpha(pal.ink, 0.5);
  c.lineWidth = on ? 2 : 1.3;
  c.beginPath();
  c.roundRect(b.x, b.y, b.w, b.h, 8);
  c.fill();
  c.stroke();
  c.restore();
  text(c, pal, label, b.x + b.w / 2, b.y + b.h / 2 + size * 0.36, { size, align: 'center', color: on ? pal.blue : pal.ink });
}
