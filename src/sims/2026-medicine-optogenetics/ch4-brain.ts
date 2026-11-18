// 4장: 살아 있는 뇌의 스위치.
// 원하는 종류의 세포에만 스위치를 달고, 광섬유로 빛을 보내 생쥐의 행동을 바꾼다. 끄는 스위치로 원인을 거꾸로 확인한다.
import { TAU, alpha, clamp, text } from '../canvas';
import { hold, readout, segment, stepButton, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { caption, inBox, pulse, trace, type Box } from './draw';
import { HUES, rng } from './model';

type Region = 'motor' | 'wake';
type Target = 'none' | 'motor' | 'wake' | 'all';
const BLUE = HUES[1].col;
const YELLOW = HUES[4].col;
const SAMPLES = 240;

interface Dot {
  region: Region;
  own: boolean; // 그 영역의 주인공 세포인지 (수염 운동 세포, 각성 세포)
  x: number; // 영역 안 위치 (0~1)
  y: number;
  glow: number;
}

export function chapter4(): Chapter {
  let ctx: Ctx;
  const st = {
    target: 'none' as Target,
    halo: false,
    fiber: 'motor' as Region,
    blue: false,
    yellow: false,
    dots: [] as Dot[],
    awake: true,
    wake: 1, // 1 이면 깨어 있음
    sleepT: 0,
    angle: 0, // 수염 각도 (-1~1)
    phase: 0,
    bout: 0, // 자연스러운 수염 젓기가 남은 초
    nextBout: 1.5,
    twitch: 0, // 엉뚱한 근육 움찔
    blueT: 0,
    yellowT: 0,
    stopped: 0, // 노란 빛으로 멈춘 시간
    resumed: false,
    driven: 0,
    woke: false,
    wokeAfter: 0,
    allTried: false,
    trace: new Array(SAMPLES).fill(0.5) as number[],
    lBlue: new Array(SAMPLES).fill(0) as number[],
    lYellow: new Array(SAMPLES).fill(0) as number[],
    acc: 0,
    mousePress: false,
    t: 0,
    idle: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; blue?: ReturnType<typeof hold>; yellow?: ReturnType<typeof hold>; halo?: ReturnType<typeof toggle> };

  function build(): void {
    const r = rng(77);
    st.dots = [];
    for (const region of ['motor', 'wake'] as Region[]) {
      for (let i = 0; i < 12; i++) st.dots.push({ region, own: i % 2 === 0, x: 0.12 + r() * 0.76, y: 0.18 + r() * 0.64, glow: 0 });
    }
  }

  const hasOn = (d: Dot) => st.target === 'all' || (st.target === d.region && d.own);
  const hasOff = (d: Dot) => st.halo && hasOn(d);
  const lit = (d: Dot) => d.region === st.fiber;
  /** 빛을 받아 켜진 세포들 */
  const firing = () => st.dots.filter((d) => st.blue && lit(d) && hasOn(d) && !(st.yellow && hasOff(d)));
  const motorDriven = () => firing().some((d) => d.region === 'motor' && d.own);
  const wakeDriven = () => firing().some((d) => d.region === 'wake' && d.own);
  const othersDriven = () => firing().some((d) => !d.own);
  const motorSilenced = () => st.yellow && st.fiber === 'motor' && st.halo && (st.target === 'motor' || st.target === 'all');

  function sleep(): void {
    st.awake = false;
    st.wake = 0;
    st.sleepT = 0;
    st.woke = false;
    st.idle = 0;
  }

  // ---------- 판정 ----------
  function check(): void {
    if (st.driven > 1 && st.target === 'motor') {
      ctx.host.complete('c4m1', tr(ctx, '파란 빛에 맞춰 수염이 움직였어요', 'Whiskers moved with the blue light'));
      ctx.note('whisker', '운동 피질의 수염 담당 세포에만 채널로돕신을 넣고 광섬유로 파란 빛을 보내자, 빛에 맞춰 생쥐의 수염이 움직였다.', 'With channelrhodopsin only in the whisker cells of the motor cortex, blue light down the optical fibre moved the mouse\'s whiskers in time with the light.');
    } else if (st.target !== 'motor') ctx.host.result('c4m1', tr(ctx, '운동 피질 세포에만 스위치를 다세요', 'Put the switch only in motor cortex cells'));
    else if (st.fiber !== 'motor') ctx.host.result('c4m1', tr(ctx, '광섬유를 운동 피질로 옮기세요', 'Move the fibre to the motor cortex'));
    else ctx.host.result('c4m1', tr(ctx, '파란 빛을 누르고 있으세요', 'Hold the blue light'));

    if (st.woke) {
      ctx.host.complete('c4m2', tr(ctx, `빛을 비춘 지 ${st.wokeAfter.toFixed(1)}초 만에 깸`, `Woke after ${st.wokeAfter.toFixed(1)} s of light`));
      ctx.note('wake', `각성 세포에 스위치를 달고 빛을 보내자, 잠든 생쥐가 ${st.wokeAfter.toFixed(1)}초 만에 깨어났다. 몇 개 안 되는 세포 무리가 잠과 깸을 바꿀 수 있었다.`, `Light on switch-carrying wake cells woke the sleeping mouse in ${st.wokeAfter.toFixed(1)} s. A small group of cells could flip sleep to waking.`);
    } else if (st.awake) ctx.host.result('c4m2', tr(ctx, '먼저 "생쥐 재우기"를 누르세요', 'First press "Put the mouse to sleep"'));
    else if (st.target !== 'wake') ctx.host.result('c4m2', tr(ctx, '각성 세포에 스위치를 다세요', 'Put the switch in the wake cells'));
    else if (st.fiber !== 'wake') ctx.host.result('c4m2', tr(ctx, '광섬유를 각성 세포 쪽으로 옮기세요', 'Move the fibre to the wake cells'));
    else ctx.host.result('c4m2', tr(ctx, `깨어나는 중 ${Math.round(st.wake * 100)}%`, `Waking ${Math.round(st.wake * 100)}%`));

    if (st.stopped > 1.5 && st.resumed) {
      ctx.host.complete('c4m3', tr(ctx, '노란 빛에 멈추고, 끄자 다시 움직임', 'Stopped under yellow, moved again after'));
      ctx.note('off', '끄는 스위치를 함께 넣고 노란 빛을 보내자 수염의 자연스러운 움직임이 멈췄고, 빛을 끄자 다시 움직였다. 켜서 생기고 꺼서 사라지니, 그 세포가 원인이라고 말할 수 있다.', 'With the off switch added, yellow light stopped the natural whisking, and it returned once the light went off. Switching on causes it and switching off removes it, so those cells are the cause.');
    } else if (!st.halo) ctx.host.result('c4m3', tr(ctx, '"끄는 스위치도 함께"를 켜세요', 'Switch on "Add the off switch"'));
    else if (st.stopped > 1.5) ctx.host.result('c4m3', tr(ctx, '이제 노란 빛을 떼어 보세요', 'Now let go of the yellow light'));
    else ctx.host.result('c4m3', tr(ctx, `깨어 있는 생쥐에게 노란 빛 ${st.stopped.toFixed(1)}/1.5초`, `Yellow on the awake mouse ${st.stopped.toFixed(1)}/1.5 s`));
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
    const target = segment<Target>({
      label: ko ? '켜는 스위치(채널로돕신)를 달 세포' : 'Cells that get the on switch (channelrhodopsin)',
      options: [
        { v: 'none', label: ko ? '없음' : 'None' },
        { v: 'motor', label: ko ? '수염 운동 세포' : 'Whisker motor cells' },
        { v: 'wake', label: ko ? '각성 세포' : 'Wake cells' },
        { v: 'all', label: ko ? '모든 세포' : 'Every cell' },
      ],
      value: st.target,
      onChange: (v) => {
        st.target = v;
        if (v === 'all') st.allTried = false;
        st.idle = 0;
        check();
      },
    });
    const fiber = segment<Region>({
      label: ko ? '광섬유 위치' : 'Fibre position',
      options: [
        { v: 'motor', label: ko ? '운동 피질' : 'Motor cortex' },
        { v: 'wake', label: ko ? '시상하부 (각성 세포)' : 'Hypothalamus (wake cells)' },
      ],
      value: st.fiber,
      onChange: (v) => {
        st.fiber = v;
        st.idle = 0;
        check();
      },
    });
    ui = {
      ro: readout(),
      halo: toggle({
        label: ko ? '끄는 스위치도 함께 (할로로돕신)' : 'Add the off switch (halorhodopsin)',
        on: st.halo,
        onText: ko ? '넣음' : 'Added',
        offText: ko ? '안 넣음' : 'Not added',
        onChange: (v) => {
          st.halo = v;
          check();
        },
      }),
      blue: hold({ label: ko ? '파란 빛 (누르고 있기)' : 'Blue light (hold)', onChange: (on) => ((st.blue = on), (st.idle = 0)) }),
      yellow: hold({ label: ko ? '노란 빛 (누르고 있기)' : 'Yellow light (hold)', onChange: (on) => ((st.yellow = on), (st.idle = 0)) }),
    };
    ctx.host.controls.append(target.el, ui.halo!.el, fiber.el, row(ui.blue!.el, ui.yellow!.el), stepButton({ label: ko ? '생쥐 재우기' : 'Put the mouse to sleep', onClick: sleep }).el, ui.ro.el);
  }

  // ---------- 배치 ----------
  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 60 : 56;
    if (!narrow) {
      const mouse: Box = { x: 16, y: top + 20, w: W * 0.5 - 30, h: (H - top) * 0.55 };
      const mapX = W * 0.5 + 10;
      const mapW = W - mapX - 16;
      const regH = Math.min((H - top) * 0.26, mapW * 0.4);
      const regions: Record<Region, Box> = {
        motor: { x: mapX, y: top + 30, w: mapW, h: regH },
        wake: { x: mapX, y: top + 80 + regH, w: mapW, h: regH },
      };
      const ty = Math.max(mouse.y + mouse.h + 30, regions.wake.y + regH + 30);
      const tr0: Box = { x: 16, y: ty + 22, w: W - 32, h: Math.max(40, H - ty - 50) };
      return { W, H, narrow, top, mouse, regions, tr0, ty };
    }
    const mouse: Box = { x: 10, y: top + 6, w: W - 20, h: (H - top) * 0.34 };
    const y2 = mouse.y + mouse.h + 24;
    const regH = Math.min((H - y2) * 0.24, W * 0.3);
    const rw = (W - 30) / 2;
    const regions: Record<Region, Box> = {
      motor: { x: 10, y: y2, w: rw, h: regH },
      wake: { x: 20 + rw, y: y2, w: rw, h: regH },
    };
    const ty = y2 + regH + 26;
    const tr0: Box = { x: 10, y: ty + 22, w: W - 20, h: Math.max(36, H - ty - 46) };
    return { W, H, narrow, top, mouse, regions, tr0, ty };
  };

  // ---------- 매 프레임 ----------
  function step(dt: number): void {
    if (dt === 0) return;
    st.blueT = st.blue ? st.blueT + dt : 0;
    st.yellowT = st.yellow ? st.yellowT + dt : 0;
    // 잠과 깸
    if (!st.awake) {
      st.sleepT += dt;
      if (wakeDriven()) st.wake += dt / 3.5;
      else st.wake += dt / 45; // 그냥 두어도 언젠가는 깬다
      if (st.wake >= 1) {
        st.awake = true;
        st.wake = 1;
        if (st.target === 'wake' && st.fiber === 'wake') {
          st.woke = true;
          st.wokeAfter = st.sleepT;
        }
        check();
      }
    }
    // 수염
    let amp = 0;
    let freq = 8;
    if (st.awake) {
      st.nextBout -= dt;
      if (st.nextBout <= 0 && st.bout <= 0) {
        st.bout = 1.8;
        st.nextBout = 3.5;
      }
      if (st.bout > 0) {
        st.bout -= dt;
        amp = 0.45;
      }
    }
    if (motorDriven()) {
      amp = 1;
      freq = 5;
      st.driven += dt;
    }
    if (motorSilenced() && st.awake) {
      if (st.bout > 0) st.stopped += dt;
      amp = 0;
      st.resumed = false;
    } else if (st.stopped > 1.5 && amp > 0.3) st.resumed = true;
    st.phase += dt * freq * TAU;
    const want = amp * Math.sin(st.phase);
    st.angle += (want - st.angle) * clamp(dt * 20, 0, 1);
    // 엉뚱한 세포
    if (othersDriven()) {
      st.twitch = 1;
      if (!st.allTried) {
        st.allTried = true;
        ctx.host.toast(tr(ctx, '모든 세포가 켜져서 다리까지 움찔해요. 원하는 세포만 고르는 게 광유전학의 힘이에요.', 'Every cell fires, so even the legs jerk. Picking only the cells you want is what makes optogenetics powerful.'));
        ctx.note('specific', '모든 세포에 스위치를 달자 빛을 보낸 곳의 엉뚱한 세포까지 켜져 다리가 움찔했다. 세포 종류를 골라 유전자를 넣어야 원하는 행동만 바꿀 수 있다.', 'With the switch in every cell, unrelated cells near the fibre fired too and the legs jerked. Choosing the cell type is what lets you change only the behaviour you want.');
      }
    }
    st.twitch = Math.max(0, st.twitch - dt * 2);
    for (const d of st.dots) d.glow = Math.max(0, d.glow - dt * 3);
    const fire = firing();
    const r = rng(Math.floor(st.t * 500));
    for (const d of fire) if (r() < dt * 12) d.glow = 1;
    // 자연스러운 수염 젓기 동안 운동 세포가 스스로 켜짐 (끄는 스위치가 막지 않을 때)
    if (amp > 0 && !motorDriven()) for (const d of st.dots) if (d.region === 'motor' && d.own && r() < dt * 6) d.glow = 0.7;
    // 그래프
    st.acc += dt;
    while (st.acc >= 1 / 40) {
      st.acc -= 1 / 40;
      st.trace.push(0.5 + st.angle * 0.45);
      st.trace.shift();
      st.lBlue.push(st.blue ? 1 : 0);
      st.lBlue.shift();
      st.lYellow.push(st.yellow ? 1 : 0);
      st.lYellow.shift();
    }
    if (Math.floor(st.t * 4) !== Math.floor((st.t - dt) * 4)) check();
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
      ko ? '어느 세포에 스위치를 달지 고르고, 광섬유를 둔 곳에 빛을 보내 생쥐의 행동을 바꿔 보세요.' : 'Choose which cells get the switch, then send light down the fibre to change what the mouse does.',
      16,
      24,
      L.W - 32,
      L.narrow ? 13 : 15,
    );
    drawMouse(c, L.mouse, ko);
    for (const reg of ['motor', 'wake'] as Region[]) drawRegion(c, reg, L.regions[reg], ko);
    // 그래프
    text(c, pal, ko ? '수염 움직임' : 'whisker movement', L.tr0.x, L.tr0.y - 8, { size: 11 });
    const bars = (arr: number[], col: string, y: number) => {
      c.fillStyle = alpha(col, 0.55);
      const w = L.tr0.w / SAMPLES;
      arr.forEach((v, i) => v && c.fillRect(L.tr0.x + i * w, y, w + 0.5, 6));
    };
    bars(st.lBlue, BLUE, L.tr0.y + L.tr0.h + 4);
    bars(st.lYellow, YELLOW, L.tr0.y + L.tr0.h + 12);
    trace(c, pal, L.tr0, st.trace, { zero: 0.5, lw: 2 });
    text(c, pal, ko ? '아래 막대: 파란 빛, 노란 빛' : 'bars below: blue light, yellow light', L.tr0.x + L.tr0.w, L.tr0.y - 8, { size: 11, align: 'right' });
    // 힌트
    if (st.idle > 6) {
      if (st.target === 'none') pulse(c, pal, L.regions.motor.x + L.regions.motor.w / 2, L.regions.motor.y + L.regions.motor.h / 2, L.regions.motor.h * 0.5, st.t);
      else if (!st.blue) {
        const R = L.regions[st.fiber];
        pulse(c, pal, R.x + R.w / 2, R.y + R.h / 2, R.h * 0.5, st.t);
      }
    }
    const targetName = { none: ko ? '없음' : 'none', motor: ko ? '수염 운동 세포' : 'whisker motor cells', wake: ko ? '각성 세포' : 'wake cells', all: ko ? '모든 세포' : 'every cell' }[st.target];
    ui.ro.set(
      ko
        ? `켜는 스위치: ${targetName}${st.halo ? ', 끄는 스위치 함께' : ''}\n광섬유: ${st.fiber === 'motor' ? '운동 피질' : '시상하부'}\n생쥐: ${st.awake ? '깨어 있음' : `자는 중 (깨어나는 정도 ${Math.round(st.wake * 100)}%)`}`
        : `On switch: ${targetName}${st.halo ? ', plus off switch' : ''}\nFibre: ${st.fiber === 'motor' ? 'motor cortex' : 'hypothalamus'}\nMouse: ${st.awake ? 'awake' : `asleep (waking ${Math.round(st.wake * 100)}%)`}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  function drawMouse(c: CanvasRenderingContext2D, R: Box, ko: boolean): void {
    const pal = ctx.pal();
    const s = Math.min(R.w / 320, R.h / 170);
    const ox = R.x + (R.w - 320 * s) / 2;
    const oy = R.y + (R.h - 170 * s) / 2 + 20 * s;
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;
    c.save();
    c.lineWidth = 2;
    c.strokeStyle = pal.ink;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    // 숨 쉬는 느낌: 몸이 아주 조금 오르내린다
    const breathe = Math.sin(st.t * (st.awake ? 2.4 : 1.2)) * (st.awake ? 1.2 : 2);
    const B = (y: number) => Y(y + breathe);
    // 꼬리 (동글게 말린 꼬리)
    c.strokeStyle = pal.ink;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(X(84), B(118));
    c.bezierCurveTo(X(52), B(136), X(26), B(126), X(22), B(106));
    c.bezierCurveTo(X(19), B(92), X(36), B(88), X(38), B(100));
    c.stroke();
    // 뒷발과 앞발 (움찔하면 들썩)
    const tw = st.twitch * Math.sin(st.t * 40) * 5;
    c.fillStyle = alpha(pal.ink, 0.1);
    c.lineWidth = 2;
    for (const [lx, ly] of [
      [124, 134],
      [206, 136],
    ]) {
      c.beginPath();
      c.ellipse(X(lx + tw), B(ly + Math.abs(tw) * 0.4), 15 * s, 7.5 * s, 0, 0, TAU);
      c.fill();
      c.stroke();
    }
    // 몸과 머리를 한 덩어리로 (통통한 실루엣)
    c.fillStyle = alpha(pal.ink, 0.07);
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(X(84), B(112));
    c.bezierCurveTo(X(80), B(72), X(120), B(50), X(164), B(52));
    c.bezierCurveTo(X(198), B(54), X(216), B(64), X(232), B(74));
    c.bezierCurveTo(X(258), B(82), X(280), B(94), X(288), B(104));
    c.bezierCurveTo(X(293), B(112), X(284), B(119), X(272), B(119));
    c.bezierCurveTo(X(252), B(124), X(242), B(128), X(230), B(132));
    c.bezierCurveTo(X(196), B(146), X(122), B(146), X(98), B(132));
    c.bezierCurveTo(X(88), B(126), X(84), B(120), X(84), B(112));
    c.fill();
    c.stroke();
    // 귀 (크고 동그랗게)
    c.fillStyle = alpha(pal.ink, 0.07);
    c.beginPath();
    c.arc(X(214), B(56), 21 * s, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = alpha(pal.red, 0.3);
    c.beginPath();
    c.arc(X(214), B(56), 11 * s, 0, TAU);
    c.fill();
    // 볼 (발그레)
    c.fillStyle = alpha(pal.red, 0.22);
    c.beginPath();
    c.ellipse(X(264), B(104), 10 * s, 6.5 * s, 0, 0, TAU);
    c.fill();
    // 눈
    if (st.awake) {
      c.fillStyle = pal.ink;
      c.beginPath();
      c.arc(X(258), B(94), 5 * s, 0, TAU);
      c.fill();
      // 눈동자 반짝임
      c.fillStyle = pal.surface || '#fff';
      c.beginPath();
      c.arc(X(259.6), B(92.2), 1.8 * s, 0, TAU);
      c.fill();
    } else {
      c.strokeStyle = pal.ink;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(X(251), B(94));
      c.quadraticCurveTo(X(258), B(100), X(265), B(94));
      c.stroke();
      const zz = (st.t * 0.6) % 1;
      text(c, pal, 'z', X(276 + zz * 18), B(52 - zz * 26), { size: 13 * s + 6, color: alpha(pal.ink, 1 - zz) });
      text(c, pal, 'Z', X(292 + zz * 18), B(36 - zz * 26), { size: 17 * s + 6, color: alpha(pal.ink, 0.7 * (1 - zz)) });
    }
    // 코
    c.fillStyle = pal.red;
    c.beginPath();
    c.ellipse(X(287), B(106), 4.5 * s, 3.6 * s, 0, 0, TAU);
    c.fill();
    // 수염
    c.strokeStyle = pal.blue;
    c.lineWidth = 1.6;
    const base = { x: X(284), y: B(108) };
    for (const off of [-0.5, -0.2, 0.12, 0.42]) {
      const a = off + st.angle * 0.5;
      c.beginPath();
      c.moveTo(base.x, base.y);
      c.quadraticCurveTo(base.x + 28 * s * Math.cos(a), base.y + 28 * s * Math.sin(a) - 5 * s, base.x + 52 * s * Math.cos(a), base.y + 52 * s * Math.sin(a));
      c.stroke();
    }
    // 광섬유
    const fx = X(st.fiber === 'motor' ? 238 : 252);
    const fy = B(72);
    c.strokeStyle = pal.ink;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(fx, fy);
    c.lineTo(fx, Y(-10));
    c.stroke();
    c.fillStyle = alpha(pal.ink, 0.6);
    c.beginPath();
    c.roundRect(fx - 6, fy - 10, 12, 12, 3);
    c.fill();
    const col = st.blue ? BLUE : st.yellow ? YELLOW : null;
    if (col) {
      c.strokeStyle = alpha(col, 0.9);
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(fx, fy - 4);
      c.lineTo(fx, Y(-10));
      c.stroke();
      c.fillStyle = alpha(col, 0.35);
      c.beginPath();
      c.arc(fx, fy + 4, 13 * s, 0, TAU);
      c.fill();
    }
    c.restore();
    text(c, pal, ko ? '광섬유' : 'optical fibre', fx + 8, Y(-2), { size: 11 });
    if (st.twitch > 0.1) text(c, pal, ko ? '다리가 움찔!' : 'legs jerk!', X(150), Y(165), { size: 12, align: 'center', color: pal.blue });
  }

  function drawRegion(c: CanvasRenderingContext2D, reg: Region, R: Box, ko: boolean): void {
    const pal = ctx.pal();
    const here = st.fiber === reg;
    c.save();
    c.strokeStyle = here ? pal.blue : alpha(pal.ink, 0.45);
    c.lineWidth = here ? 2.5 : 1.3;
    c.beginPath();
    c.roundRect(R.x, R.y, R.w, R.h, 12);
    c.stroke();
    if (here && (st.blue || st.yellow)) {
      const g = c.createRadialGradient(R.x + R.w / 2, R.y + R.h / 2, 0, R.x + R.w / 2, R.y + R.h / 2, R.w * 0.6);
      const col = st.blue ? BLUE : YELLOW;
      g.addColorStop(0, alpha(col, 0.3));
      g.addColorStop(1, alpha(col, 0));
      c.fillStyle = g;
      c.fill();
    }
    c.restore();
    const title = reg === 'motor' ? (ko ? '운동 피질' : 'Motor cortex') : ko ? '시상하부' : 'Hypothalamus';
    text(c, pal, title + (here ? (ko ? '  (광섬유)' : '  (fibre)') : ''), R.x + 8, R.y - 8, { size: 12, title: true, color: here ? pal.blue : pal.ink });
    const rr = Math.max(4, Math.min(R.w, R.h) * 0.05);
    for (const d of st.dots) {
      if (d.region !== reg) continue;
      const x = R.x + d.x * R.w;
      const y = R.y + d.y * R.h;
      if (d.glow > 0.02) {
        c.fillStyle = alpha(pal.red, 0.4 * d.glow);
        c.beginPath();
        c.arc(x, y, rr * 2.2, 0, TAU);
        c.fill();
      }
      // 주인공 세포는 세모, 다른 세포는 동그라미 (색을 못 봐도 구별)
      c.lineWidth = 1.8;
      c.strokeStyle = pal.ink;
      c.fillStyle = hasOn(d) ? pal.blue : alpha(pal.ink, 0.12);
      c.beginPath();
      if (d.own) {
        c.moveTo(x, y - rr * 1.2);
        c.lineTo(x + rr * 1.1, y + rr * 0.8);
        c.lineTo(x - rr * 1.1, y + rr * 0.8);
        c.closePath();
      } else c.arc(x, y, rr * 0.9, 0, TAU);
      c.fill();
      c.stroke();
      if (hasOff(d)) {
        c.strokeStyle = YELLOW;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, rr * 1.7, 0, TAU);
        c.stroke();
      }
    }
    const own = reg === 'motor' ? (ko ? '세모: 수염 운동 세포' : 'triangles: whisker motor cells') : ko ? '세모: 각성 세포' : 'triangles: wake cells';
    text(c, pal, own, R.x + 8, R.y + R.h + 14, { size: 10 });
  }

  // ---------- 입력 ----------
  function down(p: Pt): void {
    st.idle = 0;
    const L = lay();
    for (const reg of ['motor', 'wake'] as Region[]) {
      if (inBox(L.regions[reg], p.x, p.y)) {
        // 영역을 누르면 광섬유를 그리로 옮긴다
        if (st.fiber !== reg) {
          st.fiber = reg;
          panel();
          check();
        }
        return;
      }
    }
    if (inBox(L.mouse, p.x, p.y)) {
      st.blue = true;
      st.mousePress = true;
    }
  }

  function up(): void {
    if (st.mousePress) {
      st.blue = false;
      st.mousePress = false;
    }
  }

  return {
    id: '4',
    ko: '살아 있는 뇌의 스위치',
    en: 'A switch in the living brain',
    missions: [
      {
        id: 'c4m1',
        ko: '운동 피질의 수염 세포에만 켜는 스위치를 달고, 파란 빛으로 생쥐의 수염을 움직여라.',
        en: 'Give only the whisker cells of the motor cortex the on switch and move the mouse\'s whiskers with blue light.',
        hint_ko: '"수염 운동 세포"를 고르고 광섬유를 운동 피질에 둔 뒤, 파란 빛을 누르고 있으세요. 생쥐 그림을 눌러도 파란 빛이 나갑니다.',
        hint_en: 'Choose "Whisker motor cells", put the fibre on the motor cortex, and hold the blue light. Pressing the mouse picture sends blue light too.',
      },
      {
        id: 'c4m2',
        ko: '잠든 생쥐를, 각성 세포에 단 스위치로 깨워라.',
        en: 'Wake the sleeping mouse through a switch in its wake cells.',
        hint_ko: '"생쥐 재우기"를 누르고, 스위치를 각성 세포에 달고 광섬유를 시상하부로 옮긴 뒤 파란 빛을 보내세요.',
        hint_en: 'Press "Put the mouse to sleep", give the wake cells the switch, move the fibre to the hypothalamus and send blue light.',
      },
      {
        id: 'c4m3',
        ko: '끄는 스위치를 함께 넣고, 노란 빛으로 수염의 자연스러운 움직임을 멈췄다가 다시 풀어라.',
        en: 'Add the off switch, stop the natural whisking with yellow light, then let it go again.',
        hint_ko: '수염 운동 세포에 두 스위치를 모두 넣고 깨어 있는 생쥐에게 노란 빛을 1.5초 넘게 보낸 뒤 떼세요.',
        hint_en: 'Put both switches in the whisker motor cells, hold yellow light on the awake mouse for over 1.5 s, then release.',
      },
    ],
    content: {
      ko: {
        observe: `<p>접시 속 신경세포를 켤 수 있게 되자, 다음 질문은 분명했습니다. 살아 움직이는 동물의 뇌에서도 될까?</p><p>뇌 속 빛은 금방 흩어지므로, 다이서로스 연구진은 머리에 가는 <b>광섬유</b>를 심어 빛을 깊숙이 보냈습니다. 그리고 특정 종류의 세포에서만 켜지는 유전자 스위치를 붙여, 채널로돕신이 원하는 세포에만 생기게 했습니다. 2005년 첫 발표에서 2년 뒤인 2007년, 이 방법이 살아 있는 생쥐의 뇌에서 작동했습니다.</p><p class="q">어느 세포를 켜느냐에 따라 생쥐는 무엇을 할까?</p>`,
        interact: '스위치를 달 세포와 광섬유 위치를 고르고, 파란 빛과 노란 빛을 보내 보세요.',
        understand: `<h4>원하는 세포만 고르기</h4><p>모든 세포는 같은 유전자를 갖고 있지만, 세포 종류마다 켜지는 유전자가 다릅니다. 어떤 세포에서만 켜지는 유전자의 앞부분(프로모터)을 채널로돕신 유전자 앞에 붙이면, 그 세포에만 스위치가 생깁니다. 전극은 닿는 세포를 모두 자극하지만, 광유전학은 섞여 있는 세포들 가운데 한 종류만 켤 수 있습니다.</p><h4>2007년의 생쥐들</h4><p>다이서로스 연구진은 운동 피질 세포에 채널로돕신-2를 넣고 광섬유로 빛을 보내 생쥐의 수염을 움직였습니다. 같은 해에는 시상하부의 각성 관련 세포(하이포크레틴 세포)를 빛으로 켜서 잠든 생쥐를 더 빨리 깨웠습니다. 몇 안 되는 세포 무리가 잠과 깸을 바꾼다는 직접적인 증거였습니다.</p><h4>켜고, 끄고</h4><p>세포를 켰을 때 행동이 생기고 껐을 때 사라지면, 그 세포가 행동의 원인이라고 말할 수 있습니다. 노란 빛에 반응해 세포를 조용하게 만드는 <b>할로로돕신</b> 같은 끄는 스위치가 뒤이어 함께 쓰이며 이런 실험이 가능해졌습니다.</p>$$\\text{켜면 생김} \\;+\\; \\text{끄면 사라짐} \\;\\Rightarrow\\; \\text{원인}$$<h4>지금은</h4><p>광유전학으로 기억, 감정, 행동을 이끄는 신경 회로가 하나씩 밝혀지고 있습니다. 시력을 잃은 사람의 망막 세포에 빛 스위치를 넣어 빛을 다시 느끼게 하려는 시도도 이어지고 있습니다.</p><h4>실제와 다른 점</h4><p>생쥐의 행동과 반응 시간은 크게 단순화했습니다. 실제로는 빛을 일정한 박자로 깜빡여 보내고, 깨어나는 시간도 생쥐마다 다릅니다. 할로로돕신은 수상 사유의 채널로돕신과 다른 단백질(이온 펌프)로, 원리를 보여 주려고 함께 넣었습니다.</p>`,
      },
      en: {
        observe: `<p>Once neurons in a dish could be switched on, the next question was obvious: would it work in the brain of a living, moving animal?</p><p>Light scatters quickly in the brain, so Deisseroth's team implanted a thin <b>optical fibre</b> to carry light deep inside. They also attached a genetic switch that is only active in certain cell types, so channelrhodopsin appeared only where they wanted. In 2007, two years after the first report, the method worked in the brains of living mice.</p><p class="q">Depending on which cells you switch on, what will the mouse do?</p>`,
        interact: 'Choose the cells that get the switch and where the fibre goes, then send blue and yellow light.',
        understand: `<h4>Picking only the cells you want</h4><p>Every cell carries the same genes, but each cell type switches on different ones. Put the front part (promoter) of a gene that is active only in one cell type in front of the channelrhodopsin gene, and only that type gets the switch. An electrode stimulates every cell it touches; optogenetics can switch on one type among many mixed together.</p><h4>The mice of 2007</h4><p>Deisseroth's team put channelrhodopsin-2 into motor cortex cells and moved a mouse's whiskers with light through a fibre. The same year, switching on wake-related cells of the hypothalamus (hypocretin cells) with light woke sleeping mice sooner. It was direct evidence that a small group of cells can flip sleep to waking.</p><h4>On and off</h4><p>If a behaviour appears when cells are switched on and disappears when they are switched off, those cells cause it. Off switches such as <b>halorhodopsin</b>, which quiets cells in yellow light, soon joined the toolbox and made such tests possible.</p>$$\\text{on brings it} \\;+\\; \\text{off removes it} \\;\\Rightarrow\\; \\text{cause}$$<h4>Today</h4><p>Optogenetics is mapping the circuits behind memories, feelings and behaviour one by one. Researchers are also trying to put light switches into retinal cells of people who have lost their sight, so they can sense light again.</p><h4>How this differs from reality</h4><p>The mouse's behaviour and timing are greatly simplified. Real experiments pulse the light at a set rhythm, and waking times vary from mouse to mouse. Halorhodopsin is a different protein (an ion pump) from the prize-winning channelrhodopsin; it is included to show the idea.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      if (!st.dots.length) build();
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
      Object.assign(st, { target: 'none', halo: false, fiber: 'motor', blue: false, yellow: false, awake: true, wake: 1, driven: 0, stopped: 0, resumed: false, woke: false, allTried: false });
      panel();
      check();
    },
    leave() {
      st.blue = false;
      st.yellow = false;
      ui.blue?.release();
      ui.yellow?.release();
    },
    down,
    up,
  };
}
