// 3장: 되먹임과 소아이의 플라스크.
// 생성물을 다음 플라스크의 촉매로 붓는 계단식 증폭을 해 보고, 생기는 즉시 촉매가 되는 소아이 반응으로 넘어간다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, segment, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { bead, caption, flask, fmtEe, fmtPct, gauge, pulse, type Gauge } from './draw';
import { controlStep, feedbackStep, rng, soaiRound } from './model';

type Mode = 'steps' | 'auto';
const MAXF = 5;
const DROP = 5e-7; // 한 방울이 만드는 치우침 (0.00005%)
const ANIM = 2.6; // 한 회차 애니메이션 (초)
const NDOT = 260;

export function chapter3(): Chapter {
  let ctx: Ctx;
  const st = {
    mode: 'steps' as Mode,
    fb: [0.8] as number[],
    ct: [0.8] as number[],
    pred: null as number | null,
    pour: null as null | { t: number }, // 계단 붓기 애니메이션
    // 저절로 불어나는 플라스크
    e: 0,
    e0: 0,
    M: 1000,
    rounds: 0,
    trace: [] as { x: number; e: number }[],
    anim: null as null | { from: number; t: number },
    dots: [] as { u: number; v: number; side: 1 | -1; ph: number }[],
    drag: null as null | { what: 'beaker' | 'dropR' | 'dropS' | 'bottle'; p: Pt },
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout> };

  function initDots(): void {
    const r = rng(41);
    st.dots = Array.from({ length: NDOT }, (_, i) => ({ u: r(), v: r(), side: (i % 2 ? 1 : -1) as 1 | -1, ph: r() * TAU }));
  }
  initDots();

  // ---------- 동작 ----------
  function pourSteps(): void {
    if (st.fb.length >= MAXF || st.pour) return;
    st.pour = { t: 0 };
    st.idle = 0;
  }
  function finishPour(): void {
    st.fb.push(feedbackStep(st.fb[st.fb.length - 1]));
    st.ct.push(controlStep(st.ct[st.ct.length - 1]));
    check();
  }

  function drop(side: 1 | -1): void {
    if (st.anim) return;
    st.e = clamp(st.e + side * DROP, -1, 1);
    if (st.rounds === 0) st.e0 = st.e;
    st.idle = 0;
    if (!st.trace.length || st.rounds === 0) st.trace = [{ x: 0, e: st.e }];
    check();
  }

  function pourRaw(): void {
    if (st.anim) return;
    st.idle = 0;
    if (st.e === 0) {
      ctx.host.toast(tr(ctx, '완벽한 반반이라 원료를 부어도 반반 그대로예요.', 'Perfectly 50:50, so pouring changes nothing.'));
      ctx.note('zero', '완벽한 반반에서는 원료를 아무리 부어도 반반 그대로였다. 키울 치우침이 없기 때문이다.', 'Starting perfectly 50:50, pouring more never changed anything: there was no imbalance to grow.');
      st.rounds++;
      st.trace.push({ x: st.rounds, e: 0 });
      return;
    }
    if (st.rounds >= 6) return;
    st.anim = { from: st.e, t: 0 };
  }

  function emptyFlask(): void {
    st.e = 0;
    st.e0 = 0;
    st.rounds = 0;
    st.trace = [];
    st.anim = null;
    initDots();
    check();
  }

  // ---------- 판정 ----------
  function check(): void {
    const ko = k(ctx);
    const seq = (a: number[]) => a.map((x) => `${(x * 100).toFixed(x > 0.99 ? 2 : 0)}%`).join(' → ');
    const last = st.fb[st.fb.length - 1];
    if (last >= 0.99) {
      ctx.host.complete('c3m1', tr(ctx, `${st.fb.length - 1}번 부어 ${fmtEe(last, true)}`, `${st.fb.length - 1} pours: ${fmtEe(last, false)}`));
      ctx.note('steps', `생성물을 다음 플라스크의 촉매로 붓자 R 쪽이 ${seq(st.fb)}로 커졌다.`, `Pouring each product in as the next catalyst grew R: ${seq(st.fb)}.`);
    } else ctx.host.result('c3m1', ko ? `지금 ${seq(st.fb)}` : `Now ${seq(st.fb)}`);
    if (st.ct.length >= 4) {
      ctx.host.complete('c3m2', tr(ctx, `되먹임을 끈 쪽: ${seq(st.ct)}`, `Feedback off: ${seq(st.ct)}`));
      ctx.note('control', `되먹임을 끈 쌍둥이 플라스크는 같은 횟수를 부어도 ${seq(st.ct)}로 오히려 줄었다. 증폭의 원인은 되먹임이다.`, `The twin flask without feedback went ${seq(st.ct)}: it shrank. The feedback is what amplifies.`);
    } else ctx.host.result('c3m2', ko ? `되먹임 끈 쪽 붓기 ${st.ct.length - 1}/3` : `Feedback-off pours ${st.ct.length - 1}/3`);
    const small = Math.abs(st.e0) > 0 && Math.abs(st.e0) <= DROP * 3;
    if (small && Math.abs(st.e) >= 0.995) {
      ctx.host.complete('c3m3', tr(ctx, `${fmtEe(st.e0, true)}에서 ${st.rounds}회 만에 ${fmtEe(st.e, true)}`, `${fmtEe(st.e0, false)} to ${fmtEe(st.e, false)} in ${st.rounds} rounds`));
      ctx.note('soai', `${fmtEe(st.e0, true)}라는 아주 작은 치우침에서 시작해, 원료를 씨앗의 ${st.M}배씩 ${st.rounds}번 붓자 ${fmtEe(st.e, true)}가 되었다.`, `Starting from a tiny ${fmtEe(st.e0, false)}, ${st.rounds} rounds of ${st.M}× raw material reached ${fmtEe(st.e, false)}.`);
    } else ctx.host.result('c3m3', st.e0 === 0 ? (ko ? '스포이트로 한 방울 떨어뜨려 시작하세요' : 'Start with one drop from the dropper') : ko ? `지금 ${fmtEe(st.e, true)}, ${st.rounds}회` : `Now ${fmtEe(st.e, false)}, ${st.rounds} rounds`);
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
    const mode = segment<Mode>({
      label: ko ? '방식' : 'Mode',
      value: st.mode,
      options: [
        { v: 'steps', label: ko ? '한 번씩 붓기' : 'Pour step by step' },
        { v: 'auto', label: ko ? '저절로 불어나게' : 'Let it run' },
      ],
      onChange: (v) => {
        st.mode = v;
        st.idle = 0;
        panel();
      },
    });
    ui = { ro: readout() };
    const kids: HTMLElement[] = [mode.el];
    if (st.mode === 'steps') {
      kids.push(
        stepButton({ label: ko ? '다음 플라스크에 붓기' : 'Pour into next flask', onClick: pourSteps }).el,
        stepButton({
          label: ko ? '처음부터' : 'Start over',
          onClick: () => {
            st.fb = [0.8];
            st.ct = [0.8];
            st.pred = null;
            check();
          },
        }).el,
      );
    } else {
      const amt = segment<string>({
        label: ko ? '한 번에 붓는 원료 (씨앗의 몇 배)' : 'Raw material per round (× seed)',
        value: String(st.M),
        options: [
          { v: '100', label: '100' },
          { v: '1000', label: '1,000' },
          { v: '10000', label: '10,000' },
        ],
        onChange: (v) => {
          st.M = Number(v);
        },
      });
      kids.push(
        row(stepButton({ label: ko ? 'R 한 방울' : 'One drop of R', onClick: () => drop(1) }).el, stepButton({ label: ko ? 'S 한 방울' : 'One drop of S', onClick: () => drop(-1) }).el),
        stepButton({ label: ko ? '원료 붓기 (다음 회차)' : 'Pour raw material (next round)', onClick: pourRaw }).el,
        amt.el,
        stepButton({ label: ko ? '플라스크 비우기' : 'Empty the flask', onClick: emptyFlask }).el,
      );
    }
    kids.push(ui.ro.el);
    ctx.host.controls.append(...kids);
  }

  // ---------- 배치 ----------
  const stepsLay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 70;
    const areaW = narrow ? W - 20 : W * 0.66;
    const labelW = narrow ? 0 : 92;
    const fw = Math.min((areaW - labelW - 20) / MAXF, 110);
    const rowH = narrow ? (H - top) * 0.3 : (H - top - 30) / 2;
    const fh = Math.min(rowH - 46, fw * 1.15);
    const rows = [top + 18, top + 18 + rowH + (narrow ? 0 : 10)];
    const fx = (i: number) => 10 + labelW + i * (fw + 4);
    const graph = narrow ? { x: 44, y: rows[1] + rowH + 10, w: W - 64, h: H - (rows[1] + rowH + 10) - 30 } : { x: W * 0.7, y: top + 60, w: W * 0.27, h: Math.min(H - top - 120, W * 0.27) };
    const pg: Gauge = narrow ? { cx: W - 50, cy: top + 30, r: 0 } : { cx: W * 0.835, cy: graph.y + graph.h + 0, r: 0 };
    return { W, H, narrow, top, fw, fh, rows, fx, graph, pg, labelW };
  };

  const autoLay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 60 : 70;
    const fw = narrow ? W * 0.5 : Math.min(W * 0.34, (H - top) * 0.7);
    const fh = narrow ? (H - top) * 0.5 : Math.min((H - top) * 0.72, fw * 1.1);
    const fl = { x: narrow ? W * 0.25 : W * 0.08 + 40, y: top + 40, w: fw, h: fh };
    const dropR = { x: fl.x - 30, y: top + 14 };
    const dropS = { x: fl.x - 30 + 44, y: top + 14 };
    const bottle = { x: fl.x + fl.w + 34, y: top + 40 };
    const gr = narrow ? Math.min(W * 0.14, 46) : Math.min(W * 0.08, 60);
    const g: Gauge = narrow ? { cx: W * 0.5, cy: fl.y + fl.h + gr + 30, r: gr } : { cx: fl.x + fl.w / 2, cy: fl.y + fl.h + gr + 34, r: gr };
    const graph = narrow ? { x: 56, y: g.cy + 60, w: W - 80, h: H - g.cy - 90 } : { x: W * 0.58, y: top + 50, w: W * 0.38, h: Math.min(H - top - 120, W * 0.32) };
    return { W, H, narrow, top, fl, dropR, dropS, bottle, g, graph };
  };

  // ---------- 그리기 ----------
  function drawSteps(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = stepsLay();
    caption(c, pal, ko ? '비커를 끌어 다음 플라스크에 부으세요. 위 줄은 생성물이 다음 회차의 촉매가 되고, 아래 줄은 되먹임을 끈 쌍둥이입니다.' : 'Drag the beaker into the next flask. Top row: the product becomes the next catalyst. Bottom row: the twin with feedback switched off.', 14, 24, L.W - 28, L.narrow ? 13 : 15);
    const rowsData = [st.fb, st.ct];
    const labels = ko ? ['되먹임 켬', '되먹임 끔'] : ['Feedback on', 'Feedback off'];
    rowsData.forEach((arr, ri) => {
      const y = L.rows[ri];
      if (L.labelW) text(c, pal, labels[ri], 10, y + L.fh * 0.6, { size: 14, title: true, color: pal.blue });
      else text(c, pal, labels[ri], 10, y - 4, { size: 12, color: pal.blue });
      for (let i = 0; i < MAXF; i++) {
        const x = L.fx(i);
        const has = i < arr.length;
        const pouring = st.pour && i === arr.length;
        const lvl = has ? 0.7 : pouring ? 0.7 * clamp(st.pour!.t / 0.8, 0, 1) : 0;
        const e = has ? arr[i] : pouring ? arr[arr.length - 1] : 0;
        flask(c, pal, x, y, L.fw, L.fh, { level: lvl, mixR: lvl ? (1 + e) / 2 : null });
        if (has) text(c, pal, fmtPct(e), x + L.fw / 2, y + L.fh + 16, { size: L.narrow ? 11 : 13, align: 'center', color: pal.blue });
        if (i === 0 && !L.narrow) text(c, pal, ko ? '2장 생성물' : 'from ch. 2', x + L.fw / 2, y + L.fh + (L.narrow ? 28 : 32), { size: 11, align: 'center' });
      }
    });
    // 비커
    const n = st.fb.length;
    if (n < MAXF && !st.pour) {
      const home = { x: L.fx(n - 1) + L.fw * 0.5, y: L.rows[0] - 8 };
      const p = st.drag?.what === 'beaker' ? st.drag.p : home;
      drawBeaker(c, p.x, p.y, Math.max(16, L.fw * 0.22), (1 + st.fb[n - 1]) / 2);
      if (st.idle > 4 && !st.drag) pulse(c, pal, L.fx(n) + L.fw / 2, L.rows[0] + L.fh * 0.6, L.fw * 0.45, st.t);
    }
    // 그래프
    drawLin(c, L.graph, ko);
    const last = st.fb[st.fb.length - 1];
    ui.ro.set(ko ? `되먹임 켬: ${fmtEe(last, true)}\n되먹임 끔: ${fmtEe(st.ct[st.ct.length - 1], true)}\n${st.fb.length - 1}번 부음` : `Feedback on: ${fmtEe(last, false)}\nFeedback off: ${fmtEe(st.ct[st.ct.length - 1], false)}\n${st.fb.length - 1} pours`);
  }

  function drawBeaker(c: CanvasRenderingContext2D, x: number, y: number, s: number, mixR: number): void {
    const pal = ctx.pal();
    c.save();
    c.translate(x, y);
    c.fillStyle = alpha(pal.blue, 0.35 * mixR);
    c.fillRect(-s * 0.55, -s * 0.2, s * 1.1, s * 0.6);
    c.fillStyle = alpha(pal.red, 0.35 * (1 - mixR));
    c.fillRect(-s * 0.55, -s * 0.2, s * 1.1, s * 0.6);
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-s * 0.7, -s * 0.7);
    c.lineTo(-s * 0.55, -s * 0.6);
    c.lineTo(-s * 0.55, s * 0.4);
    c.lineTo(s * 0.55, s * 0.4);
    c.lineTo(s * 0.55, -s * 0.6);
    c.stroke();
    c.restore();
  }

  function drawLin(c: CanvasRenderingContext2D, R: { x: number; y: number; w: number; h: number }, ko: boolean): void {
    const pal = ctx.pal();
    if (R.h < 40) return;
    const X = (i: number) => R.x + (i / (MAXF - 1)) * R.w;
    const Y = (e: number) => R.y + R.h - e * R.h;
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.2;
    c.strokeRect(R.x, R.y, R.w, R.h);
    for (const v of [0, 0.5, 1]) text(c, pal, `${v * 100}%`, R.x - 6, Y(v) + 4, { size: 11, align: 'right' });
    text(c, pal, ko ? '회차 →' : 'round →', R.x + R.w, R.y + R.h + 15, { size: 11, align: 'right' });
    text(c, pal, ko ? '↑ R 쪽 치우침' : '↑ lean toward R', R.x, R.y - 6, { size: 11 });
    const line = (arr: number[], col: string, dash: boolean) => {
      c.strokeStyle = col;
      c.fillStyle = col;
      c.lineWidth = 2.5;
      c.setLineDash(dash ? [6, 5] : []);
      c.beginPath();
      arr.forEach((e, i) => (i ? c.lineTo(X(i), Y(e)) : c.moveTo(X(i), Y(e))));
      c.stroke();
      c.setLineDash([]);
      arr.forEach((e, i) => {
        c.beginPath();
        c.arc(X(i), Y(e), 4, 0, TAU);
        c.fill();
      });
    };
    line(st.ct, alpha(pal.ink, 0.6), true);
    line(st.fb, pal.blue, false);
    const n = st.fb.length - 1;
    text(c, pal, ko ? '켬' : 'on', X(n) + 6, Y(st.fb[n]) - 6, { size: 12, color: pal.blue });
    text(c, pal, ko ? '끔' : 'off', X(st.ct.length - 1) + 6, Y(st.ct[st.ct.length - 1]) + 14, { size: 12 });
  }

  function drawAuto(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = autoLay();
    caption(c, pal, ko ? '이번엔 생성물이 생기자마자 촉매가 됩니다. 스포이트로 R 한 방울을 떨어뜨리고, 원료 병을 플라스크로 끌어 부어 보세요.' : 'Now each product molecule becomes a catalyst the moment it forms. Add one drop of R, then drag the raw-material bottle into the flask.', 14, 24, L.W - 28, L.narrow ? 13 : 15);
    const fg = flask(c, pal, L.fl.x, L.fl.y, L.fl.w, L.fl.h, { level: 0.82, mixR: (1 + st.e) / 2 });
    // 분자 점
    const br = Math.max(2.5, L.fl.w / 70);
    for (const d of st.dots) {
      const yy = fg.bottom - 6 - d.v * (fg.bottom - fg.top) * 0.78;
      const l = fg.left(yy) + 6;
      const r = fg.right(yy) - 6;
      const xx = l + d.u * (r - l) + Math.sin(st.t * 1.3 + d.ph) * 2;
      bead(c, pal, xx, yy + Math.cos(st.t * 1.1 + d.ph) * 2, br, d.side);
    }
    // 스포이트와 원료 병
    const dr = st.drag?.what === 'dropR' ? st.drag.p : L.dropR;
    const ds = st.drag?.what === 'dropS' ? st.drag.p : L.dropS;
    const bt = st.drag?.what === 'bottle' ? st.drag.p : L.bottle;
    drawDropper(c, dr.x, dr.y, 1);
    drawDropper(c, ds.x, ds.y, -1);
    drawBottle(c, bt.x, bt.y);
    if (!L.narrow) {
      text(c, pal, ko ? '스포이트' : 'droppers', (L.dropR.x + L.dropS.x) / 2, L.dropS.y + 58, { size: 12, align: 'center' });
      text(c, pal, ko ? '원료' : 'raw material', L.bottle.x, L.bottle.y + 66, { size: 12, align: 'center' });
    }
    gauge(c, pal, L.g, { value: st.e, ko });
    drawLog(c, L.graph, ko);
    if (st.idle > 4 && !st.drag && !st.anim) {
      if (st.e === 0) pulse(c, pal, L.dropR.x, L.dropR.y + 14, 22, st.t);
      else if (Math.abs(st.e) < 0.995) pulse(c, pal, L.bottle.x, L.bottle.y + 10, 30, st.t);
    }
    ui.ro.set(
      ko
        ? `지금 플라스크: ${fmtEe(st.e, true)}\n시작한 치우침: ${st.e0 ? fmtEe(st.e0, true) : '없음 (반반)'}\n원료를 부은 횟수: ${st.rounds}`
        : `Flask now: ${fmtEe(st.e, false)}\nStarting imbalance: ${st.e0 ? fmtEe(st.e0, false) : 'none (50:50)'}\nRounds poured: ${st.rounds}`,
    );
  }

  function drawDropper(c: CanvasRenderingContext2D, x: number, y: number, side: 1 | -1): void {
    const pal = ctx.pal();
    c.save();
    c.translate(x, y);
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.fillStyle = alpha(pal.ink, 0.15);
    c.beginPath();
    c.ellipse(0, 0, 7, 9, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(-4, 8);
    c.lineTo(-1.5, 30);
    c.lineTo(1.5, 30);
    c.lineTo(4, 8);
    c.stroke();
    bead(c, pal, 0, 36, 4, side);
    c.restore();
    text(c, pal, side > 0 ? 'R' : 'S', x + 13, y + 4, { size: 12 });
  }

  function drawBottle(c: CanvasRenderingContext2D, x: number, y: number): void {
    const pal = ctx.pal();
    c.save();
    c.translate(x, y);
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.fillStyle = alpha(pal.ink, 0.1);
    c.beginPath();
    c.rect(-16, -6, 32, 40);
    c.fill();
    c.stroke();
    c.strokeRect(-6, -18, 12, 12);
    c.restore();
    text(c, pal, `×${st.M.toLocaleString()}`, x, y + 50, { size: 11, align: 'center' });
  }

  function drawLog(c: CanvasRenderingContext2D, R: { x: number; y: number; w: number; h: number }, ko: boolean): void {
    const pal = ctx.pal();
    if (R.h < 50) return;
    const lo = -5; // 0.00001%
    const hi = 2; // 100%
    const xmax = Math.max(4, st.rounds + (st.anim ? 1 : 0));
    const X = (x: number) => R.x + (x / xmax) * R.w;
    const Y = (e: number) => {
      const p = Math.max(Math.abs(e) * 100, Math.pow(10, lo));
      return R.y + R.h - ((Math.log10(p) - lo) / (hi - lo)) * R.h;
    };
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.2;
    c.strokeRect(R.x, R.y, R.w, R.h);
    for (let p = lo; p <= hi; p++) {
      const yy = R.y + R.h - ((p - lo) / (hi - lo)) * R.h;
      c.strokeStyle = alpha(pal.ink, 0.12);
      c.beginPath();
      c.moveTo(R.x, yy);
      c.lineTo(R.x + R.w, yy);
      c.stroke();
      if ((p - lo) % (R.h < 140 ? 2 : 1) === 0) text(c, pal, `${Number(Math.pow(10, p).toPrecision(1))}%`, R.x - 5, yy + 4, { size: 10, align: 'right' });
    }
    text(c, pal, ko ? '↑ 치우침 (눈금이 10배씩)' : '↑ imbalance (each line ×10)', R.x, R.y - 6, { size: 11 });
    text(c, pal, ko ? '원료를 부은 횟수 →' : 'rounds →', R.x + R.w, R.y + R.h + 15, { size: 11, align: 'right' });
    if (st.trace.length) {
      c.lineWidth = 2.5;
      for (let i = 1; i < st.trace.length; i++) {
        const a = st.trace[i - 1];
        const b = st.trace[i];
        c.strokeStyle = b.e >= 0 ? pal.blue : pal.red;
        c.beginPath();
        c.moveTo(X(a.x), Y(a.e));
        c.lineTo(X(b.x), Y(b.e));
        c.stroke();
      }
      const lt = st.trace[st.trace.length - 1];
      c.fillStyle = lt.e >= 0 ? pal.blue : pal.red;
      c.beginPath();
      c.arc(X(lt.x), Y(lt.e), 4, 0, TAU);
      c.fill();
    }
  }

  // ---------- 매 프레임 ----------
  function step(dt: number): void {
    if (st.pour) {
      st.pour.t += dt === 0 ? 99 : dt;
      if (st.pour.t >= 0.8) {
        st.pour = null;
        finishPour();
      }
    }
    if (st.anim) {
      st.anim.t += dt === 0 ? 99 : dt;
      const u = clamp(st.anim.t / ANIM, 0, 1);
      // 생성물 양이 지수적으로 늘어나니, 화면에서는 로그 시간으로 보여 준다
      const frac = (Math.pow(1 + st.M, u) - 1) / st.M;
      st.e = soaiRound(st.anim.from, st.M, frac);
      st.trace.push({ x: st.rounds + u, e: st.e });
      if (u >= 1) {
        st.anim = null;
        st.rounds++;
        check();
      }
    }
    // 점 색을 지금 비율에 맞춰 조금씩 바꾼다
    const want = Math.round((NDOT * (1 + st.e)) / 2);
    let have = st.dots.filter((d) => d.side > 0).length;
    let budget = Math.max(1, Math.round(NDOT * 0.03));
    for (const d of st.dots) {
      if (budget <= 0 || have === want) break;
      if (have < want && d.side < 0) {
        d.side = 1;
        have++;
        budget--;
      } else if (have > want && d.side > 0) {
        d.side = -1;
        have--;
        budget--;
      }
    }
  }

  // ---------- 입력 ----------
  function down(p: Pt): void {
    st.idle = 0;
    if (st.mode === 'steps') {
      const L = stepsLay();
      const n = st.fb.length;
      if (n >= MAXF || st.pour) return;
      const home = { x: L.fx(n - 1) + L.fw * 0.5, y: L.rows[0] - 8 };
      if (Math.hypot(p.x - home.x, p.y - home.y) < Math.max(30, L.fw * 0.4)) st.drag = { what: 'beaker', p };
      // 다음 빈 플라스크를 눌러도 붓는다
      for (const ri of [0, 1]) {
        const x = L.fx(n);
        if (p.x > x && p.x < x + L.fw && p.y > L.rows[ri] && p.y < L.rows[ri] + L.fh) pourSteps();
      }
      return;
    }
    const L = autoLay();
    const near = (q: { x: number; y: number }, r: number) => Math.hypot(p.x - q.x, p.y - (q.y + 12)) < r;
    if (near(L.dropR, 26)) st.drag = { what: 'dropR', p };
    else if (near(L.dropS, 26)) st.drag = { what: 'dropS', p };
    else if (near(L.bottle, 32)) st.drag = { what: 'bottle', p };
  }

  function move(p: Pt): void {
    if (st.drag) st.drag.p = p;
  }

  function up(p: Pt): void {
    const d = st.drag;
    st.drag = null;
    if (!d) return;
    if (st.mode === 'steps') {
      const L = stepsLay();
      const n = st.fb.length;
      const x = L.fx(n);
      if (p.x > x - 20 && p.x < x + L.fw + 20 && p.y > L.rows[0] - 40 && p.y < L.rows[1] + L.fh) pourSteps();
      return;
    }
    const L = autoLay();
    const inFlask = p.x > L.fl.x - 20 && p.x < L.fl.x + L.fl.w + 20 && p.y > L.fl.y - 50 && p.y < L.fl.y + L.fl.h;
    if (!inFlask) return;
    if (d.what === 'dropR') drop(1);
    else if (d.what === 'dropS') drop(-1);
    else if (d.what === 'bottle') pourRaw();
  }

  return {
    id: '3',
    ko: '되먹임과 소아이의 플라스크',
    en: 'Feedback and the Soai flask',
    missions: [
      {
        id: 'c3m1',
        ko: '생성물을 다음 플라스크의 촉매로 부어, R 쪽 99%를 넘겨라.',
        en: 'Pour each product in as the next catalyst until R passes 99%.',
        hint_ko: '비커를 끌어 다음 빈 플라스크에 놓거나, "다음 플라스크에 붓기"를 누르세요.',
        hint_en: 'Drag the beaker onto the next empty flask, or press "Pour into next flask".',
      },
      {
        id: 'c3m2',
        ko: '되먹임을 끈 쌍둥이 플라스크도 세 번 부어 보고, 두 줄을 비교하라.',
        en: 'Pour three times into the twin with feedback off and compare the two rows.',
        hint_ko: '한 번 부으면 두 줄에 똑같이 부어집니다. 아래 줄의 숫자가 어떻게 되는지 보세요.',
        hint_en: 'Each pour goes into both rows. Watch the numbers on the bottom row.',
      },
      {
        id: 'c3m3',
        ko: '"저절로 불어나게"에서 한두 방울로 시작해 99.5%를 넘겨라.',
        en: 'In "Let it run", start from one or two drops and pass 99.5%.',
        hint_ko: '스포이트를 플라스크로 끌어 한 방울을 떨어뜨린 뒤, 원료 병을 끌어 붓습니다. 원료 양을 바꾸면 필요한 횟수가 달라집니다.',
        hint_en: 'Drag a dropper into the flask, then drag the raw-material bottle in. Changing the amount changes how many rounds you need.',
      },
    ],
    content: {
      ko: {
        observe: `<p>2장의 증폭은 한 번으로 끝납니다. 80%짜리 생성물은 그냥 생성물일 뿐, 다음 반응에 영향을 주지 않으니까요.</p><p>그런데 만약 <b>생성물이 곧 촉매</b>라면 어떨까요? 1995년 소아이 겐소는 자기 자신을 만드는 반응의 촉매가 되는 분자(피리미딜 알칸올)를 찾았습니다.</p><p class="q">80%짜리 생성물을 다음 반응의 촉매로 쓰면 그다음 생성물은 어떻게 될까? 이걸 계속 반복하면?</p>`,
        interact: '먼저 한 번씩 부어 보고, "저절로 불어나게"로 넘어가 보세요.',
        understand: `<h4>계단식 되먹임</h4><p>2장의 규칙(무작위 짝짓기, 섞인 짝은 놂)을 한 바퀴 돌릴 때마다 치우침 $e$는 이렇게 바뀝니다.</p>$$e_{\\text{다음}} = \\frac{2e}{1+e^2}$$<p>50%에서 80%, 97.6%, 99.97%로 세 바퀴 만에 거의 한쪽만 남습니다. 되먹임이 없으면 생성물은 촉매가 되지 못하고, 촉매 없이 반반으로 생긴 생성물에 묽어져 치우침이 줄어듭니다.</p><h4>소아이 반응: 생기자마자 촉매</h4><p>실제 소아이 반응에서는 생성물이 생기는 즉시 촉매로 합류합니다. 같은 손끼리 짝지은 촉매만 일한다고 단순화하면</p>$$\\frac{dR}{dt} \\propto \\frac{R^2}{R+S}, \\qquad \\frac{dS}{dt} \\propto \\frac{S^2}{R+S}$$<p>많은 쪽이 자기 편을 더 빨리 만들어 차이가 벌어집니다. 1953년 찰스 프랭크는 자기 자신을 만드는 반응과 반대편을 억누르는 작용이 함께 있으면 작은 차이가 저절로 커진다는 것을 종이 위에서 먼저 보였습니다. 소아이 반응은 그 생각을 실제 플라스크에서 보여 준 첫 사례입니다.</p><p>소아이는 1995년 ee 약 2%에서 시작해 약 87%까지 키웠고, 이후 개선된 분자로 0.00005% 수준의 치우침을 몇 차례 반복만으로 99.5% 넘게 키운 결과를 보고했습니다.</p><h4>실제와 다른 점</h4><p>실제 소아이 반응의 촉매는 둘 이상이 뭉친 덩어리로 일한다고 알려져 있고, 정확한 구조는 지금도 연구 중입니다. 원료 양과 회차 수는 이 단순한 모델에 맞춘 값이라 실험 수치와 다릅니다. 플라스크 속 점은 전체 비율을 보여 주는 그림일 뿐, 0.00005% 같은 작은 차이는 점으로 보이지 않습니다.</p>`,
      },
      en: {
        observe: `<p>The amplification in chapter 2 happens only once. An 80% product is just a product; it does not touch the next reaction.</p><p>But what if <b>the product is the catalyst</b>? In 1995 Kenso Soai found a molecule (a pyrimidyl alkanol) that catalyses its own formation.</p><p class="q">Use the 80% product as the next catalyst. What happens to the next product? And if you keep going?</p>`,
        interact: 'Pour step by step first, then switch to "Let it run".',
        understand: `<h4>Step-by-step feedback</h4><p>With chapter 2's rule (random pairing, mixed pairs idle), each round turns an imbalance $e$ into</p>$$e_{\\text{next}} = \\frac{2e}{1+e^2}$$<p>50% becomes 80%, 97.6%, 99.97%: almost one hand in three rounds. Without feedback the product cannot act as a catalyst, gets diluted by racemic product, and the imbalance shrinks.</p><h4>The Soai reaction: catalyst from birth</h4><p>In the real Soai reaction each product molecule joins the catalysts as soon as it forms. If only matched pairs work,</p>$$\\frac{dR}{dt} \\propto \\frac{R^2}{R+S}, \\qquad \\frac{dS}{dt} \\propto \\frac{S^2}{R+S}$$<p>the majority makes more of itself faster and the gap widens. In 1953 Charles Frank showed on paper that self-copying plus suppression of the other side makes tiny differences grow by themselves. The Soai reaction was the first flask to do it.</p><p>In 1995 Soai grew an ee of about 2% to about 87%; later, with an improved molecule, he reported growing an imbalance around 0.00005% to over 99.5% in a few repeated rounds.</p><h4>How this differs from reality</h4><p>The real Soai catalyst is thought to work as clusters of two or more molecules, and its exact structure is still studied. Amounts and round counts here fit this simple model, not the experiments. The dots show the overall ratio only; a 0.00005% difference is invisible as dots.</p>`,
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
      const { ctx: cc, w: W, h: H } = ctx.cvs;
      cc.clearRect(0, 0, W, H);
      if (st.mode === 'steps') drawSteps();
      else drawAuto();
      ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
    },
    reset() {
      st.fb = [0.8];
      st.ct = [0.8];
      st.pred = null;
      st.pour = null;
      st.M = 1000;
      emptyFlask();
      panel();
    },
    down,
    move,
    up,
  };
}
