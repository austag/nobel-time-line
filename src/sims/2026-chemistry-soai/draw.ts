// 화학 체험에서 함께 쓰는 그림 도구: ee 계기판, 분자 구슬, 플라스크, 힌트 고리
import { TAU, alpha, clamp, text, type Palette } from '../canvas';

/** ee 를 사람이 읽는 말로: "R 쪽 80%", "반반" */
export function fmtEe(e: number, ko: boolean): string {
  if (e === 0) return ko ? '반반 (0%)' : 'Half and half (0%)';
  const side = e > 0 ? 'R' : 'S';
  return ko ? `${side} 쪽 ${fmtPct(e)}` : `${fmtPct(e)} ${side}`;
}

/** 치우침의 크기만 "80.0%" 처럼 */
export function fmtPct(e: number): string {
  const pct = Math.abs(e) * 100;
  if (pct === 0) return '0%';
  let s: string;
  if (pct < 0.01) s = String(Number(pct.toPrecision(1)));
  else if (pct < 1) s = pct.toFixed(2);
  else if (pct < 99) s = pct.toFixed(1);
  else {
    s = pct.toFixed(2);
    if (s === '100.00' && pct < 100) s = '99.99';
    if (pct >= 100) s = '100';
  }
  return `${s}%`;
}

export interface Gauge {
  cx: number;
  cy: number;
  r: number;
}

const angleOf = (e: number) => Math.PI / 2 - (clamp(e, -1, 1) * Math.PI) / 2;

/**
 * 반원 계기판. 왼쪽 끝은 S 100%, 가운데는 반반, 오른쪽 끝은 R 100%.
 * value 는 실제 바늘(파랑), pred 는 내 예상 바늘(점선).
 */
export function gauge(
  c: CanvasRenderingContext2D,
  pal: Palette,
  g: Gauge,
  o: { value?: number | null; pred?: number | null; label?: string; ko: boolean; showValue?: boolean },
): void {
  const { cx, cy, r } = g;
  c.save();
  // 바탕 호: 왼쪽은 빨강 기운, 오른쪽은 파랑 기운 (그림이라 빨강 사용 가능)
  c.lineWidth = Math.max(6, r * 0.14);
  c.lineCap = 'butt';
  c.strokeStyle = alpha(pal.red, 0.22);
  c.beginPath();
  c.arc(cx, cy, r, Math.PI, Math.PI * 1.5);
  c.stroke();
  c.strokeStyle = alpha(pal.blue, 0.22);
  c.beginPath();
  c.arc(cx, cy, r, Math.PI * 1.5, TAU);
  c.stroke();
  // 눈금
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.5;
  for (const e of [-1, -0.5, 0, 0.5, 1]) {
    const a = angleOf(e);
    const r1 = r + c.lineWidth * 0 + Math.max(6, r * 0.14) / 2;
    c.beginPath();
    c.moveTo(cx + r1 * Math.cos(a), cy - r1 * Math.sin(a));
    c.lineTo(cx + (r1 + 6) * Math.cos(a), cy - (r1 + 6) * Math.sin(a));
    c.stroke();
  }
  const fs = r < 50 ? 11 : 13;
  text(c, pal, 'S', cx - r - 4, cy + fs + 4, { size: fs, align: 'center' });
  text(c, pal, 'R', cx + r + 4, cy + fs + 4, { size: fs, align: 'center' });
  text(c, pal, o.ko ? '반반' : '50:50', cx, cy - r - Math.max(6, r * 0.14) / 2 - 10, { size: fs, align: 'center' });
  // 예상 바늘
  if (o.pred != null) {
    const a = angleOf(o.pred);
    c.strokeStyle = alpha(pal.ink, 0.6);
    c.lineWidth = 2.5;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + r * 0.92 * Math.cos(a), cy - r * 0.92 * Math.sin(a));
    c.stroke();
    c.setLineDash([]);
  }
  // 실제 바늘
  if (o.value != null) {
    const a = angleOf(o.value);
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
  if (o.label) text(c, pal, o.label, cx, cy + fs + 22, { size: fs + 1, align: 'center', title: true });
  if (o.showValue !== false && o.value != null) text(c, pal, fmtEe(o.value, o.ko), cx, cy + fs + (o.label ? 40 : 22), { size: fs + 1, align: 'center', color: pal.blue });
  c.restore();
}

