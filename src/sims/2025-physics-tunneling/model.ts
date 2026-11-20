// 2025 물리학: 전기 회로 속 거시 양자 터널링과 에너지 양자화 (클라크, 드보레, 마르티니스)
// 화면에 쓰는 물리 값은 모두 여기서 계산한다. 그리기 코드는 이 파일의 함수만 부른다.

export const HBAR = 1.054571817e-34;
export const KB = 1.380649e-23;
export const PHI0 = 2.067833848e-15; // 자속 양자 h / 2e
export const ME = 9.1093837e-31;
export const MP = 1.67262192e-27;
export const EV = 1.602176634e-19;
const TAU = Math.PI * 2;

// ---------- 1장: 사각형 벽을 지나가는 파동 ----------

/** 입자 에너지는 1 eV로 두고, 벽 높이(입자 에너지보다 얼마나 높은지)와 두께로 투과 확률을 낸다 */
export const PARTICLE_E = 1; // eV

export function kappa(over: number, mass = ME): number {
  return Math.sqrt(2 * mass * over * EV) / HBAR; // 1/m
}

/** 사각형 벽의 투과 확률 (정확한 식). d 는 nm, over 는 eV */
export function transmission(d: number, over: number, mass = ME, E = PARTICLE_E): number {
  const V0 = E + over;
  const s = Math.sinh(kappa(over, mass) * d * 1e-9);
  return 1 / (1 + (V0 * V0 * s * s) / (4 * E * over));
}

// ---------- 2장: 전류를 흘린 조셉슨 접합 ----------

/** 실제 버클리 실험과 비슷한 크기의 접합 (임계 전류 약 9.5 μA, 전기용량 약 6.4 pF) */
export const JJ = { I0: 9.5e-6, C: 6.4e-12, Q: 30 };
/** 구리 차폐를 끄면 바깥 전선으로 들어오는 잡음을 이 온도만큼의 열로 친다 */
export const NOISE_T = 0.09; // K
/** 측정할 때 전류를 올리는 빠르기 (임계 전류 대비, 1초에) */
export const RAMP = 4;

export const ej = (I0 = JJ.I0) => (I0 * PHI0) / TAU;

/** 골짜기 바닥에서 흔들리는 진동수 ω_p (rad/s). s = I / I0 */
export function wp(s: number, I0 = JJ.I0, C = JJ.C): number {
  return Math.sqrt((TAU * I0) / (PHI0 * C)) * Math.pow(Math.max(0, 1 - s * s), 0.25);
}

/** 벽 높이 ΔU (J). 퍼텐셜 U(δ) = -E_J (cos δ + s δ) 에서 첫 골짜기와 다음 언덕의 차이 */
export function dU(s: number, I0 = JJ.I0): number {
  if (s >= 1) return 0;
  return 2 * ej(I0) * (Math.sqrt(1 - s * s) - s * Math.acos(s));
}

/** 퍼텐셜 모양 (E_J 단위). 그림에 쓴다 */
export const potential = (d: number, s: number) => -Math.cos(d) - s * d;

/** 열로 넘어가는 탈출률 (1/s) */
export function rateThermal(s: number, T: number, I0 = JJ.I0, C = JJ.C): number {
  if (T <= 0) return 0;
  return (wp(s, I0, C) / TAU) * Math.exp(-dU(s, I0) / (KB * T));
}

/** 벽을 지나가는 탈출률 (1/s). 온도와 상관없다 */
export function rateQuantum(s: number, I0 = JJ.I0, C = JJ.C, Q = JJ.Q): number {
  const w = wp(s, I0, C);
  if (w === 0) return Infinity;
  const r = dU(s, I0) / (HBAR * w);
  return Math.sqrt(864 * Math.PI * r) * (w / TAU) * Math.exp(-7.2 * r * (1 + 0.87 / Q));
}

/** 잡음이 들어오면 접합이 느끼는 온도가 올라간다 */
export const effTemp = (T: number, shield: boolean) => (shield ? T : Math.sqrt(T * T + NOISE_T * NOISE_T));

export function rate(s: number, T: number, shield: boolean, I0 = JJ.I0, C = JJ.C): number {
  return rateQuantum(s, I0, C) + rateThermal(s, effTemp(T, shield), I0, C);
}

/** 탈출 온도: 측정한 탈출률을 "열로만 넘어갔다면 몇 도였을까"로 바꾼 값 (K) */
export function escapeTemp(s: number, G: number, I0 = JJ.I0, C = JJ.C): number {
  const L = Math.log(wp(s, I0, C) / (TAU * G));
  return L > 0 ? dU(s, I0) / (KB * L) : Infinity;
}

