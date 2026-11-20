// 2장: 손에 쥘 수 있는 양자 (거시 양자 터널링, 1985).
// 실제 실험처럼 접합에 흘리는 전류를 올리다가 전압이 튀는 순간을 100번 잰다.
// 냉동기 온도를 내리며 탈출 온도가 평평해지는지 보고, 구리 차폐와 회로 먼저 재기로 의심을 지운다.
import { alpha, clamp, text } from '../canvas';
import { readout, slider, stepButton, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { axes, caption, circuit, dial, dialHit, dot, pulse, stateCurve, type Box, type Dial, type Escape } from './draw';
import { JJ, calibrate, effTemp, predictTesc, rateQuantum, rateThermal, sweep, type Sweep } from './model';

interface Point {
  T: number; // K
  tesc: number; // K
  shield: boolean;
}

const RUN_TIME = 2.4; // 초
const mk = (K: number) => Math.round(K * 1000);
const fmtMK = (v: number) => `${Math.round(v)} mK`;

export function chapter2(): Chapter {
  let ctx: Ctx;
  const st = {
    T: 0.2,
    shield: true,
    pred: null as number | null, // mK
    points: [] as Point[],
    hist: [] as number[],
    run: null as null | { sw: Sweep; T: number; shield: boolean; prog: number; shown: number },
    cal: null as null | { I0: number; C: number; curve: { T: number; tesc: number }[] },
    esc: null as Escape,
    escS: 0.95,
    volt: 0,
    sNow: 0.9,
    seed: 11,
    drag: false,
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; pred?: ReturnType<typeof slider> };

  const shielded = () => st.points.filter((p) => p.shield);
  const temps = (ps: Point[]) => new Set(ps.map((p) => mk(p.T)));

  function measure(): void {
    if (st.run) return;
    st.idle = 0;
    const sw = sweep(st.T, st.shield, 100, st.seed++);
    st.hist = [];
    st.run = { sw, T: st.T, shield: st.shield, prog: 0, shown: 0 };
    if (ctx.host.reduced) finish();
  }

  function finish(): void {
    const r = st.run!;
    st.hist = r.sw.hits.slice();
    st.points.push({ T: r.T, tesc: r.sw.tesc, shield: r.shield });
    st.sNow = r.sw.mean;
    st.run = null;
    check();
  }

  function doCalibrate(): void {
    const hot = shielded().filter((p) => p.T >= 0.1);
    if (temps(hot).size < 2) {
      ctx.host.toast(tr(ctx, '차폐를 켠 채 100 mK 넘는 온도 두 곳에서 먼저 재 보세요.', 'First measure at two temperatures above 100 mK with the shield on.'));
      return;
    }
    const c = calibrate(st.seed);
    const curve: { T: number; tesc: number }[] = [];
    for (let T = 0.01; T <= 0.3001; T += 0.01) curve.push({ T, tesc: predictTesc(T, c.I0, c.C) });
    st.cal = { ...c, curve };
    ctx.host.toast(tr(ctx, `열 구간에서 잰 값: 임계 전류 ${(c.I0 * 1e6).toFixed(2)} μA, 전기용량 ${(c.C * 1e12).toFixed(2)} pF`, `Measured in the thermal regime: critical current ${(c.I0 * 1e6).toFixed(2)} μA, capacitance ${(c.C * 1e12).toFixed(2)} pF`));
    check();
  }

  const predAt = (T: number) => (st.cal ? predictTesc(T, st.cal.I0, st.cal.C) : 0);

  // ---------- 판정 ----------
  function check(): void {
    const sh = shielded();
    const cold = sh.filter((p) => p.T <= 0.02);
    const hot = sh.filter((p) => p.T >= 0.1);
    if (st.pred == null) ctx.host.result('c2m1', tr(ctx, '먼저 계기판에 예상을 놓으세요', 'First set a guess on the dial'));
    else if (cold.length && hot.length && temps(sh).size >= 3) {
      const c = cold[cold.length - 1];
      const h = hot[hot.length - 1];
      ctx.host.complete('c2m1', tr(ctx, `냉동기 ${mk(c.T)} mK에서 탈출 온도 ${mk(c.tesc)} mK (예상 ${Math.round(st.pred)} mK), ${mk(h.T)} mK에서는 ${mk(h.tesc)} mK`, `At ${mk(c.T)} mK the escape temperature was ${mk(c.tesc)} mK (guess ${Math.round(st.pred)} mK); at ${mk(h.T)} mK it was ${mk(h.tesc)} mK`));
      ctx.note('plateau', `조셉슨 접합에 흘린 전류를 올리며 전압이 튀는 순간을 재자, 냉동기가 ${mk(h.T)} mK일 때 탈출 온도는 ${mk(h.tesc)} mK로 실제 온도와 거의 같았다. 그러나 ${mk(c.T)} mK까지 식혀도 탈출 온도는 ${mk(c.tesc)} mK 아래로 내려가지 않았다 (예상 ${Math.round(st.pred)} mK). 열이 아닌 터널링으로 회로 전체가 벽을 지나간 것이다.`, `Ramping the current through a Josephson junction and timing the voltage jumps, the escape temperature at ${mk(h.T)} mK was ${mk(h.tesc)} mK, close to the real temperature. Yet cooling to ${mk(c.T)} mK, it would not drop below ${mk(c.tesc)} mK (I guessed ${Math.round(st.pred)} mK). The whole circuit was getting through the barrier by tunnelling, not heat.`);
    } else ctx.host.result('c2m1', tr(ctx, `차폐 켜고 잰 온도 ${temps(sh).size}/3 (20 mK 이하와 100 mK 이상을 꼭 포함)`, `Temperatures measured with shield ${temps(sh).size}/3 (include ≤20 mK and ≥100 mK)`));

    const off = st.points.filter((p) => !p.shield && p.T <= 0.03);
    const on = sh.filter((p) => p.T <= 0.03);
    if (off.length && on.length) {
      const a = off[off.length - 1];
      const b = on[on.length - 1];
      ctx.host.complete('c2m2', tr(ctx, `차폐 끔 ${mk(a.tesc)} mK, 차폐 켬 ${mk(b.tesc)} mK`, `Shield off ${mk(a.tesc)} mK, shield on ${mk(b.tesc)} mK`));
      ctx.note('noise', `구리 차폐를 끄자 낮은 온도에서도 탈출 온도가 ${mk(a.tesc)} mK에 머물렀다. 차폐를 켜면 ${mk(b.tesc)} mK였다. 바깥 잡음도 평평한 부분을 만들 수 있어서, 잡음을 막아야만 진짜 터널링을 볼 수 있다.`, `With the copper shield off, the escape temperature stuck at ${mk(a.tesc)} mK even when cold; with it on, ${mk(b.tesc)} mK. Outside noise can fake a plateau too, so only a well-shielded junction shows real tunnelling.`);
    } else ctx.host.result('c2m2', tr(ctx, '30 mK 이하에서 차폐를 켜고 한 번, 끄고 한 번 재세요', 'At ≤30 mK, measure once with the shield on and once with it off'));

    const after = on.filter((p) => p.T <= 0.02);
    if (st.cal && after.length) {
      const p = after[after.length - 1];
      const pr = predAt(p.T);
      const diff = Math.round((Math.abs(p.tesc - pr) / pr) * 100);
      ctx.host.complete('c2m3', tr(ctx, `예측 ${mk(pr)} mK, 측정 ${mk(p.tesc)} mK (차이 ${diff}%)`, `Predicted ${mk(pr)} mK, measured ${mk(p.tesc)} mK (${diff}% apart)`));
      ctx.note('nofit', `높은 온도에서 먼저 잰 임계 전류 ${(st.cal.I0 * 1e6).toFixed(2)} μA와 전기용량 ${(st.cal.C * 1e12).toFixed(2)} pF만으로 양자역학 예측을 계산하니, ${mk(p.T)} mK에서 ${mk(pr)} mK가 나왔고 측정값 ${mk(p.tesc)} mK와 ${diff}% 안쪽으로 맞았다. 맞추려고 고친 값은 하나도 없었다.`, `Using only the critical current (${(st.cal.I0 * 1e6).toFixed(2)} μA) and capacitance (${(st.cal.C * 1e12).toFixed(2)} pF) measured hot, quantum theory predicted ${mk(pr)} mK at ${mk(p.T)} mK, within ${diff}% of the measured ${mk(p.tesc)} mK. Nothing was adjusted to fit.`);
    } else if (!st.cal) ctx.host.result('c2m3', tr(ctx, '"높은 온도에서 회로 먼저 재기"를 누르세요', 'Press "Measure the circuit hot first"'));
    else ctx.host.result('c2m3', tr(ctx, '차폐를 켜고 20 mK 이하에서 다시 재세요', 'Measure again at ≤20 mK with the shield on'));
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
        label: ko ? '내 예상: 10 mK로 식혔을 때 탈출 온도' : 'My guess: escape temperature at 10 mK',
        min: 0,
        max: 150,
        step: 5,
        value: st.pred ?? 0,
        fmt: fmtMK,
        onInput: (v) => {
          st.pred = v;
          st.idle = 0;
          check();
        },
      }),
    };
    const temp = slider({
      label: ko ? '냉동기 온도' : 'Fridge temperature',
      min: 10,
      max: 300,
      step: 5,
      value: mk(st.T),
      fmt: fmtMK,
      onInput: (v) => {
        st.T = v / 1000;
        st.idle = 0;
      },
    });
    const sh = toggle({
      label: ko ? '구리 차폐' : 'Copper shield',
      on: st.shield,
      onText: ko ? '켜짐' : 'on',
      offText: ko ? '꺼짐' : 'off',
      onChange: (v) => {
        st.shield = v;
        st.idle = 0;
      },
    });
    ctx.host.controls.append(
      ui.pred!.el,
      temp.el,
      sh.el,
      row(stepButton({ label: ko ? '100번 측정하기' : 'Measure 100 times', onClick: measure }).el, stepButton({ label: ko ? '높은 온도에서 회로 먼저 재기' : 'Measure the circuit hot first', onClick: doCalibrate }).el),
      row(stepButton({ label: ko ? '측정 기록 지우기' : 'Clear measurements', onClick: () => ((st.points = []), (st.hist = []), (st.cal = null), check()) }).el),
      ui.ro.el,
    );
  }

  // ---------- 배치 ----------
  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 58;
    const leftW = narrow ? W : W * 0.57;
    const ch = narrow ? Math.min(150, H * 0.2) : Math.min(180, (H - top) * 0.28);
    const cir: Box = { x: 12, y: top + 4, w: leftW - 24, h: ch };
    const cur: Box = { x: 24, y: cir.y + ch + 34, w: leftW - 48, h: narrow ? Math.min(120, H * 0.15) : Math.min(150, (H - top) * 0.22) };
    const mapY = cur.y + cur.h + 34;
    const hy = mapY + 34;
    const hist: Box = { x: 58, y: hy, w: leftW - 80, h: narrow ? Math.min(80, H * 0.1) : Math.max(60, Math.min(150, H - hy - 50)) };
    if (!narrow) {
      const colX = leftW + 46;
      const colW = W - colX - 20;
      const dr = Math.min(colW * 0.22, (H - top) * 0.11, 80);
      const d: Dial = { cx: colX + colW / 2, cy: top + dr + 28, r: dr, min: 0, max: 150, ticks: [0, 50, 100, 150], fmt: fmtMK };
      const gy = d.cy + 80;
      const g: Box = { x: colX, y: gy, w: colW - 10, h: Math.max(120, H - gy - 56) };
      return { W, H, narrow, cir, cur, mapY, hist, d: d as Dial | null, g };
    }
    const gy = hist.y + hist.h + 64;
    const g: Box = { x: 58, y: gy, w: W - 80, h: Math.max(120, H - gy - 50) };
    return { W, H, narrow, cir, cur, mapY, hist, d: null as Dial | null, g };
  };

  // ---------- 매 프레임 ----------
  function step(dt: number): void {
    if (dt === 0) return;
    st.volt = Math.max(0, st.volt - dt * 3);
    if (st.esc) {
      st.esc.t += dt / 0.7;
      if (st.esc.t >= 1) st.esc = null;
    }
    const r = st.run;
    if (!r) return;
    r.prog = Math.min(1, r.prog + dt / RUN_TIME);
    const n = Math.floor(r.prog * r.sw.hits.length);
    while (r.shown < n) {
      const s = r.sw.hits[r.shown++];
      st.hist.push(s);
      st.sNow = s;
      st.volt = 1;
      if (!st.esc) {
        const q = rateQuantum(s);
        const h = rateThermal(s, effTemp(r.T, r.shield));
        st.esc = { kind: q > h ? 'tunnel' : 'heat', t: 0 };
        st.escS = s;
      }
    }
    if (r.prog >= 1) finish();
  }

  // ---------- 그리기 ----------
  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(c, pal, ko ? '전류를 올리면 처음에는 전압이 0이다가, 어느 순간 전압이 튑니다. 그 순간의 전류를 100번 재서 냉동기 온도와 비교해 보세요.' : 'As the current rises the voltage stays at zero, then suddenly jumps. Time that jump 100 times and compare it with the fridge temperature.', 16, 24, L.W - 32, L.narrow ? 13 : 15);
    const shown = st.run ? st.run : null;
    circuit(c, pal, L.cir, { ko, shield: shown ? shown.shield : st.shield, volt: st.volt, current: st.sNow * JJ.I0 * 1e6, tempMK: mk(shown ? shown.T : st.T), t: st.t });
    // 회로 상태 그림
    text(c, pal, ko ? '회로 상태 그림: 위상차 δ에 따른 에너지' : 'Circuit state picture: energy vs phase difference δ', L.cur.x, L.cur.y - 18, { size: 13, title: true });
    stateCurve(c, pal, L.cur, { ko, s: st.esc ? st.escS : st.sNow, esc: st.esc, label: !st.esc, t: st.t, shake: effTemp(st.T, st.shield) * 0.6 });
    const kind = st.esc?.kind;
    text(c, pal, kind === 'tunnel' ? (ko ? '벽을 지나감 (터널링)' : 'through the wall (tunnelling)') : kind === 'heat' ? (ko ? '열로 흔들려 넘어감' : 'over the top by heat') : '', L.cur.x + L.cur.w, L.cur.y + 2, { size: 12, align: 'right', color: pal.blue });
    text(c, pal, ko ? '전압계 0 = 공이 골짜기에 머묾      전압이 튐 = 공이 골짜기를 빠져나감' : 'voltmeter 0 = ball stays in the dip      voltage jump = ball escapes', L.cur.x, L.mapY, { size: L.narrow ? 11 : 12, color: pal.blue });
    // 전압이 튄 전류 막대그래프
    // 측정한 값이 모인 곳을 크게 보여 준다
    const hs = st.hist.length ? st.hist : [0.97];
    const mid = (Math.min(...hs) + Math.max(...hs)) / 2;
    const half = Math.max(0.004, (Math.max(...hs) - Math.min(...hs)) * 0.7);
    const H0 = Math.max(0.9, mid - half);
    const H1 = Math.min(1, H0 + 2 * half);
    const xt = [0, 1, 2, 3].map((i) => H0 + ((H1 - H0) * i) / 3);
    const A = axes(c, pal, L.hist, { x0: H0, x1: H1, y0: 0, y1: 1, xt, yt: [], fx: (v) => (v * JJ.I0 * 1e6).toFixed(3), fy: () => '', xl: ko ? '전압이 튄 순간의 전류 (μA) →' : 'current at the jump (μA) →', yl: ko ? `측정 1: 전압이 튄 순간 (${st.hist.length}/100)` : `Measurement 1: jumps (${st.hist.length}/100)` });
    const NB = 40;
    const bins = new Array(NB).fill(0);
    for (const s of st.hist) bins[clamp(Math.floor(((s - H0) / (H1 - H0)) * NB), 0, NB - 1)]++;
    const mx = Math.max(8, ...bins);
    c.fillStyle = pal.red;
    bins.forEach((n, i) => {
      if (!n) return;
      const x = A.X(H0 + (i / NB) * (H1 - H0));
      const bw = L.hist.w / NB - 1;
      const bh = (n / mx) * L.hist.h;
      c.fillRect(x, L.hist.y + L.hist.h - bh, bw, bh);
    });
    // 탈출 온도 그래프
    const G = axes(c, pal, L.g, { x0: 0, x1: 300, y0: 0, y1: 300, xt: [0, 100, 200, 300], yt: [0, 100, 200, 300], fx: String, fy: String, xl: ko ? '냉동기 온도 (mK) →' : 'fridge temperature (mK) →', yl: ko ? '측정 2: 탈출 온도 (mK)' : 'Measurement 2: escape temperature (mK)' });
    c.save();
    c.strokeStyle = alpha(pal.ink, 0.55);
    c.setLineDash([5, 5]);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(G.X(0), G.Y(0));
    c.lineTo(G.X(300), G.Y(300));
    c.stroke();
    c.setLineDash([]);
    if (st.cal) {
      c.strokeStyle = pal.blue;
      c.lineWidth = 2;
      c.beginPath();
      st.cal.curve.forEach((p, i) => {
        const x = G.X(p.T * 1000);
        const y = G.Y(Math.min(300, p.tesc * 1000));
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();
    }
    c.restore();
    for (const p of st.points) dot(c, pal, G.X(p.T * 1000), G.Y(Math.min(300, p.tesc * 1000)), 5, p.shield);
    const lx = G.b.x + G.b.w - 4;
    let ly = G.b.y + G.b.h - 60;
    text(c, pal, ko ? '점선: 열로만 넘어갈 때' : 'dashed: heat only', lx, ly, { size: 11, align: 'right' });
    ly += 16;
    text(c, pal, ko ? '채운 점: 차폐 켬, 빈 점: 차폐 끔' : 'filled: shield on, open: shield off', lx, ly, { size: 11, align: 'right' });
    if (st.cal) text(c, pal, ko ? '파란 선: 조정 변수 없는 이론 예측' : 'blue line: prediction, no free parameters', lx, ly + 16, { size: 11, align: 'right', color: pal.blue });
    // 계기판
    const cold = shielded().filter((p) => p.T <= 0.02);
    if (L.d) dial(c, pal, L.d, { value: cold.length ? cold[cold.length - 1].tesc * 1000 : null, pred: st.pred, label: ko ? '10 mK에서 탈출 온도 예상' : 'escape temp. at 10 mK' });
    if (st.idle > 6 && st.pred == null && L.d) pulse(c, pal, L.d.cx, L.d.cy - L.d.r * 0.5, L.d.r * 0.7, st.t);
    const last = st.points[st.points.length - 1];
    ui.ro.set(
      ko
        ? `냉동기 ${mk(st.T)} mK, 구리 차폐 ${st.shield ? '켜짐' : '꺼짐'}\n${st.run ? `측정 중 ${st.hist.length}/100` : last ? `마지막 측정: ${mk(last.T)} mK에서 탈출 온도 ${mk(last.tesc)} mK` : '아직 측정 전'}\n측정한 점 ${st.points.length}개${st.cal ? ', 회로 값 잼' : ''}`
        : `Fridge ${mk(st.T)} mK, copper shield ${st.shield ? 'on' : 'off'}\n${st.run ? `Measuring ${st.hist.length}/100` : last ? `Last: escape temperature ${mk(last.tesc)} mK at ${mk(last.T)} mK` : 'Nothing measured yet'}\n${st.points.length} points${st.cal ? ', circuit measured' : ''}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  // ---------- 입력 ----------
  function setPred(v: number): void {
    st.pred = Math.round(clamp(v, 0, 150) / 5) * 5;
    ui.pred?.set(st.pred);
    st.idle = 0;
    check();
  }
  function down(p: Pt): void {
    const L = lay();
    if (!L.d) return;
    const v = dialHit(L.d, p.x, p.y);
    if (v != null) {
      st.drag = true;
      setPred(v);
    }
  }
  function move(p: Pt): void {
    const L = lay();
    if (!st.drag || !L.d) return;
    const v = dialHit({ ...L.d, r: L.d.r * 3 }, p.x, p.y);
    if (v != null) setPred(v);
  }
  function up(): void {
    st.drag = false;
  }

  return {
    id: '2',
    ko: '손에 쥘 수 있는 양자',
    en: 'Quantum you can hold',
    missions: [
      {
        id: 'c2m1',
        ko: '10 mK에서의 탈출 온도를 예상한 뒤, 차폐를 켜고 20 mK 이하와 100 mK 이상을 포함해 세 온도 이상에서 재라.',
        en: 'Guess the escape temperature at 10 mK, then measure at three or more temperatures with the shield on, including ≤20 mK and ≥100 mK.',
        hint_ko: '계기판 바늘을 끌어 예상을 놓고, 냉동기 온도를 바꿀 때마다 "100번 측정하기"를 누르세요.',
        hint_en: 'Drag the dial needle, then press "Measure 100 times" at each fridge temperature.',
      },
      {
        id: 'c2m2',
        ko: '30 mK 이하에서 구리 차폐를 끈 채로도 재서, 잡음이 만드는 가짜 평평함을 확인하라.',
        en: 'At ≤30 mK, also measure with the copper shield off and see the fake plateau noise makes.',
        hint_ko: '구리 차폐 단추로 끄고 켜며 같은 온도에서 두 번 재세요.',
        hint_en: 'Toggle the copper shield and measure twice at the same temperature.',
      },
      {
        id: 'c2m3',
        ko: '높은 온도에서 회로 값을 먼저 재고, 그 값만으로 낸 예측이 낮은 온도 측정과 맞는지 확인하라.',
        en: 'Measure the circuit hot first, then check whether the prediction from those values alone matches the cold measurement.',
        hint_ko: '100 mK 넘는 두 온도에서 잰 뒤 "높은 온도에서 회로 먼저 재기"를 누르고, 20 mK 이하에서 다시 재세요.',
        hint_en: 'Measure at two temperatures above 100 mK, press "Measure the circuit hot first", then measure again at ≤20 mK.',
      },
    ],
    content: {
      ko: {
        observe: `<p>1984년부터 1985년까지 버클리에서 존 클라크, 박사후연구원 미셸 드보레, 박사과정 학생 존 마르티니스는 <b>조셉슨 접합</b>으로 실험했습니다. 초전도체 두 조각 사이에 아주 얇은 절연막을 끼운 부품입니다.</p><p>초전도체 속 전자들은 둘씩 짝(쿠퍼쌍)을 지어 모두 같은 양자 상태에 들어갑니다. 그래서 셀 수 없이 많은 쿠퍼쌍이 있어도, 회로 전체의 상태는 양쪽 파동의 <b>위상차 δ</b>라는 숫자 하나로 정해집니다. 앤서니 레깃은 이 δ가 터널링을 할 수 있다고 예측했습니다.</p><p>접합에 전류를 흘리면 처음에는 전압 없이 전류만 흐르다가 어느 순간 전압이 튑니다. 회로 상태 그림에서는 공이 첫 골짜기에 머물다 빠져나가는 순간입니다.</p><p class="q">냉동기를 10 mK까지 식히면, 전압이 저절로 튀는 일도 거의 사라질까?</p>`,
        interact: '냉동기 온도를 정하고 "100번 측정하기"를 누르면, 전압이 튄 순간의 전류가 막대그래프에, 그로부터 계산한 탈출 온도가 오른쪽 그래프에 찍힙니다.',
        understand: `<h4>회로 상태 그림</h4><p>위상차 δ가 움직이는 모습은 다음 에너지 곡선 위의 공과 같습니다. 전류 $I$를 키우면 곡선이 더 기울어져 첫 골짜기의 벽 $\\Delta U$가 낮아집니다.</p>$$U(\\delta) = -E_J\\left[\\cos\\delta + \\frac{I}{I_c}\\,\\delta\\right], \\qquad E_J = \\frac{\\hbar I_c}{2e}$$<p>공이 골짜기에 머물면 $\\dot\\delta = 0$이라 전압 $V = (\\hbar/2e)\\,\\dot\\delta$도 0이고, 빠져나가 굴러가면 전압이 생깁니다.</p><h4>열로 넘어갈까, 벽을 지나갈까</h4>$$\\Gamma_{\\text{열}} = \\frac{\\omega_p}{2\\pi}\\,e^{-\\Delta U / k_B T}, \\qquad \\Gamma_{\\text{터널}} \\approx a_q\\,\\frac{\\omega_p}{2\\pi}\\,e^{-7.2\\,\\Delta U / \\hbar\\omega_p}$$<p>연구진은 잰 탈출률을 "열로만 넘어갔다면 몇 도였을까"로 바꿔 <b>탈출 온도</b> $T_{\\text{esc}}$로 나타냈습니다. 열로만 넘어간다면 언제나 $T_{\\text{esc}} = T$입니다. 터널링이 있다면 갈림 온도 $T_0 \\approx \\hbar\\omega_p / 2\\pi k_B$ 아래에서 $T_{\\text{esc}}$가 더는 내려가지 않습니다.</p><h4>의심 두 가지를 지운 방법</h4><p>첫째, 바깥 전선으로 들어오는 잡음도 평평한 부분을 만들 수 있습니다. 연구진은 구리 차폐와 거르개로 잡음을 막는 데 많은 시간을 들였습니다. 둘째, 회로 값을 마음대로 고치면 어떤 결과도 맞출 수 있습니다. 그래서 열 구간에서 임계 전류와 전기용량을 먼저 그 자리에서 재고, 그 값만으로 낮은 온도를 예측했습니다. 측정은 조정 변수 없이 예측과 맞았습니다.</p><h4>실제와 다른 점</h4><p>회로 상태 그림은 모양을 보기 좋게 과장했습니다. 실제 벽은 $E_J$의 1000분의 1 정도로 낮습니다. 접합 값은 실제 실험과 비슷한 크기로 정했고, 감쇠 효과와 측정 장치는 단순화했습니다.</p>`,
      },
      en: {
        observe: `<p>In 1984 and 1985 at Berkeley, John Clarke, postdoc Michel Devoret and PhD student John Martinis worked with a <b>Josephson junction</b>: two pieces of superconductor separated by a very thin insulating layer.</p><p>In a superconductor electrons pair up (Cooper pairs) and all share one quantum state. So however many pairs there are, the state of the whole circuit is fixed by a single number, the <b>phase difference δ</b> between the two sides. Anthony Leggett predicted that this δ could tunnel.</p><p>Drive a current through the junction and at first it flows with no voltage, then the voltage suddenly jumps. In the circuit state picture this is the ball leaving the first dip.</p><p class="q">If the fridge is cooled to 10 mK, will these jumps almost stop?</p>`,
        interact: 'Pick a fridge temperature and press "Measure 100 times". The currents at the jumps fill the histogram, and the escape temperature worked out from them lands on the right-hand graph.',
        understand: `<h4>The circuit state picture</h4><p>The motion of δ is like a ball on this energy curve. Raising the current $I$ tilts it further and lowers the wall $\\Delta U$ of the first dip.</p>$$U(\\delta) = -E_J\\left[\\cos\\delta + \\frac{I}{I_c}\\,\\delta\\right], \\qquad E_J = \\frac{\\hbar I_c}{2e}$$<p>While the ball stays in the dip, $\\dot\\delta = 0$, so the voltage $V = (\\hbar/2e)\\,\\dot\\delta$ is zero; once it escapes and rolls, a voltage appears.</p><h4>Over the top, or through the wall?</h4>$$\\Gamma_{\\text{heat}} = \\frac{\\omega_p}{2\\pi}\\,e^{-\\Delta U / k_B T}, \\qquad \\Gamma_{\\text{tunnel}} \\approx a_q\\,\\frac{\\omega_p}{2\\pi}\\,e^{-7.2\\,\\Delta U / \\hbar\\omega_p}$$<p>The team turned each measured escape rate into an <b>escape temperature</b> $T_{\\text{esc}}$: the temperature that would give that rate by heat alone. With heat only, $T_{\\text{esc}} = T$ always. With tunnelling, $T_{\\text{esc}}$ stops falling below the crossover $T_0 \\approx \\hbar\\omega_p / 2\\pi k_B$.</p><h4>Two doubts, removed</h4><p>First, noise coming down the wires can also make a plateau, so the team spent a long time shielding with copper and filters. Second, by tweaking circuit values you could fit anything. So they measured the critical current and capacitance in place in the thermal regime, and predicted the cold behaviour from those alone. The data matched with no adjustable parameters.</p><h4>How this differs from reality</h4><p>The state picture is exaggerated so you can see it; the real wall is about a thousandth of $E_J$. The junction values are close in size to the real ones, and damping and the measuring setup are simplified.</p>`,
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
      st.T = 0.2;
      st.shield = true;
      st.pred = null;
      st.points = [];
      st.hist = [];
      st.run = null;
      st.cal = null;
      st.esc = null;
      st.sNow = 0.9;
      panel();
      check();
    },
    down,
    move,
    up,
  };
}
