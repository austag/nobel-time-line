// 2025 화학: 금속유기골격체 (기타가와, 롭슨, 야기)
// 화면에 쓰는 값은 모두 여기서 계산한다. 실제 논문 값과 모형 값을 구분해 둔다.

export const NA = 6.02214076e23;
/** 질소 분자 하나가 표면에서 차지하는 면적 (m²) */
export const SIGMA_N2 = 0.162e-18;
/** 축구장 넓이 (105 m × 68 m) */
export const PITCH = 105 * 68;

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

// ---------- 1장: 자기조립 ----------

/** 마디 모양: 팔의 방향 (2D 화면에 그리는 각도, 라디안) */
export type Node = 'tet' | 'sq' | 'tri';
export const NODES: Record<Node, { arms: number; angles: number[] }> = {
  // 정사면체 마디를 위에서 내려다본 다이아몬드형 그물 (지그재그 층)
  tet: { arms: 4, angles: [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4] },
  sq: { arms: 4, angles: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] },
  tri: { arms: 3, angles: [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3] },
};

/**
 * 결합 세기에 따라 붙은 마디가 떨어질 확률 (1초에).
 * 맞게 붙은 자리는 이웃 결합이 많아 덜 떨어지고, 잘못 붙은 자리는 결합이 하나뿐이라 잘 떨어진다.
 * strength 0~1: 0이면 너무 약해 아무것도 남지 않고, 1이면 너무 강해 잘못 붙은 것도 굳는다.
 */
export function detachRate(strength: number, bonds: number): number {
  const e = 1 + strength * 7; // 결합 하나의 세기 (kT 단위)
  return 6 * Math.exp(-e * bonds);
}

// ---------- 2장: 비우기와 흡착 ----------

export type Sample = 'robson' | 'kitagawa' | 'mof5' | 'zeolite';

export interface SampleInfo {
  /** 완전히 비웠을 때 1 g의 내부 넓이 (m²) — 모형 값, MOF-5는 1999년 무렵 보고 값의 크기 */
  area: number;
  /** 랭뮤어 상수 (상대 압력 단위) */
  K: number;
  /** 비우면 무너지는가 */
  collapses: boolean;
  /** 이 온도(°C) 넘게 데우면 틀이 분해된다 */
  tmax: number;
}

export const SAMPLES: Record<Sample, SampleInfo> = {
  robson: { area: 600, K: 300, collapses: true, tmax: 150 },
  kitagawa: { area: 700, K: 500, collapses: false, tmax: 250 },
  mof5: { area: 2900, K: 400, collapses: false, tmax: 400 },
  zeolite: { area: 800, K: 300, collapses: false, tmax: 700 },
};

/** 가열 온도에 따라 구멍에서 용매가 빠진 비율 */
export const emptied = (T: number) => Math.min(1, Math.max(0, (T - 40) / 140));

/** 비운 뒤 실제로 쓸 수 있는 넓이 비율 */
export function usable(s: Sample, T: number, vacuum: boolean): number {
  const info = SAMPLES[s];
  if (T > info.tmax) return 0.02; // 분해
  const e = vacuum ? emptied(T) : emptied(T) * 0.3;
  if (info.collapses && e > 0.3) return 0.03;
  return e;
}

/** 한 겹 덮는 질소 양 (mmol/g) */
export const monolayer = (area: number) => (area / (NA * SIGMA_N2)) * 1000;

/** 상대 압력 p에서 흡착량 (mmol/g) — 랭뮤어 식 */
export function uptake(s: Sample, p: number, use: number): number {
  const i = SAMPLES[s];
  const qm = monolayer(i.area) * use;
  return (qm * i.K * p) / (1 + i.K * p);
}

/** 한 겹 흡착량에서 넓이 계산 (m²/g) */
export const areaFrom = (qm: number) => (qm / 1000) * NA * SIGMA_N2;

/** 질소를 넣는 상대 압력 단계 */
export const DOSES = [0.002, 0.005, 0.01, 0.02, 0.04, 0.07, 0.1, 0.15, 0.2, 0.3, 0.45, 0.6, 0.8];

// ---------- 3장: 막대를 바꿔 구멍 설계하기 ----------

export interface Strut {
  id: string;
  name_ko: string;
  name_en: string;
  /** 벤젠 고리 수로 센 길이 */
  rings: number;
  /** 곁가지 (없으면 '') */
  side: string;
  irmof: number;
  /** 구멍 지름 (Å) — 모형 값, IRMOF-6는 논문의 두 공간 9.1과 14.5 Å 중 작은 쪽 */
  pore: number;
  /** 36기압 상온 메테인 저장량 (cm³/cm³) — IRMOF-6의 155만 논문 값, 나머지는 모형 값 */
  ch4: number;
}

