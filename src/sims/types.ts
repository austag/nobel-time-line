// 체험 모듈 공통 규격 (SPEC.md 6.4)

export type Lang = 'ko' | 'en';
export type Tab = 'observe' | 'interact' | 'understand';

export interface Mission {
  id: string;
  ko: string;
  en: string;
  hint_ko: string;
  hint_en: string;
}

export interface TabContent {
  observe: string; // HTML, $...$ 와 $$...$$ 수식 사용 가능
  interact: string;
  understand: string;
}

export interface ChapterInfo {
  id: string;
  ko: string;
  en: string;
}

/** 연구 노트: 장 id → 기록 key → 문장 */
export type Notes = Record<string, Record<string, string>>;

/** 체험 화면(호스트)이 모듈에 넘겨주는 기능 */
export interface Host {
  /** 모듈이 컨트롤을 넣는 자리 */
  controls: HTMLElement;
  /** 움직임 줄이기 설정 */
  reduced: boolean;
  /** 미션 달성. 결과 문장은 조작 탭에 표시된다. */
  complete(id: string, result?: string): void;
  /** 미션 진행 상황만 갱신 */
  result(id: string, result: string): void;
  isPaused(): boolean;
  setPaused(paused: boolean): void;
  /** 연구 노트에 한 줄 남긴다. 같은 key 는 새 문장으로 바뀐다. */
  note(chapter: string, key: string, text: string): void;
  /** 짧은 알림 */
  toast(message: string): void;
}

export interface SimModule {
  id: string;
  /** 장이 여러 개인 체험만 */
  chapters?: ChapterInfo[];
  chapter?(): string;
  setChapter?(id: string): void;
  /** 모든 장에 노트가 있을 때 보여 줄 논문 초록 */
  abstract?(lang: Lang, notes: Notes): string;
  /** 지금 장의 미션과 해설 */
  missions(): Mission[];
  content(lang: Lang): TabContent;
  mount(container: HTMLElement, opts: { lang: Lang; host: Host; chapter?: string }): void;
  /** 매 프레임 호출. 일시정지 중에는 dt = 0 */
  frame(dt: number): void;
  setTab(tab: Tab): void;
  setLang(lang: Lang): void;
  /** 테마가 바뀌면 호출 */
  setTheme(): void;
  reset(): void;
  destroy(): void;
}

export type SimFactory = () => SimModule;
