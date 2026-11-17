// 2장: 짝을 짓는 촉매 (카강의 비선형 효과).
// 리간드 구슬을 금속 자리에 둘씩 짝지어 촉매를 만들고, 그 촉매가 만든 생성물의 ee 를 본다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, slider, stepButton, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { bead, caption, flask, fmtEe, gauge, pulse, type Gauge } from './draw';
import { expectedPairs, productEe, rng } from './model';
import { shared } from './shared';

type Side = 1 | -1;
interface Bead {
  side: Side;
  x: number; // 더미 안 위치 (0~1)
  y: number;
  site: number; // -1 이면 더미에 있음
}
interface Site {
  a: Side | 0;
  b: Side | 0;
  awake: boolean;
}
interface Drop {
  side: Side;
  x0: number;
  y0: number;
  t: number;
}

const N = 160;
const SITES = N / 2;
const COLS = 10;
const RS_RATE = 2; // 깨운 섞인 짝은 같은 짝보다 두 배 빨리 일한다 (R, S 반반)

export function chapter2(): Chapter {
  let ctx: Ctx;
  const st = {
    lig: 0.5,
    beads: [] as Bead[],
    sites: [] as Site[],
    running: false,
    runT: 0,
    drops: [] as Drop[],
    pile: [] as { side: Side; x: number; y: number }[],
    points: [] as { x: number; y: number; g: number }[],
    drag: null as null | { i: number; p: Pt; moved: boolean },
    downSite: -1,
    t: 0,
    idle: 0,
    seed: 1,
  };
  let ui: { ro: ReturnType<typeof readout>; run?: ReturnType<typeof toggle>; wake?: ReturnType<typeof slider> };

  function rebuild(): void {
    const r = rng(100 + st.seed++);
    const nR = Math.round((N / 2) * (1 + st.lig));
    st.beads = Array.from({ length: N }, (_, i) => ({ side: (i < nR ? 1 : -1) as Side, x: 0.05 + r() * 0.9, y: 0.08 + r() * 0.84, site: -1 }));
    // 섞어서 색이 고르게 퍼지게
    for (let i = st.beads.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = st.beads[i];
      st.beads[i] = st.beads[j];
      st.beads[j] = t;
    }
    st.sites = Array.from({ length: SITES }, () => ({ a: 0, b: 0, awake: false }));
    changed(true);
  }

  // ---------- 상태 계산 ----------
  const kind = (s: Site) => (s.a && s.b ? (s.a === s.b ? (s.a > 0 ? 'RR' : 'SS') : 'RS') : s.a || s.b ? 'half' : 'empty');
  function counts() {
    let rr = 0;
    let ss = 0;
    let rs = 0;
    let awake = 0;
    for (const s of st.sites) {
      const kd = kind(s);
      if (kd === 'RR') rr++;
      else if (kd === 'SS') ss++;
      else if (kd === 'RS') {
        rs++;
        if (s.awake) awake++;
      }
    }
    const left = st.beads.filter((b) => b.site < 0).length;
    return { rr, ss, rs, awake, left };
  }
  /** 지금 촉매들이 만드는 생성물의 R, S 속도 */
  function rates() {
    const c = counts();
    const r = c.rr + (c.awake * RS_RATE) / 2;
    const s = c.ss + (c.awake * RS_RATE) / 2;
    return { r, s, tot: r + s, ...c };
  }
  const measured = () => {
    const x = rates();
    return x.tot > 0 ? (x.r - x.s) / x.tot : null;
  };
  const gEff = () => {
    const c = counts();
    return c.rs > 0 ? (RS_RATE * c.awake) / c.rs : 0;
  };

  function changed(clearPile = false): void {
    st.runT = 0;
    if (clearPile) {
      st.pile = [];
      st.drops = [];
    }
    ui?.wake?.set(Math.round(counts().rs ? (100 * counts().awake) / counts().rs : 0));
  }

  // ---------- 짝짓기 ----------
  function seat(bi: number, si: number): boolean {
    const s = st.sites[si];
    const b = st.beads[bi];
    if (!s || b.site >= 0) return false;
    if (!s.a) s.a = b.side;
    else if (!s.b) s.b = b.side;
    else return false;
    b.site = si;
    s.awake = false;
    return true;
  }
  const freeSite = () => {
    const half = st.sites.findIndex((s) => kind(s) === 'half');
    return half >= 0 ? half : st.sites.findIndex((s) => kind(s) === 'empty');
  };

  function pairOne(): void {
    const r = rng(500 + st.seed++);
    for (let n = 0; n < 2; n++) {
      const pool = st.beads.map((b, i) => (b.site < 0 ? i : -1)).filter((i) => i >= 0);
      const si = freeSite();
      if (!pool.length || si < 0) break;
      seat(pool[Math.floor(r() * pool.length)], si);
    }
    changed();
    check();
  }

  /** 남은 구슬을 모두 짝짓는다. 실제 분자는 수가 엄청나서 평균대로 짝이 지어지므로, 평균 개수를 쓴다 */
  function shake(): void {
    const r = rng(900 + st.seed++);
    const poolOf = (side: Side) => st.beads.map((b, i) => (b.site < 0 && b.side === side ? i : -1)).filter((i) => i >= 0);
    // 반쯤 찬 자리는 아무 구슬로 먼저 채운다
    for (const [si, s] of st.sites.entries()) {
      if (kind(s) !== 'half') continue;
      const all = [...poolOf(1), ...poolOf(-1)];
      if (!all.length) break;
      seat(all[Math.floor(r() * all.length)], si);
    }
    const R = poolOf(1);
    const S = poolOf(-1);
    const p = expectedPairs(R.length, S.length);
    const plan: [Side, Side][] = [...Array(p.rr).fill([1, 1]), ...Array(p.ss).fill([-1, -1]), ...Array(p.rs).fill([1, -1])];
    for (let i = plan.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [plan[i], plan[j]] = [plan[j], plan[i]];
    }
    const empties = st.sites.map((s, i) => (kind(s) === 'empty' ? i : -1)).filter((i) => i >= 0);
    plan.forEach(([a, b], n) => {
      const si = empties[n];
      if (si == null) return;
      seat((a > 0 ? R : S).pop()!, si);
      seat((b > 0 ? R : S).pop()!, si);
    });
    changed();
    check();
  }

  function unpair(): void {
    for (const b of st.beads) b.site = -1;
    st.sites = Array.from({ length: SITES }, () => ({ a: 0, b: 0, awake: false }));
    changed(true);
    check();
  }

  function setWake(frac: number): void {
    const want = Math.round(frac * counts().rs);
    let n = 0;
    for (const s of st.sites) {
      if (kind(s) !== 'RS') continue;
      s.awake = n < want;
      n++;
    }
    st.runT = 0;
    check();
  }

  // ---------- 판정 ----------
  function check(): void {
    const c = counts();
    const m = measured();
    const pred = shared.pred;
    const ready = st.running && st.runT > 1.5 && m != null && c.left === 0;
    if (ready && Math.abs(st.lig - 0.5) < 0.01 && c.awake === 0) {
      const got = fmtEe(m, true);
      ctx.host.complete('c2m1', tr(ctx, `생성물 ${got}${pred != null ? `, 내 예상 ${fmtEe(pred, true)}` : ''}`, `Product ${fmtEe(m, false)}${pred != null ? `, my guess ${fmtEe(pred, false)}` : ''}`));
      ctx.note(
        'nle',
        pred != null
          ? `R 쪽 50%인 촉매로 반응시키자 생성물이 ${got}가 되었다. 처음 예상은 ${fmtEe(pred, true)}였다. 섞인 짝이 소수파 S를 가둬 두었기 때문이다.`
          : `R 쪽 50%인 촉매로 반응시키자 생성물이 ${got}가 되었다. 섞인 짝이 소수파 S를 가둬 두었기 때문이다.`,
        pred != null
          ? `A catalyst at 50% R gave a product at ${fmtEe(m, false)}; I had guessed ${fmtEe(pred, false)}. The mixed pairs locked away the minority S.`
          : `A catalyst at 50% R gave a product at ${fmtEe(m, false)}. The mixed pairs locked away the minority S.`,
      );
    } else if (c.left > 0) ctx.host.result('c2m1', tr(ctx, `아직 짝을 못 지은 구슬 ${c.left}개`, `${c.left} beads still unpaired`));
    else if (!st.running) ctx.host.result('c2m1', tr(ctx, '짝을 다 지었어요. 비커를 누르거나 "반응"을 켜세요.', 'All paired. Tap the beaker or switch the reaction on.'));

    if (ready && st.lig > 0 && m < st.lig - 0.03) {
      ctx.host.complete('c2m2', tr(ctx, `리간드 ${fmtEe(st.lig, true)}인데 생성물은 ${fmtEe(m, true)}`, `Ligand ${fmtEe(st.lig, false)}, product only ${fmtEe(m, false)}`));
      ctx.note('negative', `잠든 섞인 짝을 깨워 일하게 하자 생성물(${fmtEe(m, true)})이 촉매(${fmtEe(st.lig, true)})보다 덜 순수해졌다.`, `Waking the mixed pairs made the product (${fmtEe(m, false)}) less pure than the catalyst (${fmtEe(st.lig, false)}).`);
    }
    if (ready) {
      const g = gEff();
      const key = st.points.findIndex((p) => Math.abs(p.x - st.lig) < 0.01 && Math.abs(p.g - g) < 0.05);
      if (key < 0) st.points.push({ x: st.lig, y: m, g });
      const xs = new Set(st.points.filter((p) => p.g < 0.05).map((p) => Math.round(p.x * 100)));
      if (xs.size >= 3) {
        ctx.host.complete('c2m3', tr(ctx, `섞인 짝이 놀 때 점 ${xs.size}개`, `${xs.size} points with sleeping mixed pairs`));
        ctx.note('curve', '리간드 ee를 바꿔 가며 찍은 점들이 대각선보다 위로 휜 곡선을 그렸다. 촉매의 순도가 생성물에 비례해서 전달되지 않는다.', 'Points taken at several ligand ee values bent above the diagonal: catalyst purity is not passed on in proportion.');
      } else ctx.host.result('c2m3', tr(ctx, `섞인 짝이 놀 때 찍은 점 ${xs.size}/3`, `${xs.size}/3 points with sleeping mixed pairs`));
    }
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
    const lig = slider({
      label: ko ? '리간드 구슬의 치우침' : 'Ligand bead ee',
      min: -100,
      max: 100,
      step: 10,
      value: Math.round(st.lig * 100),
      fmt: (v) => fmtEe(v / 100, ko),
      onInput: (v) => {
        st.lig = v / 100;
        rebuild();
        check();
      },
    });
    const c = counts();
    ui = {
      ro: readout(),
      run: toggle({
        label: ko ? '반응' : 'Reaction',
        on: st.running,
        onText: ko ? '진행 중' : 'Running',
        offText: ko ? '멈춤' : 'Stopped',
        onChange: (v) => {
          st.running = v;
          st.runT = 0;
          st.idle = 0;
        },
      }),
      wake: slider({
        label: ko ? '섞인 짝 깨우기' : 'Wake mixed pairs',
        min: 0,
        max: 100,
        step: 5,
        value: Math.round(c.rs ? (100 * c.awake) / c.rs : 0),
        unit: '%',
        onInput: (v) => setWake(v / 100),
      }),
    };
    ctx.host.controls.append(
      row(stepButton({ label: ko ? '한 쌍 짓기' : 'Make one pair', onClick: pairOne }).el, stepButton({ label: ko ? '흔들기 (모두 짝짓기)' : 'Shake (pair all)', onClick: shake }).el),
      ui.run!.el,
      ui.wake!.el,
      lig.el,
      stepButton({ label: ko ? '짝 모두 풀기' : 'Unpair all', onClick: unpair }).el,
      ui.ro.el,
    );
  }

  // ---------- 배치 ----------
  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 50 : 62;
    if (!narrow) {
      const poolW = W * 0.2;
      const gridW = W * 0.42;
      const pool = { x: 16, y: top, w: poolW, h: (H - top) * 0.42 };
      const grid = { x: 36 + poolW, y: top, w: gridW, h: Math.min((H - top) * 0.62, gridW * 0.62) };
      const fy = pool.y + pool.h + 30;
      const fl = { x: 16 + poolW * 0.05, y: fy, w: poolW * 0.9, h: Math.min(H - fy - 24, poolW * 1.1) };
      const colX = grid.x + gridW + 28;
      const colW = W - colX - 16;
      const gr = Math.min(colW * 0.2, (H - top) * 0.11);
      const g1: Gauge = { cx: colX + colW * 0.25, cy: top + gr + 24, r: gr };
      const g2: Gauge = { cx: colX + colW * 0.75, cy: top + gr + 24, r: gr };
      const cy0 = g1.cy + gr + 84;
      const cw = Math.min(colW - 40, H - cy0 - 34);
      const curve = { x: colX + 34, y: cy0, w: cw, h: cw };
      return { W, H, narrow, pool, grid, fl, g1, g2, curve, top };
    }
    const h1 = (H - top) * 0.34;
    const pool = { x: 10, y: top, w: W * 0.24, h: h1 };
    const grid = { x: W * 0.24 + 18, y: top, w: W - W * 0.24 - 26, h: h1 };
    const y2 = top + h1 + 36;
    const h2 = (H - top) * 0.33;
    const fl = { x: 10, y: y2, w: Math.min(W * 0.24, h2 * 0.85), h: h2 - 18 };
    const avail = W - fl.w - 30;
    const gr = Math.min(avail / 5.6, h2 * 0.32);
    const g1: Gauge = { cx: fl.x + fl.w + 18 + avail * 0.25, cy: y2 + gr + 12, r: gr };
    const g2: Gauge = { cx: fl.x + fl.w + 18 + avail * 0.75, cy: y2 + gr + 12, r: gr };
    const y3 = y2 + h2 + 22;
    const ch = H - y3 - 26;
    const curve = { x: 44, y: y3, w: Math.min(W - 70, ch * 2.2), h: ch };
    return { W, H, narrow, pool, grid, fl, g1, g2, curve, top };
  };

  const siteXY = (i: number) => {
    const L = lay();
    const rows = SITES / COLS;
    const cw = L.grid.w / COLS;
    const rh = L.grid.h / rows;
    return { x: L.grid.x + cw * (i % COLS) + cw / 2, y: L.grid.y + rh * Math.floor(i / COLS) + rh / 2, cw, rh };
  };
  const beadR = () => {
    const L = lay();
    return clamp(Math.min((L.grid.w / COLS) * 0.19, (L.grid.h / (SITES / COLS)) * 0.3), 2, 6);
  };

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
      L.narrow
        ? ko
          ? '구슬을 금속 자리로 끌거나 "흔들기"를 누르세요.'
          : 'Drag beads onto metal sites, or press "Shake".'
        : ko
          ? '리간드 구슬을 가운데 금속 자리로 끌어 둘씩 짝지으세요. 다 짓고 나면 비커를 눌러 반응을 시작합니다.'
          : 'Drag ligand beads onto the metal sites in the middle, two per site. Then tap the beaker to start the reaction.',
      16,
      26,
      L.W - 32,
      L.narrow ? 13 : 15,
    );
    const br = beadR();
    // 더미
    c.strokeStyle = alpha(pal.ink, 0.35);
    c.lineWidth = 1.5;
    c.strokeRect(L.pool.x, L.pool.y, L.pool.w, L.pool.h);
    text(c, pal, ko ? '리간드 더미' : 'Ligand pile', L.pool.x + 4, L.pool.y + L.pool.h + 16, { size: 12 });
    st.beads.forEach((b, i) => {
      if (b.site >= 0 || st.drag?.i === i) return;
      bead(c, pal, L.pool.x + b.x * L.pool.w, L.pool.y + b.y * L.pool.h, br * 1.1, b.side);
    });
    // 금속 자리
    const running = st.running;
    st.sites.forEach((s, i) => {
      const p = siteXY(i);
      const kd = kind(s);
      const sleeping = kd === 'RS' && !s.awake;
      const active = kd === 'RR' || kd === 'SS' || (kd === 'RS' && s.awake);
      if (active && running) {
        c.fillStyle = alpha(kd === 'SS' ? pal.red : kd === 'RR' ? pal.blue : pal.ink, 0.12 + 0.1 * Math.sin(st.t * 6 + i));
        c.beginPath();
        c.arc(p.x, p.y, br * 2.6, 0, TAU);
        c.fill();
      }
      c.fillStyle = sleeping ? alpha(pal.ink, 0.25) : alpha(pal.ink, 0.55);
      c.beginPath();
      c.arc(p.x, p.y, br * 0.75, 0, TAU);
      c.fill();
      const dx = br * 1.35;
      if (s.a) bead(c, pal, p.x - dx, p.y, br, s.a, sleeping ? 0.35 : 1);
      else {
        c.strokeStyle = alpha(pal.ink, 0.2);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(p.x - dx, p.y, br * 0.8, 0, TAU);
        c.stroke();
      }
      if (s.b) bead(c, pal, p.x + dx, p.y, br, s.b, sleeping ? 0.35 : 1);
      else {
        c.strokeStyle = alpha(pal.ink, 0.2);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(p.x + dx, p.y, br * 0.8, 0, TAU);
        c.stroke();
      }
      if (sleeping && p.rh > 16) text(c, pal, 'z', p.x + dx + br, p.y - br, { size: Math.max(9, br * 2), color: alpha(pal.ink, 0.6) });
    });
    const cs = counts();
    text(c, pal, ko ? `RR ${cs.rr}  SS ${cs.ss}  섞인 짝 ${cs.rs}` : `RR ${cs.rr}  SS ${cs.ss}  mixed ${cs.rs}`, L.grid.x + L.grid.w / 2, L.grid.y + L.grid.h + 18, { size: L.narrow ? 12 : 14, align: 'center', color: pal.blue });
    // 끌고 있는 구슬
    if (st.drag) bead(c, pal, st.drag.p.x, st.drag.p.y, br * 1.6, st.beads[st.drag.i].side);

    // 비커 (생성물)
    const fg = flask(c, pal, L.fl.x, L.fl.y, L.fl.w, L.fl.h, { level: Math.min(1, st.pile.length / 220) * 0.8 + (st.pile.length ? 0.05 : 0), mixR: null });
    text(c, pal, ko ? '생성물' : 'Product', L.fl.x + L.fl.w / 2, L.fl.y + L.fl.h + 16, { size: 12, align: 'center' });
    for (const d of st.pile) {
      const yy = fg.bottom - 5 - d.y * (fg.bottom - fg.top - 10) * 0.85;
      const xx = fg.left(yy) + 5 + d.x * (fg.right(yy) - fg.left(yy) - 10);
      bead(c, pal, xx, yy, Math.max(2, br * 0.8), d.side);
    }
    // 떨어지는 생성물
    const tx = L.fl.x + L.fl.w / 2;
    const ty = L.fl.y + 4;
    for (const d of st.drops) {
      const u = d.t / 0.7;
      const x = d.x0 + (tx - d.x0) * u;
      const y = d.y0 + (ty - d.y0) * u - Math.sin(u * Math.PI) * 30;
      bead(c, pal, x, y, Math.max(2, br * 0.8), d.side);
    }
    // 계기판
    const m = running ? measured() : null;
    gauge(c, pal, L.g1, { value: st.lig, label: ko ? '촉매 (리간드)' : 'Catalyst (ligand)', ko });
    gauge(c, pal, L.g2, { value: m, pred: shared.pred, label: ko ? '생성물' : 'Product', ko });
    if (shared.pred != null) text(c, pal, ko ? `점선: 1장의 내 예상 ${fmtEe(shared.pred, true)}` : `dashed: my guess ${fmtEe(shared.pred, false)}`, L.g2.cx, L.g2.cy + (m != null ? 66 : 50), { size: 11, align: 'center' });
    // 곡선
    drawCurve(c, L.curve, ko);
    // 힌트
    if (st.idle > 5) {
      if (cs.left === N) pulse(c, pal, L.pool.x + L.pool.w / 2, L.pool.y + L.pool.h / 2, Math.min(L.pool.w, L.pool.h) * 0.35, st.t);
      else if (cs.left === 0 && !running) pulse(c, pal, L.fl.x + L.fl.w / 2, L.fl.y + L.fl.h * 0.6, L.fl.w * 0.55, st.t);
      else if (running && st.runT > 4 && cs.awake === 0 && cs.rs > 0) {
        const i = st.sites.findIndex((s) => kind(s) === 'RS');
        const p = siteXY(i);
        pulse(c, pal, p.x, p.y, br * 3, st.t);
      }
    }
    ui.ro.set(
      ko
        ? `일하는 짝: RR ${cs.rr}, SS ${cs.ss}, 깨운 섞인 짝 ${cs.awake}\n잠든 섞인 짝: ${cs.rs - cs.awake}\n생성물: ${m != null ? fmtEe(m, true) : '반응 전'}${cs.rs ? '\n잠든 짝을 눌러 깨울 수 있어요' : ''}`
        : `Working: RR ${cs.rr}, SS ${cs.ss}, woken mixed ${cs.awake}\nSleeping mixed: ${cs.rs - cs.awake}\nProduct: ${m != null ? fmtEe(m, false) : 'not started'}${cs.rs ? '\nTap a sleeping pair to wake it' : ''}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  function drawCurve(c: CanvasRenderingContext2D, R: { x: number; y: number; w: number; h: number }, ko: boolean): void {
    const pal = ctx.pal();
    if (R.h < 40 || R.w < 60) return;
    const X = (e: number) => R.x + ((e + 1) / 2) * R.w;
    const Y = (e: number) => R.y + R.h - ((e + 1) / 2) * R.h;
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.2;
    c.strokeRect(R.x, R.y, R.w, R.h);
    c.strokeStyle = alpha(pal.ink, 0.4);
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(X(-1), Y(-1));
    c.lineTo(X(1), Y(1));
    c.stroke();
    c.setLineDash([]);
    const g = gEff();
    c.strokeStyle = pal.blue;
    c.lineWidth = 2.5;
    c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const e = -1 + (2 * i) / 60;
      const y = productEe(e, g);
      if (i === 0) c.moveTo(X(e), Y(y));
      else c.lineTo(X(e), Y(y));
    }
    c.stroke();
    for (const p of st.points) {
      c.fillStyle = pal.red;
      c.beginPath();
      c.arc(X(p.x), Y(p.y), 4.5, 0, TAU);
      c.fill();
    }
    text(c, pal, ko ? '촉매 ee →' : 'catalyst ee →', R.x + R.w, R.y + R.h + 15, { size: 11, align: 'right' });
    text(c, pal, ko ? '↑ 생성물 ee' : '↑ product ee', R.x, R.y - 6, { size: 11 });
    text(c, pal, ko ? '점선: 비례할 때' : 'dashed: proportional', R.x + 4, R.y + R.h - 6, { size: 11 });
  }

  // ---------- 매 프레임 ----------
  function step(dt: number): void {
    if (!st.running || dt === 0) return;
    st.runT += dt;
    const L = lay();
    const r = rng(Math.floor(st.t * 1000) + 7);
    st.sites.forEach((s, i) => {
      const kd = kind(s);
      let rate = 0;
      if (kd === 'RR' || kd === 'SS') rate = 1;
      else if (kd === 'RS' && s.awake) rate = RS_RATE;
      if (!rate || r() > rate * dt * 0.25) return;
      const side: Side = kd === 'RR' ? 1 : kd === 'SS' ? -1 : r() < 0.5 ? 1 : -1;
      const p = siteXY(i);
      st.drops.push({ side, x0: p.x, y0: p.y, t: 0 });
    });
    for (const d of st.drops) d.t += dt;
    const done = st.drops.filter((d) => d.t >= 0.7);
    st.drops = st.drops.filter((d) => d.t < 0.7);
    for (const d of done) {
      st.pile.push({ side: d.side, x: r(), y: r() });
      if (st.pile.length > 220) st.pile.shift();
    }
    void L;
    if (Math.floor(st.runT * 4) !== Math.floor((st.runT - dt) * 4)) check();
  }

  // ---------- 입력 ----------
  function hitSite(p: Pt): number {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < SITES; i++) {
      const q = siteXY(i);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < Math.max(q.cw, q.rh) * 0.6 && d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  function down(p: Pt): void {
    st.idle = 0;
    const L = lay();
    const br = beadR();
    // 더미 구슬
    if (p.x >= L.pool.x && p.x <= L.pool.x + L.pool.w && p.y >= L.pool.y && p.y <= L.pool.y + L.pool.h) {
      let best = -1;
      let bd = Infinity;
      st.beads.forEach((b, i) => {
        if (b.site >= 0) return;
        const d = Math.hypot(L.pool.x + b.x * L.pool.w - p.x, L.pool.y + b.y * L.pool.h - p.y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best >= 0 && bd < Math.max(14, br * 4)) st.drag = { i: best, p, moved: false };
      return;
    }
    // 비커
    if (p.x >= L.fl.x && p.x <= L.fl.x + L.fl.w && p.y >= L.fl.y && p.y <= L.fl.y + L.fl.h) {
      st.running = !st.running;
      st.runT = 0;
      ui.run?.set(st.running);
      return;
    }
    st.downSite = hitSite(p);
  }

  function move(p: Pt): void {
    if (st.drag) {
      st.drag.p = p;
      st.drag.moved = true;
    }
  }

  function up(p: Pt): void {
    if (st.drag) {
      const si = hitSite(p);
      const i = st.drag.i;
      st.drag = null;
      if (si >= 0 && seat(i, si)) {
        changed();
        check();
      }
      return;
    }
    const si = hitSite(p);
    if (si >= 0 && si === st.downSite) {
      const s = st.sites[si];
      if (kind(s) === 'RS') {
        s.awake = !s.awake;
        st.runT = 0;
        changed();
        check();
      }
    }
    st.downSite = -1;
  }

  return {
    id: '2',
    ko: '짝을 짓는 촉매',
    en: 'Catalysts that pair up',
    missions: [
      {
        id: 'c2m1',
        ko: '리간드 R 쪽 50%로 짝을 모두 짓고 반응을 돌려, 생성물 계기판을 1장의 내 예상과 비교하라.',
        en: 'At 50% R ligand, pair every bead, run the reaction, and compare the product gauge with your guess from chapter 1.',
        hint_ko: '"흔들기"로 남은 구슬을 한꺼번에 짝지은 뒤 비커를 누르세요. 섞인 짝은 잠든 채로 두세요.',
        hint_en: 'Press "Shake" to pair the rest, then tap the beaker. Leave the mixed pairs asleep.',
      },
      {
        id: 'c2m2',
        ko: '잠든 섞인 짝을 깨워서, 생성물이 촉매보다 덜 순수해지게 만들어라.',
        en: 'Wake the sleeping mixed pairs until the product is less pure than the catalyst.',
        hint_ko: '깨운 섞인 짝은 R과 S를 반반 만들고, 같은 짝보다 두 배 빨리 일합니다. 절반 넘게 깨워 보세요.',
        hint_en: 'A woken mixed pair makes R and S half and half, twice as fast as a matched pair. Wake more than half.',
      },
      {
        id: 'c2m3',
        ko: '섞인 짝을 재운 채로 리간드 치우침을 바꿔 가며 곡선 위에 점을 3개 이상 찍어라.',
        en: 'With the mixed pairs asleep, change the ligand ee and put at least 3 points on the curve.',
        hint_ko: '리간드 손잡이를 바꾸면 구슬이 새로 쏟아집니다. 다시 흔들고 반응을 돌리면 점이 찍힙니다.',
        hint_en: 'Changing the ligand knob pours fresh beads. Shake again and run the reaction to add a point.',
      },
    ],
    content: {
      ko: {
        observe: `<p>키랄 촉매는 금속 하나에 키랄 분자(리간드)가 붙어 만들어집니다. 그런데 리간드 자체가 R과 S로 섞여 있다면 어떨까요?</p><p>1986년 앙리 카강은 금속 하나가 리간드를 <b>둘씩</b> 붙잡는 경우를 생각했습니다. 그러면 짝이 세 종류 생깁니다. R끼리, S끼리, 그리고 섞인 짝입니다.</p><p class="q">섞인 짝이 일을 하지 않는다면, 생성물은 촉매보다 더 순수해질까, 덜 순수해질까?</p>`,
        interact: '구슬로 짝을 짓고 비커를 눌러 반응을 돌려 보세요. 잠든 섞인 짝은 눌러서 깨울 수 있습니다.',
        understand: `<h4>섞인 짝은 감옥</h4><p>리간드가 R 75%, S 25%면 소수파 S는 대부분 다수파 R과 만나 섞인 짝이 됩니다. S끼리 만나는 일은 드뭅니다. 섞인 짝이 놀고 있으면 S가 그 안에 갇혀 일을 못 하니, 생성물은 R 쪽으로 더 치우칩니다.</p><p>무작위로 짝지으면 RR, SS, 섞인 짝의 비율은 이렇습니다 ($x$는 R 리간드의 비율).</p>$$RR = x^2, \\quad SS = (1-x)^2, \\quad RS = 2x(1-x)$$<p>$x = 0.75$면 RR 0.5625, SS 0.0625이므로 생성물은 R과 S가 9 대 1, 곧 ee 80%입니다.</p><h4>비선형 효과</h4><p>섞인 짝이 RR보다 $g$배 빠르게 R과 S를 반반 만든다면 생성물의 ee는</p>$$ee_{\\text{생성물}} = \\frac{x^2 - (1-x)^2}{x^2 + (1-x)^2 + g\\,2x(1-x)}$$<p>$g = 1$이면 대각선 직선, $g < 1$이면 위로 휜 곡선(양의 비선형 효과), $g > 1$이면 아래로 휜 곡선(음의 비선형 효과)입니다. 카강은 1986년 샤프리스 에폭시화를 포함한 세 반응에서 이 휘어짐을 보고했습니다.</p><h4>실제와 다른 점</h4><p>실제 분자는 수가 엄청나서 짝이 평균대로 지어집니다. 그래서 "흔들기"는 무작위 대신 평균 개수로 짝을 짓습니다. 실제 촉매는 리간드가 둘보다 많이 붙거나 더 복잡한 덩어리를 이루기도 하고, 짝 사이의 평형도 반응마다 다릅니다.</p>`,
      },
      en: {
        observe: `<p>A chiral catalyst is a metal with chiral molecules (ligands) attached. What if the ligands themselves are a mix of R and S?</p><p>In 1986 Henri Kagan considered metals that grab ligands <b>two at a time</b>. That makes three kinds of pair: R with R, S with S, and mixed.</p><p class="q">If the mixed pairs do no work, will the product be purer or less pure than the catalyst?</p>`,
        interact: 'Pair the beads and tap the beaker to run the reaction. Tap a sleeping mixed pair to wake it.',
        understand: `<h4>Mixed pairs are a prison</h4><p>With 75% R and 25% S ligands, the minority S mostly ends up paired with R. S meeting S is rare. If mixed pairs sit idle, the S inside them cannot work, and the product leans further toward R.</p><p>With random pairing ($x$ is the share of R ligand):</p>$$RR = x^2, \\quad SS = (1-x)^2, \\quad RS = 2x(1-x)$$<p>At $x = 0.75$, RR is 0.5625 and SS 0.0625, so the product is 9 R to 1 S: an ee of 80%.</p><h4>Non-linear effects</h4><p>If a mixed pair makes R and S half and half, $g$ times as fast as RR, the product ee is</p>$$ee_{\\text{product}} = \\frac{x^2 - (1-x)^2}{x^2 + (1-x)^2 + g\\,2x(1-x)}$$<p>$g = 1$ gives the straight diagonal, $g < 1$ bends above it (positive non-linear effect), $g > 1$ bends below (negative). In 1986 Kagan reported this bending in three reactions, including the Sharpless epoxidation.</p><h4>How this differs from reality</h4><p>Real molecules are so numerous that pairing follows the average, so "Shake" uses the average counts instead of chance. Real catalysts can hold more than two ligands or form larger clusters, and the balance between pairs differs from reaction to reaction.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      if (!st.beads.length) rebuild();
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
      st.lig = 0.5;
      st.running = false;
      st.points = [];
      rebuild();
      panel();
      check();
    },
    leave() {
      st.running = false;
    },
    down,
    move,
    up,
  };
}
