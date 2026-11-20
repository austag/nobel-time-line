// 거시 양자 터널링 체험에서 함께 쓰는 그림: 실험 회로, 회로 상태 그림, 그래프 틀
import { TAU, alpha, clamp, text, type Palette } from '../canvas';
import { potential } from './model';
import type { Box } from '../2026-medicine-optogenetics/draw';
export { caption, dial, dialHit, inBox, pulse, trace, type Box, type Dial } from '../2026-medicine-optogenetics/draw';

// ---------- 그래프 틀 ----------

export interface Axes {
  X: (v: number) => number;
  Y: (v: number) => number;
  b: Box;
}

export function axes(
  c: CanvasRenderingContext2D,
  pal: Palette,
  b: Box,
  o: { x0: number; x1: number; y0: number; y1: number; xt: number[]; yt: number[]; fx: (v: number) => string; fy: (v: number) => string; xl: string; yl: string; logY?: boolean },
): Axes {
  const fs = b.w < 260 ? 10 : 11;
  const X = (v: number) => b.x + ((v - o.x0) / (o.x1 - o.x0)) * b.w;
  const Y = o.logY
    ? (v: number) => b.y + b.h - ((Math.log10(Math.max(v, o.y0)) - Math.log10(o.y0)) / (Math.log10(o.y1) - Math.log10(o.y0))) * b.h
    : (v: number) => b.y + b.h - ((v - o.y0) / (o.y1 - o.y0)) * b.h;
  c.save();
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(b.x, b.y);
  c.lineTo(b.x, b.y + b.h);
  c.lineTo(b.x + b.w, b.y + b.h);
  c.stroke();
  c.lineWidth = 1;
  for (const t of o.xt) {
    const x = X(t);
    c.beginPath();
    c.moveTo(x, b.y + b.h);
    c.lineTo(x, b.y + b.h + 4);
    c.stroke();
    text(c, pal, o.fx(t), x, b.y + b.h + 16, { size: fs, align: 'center' });
  }
  for (const t of o.yt) {
    const y = Y(t);
    c.beginPath();
    c.moveTo(b.x - 4, y);
    c.lineTo(b.x, y);
    c.stroke();
    text(c, pal, o.fy(t), b.x - 7, y + 4, { size: fs, align: 'right' });
  }
  c.restore();
  text(c, pal, o.yl, b.x, b.y - 10, { size: fs + 1 });
  text(c, pal, o.xl, b.x + b.w, b.y + b.h + 32, { size: fs + 1, align: 'right' });
  return { X, Y, b };
}

export function dot(c: CanvasRenderingContext2D, pal: Palette, x: number, y: number, r: number, filled: boolean): void {
  c.save();
  c.strokeStyle = pal.red;
  c.fillStyle = pal.red;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  if (filled) c.fill();
  else c.stroke();
  c.restore();
}

// ---------- 실험 회로 ----------

