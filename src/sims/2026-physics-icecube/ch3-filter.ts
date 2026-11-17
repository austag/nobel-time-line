// 3장: 잡음 속에서 신호 찾기. 거름 조건을 더해 가며 순도와 효율을 보고, 블라인드 분석을 체험한다.
import { TAU, alpha, pow10, text } from '../canvas';
import { readout, segment, slider, stepButton, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import * as F from './filter';

const SIM_SEED = 11;

/** log10(GeV) 를 읽기 쉬운 단위로 */
export function energy(le: number): string {
  const gev = Math.pow(10, le);
  if (gev >= 1e6) return `${(gev / 1e6).toFixed(1)} PeV`;
  if (gev >= 1e3) return `${Math.round(gev / 1e3)} TeV`;
  return `${Math.round(gev)} GeV`;
}
const DATA_SEED = 29;

export function chapter3(): Chapter {
  let ctx: Ctx;
  const sim = F.dataset(SIM_SEED);
  const data = F.dataset(DATA_SEED);
  const st = {
    cuts: { ...F.NO_CUTS } as F.Cuts,
    view: 'sim' as 'sim' | 'data',
    unblinded: false,
    frozen: null as F.Cuts | null, // 봉인을 풀 때의 조건
    broken: false,
  };
  let ui: { ro: ReturnType<typeof readout> };

  function check(): void {
    const t = F.tally(sim, st.cuts);
    const p = Math.round(t.purity * 100);
    const e = Math.round(t.efficiency * 100);
    if (t.purity >= 0.8 && t.efficiency >= 0.4) {
      ctx.host.complete('c3m1', tr(ctx, `순도 ${p}%, 신호 효율 ${e}%`, `Purity ${p}%, efficiency ${e}%`));
      ctx.note('cuts', `거름 조건 ${describe(true)}으로 우주 중성미자 순도 ${p}%, 신호 효율 ${e}%를 얻었다.`, `Cuts (${describe(false)}) gave ${p}% purity and ${e}% signal efficiency.`);
    } else {
      ctx.host.result('c3m1', tr(ctx, `지금 순도 ${p}%, 신호 효율 ${e}%`, `Now purity ${p}%, efficiency ${e}%`));
    }
    // 방향 조건만 걸면 잘못 재구성된 뮤온이 남는다
    if (st.cuts.upOnly) {
      const upOnly = F.tally(sim, { ...F.NO_CUTS, upOnly: true, minHits: st.cuts.minHits }).kept.muon;
      const now = t.kept.muon;
      if (upOnly > 0 && now <= upOnly * 0.1 && st.cuts.minQuality > 0) {
        ctx.host.complete('c3m3', tr(ctx, `위로 올라오는 것처럼 보이던 뮤온 ${upOnly}개 중 ${now}개만 남음`, `Only ${now} of ${upOnly} fake up-going muons remain`));
        ctx.note('quality', `방향 조건만으로는 잘못 재구성된 뮤온 ${upOnly}개가 남았고, 품질 조건을 더해 ${now}개로 줄였다.`, `Direction alone left ${upOnly} misreconstructed muons; a quality cut brought it to ${now}.`);
      }
    }
  }

  function describe(ko: boolean): string {
    const c = st.cuts;
    const parts: string[] = [];
    if (c.minHits > 0) parts.push(ko ? `센서 ${c.minHits}개 이상` : `≥ ${c.minHits} sensors`);
    if (c.upOnly) parts.push(ko ? '아래에서 올라오는 사건만' : 'up-going only');
    if (c.minQuality > 0) parts.push(ko ? `품질 ${c.minQuality.toFixed(2)} 이상` : `quality ≥ ${c.minQuality.toFixed(2)}`);
    if (c.minLogE > F.NO_CUTS.minLogE) parts.push(ko ? `에너지 ${energy(c.minLogE)} 이상` : `energy ≥ ${energy(c.minLogE)}`);
    return parts.length ? `(${parts.join(', ')})` : ko ? '(없음)' : 'none';
  }

  function changed(): void {
    if (st.unblinded && st.frozen && JSON.stringify(st.frozen) !== JSON.stringify(st.cuts) && !st.broken) {
      st.broken = true;
      ctx.host.toast(tr(ctx, '블라인드 분석 규칙 위반: 데이터를 본 뒤 조건을 바꿨어요.', 'Blind analysis broken: you changed the cuts after looking at the data.'));
      ctx.note('blind', '봉인을 푼 뒤 조건을 바꿔서, 이 결과는 블라인드 분석으로 인정받기 어렵다.', 'I changed the cuts after unblinding, so this result no longer counts as a blind analysis.');
      ctx.host.result('c3m2', tr(ctx, '봉인을 푼 뒤 조건을 바꿨어요. 초기화하고 다시 해 보세요.', 'Cuts changed after unblinding. Reset and try again.'));
    }
    check();
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const c = st.cuts;
    const hits = slider({ label: ko ? '최소 켜진 센서 수' : 'Minimum lit sensors', min: 0, max: 40, step: 1, value: c.minHits, onInput: (v) => ((c.minHits = v), changed()) });
    const up = toggle({ label: ko ? '아래에서 올라오는 사건만' : 'Up-going events only', on: c.upOnly, onText: ko ? '켬' : 'On', offText: ko ? '끔' : 'Off', onChange: (v) => ((c.upOnly = v), changed()) });
    const q = slider({ label: ko ? '최소 재구성 품질' : 'Minimum fit quality', min: 0, max: 1, step: 0.05, value: c.minQuality, fmt: (v) => v.toFixed(2), onInput: (v) => ((c.minQuality = v), changed()) });
    const e = slider({ label: ko ? '최소 에너지' : 'Minimum energy', min: 1, max: 6, step: 0.1, value: c.minLogE, fmt: energy, onInput: (v) => ((c.minLogE = v), changed()) });
    const view = segment({
      label: ko ? '보는 데이터' : 'Data shown',
      value: st.view,
      options: [
        { v: 'sim', label: ko ? '시뮬레이션' : 'Simulation' },
        { v: 'data', label: ko ? '실제 데이터' : 'Real data' },
      ],
      onChange: (v) => (st.view = v),
    });
    const open = stepButton({
      label: st.unblinded ? (ko ? '봉인 풀림' : 'Unblinded') : ko ? '봉인 풀기' : 'Unblind',
      onClick: () => {
        if (st.unblinded) return;
        st.unblinded = true;
        st.frozen = { ...st.cuts };
        st.view = 'data';
        const t = F.tally(data, st.cuts);
        const ts = F.tally(sim, st.cuts);
        ctx.host.complete('c3m2', tr(ctx, `조건 그대로 실제 데이터에서 후보 ${t.keptTotal}개 (시뮬레이션 예상 순도 ${Math.round(ts.purity * 100)}%)`, `${t.keptTotal} candidates in real data with fixed cuts (expected purity ${Math.round(ts.purity * 100)}%)`));
        ctx.note('unblind', `조건을 먼저 정하고 봉인을 풀자 실제 데이터에서 우주 중성미자 후보 ${t.keptTotal}개가 남았다.`, `After fixing the cuts and unblinding, ${t.keptTotal} cosmic-neutrino candidates remained in real data.`);
        panel();
      },
    });
    (open.el as HTMLButtonElement).disabled = st.unblinded;
    ui = { ro: readout() };
    ctx.host.controls.append(hits.el, up.el, q.el, e.el, view.el, open.el, ui.ro.el);
  }

  const color = (kind: F.Kind) => {
    const pal = ctx.pal();
    return kind === 'astro' ? pal.red : kind === 'atmnu' ? pal.blue : kind === 'muon' ? alpha(pal.ink, 0.55) : alpha(pal.ink, 0.25);
  };

  function draw(): void {
    const { ctx: c, w: W, h: H } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    c.clearRect(0, 0, W, H);
    const L = 64;
    const R = W - 20;
    const T = 44;
    const B = H - 70;
    const X = (cz: number) => L + ((cz + 1) / 2) * (R - L);
    const Y = (le: number) => B - ((le - 1) / 6) * (B - T);
    const showSim = st.view === 'sim';
    const evs = showSim ? sim : data;

    // 축
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.5;
    c.strokeRect(L, T, R - L, B - T);
    for (let le = 1; le <= 7; le++) text(c, pal, pow10(le), L - 8, Y(le) + 5, { size: 13, align: 'right' });
    text(c, pal, ko ? '에너지 (GeV)' : 'Energy (GeV)', L, T - 12, { size: 13 });
    text(c, pal, ko ? '← 아래에서 올라옴 (지구를 통과)' : '← up-going (through Earth)', L, B + 22, { size: 13 });
    text(c, pal, ko ? '위에서 내려옴 →' : 'down-going →', R, B + 22, { size: 13, align: 'right' });
    text(c, pal, ko ? '재구성한 방향 cos(천정각)' : 'Reconstructed direction cos(zenith)', (L + R) / 2, B + 44, { size: 13, align: 'center', color: pal.blue });
    c.strokeStyle = alpha(pal.ink, 0.25);
    c.beginPath();
    c.moveTo(X(0), T);
    c.lineTo(X(0), B);
    c.stroke();

    // 버려지는 영역
    const cut = st.cuts;
    c.fillStyle = alpha(pal.ink, 0.07);
    if (cut.upOnly) c.fillRect(X(0), T, R - X(0), B - T);
    if (cut.minLogE > 1) c.fillRect(L, Y(cut.minLogE), R - L, B - Y(cut.minLogE));
    c.strokeStyle = pal.blue;
    c.lineWidth = 2;
    c.setLineDash([6, 5]);
    if (cut.minLogE > 1) {
      c.beginPath();
      c.moveTo(L, Y(cut.minLogE));
      c.lineTo(R, Y(cut.minLogE));
      c.stroke();
    }
    if (cut.upOnly) {
      c.beginPath();
      c.moveTo(X(0), T);
      c.lineTo(X(0), B);
      c.stroke();
    }
    c.setLineDash([]);

    if (!showSim && !st.unblinded) {
      c.fillStyle = alpha(pal.ink, 0.06);
      c.fillRect(L, T, R - L, B - T);
      text(c, pal, ko ? '봉인됨: 조건을 시뮬레이션으로 먼저 정하세요' : 'Sealed: decide your cuts on simulation first', (L + R) / 2, (T + B) / 2, { size: 18, align: 'center', title: true });
    } else {
      // 흐린 것 먼저, 남은 것 나중에
      for (const pass of [false, true]) {
        for (const e of evs) {
          const ok = F.passes(e, cut);
          if (ok !== pass) continue;
          const x = X(e.cosRec);
          const y = Y(e.logE);
          const big = e.kind === 'astro' && showSim;
          c.beginPath();
          c.arc(x, y, big ? 4.5 : ok ? 2.6 : 1.6, 0, TAU);
          c.fillStyle = showSim ? color(e.kind) : ok ? pal.ink : alpha(pal.ink, 0.2);
          if (!ok) c.globalAlpha = 0.35;
          c.fill();
          c.globalAlpha = 1;
          if (!showSim && ok) {
            c.strokeStyle = pal.red;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(x, y, 7, 0, TAU);
            c.stroke();
          }
        }
      }
    }
    // 범례
    if (showSim) {
      const items: [F.Kind, string][] = [
        ['noise', ko ? '잡음' : 'noise'],
        ['muon', ko ? '대기 뮤온' : 'atm. muon'],
        ['atmnu', ko ? '대기 중성미자' : 'atm. neutrino'],
        ['astro', ko ? '우주 중성미자' : 'cosmic neutrino'],
      ];
      let lx = L + 8;
      let ly = T + 16;
      c.font = `13px ${pal.body}`;
      for (const [kind, label] of items) {
        const w = c.measureText(label).width + 30;
        if (lx + w > R - 4) {
          lx = L + 8;
          ly += 20;
        }
        c.fillStyle = color(kind);
        c.beginPath();
        c.arc(lx + 5, ly, 5, 0, TAU);
        c.fill();
        text(c, pal, label, lx + 14, ly + 5, { size: 13 });
        lx += w;
      }
    }

    const t = F.tally(showSim ? sim : data, cut);
    const ts = F.tally(sim, cut);
    ui.ro.set(
      showSim
        ? ko
          ? `남은 사건 ${t.keptTotal} / ${t.total}\n잡음 ${t.kept.noise}, 대기 뮤온 ${t.kept.muon}\n대기 중성미자 ${t.kept.atmnu}, 우주 중성미자 ${t.kept.astro}/${t.all.astro}\n순도 ${Math.round(t.purity * 100)}%, 신호 효율 ${Math.round(t.efficiency * 100)}%`
          : `Kept ${t.keptTotal} / ${t.total}\nnoise ${t.kept.noise}, atm. muons ${t.kept.muon}\natm. neutrinos ${t.kept.atmnu}, cosmic ${t.kept.astro}/${t.all.astro}\nPurity ${Math.round(t.purity * 100)}%, efficiency ${Math.round(t.efficiency * 100)}%`
        : st.unblinded
          ? ko
            ? `실제 데이터: 남은 사건 ${t.keptTotal} / ${t.total}\n(정체는 알 수 없음)\n시뮬레이션 예상 순도 ${Math.round(ts.purity * 100)}%`
            : `Real data: kept ${t.keptTotal} / ${t.total}\n(true identity unknown)\nExpected purity ${Math.round(ts.purity * 100)}%`
          : ko
            ? '실제 데이터는 아직 봉인되어 있어요'
            : 'Real data is still sealed',
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '3',
    ko: '잡음 속 신호',
    en: 'Signal in the noise',
    missions: [
      {
        id: 'c3m1',
        ko: '시뮬레이션에서 순도 80% 이상, 신호 효율 40% 이상이 되는 조건을 찾아라.',
        en: 'On simulation, reach at least 80% purity while keeping at least 40% of the signal.',
        hint_ko: '방향 조건 하나, 에너지 조건 하나로는 모자랍니다. 에너지가 높은 뮤온 다발은 위에서 내려오고, 아래에서 올라오는 대기 중성미자는 에너지가 낮다는 점을 이용해 보세요.',
        hint_en: 'One cut alone is not enough. High-energy muon bundles come from above, and up-going atmospheric neutrinos are low in energy. Combine them.',
      },
      {
        id: 'c3m2',
        ko: '조건을 정한 뒤 봉인을 풀어 실제 데이터에서 후보를 찾아라. 봉인을 푼 뒤에는 조건을 바꾸지 마라.',
        en: 'Fix your cuts, then unblind and find candidates in real data. Do not change the cuts afterwards.',
        hint_ko: '실제 연구에서도 결과를 보기 전에 분석 방법을 확정합니다. 원하는 결과가 나오도록 조건을 맞추는 일을 막기 위해서입니다.',
        hint_en: 'Real analyses freeze their method before looking, so nobody can tune the cuts toward the answer they want.',
      },
      {
        id: 'c3m3',
        ko: '방향 조건을 켠 뒤, 품질 조건으로 위로 올라오는 것처럼 보이는 가짜 뮤온을 90% 이상 없애라.',
        en: 'With the direction cut on, use the quality cut to remove at least 90% of fake up-going muons.',
        hint_ko: '방향을 잘못 계산한 뮤온은 재구성 품질이 낮습니다. 품질 기준을 조금씩 올려 보세요.',
        hint_en: 'Misreconstructed muons have poor fit quality. Raise the quality threshold step by step.',
      },
    ],
    content: {
      ko: {
        observe: `<p>점 하나가 사건 하나입니다. 가로축은 재구성한 방향, 세로축은 빛의 양으로 잰 에너지입니다. 시뮬레이션에서는 각 사건의 정체를 색으로 알 수 있습니다.</p><p>대부분은 대기에서 만들어져 위에서 내려오는 뮤온입니다. 우리가 찾는 우주 중성미자(빨간 점)는 손에 꼽을 만큼 적습니다.</p><p class="q">어떤 조건을 걸면 진짜만 남길 수 있을까? 너무 세게 거르면 무엇을 잃을까?</p>`,
        interact: '조건을 하나씩 더하며 남은 사건 수와 순도, 효율이 어떻게 바뀌는지 보세요. 미션은 선택 사항입니다.',
        understand: `<h4>지구를 필터로 쓴다</h4><p>실제로 IceCube에 들어오는 대기 뮤온은 중성미자 사건보다 약 100만 배 많습니다. 뮤온은 지구를 뚫지 못하지만 중성미자는 뚫고 옵니다. 그래서 아래에서 올라오는 사건만 고르면 뮤온이 거의 사라집니다.</p><h4>잘못 재구성된 뮤온</h4><p>위에서 내려온 뮤온 중 일부(실제로 약 5%)는 방향 계산이 틀려 올라오는 것처럼 보입니다. 재구성 품질 조건으로 이런 사건을 걸러야 합니다.</p><h4>순도와 효율</h4><p>순도는 남은 사건 중 진짜 신호의 비율이고, 효율은 진짜 신호 중 살아남은 비율입니다. 조건을 세게 걸수록 순도는 오르지만 효율은 떨어집니다.</p>$$\\text{순도} = \\frac{\\text{남은 신호}}{\\text{남은 사건}}, \\quad \\text{효율} = \\frac{\\text{남은 신호}}{\\text{전체 신호}}$$<h4>블라인드 분석</h4><p>연구자는 실제 데이터를 보기 전에 시뮬레이션으로 조건을 확정합니다. 결과를 본 뒤 조건을 바꾸면 원하는 답 쪽으로 분석이 기울 수 있기 때문입니다.</p><h4>실제와 다른 점</h4><p>100만 대 1 비율은 화면에 담을 수 없어 잡음 400개, 대기 뮤온 2000개, 대기 중성미자 80개, 우주 중성미자 14개로 줄였습니다. 실제 분석은 훨씬 많은 변수와 기계학습을 함께 씁니다.</p>`,
      },
      en: {
        observe: `<p>Each dot is one event. The horizontal axis is the reconstructed direction, the vertical axis is the energy measured from the light. In simulation, colour tells you what each event really is.</p><p>Most are muons made in the atmosphere, coming from above. The cosmic neutrinos we want (red dots) are a handful.</p><p class="q">Which cuts keep only the real thing? What do you lose if you cut too hard?</p>`,
        interact: 'Add cuts one at a time and watch the counts, purity and efficiency. Missions are optional.',
        understand: `<h4>Using the Earth as a filter</h4><p>In reality IceCube sees about a million atmospheric muons for every neutrino. Muons cannot cross the Earth but neutrinos can, so keeping only up-going events removes almost all muons.</p><h4>Misreconstructed muons</h4><p>Some down-going muons (about 5% in reality) are reconstructed as up-going. A fit-quality cut removes them.</p><h4>Purity and efficiency</h4><p>Purity is the share of real signal among what survives; efficiency is the share of all signal that survives. Harder cuts raise purity and lower efficiency.</p>$$\\text{purity} = \\frac{\\text{signal kept}}{\\text{events kept}}, \\quad \\text{efficiency} = \\frac{\\text{signal kept}}{\\text{all signal}}$$<h4>Blind analysis</h4><p>Researchers fix their cuts on simulation before looking at real data, so the analysis cannot drift toward a hoped-for answer.</p><h4>How this differs from reality</h4><p>The million-to-one ratio cannot fit on screen, so this uses 400 noise events, 2000 atmospheric muons, 80 atmospheric neutrinos and 14 cosmic neutrinos. Real analyses use many more variables and machine learning.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      panel();
      check();
    },
    panel,
    frame() {
      draw();
    },
    reset() {
      Object.assign(st, { cuts: { ...F.NO_CUTS }, view: 'sim', unblinded: false, frozen: null, broken: false });
      panel();
      check();
    },
  };
}
