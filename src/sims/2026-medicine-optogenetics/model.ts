// 광유전학 체험의 계산. 화면과 떼어 두어 테스트할 수 있게 한다.
// 수치는 실제 경향을 따르되, 손으로 만지며 보기 좋게 단순화했다.

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

// ---------- 1장: 사람 눈과 조류의 빛 반응 ----------

/** 공식 자료: 조류의 빛 반응은 사람 눈보다 20배 넘게 빠르다 */
export const SPEED_RATIO = 20;

/** 사람 눈의 막대세포 안에서 빛 신호가 거치는 단계 (단순화) */
export const EYE_STEPS = [
  { ko: '빛', en: 'Light' },
  { ko: '로돕신', en: 'Rhodopsin' },
  { ko: 'G 단백질', en: 'G protein' },
  { ko: '효소', en: 'Enzyme' },
  { ko: 'cGMP 줄어듦', en: 'cGMP drops' },
  { ko: '이온 채널', en: 'Ion channel' },
];
/** 조류의 눈점: 빛을 받는 단백질이 곧 문 */
export const ALGA_STEPS = [
  { ko: '빛', en: 'Light' },
  { ko: '채널로돕신', en: 'Channelrhodopsin' },
];

// ---------- 2장: 개구리 알 속의 채널로돕신-2 ----------

export interface Hue {
  id: string;
  nm: number;
  ko: string;
  en: string;
  col: string; // 그림에만 쓰는 빛 색
}

export const HUES: Hue[] = [
  { id: 'violet', nm: 410, ko: '보라', en: 'Violet', col: '#7b4fd6' },
  { id: 'blue', nm: 470, ko: '파랑', en: 'Blue', col: '#2f7bf0' },
  { id: 'cyan', nm: 500, ko: '청록', en: 'Cyan', col: '#1fb3b3' },
  { id: 'green', nm: 530, ko: '초록', en: 'Green', col: '#3fae4a' },
  { id: 'yellow', nm: 580, ko: '노랑', en: 'Yellow', col: '#e8b417' },
  { id: 'red', nm: 630, ko: '빨강', en: 'Red', col: '#e0452e' },
];

/** 채널로돕신-2가 빛을 얼마나 잘 받는지 (봉우리 470 nm 를 1로) */
export function sensitivity(nm: number): number {
  const d = nm - 470;
  const w = d < 0 ? 70 : 45;
  return Math.exp(-((d / w) ** 2));
}

/** 할로로돕신(끄는 스위치)의 감도. 봉우리는 노랑 쪽 580 nm */
export function haloSensitivity(nm: number): number {
  const d = nm - 580;
  return Math.exp(-((d / 50) ** 2));
}

/**
 * 열린 문의 비율 p 를 dt(ms) 만큼 진행.
 * 빛이 있으면 tauOn 으로 열리고, 늘 tauOff 로 닫힌다.
 */
export function gateStep(p: number, drive: number, dt: number, tauOn = 1.5, tauOff = 8): number {
  const dp = (drive * (1 - p)) / tauOn - p / tauOff;
  return Math.min(1, Math.max(0, p + dp * dt));
}

/** 알의 전류 (nA 단위로 보기 좋게). 막전위를 -100 mV 로 고정한 채 잰다고 본다 */
export const OOCYTE_MAX_NA = 400;
export function oocyteCurrent(p: number, channels: number): number {
  return -OOCYTE_MAX_NA * p * channels;
}

// ---------- 3장: 접시 속 신경세포 ----------

export const NEURON = {
  rest: -70,
  thresh: -50,
  reset: -70,
  peak: 30, // 그림에서 스파이크 꼭대기
  tauM: 15, // ms
  refr: 2, // ms
  eChR: 0, // mV
  gChR: 2, // 휴지 상태에서의 상대 세기
  tauDes: 1000, // 탈감작
  tauRec: 1500, // 회복
  pulse: 5, // 빛 펄스 길이 ms
};

export interface Cell {
  v: number;
  p: number; // 열린 문
  a: number; // 쓸 수 있는 문 (탈감작되지 않은 비율)
  refr: number;
  t: number; // ms
}

export const newCell = (): Cell => ({ v: NEURON.rest, p: 0, a: 1, refr: 0, t: 0 });

/** dt(ms) 만큼 진행하고, 스파이크가 났으면 true */
export function cellStep(c: Cell, light: number, dt: number, hasChR: boolean, silence = 0): boolean {
  const N = NEURON;
  c.t += dt;
  c.p = gateStep(c.p, hasChR ? light : 0, dt);
  c.a += ((1 - c.a) / N.tauRec - (c.p * c.a) / N.tauDes) * dt;
  if (c.refr > 0) {
    c.refr -= dt;
    c.v = N.reset;
    return false;
  }
  const iChR = N.gChR * c.p * c.a * (N.eChR - c.v);
  // 끄는 스위치: 음이온이 들어와 막전위를 낮춘다
  const iOff = silence * 1.6 * (-95 - c.v);
  c.v += ((-(c.v - N.rest) + iChR + iOff) / N.tauM) * dt;
  if (c.v >= N.thresh) {
    c.v = N.reset;
    c.refr = N.refr;
    return true;
  }
  return false;
}

/** 빛 펄스 하나가 켜져 있는지 (freq Hz, t ms) */
export function pulseOn(t: number, freq: number): boolean {
  const period = 1000 / freq;
  return t % period < NEURON.pulse;
}

/**
 * 같은 빠르기로 펄스를 n번 줬을 때, 펄스마다 스파이크가 하나씩 따라온 비율.
 * 펄스가 시작된 뒤 다음 펄스 전까지 스파이크가 정확히 하나면 성공으로 센다 (빠지거나 겹치면 실패).
 */
export function followRate(freq: number, n = 30, dt = 0.05): number {
  const c = newCell();
  const period = 1000 / freq;
  let ok = 0;
  let spikes = 0;
  let k = 0;
  while (k < n) {
    const on = pulseOn(c.t, freq);
    if (cellStep(c, on ? 1 : 0, dt, true)) spikes++;
    if (c.t >= (k + 1) * period) {
      if (spikes === 1) ok++;
      spikes = 0;
      k++;
    }
  }
  return ok / n;
}

/** 마무리 요약에 쓰는 대략의 한계 빠르기: 성공률이 처음으로 0.8 아래가 되는 Hz */
export function followLimit(): number {
  for (let f = 5; f <= 120; f += 5) if (followRate(f) < 0.8) return f;
  return 120;
}
