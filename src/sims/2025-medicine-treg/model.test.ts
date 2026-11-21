import { describe, expect, it } from 'vitest';
import {
  CULPRIT,
  GENE_COUNT,
  NT_NARROW,
  TREG_FRACTION,
  WEEKS,
  afterTransfer,
  brake,
  geneCount,
  hasEffector,
  organDamage,
  regionNt,
  selfDamage,
  severity,
  thymectomy,
  tregFrac,
  tregFromFoxp3,
  tumor,
} from './model';

describe('1장 가슴샘을 떼는 시점', () => {
  it('생후 3일째가 가장 심하다', () => {
    const days = [0, 1, 2, 3, 4, 5, 7, 10];
    const worst = days.reduce((a, b) => (thymectomy(b) > thymectomy(a) ? b : a));
    expect(worst).toBe(3);
    expect(thymectomy(3)).toBeGreaterThan(0.5);
  });
  it('너무 일찍 떼거나 늦게 떼면 병이 생기지 않는다', () => {
    expect(thymectomy(0)).toBeLessThan(0.1);
    expect(thymectomy(9)).toBeLessThan(0.1);
  });
  it('한 장기만이 아니라 여러 장기가 함께 공격받는다', () => {
    expect(organDamage(3, 'stomach')).toBeGreaterThan(0.3);
    expect(organDamage(3, 'thyroid')).toBeGreaterThan(0.3);
    expect(organDamage(3, 'ovary')).toBeGreaterThan(0.3);
  });
  it('정상 T세포를 넣으면 가라앉는다', () => {
    expect(afterTransfer(thymectomy(3))).toBeLessThan(thymectomy(3) / 2);
  });
});

describe('2장 명찰로 가려내기', () => {
  it('CD25 를 뺀 무리만 넣으면 병이 생긴다', () => {
    expect(tregFrac('cd4cd25', 'left')).toBe(0);
    expect(severity('cd4cd25', 'left', WEEKS)).toBeGreaterThan(0.5);
  });
  it('빼냈던 무리를 함께 넣으면 막힌다', () => {
    expect(tregFrac('cd4cd25', 'both')).toBe(TREG_FRACTION);
    expect(severity('cd4cd25', 'both', WEEKS)).toBeLessThan(0.15);
  });
  it('아무것도 넣지 않으면 병도 생기지 않는다', () => {
    expect(tregFrac('cd4cd25', 'none')).toBeNull();
    expect(severity('cd4cd25', 'none', WEEKS)).toBeLessThan(0.1);
  });
  it('담은 무리만으로는 공격할 세포가 없다', () => {
    expect(hasEffector('cd4cd25', 'kept')).toBe(false);
    expect(severity('cd4cd25', 'kept', WEEKS)).toBeLessThan(0.1);
  });
  it('CD4 만 보고 가르면 브레이크가 섞여 들어가 병이 생기지 않는다', () => {
    expect(severity('cd4', 'kept', WEEKS)).toBeLessThan(0.15);
  });
  it('브레이크는 비율이 조금만 있어도 거의 다 막는다', () => {
    expect(brake(0)).toBe(0);
    expect(brake(TREG_FRACTION)).toBeGreaterThan(0.9);
  });
  it('자가면역은 시간이 지나며 올라간다', () => {
    expect(severity('cd4cd25', 'left', 8)).toBeGreaterThan(severity('cd4cd25', 'left', 2));
  });
});

describe('3장 설계도 찾기', () => {
  it('끝까지 좁히면 약 50만 염기에 후보 20개가 남는다', () => {
    expect(regionNt(100)).toBeCloseTo(NT_NARROW, 0);
    expect(geneCount(regionNt(100))).toBe(GENE_COUNT);
  });
  it('좁히기 전에는 후보가 훨씬 많다', () => {
    expect(geneCount(regionNt(0))).toBeGreaterThan(GENE_COUNT * 10);
  });
  it('범인은 스무 번째다', () => {
    expect(CULPRIT).toBe(GENE_COUNT);
  });
});

describe('4장 두 방향의 치료', () => {
  it('Foxp3 를 끄면 조절 T세포가 거의 만들어지지 않는다', () => {
    expect(tregFromFoxp3(false, 0.2)).toBeLessThan(0.01);
    expect(tregFromFoxp3(true, 0.2)).toBe(0.2);
  });
  it('조절 T세포가 많을수록 종양은 커지고 자기 몸 손상은 준다', () => {
    expect(tumor(0.25)).toBeGreaterThan(tumor(0.02));
    expect(selfDamage(0.25)).toBeLessThan(selfDamage(0.02));
  });
  it('한 설정으로 두 목표를 한꺼번에 맞출 수는 없다', () => {
    const ok = Array.from({ length: 301 }, (_, i) => i / 1000).some((r) => tumor(r) <= 0.3 && selfDamage(r) <= 0.2);
    expect(ok).toBe(false);
  });
});
