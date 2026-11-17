// 1장: 반반의 세계. 거울상 분자를 돌려 보고, 파스퇴르처럼 결정을 나누고, 다음 장의 결과를 예상한다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { caption, fmtEe, gauge, gaugeHit, gaugeValue, pulse, type Gauge } from './draw';
import { ee, rng } from './model';
import { setPred, shared } from './shared';

type Stage = 'turn' | 'sort' | 'guess';
type V3 = [number, number, number];

// 정사면체 꼭짓점: 탄소에 붙은 서로 다른 원자 4개
const S3 = 1 / Math.sqrt(3);
const TETRA: V3[] = [
  [S3, S3, S3],
  [S3, -S3, -S3],
  [-S3, S3, -S3],
  [-S3, -S3, S3],
];
const SIZES = [0.3, 0.24, 0.19, 0.14];

type M3 = number[]; // 3x3 행 우선
const ID: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mul = (a: M3, b: M3): M3 => {
  const o = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let q = 0; q < 3; q++) o[i * 3 + j] += a[i * 3 + q] * b[q * 3 + j];
  return o;
};
const rotY = (t: number): M3 => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];
const rotX = (t: number): M3 => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const apply = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

// 처음 보이는 자세. 거울상은 이 자세를 좌우로 뒤집은 것
const START: M3 = mul(rotX(0.35), rotY(0.5));
const MIRROR: V3[] = TETRA.map((v) => {
  const p = apply(START, v);
  return [-p[0], p[1], p[2]];
});

interface Crystal {
  x: number; // 0~1 (결정 더미 영역 기준)
  y: number;
  side: 1 | -1;
  dish: 0 | 1 | 2; // 0 = 더미, 1 = 접시 1, 2 = 접시 2
  rot: number;
  slot: number;
}

const N_CRYSTAL = 16;

