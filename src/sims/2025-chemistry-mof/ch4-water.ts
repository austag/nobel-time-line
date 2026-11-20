// 4장: 사막 공기에서 물 얻기 (그 뒤의 이야기).
// 밤에는 MOF가 수증기를 붙잡고, 낮에는 햇빛으로 데워 내보내 물을 모은다.
// 물 흡착 계단이 밤 습도와 데운 상태 사이에 있어야 하루 순환에서 물이 나온다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { axes, caption, type Box } from './draw';
import { WATER, dayYield, heatedRH, water, type Harvester } from './model';

type Guess = 'low' | 'high' | 'any';

const NAME: Record<Harvester, [string, string]> = {
  mof303: ['MOF-303', 'MOF-303'],
  mof801: ['MOF-801', 'MOF-801'],
  stepHigh: ['계단 높은 MOF', 'high-step MOF'],
  silica: ['실리카겔', 'silica gel'],
};
const DAY_RH = 10;
const DAY_T = 35;
const CYCLE = 3.2;

export function chapter4(): Chapter {
  let ctx: Ctx;
  const st = {
    h: 'mof303' as Harvester,
    rh: 30,
    tMof: 70,
    guess: null as Guess | null,
    runs: [] as { h: Harvester; rh: number; tMof: number; g: number }[],
    phase: -1, // -1 멈춤, 0~1 하루 순환
    t: 0,
  };
  let ui: { ro: ReturnType<typeof readout> };

  const nm = (h: Harvester) => NAME[h][k(ctx) ? 0 : 1];

  function run(): void {
    if (st.phase >= 0) return;
    st.phase = 0;
    if (ctx.host.reduced) finish();
  }
  function finish(): void {
    st.phase = -1;
    st.runs.push({ h: st.h, rh: st.rh, tMof: st.tMof, g: dayYield(st.h, st.rh, st.tMof, DAY_RH, DAY_T) });
    check();
  }

  function check(): void {
    const ko = k(ctx);
    const kinds = new Set(st.runs.map((r) => r.h));
    const gName = (g: Guess) => ({ low: ko ? '낮은 습도에서 물을 붙잡는 것' : 'one that grabs water at low humidity', high: ko ? '높은 습도에서 물을 붙잡는 것' : 'one that grabs water at high humidity', any: ko ? '상관없음' : 'it does not matter' })[g];
    if (st.guess == null) ctx.host.result('c4m1', tr(ctx, '먼저 예상을 고르세요', 'First pick a guess'));
    else if (kinds.size >= 2) {
      const best = st.runs.reduce((a, b) => (b.g > a.g ? b : a));
      ctx.host.complete('c4m1', tr(ctx, `${kinds.size}종 가운데 가장 많은 것: ${nm(best.h)}, 하루 ${Math.round(best.g)} g (내 예상: ${gName(st.guess)})`, `Ran ${kinds.size} kinds; ${nm(best.h)} gave the most, ${Math.round(best.g)} g a day (my guess: ${gName(st.guess)})`));
      ctx.note('compare', `흡착제 ${kinds.size}종으로 하루 순환을 돌리자 ${nm(best.h)} 1 kg이 하루 ${Math.round(best.g)} g으로 가장 많은 물을 모았다 (예상: ${gName(st.guess)}). 물을 붙잡는 습도(계단 위치)가 결과를 갈랐다.`, `Running a day cycle with ${kinds.size} kinds, ${nm(best.h)} collected the most, ${Math.round(best.g)} g per kg per day (I guessed ${gName(st.guess)}). Where the water step sits decided the outcome.`);
    } else ctx.host.result('c4m1', tr(ctx, `돌려 본 흡착제 ${kinds.size}/2`, `Sorbents run ${kinds.size}/2`));

    const desert = st.runs.find((r) => r.rh <= 30 && r.g >= 150);
    if (desert) {
      ctx.host.complete('c4m2', tr(ctx, `밤 습도 ${desert.rh}%, MOF ${desert.tMof}°C에서 하루 ${Math.round(desert.g)} g (실제 데스밸리 114~210 g)`, `Night humidity ${desert.rh}%, MOF at ${desert.tMof}°C: ${Math.round(desert.g)} g a day (Death Valley in reality: 114–210 g)`));
      ctx.note('desert', `밤 습도 ${desert.rh}%인 사막 조건에서 ${nm(desert.h)} 1 kg을 햇빛으로 ${desert.tMof}°C까지 데우자 하루 ${Math.round(desert.g)} g의 물을 얻었다. 실제 MOF-303 장치는 2022년 데스밸리에서 114~210 g을 모았다.`, `Under desert conditions (night humidity ${desert.rh}%), heating ${nm(desert.h)} to ${desert.tMof}°C in sunlight gave ${Math.round(desert.g)} g of water per kg per day. The real MOF-303 harvester collected 114–210 g in Death Valley in 2022.`);
    } else ctx.host.result('c4m2', tr(ctx, '밤 습도 30% 이하에서 하루 150 g 넘게 모아 보세요', 'Collect over 150 g a day with night humidity at or below 30%'));

    const fail = st.runs.find((r) => (r.h === 'stepHigh' || r.h === 'silica') && r.rh <= 30 && r.g < 40);
    if (fail) {
      ctx.host.complete('c4m3', tr(ctx, `${nm(fail.h)}: 밤 습도 ${fail.rh}%에서 하루 ${Math.round(fail.g)} g`, `${nm(fail.h)}: ${Math.round(fail.g)} g a day at ${fail.rh}% night humidity`));
      ctx.note('step', `${nm(fail.h)}의 계단은 습도 ${WATER[fail.h].step}% 근처에 있어, 밤 습도 ${fail.rh}%에서는 구멍이 거의 차지 않아 1 kg당 하루 ${Math.round(fail.g)} g뿐이었다. 사막에서는 계단이 밤 습도보다 낮아야 한다.`, `${nm(fail.h)} takes up water around ${WATER[fail.h].step}% humidity, so at ${fail.rh}% at night its pores barely filled: only ${Math.round(fail.g)} g a day. In the desert the step must sit below the night humidity.`);
    } else ctx.host.result('c4m3', tr(ctx, '계단이 높은 MOF나 실리카겔을 밤 습도 30% 이하에서 돌려 보세요', 'Run the high-step MOF or silica gel at night humidity of 30% or less'));
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    ui = { ro: readout() };
    const g = segment<Guess>({
      label: ko ? '내 예상: 사막에서 물을 많이 모으는 것은?' : 'My guess: what collects the most water in the desert?',
      options: [
        { v: 'low', label: ko ? '낮은 습도에서 물을 붙잡는 것' : 'grabs water at low humidity' },
        { v: 'high', label: ko ? '높은 습도에서 물을 붙잡는 것' : 'grabs water at high humidity' },
        { v: 'any', label: ko ? '상관없음' : 'does not matter' },
      ],
      value: st.guess ?? ('' as Guess),
      onChange: (v) => ((st.guess = v), check()),
    });
    const hv = segment<Harvester>({
      label: ko ? '흡착제 (1 kg)' : 'Sorbent (1 kg)',
      options: (['mof303', 'mof801', 'stepHigh', 'silica'] as Harvester[]).map((v) => ({ v, label: nm(v) })),
      value: st.h,
      onChange: (v) => (st.h = v),
    });
    const rh = slider({ label: ko ? '밤 공기의 상대습도' : 'Night relative humidity', min: 10, max: 60, step: 1, value: st.rh, unit: '%', onInput: (v) => (st.rh = v) });
    const tm = slider({ label: ko ? '낮에 햇빛으로 데운 MOF 온도' : 'MOF temperature in daytime sun', min: 40, max: 90, step: 1, value: st.tMof, unit: '°C', onInput: (v) => (st.tMof = v) });
    ctx.host.controls.append(g.el, hv.el, rh.el, tm.el, stepButton({ label: ko ? '하루 돌리기' : 'Run one day', onClick: run }).el, ui.ro.el);
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 58;
    const leftW = narrow ? W : W * 0.42;
    if (narrow) {
      const dev: Box = { x: 8, y: top + 26, w: W * 0.48, h: 170 };
      const g1: Box = { x: W * 0.5 + 36, y: top + 40, w: W * 0.5 - 48, h: 130 };
      const g2: Box = { x: 48, y: dev.y + dev.h + 48, w: W - 64, h: Math.max(90, H - dev.y - dev.h - 110) };
      return { W, H, narrow, dev, g1, g2 };
    }
    const dev: Box = { x: 20, y: top + 30, w: leftW - 40, h: Math.min(300, H * 0.45) };
    const gh = (H - top - 170) / 2;
    const g1: Box = { x: leftW + 60, y: top + 40, w: W - leftW - 84, h: gh };
    const g2: Box = { x: g1.x, y: g1.y + gh + 70, w: g1.w, h: gh };
    return { W, H, narrow, dev, g1, g2 };
  };

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(c, pal, ko ? '밤에는 뚜껑을 열어 공기 속 수증기를 MOF 층에 붙잡고, 낮에는 뚜껑을 닫고 햇빛으로 MOF를 데워 나온 수증기를 차가운 벽에 맺히게 합니다.' : 'At night the lid opens and the MOF layer grabs water vapour from the air; by day the lid closes, sunlight heats the MOF, and the released vapour condenses on a cool wall.', 16, 24, L.W - 32, L.narrow ? 13 : 15);
    const D = L.dev;
    const ph = st.phase;
    const night = ph < 0 ? true : ph < 0.5;
    const nightFill = ph < 0 ? 0 : clamp(ph / 0.45, 0, 1);
    const dayOut = ph < 0.5 ? 0 : clamp((ph - 0.5) / 0.45, 0, 1);
    const load = water(st.h, st.rh);
    const loadDay = water(st.h, heatedRH(DAY_RH, DAY_T, st.tMof));
    const cur = ph < 0 ? loadDay : ph < 0.5 ? loadDay + (load - loadDay) * nightFill : load - (load - loadDay) * dayOut;
    // 장치 상자
    const bx = D.x + D.w * 0.1;
    const bw = D.w * 0.8;
    const by = D.y + D.h * 0.22;
    const bh = D.h * 0.7;
    c.save();
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.5;
    c.strokeRect(bx, by, bw, bh);
    // 뚜껑
    c.strokeStyle = pal.ink;
    c.lineWidth = 3;
    c.beginPath();
    if (night) {
      c.moveTo(bx, by);
      c.lineTo(bx + bw * 0.45, by - bh * 0.25);
    } else {
      c.moveTo(bx, by);
      c.lineTo(bx + bw, by);
    }
    c.stroke();
    // MOF 층
    const ly = by + bh * 0.2;
    const lh = bh * 0.22;
    c.fillStyle = alpha(pal.red, 0.12 + 0.6 * clamp(cur / 0.3, 0, 1));
    c.strokeStyle = pal.red;
    c.lineWidth = 2;
    c.fillRect(bx + bw * 0.1, ly, bw * 0.8, lh);
    c.strokeRect(bx + bw * 0.1, ly, bw * 0.8, lh);
    // 하늘: 달 또는 해
    const sx = D.x + D.w - 24;
    const sy = D.y + 14;
    c.strokeStyle = pal.red;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx, sy, 12, 0, TAU);
    c.stroke();
    if (!night) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        c.beginPath();
        c.moveTo(sx + Math.cos(a) * 15, sy + Math.sin(a) * 15);
        c.lineTo(sx + Math.cos(a) * 21, sy + Math.sin(a) * 21);
        c.stroke();
      }
    }
    // 수증기와 물방울
    c.strokeStyle = pal.blue;
    c.fillStyle = pal.blue;
    c.lineWidth = 1.5;
    if (night && ph >= 0) {
      for (let i = 0; i < 6; i++) {
        const x = bx + bw * (0.15 + i * 0.13);
        const y = by - 10 + ((st.t * 30 + i * 13) % 30);
        c.beginPath();
        c.arc(x, y, 3, 0, TAU);
        c.fill();
      }
    }
    if (!night) {
      for (let i = 0; i < 4; i++) {
        const x = bx + bw * (0.25 + i * 0.17);
        c.beginPath();
        c.moveTo(x, ly + lh + 4);
        c.quadraticCurveTo(x + 6, ly + lh + 16, x, ly + lh + 28);
        c.stroke();
      }
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(bx + 4, by + bh * 0.72);
      c.lineTo(bx + bw - 4, by + bh * 0.72);
      c.stroke();
    }
    // 모은 물
    const got = ph < 0.5 ? 0 : (load - loadDay) * dayOut;
    c.fillStyle = alpha(pal.blue, 0.5);
    const wh = clamp(got / 0.3, 0, 1) * bh * 0.18;
    c.fillRect(bx + 2, by + bh - wh - 2, bw - 4, wh);
    c.restore();
    text(c, pal, night ? (ko ? `밤: 뚜껑 열림, 습도 ${st.rh}%` : `night: lid open, ${st.rh}% humidity`) : ko ? `낮: 햇빛으로 ${st.tMof}°C` : `day: sun heats to ${st.tMof}°C`, D.x, D.y + 14, { size: 13, color: pal.blue });
    text(c, pal, ko ? 'MOF 층' : 'MOF layer', bx + bw * 0.1, ly - 6, { size: 12 });
    text(c, pal, ko ? `품은 물 ${Math.round(cur * 1000)} g` : `water held ${Math.round(cur * 1000)} g`, bx + bw * 0.9, ly - 6, { size: 12, align: 'right', color: pal.blue });
    // 물 흡착 등온선
    const G = axes(c, pal, L.g1, { x0: 0, x1: 60, y0: 0, y1: 0.36, xt: [0, 20, 40, 60], yt: [0, 0.1, 0.2, 0.3], fx: String, fy: (v) => v.toFixed(1), xl: ko ? 'MOF가 느끼는 상대습도 (%) →' : 'relative humidity seen by the MOF (%) →', yl: ko ? '물 흡착량 (g/g)' : 'water uptake (g/g)' });
    const hd = heatedRH(DAY_RH, DAY_T, st.tMof);
    c.fillStyle = alpha(pal.blue, 0.08);
    c.fillRect(G.X(hd), L.g1.y, G.X(st.rh) - G.X(hd), L.g1.h);
    c.strokeStyle = pal.red;
    c.lineWidth = 2.5;
    c.beginPath();
    for (let r = 0; r <= 60; r += 0.5) (r ? c.lineTo(G.X(r), G.Y(water(st.h, r))) : c.moveTo(G.X(r), G.Y(water(st.h, r))));
    c.stroke();
    c.strokeStyle = pal.blue;
    c.setLineDash([5, 4]);
    for (const r of [st.rh, hd]) {
      c.beginPath();
      c.moveTo(G.X(r), L.g1.y);
      c.lineTo(G.X(r), L.g1.y + L.g1.h);
      c.stroke();
    }
    c.setLineDash([]);
    text(c, pal, ko ? `밤 ${st.rh}%` : `night ${st.rh}%`, G.X(st.rh) + 4, L.g1.y + 12, { size: 12, color: pal.blue });
    text(c, pal, ko ? `데운 낮 ${hd.toFixed(1)}%` : `heated ${hd.toFixed(1)}%`, G.X(hd) + 4, L.g1.y + 28, { size: 12, color: pal.blue });
    // 하루 수확량 기록
    const runs = st.runs.slice(-8);
    const B = axes(c, pal, L.g2, { x0: 0, x1: Math.max(1, runs.length), y0: 0, y1: 300, xt: [], yt: [0, 100, 200, 300], fx: () => '', fy: String, xl: '', yl: ko ? '하루 수확량 (g, 1 kg당)' : 'daily yield (g per kg)' });
    c.strokeStyle = alpha(pal.ink, 0.45);
    c.setLineDash([3, 3]);
    for (const v of [114, 210]) {
      c.beginPath();
      c.moveTo(L.g2.x, B.Y(v));
      c.lineTo(L.g2.x + L.g2.w, B.Y(v));
      c.stroke();
    }
    c.setLineDash([]);
    text(c, pal, ko ? '점선: 실제 데스밸리 MOF-303 114~210 g' : 'dashed: real MOF-303 in Death Valley, 114–210 g', L.g2.x + L.g2.w, L.g2.y - 10, { size: 11, align: 'right' });
    runs.forEach((r, i) => {
      const bw2 = Math.min(60, (L.g2.w / Math.max(1, runs.length)) * 0.6);
      const x = B.X(i + 0.5) - bw2 / 2;
      c.fillStyle = r.h === st.h ? pal.red : alpha(pal.red, 0.45);
      c.fillRect(x, B.Y(Math.min(300, r.g)), bw2, L.g2.y + L.g2.h - B.Y(Math.min(300, r.g)));
      text(c, pal, `${NAME[r.h][ko ? 0 : 1]}`, x + bw2 / 2, L.g2.y + L.g2.h + 14, { size: 10, align: 'center' });
      text(c, pal, `${r.rh}%`, x + bw2 / 2, L.g2.y + L.g2.h + 27, { size: 10, align: 'center' });
    });
    const last = st.runs[st.runs.length - 1];
    ui.ro.set(
      ko
        ? `${nm(st.h)}, 밤 습도 ${st.rh}%, 낮 MOF ${st.tMof}°C\n${st.phase >= 0 ? '하루 도는 중' : last ? `마지막 하루: ${Math.round(last.g)} g` : '아직 돌리지 않음'}`
        : `${nm(st.h)}, night ${st.rh}%, day MOF ${st.tMof}°C\n${st.phase >= 0 ? 'Running a day' : last ? `Last day: ${Math.round(last.g)} g` : 'Not run yet'}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '4',
    ko: '사막 공기에서 물 얻기',
    en: 'Water from desert air',
    missions: [
      {
        id: 'c4m1',
        ko: '어떤 흡착제가 물을 많이 모을지 예상한 뒤, 두 가지 이상으로 하루 순환을 돌려 비교하라.',
        en: 'Guess which sorbent collects the most water, then run a day cycle with two or more and compare.',
        hint_ko: '흡착제를 고르고 "하루 돌리기"를 누르세요. 오른쪽 위 그래프에서 계단 위치와 밤 습도를 비교해 보세요.',
        hint_en: 'Pick a sorbent and press "Run one day". Compare the step position with the night humidity on the graph.',
      },
      {
        id: 'c4m2',
        ko: '밤 습도 30% 이하의 사막 조건에서 하루 150 g 넘게 모아, 실제 데스밸리 결과와 비교하라.',
        en: 'Collect over 150 g a day in desert conditions (night humidity 30% or less) and compare with Death Valley.',
        hint_ko: 'MOF-303으로 밤 습도를 30% 이하로 두고, 낮 온도를 충분히 올려 보세요.',
        hint_en: 'Use MOF-303 with night humidity at most 30% and heat it enough by day.',
      },
      {
        id: 'c4m3',
        ko: '계단이 높은 흡착제를 사막 밤 습도에서 돌려, 왜 물이 거의 안 나오는지 보라.',
        en: 'Run a high-step sorbent at desert night humidity and see why almost no water comes out.',
        hint_ko: '"계단이 높은 MOF"나 실리카겔을 고르고 밤 습도를 30% 이하로 두세요.',
        hint_en: 'Pick the high-step MOF or silica gel and keep night humidity at or below 30%.',
      },
    ],
    content: {
      ko: {
        observe: `<p>이 장은 수상 사유 다음에 이어진 이야기입니다. 구멍의 크기와 벽 성질을 설계할 수 있게 되자, MOF는 실제 문제를 풀기 시작했습니다. 그중 하나가 <b>사막 공기에서 마실 물을 얻는 일</b>입니다.</p><p>야기 연구진은 2018년 애리조나 사막에서 MOF-801로 1 kg당 하루 약 100 g의 물을 모았고, 알루미늄 기반 MOF-303은 그 두 배 넘게 물을 냈습니다. 2022년에는 데스밸리에서 습도 9.4~36% 조건으로 MOF-303 1 kg당 하루 114~210 g을 모았습니다. 전기 없이 햇빛만 썼습니다.</p><p class="q">사막에서 물을 많이 모으려면, 어떤 MOF를 골라야 할까?</p>`,
        interact: '흡착제와 밤 습도, 낮에 데우는 온도를 정하고 "하루 돌리기"를 누르세요. 오른쪽 위 그래프의 계단이 어디 있는지 보세요.',
        understand: `<h4>물 흡착 계단</h4><p>물을 좋아하는 작용기가 있는 구멍은, 상대습도가 어느 값을 넘으면 그 안에서 물이 한꺼번에 응축되며 꽉 찹니다. 그래서 물 흡착 등온선에 가파른 계단이 생깁니다. 이 계단이 어디 있느냐가 전부를 정합니다.</p><h4>데우면 상대습도가 낮아진다</h4><p>같은 수증기라도 온도가 높으면 포화 수증기압이 커져 상대습도가 크게 떨어집니다.</p>$$RH_{\\text{MOF}} = RH_{\\text{공기}}\\,\\frac{p_{\\text{sat}}(T_{\\text{공기}})}{p_{\\text{sat}}(T_{\\text{MOF}})}$$<p>그래서 밤 습도에서는 계단 위(꽉 참), 햇빛에 데운 낮에는 계단 아래(텅 빔)에 있어야 하루 한 번 물을 꽉 채웠다 비울 수 있습니다. 하루 수확량은 두 상태의 흡착량 차이입니다.</p>$$m_{\\text{물}} = \\left[q(RH_{\\text{밤}}) - q(RH_{\\text{데운 낮}})\\right] \\times m_{\\text{MOF}} \\times \\eta$$<p>실제 MOF-303 장치는 안에서 데워지는 정도가 고르지 않아 한 번에 많아야 85%를 내놓았습니다($\\eta \\approx 0.85$).</p><h4>실제와 다른 점</h4><p>계단 위치와 흡착량은 사막 시험 결과에 맞춘 모형 값이고, 하루 한 번 순환만 계산했습니다. 실제 장치는 공기 흐름, 응결 효율, 하루 여러 번 순환 등도 고려합니다.</p>`,
      },
      en: {
        observe: `<p>This chapter goes beyond the prize citation. Once pore size and wall chemistry could be designed, MOFs began solving real problems. One of them is <b>pulling drinking water out of desert air</b>.</p><p>In 2018 Yaghi's team collected about 100 g of water per kg of MOF-801 per day in the Arizona desert, and the aluminium-based MOF-303 gave more than twice as much. In 2022 in Death Valley, at 9.4 to 36% humidity, MOF-303 collected 114 to 210 g per kg per day, using only sunlight.</p><p class="q">To collect lots of water in the desert, which MOF should you pick?</p>`,
        interact: 'Choose the sorbent, night humidity and daytime heating, then press "Run one day". Watch where the step sits on the top-right graph.',
        understand: `<h4>The water uptake step</h4><p>Pores lined with water-loving groups fill all at once when the relative humidity passes a certain value, as water condenses inside them. That gives a steep step in the water isotherm, and where the step sits decides everything.</p><h4>Heating lowers the relative humidity</h4><p>The same vapour at a higher temperature has a much lower relative humidity because the saturation pressure rises:</p>$$RH_{\\text{MOF}} = RH_{\\text{air}}\\,\\frac{p_{\\text{sat}}(T_{\\text{air}})}{p_{\\text{sat}}(T_{\\text{MOF}})}$$<p>So the MOF must sit above the step at night (full) and below it when sun-heated by day (empty) to fill and empty once a day. The daily yield is the difference between the two:</p>$$m_{\\text{water}} = \\left[q(RH_{\\text{night}}) - q(RH_{\\text{heated}})\\right] \\times m_{\\text{MOF}} \\times \\eta$$<p>The real MOF-303 device released at most 85% at a time because it heated unevenly ($\\eta \\approx 0.85$).</p><h4>How this differs from reality</h4><p>Step positions and capacities are model values tuned to the desert tests, and only one cycle a day is counted. Real devices also deal with airflow, condensation efficiency and multiple cycles per day.</p>`,
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
        st.phase += dt / CYCLE;
        if (st.phase >= 1) finish();
      }
      draw();
    },
    reset() {
      st.h = 'mof303';
      st.rh = 30;
      st.tMof = 70;
      st.guess = null;
      st.runs = [];
      st.phase = -1;
      panel();
      check();
    },
    leave() {
      if (st.phase >= 0) st.phase = -1;
    },
  };
}
