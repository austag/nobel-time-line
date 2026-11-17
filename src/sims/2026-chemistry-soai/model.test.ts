import { describe, expect, it } from 'vitest';
import { FLASK, controlStep, ee, expectedPairs, feedbackStep, pairFractions, productEe, productEeFromPairs, rng, runFlask, soaiRound } from './model';

describe('짝짓기 (카강)', () => {
  it('리간드 ee 50% 면 RR 0.5625, SS 0.0625, RS 0.375', () => {
    const p = pairFractions(0.5);
    expect(p.rr).toBeCloseTo(0.5625);
    expect(p.ss).toBeCloseTo(0.0625);
    expect(p.rs).toBeCloseTo(0.375);
  });
  it('섞인 짝이 놀면 50% → 80%', () => {
    expect(productEe(0.5, 0)).toBeCloseTo(0.8);
  });
  it('g = 1 이면 직선', () => {
    for (const e of [-0.7, 0, 0.2, 0.5, 0.9]) expect(productEe(e, 1)).toBeCloseTo(e);
  });
  it('g > 1 이면 직선 아래, 끝점은 그대로', () => {
    expect(productEe(0.5, 3)).toBeLessThan(0.5);
    expect(productEe(1, 3)).toBeCloseTo(1);
    expect(productEe(0, 0)).toBe(0);
  });
  it('구슬 160개(120:40)의 평균 짝은 45, 5, 30 이고 생성물은 80%', () => {
    const p = expectedPairs(120, 40);
    expect(p).toEqual({ rr: 45, ss: 5, rs: 30 });
    expect(productEeFromPairs(p.rr, p.ss, p.rs, 0)).toBeCloseTo(0.8);
  });
  it('짝 개수 합이 맞다', () => {
    for (const [r, s] of [[80, 80], [150, 10], [7, 3], [0, 12], [3, 0]]) {
      const p = expectedPairs(r, s);
      expect(p.rr + p.ss + p.rs).toBe(Math.floor((r + s) / 2));
      expect(2 * p.rr + p.rs).toBeLessThanOrEqual(r);
      expect(2 * p.ss + p.rs).toBeLessThanOrEqual(s);
    }
  });
});

describe('되먹임', () => {
  it('50 → 80 → 97.6 → 99.97%', () => {
    let e = 0.5;
    const seq = [0.8, 0.9756, 0.9997];
    for (const want of seq) {
      e = feedbackStep(e);
      expect(e).toBeCloseTo(want, 3);
    }
  });
  it('되먹임이 없으면 줄어든다', () => {
    expect(controlStep(0.8)).toBeLessThan(0.8);
  });
  it('반반은 영원히 반반', () => {
    expect(feedbackStep(0)).toBe(0);
    expect(soaiRound(0, 1000)).toBe(0);
  });
});

describe('소아이 반응', () => {
  it('ee 가 회차마다 커지고 부호를 지킨다', () => {
    expect(soaiRound(0.1, 1000)).toBeGreaterThan(0.1);
    expect(soaiRound(-0.1, 1000)).toBeLessThan(-0.1);
  });
  it('원료 1000배로 0.00005% 에서 세 번 만에 99.5% 를 넘는다', () => {
    let e = 5e-7;
    e = soaiRound(e, 1000);
    e = soaiRound(e, 1000);
    expect(e).toBeLessThan(0.995);
    e = soaiRound(e, 1000);
    expect(e).toBeGreaterThan(0.995);
  });
  it('반응 중간에는 끝보다 작다', () => {
    expect(soaiRound(0.01, 1000, 0.3)).toBeLessThan(soaiRound(0.01, 1000, 1));
  });
});

describe('씨앗 없는 플라스크', () => {
  it('100번 돌리면 양쪽이 모두 나오고, 대부분 크게 치우친다', () => {
    const r = rng(3);
    const out = Array.from({ length: 100 }, () => {
      const f = runFlask(r, FLASK);
      return ee(f.r, f.s);
    });
    const rWins = out.filter((x) => x > 0).length;
    expect(rWins).toBeGreaterThan(30);
    expect(rWins).toBeLessThan(70);
    expect(out.filter((x) => Math.abs(x) > 0.8).length).toBeGreaterThan(70);
  });
  it('씨앗을 넣으면 한쪽이 대부분 이긴다', () => {
    const r = rng(5);
    const sWins = Array.from({ length: 100 }, () => {
      const f = runFlask(r, { ...FLASK, bias: -0.5 });
      return f.s > f.r;
    }).filter(Boolean).length;
    expect(sWins).toBeGreaterThanOrEqual(90);
  });
});
