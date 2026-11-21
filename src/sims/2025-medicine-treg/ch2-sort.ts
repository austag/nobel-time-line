// 2장: 명찰을 보고 세포 골라내기 (중심 장).
// 사카구치는 1995년에 세포 표면의 CD4 와 CD25 를 명찰 삼아 T세포를 가려 담고,
// 어느 무리를 넣었을 때 병이 생기고 어느 무리가 그 병을 막는지 하나씩 확인했다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, segment, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { axes, caption, dial, dialHit, dialValue, dot, mouse, sorter, tcell, trace, type Box, type Dial } from './draw';
import { TREG_FRACTION, WEEKS, hasEffector, severity, tregFrac, type Marker, type Portion } from './model';

const PORTION_NAME: Record<Portion, [string, string]> = {
  none: ['아무것도 넣지 않음', 'nothing'],
  kept: ['담은 무리', 'the kept pile'],
  left: ['남은 무리', 'the leftover pile'],
  both: ['두 무리 모두', 'both piles'],
};
/** 생쥐 그림 아래에 쓰는 짧은 문장 */
const GIVEN: Record<Portion, [string, string]> = {
  none: ['아무것도 넣지 않음', 'given nothing'],
  kept: ['담은 무리를 넣음', 'given the kept pile'],
  left: ['남은 무리를 넣음', 'given the leftover pile'],
  both: ['두 무리를 함께 넣음', 'given both piles'],
};
const RUN_SECONDS = 2.6;

