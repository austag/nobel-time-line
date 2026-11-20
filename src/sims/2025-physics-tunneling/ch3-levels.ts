// 3장: 띄엄띄엄한 에너지 (에너지 준위 양자화, 1985).
// 접합에 마이크로파를 쪼이며 주파수를 바꾼다. 준위 간격과 맞는 주파수에서만 탈출이 크게 늘어난다.
import { alpha, text } from '../canvas';
import { readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { axes, caption, circuit, dot, stateCurve, type Box } from './draw';
import { JJ, enhancement, level, levelsIn, rng, transition } from './model';

type Guess = 'even' | 'peak' | 'none';

interface Pt3 {
  f: number;
  s: number;
  e: number;
}

const F0 = 2.8;
const F1 = 5.2;
const S_MIN = 0.975;
const S_MAX = 0.99;

export function chapter3(): Chapter {
  let ctx: Ctx;
  const st = {
    s: 0.98,
    f: 3.4,
    guess: null as Guess | null,
    pts: [] as Pt3[],
    auto: null as null | { f: number },
    seed: 21,
    lit: 0,
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; f?: ReturnType<typeof slider> };

  const key = (s: number) => Math.round(s * 10000);
  const nLevels = (s: number) => Math.max(2, Math.min(5, Math.floor(levelsIn(s))));

  function shoot(f = st.f): void {
    const r = rng(st.seed++);
    const e = Math.max(0, enhancement(f, st.s) + (r() - 0.5) * 0.12);
    st.pts.push({ f, s: st.s, e });
    st.idle = 0;
    check();
  }

  /** 전류마다 찾은 첫 공명 (가장 크게 튄 점) */
  function peaks(): Map<number, Pt3> {
    const m = new Map<number, Pt3>();
    for (const p of st.pts) {
      if (p.e < 1.5) continue;
      const q = m.get(key(p.s));
      if (!q || p.e > q.e) m.set(key(p.s), p);
    }
    return m;
  }

  function check(): void {
    const ko = k(ctx);
    const pk = peaks();
    const here = pk.get(key(st.s));
    if (st.guess == null) ctx.host.result('c3m1', tr(ctx, '먼저 예상을 고르세요', 'First pick a guess'));
    else if (pk.size) {
      const p = [...pk.values()][0];
      const g = { even: ko ? '고르게 늘어남' : 'rises evenly', peak: ko ? '특정 주파수에서만' : 'only at certain frequencies', none: ko ? '변화 없음' : 'no change' }[st.guess];
      ctx.host.complete('c3m1', tr(ctx, `${p.f.toFixed(2)} GHz에서 탈출이 ${(1 + p.e).toFixed(1)}배 (내 예상: ${g})`, `At ${p.f.toFixed(2)} GHz escape rose ×${(1 + p.e).toFixed(1)} (my guess: ${g})`));
      ctx.note('peak', `접합에 마이크로파를 쪼이며 주파수를 바꾸자 대부분의 주파수에서는 아무 일도 없다가 ${p.f.toFixed(2)} GHz에서만 탈출률이 ${(1 + p.e).toFixed(1)}배로 뛰었다 (예상: ${g}). 회로가 정해진 크기의 에너지만 받아들인다는 뜻이다.`, `Sweeping the microwave frequency did nothing at most frequencies, but at ${p.f.toFixed(2)} GHz the escape rate jumped ×${(1 + p.e).toFixed(1)} (my guess: ${g}). The circuit only accepts energy in fixed-size steps.`);
    } else ctx.host.result('c3m1', tr(ctx, '주파수를 바꿔 가며 쪼여 보세요', 'Try several frequencies'));

    if (pk.size >= 2) {
      const ps = [...pk.values()].sort((a, b) => a.s - b.s);
      const a = ps[0];
      const b = ps[ps.length - 1];
      const err = Math.max(...ps.map((p) => Math.abs(p.f - transition(0, p.s)) / transition(0, p.s)));
      ctx.host.complete('c3m2', tr(ctx, `전류 ${(a.s * JJ.I0 * 1e6).toFixed(2)} μA에서 ${a.f.toFixed(2)} GHz, ${(b.s * JJ.I0 * 1e6).toFixed(2)} μA에서 ${b.f.toFixed(2)} GHz`, `${a.f.toFixed(2)} GHz at ${(a.s * JJ.I0 * 1e6).toFixed(2)} μA, ${b.f.toFixed(2)} GHz at ${(b.s * JJ.I0 * 1e6).toFixed(2)} μA`));
      ctx.note('shift', `흘리는 전류를 ${(a.s * JJ.I0 * 1e6).toFixed(2)} μA에서 ${(b.s * JJ.I0 * 1e6).toFixed(2)} μA로 올리자 공명 주파수가 ${a.f.toFixed(2)} GHz에서 ${b.f.toFixed(2)} GHz로 내려갔고, 양자역학으로 계산한 준위 간격과 ${Math.max(1, Math.round(err * 100))}% 안쪽으로 맞았다.`, `Raising the current from ${(a.s * JJ.I0 * 1e6).toFixed(2)} to ${(b.s * JJ.I0 * 1e6).toFixed(2)} μA moved the resonance from ${a.f.toFixed(2)} to ${b.f.toFixed(2)} GHz, matching the quantum level spacing within ${Math.max(1, Math.round(err * 100))}%.`);
    } else ctx.host.result('c3m2', tr(ctx, `공명을 찾은 전류 ${pk.size}/2`, `Currents with a resonance found ${pk.size}/2`));

    const f12 = transition(1, st.s);
    const second = st.pts.find((p) => key(p.s) === key(st.s) && Math.abs(p.f - f12) < f12 / 60 && p.e > 0.45 && p.e < 1.5);
    if (here && second) {
      ctx.host.complete('c3m3', tr(ctx, `0→1 ${here.f.toFixed(2)} GHz, 1→2 ${second.f.toFixed(2)} GHz`, `0→1 ${here.f.toFixed(2)} GHz, 1→2 ${second.f.toFixed(2)} GHz`));
      ctx.note('second', `같은 전류에서 첫 공명(${here.f.toFixed(2)} GHz)보다 조금 낮은 ${second.f.toFixed(2)} GHz에 작은 공명이 하나 더 있었다. 위 준위로 갈수록 간격이 좁아지는, 3차 곡선 모양 골짜기의 준위 사다리가 보인 것이다.`, `At the same current a smaller resonance sat at ${second.f.toFixed(2)} GHz, just below the first (${here.f.toFixed(2)} GHz). Spacing shrinks higher up: the level ladder of a cubic-shaped dip.`);
    } else ctx.host.result('c3m3', tr(ctx, '첫 공명보다 조금 낮은 주파수에서 작은 공명을 찾아보세요', 'Look for a smaller resonance a little below the first'));
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
      label: ko ? '내 예상: 주파수를 천천히 올리면 탈출률은?' : 'My guess: as the frequency rises, the escape rate…',
      options: [
        { v: 'even', label: ko ? '고르게 늘어남' : 'rises evenly' },
        { v: 'peak', label: ko ? '특정 주파수에서만 튐' : 'jumps at certain frequencies' },
        { v: 'none', label: ko ? '변화 없음' : 'no change' },
      ],
      value: st.guess ?? ('' as Guess),
      onChange: (v) => {
        st.guess = v;
        check();
      },
    });
    const cur = slider({
      label: ko ? '흘려 주는 전류' : 'Bias current',
      min: S_MIN,
      max: S_MAX,
      step: 0.0025,
      value: st.s,
      unit: ' μA',
      fmt: (v) => (v * JJ.I0 * 1e6).toFixed(2),
      onInput: (v) => {
        st.s = v;
        st.idle = 0;
        check();
      },
    });
    ui.f = slider({
      label: ko ? '마이크로파 주파수' : 'Microwave frequency',
      min: F0,
      max: F1,
      step: 0.01,
      value: st.f,
      unit: ' GHz',
      fmt: (v) => v.toFixed(2),
      onInput: (v) => {
        st.f = v;
        st.idle = 0;
      },
    });
    ctx.host.controls.append(
      g.el,
      cur.el,
      ui.f.el,
      row(
        stepButton({ label: ko ? '이 주파수로 재기' : 'Measure at this frequency', onClick: () => shoot() }).el,
        stepButton({ label: ko ? '처음부터 끝까지 훑기' : 'Sweep the whole range', onClick: () => (st.auto = { f: F0 }) }).el,
      ),
      row(stepButton({ label: ko ? '기록 지우기' : 'Clear', onClick: () => ((st.pts = []), check()) }).el),
      ui.ro.el,
    );
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 58;
    const leftW = narrow ? W : W * 0.5;
    const cir: Box = { x: 12, y: top + 4, w: leftW - 24, h: narrow ? Math.min(140, H * 0.18) : Math.min(170, (H - top) * 0.3) };
    const cur: Box = { x: 24, y: cir.y + cir.h + 36, w: leftW - 48, h: narrow ? Math.min(150, H * 0.2) : Math.min(260, H - cir.y - cir.h - 90) };
    if (!narrow) {
      const colX = leftW + 50;
      const colW = W - colX - 24;
      const gh = (H - top - 130) / 2;
      const sp: Box = { x: colX, y: top + 24, w: colW, h: gh };
      const fi: Box = { x: colX, y: sp.y + gh + 70, w: colW, h: gh };
      return { W, H, narrow, cir, cur, sp, fi };
    }
    const y = cur.y + cur.h + 50;
    const gh = Math.max(90, (H - y - 110) / 2);
    const sp: Box = { x: 52, y, w: W - 72, h: gh };
    const fi: Box = { x: 52, y: y + gh + 66, w: W - 72, h: gh };
    return { W, H, narrow, cir, cur, sp, fi };
  };

  function step(dt: number): void {
    if (dt === 0) return;
    if (st.auto) {
      st.auto.f += dt * 1.2;
      const fs = Math.round(st.auto.f * 25) / 25;
      if (!st.pts.some((p) => key(p.s) === key(st.s) && Math.abs(p.f - fs) < 0.001) && fs <= F1) {
        st.f = fs;
        ui.f?.set(fs);
        shoot(fs);
      }
      if (st.auto.f > F1) st.auto = null;
    }
    // 공이 올라가 있는 준위: 지금 주파수가 맞으면 위로
    const e01 = Math.abs(st.f - transition(0, st.s)) < transition(0, st.s) / 60;
    st.lit = e01 ? 1 : 0;
  }

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(c, pal, ko ? '냉동기 안 접합에 마이크로파를 쪼입니다. 주파수를 바꿔 가며 재면, 탈출률이 어디서 늘어나는지 오른쪽 그래프에 찍힙니다.' : 'Microwaves shine on the junction in the fridge. Measure at different frequencies and see on the right where the escape rate rises.', 16, 24, L.W - 32, L.narrow ? 13 : 15);
    circuit(c, pal, L.cir, { ko, shield: true, volt: 0, current: st.s * JJ.I0 * 1e6, tempMK: 18, microwave: true, t: st.t });
    // 회로 상태 그림과 준위
    const n = nLevels(st.s);
    const r = levelsIn(st.s);
    const lv = Array.from({ length: n }, (_, i) => Math.min(0.96, level(i, st.s) / r));
    text(c, pal, ko ? '회로 상태 그림: 골짜기 안의 에너지 준위' : 'Circuit state picture: levels inside the dip', L.cur.x, L.cur.y - 18, { size: 13, title: true });
    stateCurve(c, pal, L.cur, { ko, s: st.s, vis: 0.25 + (0.2 * (st.s - S_MIN)) / (S_MAX - S_MIN), levels: lv, zoom: true, lit: st.lit, t: st.t });
    text(c, pal, st.lit ? (ko ? '공명! 0 → 1로 올라감' : 'resonance! 0 → 1') : '', L.cur.x + L.cur.w, L.cur.y + 2, { size: 12, align: 'right', color: pal.blue });
    // 탈출률 그래프
    const A = axes(c, pal, L.sp, { x0: F0, x1: F1, y0: 0, y1: 3, xt: [3, 3.5, 4, 4.5, 5], yt: [0, 1, 2, 3], fx: (v) => v.toFixed(1), fy: (v) => `×${v + 1}`, xl: ko ? '마이크로파 주파수 (GHz) →' : 'microwave frequency (GHz) →', yl: ko ? '탈출률 (마이크로파 없을 때 대비)' : 'escape rate (vs. no microwaves)' });
    c.strokeStyle = alpha(pal.blue, 0.8);
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(A.X(st.f), L.sp.y);
    c.lineTo(A.X(st.f), L.sp.y + L.sp.h);
    c.stroke();
    c.setLineDash([]);
    for (const p of st.pts) dot(c, pal, A.X(p.f), A.Y(Math.min(3, p.e)), key(p.s) === key(st.s) ? 4.5 : 3.5, key(p.s) === key(st.s));
    text(c, pal, ko ? '채운 점: 지금 전류, 빈 점: 다른 전류' : 'filled: this current, open: other currents', L.sp.x + L.sp.w, L.sp.y - 10, { size: 11, align: 'right' });
    // 전류에 따른 공명 주파수
    const iA = S_MIN * JJ.I0 * 1e6;
    const iB = S_MAX * JJ.I0 * 1e6;
    const B = axes(c, pal, L.fi, { x0: iA, x1: iB, y0: 3.2, y1: 5, xt: [9.27, 9.33, 9.38, 9.41], yt: [3.5, 4, 4.5, 5], fx: (v) => v.toFixed(2), fy: (v) => v.toFixed(1), xl: ko ? '흘려 주는 전류 (μA) →' : 'bias current (μA) →', yl: ko ? '찾은 공명 주파수 (GHz)' : 'resonance found (GHz)' });
    const pk = peaks();
    if (pk.size >= 2) {
      c.strokeStyle = pal.blue;
      c.lineWidth = 2;
      c.beginPath();
      for (let s = S_MIN; s <= S_MAX + 1e-9; s += 0.0005) {
        const x = B.X(s * JJ.I0 * 1e6);
        const y = B.Y(transition(0, s));
        if (s === S_MIN) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      text(c, pal, ko ? '파란 선: 양자역학 준위 간격' : 'blue line: quantum level spacing', L.fi.x + L.fi.w, L.fi.y - 10, { size: 11, align: 'right', color: pal.blue });
    }
    for (const p of pk.values()) dot(c, pal, B.X(p.s * JJ.I0 * 1e6), B.Y(p.f), 5, true);
    const last = st.pts[st.pts.length - 1];
    ui.ro.set(
      ko
        ? `전류 ${(st.s * JJ.I0 * 1e6).toFixed(2)} μA, 마이크로파 ${st.f.toFixed(2)} GHz\n골짜기 안 준위 약 ${r.toFixed(1)}개\n${last ? `마지막 측정: 탈출률 ×${(1 + last.e).toFixed(2)}` : '아직 측정 전'}`
        : `Current ${(st.s * JJ.I0 * 1e6).toFixed(2)} μA, microwave ${st.f.toFixed(2)} GHz\nAbout ${r.toFixed(1)} levels fit in the dip\n${last ? `Last: escape rate ×${(1 + last.e).toFixed(2)}` : 'Nothing measured yet'}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '3',
    ko: '띄엄띄엄한 에너지',
    en: 'Energy in steps',
    missions: [
      {
        id: 'c3m1',
        ko: '주파수를 올리면 탈출률이 어떻게 될지 고른 뒤, 주파수를 바꿔 가며 재서 확인하라.',
        en: 'Pick what happens to the escape rate as the frequency rises, then measure across frequencies.',
        hint_ko: '"처음부터 끝까지 훑기"를 누르면 주파수를 바꿔 가며 자동으로 잽니다.',
        hint_en: '"Sweep the whole range" measures across all frequencies for you.',
      },
      {
        id: 'c3m2',
        ko: '전류를 바꿔 두 곳 이상에서 공명을 찾고, 양자역학이 계산한 준위 간격과 맞는지 보라.',
        en: 'Find the resonance at two or more currents and compare with the quantum level spacing.',
        hint_ko: '전류 손잡이를 옮긴 뒤 다시 훑으세요. 아래 그래프에 점과 이론 선이 나타납니다.',
        hint_en: 'Move the current slider and sweep again; points and a theory line appear below.',
      },
      {
        id: 'c3m3',
        ko: '같은 전류에서 첫 공명보다 조금 낮은 주파수에 있는 작은 공명을 찾아라.',
        en: 'At the same current, find the smaller resonance a little below the first.',
        hint_ko: '훑기 결과에서 큰 봉우리 왼쪽에 작은 봉우리가 있는지 보세요.',
        hint_en: 'Look for a small bump to the left of the big peak.',
      },
    ],
    content: {
      ko: {
        observe: `<p>2장에서 회로 전체가 벽을 지나가는 것을 보았습니다. 그런데 양자역학이 정말 이 회로를 다스린다면, 증거가 하나 더 있어야 합니다. 골짜기 안에서 회로가 가질 수 있는 에너지가 아무 값이나가 아니라 <b>계단처럼 정해진 값</b>뿐이어야 하지요.</p><p>마르티니스, 드보레, 클라크는 접합에 마이크로파를 쪼였습니다. 마이크로파 한 알갱이의 에너지가 두 준위 사이 간격과 맞으면 회로가 위 준위로 올라가고, 위 준위일수록 벽이 얇아져서 탈출이 쉬워집니다.</p><p class="q">마이크로파 주파수를 천천히 올리면, 탈출률은 어떻게 변할까?</p>`,
        interact: '전류를 정하고 주파수를 바꿔 가며 재세요. 공명을 찾으면 전류를 바꿔 한 번 더 찾아보세요.',
        understand: `<h4>정해진 크기로만 받는 에너지</h4><p>마이크로파 주파수 $f$는 에너지 $hf$짜리 알갱이로 들어옵니다. 이 값이 두 준위 간격과 같을 때만 회로가 흡수합니다.</p>$$hf_{01} = E_1 - E_0 \\approx \\hbar\\omega_p\\left(1 - \\frac{5}{18}\\,\\frac{\\hbar\\omega_p}{\\Delta U}\\right)$$<p>골짜기 모양이 완전한 포물선이 아니라서 위로 갈수록 간격이 조금씩 좁아집니다. 그래서 1 → 2 공명은 0 → 1보다 약간 낮은 주파수에 나옵니다.</p><h4>전류로 바꾸는 계단 간격</h4><p>전류를 올리면 골짜기가 얕아지고 $\\omega_p$가 작아져서 공명 주파수가 내려갑니다.</p>$$\\omega_p = \\sqrt{\\frac{2\\pi I_c}{\\Phi_0 C}}\\left[1 - \\left(\\frac{I}{I_c}\\right)^2\\right]^{1/4}$$<p>이 방법의 장점은 접합의 모든 값을 정확히 몰라도 계단이 있는지 바로 보인다는 것입니다. 1985년 10월 논문은 거시 변수의 에너지 준위를 처음 관측한 결과였습니다.</p><h4>실제와 다른 점</h4><p>공명 봉우리의 폭과 높이는 보기 좋게 정했습니다. 실제 실험에서는 마이크로파 세기와 온도에 따라 봉우리 모양이 달라졌습니다.</p>`,
      },
      en: {
        observe: `<p>In chapter 2 the whole circuit got through the wall. But if quantum mechanics really governs this circuit, there should be a second sign: inside the dip, the circuit's energy should not take any value, only <b>fixed steps</b>.</p><p>Martinis, Devoret and Clarke shone microwaves on the junction. When one microwave quantum matches the gap between two levels, the circuit climbs to the upper level, where the wall is thinner and escape is easier.</p><p class="q">As you slowly raise the microwave frequency, how does the escape rate change?</p>`,
        interact: 'Choose a current and measure across frequencies. Once you find a resonance, change the current and find it again.',
        understand: `<h4>Energy taken only in fixed amounts</h4><p>Microwaves at frequency $f$ come in quanta of energy $hf$. The circuit absorbs only when that equals a level gap.</p>$$hf_{01} = E_1 - E_0 \\approx \\hbar\\omega_p\\left(1 - \\frac{5}{18}\\,\\frac{\\hbar\\omega_p}{\\Delta U}\\right)$$<p>The dip is not a perfect parabola, so the gaps shrink a little going up; the 1 → 2 resonance sits slightly below 0 → 1.</p><h4>Tuning the steps with current</h4><p>More current makes the dip shallower and lowers $\\omega_p$, so the resonance moves down.</p>$$\\omega_p = \\sqrt{\\frac{2\\pi I_c}{\\Phi_0 C}}\\left[1 - \\left(\\frac{I}{I_c}\\right)^2\\right]^{1/4}$$<p>The beauty of the method is that the steps show up without knowing every junction value precisely. The October 1985 paper was the first observation of energy levels of a macroscopic variable.</p><h4>How this differs from reality</h4><p>Peak widths and heights are chosen for display; in the real experiment their shape depended on microwave power and temperature.</p>`,
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
      st.s = 0.98;
      st.f = 3.4;
      st.guess = null;
      st.pts = [];
      st.auto = null;
      panel();
      check();
    },
    leave() {
      st.auto = null;
    },
  };
}
