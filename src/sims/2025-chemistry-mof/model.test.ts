import { describe, expect, it } from 'vitest';
import { PITCH, STRUTS, areaFrom, dayYield, detachRate, flexState, flexUptake, heatedRH, monolayer, uptake, usable, water } from './model';

describe('1장 자기조립', () => {
  it('이웃 결합이 많은 자리일수록 덜 떨어진다', () => {
    expect(detachRate(0.5, 3)).toBeLessThan(detachRate(0.5, 1));
  });
  it('결합이 강할수록 잘못 붙은 것도 잘 안 떨어진다', () => {
    expect(detachRate(1, 1)).toBeLessThan(detachRate(0.3, 1) / 50);
  });
});

describe('2장 비우기와 흡착', () => {
  it('롭슨의 틀은 비우면 무너지고, MOF-5는 버틴다', () => {
    expect(usable('robson', 200, true)).toBeLessThan(0.1);
    expect(usable('mof5', 200, true)).toBeGreaterThan(0.9);
  });
  it('MOF-5도 너무 뜨거우면 분해된다', () => {
    expect(usable('mof5', 450, true)).toBeLessThan(0.1);
  });
  it('흡착량은 한 겹에서 평평해지고, 그 양으로 넓이를 되찾는다', () => {
    const q = uptake('mof5', 0.8, 1);
    expect(q / monolayer(2900)).toBeGreaterThan(0.99);
    expect(areaFrom(monolayer(2900))).toBeCloseTo(2900, 6);
  });
  it('MOF-5 2 g은 축구장 넓이에 가깝다', () => {
    expect((2 * 2900) / PITCH).toBeGreaterThan(0.7);
  });
});

describe('3장 설계한 구멍', () => {
  it('막대가 길수록 구멍이 크다', () => {
    const a = STRUTS.find((s) => s.id === 'bdc')!;
    const b = STRUTS.find((s) => s.id === 'tpdc')!;
    expect(b.pore).toBeGreaterThan(a.pore);
  });
  it('메테인은 IRMOF-6에서 가장 많이 저장된다', () => {
    const best = STRUTS.reduce((x, y) => (y.ch4 > x.ch4 ? y : x));
    expect(best.irmof).toBe(6);
  });
  it('유연한 틀은 올릴 때와 내릴 때 문턱이 다르다', () => {
    expect(flexState(0.3, false)).toBe(false);
    expect(flexState(0.45, false)).toBe(true);
    expect(flexState(0.3, true)).toBe(true);
    expect(flexState(0.1, true)).toBe(false);
    expect(flexUptake(0.5, true)).toBeGreaterThan(flexUptake(0.5, false) * 10);
  });
});

describe('4장 물 수확', () => {
  it('데우면 MOF 속 상대습도가 크게 낮아진다', () => {
    expect(heatedRH(10, 35, 70)).toBeLessThan(3);
  });
  it('계단이 밤 습도보다 낮아야 물이 찬다', () => {
    expect(water('mof303', 30)).toBeGreaterThan(water('stepHigh', 30) * 5);
  });
  it('사막 밤 습도 30%에서 MOF-303은 하루 150 g 넘게, 계단이 높은 MOF는 거의 못 얻는다', () => {
    expect(dayYield('mof303', 30, 70)).toBeGreaterThan(150);
    expect(dayYield('stepHigh', 30, 70)).toBeLessThan(30);
    expect(dayYield('mof303', 30, 70)).toBeGreaterThan(dayYield('mof801', 30, 70));
  });
});