export const STRUTS: Strut[] = [
  { id: 'bdc', name_ko: '벤젠 (BDC)', name_en: 'benzene (BDC)', rings: 1, side: '', irmof: 1, pore: 12.9, ch4: 120 },
  { id: 'br', name_ko: '벤젠 + 브로민', name_en: 'benzene + Br', rings: 1, side: '–Br', irmof: 2, pore: 11.6, ch4: 118 },
  { id: 'nh2', name_ko: '벤젠 + 아미노기', name_en: 'benzene + NH₂', rings: 1, side: '–NH₂', irmof: 3, pore: 11.9, ch4: 124 },
  { id: 'c2h4', name_ko: '벤젠 + 고리 곁가지', name_en: 'benzene + fused ring', rings: 1, side: '–C₂H₄–', irmof: 6, pore: 9.1, ch4: 155 },
  { id: 'nap', name_ko: '나프탈렌', name_en: 'naphthalene', rings: 1.5, side: '', irmof: 8, pore: 14.6, ch4: 105 },
  { id: 'bpdc', name_ko: '바이페닐', name_en: 'biphenyl', rings: 2, side: '', irmof: 10, pore: 17.2, ch4: 90 },
  { id: 'pdc', name_ko: '파이렌', name_en: 'pyrene', rings: 2, side: '', irmof: 14, pore: 17.0, ch4: 95 },
  { id: 'tpdc', name_ko: '터페닐', name_en: 'terphenyl', rings: 3, side: '', irmof: 16, pore: 21.6, ch4: 70 },
];

/** 유연한 틀: 압력을 올릴 때 열리는 문턱과 내릴 때 닫히는 문턱 (상대 압력, 모형 값) */
export const GATE_OPEN = 0.4;
export const GATE_CLOSE = 0.18;

/** 유연한 틀의 흡착량 (최대 1). open 은 지금 틀이 열려 있는지 */
export function flexUptake(p: number, open: boolean): number {
  if (!open) return 0.05 * p;
  const K = 30;
  return (K * p) / (1 + K * p);
}

/** 압력 변화에 따라 틀이 열리고 닫히는 상태 */
export function flexState(p: number, wasOpen: boolean): boolean {
  if (!wasOpen && p >= GATE_OPEN) return true;
  if (wasOpen && p <= GATE_CLOSE) return false;
  return wasOpen;
}

// ---------- 4장: 사막 공기에서 물 얻기 ----------

export type Harvester = 'mof303' | 'mof801' | 'stepHigh' | 'silica';

export interface WaterInfo {
  /** 계단이 있는 상대습도 (%, 25°C 기준) — 모형 값 */
  step: number;
  /** 계단 위에서 꽉 찼을 때 물 흡착량 (g/g) — 모형 값, 사막 시험 수확량에 맞춤 */
  cap: number;
  /** 계단의 날카로움 (작을수록 날카로움) */
  width: number;
}

export const WATER: Record<Harvester, WaterInfo> = {
  mof303: { step: 13, cap: 0.22, width: 1.8 },
  mof801: { step: 9, cap: 0.12, width: 1.8 },
  stepHigh: { step: 45, cap: 0.3, width: 2 },
  silica: { step: 50, cap: 0.3, width: 25 },
};

/** 포화 수증기압 (kPa), 마그누스 식 */
export const psat = (T: number) => 0.61094 * Math.exp((17.625 * T) / (T + 243.04));

/** 물 흡착량 (g/g) */
export function water(h: Harvester, rh: number): number {
  const w = WATER[h];
  return w.cap / (1 + Math.exp(-(rh - w.step) / w.width)) + 0.0005 * rh;
}

/** 햇빛으로 데운 MOF 속 상대습도: 같은 수증기라도 뜨거우면 상대습도가 크게 낮다 */
export const heatedRH = (rhAir: number, tAir: number, tMof: number) => (rhAir * psat(tAir)) / psat(tMof);

/** 한 번 꺼낼 때 실제로 빠져나오는 비율 (MOF-303 장치에서 많아야 85%) */
export const RECOVERY = 0.85;

/** 하루 한 번 순환할 때 1 kg에서 얻는 물 (g) */
export function dayYield(h: Harvester, rhNight: number, tMof: number, rhDay = 10, tDay = 35): number {
  const night = water(h, rhNight);
  const day = water(h, heatedRH(rhDay, tDay, tMof));
  return Math.max(0, (night - day) * 1000 * RECOVERY);
}
