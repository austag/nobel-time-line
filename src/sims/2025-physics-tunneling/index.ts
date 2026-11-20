// 2025 물리학: 전기 회로 속 거시 양자 터널링과 에너지 양자화 (클라크, 드보레, 마르티니스)
// 네 장: 벽을 지나가는 파동 → 손에 쥘 수 있는 양자 → 띄엄띄엄한 에너지 → 큐비트로 가는 길
import { makeCanvas, readPalette, type Canvas, type Palette } from '../canvas';
import type { Host, Lang, SimFactory, SimModule } from '../types';
import type { Chapter, Ctx, Pt } from './chapter';
import { chapter1 } from './ch1-wave';
import { chapter2 } from './ch2-mqt';
import { chapter3 } from './ch3-levels';
import { chapter4 } from './ch4-qubit';

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
    id: '2025-physics-tunneling',
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
          ? '양자역학이 얼마나 큰 것까지 통하는지 묻기 위해, 전자 하나의 터널링에서 출발해 손에 쥘 수 있는 초전도 회로가 통째로 터널링하고 정해진 에너지만 갖는 모습을 직접 재현하였다.'
          : 'To ask how large a thing quantum mechanics can govern, I started from a single electron tunnelling and recreated a superconducting circuit you could hold tunnelling as a whole and taking energy only in fixed steps.';
      const tail =
        l === 'ko'
          ? '이로써 클라크, 드보레, 마르티니스가 보인 거시 양자 터널링과 에너지 양자화가, 조정 변수 없이 양자역학과 맞으며 오늘날 초전도 큐비트의 바탕이 되었음을 확인하였다.'
          : 'Together these confirm that the macroscopic quantum tunnelling and energy quantisation shown by Clarke, Devoret and Martinis agree with quantum theory without adjustable parameters, and laid the ground for today\'s superconducting qubits.';
      return [lead, ...parts, tail].join(' ');
    },
    mount(container, o) {
      lang = o.lang;
      host = o.host;
      pal = readPalette();
      cvs = makeCanvas(container, o.lang === 'ko' ? '거시 양자 터널링 실험' : 'Macroscopic quantum tunnelling experiment');
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
