// 2025 생리의학: 말초 면역 관용 (브런코, 램즈델, 사카구치)
// 화면에 쓰는 값은 모두 여기서 계산한다. 실제 논문 값과 모형 값을 구분해 둔다.

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

// ---------- 1장: 가슴샘을 떼는 시점 ----------

/** 자가면역이 나타나는 장기 (실제 실험에서 보고된 곳) */
export type Organ = 'stomach' | 'thyroid' | 'ovary';
export const ORGANS: Organ[] = ['stomach', 'thyroid', 'ovary'];
/** 장기마다 공격받는 정도의 차이 (모형 값) */
const ORGAN_W: Record<Organ, number> = { stomach: 1, thyroid: 0.78, ovary: 0.9 };

/**
 * 갓 태어난 생쥐의 가슴샘을 d일째에 떼었을 때 자가면역이 생기는 정도 (0~1) — 모형 값.
 * 생후 3일 무렵에 뗀 생쥐에서만 자가면역이 나타난다.
 * 더 일찍 떼면 T세포 자체가 거의 나오지 않아 공격할 세포도 없고,
 * 더 늦게 떼면 공격을 멈추게 하는 세포까지 이미 나와 있어 병이 생기지 않는다.
 */
export function thymectomy(d: number): number {
  if (d <= 0) return 0.02;
  const peak = Math.exp(-((d - 3) ** 2) / (2 * 1.15 ** 2));
  const early = Math.min(1, d / 2.2);
  return 0.02 + 0.9 * peak * early;
}

/** 장기별 자가면역 정도 */
export const organDamage = (d: number, o: Organ) => thymectomy(d) * ORGAN_W[o];

/** 정상 생쥐의 T세포를 넣어 주면 자가면역이 가라앉는다 (모형 값) */
export const afterTransfer = (idx: number) => idx * 0.14;

// ---------- 2장: 명찰을 보고 세포 골라내기 ----------

/** CD4 세포 가운데 CD25 명찰을 함께 단 것의 비율 — 모형 값 (실제 보고는 대략 5~10%) */
export const TREG_FRACTION = 0.1;

/** 어떤 명찰로 가려냈는지 */
export type Marker = 'cd4' | 'cd4cd25';
/** 어느 통을 생쥐에 넣는지 */
export type Portion = 'none' | 'kept' | 'left' | 'both';

/** 넣은 세포 가운데 브레이크를 쥔 세포의 비율. null 이면 세포를 넣지 않았다는 뜻 */
export function tregFrac(m: Marker, p: Portion): number | null {
  if (p === 'none') return null;
  if (m === 'cd4') {
    // CD4 하나만 보고 가르면 담은 쪽에 브레이크를 쥔 세포가 그대로 섞여 들어간다
    if (p === 'left') return null; // CD4 가 없는 쪽에는 T세포가 없다
    return TREG_FRACTION;
  }
  if (p === 'kept') return 1; // CD25 까지 단 세포만
  if (p === 'left') return 0; // CD25 를 뺀 나머지
  return TREG_FRACTION;
}

/** 넣은 세포 가운데 공격할 수 있는 세포가 있는가 */
export function hasEffector(m: Marker, p: Portion): boolean {
  if (p === 'none') return false;
  if (m === 'cd4') return p !== 'left';
  return p === 'left' || p === 'both';
}

/** 브레이크가 공격을 얼마나 막는지 (0 막지 못함 ~ 1 완전히 막음) — 모형 값 */
export function brake(f: number): number {
  const f50 = 0.015;
  return 1 - 1 / (1 + (f / f50) ** 1.8);
}

/** 세포를 넣고 w주 뒤의 자가면역 지수 (0~1) */
export function severity(m: Marker, p: Portion, w: number): number {
  const f = tregFrac(m, p);
  if (f === null || !hasEffector(m, p)) return 0.03;
  const grow = 1 - Math.exp(-w / 2.8);
  return 0.03 + 0.9 * (1 - brake(f)) * grow;
}

export const WEEKS = 8;

// ---------- 3장: 고장 난 설계도 찾기 ----------

/** 좁히기 전 구간 (염기) — 모형 값 */
export const NT_WIDE = 2e7;
/** 다 좁혔을 때 구간: 약 50만 염기 (실제 보고 값) */
export const NT_NARROW = 5e5;
/** 그 안에 남는 후보 유전자 수 (실제 보고 값) */
export const GENE_COUNT = 20;
/** 고장이 있는 설계도의 번호 (스무 번째가 Foxp3) */
export const CULPRIT = 20;

/** 손잡이 위치(0~100)에 따른 구간 크기 */
export const regionNt = (s: number) => NT_WIDE * (NT_NARROW / NT_WIDE) ** (Math.min(100, Math.max(0, s)) / 100);
/** 구간 크기에 따른 후보 유전자 수 (모형 값: 50만 염기에 20개) */
export const geneCount = (nt: number) => Math.max(GENE_COUNT, Math.round(nt / (NT_NARROW / GENE_COUNT)));

/** 정상과 병든 생쥐의 염기 (20번만 글자가 끼어들어 있다) */
export const SEQ_NORMAL = 'ACGTTGAC';
export const SEQ_MUTANT = 'ACGTTGTTGAC';

/** 같은 증상을 보이는 사람 환자 */
export const PATIENTS = 3;

// ---------- 4장: 더 밟을까, 풀어 줄까 ----------

/** Foxp3 가 켜져 있을 때만 브레이크를 쥔 세포가 만들어진다 (2003) */
export const tregFromFoxp3 = (on: boolean, r: number) => (on ? r : 0.002);

/** 조절 T세포 비율 r 에서 종양이 자라는 정도 (0~1) — 모형 값 */
export const tumor = (r: number) => 0.15 + 0.85 / (1 + Math.exp(-(r - 0.1) / 0.035));
/** 조절 T세포 비율 r 에서 자기 몸이 받는 손상 (0~1) — 모형 값 */
export const selfDamage = (r: number) => 1 / (1 + Math.exp((r - 0.045) / 0.018));

export const TUMOR_GOAL = 0.3;
export const DAMAGE_GOAL = 0.2;
