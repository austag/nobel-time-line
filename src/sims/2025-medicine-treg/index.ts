// 2025 생리의학: 말초 면역 관용 (브런코, 램즈델, 사카구치)
// 네 장: 브레이크가 빠진 면역 → 명찰을 보고 세포 골라내기 → 고장 난 설계도 찾기 → 더 밟을까, 풀어 줄까
import { makeCanvas, readPalette, type Canvas, type Palette } from '../canvas';
import { clearTints } from '../2026-medicine-optogenetics/sprite';
import type { Host, Lang, SimFactory, SimModule } from '../types';
import type { Chapter, Ctx, Pt } from './chapter';
import { chapter1 } from './ch1-thymus';
import { chapter2 } from './ch2-sort';
import { chapter3 } from './ch3-gene';
import { chapter4 } from './ch4-therapy';

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
    id: '2025-medicine-treg',
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
          ? '면역이 자기 몸을 공격하지 않는 이유가 가슴샘에서 걸러내는 것만으로 설명되는지 묻기 위해, 가슴샘을 떼는 시점을 바꿔 자가면역을 일으키고, 명찰로 세포를 가려 어느 무리가 공격을 멈추는지 확인하고, 그 세포를 만드는 설계도를 찾아, 그 설계도를 켜고 끄며 치료의 두 방향을 비교하였다.'
          : 'To ask whether selection in the thymus alone explains why immunity spares the body, I caused autoimmunity by changing when the thymus was removed, sorted cells by their tags to find which pile stops the attack, tracked down the blueprint that builds those cells, and switched it on and off to compare the two directions of treatment.';
      const tail =
        l === 'ko'
          ? '이로써 브런코, 램즈델, 사카구치가 밝힌 대로 가슴샘 밖에서도 면역을 멈춰 세우는 조절 T세포가 있고, Foxp3 가 그 세포를 만드는 스위치이며, 이 브레이크를 어느 쪽으로 움직이느냐가 암과 자가면역 치료를 가른다는 것을 확인하였다.'
          : 'Together these confirm what Brunkow, Ramsdell and Sakaguchi established: regulatory T cells stop the immune system outside the thymus, Foxp3 is the switch that builds them, and which way this brake is moved separates the treatment of cancer from that of autoimmunity.';
      return [lead, ...parts, tail].join(' ');
    },
    mount(container, o) {
      lang = o.lang;
      host = o.host;
      pal = readPalette();
      cvs = makeCanvas(container, o.lang === 'ko' ? '말초 면역 관용 실험' : 'Peripheral immune tolerance experiment');
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
      clearTints();
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
