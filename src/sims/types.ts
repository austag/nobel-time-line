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
}

export interface SimModule {
  id: string;
  missions: Mission[];
  content: Record<Lang, TabContent>;
  mount(container: HTMLElement, opts: { lang: Lang; host: Host }): void;
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
