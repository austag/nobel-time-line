// 2장: 검출기 설계하기. 센서 예산 안에서 줄 간격과 깊이를 정하고 검출률을 비교한다.
import { TAU, alpha, mix, text } from '../canvas';
import { readout, slider, stepButton, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import * as D from './design';

const STEP = 0.32; // 시험 사건 하나를 보여 주는 시간 (초)

export function chapter2(): Chapter {
  let ctx: Ctx;
  const tracks = D.testTracks();
  const st = {
    d: { strings: 5, top: 1250, length: 700, absorption: true, scattering: false } as D.Design,
    i: 0,
    t: 0,
    rate: 0,
    shallow: null as number | null,
    deep: null as number | null,
    clear: null as number | null,
    scat: null as number | null,
  };
  let ui: { ro: ReturnType<typeof readout> };

  function evaluate(): void {
    st.rate = D.detectionRate(st.d, tracks);
    const pct = Math.round(st.rate * 100);
    const sp = D.spacing(st.d);
    if (st.rate >= 0.65) {
      ctx.host.complete('c2m1', tr(ctx, `줄 ${st.d.strings}개, ${st.d.top}~${D.bottom(st.d)} m: 검출률 ${pct}%`, `${st.d.strings} strings, ${st.d.top} to ${D.bottom(st.d)} m: ${pct}% detected`));
      ctx.note(
        'design',
        `센서 ${D.BUDGET}개로 줄 ${st.d.strings}개(간격 ${Math.round(sp.string)} m), 센서 간격 ${Math.round(sp.sensor)} m, 깊이 ${st.d.top}~${D.bottom(st.d)} m에 묻어 사건 ${pct}%를 잡았다.`,
        `With ${D.BUDGET} sensors on ${st.d.strings} strings (${Math.round(sp.string)} m apart, ${Math.round(sp.sensor)} m vertical), from ${st.d.top} to ${D.bottom(st.d)} m, I caught ${pct}% of events.`,
      );
    } else {
      ctx.host.result('c2m1', tr(ctx, `지금 검출률 ${pct}%`, `Now ${pct}% detected`));
    }
    // 얕은 곳과 깊은 곳 비교 (흡수 켜고 산란 끈 같은 조건에서)
    if (st.d.absorption && !st.d.scattering) {
      if (st.d.top < D.BUBBLES) st.shallow = pct;
      if (st.d.top >= 1450) st.deep = pct;
      if (st.shallow != null && st.deep != null) {
        ctx.host.complete('c2m2', tr(ctx, `얕게 ${st.shallow}%, 깊게 ${st.deep}%`, `Shallow ${st.shallow}%, deep ${st.deep}%`));
        ctx.note('depth', `1400 m보다 얕게 묻으면 ${st.shallow}%, 더 깊게 묻으면 ${st.deep}%를 잡았다. 얕은 얼음의 공기 방울이 빛을 흩뜨린다.`, `Shallower than 1400 m I caught ${st.shallow}%, deeper ${st.deep}%. Air bubbles in shallow ice scatter the light.`);
      }
      st.clear = pct;
    }
    if (st.d.absorption && st.d.scattering) st.scat = pct;
    if (st.clear != null && st.scat != null) {
      ctx.host.complete('c2m3', tr(ctx, `산란 없음 ${st.clear}%, 산란 있음 ${st.scat}%`, `No scattering ${st.clear}%, with scattering ${st.scat}%`));
      ctx.note('scatter', `빛의 산란을 넣자 검출률이 ${st.clear}%에서 ${st.scat}%로 떨어지고 도착 시간도 흐트러졌다.`, `Adding scattering dropped detection from ${st.clear}% to ${st.scat}% and smeared arrival times.`);
    }
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const set = <K extends keyof D.Design>(key: K, v: D.Design[K]) => {
      st.d[key] = v;
      evaluate();
    };
    const strings = slider({ label: ko ? '줄 수' : 'Strings', min: 3, max: 16, step: 1, value: st.d.strings, onInput: (v) => set('strings', v) });
    const top = slider({ label: ko ? '맨 위 센서 깊이' : 'Top sensor depth', min: 1200, max: 2100, step: 25, value: st.d.top, unit: ' m', onInput: (v) => set('top', v) });
    const length = slider({ label: ko ? '줄 길이' : 'String length', min: 300, max: 1300, step: 50, value: st.d.length, unit: ' m', onInput: (v) => set('length', v) });
    const abs = toggle({ label: ko ? '빛의 흡수' : 'Absorption', on: st.d.absorption, onText: ko ? '켬' : 'On', offText: ko ? '끔' : 'Off', onChange: (v) => set('absorption', v) });
    const sca = toggle({ label: ko ? '빛의 산란' : 'Scattering', on: st.d.scattering, onText: ko ? '켬' : 'On', offText: ko ? '끔' : 'Off', onChange: (v) => set('scattering', v) });
    const real = stepButton({
      label: ko ? '실제 IceCube처럼 놓기' : 'Place like IceCube',
      onClick: () => {
        Object.assign(st.d, { strings: 8, top: 1450, length: 1000 });
        panel();
        evaluate();
        ctx.host.toast(tr(ctx, '실제 IceCube: 줄 간격 125 m, 센서 간격 17 m, 깊이 1450~2450 m', 'Real IceCube: strings 125 m apart, sensors 17 m apart, 1450 to 2450 m deep'));
      },
    });
    real.el.classList.add('ghost');
    ui = { ro: readout() };
    ctx.host.controls.append(strings.el, top.el, length.el, abs.el, sca.el, real.el, ui.ro.el);
  }

  function draw(): void {
    const { ctx: c, w: W, h: H } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    c.clearRect(0, 0, W, H);
    const top = 40;
    const bot = H - 46;
    const Z = (z: number) => top + ((z - D.ICE_TOP) / (D.ICE_BOTTOM - D.ICE_TOP)) * (bot - top);
    // 왼쪽: 깊이별 투명도
    const gx = 58;
    const gw = Math.min(150, W * 0.2);
    const dx = gx + gw + 30;
    const dw = W - dx - 20;
    const X = (x: number) => dx + (x / D.WIDTH) * dw;

    // 공기 방울과 먼지층 띠
    c.fillStyle = alpha(pal.ink, 0.08);
    c.fillRect(gx, Z(D.ICE_TOP), W - gx - 20, Z(D.BUBBLES) - Z(D.ICE_TOP));
    c.fillStyle = alpha(pal.ink, 0.14);
    c.fillRect(gx, Z(D.DUST[0]), W - gx - 20, Z(D.DUST[1]) - Z(D.DUST[0]));
    text(c, pal, ko ? '공기 방울' : 'air bubbles', W - 24, Z(D.ICE_TOP) + 18, { size: 13, align: 'right' });
    text(c, pal, ko ? '먼지층' : 'dust layer', W - 24, Z(D.DUST[0]) + 16, { size: 13, align: 'right' });

    // 깊이 눈금
    for (let z = 1200; z <= 2700; z += 300) {
      text(c, pal, `${z}`, gx - 8, Z(z) + 5, { size: 12, align: 'right' });
      c.strokeStyle = alpha(pal.ink, 0.12);
      c.beginPath();
      c.moveTo(gx, Z(z));
      c.lineTo(W - 20, Z(z));
      c.stroke();
    }
    text(c, pal, ko ? '깊이 (m)' : 'depth (m)', gx - 8, top - 14, { size: 13, align: 'right' });
    // 투명도 곡선
    text(c, pal, ko ? '빛이 가는 거리' : 'light reach', gx, top - 14, { size: 13, color: pal.blue });
    c.strokeStyle = pal.blue;
    c.lineWidth = 2.5;
    c.beginPath();
    for (let z = D.ICE_TOP; z <= D.ICE_BOTTOM; z += 10) {
      const lam = D.attenuation(z);
      const x = gx + (lam / 200) * gw;
      if (z === D.ICE_TOP) c.moveTo(x, Z(z));
      else c.lineTo(x, Z(z));
    }
    c.stroke();
    text(c, pal, '200 m', gx + gw, bot + 18, { size: 12, align: 'right' });
    text(c, pal, '0', gx, bot + 18, { size: 12 });

    // 오른쪽: 검출기 단면
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.strokeRect(dx, top, dw, bot - top);
    text(c, pal, ko ? `검출기 단면 (폭 ${D.WIDTH} m, 센서 ${D.BUDGET}개)` : `Detector slice (${D.WIDTH} m wide, ${D.BUDGET} sensors)`, dx, top - 14, { size: 14, color: pal.blue });
    const ss = D.sensors(st.d);
    const tk = tracks[st.i];
    const hits = new Set(D.hitsFor(tk, ss, st.d));
    const caught = hits.size >= D.HIT_MIN;
    // 줄
    c.strokeStyle = alpha(pal.ink, 0.3);
    c.lineWidth = 1;
    for (let i = 0; i < st.d.strings; i++) {
      const x = X(((i + 0.5) * D.WIDTH) / st.d.strings);
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, Z(D.bottom(st.d)));
      c.stroke();
    }
    // 사건 궤적 (진행 정도에 따라 그린다)
    const prog = Math.min(1, st.t / (STEP * 0.7));
    c.save();
    c.beginPath();
    c.rect(dx, top, dw, bot - top);
    c.clip();
    const sx = (x: number) => X(x);
    const ex = tk.x + Math.cos(tk.ang) * tk.len * prog;
    const ez = tk.z + Math.sin(tk.ang) * tk.len * prog;
    c.strokeStyle = caught ? pal.ink : alpha(pal.ink, 0.45);
    c.lineWidth = 2.5;
    c.setLineDash(caught ? [] : [6, 5]);
    c.beginPath();
    c.moveTo(sx(tk.x), Z(tk.z));
    c.lineTo(sx(ex), Z(ez));
    c.stroke();
    c.setLineDash([]);
    c.restore();
    // 센서
    const r = Math.max(2.5, Math.min(5, dw / D.WIDTH * 9));
    ss.forEach((s, i) => {
      const on = hits.has(i) && prog > 0.4;
      c.beginPath();
      c.arc(X(s.x), Z(s.z), on ? r * 1.7 : r, 0, TAU);
      if (on) {
        c.fillStyle = mix(pal.red, pal.blue, (s.z - D.ICE_TOP) / (D.ICE_BOTTOM - D.ICE_TOP));
        c.fill();
      } else {
        c.strokeStyle = alpha(pal.ink, 0.6);
        c.lineWidth = 1.2;
        c.stroke();
      }
    });
    text(c, pal, `${ko ? '시험 사건' : 'Test event'} ${st.i + 1}/${tracks.length}: ${caught ? (ko ? '검출' : 'caught') : ko ? '놓침' : 'missed'}`, dx, bot + 22, { size: 14 });
    text(c, pal, `${ko ? '검출률' : 'Detected'} ${Math.round(st.rate * 100)}%`, dx + dw, bot + 22, { size: 16, align: 'right', title: true });

    const sp = D.spacing(st.d);
    ui.ro.set(
      ko
        ? `줄 간격 ${Math.round(sp.string)} m, 줄마다 센서 ${sp.per}개\n센서 간격 ${Math.round(sp.sensor)} m\n검출률 ${Math.round(st.rate * 100)}% (사건 ${tracks.length}개 중)`
        : `String spacing ${Math.round(sp.string)} m, ${sp.per} sensors each\nVertical spacing ${Math.round(sp.sensor)} m\nDetected ${Math.round(st.rate * 100)}% of ${tracks.length} events`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '2',
    ko: '검출기 설계',
    en: 'Design the detector',
    missions: [
      {
        id: 'c2m1',
        ko: `같은 센서 ${D.BUDGET}개로 사건을 65% 이상 잡는 배치를 찾아라.`,
        en: `Find a layout that catches at least 65% of events with the same ${D.BUDGET} sensors.`,
        hint_ko: '얕은 공기 방울 층을 피하고, 줄을 길게 늘여 보세요. 줄이 너무 적으면 사이로 빠져나가고, 너무 많으면 줄마다 센서가 듬성듬성해집니다.',
        hint_en: 'Avoid the shallow bubbly ice and make the strings long. Too few strings leave gaps; too many leave each string sparse.',
      },
      {
        id: 'c2m2',
        ko: '1400 m보다 얕게 묻었을 때와 1450 m보다 깊게 묻었을 때를 비교하라.',
        en: 'Compare burying the top sensors shallower than 1400 m and deeper than 1450 m.',
        hint_ko: '흡수는 켜고 산란은 끈 채로, 맨 위 센서 깊이만 바꿔 보세요.',
        hint_en: 'Keep absorption on and scattering off, and change only the top depth.',
      },
      {
        id: 'c2m3',
        ko: '빛의 산란을 켜고 끄며 검출률이 어떻게 바뀌는지 확인하라.',
        en: 'Toggle scattering and see how the detection rate changes.',
        hint_ko: '흡수를 켠 채로 산란 스위치만 바꿔 보세요.',
        hint_en: 'Keep absorption on and flip only the scattering switch.',
      },
    ],
    content: {
      ko: {
        observe: `<p>센서 수는 정해져 있습니다. 줄을 몇 개 세우고, 얼마나 길게, 얼마나 깊이 묻을지 정하면 같은 시험 사건 100개를 흘려보내 몇 개를 잡았는지 셉니다. 센서가 ${D.HIT_MIN}개 이상 켜져야 사건으로 기록됩니다.</p><p>왼쪽 그래프는 깊이에 따라 빛이 얼마나 멀리 가는지 보여 줍니다. 얕은 곳의 공기 방울과 2000 m 부근의 먼지층에서 빛이 금방 약해집니다.</p><p class="q">센서를 촘촘히 놓을까, 넓게 퍼뜨릴까?</p>`,
        interact: '줄 수, 깊이, 길이를 바꾸면 검출률이 바로 다시 계산됩니다. 미션은 선택 사항입니다.',
        understand: `<h4>왜 1세제곱킬로미터인가</h4><p>우주에서 오는 고에너지 중성미자는 너무 드물어서, 검출기 부피가 클수록 더 많이 잡힙니다. 그래서 센서를 촘촘히 모으기보다 빛이 닿는 거리만큼 넓게 퍼뜨립니다.</p><h4>간격은 빛이 가는 거리로 정한다</h4><p>센서 사이가 빛이 약해지는 거리보다 멀면 사건이 그 틈으로 빠져나갑니다. 실제 IceCube는 줄 86개에 센서 5,160개를 1450~2450 m 깊이에 묻었고, 줄 간격은 약 125 m, 센서 간격은 17 m입니다.</p><h4>깊이와 얼음의 성질</h4><p>얕은 얼음에는 공기 방울이 남아 빛이 이리저리 흩어집니다. 깊은 남극 얼음은 매우 맑아서 빛이 100 m 넘게 가지만, 2000~2100 m 사이에는 옛 기후가 남긴 먼지층이 있습니다.</p><h4>흡수와 산란</h4><p>흡수는 빛을 없애고, 산란은 빛의 방향을 바꿔 도착을 늦춥니다. 산란이 크면 4장의 방향 재기도 어려워집니다.</p><h4>실제와 다른 점</h4><p>2차원 단면이고, 센서 수와 깊이별 투명도는 실제 얼음의 대략적인 모양만 따랐습니다.</p>`,
      },
      en: {
        observe: `<p>The number of sensors is fixed. Choose how many strings, how long, and how deep; then the same 100 test events run through and we count how many you catch. An event counts when at least ${D.HIT_MIN} sensors light up.</p><p>The left graph shows how far light travels at each depth. Shallow air bubbles and the dust layer near 2000 m weaken it quickly.</p><p class="q">Pack the sensors tightly or spread them wide?</p>`,
        interact: 'Change strings, depth and length; the rate updates at once. Missions are optional.',
        understand: `<h4>Why a cubic kilometre</h4><p>Cosmic high-energy neutrinos are so rare that a bigger volume catches more. So sensors are spread as widely as light can reach rather than packed together.</p><h4>Spacing is set by how far light goes</h4><p>If sensors are farther apart than light can travel, events slip through. The real IceCube has 5,160 sensors on 86 strings between 1450 and 2450 m, strings about 125 m apart and sensors 17 m apart.</p><h4>Depth and ice</h4><p>Shallow ice still holds air bubbles that scatter light. Deep polar ice is very clear, letting light travel over 100 m, but a dust layer from an ancient climate sits between 2000 and 2100 m.</p><h4>Absorption and scattering</h4><p>Absorption removes light; scattering bends it and delays it. Strong scattering also makes direction finding in chapter 4 harder.</p><h4>How this differs from reality</h4><p>This is a 2D slice, and the sensor count and depth profile only follow the rough shape of real ice.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      panel();
      evaluate();
    },
    panel,
    frame(dt) {
      st.t += dt;
      if (st.t > STEP) {
        st.t = 0;
        st.i = (st.i + 1) % tracks.length;
      }
      draw();
    },
    reset() {
      Object.assign(st, { d: { strings: 5, top: 1250, length: 700, absorption: true, scattering: false }, i: 0, t: 0, shallow: null, deep: null, clear: null, scat: null });
      panel();
      evaluate();
    },
  };
}
