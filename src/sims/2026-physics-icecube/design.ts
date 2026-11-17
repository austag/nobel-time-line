// 2장: 검출기 설계 모델. 단위는 미터.
import { TAU } from '../canvas';
import { rng } from './model';

export const WIDTH = 1000; // 검출기를 놓을 수 있는 가로 폭
export const ICE_TOP = 1200; // 화면에 그리는 깊이 범위
export const ICE_BOTTOM = 2700;
export const BUDGET = 200; // 센서 예산
export const DUST = [2000, 2100] as const;
export const BUBBLES = 1400; // 이보다 얕으면 공기 방울이 남아 빛이 흩어진다
export const HIT_MIN = 6; // 센서가 이만큼 켜져야 사건으로 기록

export interface Design {
  strings: number;
  top: number;
  length: number;
  absorption: boolean;
  scattering: boolean;
}

export interface Sensor {
  x: number;
  z: number; // 깊이
}

export interface Track {
  x: number; // 시작점
  z: number;
  ang: number;
  len: number; // 얼음 속을 지나는 길이
}

/** 깊이별 빛이 약해지는 길이 (흡수 길이를 단순화). 실제 남극 얼음의 대략적인 모양을 따른다. */
export function attenuation(z: number): number {
  const ramp = (a: number, b: number, lo: number, hi: number) => lo + (hi - lo) * Math.min(1, Math.max(0, (z - a) / (b - a)));
  if (z < BUBBLES) return ramp(1200, BUBBLES, 6, 20);
  if (z < DUST[0] - 30) return ramp(BUBBLES, BUBBLES + 60, 20, 110);
  if (z < DUST[0]) return ramp(DUST[0] - 30, DUST[0], 110, 30);
  if (z < DUST[1]) return 30;
  return ramp(DUST[1], DUST[1] + 40, 30, 200);
}

export function bottom(d: Design): number {
  return Math.min(ICE_BOTTOM, d.top + d.length);
}

export function sensors(d: Design): Sensor[] {
  const per = Math.floor(BUDGET / d.strings);
  const b = bottom(d);
  const out: Sensor[] = [];
  for (let i = 0; i < d.strings; i++) {
    const x = ((i + 0.5) * WIDTH) / d.strings;
    for (let j = 0; j < per; j++) out.push({ x, z: d.top + ((j + 0.5) * (b - d.top)) / per });
  }
  return out;
}

export function spacing(d: Design): { string: number; sensor: number; per: number } {
  const per = Math.floor(BUDGET / d.strings);
  return { string: WIDTH / d.strings, sensor: (bottom(d) - d.top) / per, per };
}

/** 같은 시험 사건 묶음 (설계를 바꿔도 같은 사건으로 비교) */
export function testTracks(count = 100, seed = 7): Track[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => ({ x: -100 + r() * (WIDTH + 200), z: 1250 + r() * 1400, ang: r() * TAU, len: 250 + r() * 450 }));
}

/** 센서 하나가 받는 빛의 양 (0~1). 흡수를 끄면 완전히 투명한 얼음으로 본다. */
export function light(s: Sensor, t: Track, d: Design): number {
  const dx = Math.cos(t.ang);
  const dz = Math.sin(t.ang);
  // 선분까지의 거리
  const along = Math.min(t.len, Math.max(0, (s.x - t.x) * dx + (s.z - t.z) * dz));
  const dist = Math.hypot(s.x - (t.x + dx * along), s.z - (t.z + dz * along));
  let lam = d.absorption ? attenuation(s.z) : 1e6;
  if (d.scattering) lam *= 0.55;
  return (Math.exp(-dist / lam) * 30) / (dist + 30);
}

export const HIT_LIGHT = 0.15;

export function hitsFor(t: Track, ss: Sensor[], d: Design): number[] {
  const out: number[] = [];
  ss.forEach((s, i) => {
    if (light(s, t, d) > HIT_LIGHT) out.push(i);
  });
  return out;
}

export function detectionRate(d: Design, tracks: Track[]): number {
  const ss = sensors(d);
  let n = 0;
  for (const t of tracks) if (hitsFor(t, ss, d).length >= HIT_MIN) n++;
  return n / tracks.length;
}