/** 계기판 위를 눌렀는지, 눌렀다면 그 자리의 ee */
export function gaugeHit(g: Gauge, x: number, y: number): number | null {
  const dx = x - g.cx;
  const dy = g.cy - y;
  const d = Math.hypot(dx, dy);
  if (d > g.r * 1.35 || d < g.r * 0.15 || dy < -12) return null;
  return gaugeValue(g, x, y);
}

export function gaugeValue(g: Gauge, x: number, y: number): number {
  const a = Math.atan2(Math.max(0, g.cy - y), x - g.cx); // 0 ~ π
  return clamp((Math.PI / 2 - a) / (Math.PI / 2), -1, 1);
}

/** 분자 구슬. R 은 꽉 찬 파랑 원, S 는 가운데가 빈 빨강 원 (색을 못 봐도 구별되게) */
export function bead(c: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, side: 1 | -1, dim = 1): void {
  c.save();
  c.globalAlpha = dim;
  if (side > 0) {
    c.fillStyle = pal.blue;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  } else {
    c.strokeStyle = pal.red;
    c.lineWidth = Math.max(1.5, r * 0.55);
    c.beginPath();
    c.arc(x, y, r * 0.72, 0, TAU);
    c.stroke();
  }
  c.restore();
}

/** 삼각 플라스크. 안쪽 액체 영역(사다리꼴)을 돌려준다 */
export function flask(
  c: CanvasRenderingContext2D,
  pal: Palette,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: { level: number; mixR: number | null },
): { top: number; bottom: number; left: (yy: number) => number; right: (yy: number) => number } {
  const neckW = w * 0.32;
  const neckH = h * 0.28;
  const cx = x + w / 2;
  const top = y + neckH;
  const bottom = y + h;
  const left = (yy: number) => cx - neckW / 2 - ((yy - top) / (bottom - top)) * (w / 2 - neckW / 2);
  const right = (yy: number) => 2 * cx - left(yy);
  c.save();
  if (fill && fill.level > 0) {
    const ly = bottom - (bottom - top) * clamp(fill.level, 0, 1);
    c.beginPath();
    c.moveTo(left(ly), ly);
    c.lineTo(right(ly), ly);
    c.lineTo(right(bottom), bottom);
    c.lineTo(left(bottom), bottom);
    c.closePath();
    if (fill.mixR == null) c.fillStyle = alpha(pal.ink, 0.08);
    else {
      // R 비율에 따라 파랑과 빨강을 섞은 옅은 색
      const t = fill.mixR;
      c.fillStyle = alpha(pal.blue, 0.32 * t);
      c.fill();
      c.fillStyle = alpha(pal.red, 0.32 * (1 - t));
    }
    c.fill();
  }
  c.strokeStyle = pal.ink;
  c.lineWidth = 2;
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(cx - neckW / 2 - 4, y);
  c.lineTo(cx - neckW / 2, y);
  c.lineTo(cx - neckW / 2, top);
  c.lineTo(left(bottom), bottom);
  c.lineTo(right(bottom), bottom);
  c.lineTo(cx + neckW / 2, top);
  c.lineTo(cx + neckW / 2, y);
  c.lineTo(cx + neckW / 2 + 4, y);
  c.stroke();
  c.restore();
  return { top, bottom, left, right };
}

/** 다음에 만질 곳을 알려 주는 깜빡이는 고리 */
export function pulse(c: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, t: number): void {
  const k = (Math.sin(t * 4) + 1) / 2;
  c.save();
  c.strokeStyle = alpha(pal.blue, 0.25 + 0.45 * k);
  c.lineWidth = 3;
  c.setLineDash([6, 6]);
  c.beginPath();
  c.arc(x, y, r + 4 * k, 0, TAU);
  c.stroke();
  c.restore();
}

/** 짧은 안내 문장 (캔버스 위쪽) */
export function caption(c: CanvasRenderingContext2D, pal: Palette, s: string, x: number, y: number, maxW: number, size = 15): number {
  c.save();
  c.font = `${size}px ${pal.body}`;
  const words = s.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (c.measureText(t).width > maxW && line) {
      text(c, pal, line, x, yy, { size });
      line = w;
      yy += size + 6;
    } else line = t;
  }
  if (line) text(c, pal, line, x, yy, { size });
  c.restore();
  return yy + size + 6;
}
