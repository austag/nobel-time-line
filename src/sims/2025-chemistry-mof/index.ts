// 2025 화학: 금속유기골격체 (기타가와, 롭슨, 야기)
// 네 장: 나무 공의 구멍 → 비워도 버티는 틀 → 설계해서 만드는 구멍 → 사막 공기에서 물 얻기
import { makeCanvas, readPalette, type Canvas, type Palette } from '../canvas';
import type { Host, Lang, SimFactory, SimModule } from '../types';
import type { Chapter, Ctx, Pt } from './chapter';
import { chapter1 } from './ch1-assembly';
import { chapter2 } from './ch2-sorption';
import { chapter3 } from './ch3-design';
import { chapter4 } from './ch4-water';

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
    id: '2025-chemistry-mof',
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
          ? '분자로 원하는 모양의 빈 공간을 설계해서 지을 수 있는지 묻기 위해, 롭슨의 자기조립에서 출발해 비워도 버티는 틀의 넓이를 재고, 막대를 바꿔 구멍을 설계하고, 그 구멍으로 사막 공기에서 물을 얻는 과정을 직접 재현하였다.'
          : 'To ask whether empty space can be designed and built from molecules, I started from Robson’s self-assembly, measured the area of a frame that survives emptying, designed pores by swapping struts, and used those pores to pull water from desert air.';
      const tail =
        l === 'ko'
          ? '이로써 기타가와, 롭슨, 야기가 개발한 금속유기골격체가 결합 방향과 막대 길이로 빈 공간을 설계해 짓는 새로운 물질이며, 실제 문제를 푸는 데 쓰이고 있음을 확인하였다.'
          : 'Together these show that the metal–organic frameworks developed by Kitagawa, Robson and Yaghi are a new kind of material whose empty space is designed through bond directions and strut lengths, and that they are already solving real problems.';
      return [lead, ...parts, tail].join(' ');
    },
    mount(container, o) {
      lang = o.lang;
      host = o.host;
      pal = readPalette();
      cvs = makeCanvas(container, o.lang === 'ko' ? '금속유기골격체 실험' : 'Metal–organic framework experiment');
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
      cur = chapters.find((c) => c.id === o.chapter) ?? chapters[0];
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
