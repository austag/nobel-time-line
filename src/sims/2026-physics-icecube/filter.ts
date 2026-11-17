// 3장: 거름 조건 모델. 실제 비율(대기 뮤온이 약 100만 배)은 화면에 담을 수 없어 줄였다.
import { gauss, rng } from './model';

export type Kind = 'noise' | 'muon' | 'atmnu' | 'astro';
export const KINDS: Kind[] = ['noise', 'muon', 'atmnu', 'astro'];

export interface Ev {
  kind: Kind;
  hits: number; // 켜진 센서 수
  cosRec: number; // 재구성한 방향의 cos(천정각): +1 위에서 내려옴, -1 아래에서 올라옴
  quality: number; // 재구성 품질 0~1
  logE: number; // 빛의 양으로 잰 에너지 (log10, GeV)
}

export interface Cuts {
  minHits: number;
  upOnly: boolean;
  minQuality: number;
  minLogE: number;
}

export const NO_CUTS: Cuts = { minHits: 0, upOnly: false, minQuality: 0, minLogE: 1 };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 한 묶음의 사건. 시뮬레이션과 실제 데이터는 씨앗값만 다르다. */
export function dataset(seed: number): Ev[] {
  const r = rng(seed);
  const out: Ev[] = [];
  const counts: Record<Kind, number> = { noise: 400, muon: 2000, atmnu: 80, astro: 14 };
  for (let i = 0; i < counts.noise; i++) {
    out.push({ kind: 'noise', hits: 2 + Math.floor(r() * 6), cosRec: r() * 2 - 1, quality: r() * 0.45, logE: 1.4 + r() * 1.1 });
  }
  for (let i = 0; i < counts.muon; i++) {
    const cosTrue = Math.sqrt(r()); // 위에서 내려오는 쪽에 몰림
    const bundle = r() < 0.03; // 뮤온 다발: 에너지가 높게 보인다
    const misreco = r() < 0.06; // 방향을 잘못 계산해 위로 올라오는 것처럼 보임
    const quality = misreco ? 0.1 + r() * 0.45 : clamp01(0.45 + r() * 0.55);
    out.push({
      kind: 'muon',
      hits: 6 + Math.floor(r() * 50),
      cosRec: misreco ? -(0.05 + r() * 0.9) : Math.max(-1, Math.min(1, cosTrue + gauss(r) * 0.06)),
      quality,
      logE: bundle ? 4 + r() * 1.6 : 2.6 + gauss(r) * 0.45,
    });
  }
  for (let i = 0; i < counts.atmnu; i++) {
    out.push({ kind: 'atmnu', hits: 8 + Math.floor(r() * 45), cosRec: r() * 2 - 1, quality: clamp01(0.5 + r() * 0.5), logE: 2.2 - Math.log(1 - r()) * 0.45 });
  }
  for (let i = 0; i < counts.astro; i++) {
    out.push({ kind: 'astro', hits: 30 + Math.floor(r() * 50), cosRec: r() * 2 - 1, quality: clamp01(0.55 + r() * 0.45), logE: 4.6 + r() * 1.8 });
  }
  return out;
}

export function passes(e: Ev, c: Cuts): boolean {
  return e.hits >= c.minHits && (!c.upOnly || e.cosRec < 0) && e.quality >= c.minQuality && e.logE >= c.minLogE;
}

export interface Tally {
  total: number;
  kept: Record<Kind, number>;
  all: Record<Kind, number>;
  keptTotal: number;
  purity: number; // 남은 사건 중 우주 중성미자 비율
  efficiency: number; // 우주 중성미자 중 살아남은 비율
}

export function tally(evs: Ev[], c: Cuts): Tally {
  const kept = { noise: 0, muon: 0, atmnu: 0, astro: 0 };
  const all = { noise: 0, muon: 0, atmnu: 0, astro: 0 };
  for (const e of evs) {
    all[e.kind]++;
    if (passes(e, c)) kept[e.kind]++;
  }
  const keptTotal = kept.noise + kept.muon + kept.atmnu + kept.astro;
  return {
    total: evs.length,
    kept,
    all,
    keptTotal,
    purity: keptTotal ? kept.astro / keptTotal : 0,
    efficiency: all.astro ? kept.astro / all.astro : 0,
  };
}
