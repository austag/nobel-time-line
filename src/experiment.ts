// 체험 화면: 장 선택, 캔버스, 컨트롤, 해설 탭(관찰, 조작, 이해), 연구 노트, 재생과 초기화 (SPEC.md 6.1, 6.2)
import type { Prize } from './data';
import type { Lang, Strings } from './i18n';
import { qrrFor } from './qrr';
import { loadSim } from './sims/registry';
import type { Host, Notes, SimModule, Tab } from './sims/types';
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
  notes: Notes;
  observer: MutationObserver;
  onChapter: (id: string) => void;
  els: {
    chapters: HTMLElement;
    qrr: HTMLElement;
    stage: HTMLElement;
    controls: HTMLElement;
    tabs: HTMLElement;
    explain: HTMLElement;
    notebook: HTMLElement;
    play: HTMLButtonElement;
    reset: HTMLButtonElement;
  };
}

let cur: Session | null = null;
let lang: Lang = 'ko';
let S: Strings;
let notify: (msg: string) => void = () => {};
// 수식 라이브러리는 무거워서 체험을 열 때만 불러온다.
let renderMath: ((html: string) => string) | null = null;
const plain = (html: string) => html;

const notesKey = (sim: string) => `notes:${sim}`;
function loadNotes(sim: string): Notes {
  try {
    return JSON.parse(localStorage.getItem(notesKey(sim)) ?? '{}') as Notes;
  } catch {
    return {};
  }
}
function saveNotes(sim: string, notes: Notes): void {
  try {
    localStorage.setItem(notesKey(sim), JSON.stringify(notes));
  } catch {
    /* 저장 실패는 무시한다 */
  }
}

export function isOpen(prize: Prize): boolean {
  return !!cur && cur.prize === prize;
}

/** 열려 있는 체험의 장을 바꾼다 (주소로 장이 바뀐 경우) */
export function showChapter(id: string | undefined): void {
  const s = cur;
  if (!s?.mod?.setChapter || !id || s.mod.chapter?.() === id) return;
  if (!s.mod.chapters?.some((c) => c.id === id)) return;
  s.mod.setChapter(id);
  afterChapter();
}

