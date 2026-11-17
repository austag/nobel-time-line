// 4장: 처음 기울인 것은 누구인가. 완벽한 반반에서 시작해 우연이 어떻게 한쪽을 고르는지, 씨앗이 방향을 어떻게 정하는지 본다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, segment, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { bead, caption, flask, fmtEe, pulse } from './draw';
import { FLASK, ee, rng, runFlask } from './model';

type Mode = 'one' | 'many';
type Seed = 'none' | 'qa' | 'qb' | 'light';
type Guess = 'none' | 'stay' | 'tip';

const BIAS: Record<Seed, number> = { none: 0, qa: 0.5, qb: -0.5, light: 0.25 };
const SHOW = 300; // 한 플라스크에서 하나하나 그릴 분자 수
const REVEAL = 2.5; // 100개 결과가 다 드러나는 시간 (초)

export function chapter4(): Chapter {
  let ctx: Ctx;
  const st = {
    mode: 'one' as Mode,
    guess: 'none' as Guess,
    // 한 플라스크
    seq: [] as number[],
    idx: 0,
    playing: false,
    pos: [] as { u: number; v: number }[],
    runs: 0,
    // 100개
    seed: 'none' as Seed,
    results: [] as number[],
    shown: 0,
    revealT: 0,
    batch: 0,
    drag: null as null | { seed: Seed; p: Pt },
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout> };

  const seedName = (s: Seed, ko: boolean) =>
    ({ none: ko ? '씨앗 없음' : 'No seed', qa: ko ? '석영 결정 A' : 'Quartz crystal A', qb: ko ? '석영 결정 B (A의 거울상)' : 'Quartz crystal B (mirror of A)', light: ko ? '원편광' : 'Circularly polarised light' })[s];

  function newFlask(): void {
    const r = rng(1000 + st.runs * 7919);
    st.runs++;
    st.seq = runFlask(r, FLASK, FLASK.n).trace;
    st.idx = 0;
    st.playing = true;
    const rp = rng(77 + st.runs);
    st.pos = Array.from({ length: SHOW }, () => ({ u: rp(), v: rp() }));
    st.idle = 0;
  }

  function runMany(): void {
    const r = rng(20000 + st.batch * 104729);
    st.batch++;
    st.results = Array.from({ length: 100 }, () => {
      const f = runFlask(r, { ...FLASK, bias: BIAS[st.seed] });
      return ee(f.r, f.s);
    });
    st.shown = 0;
    st.revealT = 0;
    st.idle = 0;
  }

  const counted = (n: number) => {
    let r = 0;
    for (let i = 0; i < n; i++) if (st.seq[i] > 0) r++;
    return { r, s: n - r };
  };

  // ---------- 판정 ----------
  function guessText(ko: boolean): string {
    return st.guess === 'stay' ? (ko ? '끝까지 반반일 것' : 'stay 50:50') : ko ? '한쪽으로 갈 것' : 'tip to one side';
  }

  function checkOne(): void {
    if (st.idx < st.seq.length || !st.seq.length) return;
    const all = counted(st.seq.length);
    const first = counted(10);
    const e = ee(all.r, all.s);
    ctx.host.complete('c4m1', tr(ctx, `처음 10개는 R ${first.r}, S ${first.s}. 끝은 ${fmtEe(e, true)}`, `First 10: ${first.r} R, ${first.s} S. Final: ${fmtEe(e, false)}`));
    ctx.note('one', `완벽한 반반에서 시작한 플라스크에서 처음 10개는 R ${first.r}개, S ${first.s}개로 우연히 생겼지만, 끝에는 ${fmtEe(e, true)}가 되었다.${st.guess !== 'none' ? ` 처음엔 ${guessText(true)}이라고 예상했다.` : ''}`, `In a flask started perfectly 50:50 the first 10 molecules were ${first.r} R and ${first.s} S by chance, but it ended at ${fmtEe(e, false)}.${st.guess !== 'none' ? ` I had predicted it would ${guessText(false)}.` : ''}`);
  }

  function checkMany(): void {
    if (st.shown < 100 || !st.results.length) return;
    const rw = st.results.filter((x) => x > 0).length;
    const sw = 100 - rw;
    if (st.seed === 'none') {
      if (rw >= 25 && sw >= 25) {
        ctx.host.complete('c4m2', tr(ctx, `R 승 ${rw}, S 승 ${sw}`, `R won ${rw}, S won ${sw}`));
        ctx.note('many', `씨앗 없이 플라스크 100개를 돌리자 거의 모두 한쪽으로 크게 치우쳤지만, R이 이긴 곳이 ${rw}개, S가 이긴 곳이 ${sw}개로 어느 쪽이 이길지는 우연이었다.`, `With no seed, nearly all 100 flasks ended strongly lopsided, but R won ${rw} and S won ${sw}: which side wins is chance.`);
      }
    } else {
      const best = Math.max(rw, sw);
      const side = rw >= sw ? 'R' : 'S';
      if (best >= 90) {
        ctx.host.complete('c4m3', tr(ctx, `${seedName(st.seed, true)}: ${side}가 100개 중 ${best}개`, `${seedName(st.seed, false)}: ${side} won ${best} of 100`));
        ctx.note('seed', `${seedName(st.seed, true)}을 넣자 플라스크 100개 중 ${best}개에서 ${side}가 이겼다. 아주 작은 계기가 방향을 정한다.`, `With ${seedName(st.seed, false)}, ${side} won in ${best} of 100 flasks. A tiny trigger sets the direction.`);
      } else ctx.host.result('c4m3', tr(ctx, `${seedName(st.seed, true)}: ${side}가 ${best}개. 90개를 넘는 씨앗을 찾아보세요.`, `${seedName(st.seed, false)}: ${side} won ${best}. Find a seed that passes 90.`));
    }
  }

  // ---------- 컨트롤 ----------
  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const g = segment<Guess>({
      label: ko ? '내 예상: 완벽한 반반에서 시작하면?' : 'My guess: start perfectly 50:50, then?',
      value: st.guess,
      options: [
        { v: 'stay', label: ko ? '끝까지 반반' : 'Stays 50:50' },
        { v: 'tip', label: ko ? '한쪽으로 간다' : 'Tips to one side' },
      ],
      onChange: (v) => {
        st.guess = v;
        ctx.note('guess', `완벽한 반반에서 시작하면 ${guessText(true)}이라고 예상했다.`, `I predicted that a perfectly 50:50 start would ${guessText(false)}.`);
      },
    });
    const mode = segment<Mode>({
      label: ko ? '보기' : 'View',
      value: st.mode,
      options: [
        { v: 'one', label: ko ? '한 플라스크 천천히' : 'One flask, slowly' },
        { v: 'many', label: ko ? '플라스크 100개' : '100 flasks' },
      ],
      onChange: (v) => {
        st.mode = v;
        st.idle = 0;
        panel();
      },
    });
    ui = { ro: readout() };
    const kids: HTMLElement[] = [g.el, mode.el];
    if (st.mode === 'one') {
      kids.push(
        stepButton({ label: st.seq.length ? (ko ? '새 플라스크 돌리기' : 'Run a new flask') : ko ? '플라스크 돌리기' : 'Run the flask', onClick: () => (newFlask(), panel()) }).el,
        stepButton({
          label: ko ? '끝까지 빨리 감기' : 'Skip to the end',
          onClick: () => {
            if (!st.seq.length) newFlask();
            st.idx = st.seq.length;
            checkOne();
          },
        }).el,
      );
    } else {
      const seed = segment<Seed>({
        label: ko ? '씨앗' : 'Seed',
        value: st.seed,
        options: (['none', 'qa', 'qb', 'light'] as Seed[]).map((v) => ({ v, label: seedName(v, ko).replace(' (A의 거울상)', '').replace(' (mirror of A)', '') })),
        onChange: (v) => {
          st.seed = v;
          st.results = [];
        },
      });
      kids.push(seed.el, stepButton({ label: ko ? '100개 동시에 돌리기' : 'Run 100 at once', onClick: runMany }).el);
    }
    kids.push(ui.ro.el);
    ctx.host.controls.append(...kids);
  }

  // ---------- 그리기 ----------
  function drawOne(): void {
    const { ctx: c, w: W, h: H } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const narrow = W < 760;
    const top = narrow ? 60 : 70;
    caption(c, pal, ko ? 'R과 S가 하나도 없는 완벽한 반반에서 시작합니다. 분자는 하나씩 무작위로 생기고, 생긴 분자는 곧 촉매가 됩니다.' : 'Start perfectly 50:50, with no R or S at all. Molecules form one at a time by chance, and each becomes a catalyst.', 14, 24, W - 28, narrow ? 13 : 15);
    const fw = narrow ? W * 0.46 : Math.min(W * 0.32, (H - top) * 0.7);
    const fh = narrow ? (H - top) * 0.46 : Math.min((H - top) * 0.66, fw * 1.1);
    const fx = narrow ? 14 : W * 0.06;
    const fy = top + 34;
    const n = Math.floor(st.idx);
    const cnt = counted(n);
    const fg = flask(c, pal, fx, fy, fw, fh, { level: n ? 0.8 : 0.05, mixR: n ? cnt.r / n : null });
    // 분자 점: 처음 SHOW 개는 생긴 순서대로, 그 뒤로는 전체 비율을 보여 준다
    const br = Math.max(2.4, fw / 60);
    const shownN = Math.min(n, SHOW);
    const fracR = n ? cnt.r / n : 0.5;
    for (let i = 0; i < shownN; i++) {
      const side = n <= SHOW ? (st.seq[i] as 1 | -1) : ((i / SHOW < fracR ? 1 : -1) as 1 | -1);
      const p = st.pos[i];
      const yy = fg.bottom - 6 - p.v * (fg.bottom - fg.top) * 0.75;
      const xx = fg.left(yy) + 6 + p.u * (fg.right(yy) - fg.left(yy) - 12);
      bead(c, pal, xx, yy, br, side, i === n - 1 && n <= SHOW ? 1 : 0.9);
    }
    // 처음 생긴 분자 줄
    const rx = narrow ? fx + fw + 16 : fx + fw + 40;
    const rw = W - rx - 16;
    text(c, pal, ko ? '처음 생긴 분자 20개' : 'First 20 molecules', rx, fy + 4, { size: 14, title: true });
    const cell = Math.min(18, rw / 10.5);
    for (let i = 0; i < 20; i++) {
      const x = rx + (i % 10) * cell * 1.05 + cell / 2;
      const y = fy + 24 + Math.floor(i / 10) * cell * 1.2;
      if (i < n) bead(c, pal, x, y, cell * 0.36, st.seq[i] as 1 | -1);
      else {
        c.strokeStyle = alpha(pal.ink, 0.25);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x, y, cell * 0.3, 0, TAU);
        c.stroke();
      }
    }
    // ee 변화 그래프 (분자 수는 10배씩)
    const G = { x: rx + 30, y: fy + 24 + cell * 2.6 + 30, w: rw - 40, h: Math.min(H - (fy + 24 + cell * 2.6 + 30) - 50, 220) };
    if (G.h > 50 && G.w > 80) {
      const lmax = Math.log10(FLASK.n);
      const X = (m: number) => G.x + (Math.log10(Math.max(1, m)) / lmax) * G.w;
      const Y = (e: number) => G.y + G.h / 2 - (e * G.h) / 2;
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.2;
      c.strokeRect(G.x, G.y, G.w, G.h);
      c.strokeStyle = alpha(pal.ink, 0.3);
      c.setLineDash([4, 4]);
      c.beginPath();
      c.moveTo(G.x, Y(0));
      c.lineTo(G.x + G.w, Y(0));
      c.stroke();
      c.setLineDash([]);
      text(c, pal, 'R 100%', G.x - 5, Y(1) + 10, { size: 10, align: 'right' });
      text(c, pal, ko ? '반반' : '50:50', G.x - 5, Y(0) + 4, { size: 10, align: 'right' });
      text(c, pal, 'S 100%', G.x - 5, Y(-1), { size: 10, align: 'right' });
      text(c, pal, ko ? '생긴 분자 수 → (눈금이 10배씩)' : 'molecules formed → (×10 per tick)', G.x + G.w, G.y + G.h + 15, { size: 11, align: 'right' });
      for (let p = 0; p <= Math.floor(lmax); p++) {
        const xx = X(Math.pow(10, p));
        c.strokeStyle = alpha(pal.ink, 0.12);
        c.beginPath();
        c.moveTo(xx, G.y);
        c.lineTo(xx, G.y + G.h);
        c.stroke();
      }
      if (n) {
        c.strokeStyle = pal.blue;
        c.lineWidth = 2.2;
        c.beginPath();
        let r = 0;
        for (let i = 0; i < n; i++) {
          if (st.seq[i] > 0) r++;
          const m = i + 1;
          if (m > 50 && m % Math.max(1, Math.floor(m / 60)) !== 0 && m !== n) continue;
          const e = (2 * r - m) / m;
          if (i === 0) c.moveTo(X(m), Y(e));
          else c.lineTo(X(m), Y(e));
        }
        c.stroke();
      }
    }
    if (!st.seq.length && st.idle > 3) pulse(c, pal, fx + fw / 2, fy + fh * 0.6, fw * 0.5, st.t);
    const e = n ? ee(cnt.r, cnt.s) : 0;
    ui.ro.set(n ? (ko ? `생긴 분자 ${n}개: R ${cnt.r}, S ${cnt.s}\n지금 ${fmtEe(e, true)}` : `${n} molecules: ${cnt.r} R, ${cnt.s} S\nNow ${fmtEe(e, false)}`) : ko ? '"플라스크 돌리기"를 누르거나 플라스크를 누르세요.' : 'Press "Run the flask" or tap the flask.');
  }

  const manyLay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 60 : 70;
    const seedsY = top + 16;
    const gs = narrow ? Math.min(W - 40, (H - top) * 0.46) : Math.min(W * 0.42, H - top - 110);
    const grid = { x: narrow ? (W - gs) / 2 : W * 0.05, y: seedsY + 66, s: gs };
    const hist = narrow ? { x: 40, y: grid.y + gs + 34, w: W - 70, h: H - (grid.y + gs + 34) - 40 } : { x: W * 0.55, y: grid.y + 20, w: W * 0.4, h: Math.min(gs * 0.7, H - grid.y - 80) };
    const seeds: { seed: Seed; x: number; y: number }[] = (['qa', 'qb', 'light'] as Seed[]).map((s, i) => ({ seed: s, x: grid.x + 30 + i * 74, y: seedsY + 24 }));
    const slot = { x: grid.x + grid.s - 50, y: seedsY + 24 };
    return { W, H, narrow, top, grid, hist, seeds, slot };
  };

  function drawSeedIcon(c: CanvasRenderingContext2D, s: Seed, x: number, y: number, sc = 1): void {
    const pal = ctx.pal();
    c.save();
    c.translate(x, y);
    c.scale(sc, sc);
    if (s === 'light') {
      c.strokeStyle = pal.red;
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = (i / 40) * TAU * 2;
        const xx = -18 + (i / 40) * 36;
        const yy = Math.sin(t) * 7;
        if (i === 0) c.moveTo(xx, yy);
        else c.lineTo(xx, yy);
      }
      c.stroke();
      c.beginPath();
      c.ellipse(16, 0, 3, 8, 0, 0, TAU);
      c.stroke();
    } else if (s !== 'none') {
      const sx = s === 'qa' ? 1 : -1;
      c.fillStyle = pal.surface || pal.paper;
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(-8, 14);
      c.lineTo(-8, -6);
      c.lineTo(0, -18);
      c.lineTo(8, -6);
      c.lineTo(8, 14);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = pal.red;
      c.beginPath();
      c.moveTo(sx * 8, -6);
      c.lineTo(sx * 2, -14);
      c.lineTo(sx * 8, 0);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawMany(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = manyLay();
    caption(c, pal, ko ? '씨앗 없이, 또는 씨앗을 넣고 플라스크 100개를 한꺼번에 돌려 보세요. 씨앗은 끌어서 씨앗 자리에 넣습니다.' : 'Run 100 flasks at once, with or without a seed. Drag a seed into the seed slot.', 14, 24, L.W - 28, L.narrow ? 13 : 15);
    // 씨앗
    for (const s of L.seeds) {
      if (st.drag?.seed === s.seed) continue;
      drawSeedIcon(c, s.seed, s.x, s.y);
      if (!L.narrow) text(c, pal, s.seed === 'qa' ? 'A' : s.seed === 'qb' ? 'B' : ko ? '빛' : 'light', s.x, s.y + 32, { size: 11, align: 'center' });
    }
    c.strokeStyle = alpha(pal.ink, 0.5);
    c.setLineDash([4, 4]);
    c.strokeRect(L.slot.x - 26, L.slot.y - 24, 52, 48);
    c.setLineDash([]);
    if (st.seed !== 'none') drawSeedIcon(c, st.seed, L.slot.x, L.slot.y);
    text(c, pal, ko ? '씨앗 자리' : 'seed slot', L.slot.x, L.slot.y + 38, { size: 11, align: 'center' });
    if (st.drag) drawSeedIcon(c, st.drag.seed, st.drag.p.x, st.drag.p.y, 1.2);
    // 플라스크 100개
    const cs = L.grid.s / 10;
    for (let i = 0; i < 100; i++) {
      const x = L.grid.x + (i % 10) * cs + cs / 2;
      const y = L.grid.y + Math.floor(i / 10) * cs + cs / 2;
      const r = cs * 0.38;
      if (i < st.shown) {
        const e = st.results[i];
        c.fillStyle = alpha(e > 0 ? pal.blue : pal.red, 0.15 + 0.6 * Math.abs(e));
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
      }
      c.strokeStyle = alpha(pal.ink, 0.5);
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.stroke();
      if (i < st.shown && cs > 22) text(c, pal, st.results[i] > 0 ? 'R' : 'S', x, y + 4, { size: Math.min(12, cs * 0.35), align: 'center' });
    }
    // 히스토그램
    const Hh = L.hist;
    if (Hh.h > 50) {
      const bins = new Array(10).fill(0);
      for (let i = 0; i < st.shown; i++) bins[clamp(Math.floor(((st.results[i] + 1) / 2) * 10), 0, 9)]++;
      const maxB = Math.max(10, ...bins);
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(Hh.x, Hh.y);
      c.lineTo(Hh.x, Hh.y + Hh.h);
      c.lineTo(Hh.x + Hh.w, Hh.y + Hh.h);
      c.stroke();
      const bw = Hh.w / 10;
      bins.forEach((b, i) => {
        const bh = (b / maxB) * (Hh.h - 10);
        c.fillStyle = alpha(i >= 5 ? pal.blue : pal.red, 0.7);
        c.fillRect(Hh.x + i * bw + 2, Hh.y + Hh.h - bh, bw - 4, bh);
        if (b) text(c, pal, String(b), Hh.x + i * bw + bw / 2, Hh.y + Hh.h - bh - 4, { size: 11, align: 'center' });
      });
      text(c, pal, ko ? 'S 쪽 100%' : '100% S', Hh.x, Hh.y + Hh.h + 15, { size: 11 });
      text(c, pal, ko ? '반반' : '50:50', Hh.x + Hh.w / 2, Hh.y + Hh.h + 15, { size: 11, align: 'center' });
      text(c, pal, ko ? 'R 쪽 100%' : '100% R', Hh.x + Hh.w, Hh.y + Hh.h + 15, { size: 11, align: 'right' });
      text(c, pal, ko ? '↑ 플라스크 수' : '↑ flasks', Hh.x, Hh.y - 6, { size: 11 });
    }
    if (!st.results.length && st.idle > 3) pulse(c, pal, L.grid.x + L.grid.s / 2, L.grid.y + L.grid.s / 2, L.grid.s * 0.3, st.t);
    const rw = st.results.slice(0, st.shown).filter((x) => x > 0).length;
    ui.ro.set(
      st.results.length
        ? ko
          ? `${seedName(st.seed, true)}\nR이 이긴 플라스크 ${rw}, S가 이긴 플라스크 ${st.shown - rw}`
          : `${seedName(st.seed, false)}\nR won ${rw}, S won ${st.shown - rw}`
        : ko
          ? `${seedName(st.seed, true)}. "100개 동시에 돌리기"를 누르거나 플라스크 판을 누르세요.`
          : `${seedName(st.seed, false)}. Press "Run 100 at once" or tap the grid.`,
    );
  }

  // ---------- 매 프레임 ----------
  function step(dt: number): void {
    if (st.mode === 'one' && st.playing && st.seq.length) {
      const d = dt === 0 ? 1e9 : dt;
      st.idx = Math.min(st.seq.length, st.idx + d * (2.5 + st.idx * 0.75));
      if (st.idx >= st.seq.length) {
        st.playing = false;
        checkOne();
      }
    }
    if (st.mode === 'many' && st.results.length && st.shown < 100) {
      st.revealT += dt === 0 ? 1e9 : dt;
      st.shown = Math.min(100, Math.floor((st.revealT / REVEAL) * 100));
      if (st.shown >= 100) checkMany();
    }
  }

  // ---------- 입력 ----------
  function down(p: Pt): void {
    st.idle = 0;
    const { w: W, h: H } = ctx.cvs;
    if (st.mode === 'one') {
      if (p.x < W * 0.5 && p.y > 60 && p.y < H) {
        newFlask();
        panel();
      }
      return;
    }
    const L = manyLay();
    for (const s of L.seeds) if (Math.hypot(p.x - s.x, p.y - s.y) < 28) st.drag = { seed: s.seed, p };
    if (!st.drag && Math.hypot(p.x - L.slot.x, p.y - L.slot.y) < 28 && st.seed !== 'none') {
      st.seed = 'none';
      st.results = [];
      panel();
      return;
    }
    if (!st.drag && p.x > L.grid.x && p.x < L.grid.x + L.grid.s && p.y > L.grid.y && p.y < L.grid.y + L.grid.s) runMany();
  }

  function move(p: Pt): void {
    if (st.drag) st.drag.p = p;
  }

  function up(p: Pt): void {
    const d = st.drag;
    st.drag = null;
    if (!d) return;
    const L = manyLay();
    const onSlot = Math.hypot(p.x - L.slot.x, p.y - L.slot.y) < 50;
    const onGrid = p.x > L.grid.x && p.x < L.grid.x + L.grid.s && p.y > L.grid.y && p.y < L.grid.y + L.grid.s;
    if (onSlot || onGrid) {
      st.seed = d.seed;
      st.results = [];
      panel();
    }
  }

  return {
    id: '4',
    ko: '처음 기울인 것은 누구인가',
    en: 'What tipped the balance?',
    missions: [
      {
        id: 'c4m1',
        ko: '완벽한 반반에서 시작한 플라스크 하나를 끝까지 지켜보라.',
        en: 'Watch one flask that starts perfectly 50:50 all the way to the end.',
        hint_ko: '"플라스크 돌리기"를 누르고 기다리거나 "끝까지 빨리 감기"를 누르세요. 처음 몇 개가 생기는 순간을 잘 보세요.',
        hint_en: 'Press "Run the flask" and wait, or skip to the end. Watch the first few molecules closely.',
      },
      {
        id: 'c4m2',
        ko: '씨앗 없이 플라스크 100개를 돌려, R이 이긴 곳과 S가 이긴 곳이 둘 다 나오는지 확인하라.',
        en: 'Run 100 flasks with no seed and check that both R and S win somewhere.',
        hint_ko: '씨앗 자리가 비어 있는지 확인하고 "100개 동시에 돌리기"를 누르세요.',
        hint_en: 'Make sure the seed slot is empty, then press "Run 100 at once".',
      },
      {
        id: 'c4m3',
        ko: '씨앗을 넣어 100개 중 90개 이상이 같은 쪽으로 가게 하라.',
        en: 'Add a seed so that at least 90 of 100 flasks go the same way.',
        hint_ko: '씨앗마다 효과의 세기가 다릅니다. 석영 결정과 빛을 각각 넣어 보세요.',
        hint_en: 'Seeds differ in strength. Try a quartz crystal and the light.',
      },
    ],
    content: {
      ko: {
        observe: `<p>3장의 증폭기는 작은 치우침을 키웁니다. 그런데 수식으로 보면 완벽한 반반은 아무리 돌려도 반반입니다. 키울 차이가 없으니까요.</p><p>정말 그럴까요? 실제 플라스크에서는 분자가 하나씩, 무작위로 생깁니다.</p><p class="q">R과 S가 완벽하게 반반인 상태에서 시작하면, 끝까지 반반으로 남을까? 그래도 한쪽으로 갈까?</p>`,
        interact: '위에서 예상을 먼저 고른 뒤, 한 플라스크를 천천히 보고 100개를 한꺼번에 돌려 보세요.',
        understand: `<h4>완벽한 반반은 존재할 수 없다</h4><p>동전을 1,000번 던져 정확히 500 대 500이 나오기 어렵듯, 분자가 하나씩 생기면 처음 몇 개에서 이미 어느 한쪽이 조금 많아집니다. 증폭기는 그 우연한 차이를 끝까지 키웁니다.</p><p>소아이는 아무 키랄 물질도 넣지 않고 반응을 여러 번 돌렸습니다. 매번 결과는 한쪽으로 크게 치우쳤지만, 어느 쪽인지는 그때그때 달랐고 여러 번 모으면 대략 반반이었습니다.</p><h4>작은 계기가 방향을 정한다</h4><p>반대로 아주 작은 계기를 넣으면 방향을 정할 수 있습니다. 소아이 연구진은 석영 결정, 원편광을 쬔 물질, 수소를 중수소로 바꿔서 생긴 아주 미묘한 비대칭까지 계기로 쓸 수 있음을 보였습니다. 거울상인 계기를 넣으면 결과도 반대쪽으로 갑니다.</p><h4>생명은 왜 한쪽인가</h4><p>소아이 반응은 사람이 고른 인공 반응이라, 생명이 실제로 이렇게 한쪽 손을 골랐다는 증거는 아닙니다. 다만 화학 반응만으로 사실상 한쪽 손만 남을 수 있다는 것, 그리고 처음 방향은 우연이나 작은 계기로 정해질 수 있다는 것을 보여 줍니다. 생명의 아미노산과 당이 왜 지금의 손을 골랐는지는 아직 열린 질문입니다.</p><h4>다섯 줄로 정리</h4><p>1. 반반이 기본인데 생명은 한쪽만 쓴다.<br>2. 카강: 촉매가 짝을 지으면 섞인 짝이 불순물을 가둬 순도가 증폭된다.<br>3. 프랭크: 자기 자신을 만들고 반대편을 억누르면 작은 차이가 저절로 커진다.<br>4. 소아이: 생성물이 곧 촉매인 반응으로 이걸 실제로 보여 줬다.<br>5. 시작은 우연이나 작은 계기이고, 증폭기가 그걸 한쪽 손만 남는 결과로 키운다.</p><h4>실제와 다른 점</h4><p>플라스크 하나에 분자 4,000개만 넣었고, 씨앗은 촉매 없이 생기는 반응을 한쪽으로 조금 기울이는 것으로 단순화했습니다. 석영 A와 B, 빛이 실제로 어느 쪽을 만드는지는 실험 조건에 따라 다르므로 여기서는 이름 대신 기호로 불렀습니다.</p>`,
      },
      en: {
        observe: `<p>Chapter 3's amplifier grows small imbalances. On paper, a perfect 50:50 stays 50:50 forever: there is nothing to grow.</p><p>Really? In a real flask, molecules form one at a time, by chance.</p><p class="q">Start with R and S perfectly balanced. Does it stay 50:50, or still tip to one side?</p>`,
        interact: 'Pick your guess above, watch one flask slowly, then run 100 at once.',
        understand: `<h4>A perfect 50:50 cannot exist</h4><p>Toss a coin 1,000 times and exactly 500 heads is unlikely. When molecules form one by one, one hand is ahead after the first few. The amplifier grows that accident all the way.</p><p>Soai ran the reaction many times with no chiral additive at all. Each run ended strongly lopsided, but which hand varied from run to run, roughly half and half overall.</p><h4>A tiny trigger sets the direction</h4><p>Add a tiny trigger and you choose the direction. Soai's group showed that quartz crystals, material exposed to circularly polarised light, and even the faint asymmetry from swapping hydrogen for deuterium can steer it. The mirror-image trigger gives the opposite hand.</p><h4>Why is life one-handed?</h4><p>The Soai reaction is a chosen, artificial reaction, so it is not proof of how life picked its hand. It shows that chemistry alone can end up essentially one-handed, and that the first push can come from chance or a tiny trigger. Why life's amino acids and sugars have the hands they do is still open.</p><h4>In five lines</h4><p>1. Half and half is the default, yet life uses one hand.<br>2. Kagan: when catalysts pair up, mixed pairs lock away the impurity and purity is amplified.<br>3. Frank: self-copying plus suppressing the other side lets small differences grow by themselves.<br>4. Soai: a reaction whose product is its own catalyst showed it for real.<br>5. Chance or a tiny trigger starts it; the amplifier grows it into a single hand.</p><h4>How this differs from reality</h4><p>Each flask holds only 4,000 molecules, and a seed is modelled as a small tilt of the uncatalysed reaction. Which hand quartz A, B or the light actually favours depends on the experiment, so they are given letters instead of names.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      panel();
    },
    panel,
    frame(dt) {
      st.t += dt;
      st.idle += dt;
      step(dt);
      const { ctx: cc, w: W, h: H } = ctx.cvs;
      cc.clearRect(0, 0, W, H);
      if (st.mode === 'one') drawOne();
      else drawMany();
      ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
    },
    reset() {
      Object.assign(st, { seq: [], idx: 0, playing: false, results: [], shown: 0, seed: 'none', guess: 'none' });
      panel();
    },
    down,
    move,
    up,
  };
}
