// 2장: 개구리 알 속의 스위치 (나겔의 증명).
// 한 알에만 채널로돕신 유전자(RNA)를 넣고, 빛을 비춰 두 알의 전류를 비교한다. 색을 바꿔 가며 어떤 빛에 열리는지 찾는다.
import { TAU, alpha, clamp, text } from '../canvas';
import { hold, readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { beam, caption, dial, dialHit, egg, inBox, pulse, trace, type Box, type Dial } from './draw';
import { HUES, OOCYTE_MAX_NA, gateStep, rng, sensitivity, type Hue } from './model';

interface Egg {
  gene: boolean;
  grow: number; // 0~1, 단백질이 막에 자리 잡은 정도
  p: number;
  trace: number[];
}

const SAMPLES = 260;
const SAMPLE_DT = 0.025; // 초
const GROW_TIME = 2.5; // "하루"를 화면에서 보여 주는 초
const fmtNA = (v: number) => `${Math.round(v)} nA`;

export function chapter2(): Chapter {
  let ctx: Ctx;
  const st = {
    eggs: [] as Egg[],
    hue: HUES[1] as Hue,
    lightOn: false,
    lampHeld: false,
    onT: 0,
    acc: 0,
    pred: null as number | null,
    spec: new Map<string, number>(), // 색 id → 열린 정도의 최댓값
    flashes: 0,
    flashPeak: 0,
    lastOn: false,
    flashPending: false,
    lampByCanvas: false,
    compared: false,
    drag: null as null | { kind: 'syringe'; p: Pt } | { kind: 'dial' },
    ions: [] as { x: number; y: number; ch: number }[],
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; pred?: ReturnType<typeof slider>; lamp?: ReturnType<typeof hold> };

  function fresh(): void {
    st.eggs = [0, 1].map(() => ({ gene: false, grow: 0, p: 0, trace: new Array(SAMPLES).fill(0) }));
    st.spec.clear();
    st.flashes = 0;
    st.compared = false;
    st.ions = [];
  }

  const ready = (e: Egg) => e.gene && e.grow >= 1;
  const geneEgg = () => st.eggs.find(ready);
  const amps = (e: Egg) => OOCYTE_MAX_NA * e.p * e.grow * (e.gene ? 1 : 0);

  function inject(i: number): void {
    const e = st.eggs[i];
    if (e.gene) return;
    if (st.eggs.every((x) => x.gene)) return;
    if (st.eggs.filter((x) => x.gene).length === 1) {
      ctx.host.toast(tr(ctx, '한 알은 비교용으로 그대로 두는 게 좋아요.', 'Keep one egg untouched to compare with.'));
      return;
    }
    e.gene = true;
    e.grow = 0;
    st.idle = 0;
    check();
  }

  // ---------- 판정 ----------
  function check(): void {
    const g = geneEgg();
    const ctrl = st.eggs.find((e) => !e.gene);
    const pred = st.pred;
    if (g && ctrl && st.lightOn && st.onT > 0.5 && st.hue.id === 'blue') {
      st.compared = true;
      const got = amps(g);
      ctx.host.complete('c2m1', tr(ctx, `유전자 넣은 알 ${fmtNA(got)}, 안 넣은 알 0 nA${pred != null ? `, 내 예상 ${fmtNA(pred)}` : ''}`, `Injected egg ${fmtNA(got)}, plain egg 0 nA${pred != null ? `, my guess ${fmtNA(pred)}` : ''}`));
      ctx.note('oocyte', `채널로돕신 유전자를 넣은 개구리 알에만 파란 빛을 비추자 ${fmtNA(got)}의 전류가 흘렀다${pred != null ? ` (예상 ${fmtNA(pred)})` : ''}. 유전자를 넣지 않은 알은 아무 반응이 없었다. 빛을 받는 단백질 하나가 곧 이온의 문이었다.`, `Only the egg given the channelrhodopsin gene passed current (${fmtNA(got)}) under blue light${pred != null ? `; I had guessed ${fmtNA(pred)}` : ''}. The plain egg did nothing. One light-catching protein was itself the ion gate.`);
    } else if (pred == null) ctx.host.result('c2m1', tr(ctx, '먼저 계기판에 예상을 놓으세요', 'First set a guess on the dial'));
    else if (!st.eggs.some((e) => e.gene)) ctx.host.result('c2m1', tr(ctx, '주사기를 알 하나에 끌어 놓으세요', 'Drag the syringe onto one egg'));
    else if (!g) ctx.host.result('c2m1', tr(ctx, '단백질이 막에 자리 잡는 중', 'Protein is reaching the membrane'));
    else if (st.hue.id !== 'blue') ctx.host.result('c2m1', tr(ctx, '파란 빛으로 비교해 보세요', 'Compare under blue light'));

    const n = st.spec.size;
    if (n >= 4 && st.spec.has('blue')) {
      let best = 'blue';
      for (const [id, v] of st.spec) if (v > (st.spec.get(best) ?? 0)) best = id;
      const h = HUES.find((x) => x.id === best)!;
      ctx.host.complete('c2m2', tr(ctx, `${n}가지 색 중 ${h.ko}에서 가장 잘 열림`, `Of ${n} colours, ${h.en} opens it best`));
      ctx.note('spectrum', `빛 색을 ${n}가지로 바꿔 보니 ${h.ko}(${h.nm} nm)에서 문이 가장 잘 열렸고, 노랑과 빨강에서는 거의 열리지 않았다.`, `Across ${n} colours the gate opened best in ${h.en.toLowerCase()} (${h.nm} nm) and hardly at all in yellow or red.`);
    } else ctx.host.result('c2m2', tr(ctx, `비춰 본 색 ${n}/4`, `Colours tried ${n}/4`));

    if (st.flashes >= 3) {
      ctx.host.complete('c2m3', tr(ctx, `깜빡임 ${st.flashes}번, 봉우리 ${st.flashes}개`, `${st.flashes} flashes, ${st.flashes} peaks`));
      ctx.note('fast', '빛을 깜빡이자 전류도 켜졌다 꺼졌다를 그대로 따라 했다. 빛을 끄면 문이 곧바로 닫혔다.', 'Flashing the light made the current switch on and off with it. When the light went off, the gate closed at once.');
    } else ctx.host.result('c2m3', tr(ctx, `전류 봉우리 ${st.flashes}/3`, `Current peaks ${st.flashes}/3`));
  }

  // ---------- 컨트롤 ----------
  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const row = (...els: HTMLElement[]) => {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
      d.append(...els);
      return d;
    };
    ui = {
      ro: readout(),
      pred: slider({
        label: ko ? '내 예상: 파란 빛에 흐를 전류' : 'My guess: current under blue light',
        min: 0,
        max: OOCYTE_MAX_NA,
        step: 10,
        value: st.pred ?? 0,
        fmt: fmtNA,
        onInput: (v) => {
          st.pred = v;
          check();
        },
      }),
      lamp: hold({
        label: ko ? '빛 비추기 (누르고 있기)' : 'Shine light (hold)',
        onChange: (on) => {
          st.lampHeld = on;
          st.idle = 0;
        },
      }),
    };
    const hue = segment({
      label: ko ? '빛 색' : 'Light colour',
      options: HUES.map((h) => ({ v: h.id, label: `${ko ? h.ko : h.en} ${h.nm}` })),
      value: st.hue.id,
      onChange: (v) => {
        st.hue = HUES.find((h) => h.id === v)!;
        st.onT = 0;
        st.idle = 0;
      },
    });
    ctx.host.controls.append(
      ui.pred!.el,
      row(stepButton({ label: ko ? '오른쪽 알에 유전자 넣기' : 'Inject the right egg', onClick: () => inject(1) }).el, stepButton({ label: ko ? '새 알로 바꾸기' : 'Fresh eggs', onClick: () => (fresh(), check()) }).el),
      hue.el,
      ui.lamp!.el,
      ui.ro.el,
    );
  }

  // ---------- 배치 ----------
  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 60 : 56;
    const leftW = narrow ? W : W * 0.6;
    const lamp: Box = { x: leftW / 2 - 34, y: top, w: 68, h: 26 };
    const er = Math.min(leftW * 0.12, (H - top) * (narrow ? 0.065 : 0.12));
    const ey = lamp.y + lamp.h + er * 1.9;
    const eggs = [
      { x: leftW * 0.3, y: ey },
      { x: leftW * 0.7, y: ey },
    ];
    const syr: Box = { x: 12, y: ey - er, w: Math.max(26, leftW * 0.07), h: er * 2 };
    const ty = ey + er + (narrow ? 40 : 46);
    const th = narrow ? Math.min(44, (H - ty) * 0.14) : Math.min(150, (H - ty) * 0.45);
    const traces: Box[] = [
      { x: 16, y: ty, w: leftW / 2 - 28, h: th },
      { x: leftW / 2 + 12, y: ty, w: leftW / 2 - 28, h: th },
    ];
    if (!narrow) {
      const colX = leftW + 14;
      const colW = W - colX - 16;
      const dr = Math.min(colW * 0.24, (H - top) * 0.12);
      const d: Dial = { cx: colX + colW / 2, cy: top + dr + 26, r: dr, min: 0, max: OOCYTE_MAX_NA, ticks: [0, 100, 200, 300, 400], fmt: fmtNA };
      const mem: Box = { x: colX, y: d.cy + 58, w: colW, h: Math.min(130, (H - d.cy) * 0.3) };
      const sp: Box = { x: colX + 30, y: mem.y + mem.h + 40, w: colW - 40, h: Math.min(200, Math.max(60, H - mem.y - mem.h - 90)) };
      const sy = ty + th + 40;
      return { W, H, narrow, top, lamp, er, eggs, syr, traces, d, mem, sp, note: sy };
    }
    const y2 = ty + th + 30;
    const dr = Math.min(W * 0.12, 34);
    const d: Dial = { cx: W - dr - 44, cy: y2 + dr + 16, r: dr, min: 0, max: OOCYTE_MAX_NA, ticks: [0, 400], fmt: fmtNA };
    const mem: Box = { x: 10, y: y2, w: W - dr * 2 - 100, h: dr * 1.8 };
    const sy = Math.max(d.cy + 48, mem.y + mem.h + 26);
    const sp: Box = { x: 36, y: sy, w: W - 56, h: Math.max(40, H - sy - 42) };
    return { W, H, narrow, top, lamp, er, eggs, syr, traces, d, mem, sp, note: 0 };
  };

  // ---------- 매 프레임 ----------
  function step(dt: number): void {
    if (dt === 0) return;
    const on = st.lampHeld;
    st.lightOn = on;
    st.onT = on ? st.onT + dt : 0;
    const drive = on ? sensitivity(st.hue.nm) : 0;
    for (const e of st.eggs) {
      if (e.gene && e.grow < 1) {
        e.grow = Math.min(1, e.grow + dt / GROW_TIME);
        if (e.grow >= 1) check();
      }
      // 실제 시간은 ms. 한 프레임을 여러 조각으로 나눠 진행한다.
      const ms = dt * 1000;
      const n = Math.ceil(ms / 0.5);
      for (let i = 0; i < n; i++) e.p = gateStep(e.p, e.gene ? drive : 0, ms / n);
    }
    st.acc += dt;
    while (st.acc >= SAMPLE_DT) {
      st.acc -= SAMPLE_DT;
      for (const e of st.eggs) {
        e.trace.push(amps(e) / OOCYTE_MAX_NA);
        e.trace.shift();
      }
    }
    const g = geneEgg();
    if (g) {
      if (on && st.onT > 0.3) {
        const prev = st.spec.get(st.hue.id) ?? 0;
        if (g.p > prev + 0.001) st.spec.set(st.hue.id, g.p);
      }
      // 깜빡임 세기: 켜져서 크게 흐른 뒤, 꺼지고 다시 거의 0으로 돌아오면 하나
      if (on) st.flashPeak = Math.max(st.flashPeak, g.p);
      if (!on && st.lastOn && st.flashPeak > 0.4) st.flashPending = true;
      if (st.flashPending && g.p < 0.05) {
        st.flashes++;
        st.flashPending = false;
        st.flashPeak = 0;
      }
    }
    if (on !== st.lastOn || Math.floor(st.t * 4) !== Math.floor((st.t - dt) * 4)) check();
    st.lastOn = on;
    // 이온 구슬
    const r = rng(Math.floor(st.t * 1000));
    const gp = g ? g.p : 0;
    if (gp > 0.05 && r() < gp * dt * 40) st.ions.push({ x: 0, y: 0, ch: Math.floor(r() * 4) });
    for (const ion of st.ions) ion.y += dt * 1.6;
    st.ions = st.ions.filter((i) => i.y < 1);
  }

  // ---------- 그리기 ----------
  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(
      c,
      pal,
      ko ? '주사기를 알 하나에 끌어 유전자를 넣고, 램프를 누르고 있으면 빛이 비칩니다.' : 'Drag the syringe onto one egg, then press and hold the lamp to shine light.',
      16,
      24,
      L.W - 32,
      L.narrow ? 13 : 15,
    );
    // 램프와 빛
    const lightA = st.lightOn ? 1 : 0;
    const by1 = L.eggs[0].y + L.er * 1.2;
    const cxL = (L.eggs[0].x + L.eggs[1].x) / 2;
    beam(c, cxL, L.lamp.y + L.lamp.h, by1, L.lamp.w, L.eggs[1].x - L.eggs[0].x + L.er * 3, st.hue.col, lightA);
    c.fillStyle = st.lightOn ? alpha(st.hue.col, 0.9) : alpha(pal.ink, 0.15);
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(L.lamp.x, L.lamp.y, L.lamp.w, L.lamp.h, 6);
    c.fill();
    c.stroke();
    text(c, pal, ko ? `램프 (${st.hue.ko})` : `lamp (${st.hue.en.toLowerCase()})`, L.lamp.x + L.lamp.w + 8, L.lamp.y + L.lamp.h / 2 + 5, { size: 12 });
    // 알
    st.eggs.forEach((e, i) => {
      const p = L.eggs[i];
      egg(c, pal, p.x, p.y, L.er, e.gene ? e.grow : 0, e.p * e.grow, e.gene && st.lightOn ? st.hue.col : null);
      const lab = e.gene ? (e.grow < 1 ? (ko ? '단백질 만드는 중' : 'making protein') : ko ? '채널로돕신 알' : 'channelrhodopsin egg') : ko ? '그대로 둔 알 (비교용)' : 'plain egg (control)';
      text(c, pal, lab, p.x, p.y + L.er + 16, { size: L.narrow ? 11 : 12, align: 'center', color: e.gene ? pal.blue : pal.ink });
      if (e.gene && e.grow < 1) {
        // 하루가 지나는 시계
        c.strokeStyle = pal.blue;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(p.x, p.y, L.er * 0.35, -Math.PI / 2, -Math.PI / 2 + TAU * e.grow);
        c.stroke();
      }
    });
    // 주사기
    const sx = st.drag?.kind === 'syringe' ? st.drag.p.x - L.syr.w / 2 : L.syr.x;
    const sy = st.drag?.kind === 'syringe' ? st.drag.p.y - L.syr.h / 2 : L.syr.y;
    if (!st.eggs.some((e) => e.gene) || st.drag?.kind === 'syringe') drawSyringe(c, sx, sy, L.syr.w, L.syr.h, ko);
    // 전류 그래프
    st.eggs.forEach((e, i) => {
      const b = L.traces[i];
      trace(c, pal, b, e.trace, { label: ko ? `${i === 0 ? '왼쪽' : '오른쪽'} 알 전류` : `${i === 0 ? 'left' : 'right'} egg current`, zero: 0 });
      text(c, pal, fmtNA(amps(e)), b.x + b.w, b.y - 6, { size: 11, align: 'right', color: pal.blue });
    });
    // 계기판
    const g = geneEgg();
    dial(c, pal, L.d, { value: st.compared && g ? amps(g) : null, pred: st.pred, label: ko ? '파란 빛에 흐를 전류' : 'current under blue' });
    // 막 확대
    drawMembrane(c, L.mem, g ? g.p : 0, !!g, ko);
    // 색 실험 그래프
    drawSpectrum(c, L.sp, ko);
    // 힌트
    if (st.idle > 5) {
      if (st.pred == null) pulse(c, pal, L.d.cx, L.d.cy - L.d.r * 0.5, L.d.r * 0.7, st.t);
      else if (!st.eggs.some((e) => e.gene)) pulse(c, pal, L.syr.x + L.syr.w / 2, L.syr.y + L.syr.h / 2, L.syr.h * 0.7, st.t);
      else if (g && !st.lightOn) pulse(c, pal, L.lamp.x + L.lamp.w / 2, L.lamp.y + L.lamp.h / 2, L.lamp.w * 0.6, st.t);
    }
    ui.ro.set(
      ko
        ? `빛: ${st.lightOn ? `${st.hue.ko} ${st.hue.nm} nm 켜짐` : '꺼짐'}\n왼쪽 알 ${fmtNA(amps(st.eggs[0]))}, 오른쪽 알 ${fmtNA(amps(st.eggs[1]))}\n비춰 본 색 ${st.spec.size}가지, 전류 봉우리 ${st.flashes}개`
        : `Light: ${st.lightOn ? `${st.hue.en} ${st.hue.nm} nm on` : 'off'}\nLeft egg ${fmtNA(amps(st.eggs[0]))}, right egg ${fmtNA(amps(st.eggs[1]))}\nColours tried ${st.spec.size}, current peaks ${st.flashes}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  function drawSyringe(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ko: boolean): void {
    const pal = ctx.pal();
    c.save();
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    const bw = w * 0.6;
    const bx = x + (w - bw) / 2;
    c.fillStyle = alpha(pal.blue, 0.25);
    c.fillRect(bx, y + h * 0.15, bw, h * 0.55);
    c.strokeRect(bx, y + h * 0.15, bw, h * 0.55);
    c.beginPath();
    c.moveTo(x + w / 2, y);
    c.lineTo(x + w / 2, y + h * 0.15);
    c.moveTo(bx - 4, y + 2);
    c.lineTo(bx + bw + 4, y + 2);
    c.moveTo(x + w / 2, y + h * 0.7);
    c.lineTo(x + w / 2, y + h);
    c.stroke();
    c.restore();
    text(c, pal, ko ? '유전자' : 'gene', x + w / 2, y - 6, { size: 11, align: 'center', color: pal.blue });
  }

  function drawMembrane(c: CanvasRenderingContext2D, R: Box, p: number, has: boolean, ko: boolean): void {
    const pal = ctx.pal();
    if (R.h < 40) return;
    text(c, pal, ko ? '알의 막을 크게 본 모습' : 'Close-up of the egg membrane', R.x, R.y - 6, { size: 11 });
    c.strokeStyle = alpha(pal.ink, 0.35);
    c.lineWidth = 1;
    c.strokeRect(R.x, R.y, R.w, R.h);
    const my = R.y + R.h / 2;
    const thick = R.h * 0.18;
    text(c, pal, ko ? '바깥' : 'outside', R.x + 4, R.y + 14, { size: 10 });
    text(c, pal, ko ? '안쪽' : 'inside', R.x + 4, R.y + R.h - 6, { size: 10 });
    const chans = [0.2, 0.4, 0.6, 0.8].map((f) => R.x + R.w * f);
    // 막 (두 줄)
    c.fillStyle = alpha(pal.ink, 0.12);
    c.fillRect(R.x, my - thick / 2, R.w, thick);
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(R.x, my - thick / 2);
    c.lineTo(R.x + R.w, my - thick / 2);
    c.moveTo(R.x, my + thick / 2);
    c.lineTo(R.x + R.w, my + thick / 2);
    c.stroke();
    if (!has) {
      text(c, pal, ko ? '문이 없어요' : 'no gates', R.x + R.w / 2, my + 4, { size: 11, align: 'center' });
      return;
    }
    const cw = Math.min(R.w * 0.09, thick * 1.4);
    for (const x of chans) {
      const gap = cw * 0.15 + cw * 0.3 * p;
      c.fillStyle = alpha(pal.blue, 0.35);
      c.strokeStyle = pal.blue;
      c.lineWidth = 1.5;
      for (const s of [-1, 1]) {
        c.beginPath();
        c.roundRect(x + s * gap - (s > 0 ? 0 : cw * 0.5), my - thick * 0.75, cw * 0.5, thick * 1.5, 3);
        c.fill();
        c.stroke();
      }
      // 레티날 (빛을 받는 부분, 그림이라 빨강)
      c.fillStyle = alpha(pal.red, 0.5 + 0.5 * p);
      c.beginPath();
      c.arc(x, my - thick * 0.9, 2.5, 0, TAU);
      c.fill();
    }
    for (const ion of st.ions) {
      const x = chans[ion.ch];
      const y = R.y + 6 + ion.y * (R.h - 12);
      c.fillStyle = pal.blue;
      c.beginPath();
      c.arc(x, y, 4.5, 0, TAU);
      c.fill();
      text(c, pal, '+', x, y + 3.5, { size: 9, align: 'center', color: pal.surface });
    }
    if (p > 0.05) text(c, pal, ko ? '양이온이 들어와요' : 'positive ions flow in', R.x + R.w - 4, R.y + R.h - 6, { size: 10, align: 'right', color: pal.blue });
  }

  function drawSpectrum(c: CanvasRenderingContext2D, R: Box, ko: boolean): void {
    const pal = ctx.pal();
    if (R.h < 40) return;
    const X = (nm: number) => R.x + ((nm - 390) / (650 - 390)) * R.w;
    const Y = (v: number) => R.y + R.h - v * R.h;
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(R.x, R.y);
    c.lineTo(R.x, R.y + R.h);
    c.lineTo(R.x + R.w, R.y + R.h);
    c.stroke();
    text(c, pal, ko ? '↑ 문이 열린 정도' : '↑ how open', R.x, R.y - 8, { size: 11 });
    text(c, pal, ko ? '빛의 파장 (nm) →' : 'wavelength (nm) →', R.x + R.w, R.y + R.h + 36, { size: 11, align: 'right' });
    for (const h of HUES) {
      c.fillStyle = alpha(h.col, 0.6);
      c.fillRect(X(h.nm) - 6, R.y + R.h + 3, 12, 6);
      text(c, pal, String(h.nm), X(h.nm), R.y + R.h + 22, { size: 10, align: 'center' });
    }
    if (st.spec.size >= 4) {
      c.strokeStyle = alpha(pal.blue, 0.6);
      c.setLineDash([5, 5]);
      c.lineWidth = 2;
      c.beginPath();
      for (let nm = 390; nm <= 650; nm += 4) {
        // 같은 빛 세기에서 정상 상태의 열린 비율
        const d = sensitivity(nm);
        const v = d / (d + 1.5 / 8);
        if (nm === 390) c.moveTo(X(nm), Y(v));
        else c.lineTo(X(nm), Y(v));
      }
      c.stroke();
      c.setLineDash([]);
    }
    for (const [id, v] of st.spec) {
      const h = HUES.find((x) => x.id === id)!;
      c.fillStyle = h.col;
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(X(h.nm), Y(v), 6, 0, TAU);
      c.fill();
      c.stroke();
    }
    if (!st.spec.size) text(c, pal, ko ? '색을 바꿔 비추면 점이 찍혀요' : 'Shine different colours to add points', R.x + R.w / 2, R.y + R.h / 2, { size: 12, align: 'center', color: pal.blue });
  }

  // ---------- 입력 ----------
  function down(p: Pt): void {
    st.idle = 0;
    const L = lay();
    if (inBox(L.lamp, p.x, p.y, 8)) {
      st.lampHeld = true;
      st.lampByCanvas = true;
      return;
    }
    if (!st.eggs.some((e) => e.gene) && inBox(L.syr, p.x, p.y, 10)) {
      st.drag = { kind: 'syringe', p };
      return;
    }
    const v = dialHit(L.d, p.x, p.y);
    if (v != null) {
      st.drag = { kind: 'dial' };
      setPred(v);
      return;
    }
    // 알을 직접 누르면 그 알에 넣기 (끌기와 같은 일)
    L.eggs.forEach((e, i) => {
      if (Math.hypot(p.x - e.x, p.y - e.y) < L.er && !st.eggs.some((x) => x.gene)) inject(i);
    });
  }

  function setPred(v: number): void {
    st.pred = Math.round(clamp(v, 0, OOCYTE_MAX_NA) / 10) * 10;
    ui.pred?.set(st.pred);
    check();
  }

  function move(p: Pt): void {
    if (st.drag?.kind === 'syringe') st.drag.p = p;
    else if (st.drag?.kind === 'dial') {
      const L = lay();
      const v = dialHit({ ...L.d, r: L.d.r * 3 }, p.x, p.y);
      if (v != null) setPred(v);
    }
  }

  function up(p: Pt): void {
    if (st.lampByCanvas) {
      st.lampHeld = false;
      st.lampByCanvas = false;
    }
    if (st.drag?.kind === 'syringe') {
      const L = lay();
      L.eggs.forEach((e, i) => {
        if (Math.hypot(p.x - e.x, p.y - e.y) < L.er * 1.3) inject(i);
      });
    }
    st.drag = null;
  }

  return {
    id: '2',
    ko: '개구리 알 속의 스위치',
    en: 'A switch inside a frog egg',
    missions: [
      {
        id: 'c2m1',
        ko: '전류를 예상한 뒤, 한 알에만 유전자를 넣고 파란 빛을 비춰 두 알의 전류를 비교하라.',
        en: 'Guess the current, give the gene to just one egg, and compare both eggs under blue light.',
        hint_ko: '계기판 바늘을 끌어 예상을 놓고, 주사기를 알에 끌어다 놓으세요. 단백질이 자리 잡으면 램프를 누르고 있으세요.',
        hint_en: 'Drag the dial needle, then drag the syringe onto an egg. Once the protein is in place, hold the lamp.',
      },
      {
        id: 'c2m2',
        ko: '빛 색을 네 가지 이상 바꿔 비춰 보고, 어떤 색에서 문이 가장 잘 열리는지 찾아라.',
        en: 'Try at least four colours of light and find which one opens the gate best.',
        hint_ko: '색을 고른 뒤 램프를 잠깐 누르고 있으면 오른쪽 그래프에 점이 찍힙니다.',
        hint_en: 'Pick a colour and hold the lamp briefly; a point appears on the graph.',
      },
      {
        id: 'c2m3',
        ko: '빛을 세 번 깜빡여, 전류가 빛을 바로 따라오는지 확인하라.',
        en: 'Flash the light three times and see whether the current follows at once.',
        hint_ko: '파란 빛으로 램프를 눌렀다 떼기를 세 번 하세요. 그래프에 봉우리가 생깁니다.',
        hint_en: 'With blue light, press and release the lamp three times. Peaks appear on the graph.',
      },
    ],
    content: {
      ko: {
        observe: `<p>헤게만의 가설은 대담했습니다. 빛을 받는 단백질이 그대로 이온이 지나는 문이라는 것이죠. 그때까지 알려진 이온 채널 가운데 빛에 스스로 반응하는 것은 하나도 없었습니다.</p><p>2001년 헤게만 연구진은 클라미도모나스의 유전자 자료에서 새로운 로돕신 유전자 두 개를 찾았습니다. 게오르크 나겔은 이 유전자를 <b>개구리 알</b>에 넣었습니다. 개구리 알은 크고 튼튼해서, 넣어 준 유전자로 단백질을 만들고 그 전류를 재기 좋습니다.</p><p class="q">알에 빛을 비추면 전류가 흐를까? 흐른다면 얼마나?</p>`,
        interact: '한 알에만 유전자를 넣고, 다른 알은 비교용으로 두세요. 램프를 누르고 있으면 빛이 비칩니다.',
        understand: `<h4>대조군이 말해 주는 것</h4><p>유전자를 넣은 알만 빛에 반응하고 그대로 둔 알은 조용하다면, 전류를 만든 것은 빛 자체도 알 자체도 아니고 새로 만든 단백질입니다. 다른 도움 없이 단백질 하나로 충분하다는 뜻이기도 합니다.</p><h4>채널로돕신</h4><p>단백질 속에는 빛을 받는 작은 분자 <b>레티날</b>이 들어 있습니다. 빛을 받으면 레티날 모양이 바뀌고, 단백질 전체가 비틀리며 막에 구멍이 열립니다. 그 구멍으로 양이온이 들어오면 전기 신호가 생깁니다. 나겔과 헤게만은 이 단백질을 <b>채널로돕신</b>이라 불렀습니다. 2002년에 채널로돕신-1을, 2003년에 양이온을 통과시키는 채널로돕신-2를 보고했습니다.</p><h4>어떤 빛에 열리나</h4><p>채널로돕신-2는 파란 빛(약 470 nm)을 가장 잘 받고, 노랑과 빨강은 거의 받지 못합니다. 문이 열리고 닫히는 속도는 단순하게 이렇게 쓸 수 있습니다.</p>$$\\frac{dp}{dt} = \\frac{s(\\lambda)\\,(1-p)}{\\tau_{\\text{on}}} - \\frac{p}{\\tau_{\\text{off}}}$$<p>$p$는 열린 문의 비율, $s(\\lambda)$는 빛 색에 따른 감도입니다. $\\tau_{\\text{off}}$가 수 밀리초로 짧아서 빛을 끄면 문이 곧바로 닫힙니다.</p><h4>실제와 다른 점</h4><p>전류 크기는 보기 좋게 정한 값이고, 실제 실험에서는 막전위를 고정한 채(전압 고정법) 전류를 쟀습니다. 단백질이 막에 자리 잡는 데는 실제로 하루에서 며칠 걸립니다. 감도 곡선도 단순화했습니다.</p>`,
      },
      en: {
        observe: `<p>Hegemann's idea was bold: the light-catching protein is itself the gate for ions. No known ion channel responded to light on its own.</p><p>In 2001 Hegemann's group found two new rhodopsin genes in Chlamydomonas data. Georg Nagel put these genes into <b>frog eggs</b>. Frog eggs are large and sturdy, good at turning an added gene into protein and easy to measure currents in.</p><p class="q">Will light make current flow through the egg? If so, how much?</p>`,
        interact: 'Give the gene to just one egg and keep the other for comparison. Hold the lamp to shine light.',
        understand: `<h4>What the control tells you</h4><p>If only the injected egg responds and the plain egg stays quiet, the current comes neither from the light nor from the egg, but from the new protein. It also shows one protein is enough, with no helpers.</p><h4>Channelrhodopsin</h4><p>Inside the protein sits a small light-catching molecule, <b>retinal</b>. Light changes its shape, the whole protein twists, and a pore opens in the membrane. Positive ions rush in and make an electrical signal. Nagel and Hegemann named it <b>channelrhodopsin</b>, reporting channelrhodopsin-1 in 2002 and the cation-passing channelrhodopsin-2 in 2003.</p><h4>Which light opens it</h4><p>Channelrhodopsin-2 absorbs blue light (about 470 nm) best and hardly any yellow or red. A simple model of opening and closing:</p>$$\\frac{dp}{dt} = \\frac{s(\\lambda)\\,(1-p)}{\\tau_{\\text{on}}} - \\frac{p}{\\tau_{\\text{off}}}$$<p>$p$ is the open fraction and $s(\\lambda)$ the sensitivity to the colour. $\\tau_{\\text{off}}$ is only milliseconds, so the gate shuts as soon as the light goes off.</p><h4>How this differs from reality</h4><p>The current sizes are chosen for display; the real experiments clamped the membrane voltage while measuring current. The protein actually takes a day or more to reach the membrane, and the sensitivity curve is simplified.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      if (!st.eggs.length) fresh();
      panel();
      check();
    },
    panel,
    frame(dt) {
      st.t += dt;
      st.idle += dt;
      step(dt);
      draw();
    },
    reset() {
      st.pred = null;
      st.hue = HUES[1];
      st.lampHeld = false;
      fresh();
      panel();
      check();
    },
    leave() {
      st.lampHeld = false;
      ui.lamp?.release();
    },
    down,
    move,
    up,
  };
}
