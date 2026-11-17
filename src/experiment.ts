// 체험 화면: 캔버스, 컨트롤, 해설 탭(관찰, 조작, 이해), 재생과 초기화 (SPEC.md 6.1, 6.2)
import type { Prize } from './data';
import type { Lang, Strings } from './i18n';
import { loadSim } from './sims/registry';
import type { Host, SimModule, Tab } from './sims/types';
import { h } from './sims/ui';

const REDUCED = (() => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();

interface Session {
  prize: Prize;
  mod: SimModule | null;
  raf: number;
  tab: Tab;
  paused: boolean;
  done: Set<string>;
  results: Record<string, string>;
  observer: MutationObserver;
  els: { stage: HTMLElement; controls: HTMLElement; tabs: HTMLElement; explain: HTMLElement; play: HTMLButtonElement; reset: HTMLButtonElement };
}

let cur: Session | null = null;
let lang: Lang = 'ko';
let S: Strings;
let notify: (msg: string) => void = () => {};
// 수식 라이브러리는 무거워서 체험을 열 때만 불러온다.
let renderMath: ((html: string) => string) | null = null;
const plain = (html: string) => html;

export function isOpen(prize: Prize): boolean {
  return !!cur && cur.prize === prize;
}

/** 체험 화면 본문을 root 안에 만들고 모듈을 불러와 실행한다. */
export function mountExperiment(
  root: HTMLElement,
  prize: Prize,
  opts: { lang: Lang; strings: Strings; toast: (msg: string) => void },
): void {
  closeExperiment();
  lang = opts.lang;
  S = opts.strings;
  notify = opts.toast;

  const stage = h('div', { class: 'stage' }, h('p', { class: 'loading' }, S.loading));
  const controls = h('div', { class: 'ctrls' });
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': S.explainTabs });
  const explain = h('div', { class: 'explain', role: 'tabpanel', id: 'explain', tabindex: '0' });
  const play = h('button', { class: 'chip', type: 'button' }) as HTMLButtonElement;
  const reset = h('button', { class: 'chip', type: 'button' }) as HTMLButtonElement;
  root.append(
    h('div', { class: 'ov-main' }, stage, h('aside', { class: 'side' }, controls, tabs, explain)),
    h('div', { class: 'ov-bot' }, play, reset),
  );

  const s: Session = {
    prize,
    mod: null,
    raf: 0,
    tab: 'observe',
    paused: REDUCED,
    done: new Set(),
    results: {},
    observer: new MutationObserver(() => s.mod?.setTheme()),
    els: { stage, controls, tabs, explain, play, reset },
  };
  cur = s;

  play.addEventListener('click', () => {
    s.paused = !s.paused;
    paintBar();
  });
  reset.addEventListener('click', () => {
    s.mod?.reset();
  });
  s.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const host: Host = {
    controls,
    reduced: REDUCED,
    complete(id, res) {
      if (res) s.results[id] = res;
      if (!s.done.has(id)) {
        s.done.add(id);
        const m = s.mod?.missions.find((x) => x.id === id);
        notify(`${S.missionDone}: ${m ? m[lang] : id}`);
      }
      if (s.tab === 'interact') renderExplain();
    },
    result(id, res) {
      s.results[id] = res;
      if (s.tab === 'interact') renderExplain();
    },
    isPaused: () => s.paused,
    setPaused(p) {
      s.paused = p;
      paintBar();
    },
  };

  paintBar();
  paintTabs();

  if (!renderMath) {
    import('./sims/math').then((m) => {
      renderMath = m.renderMath;
      if (cur === s) renderExplain();
    });
  }

  loadSim(prize.sim).then((factory) => {
    if (cur !== s || !factory) return;
    stage.replaceChildren();
    s.mod = factory();
    s.mod.mount(stage, { lang, host });
    renderExplain();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // 탭이 보이지 않으면 시간을 멈춘다.
      s.mod?.frame(s.paused || document.hidden ? 0 : dt);
      s.raf = requestAnimationFrame(loop);
    };
    s.raf = requestAnimationFrame(loop);
  });
}

export function closeExperiment(): void {
  const s = cur;
  if (!s) return;
  cur = null;
  cancelAnimationFrame(s.raf);
  s.observer.disconnect();
  try {
    s.mod?.destroy();
  } catch (e) {
    console.error(e);
  }
}

function paintBar(): void {
  const s = cur;
  if (!s) return;
  s.els.play.textContent = s.paused ? `▶ ${S.play}` : `❚❚ ${S.pause}`;
  s.els.reset.textContent = `↺ ${S.reset}`;
}

function paintTabs(): void {
  const s = cur;
  if (!s) return;
  const keys: Tab[] = ['observe', 'interact', 'understand'];
  s.els.tabs.replaceChildren(
    ...keys.map((k) => {
      const b = h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(s.tab === k), 'aria-controls': 'explain' }, S[k]);
      b.addEventListener('click', () => {
        s.tab = k;
        s.mod?.setTab(k);
        paintTabs();
        renderExplain();
      });
      return b;
    }),
  );
}

function renderExplain(): void {
  const s = cur;
  if (!s || !s.mod) return;
  const c = s.mod.content[lang];
  const box = s.els.explain;
  if (s.tab === 'interact') {
    box.replaceChildren(
      h('p', null, c.interact),
      h(
        'ul',
        { class: 'missions' },
        s.mod.missions.map((m) => {
          const done = s.done.has(m.id);
          return h(
            'li',
            { class: done ? 'done' : '' },
            h('div', { class: 'mh' }, h('span', { class: 'ck', 'aria-hidden': 'true' }, done ? '✓' : ''), h('span', null, m[lang], done ? h('span', { class: 'sr' }, ` (${S.done})`) : null)),
            s.results[m.id] ? h('div', { class: 'res' }, s.results[m.id]) : null,
            h('details', null, h('summary', null, S.hint), m[`hint_${lang}`]),
          );
        }),
      ),
    );
  } else if (s.tab === 'understand') {
    box.innerHTML = (renderMath ?? plain)(c.understand);
    box.append(h('p', null, h('a', { href: s.prize.official_url, target: '_blank', rel: 'noopener' }, S.official)));
  } else {
    box.innerHTML = (renderMath ?? plain)(c.observe);
  }
}