/** 갈림 온도 T₀ = ħω_p / 2πk_B (K) */
export const crossover = (s: number, I0 = JJ.I0, C = JJ.C) => (HBAR * wp(s, I0, C)) / (TAU * KB);

export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Sweep {
  /** 전압이 튄 순간의 s 값들 */
  hits: number[];
  /** 평균 */
  mean: number;
  /** 그 전류에서 잰 탈출 온도 (K) */
  tesc: number;
}

const S0 = 0.9;
const DS = 2e-5;

/** 전류를 0.9 I0에서 천천히 올리며 전압이 튀는 순간을 n번 잰다 */
export function sweep(T: number, shield: boolean, n: number, seed: number, I0 = JJ.I0, C = JJ.C): Sweep {
  const N = Math.round((1 - S0) / DS);
  const cdf = new Float64Array(N + 1);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const s = S0 + (i + 0.5) * DS;
    acc += (rate(s, T, shield, I0, C) * DS) / RAMP;
    cdf[i + 1] = 1 - Math.exp(-acc);
  }
  const r = rng(seed);
  const hits: number[] = [];
  for (let k = 0; k < n; k++) {
    const u = r() * cdf[N];
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cdf[m] < u) lo = m;
      else hi = m;
    }
    hits.push(S0 + (lo + r()) * DS);
  }
  const mean = hits.reduce((a, b) => a + b, 0) / n;
  // 실제 실험처럼 측정에는 작은 흔들림이 있다
  const G = rate(mean, T, shield, I0, C) * (1 + (r() - 0.5) * 0.3);
  return { hits, mean, tesc: escapeTemp(mean, G, I0, C) };
}

/** 열 구간에서 회로를 재면 알게 되는 값. 실제 값과 1% 안쪽으로 다르다 */
export function calibrate(seed: number): { I0: number; C: number } {
  const r = rng(seed);
  return { I0: JJ.I0 * (1 + (r() - 0.5) * 0.01), C: JJ.C * (1 + (r() - 0.5) * 0.02) };
}

/** 이론 예측: 조정 변수 없이, 잰 I0와 C만으로 그린 탈출 온도 */
export function predictTesc(T: number, I0: number, C: number): number {
  const sw = sweep(T, true, 400, 7, I0, C);
  return escapeTemp(sw.mean, rate(sw.mean, T, true, I0, C), I0, C);
}

// ---------- 3장: 골짜기 안의 에너지 준위 ----------

/** 골짜기 안에 들어가는 준위 수의 어림 (ΔU / ħω_p) */
export const levelsIn = (s: number) => dU(s) / (HBAR * wp(s));

/** n번 준위 에너지 (ħω_p 단위, 바닥이 0). 3차 퍼텐셜의 비조화 보정 */
export function level(n: number, s: number): number {
  const r = levelsIn(s);
  return n + 0.5 - (5 / 36) * (n * n + n + 11 / 30) / r;
}

/** 준위 n → n+1 로 올라가는 마이크로파 주파수 (GHz) */
export function transition(n: number, s: number): number {
  return ((level(n + 1, s) - level(n, s)) * wp(s)) / TAU / 1e9;
}

/** 마이크로파를 쪼였을 때 탈출률이 몇 배 늘어나는지 (0이면 그대로) */
export function enhancement(fGHz: number, s: number): number {
  const L = (f0: number) => {
    const g = f0 / (2 * JJ.Q);
    return 1 / (1 + ((fGHz - f0) / g) ** 2);
  };
  return 2.4 * L(transition(0, s)) + 0.9 * L(transition(1, s));
}

// ---------- 4장: 큐비트 (가장 낮은 두 준위) ----------

export const RABI_MHZ = 20; // 마이크로파 세기로 정해지는 오가는 빠르기
export const T2_NS = 300; // 흔들림이 흐려지는 시간

/** 마이크로파를 t ns 동안 쏜 뒤 1 상태에 있을 확률 */
export function p1(t: number): number {
  const w = TAU * RABI_MHZ * 1e-3; // rad/ns
  return 0.5 * (1 - Math.cos(w * t) * Math.exp(-t / T2_NS));
}

/** π 펄스 길이 (ns): 0을 1로 완전히 뒤집는 시간 */
export const PI_PULSE = 1000 / (2 * RABI_MHZ);

/** 100번 쏘고 재서 1이 나온 비율 */
export function shots(t: number, n: number, seed: number): number {
  const r = rng(seed);
  const p = p1(t);
  let c = 0;
  for (let i = 0; i < n; i++) if (r() < p) c++;
  return c / n;
}
