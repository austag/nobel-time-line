// 2026 생리의학: 빛으로 켜는 뉴런 (다이서로스, 헤게만, 나겔)
// 네 장으로 발견의 순서를 따라간다: 빛을 쫓는 조류 → 개구리 알 → 접시 속 신경세포 → 살아 있는 뇌
import { makeCanvas, readPalette, type Canvas, type Palette } from '../canvas';
import type { Host, Lang, SimFactory, SimModule } from '../types';
import type { Chapter, Ctx, Pt } from './chapter';
import { chapter1 } from './ch1-alga';
import { clearTints } from './sprite';
import { chapter2 } from './ch2-oocyte';
import { chapter3 } from './ch3-neuron';
import { chapter4 } from './ch4-brain';

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
    id: '2026-medicine-optogenetics',
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
          ? '연못의 조류가 빛을 느끼는 방식에서 출발해, 빛으로 신경세포를 켜고 끄는 광유전학이 만들어지는 과정을 직접 재현하였다.'
          : 'Starting from how a pond alga senses light, I recreated the steps that led to optogenetics, switching nerve cells on and off with light.';
      const tail =
        l === 'ko'
          ? '이로써 헤게만과 나겔이 찾은 빛으로 여닫히는 이온 채널이, 다이서로스의 손을 거쳐 살아 있는 뇌의 회로를 밝히는 도구가 되었음을 확인하였다.'
          : 'Together these show how the light-gated ion channel found by Hegemann and Nagel became, in Deisseroth\'s hands, a tool for revealing circuits in the living brain.';
      return [lead, ...parts, tail].join(' ');
    },
    mount(container, o) {
      lang = o.lang;
      host = o.host;
      pal = readPalette();
      cvs = makeCanvas(container, o.lang === 'ko' ? '광유전학 실험' : 'Optogenetics experiment');
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
      clearTints(); // 칠해 둔 그림 사본을 새 테마 색으로 다시 만든다
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
