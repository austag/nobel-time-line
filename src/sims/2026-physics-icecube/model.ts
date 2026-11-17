// 2026 물리학: IceCube 계산 로직 (화면과 분리, 테스트 대상)
// 단위: 길이는 센서 간격 1칸, 시간은 (1칸) / c, 빛의 속도 c = 1
import { TAU } from '../canvas';

export const COLS = 10;
export const ROWS = 6;

export interface Point {
  x: number;
  y: number;
}
export interface IceEvent {
  p0: Point; // 검출기에 들어온 점
  d: Point; // 단위 방향 벡터
  L: number; // 검출기 안에서 지나는 거리
  ang: number; // 방향 각도 (라디안)
}
export interface Hit {
  t: number; // 첫 빛이 도착한 시간
  amp: number; // 받은 빛의 양 (0~1)
}

export function sensors(): Point[] {
  const a: Point[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) a.push({ x: c + 0.5, y: r + 0.5 });
  return a;
}

/** 체렌코프 각: cos θc = 1 / (nβ). nβ ≤ 1 이면 빛이 나오지 않아 null */
export function cherenkovAngle(n: number, beta: number): number | null {
  const v = n * beta;
  return v > 1 ? Math.acos(1 / v) : null;
}

/** 검출기 상자를 가로지르는 무작위 직선 궤적 */
export function makeEvent(rand: () => number = Math.random): IceEvent {
  const ang = rand() * TAU;
  const d = { x: Math.cos(ang), y: Math.sin(ang) };
  const cx = COLS / 2 + (rand() - 0.5) * 4;
  const cy = ROWS / 2 + (rand() - 0.5) * 2.4;
  let tmin = -1e9;
  let tmax = 1e9;
  for (const [p, dd, hi] of [
    [cx, d.x, COLS],
    [cy, d.y, ROWS],
  ] as const) {
    if (Math.abs(dd) < 1e-9) continue;
    let a = (0 - p) / dd;
    let b = (hi - p) / dd;
    if (a > b) [a, b] = [b, a];
    tmin = Math.max(tmin, a);
    tmax = Math.min(tmax, b);
  }
  return { p0: { x: cx + d.x * tmin, y: cy + d.y * tmin }, d, L: tmax - tmin, ang };
}

/**
 * 센서마다 첫 빛 도착 시간과 세기.
 * 도착 시간 = 입자가 방출점까지 간 시간 + 방출점에서 센서까지 거리 / (c/n)
 * 빛의 양은 프랑크-탐 공식의 sin²θc 에 비례하고, 거리에 따라 줄어든다.
 */
export function hits(ev: IceEvent, n: number, beta: number, list: Point[]): (Hit | null)[] {
  const th = cherenkovAngle(n, beta);
  if (th == null) return list.map(() => null);
  const tanT = Math.tan(th);
  const sinT = Math.sin(th);
  const yieldF = sinT ** 2;
  return list.map((s) => {
    const rx = s.x - ev.p0.x;
    const ry = s.y - ev.p0.y;
    const along = rx * ev.d.x + ry * ev.d.y;
    const perp = Math.abs(rx * ev.d.y - ry * ev.d.x);
    const xe = along - perp / tanT; // 이 센서로 가는 빛이 나온 지점
    if (xe < 0 || xe > ev.L) return null;
    const path = perp / sinT;
    const amp = (yieldF * Math.exp(-path / 2.2)) / (0.4 + path * 0.4);
    if (amp < 0.05) return null;
    return { t: xe / beta + path * n, amp: Math.min(1, amp * 1.6) };
  });
}

/** 두 방향 사이의 각도 차이 (도, 0~180) */
export function angleError(a: number, b: number): number {
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return (d * 180) / Math.PI;
}

/** 5라운드 평균 오차로 점수 (0~100) */
export function score(errors: number[]): number {
  const mean = errors.reduce((x, y) => x + y, 0) / errors.length;
  return Math.max(0, Math.round(100 - mean));
}

/* ---------- 공통: 재현 가능한 난수 ---------- */

/** 씨앗값이 같으면 같은 수열을 주는 난수 (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 표준정규분포 난수 (박스-뮬러) */
export function gauss(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand());
}

/* ---------- 4장: 방향 재구성 ---------- */

export interface TimedHit {
  x: number;
  y: number;
  t: number;
  w: number; // 가중치 (빛의 양)
}

/** 센서 목록과 hits 결과를 묶는다 */
export function timedHits(list: Point[], hs: (Hit | null)[]): TimedHit[] {
  const out: TimedHit[] = [];
  hs.forEach((hh, i) => {
    if (hh) out.push({ x: list[i].x, y: list[i].y, t: hh.t, w: hh.amp });
  });
  return out;
}

/**
 * 직선 맞춤 (IceCube 의 LineFit): 센서 위치 x_i 가 시간 t_i 에 대해 x = c + v t 로 움직인다고 보고
 * 최소제곱으로 v 를 구한다. v = (<x t> - <x><t>) / (<t²> - <t>²)
 */
export function lineFit(hs: TimedHit[]): { ang: number; speed: number; c: Point } | null {
  if (hs.length < 2) return null;
  let W = 0, mt = 0, mx = 0, my = 0, mtt = 0, mxt = 0, myt = 0;
  for (const p of hs) {
    W += p.w;
    mt += p.w * p.t;
    mx += p.w * p.x;
    my += p.w * p.y;
    mtt += p.w * p.t * p.t;
    mxt += p.w * p.x * p.t;
    myt += p.w * p.y * p.t;
  }
  mt /= W; mx /= W; my /= W; mtt /= W; mxt /= W; myt /= W;
  const vt = mtt - mt * mt;
  if (vt < 1e-9) return null;
  const vx = (mxt - mx * mt) / vt;
  const vy = (myt - my * mt) / vt;
  return { ang: Math.atan2(vy, vx), speed: Math.hypot(vx, vy), c: { x: mx, y: my } };
}

