// 4장: 방향과 에너지 재기. 손 추정, 직선 맞춤, 정밀 맞춤을 비교하고 빛의 양으로 에너지를 잰다.
import { TAU, alpha, arrow, clamp, mix, pow10, text } from '../canvas';
import { readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import * as M from './model';

const N = 1.31;
const BETA = 0.99;
const SPEED = 16; // 화면에서 빛이 1초에 가는 칸 수 (처음보다 약 4배)
const SCAN = 1.4; // 정밀 맞춤 탐색 장면 길이 (초)

type Kind = 'track' | 'cascade';
type Mode = 'dir' | 'energy';

interface Fit {
  ang: number;
  p: M.Point; // 선이 지나는 점
  err: number; // 실제 방향과의 오차 (도)
}

export function chapter4(): Chapter {
  let ctx: Ctx;
  const sensors = M.sensors();
  let seed = 1;
  const st = {
    mode: 'dir' as Mode,
    kind: 'track' as Kind,
    trueAng: 0,
    trueP0: { x: 0, y: 0 } as M.Point,
    trueLen: 0,
    hits: [] as (M.Hit | null)[],
    th: [] as M.TimedHit[],
    tMin: 0,
    tMax: 1,
    t: 0,
    revealed: false,
    drag: null as { a: Pt; b: Pt } | null,
    guess: null as Fit | null,
    lf: null as Fit | null,
    fit: null as Fit | null,
    scan: -1,
    compare: null as null | { track: number[]; cascade: number[] },
    // 에너지
    calib: [] as { e: number; q: number }[],
    logK: -0.6,
    target: { e: 0, q: 0 },
    submitted: false,
  };
  let ui: { ro: ReturnType<typeof readout> };
  const r = () => M.rng(seed++);

  function newEvent(): void {
    const rand = r();
    st.guess = st.lf = st.fit = null;
    st.revealed = false;
    st.scan = -1;
    st.t = 0;
    if (st.kind === 'track') {
      const ev = M.makeEvent(rand);
      st.trueAng = ev.ang;
      st.trueP0 = ev.p0;
      st.trueLen = ev.L;
      st.hits = M.hits(ev, N, BETA, sensors);
    } else {
      const pos = { x: 2.5 + rand() * 5, y: 1.8 + rand() * 2.4 };
      st.trueAng = rand() * TAU;
      st.trueP0 = pos;
      st.trueLen = 0;
      st.hits = M.cascadeHits(pos, st.trueAng, N, sensors);
    }
    st.th = M.timedHits(sensors, st.hits);
    const ts = st.th.map((x) => x.t).sort((a, b) => a - b);
    st.tMin = ts[0] ?? 0;
    st.tMax = ts[ts.length - 1] ?? 1;
    if (st.th.length < 4) newEvent(); // 빛이 너무 적으면 다른 사건
  }

  function newEnergy(): void {
    const rand = r();
    const k0 = -0.6;
    st.calib = Array.from({ length: 7 }, (_, i) => {
      const e = 3.2 + (i / 6) * 3.4 + (rand() - 0.5) * 0.2;
      return { e, q: e + k0 + M.gauss(rand) * 0.12 };
    });
    const e = 3.4 + rand() * 3.2;
    st.target = { e, q: e + k0 + M.gauss(rand) * 0.12 };
    st.submitted = false;
  }

  const lineFrom = (ang: number, p: M.Point): Fit => ({ ang, p, err: M.angleError(ang, st.trueAng) });

  function doLineFit(): void {
    const f = M.lineFit(st.th);
    if (!f) return;
    st.lf = lineFrom(f.ang, f.c);
    afterFits();
  }

  function doPrecise(): void {
    if (st.kind !== 'track') {
      ctx.host.toast(tr(ctx, '정밀 맞춤은 직선 궤적(트랙)을 가정해요. 트랙 사건에서 써 보세요.', 'The precise fit assumes a straight track. Try it on a track event.'));
      return;
    }
    if (!st.lf) doLineFit();
    st.scan = 0;
  }

  function finishScan(): void {
    const pivot = st.lf?.p ?? { x: 5, y: 3 };
    const b = M.bestFit(st.th, pivot, N);
    const d = { x: Math.cos(b.ang), y: Math.sin(b.ang) };
    st.fit = lineFrom(b.ang, { x: pivot.x - d.y * b.off, y: pivot.y + d.x * b.off });
    st.scan = -1;
    afterFits();
  }

  function afterFits(): void {
    if (st.kind === 'track' && st.guess && st.lf) {
      if (st.guess.err < st.lf.err) {
        ctx.host.complete('c4m1', tr(ctx, `내 추측 ${st.guess.err.toFixed(1)}°, 직선 맞춤 ${st.lf.err.toFixed(1)}°`, `My guess ${st.guess.err.toFixed(1)}°, line fit ${st.lf.err.toFixed(1)}°`));
        ctx.note('beat', `손으로 잰 방향(오차 ${st.guess.err.toFixed(1)}°)이 직선 맞춤(${st.lf.err.toFixed(1)}°)보다 정확했던 사건이 있었다.`, `On one event my hand estimate (${st.guess.err.toFixed(1)}° off) beat the line fit (${st.lf.err.toFixed(1)}°).`);
      } else {
        ctx.host.result('c4m1', tr(ctx, `내 추측 ${st.guess.err.toFixed(1)}°, 직선 맞춤 ${st.lf.err.toFixed(1)}°. 다시 도전!`, `My guess ${st.guess.err.toFixed(1)}°, line fit ${st.lf.err.toFixed(1)}°. Try again!`));
      }
    }
  }

  function runCompare(): void {
    const median = (a: number[]) => {
      const s = [...a].sort((x, y) => x - y);
      return s[Math.floor(s.length / 2)];
    };
    const rand = M.rng(2026);
    const tr1: number[] = [];
    const tr2: number[] = [];
    const cas: number[] = [];
    let guard = 0;
    while ((tr1.length < 100 || cas.length < 100) && guard++ < 1000) {
      if (tr1.length < 100) {
        const ev = M.makeEvent(rand);
        const th = M.timedHits(sensors, M.hits(ev, N, BETA, sensors));
        const f = M.lineFit(th);
        if (f && th.length >= 4) {
          tr1.push(M.angleError(f.ang, ev.ang));
          const b = M.bestFit(th, f.c, N);
          tr2.push(M.angleError(b.ang, ev.ang));
        }
      }
      if (cas.length < 100) {
        const pos = { x: 2.5 + rand() * 5, y: 1.8 + rand() * 2.4 };
        const ang = rand() * TAU;
        const th = M.timedHits(sensors, M.cascadeHits(pos, ang, N, sensors));
        const f = M.lineFit(th);
        if (f && th.length >= 4) cas.push(M.angleError(f.ang, ang));
      }
    }
    st.compare = { track: [median(tr1), median(tr2)], cascade: [median(cas)] };
    const [a, b] = st.compare.track;
    const c = st.compare.cascade[0];
    ctx.host.complete('c4m2', tr(ctx, `트랙: 직선 맞춤 ${a.toFixed(1)}°, 정밀 맞춤 ${b.toFixed(1)}° / 캐스케이드: ${c.toFixed(1)}° (중앙값)`, `Tracks: line fit ${a.toFixed(1)}°, precise ${b.toFixed(1)}° / cascades: ${c.toFixed(1)}° (median)`));
    ctx.note('compare', `사건 100개씩 재구성하니 방향 오차 중앙값이 트랙은 직선 맞춤 ${a.toFixed(1)}°, 정밀 맞춤 ${b.toFixed(1)}°, 캐스케이드는 ${c.toFixed(1)}°였다.`, `Over 100 events each, median direction errors were ${a.toFixed(1)}° (line fit) and ${b.toFixed(1)}° (precise) for tracks, and ${c.toFixed(1)}° for cascades.`);
  }

  function submitEnergy(): void {
    const est = st.target.q - st.logK;
    const ratio = Math.pow(10, Math.abs(est - st.target.e));
    st.submitted = true;
    const fmt = (le: number) => formatE(le);
    if (ratio <= 2) {
      ctx.host.complete('c4m3', tr(ctx, `추정 ${fmt(est)}, 실제 ${fmt(st.target.e)} (${ratio.toFixed(2)}배 차이)`, `Estimate ${fmt(est)}, true ${fmt(st.target.e)} (factor ${ratio.toFixed(2)})`));
      ctx.note('energy', `빛의 양으로 눈금을 맞춰 에너지를 ${fmt(est)}로 추정했고, 실제 ${fmt(st.target.e)}와 ${ratio.toFixed(1)}배 안쪽으로 맞았다.`, `Calibrating with light yield, I estimated ${fmt(est)} against a true ${fmt(st.target.e)}, within a factor of ${ratio.toFixed(1)}.`);
    } else {
      ctx.host.result('c4m3', tr(ctx, `추정 ${fmt(est)}, 실제 ${fmt(st.target.e)}: ${ratio.toFixed(1)}배 차이. 눈금선을 파란 점들에 더 잘 맞춰 보세요.`, `Estimate ${fmt(est)}, true ${fmt(st.target.e)}: factor ${ratio.toFixed(1)}. Fit the line to the blue dots better.`));
    }
  }

  function formatE(le: number): string {
    const gev = Math.pow(10, le);
    if (gev >= 1e6) return `${(gev / 1e6).toFixed(1)} PeV`;
    if (gev >= 1e3) return `${(gev / 1e3).toFixed(0)} TeV`;
    return `${gev.toFixed(0)} GeV`;
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const mode = segment({
      label: ko ? '무엇을 잴까' : 'Measure',
      value: st.mode,
      options: [
        { v: 'dir', label: ko ? '방향' : 'Direction' },
        { v: 'energy', label: ko ? '에너지' : 'Energy' },
      ],
      onChange: (v) => {
        st.mode = v;
        panel();
      },
    });
    ui = { ro: readout() };
    if (st.mode === 'dir') {
      const kind = segment({
        label: ko ? '사건 종류' : 'Event type',
        value: st.kind,
        options: [
          { v: 'track', label: ko ? '트랙 (뮤온)' : 'Track (muon)' },
          { v: 'cascade', label: ko ? '캐스케이드' : 'Cascade' },
        ],
        onChange: (v) => {
          st.kind = v;
          newEvent();
        },
      });
      const btn = (label: string, fn: () => void, ghost = false) => {
        const b = stepButton({ label, onClick: fn });
        if (ghost) b.el.classList.add('ghost');
        return b.el;
      };
      const row1 = document.createElement('div');
      row1.className = 'ctl-pair';
      row1.append(btn(ko ? '직선 맞춤' : 'Line fit', doLineFit), btn(ko ? '정밀 맞춤' : 'Precise fit', doPrecise));
      const row2 = document.createElement('div');
      row2.className = 'ctl-pair';
      row2.append(
        btn(ko ? '정답 보기' : 'Show truth', () => ((st.revealed = true), (st.t = Math.max(st.t, st.tMax + 1))), true),
        btn(ko ? '새 사건' : 'New event', newEvent, true),
      );
      ctx.host.controls.append(mode.el, kind.el, row1, row2, btn(ko ? '사건 100개로 비교하기' : 'Compare on 100 events', runCompare, true), ui.ro.el);
    } else {
      const cal = slider({
        label: ko ? '눈금 맞추기 (빛의 양 ÷ 에너지)' : 'Calibration (light ÷ energy)',
        min: -1.6,
        max: 0.4,
        step: 0.02,
        value: st.logK,
        fmt: (v) => Math.pow(10, v).toFixed(2),
        onInput: (v) => {
          st.logK = v;
          st.submitted = false;
        },
      });
      const sub = stepButton({ label: ko ? '추정 제출' : 'Submit estimate', onClick: submitEnergy });
      const nx = stepButton({ label: ko ? '새 사건' : 'New event', onClick: newEnergy });
      nx.el.classList.add('ghost');
      ctx.host.controls.append(mode.el, cal.el, sub.el, nx.el, ui.ro.el);
    }
  }

  function geom() {
    const W = ctx.cvs.w;
    const H = ctx.cvs.h;
    const s = Math.min((W - 48) / M.COLS, (H - 48 - 110) / M.ROWS);
    const ox = (W - s * M.COLS) / 2;
    const oy = 34;
    return { s, ox, oy, X: (x: number) => ox + x * s, Y: (y: number) => oy + y * s };
  }

  function lineArrow(c: CanvasRenderingContext2D, f: Fit, col: string, dashed: boolean, label: string, dy = -8): void {
    const g = geom();
    const d = { x: Math.cos(f.ang), y: Math.sin(f.ang) };
    const L = 3.2;
    arrow(c, g.X(f.p.x - d.x * L), g.Y(f.p.y - d.y * L), g.X(f.p.x + d.x * L), g.Y(f.p.y + d.y * L), col, dashed);
    const ex = g.X(f.p.x + d.x * L);
    const ey = g.Y(f.p.y + d.y * L);
    const right = ex < ctx.cvs.w - 140;
    text(c, ctx.pal(), `${label} ${f.err.toFixed(1)}°`, clamp(right ? ex + 8 : ex - 8, 4, ctx.cvs.w - 4), ey + dy, { size: 15, align: right ? 'left' : 'right' });
  }

  function drawDir(): void {
    const { ctx: c, w: W, h: H } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const g = geom();
    c.fillStyle = alpha(pal.blue, pal.dark ? 0.1 : 0.06);
    c.fillRect(g.X(0), g.Y(0), g.s * M.COLS, g.s * M.ROWS);
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.strokeRect(g.X(0), g.Y(0), g.s * M.COLS, g.s * M.ROWS);
    text(c, pal, st.kind === 'track' ? (ko ? '트랙 사건: 긴 직선을 남긴다' : 'Track: leaves a long straight path') : ko ? '캐스케이드: 한 점에서 빛이 공처럼 퍼진다' : 'Cascade: light bursts from one point', g.X(0), g.Y(0) - 10, { size: 15, color: pal.blue });

    // 정답
    if (st.revealed) {
      if (st.kind === 'track') {
        const ex = st.trueP0.x + Math.cos(st.trueAng) * st.trueLen;
        const ey = st.trueP0.y + Math.sin(st.trueAng) * st.trueLen;
        arrow(c, g.X(st.trueP0.x), g.Y(st.trueP0.y), g.X(ex), g.Y(ey), pal.ink);
      } else {
        const p = st.trueP0;
        c.fillStyle = pal.ink;
        c.beginPath();
        c.arc(g.X(p.x), g.Y(p.y), 6, 0, TAU);
        c.fill();
        arrow(c, g.X(p.x), g.Y(p.y), g.X(p.x + Math.cos(st.trueAng) * 2), g.Y(p.y + Math.sin(st.trueAng) * 2), pal.ink);
      }
    }
    // 센서
    sensors.forEach((s, i) => {
      const hh = st.hits[i];
      const on = !!hh && st.t >= hh.t;
      const x = g.X(s.x);
      const y = g.Y(s.y);
      if (on && hh) {
        const f = st.tMax > st.tMin ? (hh.t - st.tMin) / (st.tMax - st.tMin) : 0;
        c.fillStyle = mix(pal.red, pal.blue, f);
        const rr = g.s * (0.09 + 0.2 * Math.sqrt(hh.amp));
        c.globalAlpha = 0.25;
        c.beginPath();
        c.arc(x, y, rr * 1.5, 0, TAU);
        c.fill();
        c.globalAlpha = 1;
        c.beginPath();
        c.arc(x, y, rr, 0, TAU);
        c.fill();
      } else {
        c.strokeStyle = alpha(pal.ink, 0.5);
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(x, y, Math.max(3, g.s * 0.1), 0, TAU);
        c.stroke();
      }
    });

    // 맞춤 결과
    if (st.lf) lineArrow(c, st.lf, pal.blue, true, ko ? '직선 맞춤' : 'line fit', 18);
    if (st.fit) lineArrow(c, st.fit, pal.blue, false, ko ? '정밀 맞춤' : 'precise', -10);
    let hyp: { ang: number; p: M.Point } | null = st.fit ?? st.lf ?? st.guess;
    if (st.scan >= 0 && st.lf) {
      const ang = (st.scan / SCAN) * TAU;
      hyp = { ang, p: st.lf.p };
      const d = { x: Math.cos(ang), y: Math.sin(ang) };
      c.strokeStyle = alpha(pal.blue, 0.6);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(g.X(st.lf.p.x - d.x * 4), g.Y(st.lf.p.y - d.y * 4));
      c.lineTo(g.X(st.lf.p.x + d.x * 4), g.Y(st.lf.p.y + d.y * 4));
      c.stroke();
    }
    const gs = st.drag ? { a: st.drag.a, b: st.drag.b } : null;
    if (gs) arrow(c, gs.a.x, gs.a.y, gs.b.x, gs.b.y, pal.red, true);
    else if (st.guess) lineArrow(c, st.guess, pal.red, true, ko ? '내 추측' : 'my guess', -30);

    // 잔차 막대: 이 가설이 각 센서의 도착 시간을 얼마나 잘 설명하나
    const by = g.Y(M.ROWS) + 22;
    const bh = H - by - 26;
    if (hyp && st.kind === 'track' && st.th.length >= 3 && bh > 40) {
      const res = M.residuals(st.th, hyp.ang, hyp.p, 0, N);
      const order = st.th.map((_, i) => i).sort((a, b) => st.th[a].t - st.th[b].t);
      const cost = res.reduce((a, x) => a + x * x, 0);
      const bx = g.X(0);
      const bw = g.s * M.COLS;
      const mid = by + bh / 2;
      c.strokeStyle = alpha(pal.ink, 0.4);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(bx, mid);
      c.lineTo(bx + bw, mid);
      c.stroke();
      const w = bw / order.length;
      const sc = (bh / 2 - 4) / 3;
      order.forEach((i, j) => {
        const v = clamp(res[i], -3, 3);
        c.fillStyle = Math.abs(res[i]) > 0.5 ? pal.red : pal.blue;
        c.fillRect(bx + j * w + 1, v > 0 ? mid - v * sc : mid, Math.max(1, w - 2), Math.abs(v) * sc);
      });
      text(c, pal, ko ? `시간 어긋남 (센서별, 먼저 켜진 순서) 합 ${cost.toFixed(1)}` : `Timing mismatch per sensor (in order), total ${cost.toFixed(1)}`, bx, by - 4, { size: 13 });
    } else if (!st.guess && !st.lf) {
      text(c, pal, ko ? '센서 불빛을 보고, 입자가 지나간 방향으로 드래그하세요' : 'Drag along the direction you think the particle travelled', g.X(0), by + 10, { size: 15, color: pal.blue });
    }

    const lit = st.th.length;
    const lines = [ko ? `빛을 받은 센서 ${lit}개` : `Sensors hit: ${lit}`];
    if (st.guess) lines.push(ko ? `내 추측 오차 ${st.guess.err.toFixed(1)}°` : `My guess: ${st.guess.err.toFixed(1)}° off`);
    if (st.lf) lines.push(ko ? `직선 맞춤 오차 ${st.lf.err.toFixed(1)}°` : `Line fit: ${st.lf.err.toFixed(1)}° off`);
    if (st.fit) lines.push(ko ? `정밀 맞춤 오차 ${st.fit.err.toFixed(1)}°` : `Precise fit: ${st.fit.err.toFixed(1)}° off`);
    if (st.compare) {
      const [a, b] = st.compare.track;
      lines.push(ko ? `100개 중앙값: 트랙 ${a.toFixed(1)}° → ${b.toFixed(1)}°, 캐스케이드 ${st.compare.cascade[0].toFixed(1)}°` : `Median of 100: tracks ${a.toFixed(1)}° → ${b.toFixed(1)}°, cascades ${st.compare.cascade[0].toFixed(1)}°`);
    }
    ui.ro.set(lines.join('\n'));
  }

  function drawEnergy(): void {
    const { ctx: c, w: W, h: H } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = 76;
    const R = W - 30;
    const T = 40;
    const B = H - 60;
    const X = (le: number) => L + ((le - 3) / 4) * (R - L);
    const Y = (lq: number) => B - ((lq + 1) / 6.5) * (B - T);
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.5;
    c.strokeRect(L, T, R - L, B - T);
    for (let lq = 0; lq <= 5; lq++) text(c, pal, pow10(lq), L - 8, Y(lq) + 5, { size: 13, align: 'right' });
    for (let le = 3; le <= 7; le++) {
      text(c, pal, formatE(le), X(le), B + 20, { size: 12, align: 'center' });
      c.strokeStyle = alpha(pal.ink, 0.12);
      c.beginPath();
      c.moveTo(X(le), T);
      c.lineTo(X(le), B);
      c.stroke();
    }
    text(c, pal, ko ? '에너지' : 'Energy', R, B + 42, { size: 13, align: 'right', color: pal.blue });
    text(c, pal, ko ? '받은 빛의 총량 (로그)' : 'Total light (log)', L, T - 12, { size: 13, color: pal.blue });
    // 눈금선: 빛 = K × 에너지
    c.save();
    c.beginPath();
    c.rect(L, T, R - L, B - T);
    c.clip();
    c.strokeStyle = pal.blue;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(X(3), Y(3 + st.logK));
    c.lineTo(X(7), Y(7 + st.logK));
    c.stroke();
    // 아는 사건
    for (const p of st.calib) {
      c.fillStyle = pal.blue;
      c.beginPath();
      c.arc(X(p.e), Y(p.q), 6, 0, TAU);
      c.fill();
    }
    // 모르는 사건: 빛의 양만 안다
    const est = st.target.q - st.logK;
    c.strokeStyle = pal.red;
    c.lineWidth = 2;
    c.setLineDash([6, 5]);
    c.beginPath();
    c.moveTo(L, Y(st.target.q));
    c.lineTo(X(est), Y(st.target.q));
    c.lineTo(X(est), B);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = pal.red;
    c.beginPath();
    c.arc(X(est), Y(st.target.q), 6, 0, TAU);
    c.fill();
    if (st.submitted) {
      c.strokeStyle = pal.ink;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(X(st.target.e), Y(st.target.q), 9, 0, TAU);
      c.stroke();
    }
    c.restore();
    text(c, pal, ko ? '파란 점: 에너지를 아는 사건 (눈금 맞추기용)' : 'Blue: events of known energy (for calibration)', L + 10, T + 22, { size: 14 });
    text(c, pal, ko ? '빨간 점: 빛의 양만 아는 새 사건' : 'Red: a new event, only its light is known', L + 10, T + 44, { size: 14 });
    if (st.submitted) text(c, pal, ko ? '검은 원: 실제 에너지' : 'Black ring: true energy', L + 10, T + 66, { size: 14 });
    ui.ro.set(
      ko
        ? `새 사건의 빛의 양: ${Math.round(Math.pow(10, st.target.q))}\n추정 에너지: ${formatE(est)}${st.submitted ? `\n실제 에너지: ${formatE(st.target.e)}` : ''}`
        : `Light of new event: ${Math.round(Math.pow(10, st.target.q))}\nEstimated energy: ${formatE(est)}${st.submitted ? `\nTrue energy: ${formatE(st.target.e)}` : ''}`,
    );
  }

  function draw(): void {
    ctx.cvs.ctx.clearRect(0, 0, ctx.cvs.w, ctx.cvs.h);
    if (st.mode === 'dir') drawDir();
    else drawEnergy();
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  function toUnits(p: Pt): M.Point {
    const g = geom();
    return { x: (p.x - g.ox) / g.s, y: (p.y - g.oy) / g.s };
  }

  return {
    id: '4',
    ko: '방향과 에너지',
    en: 'Direction and energy',
    missions: [
      {
        id: 'c4m1',
        ko: '트랙 사건에서 손으로 잰 방향이 직선 맞춤보다 정확하게 해 보라.',
        en: 'On a track event, make your hand estimate more accurate than the line fit.',
        hint_ko: '먼저 드래그로 추측한 뒤 직선 맞춤을 누르세요. 빨간(먼저 켜진) 센서에서 파란(나중에 켜진) 센서 쪽이 진행 방향입니다.',
        hint_en: 'Drag your guess first, then press line fit. Motion goes from red (early) to blue (late) sensors.',
      },
      {
        id: 'c4m2',
        ko: '사건 100개로 트랙과 캐스케이드의 방향 오차를 비교하라.',
        en: 'Compare direction errors for tracks and cascades over 100 events.',
        hint_ko: '"사건 100개로 비교하기"를 누르면 컴퓨터가 같은 방법으로 사건 200개를 재구성합니다.',
        hint_en: 'Press "Compare on 100 events" to reconstruct 200 events with the same methods.',
      },
      {
        id: 'c4m3',
        ko: '빛의 양으로 새 사건의 에너지를 실제 값의 2배 오차 안으로 맞혀라.',
        en: 'Estimate a new event’s energy from its light to within a factor of 2.',
        hint_ko: '에너지 모드에서 파란 눈금선이 파란 점들 사이를 지나도록 맞춘 뒤 제출하세요.',
        hint_en: 'In energy mode, make the blue line pass through the blue dots, then submit.',
      },
    ],
    content: {
      ko: {
        observe: `<p>센서는 빛이 언제, 얼마나 왔는지만 압니다. 이것만으로 입자의 방향과 에너지를 거꾸로 알아내는 것이 재구성입니다.</p><p>먼저 손으로 방향을 추측하고, 컴퓨터의 두 가지 방법과 비교해 보세요. 아래 막대는 지금 가설이 센서마다 도착 시간을 얼마나 잘 설명하는지 보여 줍니다. 막대가 짧을수록 좋은 가설입니다.</p><p class="q">빛이 공처럼 퍼지는 캐스케이드는 왜 방향을 재기 어려울까?</p>`,
        interact: '방향 모드와 에너지 모드를 오가며 재 보세요. 미션은 선택 사항입니다.',
        understand: `<h4>직선 맞춤 (LineFit)</h4><p>IceCube가 맨 처음 쓰는 빠른 방법입니다. 빛이 입자를 따라 움직인다고 보고, 센서 위치 $\\vec{x}_i$와 시간 $t_i$에 직선 $\\vec{x} = \\vec{c} + \\vec{v}\\,t$를 최소제곱으로 맞춥니다.</p>$$\\vec{v} = \\frac{\\langle \\vec{x}\\,t\\rangle - \\langle \\vec{x}\\rangle\\langle t\\rangle}{\\langle t^2\\rangle - \\langle t\\rangle^2}$$<p>빛이 원뿔로 퍼진다는 사실을 무시해서 빠르지만 부정확합니다.</p><h4>정밀 맞춤</h4><p>궤적 가설마다 체렌코프 원뿔로 예상 도착 시간을 계산하고, 실제 시간과의 차이(잔차)의 제곱합이 가장 작은 가설을 찾습니다. 실제 분석은 산란까지 넣은 가능도(likelihood)를 최대화합니다.</p>$$\\chi^2 = \\sum_i \\left(t_i - t_i^{\\text{예상}}\\right)^2$$<h4>트랙과 캐스케이드</h4><p>뮤온 중성미자는 수 km를 가는 뮤온을 만들어 긴 트랙을 남기고, 방향을 1° 안쪽으로 잴 수 있습니다. 전자 중성미자는 짧은 거리에서 에너지를 다 쏟는 캐스케이드를 만들어 방향 오차가 10° 정도로 큽니다. 대신 에너지는 캐스케이드가 더 정확합니다.</p><h4>에너지 재기</h4><p>입자가 남긴 빛의 총량은 에너지에 거의 비례합니다. 에너지를 아는 사건으로 눈금을 맞춘 뒤 새 사건에 적용합니다.</p><h4>실제와 다른 점</h4><p>2차원이고 산란이 없으며, 정밀 맞춤은 시간 잔차만 씁니다. 실제 방향 오차는 이 화면의 숫자보다 훨씬 작습니다.</p>`,
      },
      en: {
        observe: `<p>Sensors only know when light arrived and how much. Working backwards from that to the particle’s direction and energy is called reconstruction.</p><p>Guess the direction by hand, then compare with two computer methods. The bars below show how well the current hypothesis explains each sensor’s arrival time. Shorter bars mean a better hypothesis.</p><p class="q">Why is a cascade, where light bursts out like a ball, so hard to point?</p>`,
        interact: 'Switch between direction and energy modes. Missions are optional.',
        understand: `<h4>Line fit</h4><p>IceCube’s first, fast method. Treat the light as moving with the particle and fit a straight line $\\vec{x} = \\vec{c} + \\vec{v}\\,t$ to sensor positions $\\vec{x}_i$ and times $t_i$ by least squares.</p>$$\\vec{v} = \\frac{\\langle \\vec{x}\\,t\\rangle - \\langle \\vec{x}\\rangle\\langle t\\rangle}{\\langle t^2\\rangle - \\langle t\\rangle^2}$$<p>It ignores the Cherenkov cone, so it is quick but rough.</p><h4>Precise fit</h4><p>For each track hypothesis, predict arrival times from the Cherenkov cone and pick the one with the smallest sum of squared residuals. Real analyses maximise a likelihood that includes scattering.</p>$$\\chi^2 = \\sum_i \\left(t_i - t_i^{\\text{pred}}\\right)^2$$<h4>Tracks and cascades</h4><p>Muon neutrinos make muons that travel kilometres, leaving long tracks pointed to better than 1°. Electron neutrinos dump their energy in a short cascade, with direction errors around 10°, but their energy is measured better.</p><h4>Measuring energy</h4><p>The total light is roughly proportional to the energy. Calibrate with events of known energy, then apply it to a new one.</p><h4>How this differs from reality</h4><p>2D, no scattering, and the precise fit uses timing residuals only. Real direction errors are much smaller than the numbers here.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      if (!st.th.length) newEvent();
      if (!st.calib.length) newEnergy();
      panel();
    },
    panel,
    frame(dt) {
      if (st.mode === 'dir') {
        st.t += dt * SPEED;
        if (st.scan >= 0) {
          st.scan += dt;
          if (st.scan >= SCAN || dt === 0) finishScan();
        }
      }
      draw();
    },
    reset() {
      Object.assign(st, { mode: 'dir', kind: 'track', compare: null, logK: -0.6 });
      newEvent();
      newEnergy();
      panel();
    },
    down(p) {
      if (st.mode !== 'dir' || st.guess) return;
      st.drag = { a: p, b: p };
    },
    move(p) {
      if (st.drag) st.drag.b = p;
    },
    up() {
      const d = st.drag;
      st.drag = null;
      if (!d || Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) < 20) return;
      const a = toUnits(d.a);
      const b = toUnits(d.b);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      st.guess = lineFrom(ang, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      afterFits();
    },
  };
}
