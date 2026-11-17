// 장(章) 하나의 규격. index.ts 가 캔버스와 입력을 나눠 준다.
import type { Canvas, Palette } from '../canvas';
import type { Host, Lang, Mission, TabContent } from '../types';

export interface Ctx {
  cvs: Canvas;
  host: Host;
  lang: () => Lang;
  pal: () => Palette;
  /** 이 장의 연구 노트에 한 줄 남긴다 */
  note: (key: string, ko: string, en: string) => void;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Chapter {
  id: string;
  ko: string;
  en: string;
  missions: Mission[];
  content: Record<Lang, TabContent>;
  /** 장에 들어올 때: 상태 만들기와 컨트롤 그리기 */
  enter(ctx: Ctx): void;
  /** 언어가 바뀌면 컨트롤을 다시 그린다 */
  panel(): void;
  frame(dt: number): void;
  reset(): void;
  leave?(): void;
  down?(p: Pt): void;
  move?(p: Pt): void;
  up?(p: Pt): void;
}

export const k = (ctx: Ctx) => ctx.lang() === 'ko';
/** 언어에 맞는 문장 고르기 */
export const tr = (ctx: Ctx, ko: string, en: string) => (ctx.lang() === 'ko' ? ko : en);
