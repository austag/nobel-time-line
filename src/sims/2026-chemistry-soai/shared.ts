// 장끼리 이어지는 값: 1장에서 놓아 둔 예상 바늘을 2장에서 꺼내 본다
const KEY = 'soai:pred';

export const shared = {
  pred: load(),
  /** 마지막으로 무언가를 만진 시각 (힌트 고리용) */
  touched: 0,
};

function load(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

export function setPred(v: number | null): void {
  shared.pred = v;
  try {
    if (v == null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(v));
  } catch {
    /* 저장 못 해도 체험은 계속 */
  }
}

export const touch = (now: number) => (shared.touched = now);
