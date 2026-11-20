// 1장: 벽을 지나가는 파동.
// 전자 하나가 사각형 에너지 벽을 만난다. 두께, 높이, 입자 무게를 바꾸며 건너편에 닿을 확률을 본다.
import { TAU, alpha, clamp, pow10, text } from '../canvas';
import { readout, segment, slider } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { caption, dial, dialHit, pulse, type Dial } from './draw';
import { ME, MP, kappa, transmission } from './model';

type Who = 'e' | 'p';

/** 확률을 읽기 쉽게: 0.17 → 17%, 0.0085 → 0.85%, 2.5e-57 → 10⁻⁵⁷ 정도 */
export function fmtP(p: number): string {
  if (p >= 0.1) return `${Math.round(p * 100)}%`;
  if (p >= 0.001) return `${(p * 100).toPrecision(2)}%`;
  return `${pow10(Math.floor(Math.log10(p)))}`;
}
const fmtRatio = (r: number) => (r >= 0.095 ? `${Math.round(r * 10) / 10}` : r >= 0.001 ? `1/${Number((1 / r).toPrecision(r > 0.01 ? 2 : 1))}` : pow10(Math.floor(Math.log10(r))));

export function chapter1(): Chapter {
  let ctx: Ctx;
  const st = {
    d: 0.3,
    over: 1,
    who: 'e' as Who,
    pred: null as number | null,
    predD: 0.3,
    predP: 0,
    doubled: null as null | { ratio: number; d: number },
    heights: new Set<number>(),
    proton: false,
    drag: false,
    phase: 0,
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; d?: ReturnType<typeof slider> };

  const mass = () => (st.who === 'e' ? ME : MP);
  const P = () => transmission(st.d, st.over, mass());

  function check(): void {
    const ko = k(ctx);
    if (st.pred == null) ctx.host.result('c1m1', tr(ctx, '먼저 계기판에 예상을 놓으세요', 'First set a guess on the dial'));
    else if (st.who === 'e' && Math.abs(st.d - 2 * st.predD) < 0.026 && Math.abs(st.over - 1) < 0.01) {
      const ratio = P() / st.predP;
      st.doubled = { ratio, d: st.d };
      ctx.host.complete('c1m1', tr(ctx, `두께 ${st.predD.toFixed(2)} → ${st.d.toFixed(2)} nm, 확률은 ${fmtRatio(ratio)}배 (내 예상 ${fmtRatio(st.pred)}배)`, `Thickness ${st.predD.toFixed(2)} → ${st.d.toFixed(2)} nm, probability ×${fmtRatio(ratio)} (my guess ×${fmtRatio(st.pred)})`));
      ctx.note('thick', `벽 두께를 ${st.predD.toFixed(2)} nm에서 ${st.d.toFixed(2)} nm로 두 배 늘리자 전자가 건너편에 닿을 확률은 절반이 아니라 ${fmtRatio(ratio)}배로 줄었다 (예상 ${fmtRatio(st.pred)}배). 터널링 확률은 두께에 대해 지수적으로 줄어든다.`, `Doubling the barrier from ${st.predD.toFixed(2)} to ${st.d.toFixed(2)} nm cut the chance of crossing not by half but to ×${fmtRatio(ratio)} (I guessed ×${fmtRatio(st.pred)}). Tunnelling falls off exponentially with thickness.`);
    } else if (!st.doubled) ctx.host.result('c1m1', tr(ctx, `두께를 ${(2 * st.predD).toFixed(2)} nm로 바꿔 보세요`, `Set the thickness to ${(2 * st.predD).toFixed(2)} nm`));

    if (st.who === 'e') st.heights.add(Math.round(st.over * 10) / 10);
    const hs = [...st.heights];
    const lo = Math.min(...hs);
    const hi = Math.max(...hs);
    if (hi - lo >= 1) {
      const pl = transmission(st.d, lo);
      const ph = transmission(st.d, hi);
      ctx.host.complete('c1m2', tr(ctx, `벽 높이 ${lo.toFixed(1)} eV에서 ${fmtP(pl)}, ${hi.toFixed(1)} eV에서 ${fmtP(ph)}`, `Barrier ${lo.toFixed(1)} eV: ${fmtP(pl)}, ${hi.toFixed(1)} eV: ${fmtP(ph)}`));
      ctx.note('height', `같은 두께에서 벽 높이를 ${hi.toFixed(1)} eV에서 ${lo.toFixed(1)} eV로 낮추자 확률이 ${fmtP(ph)}에서 ${fmtP(pl)}로 커졌다. 벽이 낮을수록 파동이 벽 속에서 덜 옅어진다.`, `At the same thickness, lowering the barrier from ${hi.toFixed(1)} to ${lo.toFixed(1)} eV raised the chance from ${fmtP(ph)} to ${fmtP(pl)}. A lower barrier lets the wave fade less inside it.`);
    } else ctx.host.result('c1m2', tr(ctx, '벽 높이를 1 eV 넘게 바꿔 보세요', 'Change the barrier height by more than 1 eV'));

    if (st.who === 'p') {
      st.proton = true;
      ctx.host.complete('c1m3', tr(ctx, `양성자는 ${fmtP(P())}, 전자는 ${fmtP(transmission(st.d, st.over))}`, `Proton ${fmtP(P())}, electron ${fmtP(transmission(st.d, st.over))}`));
      ctx.note('heavy', `같은 벽 앞에 전자 대신 1836배 무거운 양성자를 세우자 확률이 ${fmtP(transmission(st.d, st.over))}에서 ${fmtP(P())}로 떨어져 사실상 0이 되었다. 무겁고 큰 것일수록 터널링은 보기 어렵다.`, `Putting a proton, 1836 times heavier, in front of the same barrier dropped the chance from ${fmtP(transmission(st.d, st.over))} to ${fmtP(P())}, effectively zero. The heavier and bigger a thing is, the harder tunnelling is to see.`);
    } else if (!st.proton) ctx.host.result('c1m3', tr(ctx, '입자를 양성자로 바꿔 보세요', 'Switch the particle to a proton'));
    void ko;
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    ui = { ro: readout() };
    const pred = slider({
      label: ko ? '내 예상: 두께를 두 배로 하면 확률은 몇 배?' : 'My guess: doubling the thickness multiplies the chance by',
      min: 0,
      max: 30,
      step: 1,
      value: st.pred == null ? 30 : predToStep(st.pred),
      fmt: (v) => (st.pred == null && v === 30 ? (ko ? '아직' : 'not yet') : fmtRatio(stepToPred(v))),
      onInput: (v) => setPred(stepToPred(v)),
    });
    ui.d = slider({
      label: ko ? '벽 두께' : 'Barrier thickness',
      min: 0.1,
      max: 1,
      step: 0.05,
      value: st.d,
      unit: ' nm',
      fmt: (v) => v.toFixed(2),
      onInput: (v) => {
        st.d = v;
        st.idle = 0;
        check();
      },
    });
    const ht = slider({
      label: ko ? '벽 높이 (입자 에너지보다 높은 만큼)' : 'Barrier height (above the particle energy)',
      min: 0.2,
      max: 2,
      step: 0.1,
      value: st.over,
      unit: ' eV',
      fmt: (v) => v.toFixed(1),
      onInput: (v) => {
        st.over = v;
        st.idle = 0;
        check();
      },
    });
    const who = segment<Who>({
      label: ko ? '입자' : 'Particle',
      options: [
        { v: 'e', label: ko ? '전자' : 'electron' },
        { v: 'p', label: ko ? '양성자' : 'proton' },
      ],
      value: st.who,
      onChange: (v) => {
        st.who = v;
        st.idle = 0;
        check();
      },
    });
    ctx.host.controls.append(pred.el, ui.d.el, ht.el, who.el, ui.ro.el);
  }

  // 예상 슬라이더 칸 ↔ 배수 (1배부터 1/1000배까지 로그 눈금)
  const stepToPred = (v: number) => 10 ** (-3 + (v / 30) * 3);
  const predToStep = (p: number) => Math.round(((Math.log10(p) + 3) / 3) * 30);

  function setPred(v: number): void {
    st.pred = clamp(v, 0.001, 1);
    st.predD = st.d;
    st.predP = transmission(st.d, st.over, ME);
    st.doubled = null;
    st.idle = 0;
    check();
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 56;
    const waveW = narrow ? W : W * 0.66;
    const wave = { x: 16, y: top + 20, w: waveW - 32, h: narrow ? Math.min(220, H * 0.36) : Math.min(320, H - top - 120) };
    const dr = narrow ? Math.min(W * 0.2, 70) : Math.min((W - waveW) * 0.32, 90);
    const d: Dial = narrow
      ? { cx: W / 2, cy: wave.y + wave.h + dr + 60, r: dr, min: 0.001, max: 1, log: true, ticks: [0.001, 0.01, 0.1, 1], fmt: fmtRatio }
      : { cx: waveW + (W - waveW) / 2, cy: top + dr + 60, r: dr, min: 0.001, max: 1, log: true, ticks: [0.001, 0.01, 0.1, 1], fmt: fmtRatio };
    return { W, H, narrow, wave, d };
  };

  function step(dt: number): void {
    st.phase += dt * 5;
  }

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(c, pal, ko ? '왼쪽에서 파동이 들어와 벽을 만납니다. 고전 세계의 공이라면 언제나 되튕겨 나오지만, 파동은 벽 속에서 옅어지며 건너편으로 조금 새어 나갑니다.' : 'A wave comes in from the left and meets a barrier. A classical ball would always bounce back, but the wave fades inside the wall and a little leaks through.', 16, 24, L.W - 32, L.narrow ? 13 : 15);
    const B = L.wave;
    const cy = B.y + B.h * 0.55;
    const A = B.h * 0.2;
    const bx = B.x + B.w * 0.45;
    const bw = B.w * 0.1 + (st.d / 1) * B.w * 0.22;
    const lam = Math.max(40, B.w * 0.09);
    const p = P();
    const kap = kappa(st.over, mass()) * 1e-9; // 1/nm
    // 벽
    const hgt = (st.over / 2) * B.h * 0.75 + B.h * 0.1;
    c.fillStyle = alpha(pal.red, 0.14);
    c.strokeStyle = pal.red;
    c.lineWidth = 2;
    c.fillRect(bx, B.y + B.h - hgt, bw, hgt);
    c.strokeRect(bx, B.y + B.h - hgt, bw, hgt);
    c.strokeStyle = alpha(pal.ink, 0.4);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(B.x, B.y + B.h);
    c.lineTo(B.x + B.w, B.y + B.h);
    c.stroke();
    // 파동: 모양 f(x)가 제자리에서 출렁인다. 벽 속에서는 지수적으로 옅어진다
    const osc = Math.cos(st.phase);
    const out = Math.sqrt(p);
    const f = (x: number) => {
      if (x < bx) return Math.cos((TAU * (x - bx)) / lam);
      if (x <= bx + bw) return Math.exp(-kap * st.d * ((x - bx) / bw));
      return out * Math.cos((TAU * (x - bx - bw)) / lam);
    };
    // 벽 속 옅어지는 정도 (점선)
    c.strokeStyle = alpha(pal.blue, 0.5);
    c.setLineDash([4, 4]);
    c.lineWidth = 1.5;
    c.beginPath();
    for (let x = bx; x <= bx + bw; x += 2) {
      const y = cy - A * f(x);
      if (x === bx) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = pal.blue;
    c.lineWidth = 2.5;
    c.beginPath();
    for (let x = B.x; x <= B.x + B.w; x += 2) {
      const y = cy - A * f(x) * osc;
      if (x === B.x) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    text(c, pal, ko ? '들어오는 파동' : 'incoming wave', B.x + 4, B.y + 12, { size: 12 });
    text(c, pal, ko ? `벽 ${st.d.toFixed(2)} nm` : `barrier ${st.d.toFixed(2)} nm`, bx + bw / 2, B.y + B.h - hgt - 8, { size: 12, align: 'center' });
    text(c, pal, ko ? '새어 나간 파동' : 'leaked wave', B.x + B.w - 4, B.y + 12, { size: 12, align: 'right' });
    text(c, pal, ko ? `건너편에 닿을 확률 ${fmtP(p)}` : `chance to get through ${fmtP(p)}`, B.x + B.w - 4, B.y + 32, { size: 14, align: 'right', color: pal.blue, title: true });
    text(c, pal, st.who === 'e' ? (ko ? '입자: 전자' : 'particle: electron') : ko ? '입자: 양성자 (1836배 무거움)' : 'particle: proton (1836× heavier)', B.x + 4, B.y + 32, { size: 12, color: pal.blue });
    // 계기판
    dial(c, pal, L.d, { value: st.doubled ? st.doubled.ratio : null, pred: st.pred, label: ko ? '두 배 두께에서 확률은 몇 배?' : 'chance × at double thickness' });
    if (st.pred != null && !st.doubled) text(c, pal, ko ? `이제 두께를 ${(2 * st.predD).toFixed(2)} nm로` : `now set ${(2 * st.predD).toFixed(2)} nm`, L.d.cx, L.d.cy + 58, { size: 12, align: 'center', color: pal.blue });
    if (st.idle > 5 && st.pred == null) pulse(c, pal, L.d.cx, L.d.cy - L.d.r * 0.5, L.d.r * 0.7, st.t);
    ui.ro.set(
      ko
        ? `두께 ${st.d.toFixed(2)} nm, 벽 높이 ${st.over.toFixed(1)} eV, ${st.who === 'e' ? '전자' : '양성자'}\n건너편에 닿을 확률 ${fmtP(p)}`
        : `Thickness ${st.d.toFixed(2)} nm, height ${st.over.toFixed(1)} eV, ${st.who === 'e' ? 'electron' : 'proton'}\nChance to get through ${fmtP(p)}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  function down(p: Pt): void {
    const v = dialHit(lay().d, p.x, p.y);
    if (v != null) {
      st.drag = true;
      setPred(v);
    }
  }
  function move(p: Pt): void {
    if (!st.drag) return;
    const d = lay().d;
    const v = dialHit({ ...d, r: d.r * 3 }, p.x, p.y);
    if (v != null) setPred(v);
  }
  function up(): void {
    if (st.drag) panel();
    st.drag = false;
  }

  return {
    id: '1',
    ko: '벽을 지나가는 파동',
    en: 'A wave through a wall',
    missions: [
      {
        id: 'c1m1',
        ko: '벽 두께를 두 배로 하면 확률이 몇 배가 될지 예상한 뒤, 직접 두 배로 바꿔 확인하라.',
        en: 'Guess what doubling the thickness does to the chance, then double it and check.',
        hint_ko: '계기판 바늘을 끌거나 예상 손잡이를 움직인 다음, 벽 두께 손잡이를 지금 값의 두 배로 옮기세요.',
        hint_en: 'Drag the dial needle or move the guess slider, then set the thickness slider to twice its value.',
      },
      {
        id: 'c1m2',
        ko: '벽 높이를 1 eV 넘게 바꿔 보고, 낮은 벽과 높은 벽의 확률을 비교하라.',
        en: 'Change the barrier height by more than 1 eV and compare low and high barriers.',
        hint_ko: '벽 높이 손잡이를 0.5 eV 아래와 1.5 eV 위로 옮겨 보세요.',
        hint_en: 'Move the height slider below 0.5 eV and above 1.5 eV.',
      },
      {
        id: 'c1m3',
        ko: '전자를 양성자로 바꿔, 무거운 입자도 벽을 지나가는지 보라.',
        en: 'Swap the electron for a proton and see whether a heavy particle gets through.',
        hint_ko: '입자 고르기에서 양성자를 누르세요.',
        hint_en: 'Choose proton under Particle.',
      },
    ],
    content: {
      ko: {
        observe: `<p>양자역학에서 입자는 파동처럼 퍼져 있습니다. 넘을 힘이 없는 벽을 만나도 파동은 벽 속으로 조금 스며들고, 벽이 충분히 얇으면 건너편까지 닿습니다. 이것이 <b>터널링</b>입니다.</p><p>전자 하나, 원자 하나에서는 흔한 일이라 반도체 소자도 이 현상을 씁니다. 그런데 공을 벽에 던져서 벽을 뚫고 지나가는 걸 본 사람은 없습니다.</p><p class="q">벽 두께를 두 배로 하면, 건너편에 닿을 확률은 절반이 될까?</p>`,
        interact: '먼저 계기판에 예상을 놓고, 벽 두께와 높이, 입자를 바꿔 보세요.',
        understand: `<h4>벽 속에서 옅어지는 파동</h4><p>벽 안에서 파동은 출렁이지 않고 거리에 따라 지수적으로 옅어집니다. 얼마나 빨리 옅어지는지는 다음 값이 정합니다.</p>$$\\kappa = \\frac{\\sqrt{2m\\,(V_0 - E)}}{\\hbar}$$<p>벽이 두꺼우면 확률은 대략 $T \\approx e^{-2\\kappa d}$로 줄어듭니다. 두께가 두 배면 지수가 두 배가 되니 확률은 제곱만큼 작아집니다. 화면의 값은 사각형 벽의 정확한 식으로 계산했습니다.</p>$$T = \\left[1 + \\frac{V_0^2 \\sinh^2(\\kappa d)}{4E\\,(V_0 - E)}\\right]^{-1}$$<h4>왜 큰 것은 터널링을 못 할까</h4><p>$\\kappa$에 질량 $m$이 들어 있습니다. 양성자만 해도 확률이 $10^{-50}$ 아래로 떨어지고, 원자 수십억 개로 된 물체라면 우주 나이를 기다려도 일어나지 않습니다.</p><p class="q">그렇다면 수십억 개의 입자가 한 몸처럼 움직여, 전체가 변수 하나로 나타나는 회로라면 어떨까? 다음 장에서 그 회로를 직접 다룹니다.</p>`,
      },
      en: {
        observe: `<p>In quantum mechanics a particle is spread out like a wave. Even at a wall it lacks the energy to climb, the wave seeps in, and if the wall is thin enough it reaches the far side. This is <b>tunnelling</b>.</p><p>It is routine for single electrons and atoms, and semiconductor devices rely on it. Yet nobody has seen a ball thrown at a wall pass through it.</p><p class="q">If the wall is twice as thick, does the chance of getting through halve?</p>`,
        interact: 'Set a guess on the dial first, then change the thickness, height and particle.',
        understand: `<h4>A wave fading inside the wall</h4><p>Inside the wall the wave stops oscillating and fades exponentially with distance, at a rate set by</p>$$\\kappa = \\frac{\\sqrt{2m\\,(V_0 - E)}}{\\hbar}$$<p>For a thick wall the chance falls roughly as $T \\approx e^{-2\\kappa d}$. Doubling the thickness doubles the exponent, so the chance is squared. The numbers on screen use the exact result for a square barrier.</p>$$T = \\left[1 + \\frac{V_0^2 \\sinh^2(\\kappa d)}{4E\\,(V_0 - E)}\\right]^{-1}$$<h4>Why big things don't tunnel</h4><p>The mass $m$ sits inside $\\kappa$. Even a proton drops below $10^{-50}$; an object of billions of atoms would not tunnel in the age of the universe.</p><p class="q">But what about a circuit where billions of particles move as one, so the whole thing is described by a single variable? The next chapter puts that circuit in your hands.</p>`,
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
      st.d = 0.3;
      st.over = 1;
      st.who = 'e';
      st.pred = null;
      st.doubled = null;
      st.heights.clear();
      st.proton = false;
      panel();
      check();
    },
    down,
    move,
    up,
  };
}
