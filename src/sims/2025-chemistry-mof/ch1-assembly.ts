// 1장: 나무 공의 구멍 (롭슨, 1974~1990).
// 결합 방향이 정해진 마디를 용액에 섞으면, 붙었다 떨어지기를 되풀이하며 규칙적인 그물이 저절로 자란다.
// 결합이 너무 강하면 잘못 붙은 것이 굳어 엉킨 덩어리가 된다. X선으로 확인하고, 이온을 바꾸고, 비워 본다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { caption, pulse, type Box } from './draw';
import { NODES, detachRate, rng, type Node } from './model';

type Guess = 'tangle' | 'crystal';

interface Site {
  i: number;
  j: number;
  x: number; // 격자 좌표 (간격 1)
  y: number;
}

interface Bound {
  site: Site | null; // null 이면 잘못 붙음
  x: number;
  y: number;
  seed?: boolean;
}

const N_FREE = 90;
const CAPTURE = 0.35;

export function chapter1(): Chapter {
  let ctx: Ctx;
  let rand = rng(5);
  const st = {
    node: 'tet' as Node,
    strength: 0.5,
    guess: null as Guess | null,
    running: false,
    time: 0,
    free: [] as { x: number; y: number }[],
    bound: [] as Bound[],
    sites: [] as Site[],
    occ: new Map<string, Bound>(),
    xray: null as null | { order: number; node: Node },
    ions: 0, // 0 = 처음 이온, 1 = 다 바뀜
    swapping: false,
    collapse: 0,
    collapsing: false,
    runs: [] as { node: Node; strength: number; order: number; size: number }[],
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout> };

  const key = (i: number, j: number) => `${i},${j}`;
  const R = 6; // 격자 반지름

  /** 마디 모양에 맞는 격자 자리. 정사면체는 위에서 본 다이아몬드형 그물(45° 돌린 바둑판) */
  function buildSites(n: Node): Site[] {
    const out: Site[] = [];
    for (let i = -R; i <= R; i++)
      for (let j = -R; j <= R; j++) {
        let x: number;
        let y: number;
        if (n === 'sq') {
          x = i;
          y = j;
        } else if (n === 'tet') {
          if ((i + j) % 2 !== 0) continue;
          x = i * Math.SQRT1_2;
          y = j * Math.SQRT1_2;
        } else {
          // 벌집: 두 종류 자리 A, B (결합 길이 1)
          const ax = i * Math.sqrt(3) + j * (Math.sqrt(3) / 2);
          const ay = j * 1.5;
          for (const [sub, dy] of [[0, 0], [1, 1]] as const) {
            const bx = ax;
            const by = ay + dy - 0.5;
            if (Math.hypot(bx, by) <= R * 0.72) out.push({ i, j: j * 2 + sub + 1000, x: bx, y: by });
          }
          continue;
        }
        if (Math.hypot(x, y) <= R * 0.72) out.push({ i, j, x, y });
      }
    return out;
  }

  function neighbors(s: Site): Site[] {
    return st.sites.filter((o) => o !== s && Math.abs(Math.hypot(o.x - s.x, o.y - s.y) - spacing()) < 0.08);
  }
  const spacing = () => 1;

  function bondsOf(b: Bound): number {
    if (!b.site) return 0.5;
    return neighbors(b.site).filter((n) => st.occ.has(key(n.i, n.j))).length;
  }

  function newMix(): void {
    rand = rng(Math.floor(Math.random() * 1e6));
    st.sites = buildSites(st.node);
    st.occ.clear();
    st.bound = [];
    const c = st.sites.reduce((a, b) => (Math.hypot(b.x, b.y) < Math.hypot(a.x, a.y) ? b : a));
    const seed: Bound = { site: c, x: c.x, y: c.y, seed: true };
    st.bound.push(seed);
    st.occ.set(key(c.i, c.j), seed);
    st.free = Array.from({ length: N_FREE }, () => {
      const a = rand() * TAU;
      const r = R * (0.35 + rand() * 0.6);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
    st.time = 0;
    st.xray = null;
    st.ions = 0;
    st.collapse = 0;
    st.collapsing = false;
    st.swapping = false;
    st.running = true;
  }

  const order = () => {
    const good = st.bound.filter((b) => b.site).length;
    return st.bound.length ? good / st.bound.length : 0;
  };
  const size = () => st.bound.length;

  function stepSim(dt: number): void {
    const h = Math.min(dt, 0.05) * 3;
    // 자유 마디는 용액 속을 떠돈다
    for (const p of st.free) {
      p.x += (rand() - 0.5) * 0.9 * h * 6;
      p.y += (rand() - 0.5) * 0.9 * h * 6;
      const r = Math.hypot(p.x, p.y);
      if (r > R * 0.95) {
        p.x *= (R * 0.95) / r;
        p.y *= (R * 0.95) / r;
      }
    }
    // 붙기
    const front = st.sites.filter((s) => !st.occ.has(key(s.i, s.j)) && neighbors(s).some((n) => st.occ.has(key(n.i, n.j))));
    for (let q = st.free.length - 1; q >= 0; q--) {
      const p = st.free[q];
      const f = front.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < CAPTURE);
      if (f && !st.occ.has(key(f.i, f.j))) {
        const b: Bound = { site: f, x: f.x, y: f.y };
        st.bound.push(b);
        st.occ.set(key(f.i, f.j), b);
        st.free.splice(q, 1);
        continue;
      }
      // 덩어리에 닿았지만 맞는 자리가 아니면 잘못 붙을 수 있다
      const near = st.bound.find((b) => Math.hypot(b.x - p.x, b.y - p.y) < 0.75);
      // 결합이 강할수록 처음 닿은 자리에 바로 들러붙는다
      if (near && rand() < 0.12 * h * (1 + 8 * Math.max(0, st.strength - 0.6))) {
        st.bound.push({ site: null, x: p.x, y: p.y });
        st.free.splice(q, 1);
      }
    }
    // 떨어지기
    for (let q = st.bound.length - 1; q >= 0; q--) {
      const b = st.bound[q];
      if (b.seed) continue;
      if (rand() < detachRate(st.strength, bondsOf(b)) * h) {
        st.bound.splice(q, 1);
        if (b.site) st.occ.delete(key(b.site.i, b.site.j));
        const a = rand() * TAU;
        st.free.push({ x: b.x + Math.cos(a) * 0.6, y: b.y + Math.sin(a) * 0.6 });
      }
    }
    st.time += h;
    if (st.time > 24 || st.free.length === 0) finishRun();
  }

  function finishRun(): void {
    if (!st.running) return;
    st.running = false;
    st.runs.push({ node: st.node, strength: st.strength, order: order(), size: size() });
    check();
  }

  function xray(): void {
    if (size() < 8) {
      ctx.host.toast(tr(ctx, '먼저 "용액에 섞기"로 결정을 키우세요.', 'First grow a crystal with "Mix in solution".'));
      return;
    }
    if (st.running) finishRun();
    st.xray = { order: order(), node: st.node };
    st.idle = 0;
    check();
  }

  function check(): void {
    const ko = k(ctx);
    const gName = (g: Guess) => (g === 'tangle' ? (ko ? '엉킨 덩어리' : 'a tangle') : ko ? '규칙적인 결정' : 'an ordered crystal');
    const x = st.xray;
    if (st.guess == null) ctx.host.result('c1m1', tr(ctx, '먼저 예상을 고르세요', 'First pick a guess'));
    else if (x && x.node === 'tet' && x.order >= 0.85) {
      const o = Math.round(x.order * 100);
      ctx.host.complete('c1m1', tr(ctx, `제자리에 붙은 마디 ${o}%, X선 무늬는 또렷한 점 (내 예상: ${gName(st.guess)})`, `${o}% of nodes in place, sharp X-ray spots (my guess: ${gName(st.guess)})`));
      ctx.note('crystal', `네 방향으로 결합하는 구리(I) 마디를 팔 네 개 분자와 섞자, 붙었다 떨어지기를 되풀이하며 마디의 ${o}%가 제자리에 놓인 다이아몬드형 그물이 저절로 자랐고 X선 무늬도 또렷한 점으로 나왔다 (예상: ${gName(st.guess)}).`, `Mixing four-way copper(I) nodes with four-armed molecules, attaching and detaching over and over, a diamond-like net grew by itself with ${o}% of nodes in place, and the X-ray pattern showed sharp spots (I guessed ${gName(st.guess)}).`);
    } else ctx.host.result('c1m1', tr(ctx, '정사면체 마디로 섞은 뒤 X선으로 확인하세요 (제자리 85% 넘게)', 'Mix with tetrahedral nodes, then check by X-ray (over 85% in place)'));

    const messy = st.runs.find((r) => r.strength >= 0.85 && r.order < 0.75);
    const good = st.runs.find((r) => r.strength < 0.75 && r.order >= 0.85);
    if (messy && good) {
      ctx.host.complete('c1m2', tr(ctx, `결합 세기 ${Math.round(good.strength * 100)}%: 제자리 ${Math.round(good.order * 100)}%, ${Math.round(messy.strength * 100)}%: ${Math.round(messy.order * 100)}%`, `Bond strength ${Math.round(good.strength * 100)}%: ${Math.round(good.order * 100)}% in place; ${Math.round(messy.strength * 100)}%: ${Math.round(messy.order * 100)}%`));
      ctx.note('reversible', `결합을 너무 강하게 하자(세기 ${Math.round(messy.strength * 100)}%) 잘못 붙은 마디가 떨어지지 못해 제자리 비율이 ${Math.round(messy.order * 100)}%에 그쳤다. 적당한 세기(${Math.round(good.strength * 100)}%)에서는 ${Math.round(good.order * 100)}%였다. 결합이 붙었다 떨어질 수 있어야 실수가 고쳐져 결정이 된다.`, `With bonds too strong (${Math.round(messy.strength * 100)}%), misplaced nodes could not leave and only ${Math.round(messy.order * 100)}% sat in place, versus ${Math.round(good.order * 100)}% at a moderate ${Math.round(good.strength * 100)}%. Bonds must be able to come apart for mistakes to be fixed.`);
    } else ctx.host.result('c1m2', tr(ctx, '결합 세기를 적당히 한 번, 아주 강하게 한 번 섞어 보세요', 'Mix once with moderate bonds and once with very strong bonds'));

    if (st.ions >= 1 && st.collapse >= 1) {
      ctx.host.complete('c1m3', tr(ctx, '이온 교환 완료, 용매를 빼자 틀이 무너짐', 'Ions exchanged; the frame collapsed when emptied'));
      ctx.note('collapse', '빈 공간의 음이온을 바깥 용액의 이온과 바꿀 수 있어 물질이 드나든다는 것을 확인했다. 그러나 용매와 이온을 빼자 틀이 무너졌다. 양전하를 띤 틀을 안에서 받치던 것이 사라졌기 때문이다.', 'The anions in the cavities could be swapped for ions from outside, so things can move in and out. But removing solvent and ions made the frame collapse: what had propped up the positively charged frame from inside was gone.');
    } else ctx.host.result('c1m3', tr(ctx, '결정을 만든 뒤 "이온 바꾸기"와 "용매 빼기"를 차례로 누르세요', 'After growing a crystal, press "Swap ions" then "Remove solvent"'));
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const row = (...els: HTMLElement[]) => {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
      d.append(...els);
      return d;
    };
    ui = { ro: readout() };
    const g = segment<Guess>({
      label: ko ? '내 예상: 마디와 막대를 용액에 섞으면?' : 'My guess: mix nodes and struts in solution and you get…',
      options: [
        { v: 'tangle', label: ko ? '엉킨 덩어리' : 'a tangle' },
        { v: 'crystal', label: ko ? '규칙적인 결정' : 'an ordered crystal' },
      ],
      value: st.guess ?? ('' as Guess),
      onChange: (v) => {
        st.guess = v;
        check();
      },
    });
    const node = segment<Node>({
      label: ko ? '마디 (결합 방향)' : 'Node (bond directions)',
      options: [
        { v: 'tet', label: ko ? '구리(I), 정사면체 4방향' : 'Cu(I), tetrahedral ×4' },
        { v: 'sq', label: ko ? '평면 사각형 4방향' : 'square planar ×4' },
        { v: 'tri', label: ko ? '삼각 3방향' : 'trigonal ×3' },
      ],
      value: st.node,
      onChange: (v) => {
        st.node = v;
        st.sites = buildSites(v);
        st.bound = [];
        st.occ.clear();
        st.running = false;
        st.xray = null;
      },
    });
    const s = slider({
      label: ko ? '결합 세기 (붙은 마디가 다시 떨어지기 어려운 정도)' : 'Bond strength (how hard it is to come apart)',
      min: 0,
      max: 1,
      step: 0.05,
      value: st.strength,
      fmt: (v) => `${Math.round(v * 100)}%`,
      onInput: (v) => (st.strength = v),
    });
    ctx.host.controls.append(
      g.el,
      node.el,
      s.el,
      row(stepButton({ label: ko ? '용액에 섞기' : 'Mix in solution', onClick: newMix }).el, stepButton({ label: ko ? 'X선으로 확인' : 'Check by X-ray', onClick: xray }).el),
      row(
        stepButton({ label: ko ? '이온 바꾸기' : 'Swap ions', onClick: () => (size() < 20 || order() < 0.8 ? ctx.host.toast(tr(ctx, '먼저 규칙적인 결정을 만드세요.', 'Grow an ordered crystal first.')) : ((st.swapping = true), finishRun())) }).el,
        stepButton({ label: ko ? '용매 빼기' : 'Remove solvent', onClick: () => (size() < 20 ? ctx.host.toast(tr(ctx, '먼저 결정을 만드세요.', 'Grow a crystal first.')) : ((st.collapsing = true), finishRun())) }).el,
      ),
      ui.ro.el,
    );
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 58;
    const side = Math.min(W * 0.62, H - top - 70);
    const sim: Box = narrow ? { x: 8, y: top + 8, w: side, h: side } : { x: 20, y: top + 10, w: Math.min(W * 0.62, H - top - 40), h: Math.min(W * 0.62, H - top - 40) };
    const xw = W - sim.x - sim.w - 24;
    const xr: Box = narrow ? { x: sim.x + sim.w + 14, y: top + 40, w: xw, h: xw } : { x: sim.x + sim.w + 60, y: top + 40, w: Math.min(220, W - sim.x - sim.w - 90), h: Math.min(220, W - sim.x - sim.w - 90) };
    return { W, H, narrow, sim, xr };
  };

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(c, pal, ko ? '용액 속 마디(빨간 점)는 떠돌다가 자라는 결정의 맞는 자리에 붙고, 잘못 붙은 것은 다시 떨어집니다. 결합 세기를 바꿔 가며 섞어 보세요.' : 'Nodes (red dots) drift in solution, join the growing crystal at the right spots, and fall off again if misplaced. Try different bond strengths.', 16, 24, L.W - 32, L.narrow ? 13 : 15);
    const B = L.sim;
    const sc = B.w / (2 * R);
    const cx = B.x + B.w / 2;
    const cy = B.y + B.h / 2;
    const col = st.collapse;
    const X = (x: number, y: number) => cx + x * sc * (1 - 0.35 * col) + Math.sin(x * 7 + y * 3) * col * sc * 0.25;
    const Y = (x: number, y: number) => cy + y * sc * (1 - 0.45 * col) + col * sc * 1.2 + Math.cos(x * 5) * col * sc * 0.2;
    // 용액
    c.strokeStyle = alpha(pal.ink, 0.35);
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, R * 0.95 * sc, 0, TAU);
    c.stroke();
    // 막대 (맞게 붙은 이웃 사이)
    c.strokeStyle = pal.blue;
    c.lineWidth = 2.5;
    for (const b of st.bound) {
      if (!b.site) continue;
      for (const n of neighbors(b.site)) {
        if (!st.occ.has(key(n.i, n.j)) || n.i * 1000 + n.j < b.site.i * 1000 + b.site.j) continue;
        c.beginPath();
        c.moveTo(X(b.x, b.y), Y(b.x, b.y));
        c.lineTo(X(n.x, n.y), Y(n.x, n.y));
        c.stroke();
      }
    }
    // 빈 공간의 이온 (결정 칸 가운데)
    if (order() > 0.8 && size() > 20 && col < 0.5) {
      for (const b of st.bound) {
        if (!b.site) continue;
        const ix = b.x + spacing() * 0.5;
        const iy = b.y + (st.node === 'sq' ? spacing() * 0.5 : 0);
        if (Math.hypot(ix, iy) > R * 0.5) continue;
        const swapped = (Math.sin(b.site.i * 12.9 + b.site.j * 78.2) * 0.5 + 0.5) < st.ions;
        c.lineWidth = 1.5;
        c.strokeStyle = pal.ink;
        c.fillStyle = pal.red;
        c.beginPath();
        c.arc(X(ix, iy), Y(ix, iy), sc * 0.13, 0, TAU);
        if (swapped) c.fill();
        else c.stroke();
      }
    }
    // 마디
    for (const b of st.bound) {
      const x = X(b.x, b.y);
      const y = Y(b.x, b.y);
      c.fillStyle = b.site ? pal.red : alpha(pal.red, 0.45);
      c.beginPath();
      c.arc(x, y, sc * (b.seed ? 0.17 : 0.13), 0, TAU);
      c.fill();
      if (!b.site) {
        c.strokeStyle = pal.ink;
        c.lineWidth = 1;
        c.stroke();
      }
    }
    for (const p of st.free) {
      c.fillStyle = alpha(pal.red, 0.55);
      c.beginPath();
      c.arc(cx + p.x * sc, cy + p.y * sc, sc * 0.1, 0, TAU);
      c.fill();
    }
    text(c, pal, ko ? '진한 점: 제자리, 흐린 점: 잘못 붙음, 파란 선: 연결 분자' : 'solid: in place, faded: misplaced, blue: linkers', B.x, B.y + B.h + 18, { size: 12 });
    if (st.node === 'tet') text(c, pal, ko ? '정사면체 그물을 위에서 내려다본 모습' : 'tetrahedral net seen from above', B.x, B.y + B.h + 34, { size: 12, color: pal.blue });
    // X선 무늬
    const XR = L.xr;
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.5;
    c.strokeRect(XR.x, XR.y, XR.w, XR.h);
    text(c, pal, ko ? 'X선 회절 무늬' : 'X-ray diffraction', XR.x, XR.y - 10, { size: 13, title: true });
    if (st.xray) {
      const ox = XR.x + XR.w / 2;
      const oy = XR.y + XR.h / 2;
      const o = st.xray.order;
      const sharp = clamp((o - 0.5) / 0.4, 0, 1);
      // 흐트러진 고리
      c.strokeStyle = alpha(pal.red, 0.5 * (1 - sharp) + 0.05);
      c.lineWidth = 10;
      c.beginPath();
      c.arc(ox, oy, XR.w * 0.28, 0, TAU);
      c.stroke();
      // 또렷한 점: 그물 대칭을 따른다
      const n = st.xray.node === 'tri' ? 6 : 4;
      const rot = st.xray.node === 'tet' ? Math.PI / 4 : 0;
      c.fillStyle = alpha(pal.red, sharp);
      for (const rr of [0.28, 0.4]) for (let a = 0; a < n; a++) {
        const th = rot + (a / n) * TAU + (rr > 0.3 ? Math.PI / n : 0);
        c.beginPath();
        c.arc(ox + Math.cos(th) * XR.w * rr, oy + Math.sin(th) * XR.w * rr, 4 + 3 * sharp, 0, TAU);
        c.fill();
      }
      c.beginPath();
      c.arc(ox, oy, 5, 0, TAU);
      c.fill();
      text(c, pal, sharp > 0.7 ? (ko ? '또렷한 점: 규칙적인 결정' : 'sharp spots: ordered crystal') : ko ? '흐린 고리: 엉킨 덩어리' : 'blurred ring: disordered', XR.x, XR.y + XR.h + 18, { size: 12, color: pal.blue });
    } else text(c, pal, ko ? '아직 찍지 않음' : 'not taken yet', XR.x + XR.w / 2, XR.y + XR.h / 2, { size: 12, align: 'center' });
    if (st.idle > 6 && !st.running && size() < 2) pulse(c, pal, cx, cy, B.w * 0.2, st.t);
    const o = Math.round(order() * 100);
    ui.ro.set(
      ko
        ? `${st.running ? '섞는 중' : '멈춤'}: 결정에 붙은 마디 ${size()}개, 제자리 ${o}%\n결합 세기 ${Math.round(st.strength * 100)}%${st.collapse >= 1 ? '\n틀이 무너졌어요' : ''}`
        : `${st.running ? 'Mixing' : 'Stopped'}: ${size()} nodes in the crystal, ${o}% in place\nBond strength ${Math.round(st.strength * 100)}%${st.collapse >= 1 ? '\nThe frame has collapsed' : ''}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '1',
    ko: '나무 공의 구멍',
    en: 'Holes in a wooden ball',
    missions: [
      {
        id: 'c1m1',
        ko: '섞으면 무엇이 될지 예상한 뒤, 롭슨처럼 정사면체 마디로 결정을 키우고 X선으로 확인하라.',
        en: 'Guess what mixing gives, then grow a crystal with tetrahedral nodes like Robson and check it by X-ray.',
        hint_ko: '마디는 "구리(I), 정사면체"로 두고 결합 세기 50% 근처에서 "용액에 섞기", 멈추면 "X선으로 확인"을 누르세요.',
        hint_en: 'Keep the Cu(I) tetrahedral node, set bond strength near 50%, press "Mix in solution", then "Check by X-ray".',
      },
      {
        id: 'c1m2',
        ko: '결합을 적당히 했을 때와 아주 강하게 했을 때를 비교해, 왜 결합이 떨어질 수 있어야 하는지 보라.',
        en: 'Compare moderate and very strong bonds and see why bonds must be able to come apart.',
        hint_ko: '결합 세기를 90% 넘게 올려 한 번 더 섞어 보세요.',
        hint_en: 'Raise bond strength above 90% and mix again.',
      },
      {
        id: 'c1m3',
        ko: '빈 공간의 이온을 바깥 이온과 바꾼 뒤, 용매를 빼면 틀이 어떻게 되는지 보라.',
        en: 'Swap the ions in the cavities, then remove the solvent and watch the frame.',
        hint_ko: '규칙적인 결정을 만든 다음 "이온 바꾸기", "용매 빼기"를 차례로 누르세요.',
        hint_en: 'With an ordered crystal, press "Swap ions" then "Remove solvent".',
      },
    ],
    content: {
      ko: {
        observe: `<p>1974년, 멜버른 대학교의 리처드 롭슨은 학생 수업에 쓸 나무 공 분자 모형을 만들다가 공에 뚫린 구멍의 위치가 곧 결합 방향이라는 것을 깨달았습니다. 구멍 방향이 정해진 공과 막대만 있으면 만들어질 구조도 정해집니다.</p><p>원자 세계에서 그 역할을 하는 것이 <b>배위 결합</b>입니다. 금속 이온은 전자쌍을 받아들일 빈자리가 있고, 좋아하는 결합 개수와 각도가 있습니다. 구리(I)는 보통 네 방향, 정사면체 각도로 결합합니다. 롭슨은 이 구리(I)와, 몸통에서 팔 네 개가 정사면체 방향으로 뻗고 팔 끝이 니트릴인 분자를 섞었습니다.</p><p class="q">마디와 막대를 용액에 섞으면, 엉킨 덩어리가 될까, 규칙적인 결정이 될까?</p>`,
        interact: '먼저 예상을 고르고 "용액에 섞기"를 누르세요. 결정이 자라는 동안 결합 세기를 바꿔 보고, 멈추면 X선으로 확인하세요.',
        understand: `<h4>왜 엉키지 않고 결정이 될까</h4><p>배위 결합은 결정이 자라는 동안 붙었다 떨어지기를 되풀이할 수 있을 만큼 약합니다. 잘못된 자리에 붙은 마디는 이웃 결합이 적어 금방 떨어지고, 맞는 자리에 붙은 마디는 이웃과 여러 결합으로 묶여 남습니다. 붙어 있는 시간은 대략 다음처럼 결합 수 $n$에 따라 길어집니다.</p>$$\\text{떨어지는 빠르기} \\propto e^{-n\\,\\varepsilon / k_B T}$$<p>결합이 너무 강하면($\\varepsilon$가 크면) 잘못 붙은 것도 떨어지지 못해 엉킨 덩어리가 됩니다. 실수를 고칠 수 있어야 결정이 됩니다.</p><h4>X선으로 확인하기</h4><p>원자가 규칙적으로 늘어서 있으면 X선이 특정 방향으로만 세게 꺾여 또렷한 점 무늬가 생기고, 그 점의 배열로 그물 모양을 알아냅니다. 흐트러진 덩어리는 흐린 고리만 남깁니다.</p><h4>1990년의 이온 교환과 한계</h4><p>롭슨의 틀은 구리(I) 이온 때문에 양전하를 띠어서, 빈 공간에 음이온이 들어 있어야 합니다. 이 음이온을 바깥 용액의 다른 이온과 바꿀 수 있었으니 물질이 드나든다는 증거였지요. 그러나 용매와 이온을 빼면 안에서 받치던 것이 사라져 틀이 무너졌습니다. 결합도 약하고 각도도 잘 휘었기 때문입니다.</p><h4>실제와 다른 점</h4><p>화면은 3차원 다이아몬드형 그물을 위에서 내려다본 2차원 모습으로 단순화했고, 결합 세기와 떠도는 움직임은 원리를 보여 주기 위한 모형입니다.</p>`,
      },
      en: {
        observe: `<p>In 1974 Richard Robson at the University of Melbourne was making wooden ball models for a class when he realised that the positions of the drilled holes are the bonding directions. Fix the hole directions and the struts, and the structure you can build is fixed too.</p><p>In the atomic world this job is done by the <b>coordination bond</b>. A metal ion has empty places to accept electron pairs and a preferred number and angle of bonds. Copper(I) usually bonds in four tetrahedral directions. Robson mixed copper(I) with a molecule whose four arms point tetrahedrally and end in nitrile groups.</p><p class="q">Mix nodes and struts in solution: do you get a tangle, or an ordered crystal?</p>`,
        interact: 'Pick a guess and press "Mix in solution". Change the bond strength while the crystal grows, then check it by X-ray.',
        understand: `<h4>Why a crystal and not a tangle</h4><p>Coordination bonds are weak enough to form and break repeatedly while the crystal grows. A node stuck in the wrong spot has few neighbours and soon falls off; one in the right spot is held by several bonds and stays. Roughly, the time it stays grows with the number of bonds $n$:</p>$$\\text{detach rate} \\propto e^{-n\\,\\varepsilon / k_B T}$$<p>If bonds are too strong (large $\\varepsilon$), misplaced nodes cannot leave and you get a tangle. A crystal needs mistakes to be fixable.</p><h4>Checking by X-rays</h4><p>When atoms are lined up regularly, X-rays are bent strongly only in certain directions, giving sharp spots whose arrangement reveals the net. A disordered lump leaves only a blurred ring.</p><h4>Ion exchange in 1990, and the limit</h4><p>Robson's frame is positively charged because of the copper(I), so its cavities must hold anions. Swapping these for other ions from outside showed that substances move in and out. But removing solvent and ions took away the inner support and the frame collapsed: the bonds were weak and their angles bent easily.</p><h4>How this differs from reality</h4><p>The screen shows the 3D diamond-like net from above in 2D; bond strength and drifting are a model to show the principle.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      if (!st.sites.length) st.sites = buildSites(st.node);
      panel();
      check();
    },
    panel,
    frame(dt) {
      st.t += dt;
      st.idle += dt;
      if (dt > 0 && st.running) stepSim(dt);
      if (st.swapping) {
        st.ions = Math.min(1, st.ions + dt * 0.5);
        if (st.ions >= 1) {
          st.swapping = false;
          check();
        }
      }
      if (st.collapsing) {
        st.collapse = Math.min(1, st.collapse + dt * 0.6);
        if (st.collapse >= 1) {
          st.collapsing = false;
          check();
        }
      }
      if (ctx.host.reduced && st.running) for (let i = 0; i < 600 && st.running; i++) stepSim(0.05);
      draw();
    },
    reset() {
      st.guess = null;
      st.running = false;
      st.bound = [];
      st.occ.clear();
      st.free = [];
      st.xray = null;
      st.ions = 0;
      st.collapse = 0;
      st.runs = [];
      st.strength = 0.5;
      st.node = 'tet';
      st.sites = buildSites('tet');
      panel();
      check();
    },
  };
}
