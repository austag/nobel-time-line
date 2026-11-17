// 2026 화학: 계산 로직 (화면과 분리, 테스트 대상)
// 모든 ee 는 -1(S만) ~ +1(R만) 사이의 값이다.

export const clampEe = (e: number) => Math.max(-1, Math.min(1, e));

/** 거울상 초과율 */
export function ee(r: number, s: number): number {
  return r + s > 0 ? (r - s) / (r + s) : 0;
}

/** 리간드가 무작위로 둘씩 짝을 지을 때 RR, SS, RS 짝의 비율 */
export function pairFractions(e: number): { rr: number; ss: number; rs: number } {
  const x = (1 + e) / 2;
  return { rr: x * x, ss: (1 - x) * (1 - x), rs: 2 * x * (1 - x) };
}

/**
 * 짝지은 촉매로 만든 생성물의 ee.
 * RR 은 R, SS 는 S 를 만들고, 섞인 짝 RS 는 RR 대비 g 배 속도로 R 과 S 를 반반 만든다.
 * g = 1 이면 직선(선형), g < 1 이면 위로 휜 곡선, g > 1 이면 아래로 휜 곡선.
 */
export function productEe(e: number, g: number): number {
  const { rr, ss, rs } = pairFractions(e);
  const d = rr + ss + g * rs;
  return d > 0 ? (rr - ss) / d : 0;
}

/** 실제로 지어진 짝 개수로 계산한 생성물 ee (화면용) */
export function productEeFromPairs(rr: number, ss: number, rs: number, g: number): number {
  const r = rr + (g * rs) / 2;
  const s = ss + (g * rs) / 2;
  return ee(r, s);
}

/** 되먹임 한 바퀴: 생성물이 다음 회차의 촉매가 된다 (섞인 짝은 놂) */
export const feedbackStep = (e: number) => productEe(e, 0);

/** 되먹임이 없을 때: 생성물이 촉매가 못 되고, 반반으로 생기는 같은 양의 생성물에 묽어진다 */
export const controlStep = (e: number) => e / 2;

/** 남은 R, S 구슬을 무작위로 짝지을 때의 평균 짝 개수 (정수, 합이 맞도록) */
export function expectedPairs(nR: number, nS: number): { rr: number; ss: number; rs: number } {
  const n = nR + nS;
  const pairs = Math.floor(n / 2);
  if (pairs === 0) return { rr: 0, ss: 0, rs: 0 };
  let ss = Math.round((pairs * nS * (nS - 1)) / (n * (n - 1)));
  ss = Math.max(0, Math.min(ss, Math.floor(nS / 2)));
  // RS 가 몇 개냐에 따라 RR 이 정해진다: 남는 S 는 모두 RS 로 간다
  let rs = nS - 2 * ss;
  let rr = pairs - ss - rs;
  if (rr < 0) {
    rs += rr;
    rr = 0;
  }
  return { rr, ss, rs };
}

/**
 * 소아이 반응 한 회차.
 * 씨앗 생성물 1 (ee = e)에 원료 M 을 붓고, 생성물이 생기는 즉시 촉매가 되게 끝까지 돌린다.
 * dR/dt ∝ R²/(R+S), dS/dt ∝ S²/(R+S) 이면 1/S − 1/R 이 변하지 않는다. 이걸로 바로 푼다.
 * frac(0~1)을 주면 원료 중 그만큼만 반응했을 때의 ee 를 돌려준다 (애니메이션용).
 */
export function soaiRound(e: number, M: number, frac = 1): number {
  if (e === 0) return 0;
  const sign = Math.sign(e);
  const a = Math.abs(e);
  if (a >= 1) return sign;
  const big0 = (1 + a) / 2;
  const small0 = (1 - a) / 2;
  const c = 1 / small0 - 1 / big0; // > 0
  const T = 1 + M * frac;
  // 1/s − 1/(T − s) = c 를 만족하는 s ∈ (0, T/2] 를 이분법으로
  let lo = 0;
  let hi = T / 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const f = 1 / mid - 1 / (T - mid) - c;
    if (f > 0) lo = mid;
    else hi = mid;
  }
  const s = (lo + hi) / 2;
  return sign * ee(T - s, s);
}

/** 재현 가능한 난수 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FlaskOpts {
  /** 촉매 없이 저절로 생기는 반응의 세기 (R, S 합) */
  b: number;
  /** 씨앗의 효과: + 는 R 쪽, − 는 S 쪽. 저절로 생기는 반응을 그만큼 한쪽으로 기울인다 */
  bias: number;
  /** 플라스크 하나에서 만들 분자 수 */
  n: number;
}

export const FLASK: FlaskOpts = { b: 10, bias: 0, n: 4000 };

/**
 * 분자를 하나씩 만드는 플라스크 (확률 시뮬레이션).
 * 다음 분자가 R 일 확률은 (b(1+bias)/2 + R²/(R+S)) 에 비례한다.
 * trace 에는 처음 분자들이 생기는 순서를 남긴다 (+1 은 R, −1 은 S).
 */
export function runFlask(rand: () => number, o: FlaskOpts = FLASK, traceLen = 0): { r: number; s: number; trace: number[] } {
  let r = 0;
  let s = 0;
  const trace: number[] = [];
  const bR = (o.b * (1 + o.bias)) / 2;
  const bS = (o.b * (1 - o.bias)) / 2;
  for (let i = 0; i < o.n; i++) {
    const tot = r + s;
    const aR = bR + (tot > 0 ? (r * r) / tot : 0);
    const aS = bS + (tot > 0 ? (s * s) / tot : 0);
    const isR = rand() * (aR + aS) < aR;
    if (isR) r++;
    else s++;
    if (i < traceLen) trace.push(isR ? 1 : -1);
  }
  return { r, s, trace };
}
