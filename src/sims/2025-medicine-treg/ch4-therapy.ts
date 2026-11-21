// 4장: 더 밟을까, 풀어 줄까 (그 뒤의 이야기).
// 2003년에 Foxp3 가 조절 T세포를 만드는 스위치임이 밝혀졌다.
// 그 뒤 치료는 두 방향으로 갈라졌다. 암에서는 브레이크를 풀고, 자가면역과 이식에서는 더 밟는다.
import { alpha, clamp, text } from '../canvas';
import { readout, segment, slider, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { axes, caption, dot, tcell, type Box } from './draw';
import { DAMAGE_GOAL, TUMOR_GOAL, selfDamage, tregFromFoxp3, tumor } from './model';

type Scene = 'cancer' | 'auto';

export function chapter4(): Chapter {
  let ctx: Ctx;
  const st = {
    foxp3: true,
    r: 0.1,
    scene: 'cancer' as Scene,
    sawOff: false,
    sawOn: false,
    bestTumor: 1,
    bestDamage: 1,
    tried: [] as { r: number; tu: number; dm: number }[],
    t: 0,
  };
  let ui: { ro: ReturnType<typeof readout> };

  const rNow = () => tregFromFoxp3(st.foxp3, st.r);
  const pct = (v: number) => Math.round(v * 100);

  function record(): void {
    const r = rNow();
    const tu = tumor(r);
    const dm = selfDamage(r);
    st.bestTumor = Math.min(st.bestTumor, tu);
    st.bestDamage = Math.min(st.bestDamage, dm);
    st.tried.push({ r, tu, dm });
    if (st.foxp3) st.sawOn = true;
    else st.sawOff = true;
    check();
  }

  function check(): void {
    const ko = k(ctx);
    if (st.sawOn && st.sawOff) {
      ctx.host.complete('c4m1', tr(ctx, `Foxp3 를 끄면 조절 T세포 ${pct(tregFromFoxp3(false, st.r))}%, 켜면 ${pct(st.r)}%`, `Foxp3 off: ${pct(tregFromFoxp3(false, st.r))}% regulatory T cells; on: ${pct(st.r)}%`));
      ctx.note(
        'switch',
        `Foxp3 를 끄자 조절 T세포가 거의 만들어지지 않았고, 켜자 다시 만들어졌다. 2003년에 밝혀진 대로 이 유전자가 브레이크를 쥔 세포를 만드는 스위치다.`,
        `With Foxp3 off almost no regulatory T cells were made, and with it on they came back. As shown in 2003, this gene is the switch that builds the cells holding the brake.`,
      );
    } else ctx.host.result('c4m1', tr(ctx, 'Foxp3 를 껐다 켜 보세요', 'Switch Foxp3 off and on again'));

    if (st.bestTumor <= TUMOR_GOAL) {
      ctx.host.complete('c4m2', tr(ctx, `브레이크를 풀어 종양 ${pct(st.bestTumor)}% (목표 ${pct(TUMOR_GOAL)}% 이하)`, `Brake released: tumour ${pct(st.bestTumor)}% (goal ${pct(TUMOR_GOAL)}% or less)`));
      ctx.note(
        'cancer',
        `종양이 끌어모은 조절 T세포를 줄여 브레이크를 풀자 종양이 ${pct(st.bestTumor)}%까지 작아졌다. 종양은 이 세포를 불러 모아 면역의 공격을 피하고 있었다.`,
        `Cutting back the regulatory T cells the tumour had gathered released the brake and shrank the tumour to ${pct(st.bestTumor)}%. The tumour had been recruiting those cells to shelter from the immune attack.`,
      );
    } else ctx.host.result('c4m2', tr(ctx, `가장 작았던 종양 ${pct(st.bestTumor)}% — ${pct(TUMOR_GOAL)}% 아래로`, `Smallest tumour so far ${pct(st.bestTumor)}% — get below ${pct(TUMOR_GOAL)}%`));

    const both = st.tried.find((x) => x.tu <= TUMOR_GOAL && x.dm <= DAMAGE_GOAL);
    if (st.bestDamage <= DAMAGE_GOAL) {
      const msg = both
        ? tr(ctx, '두 조건을 한꺼번에 맞춤', 'Met both at once')
        : tr(ctx, `브레이크를 더 밟아 손상 ${pct(st.bestDamage)}%, 다만 같은 설정으로 종양까지 줄이지는 못함`, `Brake pressed harder: damage ${pct(st.bestDamage)}%, but no single setting also shrank the tumour`);
      ctx.host.complete('c4m3', msg);
      ctx.note(
        'auto',
        `조절 T세포를 늘려 브레이크를 더 밟자 자기 몸이 받는 손상이 ${pct(st.bestDamage)}%까지 줄었다. 그러나 같은 설정에서 종양은 오히려 커졌다. 한쪽을 좋게 하면 다른 쪽이 나빠지므로, 치료는 온몸의 브레이크를 통째로 조이거나 푸는 대신 필요한 곳에만 손대는 쪽으로 간다.`,
        `Raising the regulatory T cells pressed the brake harder and brought self damage down to ${pct(st.bestDamage)}%, but at the same setting the tumour grew. Improving one side worsens the other, so treatments aim at the place that needs it rather than tightening or releasing the body's whole brake.`,
      );
    } else ctx.host.result('c4m3', tr(ctx, `가장 작았던 손상 ${pct(st.bestDamage)}% — ${pct(DAMAGE_GOAL)}% 아래로`, `Smallest damage so far ${pct(st.bestDamage)}% — get below ${pct(DAMAGE_GOAL)}%`));
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    ui = { ro: readout() };
    const sc = segment<Scene>({
      label: ko ? '환자 상황' : 'Patient situation',
      options: [
        { v: 'cancer', label: ko ? '암' : 'cancer' },
        { v: 'auto', label: ko ? '자가면역과 이식' : 'autoimmunity and transplant' },
      ],
      value: st.scene,
      onChange: (v) => (st.scene = v),
    });
    const fx = toggle({
      label: 'Foxp3',
      on: st.foxp3,
      onText: ko ? '켜짐' : 'on',
      offText: ko ? '꺼짐' : 'off',
      onChange: (v) => {
        st.foxp3 = v;
        record();
      },
    });
    const sl = slider({
      label: ko ? '조절 T세포 비율' : 'Regulatory T cell fraction',
      min: 1,
      max: 30,
      step: 1,
      value: Math.round(st.r * 100),
      unit: '%',
      onInput: (v) => {
        st.r = v / 100;
        record();
      },
    });
    ctx.host.controls.append(sc.el, fx.el, sl.el, ui.ro.el);
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 66 : 56;
    if (narrow) {
      const body: Box = { x: 12, y: top + 6, w: W - 24, h: 168 };
      const g: Box = { x: 44, y: body.y + body.h + 30, w: W - 62, h: Math.max(90, H - body.y - body.h - 66) };
      return { W, H, narrow, top, body, g };
    }
    const body: Box = { x: 16, y: top + 12, w: W * 0.46, h: Math.max(260, H - top - 56) };
    const g: Box = { x: W * 0.52 + 46, y: top + 20, w: W * 0.48 - 72, h: Math.max(120, H - top - 110) };
    return { W, H, narrow, top, body, g };
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
          ? '암에서는 브레이크를 풀고, 자가면역에서는 더 밟습니다.'
          : 'Release the brake in cancer; press it harder in autoimmunity.'
        : ko
          ? '브레이크를 쥔 세포를 알고 나자 치료는 두 방향으로 갈라졌습니다. 암에서는 브레이크를 풀어 면역이 종양을 치게 하고, 자가면역과 이식에서는 더 밟아 공격을 멈추게 합니다.'
          : 'Once the cells holding the brake were known, treatment split in two directions: release the brake so immunity can reach a tumour, or press it harder to stop an attack in autoimmunity and transplantation.',
      16,
      24,
      L.W - 32,
      L.narrow ? 13 : 15,
    );

    const r = rNow();
    const tu = tumor(r);
    const dm = selfDamage(r);
    const B = L.body;

    // 조직 그림: 종양 덩어리와 그 둘레에 모인 조절 T세포, 또는 공격받는 자기 조직
    const cx = B.x + B.w * (L.narrow ? 0.72 : 0.42);
    const cy = B.y + B.h * (L.narrow ? 0.3 : 0.34);
    const rad = Math.min(B.w * 0.3, B.h * (L.narrow ? 0.17 : 0.22));
    c.save();
    if (st.scene === 'cancer') {
      c.fillStyle = alpha(pal.red, 0.1 + 0.45 * tu);
      c.strokeStyle = pal.red;
      c.lineWidth = 2.4;
      c.beginPath();
      const lobes = 7;
      for (let i = 0; i <= 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const rr = rad * (0.55 + 0.75 * tu) * (1 + 0.12 * Math.sin(a * lobes));
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
      c.fill();
      c.stroke();
    } else {
      c.strokeStyle = pal.ink;
      c.lineWidth = 2;
      c.fillStyle = alpha(pal.red, 0.08 + 0.5 * dm);
      c.beginPath();
      c.roundRect(cx - rad, cy - rad * 0.72, rad * 2, rad * 1.44, 10);
      c.fill();
      c.stroke();
      c.strokeStyle = alpha(pal.ink, 0.35);
      c.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        c.beginPath();
        c.moveTo(cx - rad, cy - rad * 0.72 + (i * rad * 1.44) / 4);
        c.lineTo(cx + rad, cy - rad * 0.72 + (i * rad * 1.44) / 4);
        c.stroke();
      }
    }
    c.restore();
    text(c, pal, st.scene === 'cancer' ? (ko ? '종양' : 'tumour') : ko ? '자기 조직' : "the body's own tissue", cx, cy + rad * (L.narrow ? 1.45 : 1.72) + (L.narrow ? 14 : 22), { size: 12, align: 'center' });

    // 둘레의 조절 T세포: 비율만큼 수가 는다
    // 조절 T세포가 조직을 둘러싼다. 비율이 높을수록 둘레가 촘촘해진다
    const n = Math.max(0, Math.round(r * 60));
    const cr = Math.max(7, Math.min(11, rad * 0.26));
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.35;
      const rr = rad * 1.3 + (i % 2) * cr * 0.9;
      tcell(c, pal, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92, cr, { col: pal.blue, fill: 0.22 });
    }
    const lx = L.narrow ? B.x + 2 : B.x + B.w / 2;
    const la: CanvasTextAlign = L.narrow ? 'left' : 'center';
    text(c, pal, ko ? `조절 T세포 ${pct(r)}%` : `regulatory T cells ${pct(r)}%`, lx, B.y + 12, { size: 12, align: la, color: pal.blue });
    if (!st.foxp3) text(c, pal, ko ? 'Foxp3 꺼짐 — 만들어지지 않음' : 'Foxp3 off — none made', lx, B.y + 30, { size: 12, align: la });

    // 두 결과 막대
    const bars: { label: string; v: number; goal: number }[] = [
      { label: ko ? '종양 크기' : 'tumour', v: tu, goal: TUMOR_GOAL },
      { label: ko ? '자기 몸 손상' : 'self damage', v: dm, goal: DAMAGE_GOAL },
    ];
    const barX = B.x + (L.narrow ? 6 : B.w * 0.14);
    const barW = L.narrow ? B.w * 0.56 : B.w * 0.72;
    bars.forEach((bar, i) => {
      const by = B.y + B.h - 86 + i * 36;
      text(c, pal, bar.label, barX, by - 5, { size: 12 });
      text(c, pal, `${pct(bar.v)}%`, L.narrow ? barX + 86 : barX + barW, by - 5, { size: 12, align: L.narrow ? 'left' : 'right', color: pal.blue });
      c.save();
      c.strokeStyle = pal.grid;
      c.lineWidth = 1;
      c.strokeRect(barX, by, barW, 13);
      c.fillStyle = alpha(pal.red, 0.5);
      c.fillRect(barX, by, barW * clamp(bar.v, 0, 1), 13);
      c.strokeStyle = pal.blue;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(barX + barW * bar.goal, by - 3);
      c.lineTo(barX + barW * bar.goal, by + 16);
      c.stroke();
      c.restore();
    });
    text(c, pal, ko ? '파란 선이 목표' : 'blue line is the goal', barX, B.y + B.h - 4, { size: 11 });

    // 그래프: 비율에 따른 두 곡선
    const A = axes(c, pal, L.g, {
      x0: 0,
      x1: 0.3,
      y0: 0,
      y1: 1,
      xt: [0, 0.1, 0.2, 0.3],
      yt: [0, 0.5, 1],
      fx: (v) => `${Math.round(v * 100)}%`,
      fy: (v) => `${Math.round(v * 100)}%`,
      xl: ko ? '조절 T세포 비율 →' : 'regulatory T cell fraction →',
      yl: ko ? '↑ 결과' : '↑ outcome',
    });
    const line = (f: (x: number) => number, col: string, dash: boolean) => {
      c.save();
      c.strokeStyle = col;
      c.lineWidth = 2.6;
      if (dash) c.setLineDash([6, 5]);
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = (i / 60) * 0.3;
        if (i === 0) c.moveTo(A.X(x), A.Y(f(x)));
        else c.lineTo(A.X(x), A.Y(f(x)));
      }
      c.stroke();
      c.restore();
    };
    line(tumor, pal.red, false);
    line(selfDamage, pal.blue, true);
    text(c, pal, ko ? '종양' : 'tumour', A.X(0.24), A.Y(tumor(0.24)) - 8, { size: 11, color: pal.red });
    text(c, pal, ko ? '자기 몸 손상' : 'self damage', A.X(0.02), A.Y(selfDamage(0.02)) - 8, { size: 11, color: pal.blue });
    // 목표 선
    c.save();
    c.strokeStyle = alpha(pal.ink, 0.3);
    c.lineWidth = 1;
    c.setLineDash([3, 4]);
    for (const g of [TUMOR_GOAL, DAMAGE_GOAL]) {
      c.beginPath();
      c.moveTo(A.X(0), A.Y(g));
      c.lineTo(A.X(0.3), A.Y(g));
      c.stroke();
    }
    c.setLineDash([]);
    c.restore();
    dot(c, pal, A.X(r), A.Y(tu), 5, true);
    dot(c, pal, A.X(r), A.Y(dm), 5, false);

    ui.ro.set(
      ko
        ? `Foxp3 ${st.foxp3 ? '켜짐' : '꺼짐'} · 조절 T세포 ${pct(r)}%\n종양 ${pct(tu)}% · 자기 몸 손상 ${pct(dm)}%`
        : `Foxp3 ${st.foxp3 ? 'on' : 'off'} · regulatory T cells ${pct(r)}%\ntumour ${pct(tu)}% · self damage ${pct(dm)}%`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '4',
    ko: '더 밟을까, 풀어 줄까',
    en: 'Press harder or let go',
    missions: [
      {
        id: 'c4m1',
        ko: 'Foxp3 를 껐다 켜며, 이 유전자가 조절 T세포를 만드는 스위치임을 확인하라.',
        en: 'Switch Foxp3 off and on, and confirm it is the switch that builds regulatory T cells.',
        hint_ko: 'Foxp3 스위치를 눌러 꺼 보고 다시 켜 보세요. 조직 둘레의 세포 수가 달라집니다.',
        hint_en: 'Toggle Foxp3 off and back on, and watch the number of cells around the tissue.',
      },
      {
        id: 'c4m2',
        ko: '암 상황에서 브레이크를 풀어 종양을 30% 아래로 줄여라.',
        en: 'In the cancer situation, release the brake and bring the tumour below 30%.',
        hint_ko: '조절 T세포 비율을 낮추세요. 종양이 끌어모은 세포를 줄이면 면역이 종양에 닿습니다.',
        hint_en: 'Lower the regulatory T cell fraction so immunity can reach the tumour.',
      },
      {
        id: 'c4m3',
        ko: '자가면역 상황에서 손상을 20% 아래로 줄이고, 종양까지 함께 줄일 수 있는지 확인하라.',
        en: 'In the autoimmune situation bring damage below 20%, and see whether the tumour can be shrunk at the same time.',
        hint_ko: '이번에는 비율을 올려 보세요. 두 막대의 파란 목표 선을 한꺼번에 넘길 수 있는지 보세요.',
        hint_en: 'Raise the fraction this time, and see whether both blue goal lines can be met at once.',
      },
    ],
    content: {
      ko: {
        observe: `<p>2003년, 사카구치와 동료들이 3장의 유전자와 2장의 세포를 하나로 묶었습니다. Foxp3 가 바로 브레이크를 쥔 세포, <b>조절 T세포</b>를 만드는 스위치였습니다. 이로써 가슴샘 밖에서도 면역을 멈춰 세우는 장치가 있다는 것, 곧 <b>말초 면역 관용</b>이 자리를 잡았습니다.</p><p>그러자 치료가 두 방향으로 갈라졌습니다. 어떤 종양은 조절 T세포를 자기 둘레로 불러 모아 면역의 공격을 피합니다. 그렇다면 브레이크를 풀어야 합니다. 반대로 자가면역이나 이식에서는 공격을 멈춰야 하니 브레이크를 더 밟아야 합니다.</p><p class="q">브레이크를 더 밟아야 할까, 풀어 줘야 할까?</p>`,
        interact: '상황을 고르고 조절 T세포 비율을 바꿔 보세요. Foxp3 스위치를 끄면 세포가 만들어지지 않습니다. 두 막대의 파란 선이 목표입니다.',
        understand: `<h4>한쪽을 좋게 하면 다른 쪽이 나빠진다</h4><p>두 곡선은 같은 손잡이를 반대로 따라갑니다. 비율을 낮추면 종양은 작아지지만 자기 몸이 상하고, 올리면 몸은 지켜지지만 종양이 자랍니다. 온몸의 브레이크를 통째로 조이거나 푸는 방법으로는 두 목표를 한꺼번에 맞출 수 없습니다.</p><h4>그래서 실제 치료는</h4><p>지금 임상에서 시험되고 있는 방법들은 브레이크를 통째로 건드리는 대신 자리를 가립니다. 자가면역과 이식에서는 조절 T세포를 늘리는 쪽으로, 환자에게 인터루킨-2 를 적게 주어 이 세포를 불리거나, 환자의 조절 T세포를 꺼내 실험실에서 늘린 뒤 되돌려 주고, 때로는 이식한 간이나 콩팥을 겨냥하도록 고쳐 넣습니다. 암에서는 종양 둘레에 모인 조절 T세포만 줄이려 합니다.</p><h4>실제와 다른 점</h4><p>두 곡선과 목표 선은 맞바꿈이 있다는 것을 보여 주기 위한 모형 값입니다. 실제 환자에서는 종양의 종류, 면역의 상태, 치료 시점에 따라 결과가 크게 달라집니다.</p>`,
      },
      en: {
        observe: `<p>In 2003 Sakaguchi and colleagues tied the gene of chapter three to the cells of chapter two: Foxp3 is the switch that builds the cells holding the brake, the <b>regulatory T cells</b>. That established <b>peripheral tolerance</b> — a mechanism outside the thymus that stops the immune system.</p><p>Treatment then split in two. Some tumours gather regulatory T cells around themselves to shelter from immune attack, so there the brake should be released. In autoimmunity and transplantation the attack must stop, so there the brake should be pressed harder.</p><p class="q">Press the brake harder, or let it go?</p>`,
        interact: 'Choose the situation and change the regulatory T cell fraction. Switching Foxp3 off stops the cells being made. The blue lines on the bars are the goals.',
        understand: `<h4>Helping one side hurts the other</h4><p>The two curves follow the same handle in opposite directions. Lower the fraction and the tumour shrinks while the body is damaged; raise it and the body is spared while the tumour grows. Tightening or releasing the body's whole brake cannot meet both goals at once.</p><h4>What treatments actually do</h4><p>The approaches now in clinical trials aim at a place rather than the whole brake. For autoimmunity and transplantation they raise regulatory T cells: low-dose interleukin-2 to expand them, or collecting a patient's own cells, growing them in the laboratory and returning them, sometimes engineered to target a transplanted liver or kidney. In cancer the aim is to cut back only the regulatory T cells gathered around the tumour.</p><h4>How this differs from reality</h4><p>The curves and goal lines are model values that show the trade-off exists. In real patients the outcome depends heavily on the kind of tumour, the state of the immune system and when treatment begins.</p>`,
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
      st.foxp3 = true;
      st.r = 0.1;
      st.scene = 'cancer';
      st.sawOff = false;
      st.sawOn = false;
      st.bestTumor = 1;
      st.bestDamage = 1;
      st.tried = [];
      panel();
      check();
    },
  };
}
