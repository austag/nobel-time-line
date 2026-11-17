import type { SimFactory } from './types';

// 모듈은 체험을 열 때만 불러온다 (SPEC.md 6.4).
// 새 모듈을 만들면 data의 sim 값과 같은 이름으로 여기에 한 줄 추가한다.
const LOADERS: Record<string, () => Promise<{ default: SimFactory }>> = {
  '2026-physics-icecube': () => import('./2026-physics-icecube'),
  '2026-chemistry-soai': () => import('./2026-chemistry-soai'),
};

export function hasSim(id: string): boolean {
  return id in LOADERS;
}

export async function loadSim(id: string): Promise<SimFactory | null> {
  const load = LOADERS[id];
  return load ? (await load()).default : null;
}
