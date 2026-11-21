// 1장: 브레이크가 빠진 면역.
// 갓 태어난 생쥐의 가슴샘을 떼는 시점을 바꿔 보면 3일째에 뗀 생쥐만 자기 몸을 공격한다.
// 면역세포를 없앴는데 공격이 더 심해지는 뒤집힌 결과가, 멈추게 하는 세포가 따로 있다는 생각의 출발점이 되었다.
import { clamp, text } from '../canvas';
import { readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { axes, caption, dial, dialHit, dialValue, dot, mouse, organ, type Box, type Dial } from './draw';
import { ORGANS, afterTransfer, organDamage, thymectomy, type Organ } from './model';

const ORGAN_NAME: Record<Organ, [string, string]> = {
  stomach: ['위', 'stomach'],
  thyroid: ['갑상샘', 'thyroid'],
  ovary: ['난소', 'ovary'],
};

export function chapter1(): Chapter {
  let ctx: Ctx;
  const st = {
    day: 3,
    pred: null as number | null,
    runs: new Map<number, number>(),
    transfer: false,
    transferredAt: null as number | null,
    transferValue: null as number | null,
    t: 0,
    dragging: false,
  };
  let ui: { ro: ReturnType<typeof readout>; sl?: ReturnType<typeof slider> };
  let dl: Dial | null = null;

  const idxNow = () => {
    const base = thymectomy(st.day);
    return st.transfer ? afterTransfer(base) : base;
  };
  const pct = (v: number) => Math.round(v * 100);

  function run(): void {
    const v = idxNow();
    if (st.transfer) {
      // T세포를 넣은 기록은 따로 둔다. 가슴샘만 뗀 곡선을 덮어쓰면 봉우리가 사라진다.
      st.transferredAt = st.day;
      st.transferValue = v;
    } else st.runs.set(st.day, v);
    check();
  }

  function check(): void {
    const ko = k(ctx);
    const days = [...st.runs.keys()].sort((a, b) => a - b);
    if (st.pred == null) ctx.host.result('c1m1', tr(ctx, '먼저 계기판 바늘을 끌어 예상을 찍으세요', 'First drag the dial needle to make a guess'));
    else if (days.length >= 4) {
      const worst = days.reduce((a, b) => (st.runs.get(b)! > st.runs.get(a)! ? b : a));
      ctx.host.complete(
        'c1m1',
        tr(ctx, `시점 ${days.length}개 측정, 가장 심한 날: 생후 ${worst}일 (자가면역 ${pct(st.runs.get(worst)!)}%, 내 예상 ${pct(st.pred)}%)`, `${days.length} timings measured; worst at day ${worst} (autoimmunity ${pct(st.runs.get(worst)!)}%, my guess ${pct(st.pred)}%)`),
      );
      ctx.note(
        'peak',
        `가슴샘을 떼는 시점을 ${days.length}가지로 바꿔 재자, 생후 ${worst}일째에 뗀 생쥐에서 자가면역이 ${pct(st.runs.get(worst)!)}%로 가장 심했다 (예상 ${pct(st.pred)}%). 더 일찍 떼면 T세포 자체가 거의 나오지 않고, 더 늦게 떼면 공격이 생기지 않았다.`,
        `Measuring ${days.length} different timings, mice whose thymus was removed on day ${worst} showed the worst autoimmunity at ${pct(st.runs.get(worst)!)}% (I guessed ${pct(st.pred)}%). Earlier removal left almost no T cells at all, and later removal caused no disease.`,
      );
    } else ctx.host.result('c1m1', tr(ctx, `잰 시점 ${days.length}/4`, `Timings measured ${days.length}/4`));

    const hot = [...st.runs.entries()].find(([, v]) => v > 0.5);
    if (hot) {
      const d = hot[0];
      const list = ORGANS.map((o) => `${ORGAN_NAME[o][ko ? 0 : 1]} ${pct(organDamage(d, o))}%`).join(', ');
      ctx.host.complete('c1m2', tr(ctx, `생후 ${d}일 생쥐가 공격받은 곳: ${list}`, `Day ${d} mouse attacked at: ${list}`));
      ctx.note(
        'organs',
        `생후 ${d}일에 가슴샘을 뗀 생쥐에서는 한 곳이 아니라 여러 장기가 함께 공격받았다 (${list}). 특정 침입자가 아니라 자기 몸을 가리지 않고 공격한 것이다.`,
        `In a mouse thymectomised on day ${d} several organs were attacked at once (${list}), not just one — the attack was on the body itself, not on any invader.`,
      );
    } else ctx.host.result('c1m2', tr(ctx, '자가면역이 50%를 넘는 시점을 찾아 재 보세요', 'Find and measure a timing where autoimmunity passes 50%'));

    if (st.transferredAt != null && st.transferValue != null && thymectomy(st.transferredAt) > 0.5) {
      const after = st.transferValue;
      ctx.host.complete('c1m3', tr(ctx, `정상 생쥐의 T세포를 넣자 ${pct(thymectomy(st.transferredAt))}% → ${pct(after)}%`, `Transferring normal T cells: ${pct(thymectomy(st.transferredAt))}% → ${pct(after)}%`));
      ctx.note(
        'transfer',
        `자가면역이 생긴 생쥐에 정상 생쥐의 T세포를 넣어 주자 자가면역이 ${pct(thymectomy(st.transferredAt))}%에서 ${pct(after)}%로 떨어졌다. 없어진 것을 되돌려 주면 공격이 멈추므로, T세포 가운데 공격을 멈추게 하는 쪽이 섞여 있다는 뜻이다.`,
        `Giving the sick mouse T cells from a normal mouse brought autoimmunity down from ${pct(thymectomy(st.transferredAt))}% to ${pct(after)}%. Putting back what was missing stopped the attack, so some T cells must be the ones that stop it.`,
      );
    } else ctx.host.result('c1m3', tr(ctx, '병이 생긴 생쥐에 정상 T세포를 넣고 다시 재 보세요', 'Transfer normal T cells into a sick mouse and measure again'));
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    ui = { ro: readout() };
    ui.sl = slider({
      label: ko ? '가슴샘을 떼는 시점 (생후)' : 'Thymus removed on day',
      min: 0,
      max: 10,
      step: 1,
      value: st.day,
      unit: ko ? '일' : '',
      onInput: (v) => (st.day = v),
    });
    const tf = segment<'no' | 'yes'>({
      label: ko ? '정상 생쥐의 T세포 넣기' : 'Transfer T cells from a normal mouse',
      options: [
        { v: 'no', label: ko ? '넣지 않음' : 'no' },
        { v: 'yes', label: ko ? '넣음' : 'yes' },
      ],
      value: st.transfer ? 'yes' : 'no',
      onChange: (v) => (st.transfer = v === 'yes'),
    });
    ctx.host.controls.append(
      ui.sl.el,
      tf.el,
      stepButton({ label: ko ? '떼고 8주 지켜보기' : 'Remove and watch for 8 weeks', onClick: run }).el,
      stepButton({
        label: ko ? '예상 바늘 올리기' : 'Raise the guess needle',
        onClick: () => {
          st.pred = clamp((st.pred ?? 0) + 0.1, 0, 1);
          check();
        },
      }).el,
      stepButton({
        label: ko ? '예상 바늘 내리기' : 'Lower the guess needle',
        onClick: () => {
          st.pred = clamp((st.pred ?? 0.2) - 0.1, 0, 1);
          check();
        },
      }).el,
      ui.ro.el,
    );
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 66 : 56;
    if (narrow) {
      const m: Box = { x: 10, y: top + 8, w: W * 0.44, h: 76 };
      const d: Box = { x: W * 0.5, y: top + 4, w: W * 0.46, h: 84 };
      const org: Box = { x: 10, y: top + 96, w: W - 20, h: 78 };
      const g: Box = { x: 42, y: org.y + org.h + 40, w: W - 58, h: Math.max(80, H - org.y - org.h - 76) };
      return { W, H, narrow, top, m, d, org, g };
    }
    const m: Box = { x: 20, y: top + 10, w: W * 0.26, h: 120 };
    const d: Box = { x: W * 0.3, y: top + 6, w: W * 0.2, h: 126 };
    const org: Box = { x: 20, y: top + 160, w: W * 0.48, h: 120 };
    const g: Box = { x: W * 0.56 + 44, y: top + 20, w: W * 0.44 - 72, h: Math.max(110, H - top - 110) };
    return { W, H, narrow, top, m, d, org, g };
  };

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
          ? '가슴샘을 떼는 날을 바꿔 가며 8주 뒤를 잽니다.'
          : 'Change the day the thymus comes out, then measure at eight weeks.'
        : ko
          ? '갓 태어난 생쥐의 가슴샘을 떼고 8주를 지켜봅니다. 면역세포를 만드는 기관을 없앴으니 면역이 약해지기만 할 것 같지만, 떼는 시점에 따라 결과가 달라집니다.'
          : 'Remove the thymus from a newborn mouse and watch for eight weeks. Taking out the organ that makes immune cells should only weaken immunity — but the timing changes the outcome.',
      16,
      24,
      L.W - 32,
      L.narrow ? 13 : 15,
    );

    const idx = idxNow();
    // 생쥐: 자가면역이 심할수록 흐리게 (지쳐 있는 것)
    if (!mouse(c, pal, L.m, { alpha: 1 - idx * 0.45 })) {
      text(c, pal, ko ? '생쥐 그림을 불러오는 중' : 'loading the mouse', L.m.x + L.m.w / 2, L.m.y + L.m.h / 2, { size: 13, align: 'center' });
    }
    text(c, pal, ko ? `생후 ${st.day}일에 가슴샘 제거` : `thymus removed on day ${st.day}`, L.m.x + L.m.w / 2, L.m.y + L.m.h + 16, { size: 12, align: 'center' });
    if (st.transfer) text(c, pal, ko ? '정상 T세포 넣음' : 'normal T cells given', L.m.x + L.m.w / 2, L.m.y + L.m.h + 32, { size: 12, align: 'center', color: pal.blue });

    // 예상 계기판
    dl = { cx: L.d.x + L.d.w / 2, cy: L.d.y + L.d.h * 0.86, r: Math.min(L.d.w * 0.42, L.d.h * 0.68), min: 0, max: 1, ticks: [0, 0.5, 1], fmt: (v: number) => `${Math.round(v * 100)}%` };
    dial(c, pal, dl, { value: st.runs.size ? idx : null, pred: st.pred, label: ko ? '8주 뒤 자가면역' : 'autoimmunity at 8 weeks', showValue: true });

    // 장기 세 개
    const ow = L.org.w / 3;
    ORGANS.forEach((o, i) => {
      const cx = L.org.x + ow * (i + 0.5);
      const cy = L.org.y + L.org.h * 0.44;
      const r = Math.min(ow * 0.3, L.org.h * 0.3);
      const dmg = st.transfer ? afterTransfer(organDamage(st.day, o)) : organDamage(st.day, o);
      organ(c, pal, cx, cy, r, o, dmg);
      text(c, pal, ORGAN_NAME[o][ko ? 0 : 1], cx, L.org.y + L.org.h - 14, { size: 12, align: 'center' });
      text(c, pal, `${Math.round(dmg * 100)}%`, cx, L.org.y + L.org.h, { size: 12, align: 'center', color: pal.blue });
    });

    // 그래프: 떼는 시점 → 자가면역
    const A = axes(c, pal, L.g, {
      x0: 0,
      x1: 10,
      y0: 0,
      y1: 1,
      xt: [0, 2, 4, 6, 8, 10],
      yt: [0, 0.5, 1],
      fx: (v) => String(v),
      fy: (v) => `${Math.round(v * 100)}%`,
      xl: ko ? '가슴샘을 뗀 날 (생후 일) →' : 'day of removal →',
      yl: ko ? '↑ 8주 뒤 자가면역' : '↑ autoimmunity at 8 weeks',
    });
    for (const [d, v] of st.runs) dot(c, pal, A.X(d), A.Y(v), 5, true);
    // 아직 재지 않은 시점은 점선으로만 자리 표시
    c.save();
    c.strokeStyle = pal.grid;
    c.lineWidth = 1;
    c.setLineDash([2, 4]);
    for (let d = 0; d <= 10; d++) {
      if (st.runs.has(d)) continue;
      c.beginPath();
      c.moveTo(A.X(d), A.Y(0));
      c.lineTo(A.X(d), A.Y(1));
      c.stroke();
    }
    c.setLineDash([]);
    c.restore();
    if (st.transferredAt != null && st.transferValue != null) {
      const tx = A.X(st.transferredAt);
      const ty = A.Y(st.transferValue);
      dot(c, pal, tx, ty, 5, false);
      text(c, pal, ko ? 'T세포 넣음' : 'cells given', tx + 8, ty + 4, { size: 11, color: pal.blue });
    }
    dot(c, pal, A.X(st.day), A.Y(idx), 6, false);

    ui.ro.set(
      ko
        ? `생후 ${st.day}일 제거${st.transfer ? ', 정상 T세포 넣음' : ''}\n${st.runs.size ? `지금 자가면역 ${pct(idx)}%` : '아직 지켜보지 않음'} · 잰 시점 ${st.runs.size}개`
        : `removed on day ${st.day}${st.transfer ? ', normal T cells given' : ''}\n${st.runs.size ? `autoimmunity ${pct(idx)}%` : 'not watched yet'} · ${st.runs.size} timings measured`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '1',
    ko: '브레이크가 빠진 면역',
    en: 'Immunity with no brake',
    missions: [
      {
        id: 'c1m1',
        ko: '8주 뒤 자가면역이 얼마나 될지 예상한 뒤, 떼는 시점을 네 가지 이상 바꿔 재어 가장 심한 날을 찾아라.',
        en: 'Guess the autoimmunity at eight weeks, then measure four or more removal timings and find the worst day.',
        hint_ko: '예상 바늘을 끌거나 버튼으로 올린 뒤, 손잡이로 날짜를 바꿔 "떼고 8주 지켜보기"를 여러 번 누르세요.',
        hint_en: 'Drag the guess needle (or use the buttons), then change the day and press "Remove and watch" several times.',
      },
      {
        id: 'c1m2',
        ko: '자가면역이 50%를 넘는 시점을 재고, 어느 장기들이 함께 공격받는지 확인하라.',
        en: 'Measure a timing where autoimmunity passes 50% and see which organs are attacked together.',
        hint_ko: '생후 3일 근처를 재 보세요. 화면 가운데 장기 세 개의 숫자가 함께 올라갑니다.',
        hint_en: 'Try around day 3. The three organs in the middle all rise together.',
      },
      {
        id: 'c1m3',
        ko: '병이 생긴 생쥐에 정상 생쥐의 T세포를 넣어, 자가면역이 가라앉는지 확인하라.',
        en: 'Transfer T cells from a normal mouse into a sick mouse and see whether the autoimmunity subsides.',
        hint_ko: '자가면역이 심한 날짜를 그대로 두고 "정상 T세포 넣기"를 켠 뒤 다시 지켜보세요.',
        hint_en: 'Keep the worst day, switch the transfer on and watch again.',
      },
    ],
    content: {
      ko: {
        observe: `<p>1980년대 면역학 교과서는 이렇게 설명했습니다. T세포는 가슴샘에서 자라는 동안 시험을 치르고, 자기 몸을 알아보는 세포는 거기서 걸러진다고요. 이것을 <b>중추 면역 관용</b>이라고 합니다.</p><p>그런데 이상한 실험이 있었습니다. 갓 태어난 생쥐의 가슴샘을 떼었더니, 면역이 약해지는 대신 <b>자기 몸을 공격하는 병</b>이 생긴 것입니다. 그것도 떼는 시점이 생후 3일 무렵일 때만 그랬습니다.</p><p>사카구치 시몬은 이 뒤집힌 결과를 그냥 넘기지 않았습니다. 면역세포를 없앴는데 공격이 심해졌다면, 없어진 것 중에 <b>공격을 멈추게 하는 쪽</b>이 있었다는 뜻이 아닐까?</p><p class="q">면역세포를 없앴는데 왜 공격이 더 심해질까?</p>`,
        interact: '손잡이로 가슴샘을 떼는 날을 고르고 "떼고 8주 지켜보기"를 누르세요. 먼저 계기판 바늘로 예상을 찍어 두면 결과와 나란히 볼 수 있습니다.',
        understand: `<h4>왜 3일째만 다를까</h4><p>가슴샘에서 T세포가 나오는 데는 순서가 있습니다. 공격하는 T세포가 먼저 나오고, 공격을 멈추게 하는 T세포는 조금 늦게 나옵니다.</p><p>그래서 너무 일찍 떼면 어느 쪽도 거의 나오지 않아 아무 일도 생기지 않고, 늦게 떼면 양쪽이 모두 나와 균형이 맞습니다. 그 사이의 좁은 틈, 공격하는 쪽은 이미 나왔지만 멈추게 하는 쪽은 아직 나오지 않은 시점에 떼면 브레이크 없는 면역만 남습니다.</p><h4>되돌릴 수 있다</h4><p>결정적인 것은 정상 생쥐의 T세포를 넣어 주면 병이 가라앉는다는 점입니다. 모자란 것을 채워 넣어 공격이 멈춘다면, 그 안에 멈추게 하는 세포가 들어 있다는 뜻입니다. 다만 이때까지는 그 세포가 어떤 세포인지 가려낼 방법이 없었습니다. 그것이 2장의 일입니다.</p><h4>실제와 다른 점</h4><p>시점에 따른 자가면역 정도와 장기별 숫자는 실제 관찰의 모양에 맞춘 모형 값입니다. 실제 실험에서는 생쥐 계통과 장기에 따라 발생률이 다르게 나타납니다.</p>`,
      },
      en: {
        observe: `<p>Immunology textbooks in the 1980s explained it like this: while T cells grow in the thymus they are tested, and those that recognise the body's own proteins are removed there. This is <b>central tolerance</b>.</p><p>But one experiment did not fit. When the thymus was removed from newborn mice, instead of weaker immunity the mice developed <b>disease in which they attacked their own organs</b> — and only when the thymus came out around day three.</p><p>Shimon Sakaguchi did not let that pass. If taking immune cells away made the attack worse, perhaps what was taken away included the cells that stop the attack.</p><p class="q">Why does removing immune cells make the attack worse?</p>`,
        interact: 'Pick the day the thymus comes out and press "Remove and watch for 8 weeks". Set the dial needle first so you can compare your guess with the result.',
        understand: `<h4>Why only day three</h4><p>T cells leave the thymus in an order: the attacking T cells come out first, and the ones that stop the attack come out a little later.</p><p>Remove the thymus too early and almost neither kind has left, so nothing happens. Remove it late and both are out and balanced. In the narrow window in between — attackers out, brakes not yet — what remains is immunity with no brake.</p><h4>It can be put back</h4><p>The decisive point is that T cells from a normal mouse calm the disease. If restoring what was missing stops the attack, the stopping cells must be in there. At this stage, though, there was no way to tell which cells they were. That is chapter two.</p><h4>How this differs from reality</h4><p>The autoimmunity levels and per-organ numbers are model values shaped to match the observations. In real experiments the rates differ by mouse strain and organ.</p>`,
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
      draw();
    },
    reset() {
      st.day = 3;
      st.pred = null;
      st.runs.clear();
      st.transfer = false;
      st.transferredAt = null;
      st.transferValue = null;
      panel();
      check();
    },
    down(p) {
      if (dl && dialHit(dl, p.x, p.y) != null) {
        st.dragging = true;
        st.pred = clamp(dialValue(dl, p.x, p.y), 0, 1);
        check();
      }
    },
    move(p) {
      if (st.dragging && dl) {
        st.pred = clamp(dialValue(dl, p.x, p.y), 0, 1);
      }
    },
    up() {
      if (st.dragging) {
        st.dragging = false;
        check();
      }
    },
  };
}
