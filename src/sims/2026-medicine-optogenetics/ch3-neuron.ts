// 3장: 신경세포에 불을 켜다 (다이서로스, 2005).
// 쥐 신경세포에 채널로돕신-2 유전자를 넣고, 파란 빛 펄스로 스파이크를 일으킨다. 깜빡임이 빨라지면 어디까지 따라오는지 본다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, slider, stepButton, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { beam, caption, dial, dialHit, inBox, neuron, pulse, trace, type Box, type Dial } from './draw';
import { HUES, NEURON, cellStep, followRate, newCell, type Cell } from './model';

const SLOW = 0.25; // 화면 1초 = 실제 250 ms
const WINDOW = 500; // 그래프에 보이는 실제 ms
const SAMPLE = 1; // ms
const DT = 0.05; // ms
const BLUE = HUES[1].col;
const V_LO = -90;
const V_HI = NEURON.peak + 10;
const vNorm = (v: number) => (v - V_LO) / (V_HI - V_LO);

interface Point {
  f: number;
  rate: number;
}

export function chapter3(): Chapter {
  let ctx: Ctx;
  const st = {
    cell: newCell() as Cell,
    gene: false,
    grow: 0,
    train: false,
    freq: 5,
    flashUntil: -1, // 한 번 깜빡: 이 시각(ms)까지 빛
    simT: 0,
    sampleAcc: 0,
    vTrace: new Array(WINDOW / SAMPLE).fill(vNorm(NEURON.rest)) as number[],
    lTrace: new Array(WINDOW / SAMPLE).fill(0) as number[],
    spikeInSample: false,
    glow: 0,
    // 펄스마다 스파이크 세기
    trainStart: 0,
    pulseIdx: -1,
    pulseSpikes: 0,
    log: [] as boolean[], // 지금 빠르기에서 펄스별 성공
    single: { active: false, spikes: 0, until: 0 },
    singleOk: false,
    points: [] as Point[],
    curve: null as Point[] | null,
    pred: null as number | null,
    drag: null as null | { kind: 'vial'; p: Pt } | { kind: 'dial' },
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; pred?: ReturnType<typeof slider>; train?: ReturnType<typeof toggle>; freq?: ReturnType<typeof slider> };

  const ready = () => st.gene && st.grow >= 1;

  function giveGene(): void {
    if (st.gene) return;
    st.gene = true;
    st.grow = 0;
    st.idle = 0;
    check();
  }

  function flashOnce(): void {
    st.idle = 0;
    if (st.train) return;
    st.flashUntil = st.simT + NEURON.pulse;
    st.single = { active: true, spikes: 0, until: st.simT + 80 };
  }

  function setTrain(on: boolean): void {
    st.train = on;
    st.trainStart = st.simT;
    st.pulseIdx = -1;
    st.pulseSpikes = 0;
    st.log = [];
    st.idle = 0;
  }

  function setFreq(f: number): void {
    st.freq = f;
    st.trainStart = st.simT;
    st.pulseIdx = -1;
    st.pulseSpikes = 0;
    st.log = [];
  }

  const rateNow = () => {
    const last = st.log.slice(-12);
    return last.length ? last.filter(Boolean).length / last.length : null;
  };

  // ---------- 판정 ----------
  function check(): void {
    const ko = k(ctx);
    if (st.singleOk) {
      ctx.host.complete('c3m1', tr(ctx, '빛 한 번에 스파이크 하나', 'One flash, one spike'));
      ctx.note('one', '채널로돕신-2 유전자를 넣은 쥐 신경세포에 5 ms 동안 파란 빛을 비추자 스파이크가 정확히 하나 생겼다.', 'A 5 ms flash of blue light on a rat neuron carrying channelrhodopsin-2 fired exactly one spike.');
    } else if (!st.gene) ctx.host.result('c3m1', tr(ctx, '바이러스 병을 신경세포에 끌어 놓으세요', 'Drag the virus vial onto the neuron'));
    else if (!ready()) ctx.host.result('c3m1', tr(ctx, '채널이 막에 자리 잡는 중', 'Channels are reaching the membrane'));

    const r = rateNow();
    const n = st.log.length;
    if (ready() && st.train && st.freq <= 10 && n >= 10 && r != null && r >= 0.9) {
      ctx.host.complete('c3m2', tr(ctx, `${st.freq} Hz, 성공 ${Math.round(r * 100)}%`, `${st.freq} Hz, ${Math.round(r * 100)}% followed`));
      ctx.note('follow', `${st.freq} Hz로 빛을 깜빡이자 빛마다 스파이크가 하나씩 따라왔다. 밀리초 단위로 신경세포를 조종할 수 있었다.`, `Flashing at ${st.freq} Hz, every flash brought one spike. The neuron could be steered with millisecond timing.`);
    } else if (st.train && st.freq <= 10) ctx.host.result('c3m2', tr(ctx, `깜빡임 ${Math.min(n, 10)}/10${r != null ? `, 성공 ${Math.round(r * 100)}%` : ''}`, `Flashes ${Math.min(n, 10)}/10${r != null ? `, ${Math.round(r * 100)}% followed` : ''}`));
    else ctx.host.result('c3m2', tr(ctx, '10 Hz 이하로 연속 깜빡임을 켜세요', 'Switch on flashing at 10 Hz or slower'));

    const fails = st.points.filter((p) => p.rate < 0.8);
    if (st.pred != null && st.points.length >= 3 && fails.length) {
      const lim = Math.min(...fails.map((p) => p.f));
      ctx.host.complete('c3m3', tr(ctx, `${lim} Hz부터 놓침, 내 예상 ${Math.round(st.pred)} Hz`, `Misses from ${lim} Hz, my guess ${Math.round(st.pred)} Hz`));
      ctx.note('limit', `깜빡임을 빠르게 하자 ${lim} Hz 무렵부터 스파이크가 빠지기 시작했다. 처음 예상은 ${Math.round(st.pred)} Hz였다. 문이 닫히는 데 걸리는 몇 밀리초가 빠르기의 한계를 정했다.`, `Faster flashing began to drop spikes around ${lim} Hz; I had guessed ${Math.round(st.pred)} Hz. The few milliseconds the gate needs to close set the limit.`);
      if (!st.curve) {
        const pts: Point[] = [];
        for (let f = 2; f <= 60; f += 2) pts.push({ f, rate: followRate(f, 20) });
        st.curve = pts;
      }
    } else if (st.pred == null) ctx.host.result('c3m3', tr(ctx, '먼저 계기판에 예상을 놓으세요', 'First set a guess on the dial'));
    else ctx.host.result('c3m3', ko ? `찍은 점 ${st.points.length}/3${st.points.length >= 3 ? ', 더 빠르게도 해 보세요' : ''}` : `Points ${st.points.length}/3${st.points.length >= 3 ? ', try faster too' : ''}`);
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
        label: ko ? '내 예상: 몇 Hz까지 하나하나 따라올까' : 'My guess: up to how many Hz will it follow',
        min: 1,
        max: 60,
        step: 1,
        value: st.pred ?? 1,
        unit: ' Hz',
        onInput: (v) => {
          st.pred = v;
          check();
        },
      }),
      train: toggle({
        label: ko ? '연속 깜빡임' : 'Pulse train',
        on: st.train,
        onText: ko ? '켜짐' : 'On',
        offText: ko ? '꺼짐' : 'Off',
        onChange: (v) => setTrain(v),
      }),
      freq: slider({
        label: ko ? '깜빡임 빠르기' : 'Flash rate',
        min: 1,
        max: 60,
        step: 1,
        value: st.freq,
        unit: ' Hz',
        onInput: (v) => setFreq(v),
      }),
    };
    ctx.host.controls.append(
      ui.pred!.el,
      row(stepButton({ label: ko ? '유전자 넣기' : 'Deliver the gene', onClick: giveGene }).el, stepButton({ label: ko ? '한 번 깜빡' : 'Single flash', onClick: flashOnce }).el),
      ui.train!.el,
      ui.freq!.el,
      ui.ro.el,
    );
  }

  // ---------- 배치 ----------
  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 60 : 56;
    const leftW = narrow ? W : W * 0.6;
    const dishH = narrow ? (H - top) * 0.3 : (H - top) * 0.45;
    const nr = Math.min(leftW * 0.045, dishH * 0.1);
    const cell = { x: leftW * 0.4, y: top + dishH * 0.58 };
    const neighbor = { x: leftW * 0.72, y: top + dishH * 0.32 };
    const vial: Box = { x: 14, y: top + dishH * 0.35, w: Math.max(26, nr * 1.6), h: Math.max(40, nr * 2.6) };
    const ty = top + dishH + 26;
    const th = narrow ? Math.min(90, (H - ty) * 0.3) : Math.min(150, (H - ty) * 0.6);
    const lightB: Box = { x: 16, y: ty, w: leftW - 32, h: 16 };
    const vB: Box = { x: 16, y: ty + 26, w: leftW - 32, h: th };
    if (!narrow) {
      const colX = leftW + 14;
      const colW = W - colX - 16;
      const dr = Math.min(colW * 0.24, (H - top) * 0.12);
      const d: Dial = { cx: colX + colW / 2, cy: top + dr + 26, r: dr, min: 1, max: 60, ticks: [1, 20, 40, 60], fmt: (v) => `${Math.round(v)} Hz` };
      const cy0 = d.cy + 80;
      const cv: Box = { x: colX + 30, y: cy0, w: colW - 40, h: Math.min(colW - 40, H - cy0 - 40) };
      return { W, H, narrow, top, leftW, dishH, nr, cell, neighbor, vial, lightB, vB, d, cv };
    }
    const y2 = vB.y + vB.h + 30;
    const dr = Math.min(W * 0.15, (H - y2) * 0.2);
    const d: Dial = { cx: W * 0.22, cy: y2 + dr + 14, r: dr, min: 1, max: 60, ticks: [1, 30, 60], fmt: (v) => `${Math.round(v)} Hz` };
    const cv: Box = { x: W * 0.46, y: y2, w: W * 0.54 - 16, h: Math.max(50, H - y2 - 34) };
    return { W, H, narrow, top, leftW, dishH, nr, cell, neighbor, vial, lightB, vB, d, cv };
  };

  // ---------- 매 프레임 ----------
  function lightAt(t: number): number {
    if (st.train) {
      const period = 1000 / st.freq;
      return (t - st.trainStart) % period < NEURON.pulse ? 1 : 0;
    }
    return t < st.flashUntil ? 1 : 0;
  }

  function step(dt: number): void {
    if (dt === 0) return;
    if (st.gene && st.grow < 1) {
      st.grow = Math.min(1, st.grow + dt / 2);
      if (st.grow >= 1) check();
    }
    const ms = Math.min(dt, 0.1) * 1000 * SLOW;
    const n = Math.round(ms / DT);
    let changed = false;
    for (let i = 0; i < n; i++) {
      const L = lightAt(st.simT);
      // 펄스 경계
      if (st.train) {
        const period = 1000 / st.freq;
        const idx = Math.floor((st.simT - st.trainStart) / period);
        if (idx !== st.pulseIdx) {
          if (st.pulseIdx >= 0) {
            st.log.push(st.pulseSpikes === 1);
            changed = true;
            recordPoint();
          }
          st.pulseIdx = idx;
          st.pulseSpikes = 0;
        }
      }
      const spk = cellStep(st.cell, L, DT, ready());
      st.simT += DT;
      if (spk) {
        st.spikeInSample = true;
        st.glow = 1;
        if (st.train) st.pulseSpikes++;
        if (st.single.active) st.single.spikes++;
      }
      st.sampleAcc += DT;
      if (st.sampleAcc >= SAMPLE) {
        st.sampleAcc -= SAMPLE;
        st.vTrace.push(st.spikeInSample ? vNorm(NEURON.peak) : vNorm(st.cell.v));
        st.vTrace.shift();
        st.lTrace.push(L);
        st.lTrace.shift();
        st.spikeInSample = false;
      }
    }
    if (st.single.active && st.simT >= st.single.until) {
      st.single.active = false;
      if (!ready()) ctx.host.toast(tr(ctx, '아직 채널로돕신이 없어서 빛을 비춰도 조용해요.', 'No channelrhodopsin yet, so the light does nothing.'));
      else if (st.single.spikes === 1) {
        st.singleOk = true;
        changed = true;
      }
    }
    st.glow = Math.max(0, st.glow - dt * 3);
    if (changed) check();
  }

  function recordPoint(): void {
    if (!ready() || st.log.length < 12) return;
    const rate = rateNow()!;
    const i = st.points.findIndex((p) => p.f === st.freq);
    if (i >= 0) st.points[i].rate = rate;
    else st.points.push({ f: st.freq, rate });
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
      ko ? '바이러스 병을 신경세포에 끌어 유전자를 넣고, 파란 빛을 깜빡여 보세요. 화면은 4배 느리게 흐릅니다.' : 'Drag the virus vial onto the neuron, then flash blue light. Time runs four times slower on screen.',
      16,
      24,
      L.W - 32,
      L.narrow ? 13 : 15,
    );
    // 접시
    c.strokeStyle = alpha(pal.ink, 0.4);
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(10, L.top, L.leftW - 20, L.dishH, 14);
    c.stroke();
    const lightNow = st.lTrace[st.lTrace.length - 1];
    beam(c, L.cell.x, L.top + 4, L.cell.y + L.nr * 3, L.nr * 1.5, L.nr * 8, BLUE, lightNow);
    neuron(c, pal, L.neighbor.x, L.neighbor.y, L.nr * 0.8, { chr: false, glow: 0, dim: true, seed: 1.3 });
    text(c, pal, ko ? '이웃 세포 (유전자 없음)' : 'neighbour (no gene)', L.neighbor.x, L.neighbor.y + L.nr * 2.6, { size: 11, align: 'center' });
    neuron(c, pal, L.cell.x, L.cell.y, L.nr, { chr: st.gene && st.grow > 0.3, glow: st.glow });
    // 전극
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(L.cell.x - L.nr * 4, L.top + 6);
    c.lineTo(L.cell.x - L.nr * 0.7, L.cell.y - L.nr * 0.7);
    c.stroke();
    text(c, pal, ko ? '전극' : 'electrode', L.cell.x - L.nr * 4 + 4, L.top + 20, { size: 11 });
    const lab = st.gene ? (st.grow < 1 ? (ko ? '채널 만드는 중' : 'making channels') : ko ? '채널로돕신-2 신경세포' : 'channelrhodopsin-2 neuron') : ko ? '쥐 해마 신경세포' : 'rat hippocampal neuron';
    text(c, pal, lab, L.cell.x, L.cell.y + L.nr * 2.8, { size: 12, align: 'center', color: st.gene ? pal.blue : pal.ink });
    // 바이러스 병
    if (!st.gene || st.drag?.kind === 'vial') {
      const vx = st.drag?.kind === 'vial' ? st.drag.p.x - L.vial.w / 2 : L.vial.x;
      const vy = st.drag?.kind === 'vial' ? st.drag.p.y - L.vial.h / 2 : L.vial.y;
      c.fillStyle = alpha(pal.blue, 0.25);
      c.strokeStyle = pal.ink;
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(vx, vy + L.vial.h * 0.2, L.vial.w, L.vial.h * 0.8, 5);
      c.fill();
      c.stroke();
      c.fillStyle = pal.ink;
      c.fillRect(vx + L.vial.w * 0.2, vy, L.vial.w * 0.6, L.vial.h * 0.2);
      text(c, pal, ko ? '바이러스' : 'virus', vx + L.vial.w / 2, vy + L.vial.h + 14, { size: 11, align: 'center', color: pal.blue });
    }
    // 그래프
    trace(c, pal, L.lightB, st.lTrace, { col: BLUE, label: ko ? '파란 빛' : 'blue light', lw: 2 });
    trace(c, pal, L.vB, st.vTrace, { label: ko ? '막전위 (스파이크가 위로 솟음)' : 'membrane voltage (spikes shoot up)', zero: vNorm(NEURON.thresh), lw: 1.6 });
    text(c, pal, ko ? '문턱' : 'threshold', L.vB.x + L.vB.w - 4, L.vB.y + L.vB.h * (1 - vNorm(NEURON.thresh)) - 4, { size: 10, align: 'right' });
    text(c, pal, ko ? `보이는 시간 ${WINDOW} ms` : `${WINDOW} ms shown`, L.vB.x + L.vB.w, L.vB.y + L.vB.h + 14, { size: 11, align: 'right' });
    // 계기판과 곡선
    dial(c, pal, L.d, { value: st.curve ? firstFail() : null, pred: st.pred, label: ko ? '어디까지 따라올까' : 'How fast can it follow?' });
    drawCurve(c, L.cv, ko);
    // 힌트
    if (st.idle > 5) {
      if (!st.gene) pulse(c, pal, L.vial.x + L.vial.w / 2, L.vial.y + L.vial.h / 2, L.vial.h * 0.7, st.t);
      else if (st.pred == null) pulse(c, pal, L.d.cx, L.d.cy - L.d.r * 0.5, L.d.r * 0.7, st.t);
    }
    const r = rateNow();
    ui.ro.set(
      ko
        ? `유전자: ${st.gene ? (ready() ? '있음' : '자리 잡는 중') : '없음'}\n${st.train ? `연속 깜빡임 ${st.freq} Hz` : '한 번 깜빡 모드'}${r != null && st.train ? `\n빛마다 스파이크 하나: ${Math.round(r * 100)}%` : ''}\n찍은 점 ${st.points.length}개`
        : `Gene: ${st.gene ? (ready() ? 'yes' : 'settling') : 'no'}\n${st.train ? `Pulse train ${st.freq} Hz` : 'Single flash mode'}${r != null && st.train ? `\nOne spike per flash: ${Math.round(r * 100)}%` : ''}\nPoints ${st.points.length}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  const firstFail = () => {
    const f = st.curve?.find((p) => p.rate < 0.8);
    return f ? f.f : 60;
  };

  function drawCurve(c: CanvasRenderingContext2D, R: Box, ko: boolean): void {
    const pal = ctx.pal();
    if (R.h < 40 || R.w < 60) return;
    const X = (f: number) => R.x + (f / 60) * R.w;
    const Y = (v: number) => R.y + R.h - v * R.h;
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.2;
    c.strokeRect(R.x, R.y, R.w, R.h);
    c.strokeStyle = alpha(pal.ink, 0.3);
    c.setLineDash([3, 4]);
    c.beginPath();
    c.moveTo(R.x, Y(0.8));
    c.lineTo(R.x + R.w, Y(0.8));
    c.stroke();
    c.setLineDash([]);
    text(c, pal, '80%', R.x + R.w + 3, Y(0.8) + 4, { size: 10 });
    if (st.curve) {
      c.strokeStyle = alpha(pal.blue, 0.7);
      c.lineWidth = 2;
      c.setLineDash([5, 5]);
      c.beginPath();
      st.curve.forEach((p, i) => (i ? c.lineTo(X(p.f), Y(p.rate)) : c.moveTo(X(p.f), Y(p.rate))));
      c.stroke();
      c.setLineDash([]);
    }
    for (const p of st.points) {
      c.fillStyle = pal.red;
      c.beginPath();
      c.arc(X(p.f), Y(p.rate), 5, 0, TAU);
      c.fill();
    }
    if (st.train && ready()) {
      c.strokeStyle = pal.blue;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(X(st.freq), R.y);
      c.lineTo(X(st.freq), R.y + R.h);
      c.stroke();
    }
    text(c, pal, ko ? '↑ 빛마다 스파이크 하나' : '↑ one spike per flash', R.x, R.y - 8, { size: 11 });
    text(c, pal, ko ? '깜빡임 빠르기 (Hz) →' : 'flash rate (Hz) →', R.x + R.w, R.y + R.h + 15, { size: 11, align: 'right' });
    if (!st.points.length) text(c, pal, ko ? '연속 깜빡임을 켜면 점이 찍혀요' : 'Switch on the pulse train to add points', R.x + R.w / 2, R.y + R.h / 2, { size: 12, align: 'center', color: pal.blue });
  }

  // ---------- 입력 ----------
  function down(p: Pt): void {
    st.idle = 0;
    const L = lay();
    if (!st.gene && inBox(L.vial, p.x, p.y, 10)) {
      st.drag = { kind: 'vial', p };
      return;
    }
    const v = dialHit(L.d, p.x, p.y);
    if (v != null) {
      st.drag = { kind: 'dial' };
      setPred(v);
      return;
    }
    // 세포를 누르면 한 번 깜빡
    if (Math.hypot(p.x - L.cell.x, p.y - L.cell.y) < L.nr * 2) flashOnce();
  }

  function setPred(v: number): void {
    st.pred = Math.round(clamp(v, 1, 60));
    ui.pred?.set(st.pred);
    check();
  }

  function move(p: Pt): void {
    if (st.drag?.kind === 'vial') st.drag.p = p;
    else if (st.drag?.kind === 'dial') {
      const L = lay();
      const v = dialHit({ ...L.d, r: L.d.r * 3 }, p.x, p.y);
      if (v != null) setPred(v);
    }
  }

  function up(p: Pt): void {
    if (st.drag?.kind === 'vial') {
      const L = lay();
      if (Math.hypot(p.x - L.cell.x, p.y - L.cell.y) < L.nr * 3) giveGene();
    }
    st.drag = null;
  }

  return {
    id: '3',
    ko: '신경세포에 불을 켜다',
    en: 'Lighting up a neuron',
    missions: [
      {
        id: 'c3m1',
        ko: '신경세포에 채널로돕신-2 유전자를 넣고, 빛을 한 번 깜빡여 스파이크 하나를 일으켜라.',
        en: 'Give the neuron the channelrhodopsin-2 gene and fire one spike with a single flash.',
        hint_ko: '바이러스 병을 가운데 세포로 끌어 놓고, 채널이 자리 잡으면 세포를 누르거나 "한 번 깜빡"을 누르세요.',
        hint_en: 'Drag the virus vial onto the middle cell. Once the channels settle, tap the cell or press "Single flash".',
      },
      {
        id: 'c3m2',
        ko: '10 Hz 이하로 열 번 넘게 깜빡여, 빛마다 스파이크가 하나씩 따라오게 하라.',
        en: 'Flash more than ten times at 10 Hz or slower so that every flash brings one spike.',
        hint_ko: '"연속 깜빡임"을 켜고 빠르기를 10 Hz 아래로 두세요.',
        hint_en: 'Switch on the pulse train and keep the rate at 10 Hz or below.',
      },
      {
        id: 'c3m3',
        ko: '어디까지 따라올지 예상한 뒤, 빠르기를 바꿔 가며 점을 세 개 이상 찍어 스파이크를 놓치는 빠르기를 찾아라.',
        en: 'Guess how fast it can follow, then add at least three points at different rates and find where spikes start to drop.',
        hint_ko: '빠르기를 바꾸고 잠시 기다리면 점이 찍힙니다. 30 Hz 넘게도 올려 보세요.',
        hint_en: 'Change the rate and wait a moment for a point. Try going above 30 Hz.',
      },
    ],
    content: {
      ko: {
        observe: `<p>개구리 알에서 문이 열린다는 것은 확인했습니다. 그렇다면 같은 문을 포유류의 신경세포에 달면 어떨까요? 정신과 의사이자 신경과학자였던 칼 다이서로스는 이 생각에 매달렸습니다. 많은 사람이 미생물 단백질이 신경세포에서 제대로 일할 리 없다고 여겼습니다.</p><p>2004년 여름, 다이서로스 연구실은 바이러스를 이용해 쥐 신경세포에 채널로돕신-2 유전자를 넣고 파란 빛을 비췄습니다. 결과는 2005년에 발표되었습니다.</p><p class="q">빛을 깜빡이면 신경세포도 그대로 따라 발화할까? 얼마나 빠르게까지?</p>`,
        interact: '유전자를 넣은 뒤 빛을 한 번 깜빡여 보고, 연속 깜빡임의 빠르기를 바꿔 가며 곡선에 점을 찍어 보세요.',
        understand: `<h4>빛이 스파이크로</h4><p>파란 빛에 채널로돕신-2가 열리면 양이온이 들어와 막전위가 올라갑니다. 막전위가 문턱을 넘으면 신경세포는 스파이크(활동전위)를 냅니다. 빛을 몇 밀리초만 비춰도 스파이크 하나가 생기니, 빛의 박자가 곧 신경의 박자가 됩니다.</p><p>막전위를 단순하게 쓰면 이렇습니다.</p>$$\\tau_m \\frac{dV}{dt} = -(V - E_L) + g\\,p(t)\\,(E_{\\text{ChR}} - V)$$<p>$V$가 문턱을 넘으면 스파이크를 세고 $V$를 되돌립니다. $p(t)$는 2장의 열린 문 비율입니다.</p><h4>빠르기의 한계</h4><p>빛을 끈 뒤에도 문이 닫히는 데 몇 밀리초가 걸립니다. 깜빡임 사이 간격이 이보다 충분히 길지 않으면 막전위가 다시 내려오지 못해 스파이크가 빠지거나 겹칩니다. 다이서로스 연구진의 첫 실험에서도 수십 Hz까지는 잘 따라왔고 더 빨라지면 빠지기 시작했습니다.</p><h4>왜 대단한가</h4><p>단백질 <b>하나</b>만 넣으면 되기 때문에, 어떤 세포에든 유전자로 스위치를 달 수 있습니다. 전극으로 찌르는 것과 달리 원하는 종류의 세포만 골라 켤 수 있는 길이 열렸습니다.</p><h4>실제와 다른 점</h4><p>신경세포 모델은 아주 단순한 "새는 적분 발화" 모델이고, 한계 빠르기는 실제 세포 종류와 채널 변형에 따라 달라집니다. 화면은 4배 느리게 보여 줍니다.</p>`,
      },
      en: {
        observe: `<p>The gate opens in a frog egg. What if the same gate were put into a mammalian nerve cell? Karl Deisseroth, a psychiatrist and neuroscientist, pursued this idea. Many people doubted that a microbial protein would work properly in neurons.</p><p>In summer 2004 his lab used a virus to put the channelrhodopsin-2 gene into rat neurons and shone blue light on them. The results were published in 2005.</p><p class="q">If the light flashes, will the neuron fire along with it? Up to what rate?</p>`,
        interact: 'Deliver the gene, try a single flash, then change the pulse-train rate and add points to the curve.',
        understand: `<h4>From light to spikes</h4><p>When blue light opens channelrhodopsin-2, positive ions enter and the membrane voltage rises. Past the threshold the neuron fires a spike (action potential). A flash of only a few milliseconds makes one spike, so the rhythm of the light becomes the rhythm of the neuron.</p><p>A simple model of the membrane voltage:</p>$$\\tau_m \\frac{dV}{dt} = -(V - E_L) + g\\,p(t)\\,(E_{\\text{ChR}} - V)$$<p>When $V$ crosses the threshold we count a spike and reset $V$. $p(t)$ is the open fraction from chapter 2.</p><h4>The speed limit</h4><p>Even after the light goes off, the gate takes a few milliseconds to close. If flashes come closer than that allows, the voltage cannot settle and spikes drop out or double up. In Deisseroth's first experiments the cells followed well up to a few tens of Hz and began to miss beyond that.</p><h4>Why it mattered</h4><p>Because only <b>one</b> protein is needed, any cell can be given the switch through a gene. Unlike poking with electrodes, this opened the way to turning on just one chosen kind of cell.</p><h4>How this differs from reality</h4><p>The neuron is a very simple leaky integrate-and-fire model, and the real limit depends on cell type and channel variant. The screen runs four times slower.</p>`,
      },
    },
    enter(c) {
      ctx = c;
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
      st.cell = newCell();
      st.gene = false;
      st.grow = 0;
      st.train = false;
      st.freq = 5;
      st.points = [];
      st.curve = null;
      st.pred = null;
      st.singleOk = false;
      st.log = [];
      panel();
      check();
    },
    leave() {
      st.train = false;
    },
    down,
    move,
    up,
  };
}