export function chapter2(): Chapter {
  let ctx: Ctx;
  const st = {
    m: 'cd4cd25' as Marker,
    p: 'left' as Portion,
    sorted: false,
    pred: null as number | null,
    phase: -1,
    week: 0,
    runs: [] as { m: Marker; p: Portion; v: number }[],
    t: 0,
    dragging: false,
  };
  let ui: { ro: ReturnType<typeof readout> };
  let dl: Dial | null = null;

  const pct = (v: number) => Math.round(v * 100);
  const pn = (p: Portion) => PORTION_NAME[p][k(ctx) ? 0 : 1];
  const curve = () => Array.from({ length: 33 }, (_, i) => severity(st.m, st.p, (i / 32) * WEEKS));

  function sort(): void {
    st.sorted = true;
    st.phase = -1;
    st.week = 0;
  }
  function run(): void {
    if (!st.sorted && st.p !== 'none') {
      ctx.host.toast(tr(ctx, '먼저 "가려내기"를 눌러 세포를 나누세요', 'Press "Sort the cells" first'));
      return;
    }
    if (st.phase >= 0) return;
    st.phase = 0;
    st.week = 0;
    if (ctx.host.reduced) finish();
  }
  function finish(): void {
    st.phase = -1;
    st.week = WEEKS;
    st.runs.push({ m: st.m, p: st.p, v: severity(st.m, st.p, WEEKS) });
    check();
  }

  function check(): void {
    const ko = k(ctx);
    const find = (m: Marker, p: Portion) => st.runs.find((r) => r.m === m && r.p === p);

    const sick = find('cd4cd25', 'left');
    if (st.pred == null) ctx.host.result('c2m1', tr(ctx, '먼저 계기판 바늘을 끌어 예상을 찍으세요', 'First drag the dial needle to make a guess'));
    else if (sick) {
      ctx.host.complete('c2m1', tr(ctx, `CD25 명찰을 뺀 무리만 넣자 자가면역 ${pct(sick.v)}% (내 예상 ${pct(st.pred)}%)`, `Leftover pile without the CD25 tag: autoimmunity ${pct(sick.v)}% (my guess ${pct(st.pred)}%)`));
      ctx.note(
        'remove',
        `CD4 와 CD25 를 명찰로 가려내고 CD25 를 뺀 나머지 무리만 가슴샘 없는 생쥐에 넣자, 8주 만에 자가면역이 ${pct(sick.v)}%까지 올라갔다 (예상 ${pct(st.pred)}%). 건강한 생쥐에서 꺼낸 세포인데도 일부를 빼내자 병을 일으킨 것이다.`,
        `Sorting on CD4 and CD25 and transferring only the leftover pile without CD25 into a mouse with no thymus drove autoimmunity to ${pct(sick.v)}% in eight weeks (I guessed ${pct(st.pred)}%). The cells came from a healthy mouse, yet removing one part of them caused disease.`,
      );
    } else ctx.host.result('c2m1', tr(ctx, 'CD4 + CD25 명찰로 가려낸 뒤 "남은 무리"를 넣어 보세요', 'Sort on CD4 + CD25, then transfer the leftover pile'));

    const saved = find('cd4cd25', 'both');
    if (saved && sick) {
      ctx.host.complete('c2m2', tr(ctx, `담은 무리를 함께 넣자 ${pct(sick.v)}% → ${pct(saved.v)}%`, `Adding the kept pile back: ${pct(sick.v)}% → ${pct(saved.v)}%`));
      ctx.note(
        'addback',
        `빼냈던 CD25 명찰을 단 세포를 함께 넣어 주자 자가면역이 ${pct(sick.v)}%에서 ${pct(saved.v)}%로 떨어졌다. 전체 CD4 세포의 약 ${Math.round(TREG_FRACTION * 100)}%뿐인 이 작은 무리가 나머지의 공격을 멈춰 세웠다.`,
        `Putting the CD25-tagged cells back brought autoimmunity down from ${pct(sick.v)}% to ${pct(saved.v)}%. This small group, only about ${Math.round(TREG_FRACTION * 100)}% of all CD4 cells, stopped the rest from attacking.`,
      );
    } else ctx.host.result('c2m2', tr(ctx, '같은 명찰로 "두 무리 모두"를 넣어 비교해 보세요', 'Transfer "both piles" with the same tags and compare'));

    const empty = find('cd4cd25', 'none') ?? find('cd4', 'none');
    if (empty && sick) {
      ctx.host.complete('c2m3', tr(ctx, `아무것도 넣지 않은 생쥐: ${pct(empty.v)}%`, `Mouse given nothing: ${pct(empty.v)}%`));
      ctx.note(
        'control',
        `아무것도 넣지 않은 생쥐는 자가면역이 ${pct(empty.v)}%에 머물렀다. 공격도 T세포가 하는 일이므로, 넣지 않으면 병도 생기지 않는다. 병은 세포가 모자라서가 아니라 멈추게 하는 쪽만 빠졌을 때 생긴다.`,
        `A mouse given nothing stayed at ${pct(empty.v)}%. The attack is itself the work of T cells, so with none transferred there is no disease: it appears only when the stopping cells alone are missing.`,
      );
    } else ctx.host.result('c2m3', tr(ctx, '"아무것도 넣지 않음"으로도 한 번 지켜보세요', 'Run once with "nothing" transferred as a control'));
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    ui = { ro: readout() };
    const mk = segment<Marker>({
      label: ko ? '볼 명찰' : 'Tags to sort on',
      options: [
        { v: 'cd4', label: 'CD4' },
        { v: 'cd4cd25', label: 'CD4 + CD25' },
      ],
      value: st.m,
      onChange: (v) => {
        st.m = v;
        st.sorted = false;
        st.week = 0;
      },
    });
    const po = segment<Portion>({
      label: ko ? '생쥐에 넣을 통' : 'Pile to transfer',
      options: (['kept', 'left', 'both', 'none'] as Portion[]).map((v) => ({ v, label: pn(v) })),
      value: st.p,
      onChange: (v) => {
        st.p = v;
        st.week = 0;
      },
    });
    ctx.host.controls.append(
      mk.el,
      stepButton({ label: ko ? '가려내기' : 'Sort the cells', onClick: sort }).el,
      po.el,
      stepButton({ label: ko ? '넣고 8주 지켜보기' : 'Transfer and watch 8 weeks', onClick: run }).el,
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
      const bench: Box = { x: 8, y: top + 4, w: W - 16, h: 142 };
      const m: Box = { x: 8, y: bench.y + bench.h + 8, w: W * 0.38, h: 68 };
      const d: Box = { x: W * 0.44, y: bench.y + bench.h + 4, w: W * 0.52, h: 76 };
      const g: Box = { x: 42, y: m.y + m.h + 48, w: W - 58, h: Math.max(84, H - m.y - m.h - 84) };
      return { W, H, narrow, top, bench, m, d, g };
    }
    const bench: Box = { x: 16, y: top + 10, w: W * 0.54, h: 180 };
    const m: Box = { x: 16, y: bench.y + bench.h + 16, w: W * 0.24, h: 96 };
    const d: Box = { x: W * 0.3, y: bench.y + bench.h + 12, w: W * 0.22, h: 102 };
    const g: Box = { x: W * 0.58 + 44, y: top + 20, w: W * 0.42 - 70, h: Math.max(120, H - top - 110) };
    return { W, H, narrow, top, bench, m, d, g };
  };

  /** 실험대: 섞인 세포 → 가려내는 장치 → 담은 통과 남은 통 */
  function bench(c: CanvasRenderingContext2D, pal: ReturnType<Ctx['pal']>, b: Box, ko: boolean): void {
    if (b.w < 460) {
      benchNarrow(c, pal, b, ko);
      return;
    }
    const colW = b.w / 3;
    const cy = b.y + b.h * 0.44;
    const r = Math.max(9, Math.min(15, b.h * 0.1));
    const both = st.m === 'cd4cd25';
    // 섞인 세포 (왼쪽)
    const mixed: { dx: number; dy: number; treg: boolean }[] = [
      { dx: -0.62, dy: -0.34, treg: false },
      { dx: 0.14, dy: -0.46, treg: true },
      { dx: 0.82, dy: -0.28, treg: false },
      { dx: -0.3, dy: 0.62, treg: false },
      { dx: 0.52, dy: 0.58, treg: false },
    ];
    for (const m of mixed) {
      tcell(c, pal, b.x + colW * 0.46 + m.dx * colW * 0.40, cy + m.dy * b.h * 0.32, r, {
        tags: m.treg ? ['CD4', 'CD25'] : ['CD4'],
        fill: m.treg ? 0.2 : 0.06,
      });
    }
    text(c, pal, ko ? '건강한 생쥐에서 꺼낸 T세포' : 'T cells from a healthy mouse', b.x + colW * 0.42, b.y + b.h - 4, { size: 11, align: 'center' });

    // 장치 (가운데)
    const sb: Box = { x: b.x + colW * 0.86, y: b.y + b.h * 0.1, w: colW * 0.5, h: b.h * 0.62 };
    sorter(c, pal, sb, st.sorted ? 1 : 0.15);
    text(c, pal, both ? 'CD4 + CD25' : 'CD4', sb.x + sb.w / 2, sb.y - 6, { size: 11, align: 'center', color: pal.blue });
    text(c, pal, st.sorted ? (ko ? '가려냄' : 'sorted') : ko ? '아직 안 가려냄' : 'not sorted yet', sb.x + sb.w / 2, b.y + b.h - 4, { size: 11, align: 'center' });

    // 두 통 (오른쪽)
    const bx = b.x + colW * 1.62;
    const bw = colW * 1.2;
    const rows: { p: Portion; label: string; tags: string[][] }[] = [
      { p: 'kept', label: ko ? '담은 무리' : 'kept pile', tags: both ? [['CD4', 'CD25']] : [['CD4'], ['CD4', 'CD25']] },
      { p: 'left', label: ko ? '남은 무리' : 'leftover pile', tags: both ? [['CD4'], ['CD4']] : [] },
    ];
    rows.forEach((row, i) => {
      const y = b.y + b.h * (0.24 + i * 0.44);
      const chosen = st.p === row.p || st.p === 'both';
      c.save();
      c.strokeStyle = chosen ? pal.blue : pal.grid;
      c.lineWidth = chosen ? 2 : 1.2;
      c.beginPath();
      c.roundRect(bx, y - b.h * 0.17, bw, b.h * 0.34, 6);
      c.stroke();
      c.restore();
      if (st.sorted) {
        row.tags.forEach((tg, j) => {
          tcell(c, pal, bx + bw * 0.26 + j * r * 2.6, y + r * 0.35, r * 0.82, { tags: tg, fill: tg.length > 1 ? 0.2 : 0.06 });
        });
        if (!row.tags.length) text(c, pal, ko ? '비어 있음' : 'empty', bx + bw * 0.3, y + 4, { size: 11 });
      }
      text(c, pal, row.label, bx + bw - 6, y - b.h * 0.17 + 13, { size: 11, align: 'right', color: chosen ? pal.blue : pal.ink });
    });
  }

  /** 좁은 화면: 세포 한 줄 → 장치와 두 통 */
  function benchNarrow(c: CanvasRenderingContext2D, pal: ReturnType<Ctx['pal']>, b: Box, ko: boolean): void {
    const both = st.m === 'cd4cd25';
    const r = Math.max(8, Math.min(12, b.w / 34));
    text(c, pal, ko ? '건강한 생쥐에서 꺼낸 T세포' : 'T cells from a healthy mouse', b.x + 2, b.y + 10, { size: 11 });
    const row = [false, true, false, false, false];
    const cw = b.w / row.length;
    row.forEach((treg, i) => {
      tcell(c, pal, b.x + cw * (i + 0.5), b.y + 48, r, { tags: treg ? ['CD4', 'CD25'] : ['CD4'], fill: treg ? 0.2 : 0.06 });
    });

    // 장치
    const sb: Box = { x: b.x + 8, y: b.y + 74, w: b.w * 0.24, h: b.h - 84 };
    sorter(c, pal, sb, st.sorted ? 1 : 0.15);
    text(c, pal, both ? 'CD4 + CD25' : 'CD4', sb.x + sb.w / 2, sb.y - 4, { size: 11, align: 'center', color: pal.blue });
    text(c, pal, st.sorted ? (ko ? '가려냄' : 'sorted') : ko ? '안 가려냄' : 'not sorted', sb.x + sb.w / 2, b.y + b.h - 2, { size: 11, align: 'center' });

    // 두 통
    const bx = sb.x + sb.w + 16;
    const bw = b.x + b.w - bx - 2;
    const rows: { p: Portion; label: string; tags: string[][] }[] = [
      { p: 'kept', label: ko ? '담은 무리' : 'kept pile', tags: both ? [['CD4', 'CD25']] : [['CD4'], ['CD4', 'CD25']] },
      { p: 'left', label: ko ? '남은 무리' : 'leftover pile', tags: both ? [['CD4'], ['CD4']] : [] },
    ];
    rows.forEach((rw, i) => {
      const y = sb.y + i * (sb.h / 2 + 2);
      const hh = sb.h / 2 - 4;
      const chosen = st.p === rw.p || st.p === 'both';
      c.save();
      c.strokeStyle = chosen ? pal.blue : pal.grid;
      c.lineWidth = chosen ? 2 : 1.2;
      c.beginPath();
      c.roundRect(bx, y, bw, hh, 6);
      c.stroke();
      c.restore();
      text(c, pal, rw.label, bx + 6, y + 13, { size: 11, color: chosen ? pal.blue : pal.ink });
      if (st.sorted) {
        if (!rw.tags.length) text(c, pal, ko ? '비어 있음' : 'empty', bx + bw - 6, y + 13, { size: 11, align: 'right' });
        else rw.tags.forEach((tg, j) => tcell(c, pal, bx + bw - 34 - j * r * 2.4, y + hh - r * 0.55, r * 0.68, { tags: tg, fill: tg.length > 1 ? 0.2 : 0.06 }));
      }
    });
  }

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
          ? '명찰로 T세포를 두 통에 가른 뒤 한 통만 넣어 봅니다.'
          : 'Sort the T cells into two piles by tag, then transfer one pile.'
        : ko
          ? '건강한 생쥐에서 꺼낸 T세포를 명찰로 가려 두 통에 나눈 뒤, 가슴샘이 없어 T세포가 하나도 없는 생쥐에 넣고 8주를 지켜봅니다.'
          : 'Sort T cells from a healthy mouse into two piles by their tags, transfer a pile into a mouse that has no thymus and therefore no T cells, and watch for eight weeks.',
      16,
      24,
      L.W - 32,
      L.narrow ? 13 : 15,
    );
    bench(c, pal, L.bench, ko);

    const w = st.phase >= 0 ? st.phase * WEEKS : st.week;
    const now = severity(st.m, st.p, w);
    if (!mouse(c, pal, L.m, { alpha: 1 - now * 0.45 })) {
      text(c, pal, ko ? '생쥐 그림을 불러오는 중' : 'loading the mouse', L.m.x + L.m.w / 2, L.m.y + L.m.h / 2, { size: 13, align: 'center' });
    }
    text(c, pal, GIVEN[st.p][ko ? 0 : 1], L.m.x + L.m.w / 2, L.m.y + L.m.h + 14, { size: 12, align: 'center' });
    if (!L.narrow) text(c, pal, ko ? `${w.toFixed(0)}주째` : `week ${w.toFixed(0)}`, L.m.x + L.m.w / 2, L.m.y + L.m.h + 30, { size: 12, align: 'center', color: pal.blue });

    dl = { cx: L.d.x + L.d.w / 2, cy: L.d.y + L.d.h * 0.86, r: Math.min(L.d.w * 0.4, L.d.h * 0.66), min: 0, max: 1, ticks: [0, 0.5, 1], fmt: (v: number) => `${Math.round(v * 100)}%` };
    dial(c, pal, dl, { value: st.week > 0 || st.phase >= 0 ? now : null, pred: st.pred, label: ko ? '8주 뒤 자가면역' : 'autoimmunity at 8 weeks', showValue: true });

    const A = axes(c, pal, L.g, {
      x0: 0,
      x1: WEEKS,
      y0: 0,
      y1: 1,
      xt: [0, 2, 4, 6, 8],
      yt: [0, 0.5, 1],
      fx: (v) => String(v),
      fy: (v) => `${Math.round(v * 100)}%`,
      xl: ko ? '세포를 넣고 지난 주 →' : 'weeks after transfer →',
      yl: ko ? '↑ 자가면역' : '↑ autoimmunity',
    });
    // 지난 측정은 흐린 선으로 남는다
    c.save();
    for (const r of st.runs) {
      c.strokeStyle = alpha(pal.ink, 0.25);
      c.lineWidth = 1.5;
      c.beginPath();
      for (let i = 0; i <= 32; i++) {
        const ww = (i / 32) * WEEKS;
        const x = A.X(ww);
        const y = A.Y(severity(r.m, r.p, ww));
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore();
    // 지금 곡선: 지켜본 데까지만
    if (w > 0) {
      c.save();
      c.strokeStyle = pal.blue;
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i <= 64; i++) {
        const ww = (i / 64) * w;
        const x = A.X(ww);
        const y = A.Y(severity(st.m, st.p, ww));
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      c.restore();
      dot(c, pal, A.X(w), A.Y(now), 5, true);
    }

    ui.ro.set(
      ko
        ? `명찰 ${st.m === 'cd4' ? 'CD4' : 'CD4 + CD25'} · ${pn(st.p)}\n${st.phase >= 0 ? '지켜보는 중' : st.week > 0 ? `8주 뒤 자가면역 ${pct(now)}%` : '아직 지켜보지 않음'} · 지금까지 ${st.runs.length}번`
        : `tags ${st.m === 'cd4' ? 'CD4' : 'CD4 + CD25'} · ${pn(st.p)}\n${st.phase >= 0 ? 'watching' : st.week > 0 ? `autoimmunity at 8 weeks ${pct(now)}%` : 'not watched yet'} · ${st.runs.length} runs so far`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '2',
    ko: '명찰을 보고 세포 골라내기',
    en: 'Sorting cells by their tags',
    missions: [
      {
        id: 'c2m1',
        ko: '자가면역이 얼마나 될지 예상한 뒤, CD25 명찰을 뺀 무리만 넣어 병을 일으켜라.',
        en: 'Guess the autoimmunity, then transfer only the pile without the CD25 tag and cause the disease.',
        hint_ko: '명찰을 CD4 + CD25 로 두고 "가려내기"를 누른 뒤, 통을 "남은 무리"로 골라 지켜보세요.',
        hint_en: 'Set the tags to CD4 + CD25, press "Sort the cells", choose the leftover pile and watch.',
      },
      {
        id: 'c2m2',
        ko: '빼냈던 CD25 무리를 함께 넣어 병이 막히는지 확인하라.',
        en: 'Put the CD25 pile back together with the rest and see whether the disease is prevented.',
        hint_ko: '같은 명찰 그대로 통을 "두 무리 모두"로 바꿔 다시 지켜보세요.',
        hint_en: 'Keep the same tags, switch the pile to "both piles" and watch again.',
      },
      {
        id: 'c2m3',
        ko: '아무것도 넣지 않은 대조군을 지켜보고, 병이 왜 생기는지 설명이 바뀌는 것을 보라.',
        en: 'Watch a control mouse given nothing, and see how it changes the explanation of the disease.',
        hint_ko: '통을 "아무것도 넣지 않음"으로 두고 지켜보세요.',
        hint_en: 'Set the pile to "nothing" and watch.',
      },
    ],
    content: {
      ko: {
        observe: `<p>1장에서 정상 생쥐의 T세포가 병을 막는다는 것까지는 알았습니다. 하지만 T세포는 한 덩어리가 아닙니다. 그 안에서 브레이크를 쥔 쪽만 가려낼 수 있을까요?</p><p>세포 표면에는 단백질이 나와 있고, 그 종류는 세포마다 다릅니다. 사람이 보기에는 세포에 붙은 <b>명찰</b>과 같아서, 명찰을 보고 세포를 통에 나눠 담을 수 있습니다. 사카구치는 도움 T세포의 명찰인 CD4 에 더해, 그 가운데 일부만 달고 있는 <b>CD25</b> 를 함께 봤습니다.</p><p>그리고 실험을 뒤집었습니다. 넣어서 병이 낫는지 보는 대신, <b>빼고 넣어서 병이 생기는지</b> 본 것입니다.</p><p class="q">브레이크를 쥔 세포는 어떤 명찰을 달고 있을까?</p>`,
        interact: '명찰을 고르고 "가려내기"를 누르면 세포가 두 통에 나뉩니다. 어느 통을 생쥐에 넣을지 고르고 8주를 지켜보세요.',
        understand: `<h4>빼서 생기는 병</h4><p>이 실험이 강한 이유는 방향에 있습니다. 건강한 생쥐에서 꺼낸 세포는 그대로 넣으면 아무 일도 일으키지 않습니다. 그런데 <b>일부를 빼내고</b> 넣으면 병이 생깁니다. 모자라서가 아니라 빠진 것이 있어서 생기는 병이라면, 빠진 그 세포가 하던 일이 바로 공격을 멈추는 일입니다.</p><p>그리고 되돌릴 수 있습니다. 빼냈던 CD25 무리를 다시 넣으면 병이 막힙니다. 빼면 생기고 넣으면 막히는 것, 이것이 "이 세포가 원인이다"라고 말할 수 있는 조건입니다.</p><h4>작은 무리가 전체를 멈춘다</h4><p>CD25 까지 단 세포는 CD4 세포의 약 ${Math.round(TREG_FRACTION * 100)}%뿐입니다. 이 체험에서는 넣은 세포 가운데 이 무리의 비율 $f$ 가 높을수록 공격이 막히는 것으로 계산합니다.</p>$$\\text{막는 정도} = 1 - \\frac{1}{1 + (f/f_{50})^{1.8}}, \\quad f_{50} = 0.015$$<p>비율이 조금만 있어도 거의 다 막히는 모양입니다. 실제로도 적은 수의 조절 T세포가 훨씬 많은 공격 세포를 억제합니다.</p><h4>왜 믿지 않았을까</h4><p>1995년 당시 많은 연구자는 가슴샘에서 걸러내는 것으로 설명이 끝났다고 보았습니다. CD25 는 활성화된 T세포에도 나타나는 명찰이라, 이 무리가 따로 있는 종류가 아니라 그냥 활성화된 세포일 뿐이라는 반론도 있었습니다. 이 논쟁은 3장에서 유전자가 나오고 나서야 정리됩니다.</p><h4>실제와 다른 점</h4><p>비율과 자가면역 지수는 모형 값입니다. 실제 실험은 생쥐 계통, 세포 수, 관찰 기간에 따라 결과가 달라집니다.</p>`,
      },
      en: {
        observe: `<p>Chapter one showed that T cells from a normal mouse prevent the disease. But T cells are not one thing. Could the ones holding the brake be picked out from the rest?</p><p>Cells carry proteins on their surface, and which ones differ from cell to cell. To us they work like <b>name tags</b>: you can read the tags and sort cells into piles. On top of CD4, the tag of helper T cells, Sakaguchi looked at <b>CD25</b>, which only some of them carry.</p><p>Then he turned the experiment around. Instead of adding cells to cure a disease, he <b>removed a part and transferred the rest</b> to see whether disease appeared.</p><p class="q">What tags do the cells holding the brake carry?</p>`,
        interact: 'Choose the tags and press "Sort the cells" to split them into two piles. Pick which pile goes into the mouse and watch for eight weeks.',
        understand: `<h4>A disease caused by taking something away</h4><p>The power of this experiment is its direction. Cells from a healthy mouse cause nothing when transferred whole. But transfer them with <b>one part removed</b> and disease follows. If the disease comes from something missing rather than something lacking in number, then what the missing cells were doing was stopping the attack.</p><p>And it is reversible: put the CD25 pile back and the disease is prevented. Removal causes it, restoration prevents it — that pair is what lets you say these cells are the cause.</p><h4>A small group stops the whole</h4><p>Cells carrying CD25 as well are only about ${Math.round(TREG_FRACTION * 100)}% of CD4 cells. Here the higher their fraction $f$ among the transferred cells, the more the attack is held back:</p>$$\\text{braking} = 1 - \\frac{1}{1 + (f/f_{50})^{1.8}}, \\quad f_{50} = 0.015$$<p>A small fraction already blocks nearly everything, and in reality too a few regulatory T cells restrain far more attacking cells.</p><h4>Why the doubt</h4><p>In 1995 most researchers thought selection in the thymus was the whole story. CD25 also appears on activated T cells, so critics argued this pile was not a separate kind of cell but merely activated ones. The argument was only settled once a gene appeared, in chapter three.</p><h4>How this differs from reality</h4><p>The fractions and autoimmunity levels are model values; real results depend on mouse strain, cell numbers and how long they are followed.</p>`,
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
      if (st.phase >= 0) {
        st.phase += dt / RUN_SECONDS;
        if (st.phase >= 1) finish();
      }
      draw();
    },
    reset() {
      st.m = 'cd4cd25';
      st.p = 'left';
      st.sorted = false;
      st.pred = null;
      st.phase = -1;
      st.week = 0;
      st.runs = [];
      panel();
      check();
    },
    leave() {
      if (st.phase >= 0) st.phase = -1;
    },
    down(p) {
      if (dl && dialHit(dl, p.x, p.y) != null) {
        st.dragging = true;
        st.pred = clamp(dialValue(dl, p.x, p.y), 0, 1);
        check();
      }
    },
    move(p) {
      if (st.dragging && dl) st.pred = clamp(dialValue(dl, p.x, p.y), 0, 1);
    },
    up() {
      if (st.dragging) {
        st.dragging = false;
        check();
      }
    },
  };
}
