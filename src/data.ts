import y2026 from './data/2026.json';
import y2025 from './data/2025.json';

export type Field = 'physics' | 'chemistry' | 'medicine';
export const FIELDS: Field[] = ['physics', 'chemistry', 'medicine'];

export interface Laureate {
  name: string;
  name_ko: string;
}

export interface Prize {
  year: number;
  category: Field;
  laureates: Laureate[];
  motivation: string;
  motivation_ko: string;
  motivation_verified: boolean;
  title_ko: string;
  title_en: string;
  summary_ko: string;
  summary_en: string;
  official_url: string;
  sim: string;
}

interface YearFile {
  year: number;
  prizes: Omit<Prize, 'year'>[];
}

// 새 연도를 추가할 때는 src/data/{연도}.json 을 만들고 이 배열에 넣는다.
const YEAR_FILES = [y2026, y2025] as unknown as YearFile[];

export const FIRST_YEAR = 2000;
export const LAST_YEAR = 2026;

export const PRIZES: Prize[] = YEAR_FILES.flatMap((file) =>
  file.prizes.map((p) => ({ ...p, year: file.year })),
).sort(
  (a, b) => b.year - a.year || FIELDS.indexOf(a.category) - FIELDS.indexOf(b.category),
);

export const YEARS: number[] = [...new Set(PRIZES.map((p) => p.year))].sort((a, b) => b - a);

export function findPrize(year: number, field: string): Prize | undefined {
  return PRIZES.find((p) => p.year === year && p.category === field);
}