/** 전류원 → 희석 냉동기 안 구리 차폐 속 조셉슨 접합 → 전압계 */
export function circuit(
  c: CanvasRenderingContext2D,
  pal: Palette,
  b: Box,
  o: { ko: boolean; shield: boolean; volt: number; current: number; tempMK: number; microwave?: boolean; t: number },
): void {
  const fs = b.w < 360 ? 10 : 12;
  const cy = b.y + b.h * 0.46;
  const srcX = b.x + b.w * 0.09;
  const mX = b.x + b.w * 0.91;
  const sr = Math.min(b.h * 0.16, b.w * 0.06);
  const fr = { x: b.x + b.w * 0.24, y: b.y + 18, w: b.w * 0.52, h: b.h - 30 };
  const sh = { x: fr.x + 10, y: fr.y + 18, w: fr.w - 20, h: fr.h - 30 };
  const jw = Math.min(sh.w * 0.34, 90);
  const jh = Math.min(sh.h * 0.4, 36);
  const jx = fr.x + fr.w / 2 - jw / 2;
  c.save();
  // 냉동기
  c.strokeStyle = pal.ink;
  c.lineWidth = 1.5;
  c.setLineDash([6, 5]);
  c.strokeRect(fr.x, fr.y, fr.w, fr.h);
  c.setLineDash([]);
  // 구리 차폐: 켜면 실선, 끄면 끊긴 선
  c.strokeStyle = pal.red;
  c.lineWidth = 2;
  if (!o.shield) c.setLineDash([4, 9]);
  c.strokeRect(sh.x, sh.y, sh.w, sh.h);
  c.setLineDash([]);
  // 전선
  c.strokeStyle = pal.red;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(srcX + sr, cy);
  c.lineTo(jx, cy);
  c.moveTo(jx + jw, cy);
  c.lineTo(mX, cy);
  c.lineTo(mX, cy + b.h * 0.18 - sr);
  c.stroke();
  // 잡음: 차폐가 꺼져 있으면 전선을 타고 들어오는 물결
  if (!o.shield) {
    c.strokeStyle = alpha(pal.red, 0.7);
    c.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const x0 = srcX + sr + 8 + ((o.t * 40 + k * 22) % Math.max(10, jx - srcX - sr - 30));
      c.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = x0 + i * 1.6;
        const y = cy - 9 + Math.sin(i * 1.4 + o.t * 12) * 4;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  }
  // 마이크로파 (3장)
  if (o.microwave) {
    c.strokeStyle = pal.red;
    c.lineWidth = 2;
    c.beginPath();
    const x0 = fr.x + fr.w / 2;
    for (let i = 0; i <= 30; i++) {
      const y = fr.y + 4 + i * ((cy - jh / 2 - fr.y - 8) / 30);
      const x = x0 + Math.sin(i * 0.9 - o.t * 14) * 5;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  // 접합: 초전도체 두 조각과 얇은 절연막
  c.fillStyle = alpha(pal.red, 0.12);
  c.strokeStyle = pal.red;
  c.lineWidth = 2.5;
  c.fillRect(jx, cy - jh / 2, jw, jh);
  c.strokeRect(jx, cy - jh / 2, jw, jh);
  c.fillStyle = alpha(pal.red, 0.45);
  c.fillRect(jx + jw / 2 - 3, cy - jh / 2, 6, jh);
  // 전류원
  c.beginPath();
  c.arc(srcX, cy, sr, 0, TAU);
  c.stroke();
  c.beginPath();
  c.moveTo(srcX, cy + sr * 0.6);
  c.lineTo(srcX, cy - sr * 0.6);
  c.moveTo(srcX - sr * 0.3, cy - sr * 0.25);
  c.lineTo(srcX, cy - sr * 0.6);
  c.lineTo(srcX + sr * 0.3, cy - sr * 0.25);
  c.stroke();
  // 전압계: 전압이 튀면 바늘이 넘어간다
  const vy = cy + b.h * 0.18;
  c.beginPath();
  c.arc(mX, vy, sr, 0, TAU);
  c.stroke();
  const a = -Math.PI / 2 - 0.9 + clamp(o.volt, 0, 1) * 1.8;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(mX, vy + sr * 0.4);
  c.lineTo(mX + Math.cos(a) * sr * 0.8, vy + sr * 0.4 + Math.sin(a) * sr * 0.8);
  c.stroke();
  c.restore();
  const ko = o.ko;
  text(c, pal, ko ? '전류원' : 'current source', srcX, cy + sr + 16, { size: fs, align: 'center' });
  text(c, pal, `${o.current.toFixed(2)} μA`, srcX, cy + sr + 30, { size: fs, align: 'center', color: pal.blue });
  text(c, pal, ko ? '조셉슨 접합' : 'Josephson junction', fr.x + fr.w / 2, cy + jh / 2 + 15, { size: fs, align: 'center' });
  text(c, pal, ko ? `희석 냉동기 ${Math.round(o.tempMK)} mK` : `dilution fridge ${Math.round(o.tempMK)} mK`, fr.x + 4, fr.y - 5, { size: fs });
  text(c, pal, o.shield ? (ko ? '구리 차폐' : 'copper shield') : ko ? '차폐 꺼짐' : 'shield off', b.w < 420 ? fr.x + fr.w : sh.x + sh.w - 4, b.w < 420 ? fr.y + fr.h + 13 : sh.y + fs + 2, { size: fs - 1, align: 'right', color: o.shield ? pal.ink : pal.blue });
  text(c, pal, ko ? '전압계' : 'voltmeter', mX, vy + sr + 15, { size: fs, align: 'center' });
  text(c, pal, o.volt > 0.5 ? (ko ? '전압 튐' : 'voltage!') : '0 V', mX, vy - sr - 6, { size: fs, align: 'center', color: pal.blue });
}

// ---------- 회로 상태 그림 ----------

/** 실제 벽은 아주 낮아서 그대로 그리면 보이지 않는다. 그림에서는 기울기를 보기 좋게 바꾼다 */
export function visTilt(s: number): number {
  if (s >= 1) return 1.08;
  return clamp(0.22 + (0.33 * (s - 0.94)) / 0.06, 0.22, 0.55);
}

export interface Well {
  dm: number; // 골짜기 바닥 δ
  dM: number; // 언덕 꼭대기 δ
  out: number; // 같은 높이로 벽을 지나 나오는 δ
}

export function well(sv: number): Well {
  const dm = Math.asin(Math.min(sv, 1));
  const dM = Math.PI - dm;
  const u = potential(dm, sv);
  let out = dM + 0.01;
  while (potential(out, sv) > u && out < dM + 6) out += 0.005;
  return { dm, dM, out };
}

export type Escape = { kind: 'heat' | 'tunnel'; t: number } | null;

/**
 * 위상차 δ에 따른 에너지 곡선과 공.
 * levels: 골짜기 안 준위 (0 = 바닥, 1 = 언덕 꼭대기 높이 비율), lit: 공이 있는 준위
 */
export function stateCurve(
  c: CanvasRenderingContext2D,
  pal: Palette,
  b: Box,
  o: { ko: boolean; s: number; vis?: number; zoom?: boolean; esc?: Escape; levels?: number[]; lit?: number; rolling?: number; label?: boolean; shake?: number; t: number },
): void {
  const sv = o.vis ?? visTilt(o.s);
  const d0 = -1.5;
  const d1 = o.zoom ? 4.8 : 5.8;
  const u0 = potential(d1, sv) - 0.4;
  const u1 = potential(d0, sv) + 0.6;
  const X = (d: number) => b.x + ((d - d0) / (d1 - d0)) * b.w;
  const Y = (u: number) => b.y + b.h - ((u - u0) / (u1 - u0)) * b.h;
  c.save();
  c.strokeStyle = pal.red;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  for (let d = d0; d <= d1; d += 0.04) {
    if (d === d0) c.moveTo(X(d), Y(potential(d, sv)));
    else c.lineTo(X(d), Y(potential(d, sv)));
  }
  c.stroke();
  const R = Math.max(6, Math.min(13, b.h * 0.06)) * (o.levels ? 0.7 : 1);
  const ballAt = (d: number, lift = 0) => ({ x: X(d), y: Y(potential(d, sv)) - R - lift });
  let pos: { x: number; y: number } | null = null;
  if (sv < 1) {
    const w = well(sv);
    const um = potential(w.dm, sv);
    const uM = potential(w.dM, sv);
    // 골짜기 안 준위
    if (o.levels) {
      o.levels.forEach((f, i) => {
        const u = um + f * (uM - um);
        // 그 높이에서 골짜기 양쪽 벽까지
        let l = w.dm;
        while (potential(l, sv) < u && l > d0) l -= 0.005;
        let r = w.dm;
        while (potential(r, sv) < u && r < w.dM) r += 0.005;
        c.strokeStyle = i === o.lit ? pal.blue : alpha(pal.blue, 0.45);
        c.lineWidth = i === o.lit ? 3 : 2;
        c.beginPath();
        c.moveTo(X(l), Y(u));
        c.lineTo(X(r), Y(u));
        c.stroke();
        text(c, pal, String(i), X(l) - 6, Y(u) + 4, { size: 11, align: 'right', color: pal.blue });
      });
    }
    if (o.esc) {
      const t = o.esc.t;
      if (o.esc.kind === 'heat') {
        // 흔들리다가 언덕을 넘어간다
        const d = t < 0.45 ? w.dm + Math.sin(t * 60) * 0.35 * (t / 0.45) : w.dm + ((t - 0.45) / 0.55) * (w.dM + 1.2 - w.dm);
        pos = ballAt(d);
      } else {
        // 같은 높이 그대로 벽을 지나간다
        const y0 = ballAt(w.dm).y;
        c.strokeStyle = pal.red;
        c.lineWidth = 2;
        c.setLineDash([5, 5]);
        c.beginPath();
        c.moveTo(X(w.dm) + R, y0);
        c.lineTo(X(w.out) - R, y0);
        c.stroke();
        c.setLineDash([]);
        if (t < 0.5) pos = { x: X(w.dm) + (X(w.out) - X(w.dm)) * (t / 0.5), y: y0 };
        else pos = ballAt(w.out + (t - 0.5) * 3);
      }
    } else if (o.rolling != null) pos = ballAt(o.rolling);
    else {
      let lift = 0;
      if (o.levels && o.lit != null) lift = (o.levels[o.lit] ?? 0) * (Y(um) - Y(uM));
      const sh = o.shake ? Math.sin(o.t * 40) * o.shake : 0;
      pos = ballAt(w.dm + sh, lift);
    }
    if (o.label) {
      const xr = X(w.dM) + 34;
      c.strokeStyle = pal.ink;
      c.lineWidth = 1;
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(X(w.dm), Y(um));
      c.lineTo(xr, Y(um));
      c.moveTo(X(w.dM), Y(uM));
      c.lineTo(xr, Y(uM));
      c.stroke();
      c.setLineDash([]);
      c.beginPath();
      c.moveTo(xr, Y(um));
      c.lineTo(xr, Y(uM));
      c.stroke();
      text(c, pal, 'ΔU', xr + 6, (Y(um) + Y(uM)) / 2 + 4, { size: 12 });
    }
  } else pos = ballAt(o.rolling ?? 2);
  if (pos) {
    c.fillStyle = pal.red;
    c.beginPath();
    c.arc(pos.x, pos.y, R, 0, TAU);
    c.fill();
  }
  c.restore();
  text(c, pal, o.ko ? '위상차 δ →' : 'phase difference δ →', b.x, b.y + b.h, { size: 11 });
  text(c, pal, o.ko ? '↑ 에너지' : '↑ energy', b.x, b.y + 2, { size: 11 });
}