/** 체험 화면 본문을 root 안에 만들고 모듈을 불러와 실행한다. */
export function mountExperiment(
  root: HTMLElement,
  prize: Prize,
  opts: { lang: Lang; strings: Strings; toast: (msg: string) => void; chapter?: string; onChapter: (id: string) => void },
): void {
  closeExperiment();
  lang = opts.lang;
  S = opts.strings;
  notify = opts.toast;

  const chapters = h('nav', { class: 'chapters', 'aria-label': S.chapters, hidden: true });
  const stage = h('div', { class: 'stage' }, h('p', { class: 'loading' }, S.loading));
  const controls = h('div', { class: 'ctrls' });
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': S.explainTabs });
  const explain = h('div', { class: 'explain', role: 'tabpanel', id: 'explain', tabindex: '0' });
  const notebook = h('section', { class: 'notebook', hidden: true });
  const qrr = h('section', { class: 'qrr', hidden: true, 'aria-live': 'polite' });
  const play = h('button', { class: 'chip', type: 'button' }) as HTMLButtonElement;
  const reset = h('button', { class: 'chip', type: 'button' }) as HTMLButtonElement;
  root.append(
    chapters,
    h('div', { class: 'ov-main' }, stage, h('aside', { class: 'side' }, qrr, controls, tabs, explain, notebook)),
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
    notes: loadNotes(prize.sim),
    observer: new MutationObserver(() => s.mod?.setTheme()),
    onChapter: opts.onChapter,
    els: { chapters, qrr, stage, controls, tabs, explain, notebook, play, reset },
  };
  cur = s;

  play.addEventListener('click', () => {
    s.paused = !s.paused;
    paintBar();
  });
  reset.addEventListener('click', () => s.mod?.reset());
  s.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const host: Host = {
    controls,
    reduced: REDUCED,
    complete(id, res) {
      if (res) s.results[id] = res;
      if (!s.done.has(id)) {
        s.done.add(id);
        const m = s.mod?.missions().find((x) => x.id === id);
        notify(`${S.missionDone}: ${m ? m[lang] : id}`);
      }
      if (s.tab === 'interact') renderExplain();
      renderQrr();
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
    note(chapter, key, text) {
      (s.notes[chapter] ??= {})[key] = text;
      saveNotes(s.prize.sim, s.notes);
      renderNotebook();
      renderQrr();
    },
    toast: (m) => notify(m),
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
    s.mod.mount(stage, { lang, host, chapter: opts.chapter });
    renderExplain();
    renderNotebook();
    renderQrr();
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

function afterChapter(): void {
  const s = cur;
  if (!s) return;
  s.tab = 'observe';
  s.mod?.setTab('observe');
  paintTabs();
  renderExplain();
  renderNotebook();
  renderQrr();
  s.els.explain.scrollTop = 0;
}

function paintChapters(): void {
  const s = cur;
  const list = s?.mod?.chapters;
  if (!s || !list) return;
  const now = s.mod!.chapter?.();
  s.els.chapters.hidden = false;
  s.els.chapters.replaceChildren(
    ...list.map((c, i) => {
      const noted = Object.keys(s.notes[c.id] ?? {}).length > 0;
      const b = h(
        'button',
        { class: 'chap', type: 'button', 'aria-pressed': String(c.id === now) },
        h('span', { class: 'chap-no' }, String(i + 1)),
        h('span', null, c[lang]),
        noted ? h('span', { class: 'chap-ck', title: S.noted }, '✓') : null,
      );
      b.addEventListener('click', () => {
        if (c.id === s.mod?.chapter?.()) return;
        s.mod?.setChapter?.(c.id);
        s.onChapter(c.id);
        afterChapter();
      });
      return b;
    }),
  );
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
  const c = s.mod.content(lang);
  const box = s.els.explain;
  const math = renderMath ?? plain;
  if (s.tab === 'interact') {
    box.replaceChildren(
      h('p', null, c.interact),
      h(
        'ul',
        { class: 'missions' },
        s.mod.missions().map((m) => {
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
    box.innerHTML = math(c.understand);
    box.append(h('p', null, h('a', { href: s.prize.official_url, target: '_blank', rel: 'noopener' }, S.official)));
  } else {
    box.innerHTML = math(c.observe);
  }
}

function renderNotebook(): void {
  const s = cur;
  const mod = s?.mod;
  if (!s || !mod?.chapters) return;
  const box = s.els.notebook;
  box.hidden = false;
  const items = mod.chapters
    .map((c, i) => {
      const lines = Object.values(s.notes[c.id] ?? {});
      if (!lines.length) return null;
      return h('li', null, h('span', { class: 'nb-ch' }, `${i + 1}. ${c[lang]}`), h('ul', null, lines.map((t) => h('li', null, t))));
    })
    .filter((x): x is HTMLElement => !!x);
  const all = mod.chapters.every((c) => Object.keys(s.notes[c.id] ?? {}).length > 0);
  const clear = h('button', { class: 'btn-text nb-clear', type: 'button' }, S.clearNotes);
  clear.addEventListener('click', () => {
    s.notes = {};
    saveNotes(s.prize.sim, s.notes);
    renderNotebook();
    renderQrr();
  });
  const kids: HTMLElement[] = [h('h3', null, S.notebook), items.length ? h('ol', { class: 'nb-list' }, items) : h('p', { class: 'nb-empty' }, S.notebookEmpty)];
  if (all && mod.abstract) kids.push(h('div', { class: 'abstract' }, h('h4', null, S.abstract), h('p', null, mod.abstract(lang, s.notes))));
  if (items.length) kids.push(clear);
  box.replaceChildren(...kids);
  paintChapters();
}

/** 지금 장의 질문, 연구(진행한 단계), 결과(내가 잰 값으로 채운 노트) */
function renderQrr(): void {
  const s = cur;
  const mod = s?.mod;
  if (!s || !mod) return;
  const box = s.els.qrr;
  const ch = mod.chapter?.();
  const qr = qrrFor(s.prize.sim, ch, lang);
  if (!qr) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const ms = mod.missions();
  const n = ms.filter((m) => s.done.has(m.id)).length;
  const steps = h(
    'p',
    { class: 'qrr-steps' },
    h('span', null, `${S.qrrSteps} ${n}/${ms.length}`),
    ...ms.map((m, i) => h('span', { class: `ck${s.done.has(m.id) ? ' done' : ''}`, title: m[lang], 'aria-hidden': 'true' }, s.done.has(m.id) ? '✓' : String(i + 1))),
  );
  const lines = Object.values((ch && s.notes[ch]) || {});
  box.replaceChildren(
    h('div', { class: 'qrr-item qrr-q' }, h('h3', null, S.qrrQuestion), h('p', null, qr.q)),
    h('div', { class: 'qrr-item' }, h('h3', null, S.qrrResearch), h('p', null, qr.r), steps),
    h('div', { class: `qrr-item qrr-res${lines.length ? '' : ' is-empty'}` }, h('h3', null, S.qrrResult), ...(lines.length ? lines.map((t) => h('p', null, t)) : [h('p', null, S.qrrResultEmpty)])),
  );
}
