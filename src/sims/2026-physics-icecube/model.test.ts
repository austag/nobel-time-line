import { describe, expect, it } from 'vitest';
import { angleError, cherenkovAngle, hits, makeEvent, score, sensors } from './model';

describe('IceCube 모델', () => {
  it('nβ ≤ 1 이면 빛이 나오지 않는다', () => {
    expect(cherenkovAngle(1.31, 0.7)).toBeNull(); // 0.917
    expect(cherenkovAngle(1, 1)).toBeNull();
    const ev = makeEvent(() => 0.3);
    expect(hits(ev, 1.31, 0.7, sensors()).every((x) => x === null)).toBe(true);
  });

  it('얼음(n = 1.31), β = 0.99 에서 체렌코프 각은 약 39.6도', () => {
    const th = cherenkovAngle(1.31, 0.99)!;
    expect((th * 180) / Math.PI).toBeCloseTo(39.56, 1);
  });

  it('입자가 지나가는 방향을 따라 센서가 늦게 켜진다', () => {
    // 왼쪽에서 오른쪽으로 수평 이동
    const ev = { p0: { x: 0, y: 3 }, d: { x: 1, y: 0 }, L: 10, ang: 0 };
    const list = [
      { x: 2.5, y: 3.5 },
      { x: 7.5, y: 3.5 },
    ];
    const [a, b] = hits(ev, 1.31, 0.99, list);
    expect(a && b).toBeTruthy();
    expect(a!.t).toBeLessThan(b!.t);
  });

  it('무작위 궤적은 검출기를 가로지른다', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const ev = makeEvent(rand);
      expect(ev.L).toBeGreaterThan(0);
      expect(ev.p0.x).toBeGreaterThanOrEqual(-1e-6);
      expect(ev.p0.x).toBeLessThanOrEqual(10 + 1e-6);
    }
  });

  it('각도 오차와 점수', () => {
    expect(angleError(0.1, 2 * Math.PI - 0.1)).toBeCloseTo((0.2 * 180) / Math.PI);
    expect(angleError(0, Math.PI)).toBeCloseTo(180);
    expect(score([10, 20, 30, 40, 50])).toBe(70);
    expect(score([180, 180])).toBe(0);
  });
});

import * as D from './design';
import * as F from './filter';
import * as K from './sky';
import { bestFit, cascadeHits, lineFit, poissonTail, pToSigma, rng, timedHits } from './model';

describe('재구성', () => {
  it('직선 맞춤과 정밀 맞춤이 트랙 방향을 대체로 맞힌다', () => {
    const rand = rng(5);
    const list = sensors();
    const errs: number[] = [];
    const fine: number[] = [];
    for (let i = 0; i < 30; i++) {
      const ev = makeEvent(rand);
      const th = timedHits(list, hits(ev, 1.31, 0.99, list));
      const f = lineFit(th);
      if (!f || th.length < 4) continue;
      errs.push(angleError(f.ang, ev.ang));
      fine.push(angleError(bestFit(th, f.c, 1.31).ang, ev.ang));
    }
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    expect(med(errs)).toBeLessThan(25);
    expect(med(fine)).toBeLessThan(med(errs));
  });

  it('캐스케이드는 직선 맞춤으로 방향을 재기 어렵다', () => {
    const rand = rng(9);
    const list = sensors();
    const errs: number[] = [];
    for (let i = 0; i < 40; i++) {
      const ang = rand() * 2 * Math.PI;
      const th = timedHits(list, cascadeHits({ x: 3 + rand() * 4, y: 2 + rand() * 2 }, ang, 1.31, list));
      const f = lineFit(th);
      if (f) errs.push(angleError(f.ang, ang));
    }
    const med = [...errs].sort((x, y) => x - y)[Math.floor(errs.length / 2)];
    expect(med).toBeGreaterThan(30);
  });
});

describe('통계', () => {
  it('포아송 꼬리 확률과 σ 변환', () => {
    expect(poissonTail(0, 3)).toBe(1);
    expect(poissonTail(1, 2)).toBeCloseTo(1 - Math.exp(-2), 6);
    expect(pToSigma(0.0013499)).toBeCloseTo(3, 2);
    expect(pToSigma(2.8665e-7)).toBeCloseTo(5, 2);
    expect(pToSigma(0.6)).toBe(0);
  });
});

describe('검출기 설계', () => {
  it('얕은 공기 방울 층에 묻으면 검출률이 떨어진다', () => {
    const tr = D.testTracks();
    const base = { strings: 8, length: 1000, absorption: true, scattering: false };
    expect(D.detectionRate({ ...base, top: 1200 }, tr)).toBeLessThan(D.detectionRate({ ...base, top: 1450 }, tr));
  });
  it('센서 예산을 넘지 않는다', () => {
    for (const s of [3, 7, 16]) expect(D.sensors({ strings: s, top: 1450, length: 1000, absorption: true, scattering: false }).length).toBeLessThanOrEqual(D.BUDGET);
  });
});

describe('거름 조건', () => {
  it('방향과 에너지 조건을 함께 써야 순도 80%와 효율 40%를 넘는다', () => {
    const d = F.dataset(11);
    expect(F.tally(d, { ...F.NO_CUTS, minLogE: 4.5 }).purity).toBeLessThan(0.8);
    expect(F.tally(d, { ...F.NO_CUTS, upOnly: true }).purity).toBeLessThan(0.8);
    const both = F.tally(d, { ...F.NO_CUTS, upOnly: true, minQuality: 0.6, minLogE: 4.5 });
    expect(both.purity).toBeGreaterThanOrEqual(0.8);
    expect(both.efficiency).toBeGreaterThanOrEqual(0.4);
  });
});

describe('하늘 지도', () => {
  it('NGC 1068 방향은 새 방법에서 더 뚜렷하다', () => {
    const sky = K.makeSky(10, K.NGC1068);
    const old = K.search(sky, 'old', 2020, K.NGC1068.ra, K.NGC1068.dec, 3);
    const neu = K.search(sky, 'new', 2020, K.NGC1068.ra, K.NGC1068.dec, 2);
    expect(neu.sigma).toBeGreaterThan(old.sigma);
    expect(neu.sigma).toBeGreaterThan(3.5);
  });
  it('여러 곳을 찾으면 보정 후 확률이 커진다', () => {
    expect(K.trialCorrected(0.001, 20)).toBeGreaterThan(0.001);
    expect(K.trialCorrected(0.001, 1)).toBeCloseTo(0.001);
  });
});
