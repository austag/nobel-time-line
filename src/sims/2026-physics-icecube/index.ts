// 2026 물리학: 남극 얼음 속 중성미자 사냥 (명세: prizes/2026/physics.md)
// 다섯 장으로 연구 과정을 따라간다: 원리 → 검출기 → 신호 고르기 → 재구성 → 발견
import { makeCanvas, readPalette, type Canvas, type Palette } from '../canvas';
import type { Host, Lang, SimFactory, SimModule } from '../types';
import type { Chapter, Ctx, Pt } from './chapter';
import { chapter1 } from './ch1-wavefront';
import { chapter2 } from './ch2-design';
import { chapter3 } from './ch3-filter';
import { chapter4 } from './ch4-reco';
import { chapter5 } from './ch5-discovery';

const create: SimFactory = () => {
  const chapters: Chapter[] = [chapter1(), chapter2(), chapter3(), chapter4(), chapter5()];
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
    id: '2026-physics-icecube',
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
          ? '남극 얼음 속 중성미자 검출의 원리와 분석 과정을 직접 재현하였다.'
          : 'I recreated the principle and analysis chain of neutrino detection in Antarctic ice.';
      const tail =
        l === 'ko'
          ? '이로써 체렌코프 빛 한 줄기에서 우주의 중성미자 원천까지 이어지는 연구 과정을 확인하였다.'
          : 'Together these trace the path from a flash of Cherenkov light to a cosmic neutrino source.';
      return [lead, ...parts, tail].join(' ');
    },
    mount(container, o) {
      lang = o.lang;
      host = o.host;
      pal = readPalette();
      cvs = makeCanvas(container, 'IceCube');
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
