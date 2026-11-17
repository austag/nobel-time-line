// 2026 화학: 거울상 분자의 편 가르기 (카강, 소아이)
// 네 장으로 생각의 사슬을 따라간다: 반반의 세계 → 짝을 짓는 촉매 → 되먹임 → 처음 기울인 것
import { makeCanvas, readPalette, type Canvas, type Palette } from '../canvas';
import type { Host, Lang, SimFactory, SimModule } from '../types';
import type { Chapter, Ctx, Pt } from './chapter';
import { chapter1 } from './ch1-half';
import { chapter2 } from './ch2-pairs';
import { chapter3 } from './ch3-feedback';
import { chapter4 } from './ch4-seeds';

const create: SimFactory = () => {
  const chapters: Chapter[] = [chapter1(), chapter2(), chapter3(), chapter4()];
  let cur = chapters[0];
  let host: Host;
  let cvs: Canvas;
  let lang: Lang = 'ko';
  let pal: Palette;
  const ctxs = new Map<string, Ctx>();

  const ctxFor = (ch: Chapter): Ctx => {
    let c = ctxs.get(ch.id);
    if (!c) {
      c = {
        cvs,
        host,
        lang: () => lang,
        pal: () => pal,
        note: (key, ko, en) => host.note(ch.id, key, lang === 'ko' ? ko : en),
      };
      ctxs.set(ch.id, c);
    }
    return c;
  };

  const local = (e: PointerEvent): Pt => {
    const r = cvs.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function enter(ch: Chapter): void {
    cur.leave?.();
    cur = ch;
    cur.enter(ctxFor(cur));
  }

  const mod: SimModule = {
    id: '2026-chemistry-soai',
    chapters: chapters.map((c) => ({ id: c.id, ko: c.ko, en: c.en })),
    chapter: () => cur.id,
    setChapter(id) {
      const ch = chapters.find((c) => c.id === id);
      if (ch && ch !== cur) enter(ch);
    },
    missions: () => cur.missions,
    content: (l) => cur.content[l],
    abstract(l, notes) {
      const parts = chapters.flatMap((c) => Object.values(notes[c.id] ?? {}));
      const lead =
        l === 'ko'
          ? '거울상 분자의 작은 치우침이 어떻게 한쪽 손만 남는 결과로 커지는지 직접 재현하였다.'
          : 'I recreated how a small imbalance between mirror-image molecules grows until only one hand remains.';
      const tail =
        l === 'ko'
          ? '이로써 카강의 비선형 효과와 소아이의 자기촉매 반응이 생명의 한쪽 손 수수께끼에 어떤 실마리를 주는지 확인하였다.'
          : 'Together these show what Kagan\'s non-linear effects and Soai\'s autocatalysis suggest about why life is one-handed.';
      return [lead, ...parts, tail].join(' ');
    },
    mount(container, o) {
      lang = o.lang;
      host = o.host;
      pal = readPalette();
      cvs = makeCanvas(container, o.lang === 'ko' ? '거울상 분자 실험' : 'Mirror molecule experiment');
      cvs.cv.addEventListener('pointerdown', (e) => {
        try {
          cvs.cv.setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
        cur.down?.(local(e));
      });
      cvs.cv.addEventListener('pointermove', (e) => cur.move?.(local(e)));
      cvs.cv.addEventListener('pointerup', (e) => cur.up?.(local(e)));
      cvs.cv.addEventListener('pointercancel', (e) => cur.up?.(local(e)));
      const start = chapters.find((c) => c.id === o.chapter) ?? chapters[0];
      cur = start;
      cur.enter(ctxFor(cur));
      if (host.reduced) host.setPaused(true);
    },
    frame(dt) {
      cur.frame(dt);
    },
    setTab() {},
    setLang(l) {
      lang = l;
      cur.panel();
    },
    setTheme() {
      pal = readPalette();
    },
    reset() {
      cur.reset();
    },
    destroy() {
      cur.leave?.();
      cvs.destroy();
    },
  };
  return mod;
};

export default create;
