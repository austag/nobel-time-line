// 2026 물리학: 남극 얼음 속 중성미자 사냥 (명세: prizes/2026/physics.md)
import { TAU, alpha, arrow, clamp, makeCanvas, mix, readPalette, text, type Canvas, type Palette } from '../canvas';
import type { Host, Lang, Mission, SimFactory, SimModule } from '../types';
import { readout, slider, stepButton, toggle } from '../ui';
import { CONTENT } from './content';
import * as M from './model';

const DEFAULTS = { n: 1.31, beta: 0.99 };
const SPEED = 10.5; // 화면에서 빛이 1초에 가는 칸 수
const REST = 2; // 빛이 다 퍼진 뒤 다음 이벤트까지 쉬는 시간 (초)
const ROUNDS = 5;

const MISSIONS: Mission[] = [
  {
    id: 'm1',
    ko: '빛이 아예 안 나오는 조건을 찾아 이벤트를 발사해 보세요.',
    en: 'Find a setting where no light appears at all, then fire an event.',
    hint_ko: '굴절률을 낮추거나 입자 속도를 줄여 보세요. n과 β를 곱한 값 nβ가 기준입니다.',
    hint_en: 'Lower the refractive index or the speed. The product nβ is what matters.',
  },
  {
    id: 'm2',
    ko: '방향 맞히기 게임: 센서 불빛만 보고 입자 방향을 드래그로 추정하세요. 5라운드 평균 오차로 점수를 받습니다.',
    en: 'Direction game: from the sensor flashes alone, drag to guess the particle direction. 5 rounds, scored by mean error.',
    hint_ko: '먼저 켜진(빨간) 센서 쪽에서 나중에 켜진(파란) 센서 쪽으로 입자가 지나갑니다. "1"이 붙은 센서가 출발점에 가깝습니다.',
    hint_en: 'Particles travel from the early (red) sensors toward the late (blue) ones. Sensor "1" lies near the start.',
  },
];

