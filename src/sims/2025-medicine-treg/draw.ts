// 2025 생리의학 체험에서 함께 쓰는 그림: 명찰을 단 T세포, 장기, 생쥐
import { TAU, alpha, text, type Palette } from '../canvas';
import { drawSprite, loadSprite } from '../2026-medicine-optogenetics/sprite';
import mouseUrl from '../2026-medicine-optogenetics/mouse.png';
import type { Box } from '../2026-medicine-optogenetics/draw';
import type { Organ } from './model';

export { axes, caption, dot, type Axes } from '../2025-physics-tunneling/draw';
export { dial, dialHit, dialValue, inBox, trace, type Box, type Dial } from '../2026-medicine-optogenetics/draw';

const MOUSE = loadSprite(mouseUrl);

/** 오른쪽을 보는 생쥐. ok 가 false 면 아직 그림을 불러오는 중 */
export function mouse(c: CanvasRenderingContext2D, pal: Palette, b: Box, o: { color?: string; alpha?: number } = {}): boolean {
  const r = Math.min(b.w / 1.6, b.h);
  return drawSprite(c, MOUSE, b.x + (b.w - r * 1.6) / 2, b.y + (b.h - r) / 2, r * 1.6, r, { color: o.color ?? pal.ink, alpha: o.alpha });
}

/** 명찰을 단 T세포 하나. tags 에 적은 글자가 세포 위에 붙는다 */
export function tcell(
  c: CanvasRenderingContext2D,
  pal: Palette,
  x: number,
  y: number,
  r: number,
  o: { tags?: string[]; col?: string; fill?: number; label?: string },
): void {
  const col = o.col ?? pal.red;
  c.save();
  c.strokeStyle = col;
  c.fillStyle = alpha(col, o.fill ?? 0.08);
  c.lineWidth = Math.max(1.6, r * 0.16);
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.stroke();
  // 핵
  c.fillStyle = alpha(col, 0.35);
  c.beginPath();
  c.arc(x - r * 0.12, y + r * 0.08, r * 0.38, 0, TAU);
  c.fill();
  // 명찰: 세포 위쪽에 짧은 자루로 매단 네모
  const tags = o.tags ?? [];
  const fs = Math.max(8, Math.min(11, r * 0.52));
  tags.forEach((t, i) => {
    const a = -Math.PI / 2 + (i - (tags.length - 1) / 2) * 1.5;
    const sx = x + Math.cos(a) * r;
    const sy = y + Math.sin(a) * r;
    const reach = r + r * (tags.length > 1 ? 0.95 : 0.55);
    const ex = x + Math.cos(a) * reach;
    const ey = y + Math.sin(a) * reach;
    c.strokeStyle = col;
    c.lineWidth = Math.max(1.2, r * 0.1);
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(ex, ey);
    c.stroke();
    const tw = c.measureText(t).width;
    const bw = Math.max(fs * 2.1, tw + fs * 0.7);
    const bh = fs * 1.5;
    c.fillStyle = pal.paper;
    c.strokeStyle = col;
    c.lineWidth = Math.max(1.2, r * 0.09);
    c.beginPath();
    c.rect(ex - bw / 2, ey - bh, bw, bh);
    c.fill();
    c.stroke();
    text(c, pal, t, ex, ey - bh * 0.32, { size: fs, align: 'center', color: pal.blue });
  });
  c.restore();
  if (o.label) text(c, pal, o.label, x, y + r + 14, { size: 11, align: 'center' });
}

/** 장기 그림 (위, 갑상샘, 난소). dmg 0~1 만큼 빨갛게 덧칠된다 */
export function organ(c: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, kind: Organ, dmg: number): void {
  c.save();
  c.strokeStyle = pal.ink;
  c.lineWidth = 2;
  c.fillStyle = alpha(pal.red, 0.12 + 0.55 * Math.max(0, Math.min(1, dmg)));
  c.beginPath();
  if (kind === 'stomach') {
    c.moveTo(x - r * 0.1, y - r);
    c.bezierCurveTo(x + r * 0.9, y - r * 0.8, x + r * 0.8, y + r * 0.7, x - r * 0.1, y + r);
    c.bezierCurveTo(x - r * 0.75, y + r * 0.95, x - r * 0.6, y - r * 0.2, x - r * 0.1, y - r);
  } else if (kind === 'thyroid') {
    c.moveTo(x, y - r * 0.2);
    c.bezierCurveTo(x - r * 0.3, y - r * 0.9, x - r, y - r * 0.5, x - r * 0.75, y + r * 0.45);
    c.bezierCurveTo(x - r * 0.55, y + r * 0.95, x, y + r * 0.5, x, y + r * 0.35);
    c.bezierCurveTo(x, y + r * 0.5, x + r * 0.55, y + r * 0.95, x + r * 0.75, y + r * 0.45);
    c.bezierCurveTo(x + r, y - r * 0.5, x + r * 0.3, y - r * 0.9, x, y - r * 0.2);
  } else {
    c.ellipse(x, y, r * 0.85, r * 0.65, -0.3, 0, TAU);
  }
  c.closePath();
  c.fill();
  c.stroke();
  // 공격받는 자리: 작은 점이 몰린다
  if (dmg > 0.12) {
    c.fillStyle = pal.red;
    const n = Math.round(dmg * 9);
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * TAU + 0.6;
      c.beginPath();
      c.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.4, Math.max(1.4, r * 0.075), 0, TAU);
      c.fill();
    }
  }
  c.restore();
}

/** 세포를 가려내는 장치 (깔때기와 두 갈래) */
export function sorter(c: CanvasRenderingContext2D, pal: Palette, b: Box, lit: number): void {
  c.save();
  c.strokeStyle = pal.red;
  c.lineWidth = 2.4;
  c.lineJoin = 'round';
  const { x, y, w, h } = b;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w * 0.6, y + h * 0.5);
  c.lineTo(x + w * 0.6, y + h);
  c.lineTo(x + w * 0.4, y + h);
  c.lineTo(x + w * 0.4, y + h * 0.5);
  c.closePath();
  c.stroke();
  c.strokeStyle = alpha(pal.red, 0.35 + 0.65 * lit);
  c.lineWidth = 2;
  c.setLineDash([4, 4]);
  c.beginPath();
  c.moveTo(x + w * 0.16, y + h * 0.26);
  c.lineTo(x + w * 0.84, y + h * 0.26);
  c.stroke();
  c.setLineDash([]);
  c.restore();
}
