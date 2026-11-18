import { describe, expect, it } from 'vitest';
import { HUES, NEURON, SPEED_RATIO, cellStep, followRate, gateStep, haloSensitivity, newCell, oocyteCurrent, pulseOn, sensitivity } from './model';

describe('1장', () => {
  it('조류는 사람 눈보다 20배 넘게 빠르다', () => {
    expect(SPEED_RATIO).toBeGreaterThanOrEqual(20);
  });
});

describe('2장 채널로돕신-2', () => {
  it('파랑(470 nm)이 봉우리, 빨강은 거의 0', () => {
    const s = HUES.map((h) => sensitivity(h.nm));
    const best = HUES[s.indexOf(Math.max(...s))];
    expect(best.id).toBe('blue');
    expect(sensitivity(630)).toBeLessThan(0.01);
    expect(sensitivity(410)).toBeGreaterThan(0.3);
  });
  it('끄는 스위치는 노랑에서 가장 잘 받는다', () => {
    const s = HUES.map((h) => haloSensitivity(h.nm));
    expect(HUES[s.indexOf(Math.max(...s))].id).toBe('yellow');
  });
  it('빛을 켜면 몇 ms 안에 열리고, 끄면 다시 닫힌다', () => {
    let p = 0;
    for (let t = 0; t < 10; t += 0.1) p = gateStep(p, 1, 0.1);
    expect(p).toBeGreaterThan(0.8);
    for (let t = 0; t < 60; t += 0.1) p = gateStep(p, 0, 0.1);
    expect(p).toBeLessThan(0.01);
  });
  it('유전자가 없으면 전류도 없다', () => {
    expect(oocyteCurrent(1, 0)).toBeCloseTo(0);
    expect(oocyteCurrent(1, 1)).toBeLessThan(0);
  });
});

describe('3장 신경세포', () => {
  it('짧은 빛 한 번에 스파이크 하나', () => {
    const c = newCell();
    let n = 0;
    for (let t = 0; t < 200; t += 0.05) if (cellStep(c, t < NEURON.pulse ? 1 : 0, 0.05, true)) n++;
    expect(n).toBe(1);
  });
  it('채널로돕신이 없으면 빛을 비춰도 조용하다', () => {
    const c = newCell();
    let n = 0;
    for (let t = 0; t < 500; t += 0.05) if (cellStep(c, 1, 0.05, false)) n++;
    expect(n).toBe(0);
  });
  it('20 Hz 까지는 거의 다 따라오고, 40 Hz 에서는 놓친다', () => {
    expect(followRate(5)).toBe(1);
    expect(followRate(10)).toBe(1);
    expect(followRate(20)).toBeGreaterThan(0.9);
    expect(followRate(40)).toBeLessThan(0.6);
  });
  it('빠르기 1~60 Hz 사이에서 성공률이 대체로 줄어든다', () => {
    const r = [5, 15, 25, 35, 45].map((f) => followRate(f));
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThanOrEqual(r[i - 1] + 0.05);
  });
  it('끄는 스위치를 켜면 파란 빛에도 발화가 줄어든다', () => {
    const count = (silence: number) => {
      const c = newCell();
      let n = 0;
      for (let t = 0; t < 1000; t += 0.05) if (cellStep(c, pulseOn(t, 10) ? 1 : 0, 0.05, true, silence)) n++;
      return n;
    };
    expect(count(0)).toBeGreaterThan(8);
    expect(count(1)).toBeLessThan(2);
  });
});
