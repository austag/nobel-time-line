// 1장: 빛을 쫓는 조류 (헤게만의 질문).
// 손전등으로 조류를 이끌어 보고, 사람 눈과 반응 속도를 나란히 잰 뒤, 왜 빠른지 가설을 고른다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { alga, beam, caption, chip, dial, dialHit, inBox, pulse, type Box, type Dial } from './draw';
import { ALGA_STEPS, EYE_STEPS, SPEED_RATIO, rng } from './model';

interface Cell {
  x: number; // 접시 안 위치 (-1~1)
  y: number;
  a: number; // 방향
  beat: number;
}

const N = 26;
const SPOTS = [
  { x: -0.55, y: -0.45 },
  { x: 0.55, y: 0.4 },
  { x: 0.45, y: -0.5 },
  { x: -0.5, y: 0.5 },
];
const RACE_EYE = 4; // 화면에서 사람 눈 신호가 끝까지 가는 초
const fmtX = (v: number) => (v >= 10 ? `${Math.round(v)}×` : `${Number(v.toFixed(1))}×`);

type Card = 'strong' | 'one' | 'short';
const CARDS: { id: Card; ko: string; en: string; why_ko: string; why_en: string }[] = [
  { id: 'strong', ko: '조류는 빛을 더 세게 받는다', en: 'The alga catches more light', why_ko: '빛을 세게 받으면 신호가 커질 뿐, 단계를 거치는 시간은 그대로예요.', why_en: 'More light makes a bigger signal, but each step still takes as long.' },
  { id: 'one', ko: '빛을 받는 단백질이 곧 문이다', en: 'The light sensor is the gate itself', why_ko: '', why_en: '' },
  { id: 'short', ko: '조류는 몸이 작아서 신호가 짧게 간다', en: 'The cell is tiny, so the signal travels less', why_ko: '사람 눈도 한 세포 안에서 일어나는 일이에요. 거리보다 단계 수가 문제예요.', why_en: 'In the eye this also happens inside one cell. The number of steps matters, not distance.' },
];

