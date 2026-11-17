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
