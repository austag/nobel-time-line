// 3장: 설계해서 만드는 구멍 (야기 2002, 기타가와의 유연한 틀).
// 같은 아연 덩어리 마디에 막대만 바꿔 끼워 구멍 크기와 메테인 저장량을 잰다.
// 유연한 틀은 압력을 올렸다 내리며 문턱에서 한꺼번에 열리고 닫히는 것을 본다.
import { alpha, text } from '../canvas';
import { h, readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { axes, caption, dot, type Box } from './draw';
import { GATE_CLOSE, GATE_OPEN, STRUTS, flexState, flexUptake, type Strut } from './model';

type Mode = 'design' | 'flex';
type Guess = 'same' | 'bit' | 'big';

export function chapter3(): Chapter {
  let ctx: Ctx;
  const st = {
    mode: 'design' as Mode,
    strut: 'bdc',
    guess: null as Guess | null,
    built: [] as string[],
    ch4: [] as string[],
    p: 0,
    open: false,
    trace: [] as { p: number; q: number; open: boolean }[],
    opened: null as number | null,
    closed: null as number | null,
    t: 0,
  };
  let ui: { ro: ReturnType<typeof readout> };

  const S = (id: string) => STRUTS.find((s) => s.id === id)!;
  const nm = (s: Strut) => (k(ctx) ? s.name_ko : s.name_en);

  function build(): void {
    if (!st.built.includes(st.strut)) st.built.push(st.strut);
    check();
  }
  function methane(): void {
    if (!st.built.includes(st.strut)) {
      ctx.host.toast(tr(ctx, '먼저 이 막대로 틀을 만드세요.', 'Build the frame with this strut first.'));
      return;
    }
    if (!st.ch4.includes(st.strut)) st.ch4.push(st.strut);
    check();
  }

  function setP(p: number): void {
    const was = st.open;
    st.open = flexState(p, st.open);
    if (!was && st.open) st.opened = p;
    if (was && !st.open && st.opened != null) st.closed = p;
    st.p = p;
    st.trace.push({ p, q: flexUptake(p, st.open), open: st.open });
    if (st.trace.length > 400) st.trace.shift();
    check();
  }

  function check(): void {
    const ko = k(ctx);
    const b = st.built.map(S);
    const gName = (g: Guess) => ({ same: ko ? '그대로' : 'no change', bit: ko ? '조금 커짐' : 'a little bigger', big: ko ? '크게 커짐' : 'much bigger' })[g];
    if (st.guess == null) ctx.host.result('c3m1', tr(ctx, '먼저 예상을 고르세요', 'First pick a guess'));
    else if (st.built.includes('bdc') && st.built.includes('tpdc') && b.length >= 3) {
      const a = S('bdc');
      const z = S('tpdc');
      ctx.host.complete('c3m1', tr(ctx, `벤젠 ${a.pore} Å → 터페닐 ${z.pore} Å, ${(z.pore / a.pore).toFixed(1)}배 (내 예상: ${gName(st.guess)})`, `benzene ${a.pore} Å → terphenyl ${z.pore} Å, ×${(z.pore / a.pore).toFixed(1)} (my guess: ${gName(st.guess)})`));
      ctx.note('pore', `같은 아연 덩어리 마디에 막대만 바꿔 끼우자 그물 모양은 그대로인 채 구멍이 벤젠 ${a.pore} Å에서 터페닐 ${z.pore} Å로 ${(z.pore / a.pore).toFixed(1)}배 커졌다 (예상: ${gName(st.guess)}). 구멍 크기를 만들기 전에 고를 수 있다.`, `Swapping only the strut on the same zinc-cluster node kept the net and grew the pore from ${a.pore} Å (benzene) to ${z.pore} Å (terphenyl), ×${(z.pore / a.pore).toFixed(1)} (I guessed ${gName(st.guess)}). Pore size can be chosen before making the material.`);
    } else ctx.host.result('c3m1', tr(ctx, `만든 틀 ${b.length}/3 (벤젠과 터페닐을 꼭 포함)`, `Frames built ${b.length}/3 (include benzene and terphenyl)`));

    const m = st.ch4.map(S);
    if (m.length >= 4 && st.ch4.includes('c2h4')) {
      const best = m.reduce((x, y) => (y.ch4 > x.ch4 ? y : x));
      ctx.host.complete('c3m2', tr(ctx, `가장 많이 저장한 틀: ${nm(best)} (IRMOF-${best.irmof}) ${best.ch4} cm³/cm³`, `Best: ${nm(best)} (IRMOF-${best.irmof}) ${best.ch4} cm³/cm³`));
      ctx.note('methane', `막대 ${m.length}종으로 만든 틀의 메테인 저장량(상온, 36기압)을 비교하자 막대가 ${nm(best)}인 IRMOF-${best.irmof}가 ${best.ch4} cm³/cm³로 가장 많았다. 구멍이 너무 크면 가운데 분자가 벽의 힘을 못 느끼므로, 알맞은 크기와 벽 성질이 중요하다.`, `Comparing methane storage (room temperature, 36 atm) across ${m.length} struts, IRMOF-${best.irmof} (strut: ${nm(best)}) held the most, ${best.ch4} cm³/cm³. In pores that are too big, molecules in the middle feel no wall, so the right size and wall chemistry matter.`);
    } else ctx.host.result('c3m2', tr(ctx, `메테인을 잰 틀 ${m.length}/4 (고리 곁가지가 붙은 것을 꼭 포함)`, `Frames tested for methane ${m.length}/4 (include the fused-ring side group)`));

    if (st.opened != null && st.closed != null) {
      ctx.host.complete('c3m3', tr(ctx, `열린 압력 ${st.opened.toFixed(2)}, 닫힌 압력 ${st.closed.toFixed(2)}`, `Opened at ${st.opened.toFixed(2)}, closed at ${st.closed.toFixed(2)}`));
      ctx.note('flex', `유연한 틀은 상대 압력 ${st.opened.toFixed(2)}에서 한꺼번에 열리며 흡착량이 계단처럼 뛰었고, 압력을 내리자 그보다 낮은 ${st.closed.toFixed(2)}에서야 닫혔다. 기체가 들어가며 얻는 에너지가 틀을 벌리는 데 드는 에너지를 넘는 순간 모양이 바뀐다.`, `The flexible frame opened all at once at relative pressure ${st.opened.toFixed(2)}, uptake jumping like a step, and on the way down closed only at ${st.closed.toFixed(2)}. It changes shape when the energy gained by guests exceeds the cost of opening it.`);
    } else ctx.host.result('c3m3', tr(ctx, '유연한 틀에서 압력을 끝까지 올렸다가 다시 0 근처까지 내리세요', 'With the flexible frame, raise the pressure all the way, then bring it back near 0'));
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
    const mode = segment<Mode>({
      label: ko ? '실험' : 'Experiment',
      options: [
        { v: 'design', label: ko ? '막대 바꿔 설계하기 (야기)' : 'Design by struts (Yaghi)' },
        { v: 'flex', label: ko ? '유연한 틀 (기타가와)' : 'Flexible frame (Kitagawa)' },
      ],
      value: st.mode,
      onChange: (v) => {
        st.mode = v;
        panel();
      },
    });
    ctx.host.controls.append(mode.el);
    if (st.mode === 'design') {
      const g = segment<Guess>({
        label: ko ? '내 예상: 막대를 벤젠 고리 1개에서 3개 길이로 바꾸면 구멍은?' : 'My guess: going from a 1-ring to a 3-ring strut, the pore…',
        options: [
          { v: 'same', label: ko ? '그대로' : 'no change' },
          { v: 'bit', label: ko ? '조금 커짐' : 'a little bigger' },
          { v: 'big', label: ko ? '크게 커짐' : 'much bigger' },
        ],
        value: st.guess ?? ('' as Guess),
        onChange: (v) => ((st.guess = v), check()),
      });
      const sel = h('select', { id: 'strut-sel', style: 'min-height:44px;border:2px solid var(--ink);background:var(--surface);color:var(--ink);font:inherit;padding:0 10px' }, STRUTS.map((x) => h('option', { value: x.id }, `${nm(x)} (IRMOF-${x.irmof})`))) as HTMLSelectElement;
      sel.value = st.strut;
      sel.addEventListener('change', () => (st.strut = sel.value));
      const s = h('div', { class: 'ctl' }, h('label', { class: 'ctl-row', for: 'strut-sel' }, h('span', null, ko ? '연결 막대 (마디는 모두 Zn₄O 덩어리)' : 'Strut (all on Zn₄O cluster nodes)')), sel);
      ctx.host.controls.append(g.el, s, row(stepButton({ label: ko ? '만들고 구멍 재기' : 'Build and measure pore', onClick: build }).el, stepButton({ label: ko ? '메테인 저장량 재기' : 'Measure methane storage', onClick: methane }).el));
    } else {
      const p = slider({
        label: ko ? '기체 상대 압력 (올렸다가 내려 보세요)' : 'Relative gas pressure (raise, then lower)',
        min: 0,
        max: 0.8,
        step: 0.01,
        value: st.p,
        fmt: (v) => v.toFixed(2),
        onInput: setP,
      });
      ctx.host.controls.append(p.el, row(stepButton({ label: ko ? '기록 지우기' : 'Clear trace', onClick: () => ((st.trace = []), (st.opened = null), (st.closed = null), setP(0)) }).el));
    }
    ctx.host.controls.append(ui.ro.el);
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 58;
    const leftW = narrow ? W : W * 0.45;
    if (narrow) {
      const cell: Box = { x: 10, y: top + 34, w: W * 0.46, h: Math.min(W * 0.46, 170) };
      const g1: Box = { x: W * 0.5 + 36, y: top + 34, w: W * 0.5 - 48, h: cell.h - 20 };
      const g2: Box = { x: 48, y: cell.y + cell.h + 44, w: W - 64, h: Math.max(90, H - cell.y - cell.h - 100) };
      return { W, H, narrow, cell, g1, g2 };
    }
    const cell: Box = { x: 30, y: top + 40, w: leftW - 60, h: Math.min(leftW - 60, H - top - 120) };
    const gh = (H - top - 170) / 2;
    const g1: Box = { x: leftW + 60, y: top + 40, w: W - leftW - 84, h: gh };
    const g2: Box = { x: g1.x, y: g1.y + gh + 70, w: g1.w, h: gh };
    return { W, H, narrow, cell, g1, g2 };
  };

  /** 정육면체 칸 하나: 모서리에 아연 덩어리, 변에 막대 */
  function cellDraw(c: CanvasRenderingContext2D, B: Box, s: Strut): void {
    const pal = ctx.pal();
    const len = 0.32 + 0.16 * s.rings;
    const a = Math.min(B.w, B.h) * len;
    const d = a * 0.45;
    const x0 = B.x + (B.w - a - d) / 2;
    const y0 = B.y + d + (B.h - a - d) / 2;
    const P = [
      [x0, y0],
      [x0 + a, y0],
      [x0 + a, y0 + a],
      [x0, y0 + a],
    ];
    const Q = P.map(([x, y]) => [x + d, y - d]);
    c.save();
    c.strokeStyle = pal.blue;
    c.lineWidth = 3;
    const edge = (p: number[], q: number[]) => {
      c.beginPath();
      c.moveTo(p[0], p[1]);
      c.lineTo(q[0], q[1]);
      c.stroke();
      // 벤젠 고리
      const n = Math.max(1, Math.round(s.rings));
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        const cx = p[0] + (q[0] - p[0]) * t;
        const cy = p[1] + (q[1] - p[1]) * t;
        c.lineWidth = 1.5;
        c.beginPath();
        for (let j = 0; j <= 6; j++) {
          const th = (j / 6) * Math.PI * 2 + Math.PI / 6;
          const r = Math.min(10, a * 0.06);
          if (j) c.lineTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r);
          else c.moveTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r);
        }
        c.stroke();
        if (s.side && i === 0) {
          c.fillStyle = pal.red;
          c.beginPath();
          c.arc(cx + 8, cy - 8, 4, 0, Math.PI * 2);
          c.fill();
        }
        c.lineWidth = 3;
      }
    };
    for (let i = 0; i < 4; i++) {
      edge(P[i], P[(i + 1) % 4]);
      edge(Q[i], Q[(i + 1) % 4]);
      edge(P[i], Q[i]);
    }
    c.fillStyle = pal.red;
    for (const [x, y] of [...P, ...Q]) c.fillRect(x - 8, y - 8, 16, 16);
    // 구멍 크기 표시
    c.strokeStyle = alpha(pal.red, 0.6);
    c.setLineDash([4, 4]);
    c.beginPath();
    c.arc(x0 + a / 2 + d / 2, y0 + a / 2 - d / 2, a * (s.pore / 22) * 0.45, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    if (st.mode === 'design') {
      caption(c, pal, ko ? '빨간 네모는 Zn₄O 덩어리 마디, 파란 선은 연결 막대입니다. 그물 모양은 그대로 두고 막대만 바꾸면 칸의 크기가 바뀝니다. 점선 원은 구멍입니다.' : 'Red squares are Zn₄O cluster nodes, blue lines are struts. Keep the net, swap only the strut, and the cell size changes. The dashed circle is the pore.', 16, 24, L.W - 32, L.narrow ? 13 : 15);
      const s = S(st.strut);
      cellDraw(c, L.cell, s);
      text(c, pal, `${nm(s)}, IRMOF-${s.irmof}${s.side ? ` (${s.side})` : ''}`, L.cell.x, L.cell.y - 12, { size: 14, title: true });
      text(c, pal, st.built.includes(s.id) ? (ko ? `구멍 약 ${s.pore} Å` : `pore about ${s.pore} Å`) : ko ? '아직 만들지 않음' : 'not built yet', L.cell.x, L.cell.y + L.cell.h + 20, { size: 13, color: pal.blue });
      // 구멍 크기 막대그래프
      const b = st.built.map(S).sort((x, y) => x.pore - y.pore);
      const A = axes(c, pal, L.g1, { x0: 0, x1: Math.max(1, b.length), y0: 0, y1: 25, xt: [], yt: [0, 10, 20], fx: () => '', fy: String, xl: '', yl: ko ? '구멍 지름 (Å)' : 'pore diameter (Å)' });
      b.forEach((x, i) => {
        const bw = (L.g1.w / Math.max(1, b.length)) * 0.6;
        const bx = A.X(i + 0.2);
        c.fillStyle = x.id === st.strut ? pal.red : alpha(pal.red, 0.45);
        c.fillRect(bx, A.Y(x.pore), bw, L.g1.y + L.g1.h - A.Y(x.pore));
        text(c, pal, `${x.irmof}`, bx + bw / 2, L.g1.y + L.g1.h + 15, { size: 11, align: 'center' });
      });
      text(c, pal, ko ? '아래 숫자: IRMOF 번호' : 'numbers: IRMOF', L.g1.x + L.g1.w, L.g1.y + L.g1.h + 32, { size: 11, align: 'right' });
      // 메테인
      const m = st.ch4.map(S).sort((x, y) => x.pore - y.pore);
      const B2 = axes(c, pal, L.g2, { x0: 8, x1: 23, y0: 0, y1: 180, xt: [10, 15, 20], yt: [0, 50, 100, 150], fx: String, fy: String, xl: ko ? '구멍 지름 (Å) →' : 'pore diameter (Å) →', yl: ko ? '메테인 저장량 (cm³/cm³, 상온 36기압)' : 'methane storage (cm³/cm³, 36 atm)' });
      m.forEach((x) => {
        dot(c, pal, B2.X(x.pore), B2.Y(x.ch4), 5, true);
        text(c, pal, `${x.irmof}`, B2.X(x.pore) + 8, B2.Y(x.ch4) - 6, { size: 11 });
      });
      if (m.some((x) => x.id === 'c2h4')) text(c, pal, ko ? 'IRMOF-6의 155는 2002년 논문 값' : 'IRMOF-6’s 155 is the 2002 paper value', L.g2.x + L.g2.w, L.g2.y - 10, { size: 11, align: 'right', color: pal.blue });
    } else {
      caption(c, pal, ko ? '이 틀은 비어 있을 때 구멍이 닫힌 모양이 더 안정합니다. 기체 압력을 천천히 올렸다가 내려 보세요.' : 'When empty, this frame is most stable with its pores closed. Raise the gas pressure slowly, then lower it.', 16, 24, L.W - 32, L.narrow ? 13 : 15);
      // 틀 그림: 닫힘은 납작한 마름모, 열림은 네모
      const B = L.cell;
      const cx = B.x + B.w / 2;
      const cy = B.y + B.h / 2;
      const o = st.open ? 1 : 0.25;
      const w = B.w * 0.18;
      c.save();
      c.strokeStyle = pal.blue;
      c.lineWidth = 3;
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const x = cx + i * w * 1.6;
          const y = cy + j * w * (0.6 + o);
          c.beginPath();
          c.moveTo(x - w * 0.8, y);
          c.lineTo(x, y - w * 0.5 * (0.3 + o));
          c.lineTo(x + w * 0.8, y);
          c.lineTo(x, y + w * 0.5 * (0.3 + o));
          c.closePath();
          c.stroke();
          if (st.open) {
            c.strokeStyle = pal.red;
            c.lineWidth = 1.5;
            for (let q = 0; q < Math.round(flexUptake(st.p, true) * 3); q++) {
              c.beginPath();
              c.arc(x - 6 + q * 6, y, 3, 0, Math.PI * 2);
              c.stroke();
            }
            c.strokeStyle = pal.blue;
            c.lineWidth = 3;
          }
        }
      c.restore();
      text(c, pal, st.open ? (ko ? '열림: 기체가 구멍에 들어감' : 'open: gas fills the pores') : ko ? '닫힘: 구멍이 납작함' : 'closed: pores squashed', B.x, B.y + B.h + 20, { size: 13, color: pal.blue });
      const G = axes(c, pal, L.narrow ? L.g2 : { x: L.g1.x, y: L.g1.y, w: L.g1.w, h: L.g1.h * 2 + 70 }, { x0: 0, x1: 0.8, y0: 0, y1: 1, xt: [0, 0.2, 0.4, 0.6, 0.8], yt: [0, 0.5, 1], fx: (v) => v.toFixed(1), fy: (v) => v.toFixed(1), xl: ko ? '상대 압력 →' : 'relative pressure →', yl: ko ? '흡착량 (최대를 1로)' : 'uptake (max = 1)' });
      c.strokeStyle = alpha(pal.ink, 0.4);
      c.setLineDash([3, 3]);
      for (const p of [GATE_OPEN, GATE_CLOSE]) {
        c.beginPath();
        c.moveTo(G.X(p), G.b.y);
        c.lineTo(G.X(p), G.b.y + G.b.h);
        c.stroke();
      }
      c.setLineDash([]);
      st.trace.forEach((d) => dot(c, pal, G.X(d.p), G.Y(d.q), 3, d.open));
      dot(c, pal, G.X(st.p), G.Y(flexUptake(st.p, st.open)), 6, true);
    }
    const s = S(st.strut);
    ui.ro.set(
      st.mode === 'design'
        ? ko
          ? `막대: ${nm(s)} (IRMOF-${s.irmof})\n만든 틀 ${st.built.length}종, 메테인 잰 틀 ${st.ch4.length}종`
          : `Strut: ${nm(s)} (IRMOF-${s.irmof})\n${st.built.length} frames built, ${st.ch4.length} tested for methane`
        : ko
          ? `상대 압력 ${st.p.toFixed(2)}, 틀 ${st.open ? '열림' : '닫힘'}${st.opened != null ? `\n열린 압력 ${st.opened.toFixed(2)}` : ''}${st.closed != null ? `, 닫힌 압력 ${st.closed.toFixed(2)}` : ''}`
          : `Relative pressure ${st.p.toFixed(2)}, frame ${st.open ? 'open' : 'closed'}${st.opened != null ? `\nOpened at ${st.opened.toFixed(2)}` : ''}${st.closed != null ? `, closed at ${st.closed.toFixed(2)}` : ''}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '3',
    ko: '설계해서 만드는 구멍',
    en: 'Pores by design',
    missions: [
      {
        id: 'c3m1',
        ko: '막대 길이를 바꾸면 구멍이 어떻게 될지 예상한 뒤, 벤젠과 터페닐을 포함해 세 가지 이상 막대로 틀을 만들어 구멍을 재라.',
        en: 'Guess how strut length changes the pore, then build frames with three or more struts, including benzene and terphenyl, and measure.',
        hint_ko: '막대를 고르고 "만들고 구멍 재기"를 누르세요. 막대마다 반복합니다.',
        hint_en: 'Pick a strut and press "Build and measure pore" for each.',
      },
      {
        id: 'c3m2',
        ko: '네 가지 이상 틀의 메테인 저장량을 재서 가장 많이 저장하는 틀을 찾아라.',
        en: 'Measure methane storage in four or more frames and find the best one.',
        hint_ko: '곁가지가 붙은 막대도 꼭 만들어 재 보세요. 구멍이 클수록 좋은 것은 아닙니다.',
        hint_en: 'Include struts with side groups; bigger pores are not always better.',
      },
      {
        id: 'c3m3',
        ko: '유연한 틀에 기체 압력을 올렸다 내리며, 열리는 압력과 닫히는 압력을 찾아라.',
        en: 'Raise and lower the gas pressure on the flexible frame and find where it opens and closes.',
        hint_ko: '실험을 "유연한 틀"로 바꾸고 압력 손잡이를 끝까지 올렸다가 천천히 내리세요.',
        hint_en: 'Switch to "Flexible frame", push the pressure to the top, then lower it slowly.',
      },
    ],
    content: {
      ko: {
        observe: `<p>비워도 버티는 틀이 생기자 다음 질문이 나왔습니다. <b>구멍의 크기와 성질을 만들기 전에 정할 수 있을까?</b> 제올라이트는 합성 결과를 미리 알기 어려웠지만, MOF는 마디와 막대를 고르는 설계로 만들 수 있지 않을까요?</p><p>2002년 야기 연구진은 MOF-5와 같은 그물 모양을 유지한 채 막대만 바꾼 틀 16종을 만들었습니다(같은 그물 계열, IRMOF). 곁가지(–Br, –NH₂ 등)를 붙이거나 더 긴 막대(바이페닐, 파이렌, 터페닐 등)로 바꿔, 구멍이 3.8 Å에서 28.8 Å까지 단계적으로 바뀌었습니다.</p><p>한편 기타가와는 거꾸로 생각했습니다. 단단하지 않다는 약점을 살려, 기체가 들어오면 모양이 바뀌는 <b>유연한 틀</b>을 만들었지요.</p><p class="q">막대를 벤젠 고리 1개에서 3개 길이로 늘리면 구멍은 얼마나 커질까?</p>`,
        interact: '막대를 바꿔 틀을 만들고 구멍과 메테인 저장량을 재세요. 그다음 "유연한 틀"로 바꿔 압력을 올렸다 내려 보세요.',
        understand: `<h4>같은 그물, 다른 크기</h4><p>마디의 방향(그물 모양)을 그대로 두고 막대 길이만 바꾸면, 같은 그물이 크기만 달라집니다. 막대가 길어진 만큼 칸의 한 변이 길어지고 구멍도 커집니다. 곁가지는 크기와 함께 구멍 벽의 성질을 바꿉니다. 실제로는 긴 막대에서 그물 두 개가 서로 꿰어 들어가기도 합니다.</p><h4>메테인은 왜 알맞은 크기를 좋아할까</h4><p>기체 분자는 벽 가까이에서 에너지가 낮아집니다. 구멍이 분자 몇 개 크기면 양쪽 벽의 끌어당김이 겹쳐 더 단단히 붙지만, 너무 크면 가운데 분자는 벽의 힘을 못 느낍니다. 2002년 논문에서 고리 곁가지가 붙은 IRMOF-6는 상온 36기압에서 155 cm³/cm³의 메테인을 저장했습니다.</p><h4>유연한 틀의 계단과 이력</h4><p>틀의 일부가 회전하거나 미끄러질 수 있으면, 비었을 때는 닫힌 모양이 안정합니다. 압력이 문턱을 넘으면 기체가 들어가며 얻는 에너지가 틀을 벌리는 에너지보다 커져 한꺼번에 열리고 흡착량이 계단처럼 뜁니다.</p>$$\\Delta G_{\\text{흡착}}(p) + \\Delta G_{\\text{틀 변형}} < 0 \\;\\Rightarrow\\; \\text{열림}$$<p>압력을 내릴 때는 이미 열린 틀이 버티다 더 낮은 압력에서 닫혀, 올릴 때와 내릴 때의 길이 다릅니다(이력).</p><h4>실제와 다른 점</h4><p>IRMOF-6의 메테인 저장량(155)과 구멍 범위(3.8~28.8 Å)는 논문 값이고, 나머지 틀의 구멍 크기와 저장량, 유연한 틀의 문턱은 모형 값입니다.</p>`,
      },
      en: {
        observe: `<p>Once frames survived emptying, the next question arose: <b>can the size and character of the pores be chosen before making the material?</b> Zeolite synthesis was hard to predict, but perhaps MOFs could be designed by choosing nodes and struts.</p><p>In 2002 Yaghi's team made 16 frames with MOF-5's net, changing only the strut (an isoreticular series, IRMOFs). With side groups (–Br, –NH₂ and more) or longer struts (biphenyl, pyrene, terphenyl and others), the pore stepped from 3.8 Å to 28.8 Å.</p><p>Kitagawa turned weakness into strength: <b>flexible frames</b> that change shape when gas comes in.</p><p class="q">Lengthen the strut from one benzene ring to three: how much bigger does the pore get?</p>`,
        interact: 'Build frames with different struts and measure pore size and methane storage. Then switch to "Flexible frame" and raise and lower the pressure.',
        understand: `<h4>Same net, different size</h4><p>Keep the node directions (the net) and change only the strut length, and the same net scales. Longer struts make longer cell edges and bigger pores; side groups change the wall chemistry too. With long struts, real crystals sometimes form two interwoven nets.</p><h4>Why methane likes the right size</h4><p>Gas molecules have lower energy near a wall. In a pore a few molecules wide, attraction from both walls overlaps and holds them tighter; in a pore that is too big, molecules in the middle feel no wall. In the 2002 paper IRMOF-6, with a fused-ring side group, stored 155 cm³/cm³ of methane at 36 atm and room temperature.</p><h4>Steps and hysteresis in flexible frames</h4><p>If parts of the frame can rotate or slide, the closed shape is more stable when empty. Past a threshold pressure the energy gained by guests exceeds the cost of opening, so it opens all at once and uptake jumps:</p>$$\\Delta G_{\\text{ads}}(p) + \\Delta G_{\\text{frame}} < 0 \\;\\Rightarrow\\; \\text{open}$$<p>On the way down the open frame holds on and closes at a lower pressure, so the paths up and down differ (hysteresis).</p><h4>How this differs from reality</h4><p>IRMOF-6’s methane uptake (155) and the pore range (3.8 to 28.8 Å) are paper values; other pore sizes, uptakes and the flexible frame’s thresholds are model values.</p>`,
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
      st.mode = 'design';
      st.strut = 'bdc';
      st.guess = null;
      st.built = [];
      st.ch4 = [];
      st.p = 0;
      st.open = false;
      st.trace = [];
      st.opened = null;
      st.closed = null;
      panel();
      check();
    },
  };
}