export function chapter1(): Chapter {
  let ctx: Ctx;
  const st = {
    cells: [] as Cell[],
    light: { x: SPOTS[0].x, y: SPOTS[0].y },
    power: 70,
    spot: 0,
    gathered: [] as { x: number; y: number }[],
    holdT: 0,
    pred: null as number | null,
    race: -1, // 진행 중이면 경과 초, 끝나면 큰 값
    raced: false,
    picked: null as Card | null,
    drag: null as null | 'light' | 'dial',
    t: 0,
    idle: 0,
    seed: 1,
  };
  let ui: { ro: ReturnType<typeof readout>; pred?: ReturnType<typeof slider> };

  function scatter(): void {
    const r = rng(31 + st.seed++);
    st.cells = Array.from({ length: N }, () => {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 0.8;
      return { x: d * Math.cos(a), y: d * Math.sin(a), a: r() * TAU, beat: r() * TAU };
    });
    st.gathered = [];
    st.holdT = 0;
  }

  // ---------- 배치 ----------
  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 62;
    if (!narrow) {
      const dw = Math.min(W * 0.5, H - top - 30);
      const dish = { cx: 20 + dw / 2, cy: top + 10 + dw / 2, r: dw / 2 };
      const colX = 40 + dw;
      const colW = W - colX - 16;
      const dr = Math.min(colW * 0.2, (H - top) * 0.13);
      const d: Dial = { cx: colX + colW / 2, cy: top + dr + 34, r: dr, min: 1, max: 100, log: true, ticks: [1, 3, 10, 30, 100], fmt: fmtX };
      const raceY = d.cy + 70;
      const race: Box = { x: colX, y: raceY, w: colW, h: Math.min(150, (H - raceY) * 0.45) };
      const cardsY = race.y + race.h + 20;
      return { W, H, narrow, top, dish, d, race, cardsY, colX, colW };
    }
    const dw = Math.min(W * 0.58, (H - top) * 0.46);
    const dish = { cx: 10 + dw / 2, cy: top + dw / 2, r: dw / 2 };
    const restW = W - dw - 20;
    const dr = Math.min(restW * 0.34, dw * 0.3);
    const d: Dial = { cx: dw + 20 + restW / 2, cy: top + dr + 30, r: dr, min: 1, max: 100, log: true, ticks: [1, 10, 100], fmt: fmtX };
    const ry = top + dw + 30;
    const race: Box = { x: 10, y: ry, w: W - 20, h: Math.max(100, Math.min(130, H - ry - 26)) };
    const cardsY = H + 100; // 좁은 화면에서는 가설을 아래 버튼으로 고른다
    return { W, H, narrow, top, dish, d, race, cardsY, colX: 10, colW: W - 20 };
  };

  const cardBoxes = () => {
    const L = lay();
    const h = L.narrow ? 30 : 34;
    return CARDS.map((cd, i) => ({ cd, b: { x: L.colX, y: L.cardsY + 26 + i * (h + 8), w: L.colW, h } as Box }));
  };

  const toDish = (p: Pt) => {
    const L = lay();
    return { x: (p.x - L.dish.cx) / L.dish.r, y: (p.y - L.dish.cy) / L.dish.r };
  };

  // ---------- 판정 ----------
  function check(): void {
    const n = st.gathered.length;
    if (n >= 2) {
      ctx.host.complete('c1m1', tr(ctx, `조류 무리를 ${n}곳으로 이끌었어요`, `Led the algae to ${n} spots`));
      ctx.note('swim', '손전등을 옮기자 클라미도모나스가 빛 쪽으로 헤엄쳐 모였다. 빛이 너무 약하면 흩어진 채 움직였다.', 'When I moved the torch, Chlamydomonas swam toward it and gathered. With too little light they kept wandering.');
    } else ctx.host.result('c1m1', tr(ctx, `모은 곳 ${n}/2`, `Spots gathered ${n}/2`));

    if (st.raced && st.pred != null) {
      ctx.host.complete('c1m2', tr(ctx, `조류가 ${SPEED_RATIO}배 넘게 빠름, 내 예상 ${fmtX(st.pred)}`, `Alga over ${SPEED_RATIO}× faster, my guess ${fmtX(st.pred)}`));
      ctx.note('speed', `조류의 빛 반응은 사람 눈보다 ${SPEED_RATIO}배 넘게 빨랐다. 처음 예상은 ${fmtX(st.pred)}였다. 사람 눈은 여러 단계를 거치지만 조류는 단계가 거의 없었다.`, `The alga answered light over ${SPEED_RATIO}× faster than the human eye; I had guessed ${fmtX(st.pred)}. The eye passes through many steps, the alga almost none.`);
    } else if (st.pred == null) ctx.host.result('c1m2', tr(ctx, '먼저 계기판 바늘을 끌어 예상을 놓으세요', 'First drag the dial needle to make a guess'));
    else ctx.host.result('c1m2', tr(ctx, '"나란히 재기"를 눌러 보세요', 'Press "Race them"'));

    if (st.picked === 'one') {
      ctx.host.complete('c1m3', tr(ctx, '빛을 받는 단백질이 곧 문', 'The light sensor is the gate'));
      ctx.note('idea', '헤게만처럼, 빛을 받는 단백질과 이온이 지나는 문이 한 몸이라고 가설을 세웠다.', 'Like Hegemann, I proposed that the light sensor and the ion gate are one and the same protein.');
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
    ui = {
      ro: readout(),
      pred: slider({
        label: ko ? '내 예상: 조류가 몇 배 빠를까' : 'My guess: how many times faster',
        min: 0,
        max: 100,
        step: 1,
        value: st.pred == null ? 0 : Math.round(50 * Math.log10(st.pred)),
        fmt: (v) => fmtX(10 ** (v / 50)),
        onInput: (v) => {
          st.pred = 10 ** (v / 50);
          check();
        },
      }),
    };
    const power = slider({
      label: ko ? '손전등 밝기' : 'Torch brightness',
      min: 0,
      max: 100,
      step: 5,
      value: st.power,
      unit: '%',
      onInput: (v) => (st.power = v),
    });
    const cards = row(
      ...CARDS.map((cd) =>
        stepButton({
          label: ko ? cd.ko : cd.en,
          onClick: () => pick(cd.id),
        }).el,
      ),
    );
    ctx.host.controls.append(
      row(
        stepButton({ label: ko ? '손전등 옮기기' : 'Move the torch', onClick: moveSpot }).el,
        stepButton({ label: ko ? '조류 흩기' : 'Scatter algae', onClick: scatter }).el,
      ),
      power.el,
      ui.pred!.el,
      stepButton({ label: ko ? '나란히 재기' : 'Race them', onClick: startRace }).el,
      cards,
      ui.ro.el,
    );
  }

  function moveSpot(): void {
    st.spot = (st.spot + 1) % SPOTS.length;
    st.light = { ...SPOTS[st.spot] };
    st.holdT = 0;
    st.idle = 0;
  }

  function startRace(): void {
    st.race = 0;
    st.idle = 0;
  }

  function pick(id: Card): void {
    st.idle = 0;
    if (!st.raced) {
      ctx.host.toast(tr(ctx, '먼저 둘의 속도를 나란히 재 보세요.', 'Race the two first.'));
      return;
    }
    st.picked = id;
    const cd = CARDS.find((c) => c.id === id)!;
    if (id !== 'one') ctx.host.toast(k(ctx) ? cd.why_ko : cd.why_en);
    check();
  }

  // ---------- 매 프레임 ----------
  function step(dt: number): void {
    if (dt === 0) return;
    const r = rng(Math.floor(st.t * 997) + 3);
    const see = st.power >= 20;
    for (const c of st.cells) {
      c.beat += dt * 14;
      const dx = st.light.x - c.x;
      const dy = st.light.y - c.y;
      const d = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      let da = ((want - c.a + Math.PI * 3) % TAU) - Math.PI;
      if (!see || d < 0.08) da = 0;
      c.a += clamp(da, -3 * dt, 3 * dt) * (st.power / 100) + (r() - 0.5) * 2.4 * dt;
      const sp = (see && d < 0.12 ? 0.04 : 0.22) * dt;
      c.x += Math.cos(c.a) * sp;
      c.y += Math.sin(c.a) * sp;
      const m = Math.hypot(c.x, c.y);
      if (m > 0.9) {
        c.x *= 0.9 / m;
        c.y *= 0.9 / m;
        c.a += Math.PI * 0.6;
      }
    }
    // 모였는지
    const near = st.cells.filter((c) => Math.hypot(c.x - st.light.x, c.y - st.light.y) < 0.3).length / N;
    if (near >= 0.7 && !st.drag) st.holdT += dt;
    else st.holdT = 0;
    if (st.holdT > 1 && !st.gathered.some((g) => Math.hypot(g.x - st.light.x, g.y - st.light.y) < 0.5)) {
      st.gathered.push({ ...st.light });
      check();
    }
    // 경주
    if (st.race >= 0 && st.race < RACE_EYE + 1) {
      st.race += dt;
      if (st.race >= RACE_EYE && !st.raced) {
        st.raced = true;
        check();
      }
    }
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
      ko ? '손전등을 끌어 조류를 이끌어 보세요. 오른쪽에서는 조류와 사람 눈 중 누가 빛에 먼저 반응하는지 잽니다.' : 'Drag the torch to lead the algae. On the right, race the alga against the human eye.',
      16,
      24,
      L.W - 32,
      L.narrow ? 13 : 15,
    );
    // 접시
    const { cx, cy, r } = L.dish;
    c.fillStyle = alpha(pal.blue, 0.05);
    c.strokeStyle = alpha(pal.ink, 0.55);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.fill();
    c.stroke();
    const lx = cx + st.light.x * r;
    const ly = cy + st.light.y * r;
    const pw = st.power / 100;
    const g = c.createRadialGradient(lx, ly, 0, lx, ly, r * 0.55);
    g.addColorStop(0, `rgba(255,214,90,${0.55 * pw})`);
    g.addColorStop(1, 'rgba(255,214,90,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.fill();
    const ar = Math.max(4, r * 0.045);
    for (const cell of st.cells) alga(c, pal, cx + cell.x * r, cy + cell.y * r, ar, cell.a, cell.beat);
    // 손전등
    c.fillStyle = pal.ink;
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(lx, ly, 9, 0, TAU);
    c.stroke();
    c.fillStyle = `rgba(255,200,60,${0.4 + 0.6 * pw})`;
    c.beginPath();
    c.arc(lx, ly, 6, 0, TAU);
    c.fill();
    text(c, pal, ko ? '손전등' : 'torch', lx, ly - 15, { size: 12, align: 'center' });
    for (const gp of st.gathered) {
      c.strokeStyle = alpha(pal.red, 0.7);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx + gp.x * r, cy + gp.y * r, r * 0.3, 0, TAU);
      c.stroke();
    }
    if (st.power < 20) text(c, pal, ko ? '빛이 너무 약해서 조류가 못 느껴요' : 'Too dim for the algae to notice', cx, cy + r + 18, { size: 12, align: 'center', color: pal.blue });
    else text(c, pal, ko ? `모은 곳 ${st.gathered.length}/2` : `gathered ${st.gathered.length}/2`, cx, cy + r + 18, { size: 12, align: 'center', color: pal.blue });

    // 계기판
    dial(c, pal, L.d, { value: st.raced ? SPEED_RATIO : null, pred: st.pred, label: ko ? '조류는 몇 배 빠를까' : 'How much faster?' });
    // 경주
    drawRace(c, L.race, ko);
    // 가설 카드
    if (st.raced) {
      text(c, pal, ko ? '왜 이렇게 빠를까? 하나를 골라 보세요.' : 'Why so fast? Pick one.', L.colX, L.cardsY + 14, { size: L.narrow ? 12 : 14, title: true });
      for (const { cd, b } of cardBoxes()) if (b.y + b.h < L.H) chip(c, pal, b, ko ? cd.ko : cd.en, st.picked === cd.id, L.narrow ? 12 : 13);
    }
    // 힌트
    if (st.idle > 5) {
      if (st.gathered.length < 2) pulse(c, pal, lx, ly, 16, st.t);
      else if (st.pred == null) pulse(c, pal, L.d.cx, L.d.cy - L.d.r * 0.5, L.d.r * 0.7, st.t);
      else if (!st.raced) pulse(c, pal, L.race.x + L.race.w / 2, L.race.y + L.race.h / 2, Math.min(L.race.w, L.race.h) * 0.45, st.t);
      else if (st.picked !== 'one') {
        const b = cardBoxes()[1].b;
        pulse(c, pal, b.x + b.w / 2, b.y + b.h / 2, b.h * 0.8, st.t);
      }
    }
    ui.ro.set(
      ko
        ? `손전등 밝기 ${st.power}%${st.power < 20 ? ' (너무 약함)' : ''}\n모은 곳 ${st.gathered.length}/2\n내 예상 ${st.pred != null ? fmtX(st.pred) : '아직'}${st.raced ? `\n실제: 조류가 ${SPEED_RATIO}배 넘게 빠름` : ''}`
        : `Torch ${st.power}%${st.power < 20 ? ' (too dim)' : ''}\nGathered ${st.gathered.length}/2\nMy guess ${st.pred != null ? fmtX(st.pred) : 'none'}${st.raced ? `\nResult: alga over ${SPEED_RATIO}× faster` : ''}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  function drawRace(c: CanvasRenderingContext2D, R: Box, ko: boolean): void {
    const pal = ctx.pal();
    const rowH = R.h / 2;
    const rows = [
      { steps: EYE_STEPS, dur: RACE_EYE, label: ko ? '사람 눈 (막대세포)' : 'Human eye (rod cell)' },
      { steps: ALGA_STEPS, dur: RACE_EYE / SPEED_RATIO, label: ko ? '조류 (눈점)' : 'Alga (eyespot)' },
    ];
    const t = st.race < 0 ? 0 : st.race;
    rows.forEach((row, ri) => {
      const y = R.y + ri * rowH + 16;
      const fs = R.w / row.steps.length < 70 ? 9 : 11;
      text(c, pal, row.label, R.x, y, { size: 12, title: true });
      const n = row.steps.length;
      const gap = 6;
      const bw = Math.min(110, (R.w - gap * (n - 1)) / n);
      const bh = Math.max(18, Math.min(28, rowH - 30));
      const by = y + 8;
      const u = clamp(t / row.dur, 0, 1);
      row.steps.forEach((s, i) => {
        const bx = R.x + i * (bw + gap);
        const lit = st.race >= 0 && u >= i / Math.max(1, n - 1) - 1e-6;
        c.fillStyle = lit ? alpha(pal.blue, 0.2) : 'transparent';
        c.strokeStyle = lit ? pal.blue : alpha(pal.ink, 0.45);
        c.lineWidth = 1.5;
        c.beginPath();
        c.roundRect(bx, by, bw, bh, 6);
        c.fill();
        c.stroke();
        text(c, pal, ko ? s.ko : s.en, bx + bw / 2, by + bh / 2 + 4, { size: fs, align: 'center', color: lit ? pal.blue : pal.ink });
      });
      // 움직이는 신호
      if (st.race >= 0) {
        const span = (n - 1) * (bw + gap);
        const sx = R.x + bw / 2 + span * u;
        c.fillStyle = pal.red;
        c.beginPath();
        c.arc(sx, by + bh + 7, 4.5, 0, TAU);
        c.fill();
        if (u >= 1) text(c, pal, ko ? '도착' : 'done', R.x + n * (bw + gap), by + bh / 2 + 4, { size: 11, color: pal.blue });
      }
    });
    if (st.race < 0) text(c, pal, ko ? '여기를 눌러 나란히 재기' : 'Tap here to race', R.x + R.w / 2, R.y + R.h + 2, { size: 12, align: 'center', color: pal.blue });
    else if (st.raced) text(c, pal, ko ? `조류가 ${SPEED_RATIO}배 넘게 먼저 도착 (화면은 느리게 보여 줌)` : `Alga arrives over ${SPEED_RATIO}× sooner (slowed down)`, R.x + R.w / 2, R.y + R.h + 2, { size: 12, align: 'center', color: pal.blue });
  }

  // ---------- 입력 ----------
  function down(p: Pt): void {
    st.idle = 0;
    const L = lay();
    const q = toDish(p);
    if (Math.hypot(q.x, q.y) < 1) {
      st.drag = 'light';
      st.light = { x: q.x, y: q.y };
      return;
    }
    const v = dialHit(L.d, p.x, p.y);
    if (v != null) {
      st.drag = 'dial';
      setPred(v);
      return;
    }
    if (inBox(L.race, p.x, p.y, 6)) {
      startRace();
      return;
    }
    if (st.raced) for (const { cd, b } of cardBoxes()) if (inBox(b, p.x, p.y)) pick(cd.id);
  }

  function setPred(v: number): void {
    st.pred = v;
    ui.pred?.set(Math.round(50 * Math.log10(v)));
    check();
  }

  function move(p: Pt): void {
    if (st.drag === 'light') {
      const q = toDish(p);
      const m = Math.hypot(q.x, q.y);
      const s = m > 0.88 ? 0.88 / m : 1;
      st.light = { x: q.x * s, y: q.y * s };
      st.holdT = 0;
    } else if (st.drag === 'dial') {
      const v = dialHit({ ...lay().d, r: lay().d.r * 3 }, p.x, p.y);
      if (v != null) setPred(v);
    }
  }

  function up(): void {
    st.drag = null;
  }

  return {
    id: '1',
    ko: '빛을 쫓는 조류',
    en: 'The light-chasing alga',
    missions: [
      {
        id: 'c1m1',
        ko: '손전등으로 조류 무리를 서로 다른 두 곳에 모아라.',
        en: 'Use the torch to gather the algae at two different spots.',
        hint_ko: '접시 안을 누르고 끌면 손전등이 따라옵니다. 조류가 다 모일 때까지 잠깐 기다리세요. "손전등 옮기기" 버튼도 있어요.',
        hint_en: 'Press and drag inside the dish to move the torch, then wait for the algae to arrive. The "Move the torch" button works too.',
      },
      {
        id: 'c1m2',
        ko: '조류가 사람 눈보다 몇 배 빠를지 예상한 뒤, 둘을 나란히 재라.',
        en: 'Guess how many times faster the alga is than the human eye, then race them.',
        hint_ko: '오른쪽 계기판의 바늘을 끌어 예상을 놓고, 아래 상자를 누르세요.',
        hint_en: 'Drag the needle on the dial, then tap the box below it.',
      },
      {
        id: 'c1m3',
        ko: '조류가 이렇게 빠른 까닭을 설명하는 가설을 골라라.',
        en: 'Pick the hypothesis that explains why the alga is so fast.',
        hint_ko: '사람 눈은 단계가 여섯 개, 조류는 두 개뿐이었어요. 단계를 줄이는 가장 쉬운 방법은 무엇일까요?',
        hint_en: 'The eye had six steps, the alga only two. What is the simplest way to cut out steps?',
      },
    ],
    content: {
      ko: {
        observe: `<p>사람의 뇌에는 신경세포가 약 900억 개 있고, 하나하나가 다른 세포 수천 개와 이어져 있습니다. 어느 세포가 기억이나 감정을 만드는지 알려면, 원하는 세포만 골라 켜고 끄는 스위치가 필요했습니다. 프랜시스 크릭은 그 스위치로 빛을 쓰면 좋겠다고 생각했지만 방법이 없었습니다.</p><p>답은 뜻밖에도 연못의 초록 조류 <b>클라미도모나스</b>에서 나왔습니다. 이 단세포 조류는 빛 쪽으로 헤엄칩니다. 페터 헤게만은 이 조류가 빛을 어떻게 느끼는지 궁금했습니다.</p><p class="q">조류는 사람 눈보다 빛에 빨리 반응할까, 느리게 반응할까?</p>`,
        interact: '손전등을 끌어 조류를 이끌고, 계기판에 예상을 놓은 뒤 두 신호를 나란히 재 보세요.',
        understand: `<h4>눈점과 두 개의 편모</h4><p>클라미도모나스에는 빨간 <b>눈점</b>이 있습니다. 빛이 눈점에 닿으면 편모가 젓는 방식이 바뀌어 몸이 빛 쪽으로 돌아섭니다. 빛이 너무 약하면 그냥 헤매고, 충분히 강하면 빛을 향해 갑니다.</p><h4>단계가 많으면 느리다</h4><p>사람 눈의 막대세포에서는 빛을 받은 로돕신이 G 단백질을 깨우고, G 단백질이 효소를 켜고, 효소가 cGMP를 줄여야 비로소 이온 채널이 닫힙니다. 단계마다 시간이 걸립니다.</p><p>헤게만이 아주 작은 전극으로 조류의 전기 신호를 재 보니, 반응이 사람 눈보다 <b>20배 넘게</b> 빨랐습니다. 그는 단 하나의 설명을 떠올렸습니다. 빛을 받는 단백질이 그대로 이온이 지나는 문이라면, 중간 단계가 필요 없습니다.</p>$$t_{\\text{반응}} \\approx \\sum_{i=1}^{n} t_i \\quad (n \\text{이 작을수록 빠름})$$<h4>실제와 다른 점</h4><p>단계와 시간은 크게 단순화했습니다. 화면의 경주는 천천히 보여 주는 것이고, 실제 반응은 밀리초 단위에서 일어납니다. 조류가 빛을 피하는 경우(너무 강한 빛)는 넣지 않았습니다.</p>`,
      },
      en: {
        observe: `<p>The human brain has about 90 billion nerve cells, each connected to thousands of others. To learn which cells make a memory or a feeling, researchers needed a switch that turns chosen cells on and off. Francis Crick hoped light could be that switch, but nobody knew how.</p><p>The answer came from a green pond alga, <b>Chlamydomonas</b>. This single cell swims toward light, and Peter Hegemann wanted to know how it senses it.</p><p class="q">Does the alga react to light faster or slower than the human eye?</p>`,
        interact: 'Drag the torch to lead the algae, set a guess on the dial, then race the two signals.',
        understand: `<h4>An eyespot and two flagella</h4><p>Chlamydomonas has a red <b>eyespot</b>. When light hits it, the beat of the two flagella changes and the cell turns toward the light. Too dim and it wanders; bright enough and it heads for the light.</p><h4>More steps, more delay</h4><p>In a rod cell of the eye, rhodopsin wakes a G protein, the G protein switches on an enzyme, the enzyme lowers cGMP, and only then does an ion channel close. Each step takes time.</p><p>When Hegemann measured the alga's electrical signal with tiny electrodes, it came <b>more than 20 times faster</b> than in the eye. He could think of one explanation: if the light-catching protein is itself the gate for ions, no middle steps are needed.</p>$$t_{\\text{response}} \\approx \\sum_{i=1}^{n} t_i \\quad (\\text{smaller } n \\text{ is faster})$$<h4>How this differs from reality</h4><p>The steps and their timing are greatly simplified. The race is shown in slow motion; the real responses happen within milliseconds. Algae swimming away from very strong light is left out.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      if (!st.cells.length) scatter();
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
      st.light = { ...SPOTS[0] };
      st.spot = 0;
      st.power = 70;
      st.pred = null;
      st.race = -1;
      st.raced = false;
      st.picked = null;
      scatter();
      panel();
      check();
    },
    down,
    move,
    up,
  };
}
