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
