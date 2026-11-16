import { describe, expect, it } from 'vitest';
import { PRIZES, YEARS, findPrize } from './data';
import { homeHash, parseHash } from './router';

describe('parseHash', () => {
  it('빈 주소는 필터 없는 홈이다', () => {
    expect(parseHash('')).toEqual({ name: 'home', field: 'all', year: 'all' });
    expect(parseHash('#/')).toEqual({ name: 'home', field: 'all', year: 'all' });
  });
  it('필터가 붙은 홈 주소를 읽는다', () => {
    expect(parseHash('#/?field=physics&year=2025')).toEqual({ name: 'home', field: 'physics', year: 2025 });
    expect(parseHash('#/?field=unknown')).toEqual({ name: 'home', field: 'all', year: 'all' });
  });
  it('체험과 소개 주소를 읽는다', () => {
    expect(parseHash('#/2026/physics')).toEqual({ name: 'experiment', year: 2026, field: 'physics' });
    expect(parseHash('#/about')).toEqual({ name: 'about' });
    expect(parseHash('#/nope/x/y')).toEqual({ name: 'notfound' });
  });
  it('homeHash 는 parseHash 와 짝이 맞는다', () => {
    expect(parseHash(homeHash('chemistry', 2026))).toEqual({ name: 'home', field: 'chemistry', year: 2026 });
    expect(homeHash('all', 'all')).toBe('#/');
  });
});

describe('data', () => {
  it('연도 내림차순, 물리 화학 의학 순서로 정렬된다', () => {
    expect(YEARS).toEqual([2026, 2025]);
    expect(PRIZES.map((p) => `${p.year}-${p.category}`)).toEqual([
      '2026-physics', '2026-chemistry', '2026-medicine',
      '2025-physics', '2025-chemistry', '2025-medicine',
    ]);
  });
  it('없는 체험은 찾지 못한다', () => {
    expect(findPrize(2030, 'physics')).toBeUndefined();
    expect(findPrize(2025, 'chemistry')?.sim).toBe('2025-chemistry-mof');
  });
});