const create: SimFactory = () => {
  const st = {
    n: DEFAULTS.n,
    beta: DEFAULTS.beta,
    ev: null as M.IceEvent | null,
    t: 0,
    hits: [] as (M.Hit | null)[],
    tMin: 0,
    tMax: 1,
    game: false,
    revealed: true,
    guess: null as { a: M.Point; b: M.Point } | null,
    drag: null as { a: M.Point; b: M.Point } | null,
    rounds: [] as number[],
    noLightSeen: false,
  };
  const sensors = M.sensors();
  let host: Host;
  let cvs: Canvas;
  let lang: Lang = 'ko';
  let pal: Palette;
  let ui: {
    n: ReturnType<typeof slider>;
    b: ReturnType<typeof slider>;
    game: ReturnType<typeof toggle>;
    ro: ReturnType<typeof readout>;
  };

  const ko = () => lang === 'ko';

  function newEvent(): void {
    st.ev = M.makeEvent();
    st.t = 0;
    st.guess = null;
    st.revealed = !st.game;
    recompute();
    if (M.cherenkovAngle(st.n, st.beta) == null && !st.noLightSeen) {
      st.noLightSeen = true;
      const nb = (st.n * st.beta).toFixed(2);
      host.complete('m1', ko() ? `nβ = ${nb} 에서 빛이 나오지 않았어요.` : `No light at nβ = ${nb}.`);
    }
    if (host.isPaused()) host.setPaused(false);
  }

  function recompute(): void {
    if (!st.ev) return;
    st.hits = M.hits(st.ev, st.n, st.beta, sensors);
    const ts = st.hits.filter((x): x is M.Hit => !!x).map((x) => x.t).sort((a, b) => a - b);
    st.tMin = ts[0] ?? 0;
    st.tMax = ts[ts.length - 1] ?? 1;
  }

  function geom() {
    const W = cvs.w;
    const H = cvs.h;
    const pad = 24;
    const s = Math.min((W - pad * 2) / M.COLS, (H - pad * 2 - 64) / M.ROWS);
    const ox = (W - s * M.COLS) / 2;
    const oy = (H - s * M.ROWS) / 2 - 6;
    return { s, ox, oy, X: (x: number) => ox + x * s, Y: (y: number) => oy + y * s };
  }

  function buildPanel(): void {
    const k = ko();
    host.controls.replaceChildren();
    ui = {
      n: slider({
        label: k ? '굴절률 n' : 'Refractive index n',
        min: 1,
        max: 2,
        step: 0.01,
        value: st.n,
        fmt: (v) => v.toFixed(2),
        onInput: (v) => {
          st.n = v;
          recompute();
        },
      }),
      b: slider({
        label: k ? '입자 속도 β (빛의 속도 = 1)' : 'Particle speed β (c = 1)',
        min: 0.5,
        max: 1,
        step: 0.01,
        value: st.beta,
        fmt: (v) => v.toFixed(2),
        onInput: (v) => {
          st.beta = v;
          recompute();
        },
      }),
      game: toggle({
        label: k ? '방향 맞히기 게임' : 'Direction game',
        on: st.game,
        onText: k ? '켬' : 'On',
        offText: k ? '끔' : 'Off',
        onChange: (v) => {
          st.game = v;
          st.rounds = [];
          host.result('m2', '');
          newEvent();
        },
      }),
      ro: readout(),
    };
    const fire = stepButton({ label: k ? '새 이벤트 발사' : 'Fire new event', onClick: newEvent });
    host.controls.append(ui.n.el, ui.b.el, fire.el, ui.game.el, ui.ro.el);
  }

  function pointer(e: PointerEvent): M.Point {
    const r = cvs.cv.getBoundingClientRect();
    const g = geom();
    return { x: (e.clientX - r.left - g.ox) / g.s, y: (e.clientY - r.top - g.oy) / g.s };
  }
  function onDown(e: PointerEvent): void {
    if (!st.game || st.revealed || !st.ev) return;
    const p = pointer(e);
    st.drag = { a: p, b: p };
    try {
      cvs.cv.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
  }
  function onMove(e: PointerEvent): void {
    if (st.drag) st.drag.b = pointer(e);
  }
  function onUp(): void {
    if (!st.drag || !st.ev) return;
    const { a, b } = st.drag;
    st.drag = null;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.4) return;
    st.guess = { a, b };
    const err = M.angleError(Math.atan2(b.y - a.y, b.x - a.x), st.ev.ang);
    st.rounds.push(err);
    st.revealed = true;
    st.t = Math.max(st.t, st.ev.L / st.beta);
    const mean = st.rounds.reduce((x, y) => x + y, 0) / st.rounds.length;
    const k = ko();
    if (st.rounds.length >= ROUNDS) {
      const sc = M.score(st.rounds);
      host.complete('m2', k ? `점수 ${sc}점 (평균 오차 ${mean.toFixed(0)}°)` : `Score ${sc} (mean error ${mean.toFixed(0)}°)`);
      st.rounds = [];
    } else {
      host.result(
        'm2',
        k
          ? `${st.rounds.length}/${ROUNDS}라운드, 이번 오차 ${err.toFixed(0)}°, 평균 ${mean.toFixed(0)}°`
          : `Round ${st.rounds.length}/${ROUNDS}, error ${err.toFixed(0)}°, mean ${mean.toFixed(0)}°`,
      );
    }
  }

  // 먼저 켜진 센서는 빨강, 나중에 켜진 센서는 파랑
  const orderColor = (f: number) => mix(pal.red, pal.blue, f);

  function draw(): void {
    const { ctx, w: W, h: H } = cvs;
    const g = geom();
    const k = ko();
    ctx.clearRect(0, 0, W, H);

    // 얼음 단면과 센서 줄
    ctx.fillStyle = alpha(pal.blue, pal.dark ? 0.1 : 0.06);
    ctx.fillRect(g.X(0), g.Y(0), g.s * M.COLS, g.s * M.ROWS);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(g.X(0), g.Y(0), g.s * M.COLS, g.s * M.ROWS);
    ctx.strokeStyle = alpha(pal.ink, 0.18);
    ctx.lineWidth = 1;
    for (let c = 0; c < M.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(g.X(c + 0.5), g.Y(0));
      ctx.lineTo(g.X(c + 0.5), g.Y(M.ROWS));
      ctx.stroke();
    }
    text(ctx, pal, k ? '남극 얼음 단면 (센서 60개)' : 'Antarctic ice cross-section (60 sensors)', g.X(0), g.Y(0) - 10, { color: pal.blue, size: 15 });

    const th = M.cherenkovAngle(st.n, st.beta);
    const ev = st.ev;
    let first = -1;
    const labels: [number, number, string][] = [];
    if (ev) {
      const tp = Math.min(st.t * st.beta, ev.L); // 입자가 간 거리
      const px = ev.p0.x + ev.d.x * tp;
      const py = ev.p0.y + ev.d.y * tp;
      const moving = st.t * st.beta < ev.L;
      if (st.revealed) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(g.X(0), g.Y(0), g.s * M.COLS, g.s * M.ROWS);
        ctx.clip();
        // 궤적
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(g.X(ev.p0.x), g.Y(ev.p0.y));
        ctx.lineTo(g.X(px), g.Y(py));
        ctx.stroke();
        // 체렌코프 파면: 원뿔의 2D 단면인 V자
        if (th != null && moving) {
          const half = Math.PI / 2 - th;
          const back = Math.atan2(-ev.d.y, -ev.d.x);
          ctx.strokeStyle = pal.blue;
          ctx.lineWidth = 3;
          for (const sgn of [1, -1]) {
            const a = back + sgn * half;
            const len = Math.min(tp, 14) * Math.sin(th);
            ctx.beginPath();
            ctx.moveTo(g.X(px), g.Y(py));
            ctx.lineTo(g.X(px + Math.cos(a) * len), g.Y(py + Math.sin(a) * len));
            ctx.stroke();
          }
          // 빛이 나가는 방향: 궤적과 θc 를 이룬다
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([3, 5]);
          for (let i = 1; i <= 3; i++) {
            const q = tp - i * 1.4;
            if (q < 0) break;
            const qx = ev.p0.x + ev.d.x * q;
            const qy = ev.p0.y + ev.d.y * q;
            for (const sgn of [1, -1]) {
              const a = Math.atan2(ev.d.y, ev.d.x) + sgn * th;
              const rr = (tp - q) / (st.n * st.beta);
              ctx.beginPath();
              ctx.moveTo(g.X(qx), g.Y(qy));
              ctx.lineTo(g.X(qx + Math.cos(a) * rr), g.Y(qy + Math.sin(a) * rr));
              ctx.stroke();
            }
          }
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        if (moving) {
          ctx.fillStyle = pal.ink;
          ctx.beginPath();
          ctx.arc(g.X(px), g.Y(py), 5, 0, TAU);
          ctx.fill();
        } else {
          const ex = ev.p0.x + ev.d.x * ev.L;
          const ey = ev.p0.y + ev.d.y * ev.L;
          arrow(ctx, g.X(ev.p0.x), g.Y(ev.p0.y), g.X(ex), g.Y(ey), pal.ink);
          labels.push([g.X(ex), g.Y(ey), k ? '실제 방향' : 'true path']);
        }
      }
      let best = Infinity;
      st.hits.forEach((hh, i) => {
        if (hh && st.t >= hh.t && hh.t < best) {
          best = hh.t;
          first = i;
        }
      });
    }

    // 센서
    sensors.forEach((s, i) => {
      const hh = st.hits[i];
      const on = !!ev && !!hh && st.t >= hh.t;
      const x = g.X(s.x);
      const y = g.Y(s.y);
      if (on && hh) {
        const f = st.tMax > st.tMin ? (hh.t - st.tMin) / (st.tMax - st.tMin) : 0;
        const col = orderColor(f);
        const r = g.s * (0.09 + 0.2 * Math.sqrt(hh.amp));
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      } else {
        ctx.strokeStyle = alpha(pal.ink, 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(3, g.s * 0.1), 0, TAU);
        ctx.stroke();
      }
    });
    if (first >= 0) {
      const s = sensors[first];
      text(ctx, pal, '1', g.X(s.x), g.Y(s.y) - g.s * 0.36, { align: 'center', size: 15, title: true });
    }

    // 내 추측
    const gs = st.drag ?? st.guess;
    if (gs) {
      arrow(ctx, g.X(gs.a.x), g.Y(gs.a.y), g.X(gs.b.x), g.Y(gs.b.y), pal.red, true);
      labels.push([g.X(gs.b.x), g.Y(gs.b.y), k ? '내 추측' : 'my guess']);
    }
    for (const [x, y, s] of labels) label(ctx, x, y, s);

    // 범례
    const ly = g.Y(M.ROWS) + 26;
    const lx = g.X(0);
    const grd = ctx.createLinearGradient(lx, 0, lx + 90, 0);
    grd.addColorStop(0, orderColor(0));
    grd.addColorStop(1, orderColor(1));
    ctx.fillStyle = grd;
    ctx.fillRect(lx, ly - 9, 90, 10);
    const narrow = W < 600;
    const legend = k ? '먼저 → 나중 (빛 도착 순서), 원 크기는 빛의 양' : 'early → late (arrival order), size = light received';
    if (narrow) text(ctx, pal, legend, lx, ly + 20, { size: 13 });
    else text(ctx, pal, legend, lx + 100, ly, { size: 14 });
    if (st.game && ev && !st.revealed) {
      const guide = k ? '불빛을 보고 입자가 간 방향으로 드래그' : 'Drag along the path you think it took';
      text(ctx, pal, guide, lx, ly + (narrow ? 42 : 26), { color: pal.blue, size: narrow ? 14 : 15 });
    }

    // 판독
    const nb = (st.n * st.beta).toFixed(2);
    const lit = st.hits.filter(Boolean).length;
    ui.ro.set(
      th == null
        ? k
          ? `nβ = ${nb} ≤ 1\n빛이 나오지 않음 (입자가 얼음 속 빛보다 느림)`
          : `nβ = ${nb} ≤ 1\nNo light: the particle is slower than light in ice`
        : k
          ? `nβ = ${nb}\n체렌코프 각 θc = ${((th * 180) / Math.PI).toFixed(1)}°\n빛을 받은 센서 ${lit}개`
          : `nβ = ${nb}\nCherenkov angle θc = ${((th * 180) / Math.PI).toFixed(1)}°\nSensors hit: ${lit}`,
    );
    cvs.cv.setAttribute('aria-label', (k ? '얼음 속 검출기. ' : 'Ice detector. ') + ui.ro.el.textContent);
  }

  // 화살표 끝 이름표. 캔버스 밖으로 나가지 않게 위치를 조정한다.
  function label(ctx: CanvasRenderingContext2D, x: number, y: number, s: string): void {
    ctx.font = `15px ${pal.title}`;
    const w = ctx.measureText(s).width + 24;
    const right = x + w < cvs.w;
    text(ctx, pal, s, clamp(right ? x + 8 : x - 8, 4, cvs.w - 4), y - 8, { align: right ? 'left' : 'right', size: 15, title: true });
  }

  const mod: SimModule = {
    id: '2026-physics-icecube',
    missions: MISSIONS,
    content: CONTENT,
    mount(container, o) {
      lang = o.lang;
      host = o.host;
      pal = readPalette();
      cvs = makeCanvas(container, 'IceCube');
      cvs.cv.addEventListener('pointerdown', onDown);
      cvs.cv.addEventListener('pointermove', onMove);
      cvs.cv.addEventListener('pointerup', onUp);
      cvs.cv.addEventListener('pointercancel', () => (st.drag = null));
      buildPanel();
      newEvent();
      if (host.reduced) {
        st.t = 99;
        host.setPaused(true);
      }
    },
    frame(dt) {
      if (st.ev) {
        st.t += dt * SPEED;
        // 게임이 아닐 때는 빛이 다 퍼진 뒤 잠시 쉬고 다음 이벤트
        if (!st.game && st.t > Math.max(st.ev.L / st.beta, st.tMax) + REST * SPEED) newEvent();
      }
      draw();
    },
    setTab() {},
    setLang(l) {
      lang = l;
      buildPanel();
    },
    setTheme() {
      pal = readPalette();
    },
    reset() {
      Object.assign(st, { n: DEFAULTS.n, beta: DEFAULTS.beta, game: false, rounds: [], guess: null });
      host.result('m2', '');
      buildPanel();
      newEvent();
    },
    destroy() {
      cvs.destroy();
    },
  };
  return mod;
};

export default create;
