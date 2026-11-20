import { describe, expect, it } from 'vitest';
import { MP, PI_PULSE, calibrate, crossover, enhancement, escapeTemp, level, p1, predictTesc, rate, rateQuantum, rateThermal, shots, sweep, transition, transmission, JJ } from './model';

describe('1장 사각형 벽', () => {
  it('두께를 두 배로 하면 투과 확률은 절반보다 훨씬 작아진다', () => {
    const a = transmission(0.3, 1);
    const b = transmission(0.6, 1);
    expect(b / a).toBeLessThan(0.1);
  });
  it('벽이 낮을수록 잘 지나간다', () => {
    expect(transmission(0.5, 0.2)).toBeGreaterThan(transmission(0.5, 1.5));
  });
  it('양성자처럼 무거우면 거의 못 지나간다', () => {
    expect(transmission(0.3, 1, MP)).toBeLessThan(1e-30);
  });
});

describe('2장 거시 양자 터널링', () => {
  it('높은 온도에서는 탈출 온도가 실제 온도를 따라간다', () => {
    for (const T of [0.1, 0.2]) expect(sweep(T, true, 300, 3).tesc / T).toBeCloseTo(1, 1);
  });
  it('낮은 온도에서는 탈출 온도가 평평해지고, 갈림 온도 근처에 머문다', () => {
    const a = sweep(0.01, true, 300, 4).tesc;
    const b = sweep(0.02, true, 300, 5).tesc;
    expect(Math.abs(a - b) / a).toBeLessThan(0.1);
    expect(a).toBeGreaterThan(0.025);
    expect(a).toBeLessThan(0.05);
    expect(crossover(0.989) * 1000).toBeGreaterThan(25);
  });
  it('차폐를 끄면 잡음 때문에 더 높은 온도에서 가짜로 평평해진다', () => {
    expect(sweep(0.01, false, 300, 6).tesc).toBeGreaterThan(0.08);
  });
  it('낮은 온도에서는 터널링이, 높은 온도에서는 열이 탈출을 이끈다', () => {
    expect(rateQuantum(0.989)).toBeGreaterThan(rateThermal(0.989, 0.015) * 10);
    expect(rateThermal(0.97, 0.2)).toBeGreaterThan(rateQuantum(0.97) * 10);
  });
  it('탈출 온도의 정의: 열로만 넘어가면 실제 온도와 같다', () => {
    expect(escapeTemp(0.97, rateThermal(0.97, 0.15))).toBeCloseTo(0.15, 6);
  });
  it('높은 온도에서 잰 회로 값만으로 낮은 온도 결과를 맞힌다', () => {
    const c = calibrate(1);
    const pred = predictTesc(0.01, c.I0, c.C);
    const got = sweep(0.01, true, 400, 9).tesc;
    expect(Math.abs(pred - got) / got).toBeLessThan(0.15);
    expect(rate(0.99, 0.01, true)).toBeGreaterThan(0);
    expect(c.I0 / JJ.I0).toBeCloseTo(1, 1);
  });
});

describe('3장 에너지 준위', () => {
  it('준위 간격은 위로 갈수록 좁아진다', () => {
    expect(transition(1, 0.98)).toBeLessThan(transition(0, 0.98));
    expect(level(1, 0.98) - level(0, 0.98)).toBeLessThan(1);
  });
  it('전류를 올리면 공명 주파수가 낮아진다', () => {
    expect(transition(0, 0.99)).toBeLessThan(transition(0, 0.975));
  });
  it('공명 주파수에서만 탈출이 크게 늘어난다', () => {
    const f = transition(0, 0.98);
    expect(enhancement(f, 0.98)).toBeGreaterThan(2);
    expect(enhancement(f + 0.5, 0.98)).toBeLessThan(0.2);
  });
});

describe('4장 큐비트', () => {
  it('π 펄스면 1로 뒤집히고, 2배면 다시 0 근처', () => {
    expect(p1(PI_PULSE)).toBeGreaterThan(0.9);
    expect(p1(2 * PI_PULSE)).toBeLessThan(0.1);
    expect(p1(0)).toBe(0);
  });
  it('100번 재면 확률에 가까운 비율이 나온다', () => {
    expect(Math.abs(shots(PI_PULSE / 2, 400, 3) - 0.5)).toBeLessThan(0.1);
  });
});
