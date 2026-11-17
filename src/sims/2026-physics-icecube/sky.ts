// 5장: 하늘 지도 모델. 사건은 모두 가상 데이터이고, NGC 1068 이야기의 흐름만 흉내 낸다.
import { TAU } from '../canvas';
import { angDist, gauss, poissonTail, pToSigma, rng } from './model';

export const DEC_MIN = -5; // 지구를 필터로 쓰므로 북쪽 하늘(위로 올라오는 사건)만 본다
export const DEC_MAX = 90;
export const YEARS = [2011, 2020] as const;
export const NGC1068 = { ra: 40.67, dec: -0.01 };

export interface SkyEvent {
  ra: number;
  dec: number;
  year: number;
  src: boolean; // 원천에서 온 사건 (화면에는 드러내지 않음)
  // 원천 사건은 오차 방향을 저장해 두고 재구성 방법에 따라 퍼짐만 바꾼다
  ux?: number;
  uy?: number;
}

export interface Sky {
  events: SkyEvent[];
  source: { ra: number; dec: number };
  nBg: number;
}

/** 재구성 방법에 따른 각 오차 (도) */
export const PSF = { old: 2.2, new: 1.0 } as const;
export type Method = keyof typeof PSF;

const SKY_AREA = TAU * (1 - Math.sin((DEC_MIN * Math.PI) / 180)); // 스테라디안

export function makeSky(seed: number, source: { ra: number; dec: number }, nBg = 6000, nSrc = 12): Sky {
  const r = rng(seed);
  const events: SkyEvent[] = [];
  const s0 = Math.sin((DEC_MIN * Math.PI) / 180);
  const year = () => YEARS[0] + Math.floor(r() * (YEARS[1] - YEARS[0] + 1));
  for (let i = 0; i < nBg; i++) {
    const dec = (Math.asin(s0 + r() * (1 - s0)) * 180) / Math.PI; // 구면에 고르게
    events.push({ ra: r() * 360, dec, year: year(), src: false });
  }
  for (let i = 0; i < nSrc; i++) events.push({ ra: 0, dec: 0, year: year(), src: true, ux: gauss(r), uy: gauss(r) });
  return { events, source, nBg };
}

/** 원천 사건의 위치는 재구성 방법의 오차만큼 퍼진다 */
export function position(e: SkyEvent, sky: Sky, m: Method): { ra: number; dec: number } {
  if (!e.src) return e;
  const dec = sky.source.dec + (e.uy ?? 0) * PSF[m];
  const ra = sky.source.ra + ((e.ux ?? 0) * PSF[m]) / Math.max(0.2, Math.cos((sky.source.dec * Math.PI) / 180));
  return { ra: (ra + 360) % 360, dec };
}

export interface Search {
  n: number; // 원 안 사건 수
  b: number; // 배경만 있을 때 기대 수
  p: number; // 우연히 n 개 이상일 확률
  sigma: number;
}

export function search(sky: Sky, m: Method, upTo: number, ra: number, dec: number, radius: number): Search {
  let n = 0;
  let years = 0;
  for (const e of sky.events) {
    if (e.year > upTo) continue;
    const p = position(e, sky, m);
    if (angDist(ra, dec, p.ra, p.dec) <= radius) n++;
  }
  years = upTo - YEARS[0] + 1;
  const total = YEARS[1] - YEARS[0] + 1;
  const cap = TAU * (1 - Math.cos((radius * Math.PI) / 180));
  const b = ((sky.nBg * years) / total) * (cap / SKY_AREA);
  const p = poissonTail(n, b);
  return { n, b, p, sigma: pToSigma(p) };
}

/** 여러 곳을 찾아보면 그중 하나가 우연히 몰릴 확률이 커진다: 1 - (1 - p)^k */
export function trialCorrected(p: number, trials: number): number {
  return 1 - Math.pow(1 - p, Math.max(1, trials));
}