/**
 * 직선 궤적 가설(방향 ang, 기준점 pivot 에서 수직으로 off 만큼 옮긴 선)에 대해
 * 각 센서의 예상 도착 시간과 실제 시간의 차이(잔차)를 구한다. 시간의 기준점은 평균으로 맞춘다.
 */
export function residuals(hs: TimedHit[], ang: number, pivot: Point, off: number, n: number): number[] {
  const th = cherenkovAngle(n, 1) ?? 0.7;
  const d = { x: Math.cos(ang), y: Math.sin(ang) };
  const p0 = { x: pivot.x - d.y * off, y: pivot.y + d.x * off };
  const exp = hs.map((s) => {
    const rx = s.x - p0.x;
    const ry = s.y - p0.y;
    const along = rx * d.x + ry * d.y;
    const perp = Math.abs(rx * d.y - ry * d.x);
    return along - perp / Math.tan(th) + (perp / Math.sin(th)) * n;
  });
  const diff = hs.map((s, i) => s.t - exp[i]);
  const mean = diff.reduce((a, b) => a + b, 0) / diff.length;
  return diff.map((x) => x - mean);
}

export function cost(hs: TimedHit[], ang: number, pivot: Point, off: number, n: number): number {
  const r = residuals(hs, ang, pivot, off, n);
  return r.reduce((a, x, i) => a + hs[i].w * x * x, 0);
}

/** 정밀 맞춤: 방향과 위치를 바꿔 가며 잔차 제곱합이 가장 작은 직선을 찾는다 */
export function bestFit(hs: TimedHit[], pivot: Point, n: number): { ang: number; off: number; cost: number } {
  let best = { ang: 0, off: 0, cost: Infinity };
  for (let i = 0; i < 180; i++) {
    const ang = (i / 180) * TAU;
    for (let k = -8; k <= 8; k++) {
      const off = k * 0.25;
      const c = cost(hs, ang, pivot, off, n);
      if (c < best.cost) best = { ang, off, cost: c };
    }
  }
  // 가장 좋은 곳 주변을 더 촘촘히
  const a0 = best.ang, o0 = best.off;
  for (let i = -20; i <= 20; i++) {
    for (let k = -5; k <= 5; k++) {
      const ang = a0 + i * 0.002 * 2;
      const off = o0 + k * 0.05;
      const c = cost(hs, ang, pivot, off, n);
      if (c < best.cost) best = { ang, off, cost: c };
    }
  }
  return best;
}

/**
 * 캐스케이드: 한 점에서 빛이 공처럼 퍼진다. 앞쪽(체렌코프 각 방향)으로 조금 더 밝을 뿐이라 방향 정보가 약하다.
 */
export function cascadeHits(pos: Point, ang: number, n: number, list: Point[]): (Hit | null)[] {
  const th = cherenkovAngle(n, 1) ?? 0.7;
  return list.map((s) => {
    const rx = s.x - pos.x;
    const ry = s.y - pos.y;
    const d = Math.hypot(rx, ry);
    const phi = Math.abs(Math.atan2(ry, rx) - ang) % TAU;
    const rel = Math.min(phi, TAU - phi); // 진행 방향과 센서 방향 사이 각
    const boost = 1 + 0.45 * Math.cos(rel - th);
    const amp = (boost * Math.exp(-d / 2.2)) / (0.4 + d * 0.4);
    if (amp < 0.06) return null;
    return { t: d * n, amp: Math.min(1, amp * 1.3) };
  });
}

/* ---------- 5장: 통계 ---------- */

/** 포아송 분포에서 기대값 b 일 때 n 개 이상 나올 확률 */
export function poissonTail(n: number, b: number): number {
  if (n <= 0) return 1;
  // 1 - P(N < n), 로그로 더해 큰 수에서도 안정적으로
  let term = Math.exp(-b);
  let sum = term;
  for (let k = 1; k < n; k++) {
    term *= b / k;
    sum += term;
  }
  return Math.max(0, 1 - sum);
}

/** 위꼬리 확률 p 를 정규분포의 몇 σ 에 해당하는지로 바꾼다 (Acklam 근사) */
export function pToSigma(p: number): number {
  if (p >= 0.5) return 0;
  const q = Math.max(p, 1e-300);
  const r = Math.sqrt(-2 * Math.log(q));
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  // Abramowitz-Stegun 26.2.23 (오차 4.5e-4) 를 한 번 다듬는다
  let z = r - (c[0] + c[1] * r + c[2] * r * r) / (1 + d[0] * r + d[1] * r * r + d[2] * r * r * r);
  for (let i = 0; i < 2; i++) {
    const tail = 0.5 * erfc(z / Math.SQRT2);
    const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(TAU);
    z += (tail - q) / pdf;
  }
  return z;
}

/** 상보 오차 함수 (Numerical Recipes erfcc, 상대 오차 1.2e-7) */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** 하늘 위 두 점 사이 각거리 (도) */
export function angDist(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const r = Math.PI / 180;
  const s =
    Math.sin(((dec2 - dec1) * r) / 2) ** 2 + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.sin(((ra2 - ra1) * r) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(s)))) / r;
}
