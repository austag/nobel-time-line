// 4장: 큐비트로 가는 길 (그 뒤의 이야기).
// 골짜기의 가장 낮은 두 준위를 0과 1로 쓴다. 마이크로파를 쏘는 시간을 바꾸며 0과 1 사이를 오가게 한다.
import { alpha, text } from '../canvas';
import { readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { axes, caption, dot, stateCurve, type Box } from './draw';
import { PI_PULSE, T2_NS, p1, shots } from './model';

type Guess = 'grow' | 'swing' | 'none';
const T_MAX = 160;

export function chapter4(): Chapter {
  let ctx: Ctx;
  const st = {
    t: 0,
    len: 10,
    guess: null as Guess | null,
    pts: [] as { len: number; p: number }[],
    auto: null as null | { len: number },
    seed: 41,
    flash: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; len?: ReturnType<typeof slider> };

  function shoot(len = st.len): void {
    const p = shots(len, 100, st.seed++);
    st.pts.push({ len, p });
    st.flash = 1;
    st.idle = 0;
    check();
  }

  function check(): void {
    const ko = k(ctx);
    const lens = st.pts.map((p) => p.len);
    const span = lens.length ? Math.max(...lens) - Math.min(...lens) : 0;
    if (st.guess == null) ctx.host.result('c4m1', tr(ctx, '먼저 예상을 고르세요', 'First pick a guess'));
    else if (new Set(lens).size >= 6 && span >= 60) {
      const g = { grow: ko ? '길수록 1에 가까워짐' : 'closer to 1 the longer', swing: ko ? '0과 1 사이를 오감' : 'swings between 0 and 1', none: ko ? '그대로 0' : 'stays at 0' }[st.guess];
      ctx.host.complete('c4m1', tr(ctx, `${new Set(lens).size}가지 길이를 쟀더니 1이 나올 확률이 올라갔다 내려갔다 함 (내 예상: ${g})`, `Across ${new Set(lens).size} lengths the chance of 1 went up and down (my guess: ${g})`));
      ctx.note('rabi', `가장 낮은 두 준위를 0과 1로 두고 마이크로파를 쏘는 시간을 늘려 가자, 1이 나올 확률이 계속 커지지 않고 0과 1 사이를 오갔다 (예상: ${g}). 회로가 두 상태를 겹쳐 가진 채 흔들린 것이다.`, `Using the two lowest levels as 0 and 1 and lengthening the microwave pulse, the chance of reading 1 did not keep growing but swung between 0 and 1 (my guess: ${g}). The circuit oscillated through superpositions of the two states.`);
    } else ctx.host.result('c4m1', tr(ctx, `잰 길이 ${new Set(lens).size}/6 (60 ns 넘게 넓게)`, `Pulse lengths measured ${new Set(lens).size}/6 (spread over 60 ns)`));

    const flip = st.pts.filter((p) => p.p >= 0.9).sort((a, b) => a.len - b.len)[0];
    if (flip) {
      ctx.host.complete('c4m2', tr(ctx, `${flip.len} ns에서 1이 나올 비율 ${Math.round(flip.p * 100)}%`, `${Math.round(flip.p * 100)}% ones at ${flip.len} ns`));
      ctx.note('pi', `마이크로파를 ${flip.len} ns 쏘자 100번 중 ${Math.round(flip.p * 100)}번이 1로 나왔다. 0을 1로 뒤집는 이 길이가 큐비트의 기본 연산이다.`, `A ${flip.len} ns pulse gave 1 in ${Math.round(flip.p * 100)} of 100 shots. This 0-to-1 flip is the basic operation of a qubit.`);
    } else ctx.host.result('c4m2', tr(ctx, '1이 90% 넘게 나오는 길이를 찾으세요', 'Find a length that gives 1 more than 90% of the time'));

    const late = st.pts.filter((p) => p.len > PI_PULSE * 4);
    const peakLate = late.length ? Math.max(...late.map((p) => p.p)) : 0;
    if (flip && late.length >= 3 && peakLate < flip.p - 0.05) {
      ctx.host.complete('c4m3', tr(ctx, `처음 봉우리 ${Math.round(flip.p * 100)}%, ${Math.round(PI_PULSE * 4)} ns 뒤 봉우리 ${Math.round(peakLate * 100)}%`, `First peak ${Math.round(flip.p * 100)}%, peaks after ${Math.round(PI_PULSE * 4)} ns ${Math.round(peakLate * 100)}%`));
      ctx.note('decay', `오래 쏠수록 봉우리가 낮아졌다 (${Math.round(flip.p * 100)}% → ${Math.round(peakLate * 100)}%). 주변과 엮이며 양자 상태가 흐려지기 때문이고, 이 시간을 늘리는 것이 오늘날 양자컴퓨터의 큰 숙제다.`, `Longer pulses gave lower peaks (${Math.round(flip.p * 100)}% → ${Math.round(peakLate * 100)}%). The quantum state blurs as it couples to its surroundings, and stretching that time is a central task for today's quantum computers.`);
    } else ctx.host.result('c4m3', tr(ctx, `${Math.round(PI_PULSE * 4)} ns 넘게 길게 쏴서 봉우리 높이를 비교하세요`, `Measure beyond ${Math.round(PI_PULSE * 4)} ns and compare the peak heights`));
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
      label: ko ? '내 예상: 마이크로파를 오래 쏠수록 1이 나올 확률은?' : 'My guess: the longer the pulse, the chance of 1…',
      options: [
        { v: 'grow', label: ko ? '1에 가까워짐' : 'approaches 1' },
        { v: 'swing', label: ko ? '0과 1 사이를 오감' : 'swings 0 ↔ 1' },
        { v: 'none', label: ko ? '그대로 0' : 'stays 0' },
      ],
      value: st.guess ?? ('' as Guess),
      onChange: (v) => {
        st.guess = v;
        check();
      },
    });
    ui.len = slider({
      label: ko ? '마이크로파를 쏘는 시간' : 'Microwave pulse length',
      min: 0,
      max: T_MAX,
      step: 1,
      value: st.len,
      unit: ' ns',
      onInput: (v) => {
        st.len = v;
        st.idle = 0;
      },
    });
    ctx.host.controls.append(
      g.el,
      ui.len.el,
      row(
        stepButton({ label: ko ? '100번 쏘고 재기' : 'Fire and read 100 times', onClick: () => shoot() }).el,
        stepButton({ label: ko ? '길이를 바꿔 가며 자동으로' : 'Step through lengths', onClick: () => (st.auto = { len: 0 }) }).el,
      ),
      row(stepButton({ label: ko ? '기록 지우기' : 'Clear', onClick: () => ((st.pts = []), check()) }).el),
      ui.ro.el,
    );
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 58;
    const leftW = narrow ? W : W * 0.44;
    const cur: Box = { x: 24, y: top + 40, w: leftW - 48, h: narrow ? Math.min(150, H * 0.22) : Math.min(260, H * 0.45) };
    const bar: Box = { x: 24, y: cur.y + cur.h + 50, w: leftW - 48, h: 18 };
    const g: Box = narrow ? { x: 52, y: bar.y + 80, w: W - 72, h: Math.max(110, H - bar.y - 140) } : { x: leftW + 50, y: top + 30, w: W - leftW - 74, h: H - top - 100 };
    return { W, H, narrow, cur, bar, g };
  };

  function step(dt: number): void {
    if (dt === 0) return;
    st.flash = Math.max(0, st.flash - dt * 2);
    if (st.auto) {
      st.auto.len += dt * 40;
      const L = Math.round(st.auto.len / 5) * 5;
      if (L <= T_MAX && !st.pts.some((p) => p.len === L)) {
        st.len = L;
        ui.len?.set(L);
        shoot(L);
      }
      if (st.auto.len > T_MAX) st.auto = null;
    }
  }

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(c, pal, ko ? '그 뒤의 이야기: 골짜기의 가장 낮은 두 준위를 0과 1로 씁니다. 마이크로파를 쏘는 시간을 바꾸고 100번씩 재 보세요.' : 'What came next: use the two lowest levels of the dip as 0 and 1. Change the pulse length and read out 100 times each.', 16, 24, L.W - 32, L.narrow ? 13 : 15);
    const p = p1(st.len);
    text(c, pal, ko ? '회로 상태 그림: 큐비트로 쓰는 두 준위' : 'Circuit state picture: the two levels used as a qubit', L.cur.x, L.cur.y - 18, { size: 13, title: true });
    stateCurve(c, pal, L.cur, { ko, s: 0.985, vis: 0.3, zoom: true, levels: [0.14, 0.4], lit: p >= 0.5 ? 1 : 0, t: st.t });
    // 0과 1 막대
    const b = L.bar;
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.2;
    c.strokeRect(b.x, b.y, b.w, b.h);
    c.fillStyle = alpha(pal.red, 0.55);
    c.fillRect(b.x, b.y, b.w * p, b.h);
    text(c, pal, ko ? `${st.len} ns 쏜 뒤 1일 확률 ${Math.round(p * 100)}%` : `chance of 1 after ${st.len} ns: ${Math.round(p * 100)}%`, b.x, b.y - 8, { size: 12, color: pal.blue });
    text(c, pal, '0', b.x, b.y + b.h + 14, { size: 11 });
    text(c, pal, '1', b.x + b.w, b.y + b.h + 14, { size: 11, align: 'right' });
    // 그래프
    const A = axes(c, pal, L.g, { x0: 0, x1: T_MAX, y0: 0, y1: 1, xt: [0, 40, 80, 120, 160], yt: [0, 0.5, 1], fx: String, fy: (v) => `${Math.round(v * 100)}%`, xl: ko ? '마이크로파를 쏜 시간 (ns) →' : 'pulse length (ns) →', yl: ko ? '100번 중 1이 나온 비율' : 'fraction of 1 in 100 shots' });
    const done = st.pts.length >= 6;
    if (done) {
      c.strokeStyle = pal.blue;
      c.lineWidth = 2;
      c.beginPath();
      for (let t = 0; t <= T_MAX; t += 1) {
        if (t === 0) c.moveTo(A.X(t), A.Y(p1(t)));
        else c.lineTo(A.X(t), A.Y(p1(t)));
      }
      c.stroke();
      text(c, pal, ko ? `파란 선: 양자역학 예측 (흐려지는 시간 ${T2_NS} ns)` : `blue line: quantum prediction (blur time ${T2_NS} ns)`, L.g.x + L.g.w, L.g.y - 10, { size: 11, align: 'right', color: pal.blue });
    }
    c.strokeStyle = alpha(pal.blue, 0.8);
    c.setLineDash([4, 4]);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(A.X(st.len), L.g.y);
    c.lineTo(A.X(st.len), L.g.y + L.g.h);
    c.stroke();
    c.setLineDash([]);
    for (const q of st.pts) dot(c, pal, A.X(q.len), A.Y(q.p), 4.5, true);
    const last = st.pts[st.pts.length - 1];
    ui.ro.set(
      ko
        ? `쏘는 시간 ${st.len} ns\n${last ? `마지막: ${last.len} ns에서 1이 ${Math.round(last.p * 100)}번` : '아직 측정 전'}\n잰 길이 ${new Set(st.pts.map((q) => q.len)).size}가지`
        : `Pulse ${st.len} ns\n${last ? `Last: ${Math.round(last.p * 100)} ones at ${last.len} ns` : 'Nothing measured yet'}\n${new Set(st.pts.map((q) => q.len)).size} lengths measured`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '4',
    ko: '큐비트로 가는 길',
    en: 'The road to the qubit',
    missions: [
      {
        id: 'c4m1',
        ko: '마이크로파를 오래 쏠수록 어떻게 될지 고른 뒤, 60 ns 넘는 범위에서 여섯 가지 이상 길이로 재라.',
        en: 'Pick what longer pulses do, then measure at six or more lengths spread over 60 ns.',
        hint_ko: '"길이를 바꿔 가며 자동으로"를 누르면 5 ns마다 잽니다.',
        hint_en: '"Step through lengths" measures every 5 ns.',
      },
      {
        id: 'c4m2',
        ko: '0을 1로 거의 완전히 뒤집는 길이를 찾아라.',
        en: 'Find the pulse length that flips 0 to 1 almost completely.',
        hint_ko: '그래프에서 처음 꼭대기 근처 길이로 손잡이를 옮겨 다시 재 보세요.',
        hint_en: 'Move the slider near the first top of the graph and measure again.',
      },
      {
        id: 'c4m3',
        ko: '아주 오래 쏘았을 때 봉우리 높이가 어떻게 되는지 보라.',
        en: 'See what happens to the peak height for very long pulses.',
        hint_ko: '100 ns 넘는 길이에서 여러 번 재고 처음 봉우리와 비교하세요.',
        hint_en: 'Measure several lengths beyond 100 ns and compare with the first peak.',
      },
    ],
    content: {
      ko: {
        observe: `<p>이 장은 수상 사유 다음에 이어진 이야기입니다. 1985년 실험이 보여 준 두 가지, 회로가 터널링을 하고 에너지가 계단처럼 나뉜다는 사실은 곧 새로운 생각으로 이어졌습니다. 골짜기의 가장 낮은 두 준위만 골라 <b>0과 1</b>로 쓰면, 손으로 설계하고 만들 수 있는 양자 비트가 됩니다.</p><p>드보레와 마르티니스는 그 뒤 초전도 큐비트 연구를 이끌었고, 오늘날 여러 양자컴퓨터 칩이 이 원리로 만들어집니다.</p><p class="q">0 상태에 마이크로파를 오래 쏠수록, 1이 나올 확률은 계속 커질까?</p>`,
        interact: '쏘는 시간을 정하고 100번 쏘아 재세요. 한 번 잴 때마다 0 아니면 1만 나오고, 100번 중 1이 나온 비율이 점으로 찍힙니다.',
        understand: `<h4>0과 1 사이의 흔들림</h4><p>두 준위 간격에 맞는 마이크로파를 쏘면 회로는 0과 1을 겹쳐 가진 상태를 지나며 흔들립니다. 이를 <b>라비 진동</b>이라 합니다.</p>$$P_1(t) = \\frac{1}{2}\\left[1 - \\cos(\\Omega t)\\,e^{-t/T_2}\\right]$$<p>$\\Omega t = \\pi$가 되는 길이로 쏘면 0이 1로 뒤집히고(π 펄스), 절반 길이로 쏘면 0과 1이 반반 섞입니다. 큐비트 연산은 이런 펄스들을 이어 붙인 것입니다.</p><h4>흐려지는 시간</h4><p>$T_2$는 양자 상태가 주변과 엮이며 흐려지는 시간입니다. 1985년 접합은 이 시간이 아주 짧았지만, 그 뒤 40년 동안 재료와 회로 설계를 바꿔 수백 배 넘게 늘렸습니다.</p><h4>실제와 다른 점</h4><p>라비 진동 빠르기(20 MHz)와 흐려지는 시간(${T2_NS} ns)은 보기 좋게 정한 값입니다. 실제 초전도 큐비트는 2장의 접합과 다른 구조(트랜스몬 등)를 많이 씁니다.</p>`,
      },
      en: {
        observe: `<p>This chapter goes beyond the prize citation. The two things the 1985 experiments showed, that the circuit tunnels and that its energy comes in steps, soon led to a new idea: pick just the two lowest levels in the dip and call them <b>0 and 1</b>, and you have a quantum bit you can design and build by hand.</p><p>Devoret and Martinis went on to lead superconducting-qubit research, and many of today's quantum computer chips work this way.</p><p class="q">If you keep shining microwaves on state 0, does the chance of reading 1 keep growing?</p>`,
        interact: 'Choose a pulse length and fire 100 times. Each readout gives only 0 or 1; the fraction of 1s appears as a point.',
        understand: `<h4>Swinging between 0 and 1</h4><p>Microwaves matched to the level gap make the circuit swing through superpositions of 0 and 1. These are <b>Rabi oscillations</b>.</p>$$P_1(t) = \\frac{1}{2}\\left[1 - \\cos(\\Omega t)\\,e^{-t/T_2}\\right]$$<p>A pulse with $\\Omega t = \\pi$ flips 0 to 1 (a π pulse); half that leaves an even mix. Qubit operations are strings of such pulses.</p><h4>The blur time</h4><p>$T_2$ is how long the quantum state lasts before it blurs into its surroundings. It was very short in the 1985 junctions; four decades of better materials and circuit design have stretched it by hundreds of times and more.</p><h4>How this differs from reality</h4><p>The Rabi rate (20 MHz) and blur time (${T2_NS} ns) are chosen for display. Real superconducting qubits mostly use designs different from the chapter 2 junction (such as the transmon).</p>`,
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
      st.len = 10;
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
