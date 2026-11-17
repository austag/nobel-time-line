// 1장: 빛의 충격파 만들기. 하위헌스 원리로 체렌코프 원뿔이 생기는 과정을 본다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, segment, slider, stepButton, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { cherenkovAngle } from './model';

const CROSS = 1.8; // β = 1 인 입자가 화면을 가로지르는 시간 (초)
const EMIT = 0.05; // 빛 원을 남기는 간격 (초)
const TOL = 2; // 측정 허용 오차 (도)

interface Measure {
  n: number;
  beta: number;
  m: number;
  th: number;
}

const DEG = 180 / Math.PI;

export function chapter1(): Chapter {
  let ctx: Ctx;
  const st = {
    n: 1.31,
    beta: 0.99,
    tau: 0,
    waves: [] as { x: number; t0: number }[],
    tri: false,
    drag: null as { a: Pt; b: Pt } | null,
    last: null as { a: Pt; b: Pt; m: number } | null,
    meas: [] as Measure[],
  };
  let ui: { n: ReturnType<typeof slider>; ro: ReturnType<typeof readout> };

  const geo = () => {
    const { w: W, h: H } = ctx.cvs;
    const m = 24;
    return { W, H, m, y: H * 0.38, c: (W - 2 * m) / CROSS };
  };

  function restart(): void {
    st.tau = 0;
    st.waves = [];
  }

  function checkThreshold(): void {
    const nb = st.n * st.beta;
    if (nb > 1 && nb <= 1.03) {
      const msg = tr(ctx, `n = ${st.n.toFixed(2)}, β = ${st.beta.toFixed(2)} (nβ = ${nb.toFixed(2)})에서 원뿔이 막 생기기 시작`, `The cone just appears at n = ${st.n.toFixed(2)}, β = ${st.beta.toFixed(2)} (nβ = ${nb.toFixed(2)})`);
      ctx.host.complete('c1m1', msg);
      ctx.note(
        'threshold',
        `굴절률 ${st.n.toFixed(2)}인 물질에서는 입자 속도가 빛의 ${(1 / st.n).toFixed(2)}배를 넘어야 빛의 원뿔이 생긴다.`,
        `In a medium with n = ${st.n.toFixed(2)}, a particle must exceed ${(1 / st.n).toFixed(2)} c to make a light cone.`,
      );
    }
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const preset = segment({
      label: ko ? '물질' : 'Medium',
      value: st.n === 1.33 ? 'water' : st.n === 1.31 ? 'ice' : st.n === 1.5 ? 'glass' : ('other' as string),
      options: [
        { v: 'water', label: ko ? '물 1.33' : 'Water 1.33' },
        { v: 'ice', label: ko ? '얼음 1.31' : 'Ice 1.31' },
        { v: 'glass', label: ko ? '유리 1.50' : 'Glass 1.50' },
      ],
      onChange: (v) => {
        st.n = v === 'water' ? 1.33 : v === 'ice' ? 1.31 : 1.5;
        ui.n.set(st.n);
        checkThreshold();
      },
    });
    ui = {
      n: slider({
        label: ko ? '굴절률 n' : 'Refractive index n',
        min: 1,
        max: 2,
        step: 0.01,
        value: st.n,
        fmt: (v) => v.toFixed(2),
        onInput: (v) => {
          st.n = v;
          checkThreshold();
        },
      }),
      ro: readout(),
    };
    const beta = slider({
      label: ko ? '입자 속도 β (빛의 속도 = 1)' : 'Particle speed β (c = 1)',
      min: 0.5,
      max: 1,
      step: 0.01,
      value: st.beta,
      fmt: (v) => v.toFixed(2),
      onInput: (v) => {
        st.beta = v;
        restart();
        checkThreshold();
      },
    });
    const tri = toggle({
      label: ko ? '삼각형 보기 (시간 멈춤)' : 'Show the triangle (freeze)',
      on: st.tri,
      onText: ko ? '켬' : 'On',
      offText: ko ? '끔' : 'Off',
      onChange: (v) => (st.tri = v),
    });
    const clear = stepButton({
      label: ko ? '측정 기록 지우기' : 'Clear measurements',
      onClick: () => {
        st.meas = [];
        st.last = null;
      },
    });
    clear.el.classList.add('ghost');
    ctx.host.controls.append(preset.el, ui.n.el, beta.el, tri.el, ui.ro.el, clear.el);
  }

  function record(m: number): void {
    const th = cherenkovAngle(st.n, st.beta);
    if (th == null) {
      ctx.host.toast(tr(ctx, '지금은 빛의 원뿔이 없어요. 속도나 굴절률을 올려 보세요.', 'There is no cone right now. Raise the speed or the index.'));
      return;
    }
    const thd = th * DEG;
    const err = Math.abs(m - thd);
    if (err > TOL) {
      ctx.host.result('c1m2', tr(ctx, `잰 각 ${m.toFixed(1)}°, 이론값과 ${err.toFixed(1)}° 차이. 빛이 나가는 방향(파면에 수직)을 따라 그어 보세요.`, `Measured ${m.toFixed(1)}°, off by ${err.toFixed(1)}°. Draw along the light direction (perpendicular to the front).`));
      return;
    }
    st.meas.push({ n: st.n, beta: st.beta, m, th: thd });
    ctx.host.complete('c1m2', tr(ctx, `잰 각 ${m.toFixed(1)}°, 이론값 ${thd.toFixed(1)}°`, `Measured ${m.toFixed(1)}°, theory ${thd.toFixed(1)}°`));
    ctx.note('measure', `각도기로 잰 원뿔 각 ${m.toFixed(1)}°는 이론값 ${thd.toFixed(1)}°와 ${err.toFixed(1)}°밖에 차이 나지 않았다.`, `The cone angle I measured, ${m.toFixed(1)}°, was within ${err.toFixed(1)}° of the predicted ${thd.toFixed(1)}°.`);
    const ns: number[] = [];
    for (const x of st.meas) if (ns.every((v) => Math.abs(v - x.n) >= 0.05)) ns.push(x.n);
    if (ns.length >= 3) {
      const list = ns.slice(0, 3).map((v) => v.toFixed(2)).join(', ');
      ctx.host.complete('c1m3', tr(ctx, `굴절률 ${list}에서 측정`, `Measured at n = ${list}`));
      ctx.note('table', `굴절률 ${list}에서 잰 각이 모두 cos θc = 1/(nβ) 곡선 위에 놓였다.`, `Angles measured at n = ${list} all fell on the curve cos θc = 1/(nβ).`);
    } else {
      ctx.host.result('c1m3', tr(ctx, `서로 다른 굴절률 ${ns.length}/3`, `Distinct indices ${ns.length}/3`));
    }
  }

  function measureAngle(a: Pt, b: Pt): number {
    return Math.atan2(Math.abs(b.y - a.y), b.x - a.x) * DEG;
  }

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const g = geo();
    const ko = k(ctx);
    c.clearRect(0, 0, g.W, g.H);
    const th = cherenkovAngle(st.n, st.beta);
    const px = g.m + st.beta * g.c * st.tau;
    const vis = Math.min(px, g.W - g.m);

    // 얼음 (위쪽 영역)
    const top = 34;
    const bottom = g.H * 0.76;
    c.fillStyle = alpha(pal.blue, pal.dark ? 0.08 : 0.05);
    c.fillRect(0, top, g.W, bottom - top);
    text(c, pal, ko ? `얼음 속 (n = ${st.n.toFixed(2)}), 빛의 속도 c/n` : `Inside the medium (n = ${st.n.toFixed(2)}), light moves at c/n`, g.m, top - 10, { color: pal.blue, size: 15 });

    c.save();
    c.beginPath();
    c.rect(0, top, g.W, bottom - top);
    c.clip();
    // 빛 원 (하위헌스 소파)
    c.strokeStyle = alpha(pal.blue, 0.4);
    c.lineWidth = 1.3;
    for (const wv of st.waves) {
      const r = ((st.tau - wv.t0) * g.c) / st.n;
      if (r <= 0) continue;
      c.beginPath();
      c.arc(wv.x, g.y, r, 0, TAU);
      c.stroke();
    }
    // 원뿔 (원들의 바깥선)
    if (th != null && st.waves.length > 1 && px <= g.W - g.m + 2) {
      const first = st.waves[0];
      const r0 = ((st.tau - first.t0) * g.c) / st.n;
      const L = px - first.x;
      const half = Math.PI / 2 - th;
      const len = Math.sqrt(Math.max(0, L * L - r0 * r0));
      c.strokeStyle = pal.blue;
      c.lineWidth = 3.5;
      for (const s of [1, -1]) {
        c.beginPath();
        c.moveTo(px, g.y);
        c.lineTo(px - Math.cos(half) * len, g.y + s * Math.sin(half) * len);
        c.stroke();
      }
    }
    c.restore();

    // 궤적과 입자
    c.strokeStyle = pal.ink;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(g.m, g.y);
    c.lineTo(vis, g.y);
    c.stroke();
    if (px <= g.W - g.m) {
      c.fillStyle = pal.ink;
      c.beginPath();
      c.arc(px, g.y, 6, 0, TAU);
      c.fill();
    }

    // 삼각형: 빗변 βct, 밑변 ct/n
    if (st.tri && th != null && st.waves.length > 4) {
      const e = st.waves[Math.floor(st.waves.length * 0.6)];
      const dt = st.tau - e.t0;
      const r = (dt * g.c) / st.n;
      const T = { x: e.x + Math.cos(th) * r, y: g.y - Math.sin(th) * r };
      c.save();
      c.strokeStyle = pal.red;
      c.fillStyle = pal.red;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(e.x, g.y);
      c.lineTo(T.x, T.y);
      c.lineTo(Math.min(px, g.W - g.m), g.y);
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.arc(e.x, g.y, 30, -th, 0);
      c.stroke();
      // 직각 표시
      const u = { x: Math.cos(th), y: -Math.sin(th) };
      const v = { x: px - T.x, y: g.y - T.y };
      const vl = Math.hypot(v.x, v.y) || 1;
      const q = 11;
      c.beginPath();
      c.moveTo(T.x - u.x * q, T.y - u.y * q);
      c.lineTo(T.x - u.x * q + (v.x / vl) * q, T.y - u.y * q + (v.y / vl) * q);
      c.lineTo(T.x + (v.x / vl) * q, T.y + (v.y / vl) * q);
      c.stroke();
      c.beginPath();
      c.arc(e.x, g.y, 5, 0, TAU);
      c.fill();
      c.restore();
      text(c, pal, 'θc', e.x + 36, g.y - 8, { size: 16, title: true });
      text(c, pal, ko ? '빛이 간 거리 ct/n' : 'light: ct/n', (e.x + T.x) / 2 - 10, (g.y + T.y) / 2 - 8, { size: 15, align: 'right', title: true });
      text(c, pal, ko ? '입자가 간 거리 βct' : 'particle: βct', (e.x + px) / 2, g.y + 26, { size: 15, align: 'center', title: true });
    }

    // 각도기
    const d = st.drag ?? st.last;
    if (d) {
      const ang = measureAngle(d.a, d.b);
      c.save();
      c.strokeStyle = pal.red;
      c.lineWidth = 2.5;
      c.setLineDash([7, 5]);
      c.beginPath();
      c.moveTo(d.a.x, d.a.y);
      c.lineTo(d.b.x, d.b.y);
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = alpha(pal.red, 0.6);
      c.beginPath();
      c.moveTo(d.a.x, d.a.y);
      c.lineTo(d.a.x + 60, d.a.y);
      c.stroke();
      c.beginPath();
      const dir = d.b.y < d.a.y ? -1 : 1;
      c.arc(d.a.x, d.a.y, 26, 0, dir * ang / DEG, dir < 0);
      c.stroke();
      c.restore();
      text(c, pal, `${ang.toFixed(1)}°`, d.a.x + 32, d.a.y + (dir < 0 ? -30 : 40), { size: 17, title: true });
    }

    // 그래프: θc 와 n
    const narrow = g.W < 600;
    const gw = narrow ? g.W - 40 : Math.min(300, g.W * 0.42);
    const gy = bottom + (narrow ? 30 : 12);
    const gh = g.H - gy - (narrow ? 8 : 18);
    const gx = g.W - gw - 16;
    if (gh > 70) {
      const X = (n: number) => gx + 34 + ((n - 1) / 1) * (gw - 44);
      const Y = (a: number) => gy + gh - 22 - (a / 60) * (gh - 30);
      c.strokeStyle = pal.ink;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(X(1), Y(60));
      c.lineTo(X(1), Y(0));
      c.lineTo(X(2), Y(0));
      c.stroke();
      text(c, pal, 'n', X(2) + 6, Y(0) + 4, { size: 14 });
      text(c, pal, '1.0', X(1), Y(0) + 18, { size: 12, align: 'center' });
      text(c, pal, '2.0', X(2), Y(0) + 18, { size: 12, align: 'center' });
      text(c, pal, '60°', X(1) - 6, Y(60) + 4, { size: 12, align: 'right' });
      text(c, pal, '0°', X(1) - 6, Y(0), { size: 12, align: 'right' });
      text(c, pal, ko ? `θc (β = ${st.beta.toFixed(2)})` : `θc (β = ${st.beta.toFixed(2)})`, X(1) + 6, Y(60) + 4, { size: 13, color: pal.blue });
      c.strokeStyle = pal.blue;
      c.lineWidth = 2;
      c.beginPath();
      let started = false;
      for (let i = 0; i <= 100; i++) {
        const n = 1 + i / 100;
        const a = cherenkovAngle(n, st.beta);
        if (a == null) continue;
        const yy = Y(a * DEG);
        if (!started) {
          c.moveTo(X(n), yy);
          started = true;
        } else c.lineTo(X(n), yy);
      }
      c.stroke();
      c.fillStyle = pal.red;
      for (const m of st.meas) {
        c.beginPath();
        c.arc(X(m.n), Y(m.m), 4.5, 0, TAU);
        c.fill();
      }
    }
    text(c, pal, ko ? '화면을 드래그하면 각도기로 각을 잴 수 있어요' : 'Drag on the canvas to measure an angle', g.m, narrow ? bottom + 20 : g.H - 16, { size: 14, color: pal.blue });

    const nb = st.n * st.beta;
    ui.ro.set(
      th == null
        ? ko
          ? `nβ = ${nb.toFixed(2)} ≤ 1\n빛 원들이 앞으로 흩어질 뿐 겹치지 않음`
          : `nβ = ${nb.toFixed(2)} ≤ 1\nThe circles spread ahead and never line up`
        : ko
          ? `nβ = ${nb.toFixed(2)}\n이론 원뿔 각 θc = ${(th * DEG).toFixed(1)}°\n정확한 측정 ${st.meas.length}개`
          : `nβ = ${nb.toFixed(2)}\nPredicted θc = ${(th * DEG).toFixed(1)}°\nGood measurements: ${st.meas.length}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '1',
    ko: '빛의 충격파',
    en: 'Light shock wave',
    missions: [
      {
        id: 'c1m1',
        ko: '원뿔이 막 생기기 시작하는 속도를 찾아라.',
        en: 'Find the speed at which the cone just begins to form.',
        hint_ko: '속도를 천천히 올리며 원들의 바깥선이 V자로 이어지는 순간을 보세요. nβ가 1을 막 넘는 곳입니다.',
        hint_en: 'Raise the speed slowly and watch for the moment the circles line up into a V. That is where nβ just passes 1.',
      },
      {
        id: 'c1m2',
        ko: '각도기로 원뿔 각 θc를 재서 이론값과 2° 안으로 맞혀라.',
        en: 'Measure the cone angle θc with the protractor to within 2° of theory.',
        hint_ko: '삼각형 보기를 켜면 빨간 선이 빛이 나가는 방향입니다. 궤적 위의 한 점에서 그 선을 따라 드래그하세요.',
        hint_en: 'Turn on the triangle: the red line is the light direction. Drag along it from a point on the track.',
      },
      {
        id: 'c1m3',
        ko: '서로 다른 굴절률 세 가지에서 각을 재어 그래프에 찍어라.',
        en: 'Measure the angle at three different refractive indices and plot them.',
        hint_ko: '물질 버튼으로 물, 얼음, 유리를 바꿔 가며 재 보세요. 굴절률이 0.05 이상 달라야 다른 점으로 셉니다.',
        hint_en: 'Switch between water, ice and glass. Indices must differ by at least 0.05 to count.',
      },
    ],
    content: {
      ko: {
        observe: `<p>입자가 지나간 자리마다 작은 빛 원이 생기고, 원은 얼음 속 빛의 속도 $c/n$으로 커집니다.</p><p>입자가 이 속도보다 느리면 원들은 입자 앞쪽으로 흩어질 뿐입니다. 입자가 더 빠르면 원들의 바깥선이 한 줄로 겹쳐 V자 모양의 빛의 벽이 생깁니다. 이것이 체렌코프 빛입니다.</p><p class="q">원들은 언제 한 줄로 겹칠까? 원뿔의 각도는 무엇이 정할까?</p>`,
        interact: '속도와 굴절률을 바꾸고, 화면을 드래그해 각을 재 보세요. 미션은 선택 사항입니다.',
        understand: `<h4>하위헌스 원리</h4><p>파면의 모든 점은 새로운 작은 파동의 출발점입니다. 입자가 지나가며 계속 작은 빛 원을 만들고, 그 원들의 바깥선(포락선)이 실제로 보이는 빛의 파면이 됩니다.</p><h4>삼각형 하나로 공식 얻기</h4><p>시간 $t$ 동안 입자는 $\\beta c\\,t$를 가고, 그동안 처음 낸 빛은 $(c/n)\\,t$만큼 퍼집니다. 빛이 나가는 방향과 파면은 직각이므로</p>$$\\cos\\theta_c = \\frac{(c/n)\\,t}{\\beta c\\,t} = \\frac{1}{n\\beta}$$<p>코사인 값은 1보다 클 수 없으니, 빛이 생기려면 $n\\beta > 1$, 곧 $\\beta > 1/n$이어야 합니다.</p><h4>소닉붐과 비교</h4><p>초음속 비행기가 만드는 마하 원뿔도 같은 원리입니다. 소리 대신 빛, 비행기 대신 하전 입자일 뿐입니다.</p><h4>빛의 양</h4><p>프랑크-탐 공식에 따르면 나오는 빛의 양은 $\\sin^2\\theta_c$에 비례합니다. 원뿔이 넓을수록 밝습니다.</p><h4>실제와 다른 점</h4><p>실제 원뿔은 3차원이고 빛은 끊임없이 나옵니다. 여기서는 2차원 단면에 원을 띄엄띄엄 그렸습니다.</p>`,
      },
      en: {
        observe: `<p>Everywhere the particle passes, a small circle of light appears and grows at the speed of light in the medium, $c/n$.</p><p>If the particle is slower than that, the circles just spread out ahead of it. If it is faster, their outer edges line up into a V-shaped wall of light. That is Cherenkov light.</p><p class="q">When do the circles line up? What sets the cone angle?</p>`,
        interact: 'Change the speed and index, and drag on the canvas to measure angles. Missions are optional.',
        understand: `<h4>Huygens' principle</h4><p>Every point on a wavefront is the source of a new small wave. The passing particle keeps making small circles of light, and their envelope is the light front we see.</p><h4>One triangle, one formula</h4><p>In time $t$ the particle travels $\\beta c\\,t$ while the first light spreads $(c/n)\\,t$. The light direction is perpendicular to the front, so</p>$$\\cos\\theta_c = \\frac{(c/n)\\,t}{\\beta c\\,t} = \\frac{1}{n\\beta}$$<p>A cosine cannot exceed 1, so light appears only when $n\\beta > 1$, that is $\\beta > 1/n$.</p><h4>Compare with a sonic boom</h4><p>A supersonic jet's Mach cone works the same way, with sound instead of light.</p><h4>How much light</h4><p>The Frank–Tamm formula says the light yield scales with $\\sin^2\\theta_c$. A wider cone is brighter.</p><h4>How this differs from reality</h4><p>The real cone is 3D and light is emitted continuously. Here it is a 2D slice with circles drawn at intervals.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      restart();
      panel();
    },
    panel,
    frame(dt) {
      const g = geo();
      if (!st.tri) {
        st.tau += dt;
        const px = g.m + st.beta * g.c * st.tau;
        const last = st.waves[st.waves.length - 1];
        if (px <= g.W - g.m && (!last || st.tau - last.t0 >= EMIT)) st.waves.push({ x: px, t0: st.tau });
        // 화면 끝에 닿고 잠시 뒤 다시 시작
        if (px > g.W - g.m && st.tau > (g.W - 2 * g.m) / (st.beta * g.c) + 1.1) restart();
      }
      draw();
    },
    reset() {
      Object.assign(st, { n: 1.31, beta: 0.99, tri: false, drag: null, last: null, meas: [] });
      restart();
      panel();
    },
    down(p) {
      st.drag = { a: p, b: p };
    },
    move(p) {
      if (st.drag) st.drag.b = p;
    },
    up() {
      const d = st.drag;
      st.drag = null;
      if (!d || Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) < 20) return;
      const m = clamp(measureAngle(d.a, d.b), 0, 180);
      st.last = { ...d, m };
      record(m);
    },
  };
}