export function chapter1(): Chapter {
  let ctx: Ctx;
  const st = {
    stage: 'turn' as Stage,
    rot: START as M3,
    spun: 0, // 돌린 총 각도
    best: 0,
    drag: null as null | { kind: 'mol'; p: Pt } | { kind: 'crystal'; i: number; p: Pt } | { kind: 'gauge' },
    crystals: [] as Crystal[],
    guess: 0.5,
    saved: false,
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; guess?: ReturnType<typeof slider> };

  function deal(): void {
    const r = rng(17);
    st.crystals = Array.from({ length: N_CRYSTAL }, (_, i) => ({
      x: 0.08 + r() * 0.84,
      y: 0.12 + r() * 0.76,
      side: (i % 2 === 0 ? 1 : -1) as 1 | -1,
      dish: 0 as const,
      rot: (r() - 0.5) * 0.9,
      slot: -1,
    }));
  }
  deal();

  // ---------- 화면 배치 ----------
  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const top = 70;
    const narrow = W < 620;
    return { W, H, top, narrow };
  };

  // 분자 두 개의 중심과 크기
  const molGeo = () => {
    const { W, H, top, narrow } = lay();
    const s = Math.min(narrow ? W * 0.14 : W * 0.15, (H - top) * 0.28);
    const y = top + (H - top) * 0.42;
    return { a: { x: W * 0.27, y }, b: { x: W * 0.73, y }, s, mirrorX: W / 2 };
  };

  const sortGeo = () => {
    const { W, H, top } = lay();
    const pile = { x: 16, y: top, w: W - 32, h: (H - top) * 0.42 };
    const dy = pile.y + pile.h + 30;
    const dw = Math.min(W * 0.4, 280);
    const dish1 = { x: W * 0.27 - dw / 2, y: dy, w: dw, h: 70 };
    const dish2 = { x: W * 0.73 - dw / 2, y: dy, w: dw, h: 70 };
    const gr = Math.min(52, W * 0.09, (H - dy - 90) * 0.5);
    const g1: Gauge = { cx: W * 0.27, cy: dy + 70 + 26 + gr, r: gr };
    const g2: Gauge = { cx: W * 0.73, cy: dy + 70 + 26 + gr, r: gr };
    return { pile, dish1, dish2, g1, g2, cr: Math.max(13, Math.min(20, W * 0.028)) };
  };

  const guessGeo = () => {
    const { W, H, top, narrow } = lay();
    const r = Math.min(narrow ? W * 0.2 : W * 0.13, (H - top) * 0.25);
    const y = top + 50 + (H - top) * 0.32 + r * 0.3;
    return { cat: { cx: W * 0.28, cy: y, r } as Gauge, prod: { cx: W * 0.72, cy: y, r } as Gauge };
  };

  const crystalPos = (c: Crystal) => {
    const g = sortGeo();
    if (c.dish === 0) return { x: g.pile.x + c.x * g.pile.w, y: g.pile.y + c.y * g.pile.h };
    const d = c.dish === 1 ? g.dish1 : g.dish2;
    const cols = 8;
    const sx = d.w / (cols + 1);
    return { x: d.x + sx * (1 + (c.slot % cols)), y: d.y + 22 + Math.floor(c.slot / cols) * 26 };
  };

  // ---------- 판정 ----------
  function matchCount(): number {
    let n = 0;
    for (let i = 0; i < 4; i++) {
      const p = apply(st.rot, TETRA[i]);
      const q = MIRROR[i];
      if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 0.45) n++;
    }
    return n;
  }

  function checkTurn(): void {
    const m = matchCount();
    st.best = Math.max(st.best, m);
    if (st.spun > TAU * 1.5 && st.best >= 2) {
      ctx.host.complete('c1m1', tr(ctx, `${Math.round((st.spun * 180) / Math.PI)}도를 돌렸지만 겹친 원자는 최대 ${st.best}개`, `Turned ${Math.round((st.spun * 180) / Math.PI)}° in total, at most ${st.best} atoms matched`));
      ctx.note('turn', '분자를 아무리 돌려도 거울상과 원자 4개가 모두 겹치지 않았다. 왼손과 오른손처럼 서로 다른 분자다.', 'However I turned the molecule, its mirror image never matched on all four atoms: like left and right hands, they are different molecules.');
    } else {
      ctx.host.result('c1m1', tr(ctx, `지금 겹친 원자 ${m}/4, 돌린 각도 ${Math.round((st.spun * 180) / Math.PI)}도`, `${m}/4 atoms match now, turned ${Math.round((st.spun * 180) / Math.PI)}°`));
    }
  }

  const dishCount = (d: 1 | 2) => {
    const cs = st.crystals.filter((c) => c.dish === d);
    return { r: cs.filter((c) => c.side > 0).length, s: cs.filter((c) => c.side < 0).length };
  };

  function checkSort(): void {
    const a = dishCount(1);
    const b = dishCount(2);
    const left = st.crystals.filter((c) => c.dish === 0).length;
    const pure = (x: { r: number; s: number }) => x.r === 0 || x.s === 0;
    if (left === 0 && pure(a) && pure(b) && a.r + a.s > 0 && b.r + b.s > 0) {
      ctx.host.complete('c1m2', tr(ctx, '두 접시가 각각 한쪽 손 100%', 'Each dish is 100% one hand'));
      ctx.note('sort', `결정 ${N_CRYSTAL}개를 모양대로 나누자 두 접시의 계기판이 양 끝(100%)을 가리켰고, 전부 섞으면 가운데(0%)였다.`, `Sorting ${N_CRYSTAL} crystals by shape sent each dish's gauge to an end (100%); mixed together they read 0%.`);
    } else {
      ctx.host.result('c1m2', tr(ctx, `남은 결정 ${left}개. 접시 1: ${fmtEe(ee(a.r, a.s), true)}, 접시 2: ${fmtEe(ee(b.r, b.s), true)}`, `${left} left. Dish 1: ${fmtEe(ee(a.r, a.s), false)}, dish 2: ${fmtEe(ee(b.r, b.s), false)}`));
    }
  }

  function place(i: number, dish: 1 | 2): void {
    const c = st.crystals[i];
    const used = new Set(st.crystals.filter((x) => x.dish === dish).map((x) => x.slot));
    let s = 0;
    while (used.has(s)) s++;
    c.dish = dish;
    c.slot = s;
    checkSort();
  }

  function saveGuess(): void {
    setPred(st.guess);
    st.saved = true;
    ctx.host.complete('c1m3', tr(ctx, `내 예상: 생성물 ${fmtEe(st.guess, true)}`, `My guess: product ${fmtEe(st.guess, false)}`));
    ctx.note('guess', `촉매가 R 쪽 50%일 때 생성물은 ${fmtEe(st.guess, true)}일 것이라고 예상했다.`, `I predicted that a catalyst at 50% R would give a product at ${fmtEe(st.guess, false)}.`);
    ctx.host.toast(tr(ctx, '예상을 적어 두었어요. 2장에서 확인해 보세요.', 'Guess saved. Check it in chapter 2.'));
    panel();
  }

  // ---------- 컨트롤 ----------
  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const stage = segment<Stage>({
      label: ko ? '단계' : 'Step',
      value: st.stage,
      options: [
        { v: 'turn', label: ko ? '① 돌려 보기' : '① Turn' },
        { v: 'sort', label: ko ? '② 결정 나누기' : '② Sort' },
        { v: 'guess', label: ko ? '③ 예상하기' : '③ Predict' },
      ],
      onChange: (v) => {
        st.stage = v;
        st.idle = 0;
        panel();
      },
    });
    ui = { ro: readout() };
    const kids: HTMLElement[] = [stage.el];
    if (st.stage === 'turn') {
      const turn = (ax: 'x' | 'y', d: number) => () => {
        st.rot = mul(ax === 'y' ? rotY(d) : rotX(d), st.rot);
        st.spun += Math.abs(d);
        st.idle = 0;
        checkTurn();
      };
      kids.push(
        h2(stepButton({ label: ko ? '옆으로 돌리기 ↻' : 'Turn sideways ↻', onClick: turn('y', 0.4) }).el, stepButton({ label: ko ? '앞뒤로 돌리기 ↓' : 'Tip forward ↓', onClick: turn('x', 0.4) }).el),
        stepButton({
          label: ko ? '처음 자세로' : 'Back to start',
          onClick: () => {
            st.rot = START;
            checkTurn();
          },
        }).el,
      );
    } else if (st.stage === 'sort') {
      const next = (d: 1 | 2) => () => {
        const i = st.crystals.findIndex((c) => c.dish === 0);
        if (i >= 0) place(i, d);
        st.idle = 0;
      };
      kids.push(
        h2(stepButton({ label: ko ? '다음 결정 → 접시 1' : 'Next crystal → dish 1', onClick: next(1) }).el, stepButton({ label: ko ? '다음 결정 → 접시 2' : 'Next crystal → dish 2', onClick: next(2) }).el),
        stepButton({
          label: ko ? '결정 다시 쏟기' : 'Pour crystals back',
          onClick: () => {
            deal();
            checkSort();
          },
        }).el,
      );
    } else {
      ui.guess = slider({
        label: ko ? '생성물 예상' : 'Product guess',
        min: -100,
        max: 100,
        step: 1,
        value: Math.round(st.guess * 100),
        fmt: (v) => fmtEe(v / 100, ko),
        onInput: (v) => {
          st.guess = v / 100;
          st.saved = false;
        },
      });
      kids.push(ui.guess.el, stepButton({ label: st.saved ? (ko ? '예상 다시 적기' : 'Save again') : ko ? '이 예상으로 적어 두기' : 'Save this guess', onClick: saveGuess }).el);
    }
    kids.push(ui.ro.el);
    ctx.host.controls.append(...kids);
  }

  function h2(a: HTMLElement, b: HTMLElement): HTMLElement {
    const d = document.createElement('div');
    d.className = 'btn-row';
    d.style.display = 'flex';
    d.style.gap = '8px';
    d.style.flexWrap = 'wrap';
    d.append(a, b);
    return d;
  }

  // ---------- 그리기 ----------
  function drawMol(c: CanvasRenderingContext2D, cx: number, cy: number, s: number, pts: V3[], ghost = false): void {
    const pal = ctx.pal();
    const cols = [pal.blue, pal.red, pal.ink, pal.paper];
    const items = pts.map((p, i) => ({ p, i })).sort((a, b) => a.p[2] - b.p[2]);
    const proj = (p: V3) => ({ x: cx + p[0] * s, y: cy - p[1] * s, sc: 1 + p[2] * 0.25 });
    const center = () => {
      c.fillStyle = ghost ? alpha(pal.ink, 0.25) : pal.ink;
      c.beginPath();
      c.arc(cx, cy, s * 0.13, 0, TAU);
      c.fill();
      text(c, pal, 'C', cx, cy + 4, { size: 11, align: 'center', color: pal.paper });
    };
    let drewCenter = false;
    for (const { p, i } of items) {
      if (!drewCenter && p[2] >= 0) {
        center();
        drewCenter = true;
      }
      const q = proj(p);
      c.strokeStyle = ghost ? alpha(pal.ink, 0.3) : pal.ink;
      c.lineWidth = 3 * q.sc;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(q.x, q.y);
      c.stroke();
      c.beginPath();
      c.arc(q.x, q.y, s * SIZES[i] * q.sc, 0, TAU);
      c.globalAlpha = ghost ? 0.35 : 1;
      c.fillStyle = cols[i];
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = pal.ink;
      c.stroke();
      c.globalAlpha = 1;
    }
    if (!drewCenter) center();
  }

  function drawCrystal(c: CanvasRenderingContext2D, x: number, y: number, r: number, side: 1 | -1, rot: number, lift = false): void {
    const pal = ctx.pal();
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    if (lift) c.scale(1.15, 1.15);
    // 육각 기둥 모양 결정
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 1.2;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = pal.surface || pal.paper;
    c.fill();
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.8;
    c.stroke();
    // 한쪽 모서리에만 있는 작은 면: 이 위치가 손을 알려 준다 (파스퇴르가 본 반면상)
    const sx = side > 0 ? 1 : -1;
    c.beginPath();
    c.moveTo(sx * r * 0.87, -r * 0.6);
    c.lineTo(sx * r * 0.2, -r * 1.2);
    c.lineTo(sx * r * 0.87, -r * 0.05);
    c.closePath();
    c.fillStyle = pal.red;
    c.fill();
    c.restore();
  }

  function draw(): void {
    const { ctx: c, w: W, h: H } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    c.clearRect(0, 0, W, H);
    const pad = 18;
    if (st.stage === 'turn') {
      caption(c, pal, ko ? '왼쪽 분자를 끌어서 돌려 보세요. 오른쪽 거울상과 똑같이 겹치게 만들 수 있을까요?' : 'Drag the left molecule to turn it. Can you make it match its mirror image on the right?', pad, 28, W - 2 * pad);
      const g = molGeo();
      c.strokeStyle = alpha(pal.ink, 0.35);
      c.setLineDash([6, 6]);
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(g.mirrorX, g.a.y - g.s * 1.5);
      c.lineTo(g.mirrorX, g.a.y + g.s * 1.5);
      c.stroke();
      c.setLineDash([]);
      text(c, pal, ko ? '거울' : 'mirror', g.mirrorX, g.a.y + g.s * 1.5 + 18, { size: 13, align: 'center' });
      drawMol(c, g.a.x, g.a.y, g.s, TETRA.map((v) => apply(st.rot, v)));
      drawMol(c, g.b.x, g.b.y, g.s, MIRROR);
      // 겹쳐 보기: 거울상 위에 내 분자를 옅게
      drawMol(c, g.b.x, g.b.y, g.s, TETRA.map((v) => apply(st.rot, v)), true);
      const m = matchCount();
      const y2 = g.a.y + g.s * 1.5 + 50;
      text(c, pal, ko ? `오른쪽에 옅게 겹친 모습: 원자 ${m}개 / 4개 일치` : `Overlay on the right: ${m} of 4 atoms match`, W / 2, Math.min(H - 16, y2), { size: 16, align: 'center', color: pal.blue, title: true });
      if (st.idle > 5 && st.spun < 0.5) pulse(c, pal, g.a.x, g.a.y, g.s * 1.3, st.t);
      ui.ro.set(ko ? `겹친 원자 ${m}/4 (지금까지 최대 ${st.best})` : `${m}/4 atoms match (best so far ${st.best})`);
    } else if (st.stage === 'sort') {
      const g = sortGeo();
      caption(c, pal, ko ? '결정을 끌어 접시에 담으세요. 빨간 작은 면이 어느 쪽 모서리에 있는지 보세요.' : 'Drag crystals into the dishes. Look at which corner has the small red facet.', pad, 28, W - 2 * pad);
      c.strokeStyle = alpha(pal.ink, 0.2);
      c.lineWidth = 1;
      c.strokeRect(g.pile.x, g.pile.y, g.pile.w, g.pile.h);
      for (const [d, lab] of [
        [g.dish1, ko ? '접시 1' : 'Dish 1'],
        [g.dish2, ko ? '접시 2' : 'Dish 2'],
      ] as const) {
        c.strokeStyle = pal.ink;
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, d.h / 2, 0, 0, TAU);
        c.stroke();
        text(c, pal, lab, d.x + d.w / 2, d.y - 8, { size: 14, align: 'center', title: true });
      }
      st.crystals.forEach((cr, i) => {
        if (st.drag?.kind === 'crystal' && st.drag.i === i) return;
        const p = crystalPos(cr);
        drawCrystal(c, p.x, p.y, cr.dish === 0 ? g.cr : g.cr * 0.6, cr.side, cr.dish === 0 ? cr.rot : 0);
      });
      if (st.drag?.kind === 'crystal') drawCrystal(c, st.drag.p.x, st.drag.p.y, g.cr, st.crystals[st.drag.i].side, 0, true);
      const a = dishCount(1);
      const b = dishCount(2);
      gauge(c, pal, g.g1, { value: a.r + a.s ? ee(a.r, a.s) : null, ko, showValue: true });
      gauge(c, pal, g.g2, { value: b.r + b.s ? ee(b.r, b.s) : null, ko, showValue: true });
      const all = st.crystals.filter((x) => x.dish > 0);
      const tr2 = all.filter((x) => x.side > 0).length;
      ui.ro.set(
        ko
          ? `편광계(계기판)는 접시 용액이 어느 손으로 얼마나 치우쳤는지 보여 줘요.\n접시 1: ${fmtEe(ee(a.r, a.s), true)}\n접시 2: ${fmtEe(ee(b.r, b.s), true)}\n둘 다 섞으면: ${fmtEe(ee(tr2, all.length - tr2), true)}`
          : `The polarimeter (gauge) shows how far each dish leans to one hand.\nDish 1: ${fmtEe(ee(a.r, a.s), false)}\nDish 2: ${fmtEe(ee(b.r, b.s), false)}\nBoth mixed: ${fmtEe(ee(tr2, all.length - tr2), false)}`,
      );
      if (st.idle > 5 && st.crystals.every((x) => x.dish === 0)) {
        const p = crystalPos(st.crystals[0]);
        pulse(c, pal, p.x, p.y, g.cr * 1.6, st.t);
      }
    } else {
      const g = guessGeo();
      const yEnd = caption(c, pal, ko ? '촉매도 R과 S가 섞여 있으면 어떨까요? 촉매가 R 쪽 50%일 때, 이 촉매로 만든 생성물은 어디를 가리킬지 오른쪽 바늘을 끌어 예상해 보세요.' : 'What if the catalyst itself is a mixture? With a catalyst at 50% R, drag the right needle to where you think the product will point.', pad, 28, W - 2 * pad);
      void yEnd;
      gauge(c, pal, g.cat, { value: 0.5, label: ko ? '촉매' : 'Catalyst', ko });
      gauge(c, pal, g.prod, { pred: st.guess, label: ko ? '생성물 (내 예상)' : 'Product (my guess)', ko, showValue: false });
      text(c, pal, fmtEe(st.guess, ko), g.prod.cx, g.prod.cy + 13 + 40, { size: 14, align: 'center', color: pal.blue });
      text(c, pal, ko ? '(순수한 촉매라면 생성물도 순수하다고 가정)' : '(assume a pure catalyst gives a pure product)', W / 2, H - 14, { size: 13, align: 'center' });
      if (!st.saved && st.idle > 4) pulse(c, pal, g.prod.cx, g.prod.cy - g.prod.r * 0.5, g.prod.r * 0.6, st.t);
      ui.ro.set(st.saved ? (ko ? `적어 둔 예상: ${fmtEe(shared.pred ?? st.guess, true)}` : `Saved guess: ${fmtEe(shared.pred ?? st.guess, false)}`) : ko ? '바늘을 놓고 "이 예상으로 적어 두기"를 누르세요.' : 'Place the needle, then press "Save this guess".');
    }
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  // ---------- 입력 ----------
  function down(p: Pt): void {
    st.idle = 0;
    if (st.stage === 'turn') st.drag = { kind: 'mol', p };
    else if (st.stage === 'sort') {
      const g = sortGeo();
      let best = -1;
      let bd = Infinity;
      st.crystals.forEach((c, i) => {
        if (c.dish !== 0) return;
        const q = crystalPos(c);
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < g.cr * 1.4 && d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best >= 0) st.drag = { kind: 'crystal', i: best, p };
    } else {
      const g = guessGeo();
      const v = gaugeHit(g.prod, p.x, p.y);
      if (v != null) {
        st.drag = { kind: 'gauge' };
        setGuess(v);
      }
    }
  }

  function setGuess(v: number): void {
    st.guess = Math.round(clamp(v, -1, 1) * 100) / 100;
    st.saved = false;
    ui.guess?.set(Math.round(st.guess * 100));
  }

  function move(p: Pt): void {
    const d = st.drag;
    if (!d) return;
    if (d.kind === 'mol') {
      const dx = p.x - d.p.x;
      const dy = p.y - d.p.y;
      st.rot = mul(rotX(dy * 0.012), mul(rotY(dx * 0.012), st.rot));
      st.spun += Math.hypot(dx, dy) * 0.012;
      d.p = p;
      checkTurn();
    } else if (d.kind === 'crystal') d.p = p;
    else setGuess(gaugeValue(guessGeo().prod, p.x, p.y));
  }

  function up(p: Pt): void {
    const d = st.drag;
    st.drag = null;
    if (d?.kind === 'crystal') {
      const g = sortGeo();
      const inside = (r: { x: number; y: number; w: number; h: number }) => p.x > r.x - 20 && p.x < r.x + r.w + 20 && p.y > r.y - 30 && p.y < r.y + r.h + 30;
      if (inside(g.dish1)) place(d.i, 1);
      else if (inside(g.dish2)) place(d.i, 2);
    }
  }

  return {
    id: '1',
    ko: '반반의 세계',
    en: 'A half-and-half world',
    missions: [
      {
        id: 'c1m1',
        ko: '왼쪽 분자를 돌려서 거울상과 원자 4개가 모두 겹치게 만들어 보라.',
        en: 'Turn the left molecule until all four atoms match its mirror image.',
        hint_ko: '한 바퀴 반 넘게 이리저리 돌려 보세요. 두 개까지는 맞출 수 있는데, 그러면 나머지 두 개가 서로 자리를 바꾼 채 남습니다.',
        hint_en: 'Turn it every way for more than a full turn and a half. You can match two atoms, but then the other two are swapped.',
      },
      {
        id: 'c1m2',
        ko: '결정 16개를 모양대로 나눠 두 접시의 계기판이 각각 양 끝을 가리키게 하라.',
        en: 'Sort all 16 crystals by shape so that each dish gauge points to an end.',
        hint_ko: '빨간 작은 면이 오른쪽 모서리에 있는 결정과 왼쪽 모서리에 있는 결정을 따로 모으세요. 결정이 기울어져 있어도 면의 위치는 그대로입니다.',
        hint_en: 'Put crystals with the red facet on the right corner in one dish and those with it on the left in the other. Tilting does not move the facet.',
      },
      {
        id: 'c1m3',
        ko: '촉매가 R 쪽 50%일 때 생성물은 어디를 가리킬지 바늘로 예상해 적어 두어라.',
        en: 'Predict with the needle where the product will point when the catalyst is 50% R, and save it.',
        hint_ko: '정답을 맞히는 미션이 아닙니다. 직감대로 놓아 두면 2장에서 실제와 나란히 비교합니다.',
        hint_en: 'This is not about being right. Follow your gut; chapter 2 puts your guess next to the real result.',
      },
    ],
    content: {
      ko: {
        observe: `<p>탄소 하나에 서로 다른 원자 네 개가 붙은 분자는 거울에 비친 모습과 겹쳐지지 않습니다. 왼손과 오른손처럼요. 이런 분자를 <b>키랄</b> 분자라 하고, 두 형태를 R과 S로 부릅니다.</p><p>실험실에서 이런 분자를 그냥 만들면 R과 S가 정확히 반반으로 나옵니다. 반응이 어느 손도 편들 이유가 없으니까요. 그런데 생명은 아미노산은 거의 한쪽 손, 당은 다른 한쪽 손만 씁니다.</p><p class="q">반반이 기본인 세계에서, 어떻게 한쪽만 남게 되었을까?</p>`,
        interact: '단계를 차례로 눌러 분자를 돌려 보고, 결정을 나누고, 다음 장의 결과를 예상해 보세요. 미션은 선택 사항입니다.',
        understand: `<h4>얼마나 치우쳤나: ee</h4><p>계기판은 거울상 초과율(ee)을 보여 줍니다. 한쪽이 다른 쪽보다 얼마나 많은지를 나타내는 값입니다.</p>$$ee = \\frac{[R]-[S]}{[R]+[S]}$$<p>R과 S가 50개씩이면 0%, R 75개와 S 25개면 50%, R만 있으면 100%입니다.</p><h4>파스퇴르의 핀셋</h4><p>1848년 루이 파스퇴르는 타르타르산 염의 결정에 작은 면이 서로 반대쪽에 난 두 종류가 있다는 것을 알아채고, 핀셋으로 하나씩 골라 나눴습니다. 각각을 녹인 용액은 편광을 반대 방향으로 돌렸고, 섞으면 아무 효과가 없었습니다.</p><h4>왜 중요한가</h4><p>약 분자도 한쪽 손만 치료 효과가 있고 다른 손은 효과가 없거나 해로울 수 있습니다. 그래서 화학자는 한쪽 손만 골라 만드는 방법이 필요합니다. 이미 한쪽 손인 <b>키랄 촉매</b>가 그 도구입니다.</p><h4>실제와 다른 점</h4><p>분자 모양은 공과 막대로 단순화했습니다. 실제 결정 모양과 편광계의 원리는 그림보다 복잡하고, 결정이 늘 이렇게 깔끔하게 나뉘는 것도 아닙니다.</p>`,
      },
      en: {
        observe: `<p>A carbon with four different atoms attached cannot be laid on top of its mirror image, just like your left and right hands. Such molecules are called <b>chiral</b>, and the two forms are named R and S.</p><p>Make one in a flask without any help and you get exactly half R, half S: nothing favours either hand. Yet life uses almost only one hand of amino acids and one hand of sugars.</p><p class="q">In a world where half and half is the default, how did only one hand remain?</p>`,
        interact: 'Go through the steps: turn the molecule, sort the crystals, and predict the next chapter. Missions are optional.',
        understand: `<h4>How lopsided: ee</h4><p>The gauge shows the enantiomeric excess (ee): how much more of one hand there is.</p>$$ee = \\frac{[R]-[S]}{[R]+[S]}$$<p>50 R and 50 S gives 0%, 75 R and 25 S gives 50%, only R gives 100%.</p><h4>Pasteur's tweezers</h4><p>In 1848 Louis Pasteur noticed that crystals of a tartrate salt came in two kinds, with small facets on opposite sides, and sorted them by hand. Their solutions rotated polarised light in opposite directions; mixed, they did nothing.</p><h4>Why it matters</h4><p>Often only one hand of a drug molecule works and the other does nothing or harm. Chemists need ways to make just one hand, and a <b>chiral catalyst</b>, itself one-handed, is the tool.</p><h4>How this differs from reality</h4><p>Molecules are drawn as balls and sticks. Real crystal shapes and polarimeters are more complicated, and crystals do not always separate this neatly.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      panel();
      checkTurn();
      checkSort();
      if (shared.pred != null) {
        st.guess = shared.pred;
        st.saved = true;
        panel();
      }
    },
    panel,
    frame(dt) {
      st.t += dt;
      st.idle += dt;
      draw();
    },
    reset() {
      st.rot = START;
      st.spun = 0;
      st.best = 0;
      st.guess = 0.5;
      st.saved = false;
      st.idle = 0;
      setPred(null);
      deal();
      panel();
      checkTurn();
      checkSort();
    },
    down,
    move,
    up,
  };
}
