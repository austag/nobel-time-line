// 2장: 비워도 버티는 틀 (기타가와 1997, 야기 1995~1999).
// 시료를 가열하며 진공으로 비운 뒤, 질소를 조금씩 넣으며 흡착 등온선을 그리고 넓이를 계산한다.
import { TAU, alpha, clamp, text } from '../canvas';
import { readout, segment, slider, stepButton, toggle } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { axes, caption, dot, type Box } from './draw';
import { DOSES, PITCH, SAMPLES, areaFrom, monolayer, uptake, usable, type Sample } from './model';

type Survive = 'robson' | 'mof5' | 'both';
type Size = 'room' | 'court' | 'pitch';

const NAME: Record<Sample, [string, string]> = {
  robson: ['롭슨 틀', "Robson's"],
  kitagawa: ['기타가와 틀', "Kitagawa's"],
  mof5: ['MOF-5', 'MOF-5'],
  zeolite: ['제올라이트', 'zeolite'],
};
const SIZE_M2: Record<Size, number> = { room: 60, court: 420, pitch: PITCH };

export function chapter2(): Chapter {
  let ctx: Ctx;
  const st = {
    sample: 'robson' as Sample,
    T: 200,
    vac: true,
    act: {} as Partial<Record<Sample, { T: number; vac: boolean; use: number }>>,
    pts: {} as Partial<Record<Sample, { p: number; q: number }[]>>,
    survive: null as Survive | null,
    size: null as Size | null,
    heating: 0, // 0~1 비우는 애니메이션
    auto: false,
    autoT: 0,
    t: 0,
  };
  let ui: { ro: ReturnType<typeof readout> };

  const nm = (s: Sample) => NAME[s][k(ctx) ? 0 : 1];
  const pts = (s: Sample) => (st.pts[s] ??= []);

  function activate(): void {
    if (st.heating > 0) return;
    st.heating = 0.001;
  }
  function finishActivate(): void {
    const use = usable(st.sample, st.T, st.vac);
    st.act[st.sample] = { T: st.T, vac: st.vac, use };
    st.pts[st.sample] = [];
    st.heating = 0;
    check();
  }

  function dose(): boolean {
    const a = st.act[st.sample];
    if (!a) {
      ctx.host.toast(tr(ctx, '먼저 시료를 비우세요.', 'Empty the sample first.'));
      st.auto = false;
      return false;
    }
    const list = pts(st.sample);
    const p = DOSES[list.length];
    if (p == null) {
      st.auto = false;
      return false;
    }
    // 측정에는 작은 흔들림이 있다
    const q = uptake(st.sample, p, a.use) * (1 + Math.sin(list.length * 12.9898 + p * 78.2) * 0.004);
    list.push({ p, q });
    check();
    return true;
  }

  /** 등온선에서 읽은 한 겹 흡착량으로 계산한 넓이 (m²/g) */
  function areaOf(s: Sample): number | null {
    const l = pts(s).filter((x) => x.p >= 0.2);
    if (l.length < 2) return null;
    return areaFrom(Math.max(...l.map((x) => x.q)));
  }

  function check(): void {
    const ko = k(ctx);
    const r = st.act.robson;
    const m = st.act.mof5;
    const sName = (v: Survive) => ({ robson: ko ? '롭슨 틀' : "Robson's", mof5: 'MOF-5', both: ko ? '둘 다' : 'both' })[v];
    if (st.survive == null) ctx.host.result('c2m1', tr(ctx, '먼저 어느 틀이 버틸지 고르세요', 'First pick which frame survives'));
    else if (r && m && r.vac && m.vac && r.T >= 150 && m.T >= 150 && m.T <= SAMPLES.mof5.tmax) {
      ctx.host.complete('c2m1', tr(ctx, `롭슨 틀은 쓸 수 있는 공간 ${Math.round(r.use * 100)}%, MOF-5는 ${Math.round(m.use * 100)}% (내 예상: ${sName(st.survive)})`, `Robson's frame kept ${Math.round(r.use * 100)}% usable space, MOF-5 ${Math.round(m.use * 100)}% (my guess: ${sName(st.survive)})`));
      ctx.note('empty', `두 틀을 ${r.T === m.T ? `${r.T}°C` : `${r.T}°C, ${m.T}°C`}로 데우며 진공으로 비우자 이온 하나가 마디인 롭슨의 틀은 무너져 쓸 수 있는 공간이 ${Math.round(r.use * 100)}%만 남았고, 아연 덩어리가 마디인 중성 틀 MOF-5는 ${Math.round(m.use * 100)}%를 지켰다 (예상: ${sName(st.survive)}).`, `Heating under vacuum (${r.T === m.T ? `${r.T}°C` : `${r.T}°C, ${m.T}°C`}), Robson's single-ion frame collapsed to ${Math.round(r.use * 100)}% usable space while the neutral zinc-cluster MOF-5 kept ${Math.round(m.use * 100)}% (I guessed ${sName(st.survive)}).`);
    } else ctx.host.result('c2m1', tr(ctx, '롭슨 틀과 MOF-5를 각각 150°C 넘게, 진공으로 비우세요', "Empty both Robson's frame and MOF-5 above 150°C under vacuum"));

    const a5 = areaOf('mof5');
    if (st.size == null) ctx.host.result('c2m2', tr(ctx, '먼저 2 g의 넓이를 예상하세요', 'First guess the area of 2 g'));
    else if (a5 != null && m && m.use > 0.9 && pts('mof5').length >= 8) {
      const two = Math.round(2 * a5);
      const pc = Math.round((two / PITCH) * 100);
      const g = { room: ko ? '교실' : 'a classroom', court: ko ? '농구장' : 'a basketball court', pitch: ko ? '축구장' : 'a football pitch' }[st.size];
      ctx.host.complete('c2m2', tr(ctx, `1 g에 ${Math.round(a5).toLocaleString()} m², 2 g이면 ${two.toLocaleString()} m² (축구장의 ${pc}%, 내 예상: ${g})`, `${Math.round(a5).toLocaleString()} m² per g; 2 g gives ${two.toLocaleString()} m² (${pc}% of a football pitch; my guess: ${g})`));
      ctx.note('area', `비운 MOF-5에 질소를 조금씩 넣자 흡착량이 낮은 압력에서 빠르게 늘다 평평해지는 I형 등온선이 나왔다. 평평한 높이(한 겹)로 계산한 넓이는 1 g에 ${Math.round(a5).toLocaleString()} m²로, 2 g이면 ${two.toLocaleString()} m², 축구장의 ${pc}%였다 (예상: ${g}).`, `Dosing nitrogen into emptied MOF-5 gave a type I isotherm that rises fast and flattens. From the plateau (one layer) the area was ${Math.round(a5).toLocaleString()} m² per gram, so 2 g gives ${two.toLocaleString()} m², ${pc}% of a football pitch (I guessed ${g}).`);
    } else ctx.host.result('c2m2', tr(ctx, `MOF-5를 잘 비운 뒤 질소를 여덟 번 넘게 넣으세요 (${pts('mof5').length}/8)`, `Empty MOF-5 well, then dose nitrogen eight or more times (${pts('mof5').length}/8)`));

    const az = areaOf('zeolite');
    if (a5 != null && az != null && pts('zeolite').length >= 8) {
      ctx.host.complete('c2m3', tr(ctx, `MOF-5 ${Math.round(a5).toLocaleString()} m², 제올라이트 ${Math.round(az).toLocaleString()} m² (1 g당)`, `MOF-5 ${Math.round(a5).toLocaleString()} m², zeolite ${Math.round(az).toLocaleString()} m² (per g)`));
      ctx.note('zeolite', `같은 방법으로 잰 제올라이트는 1 g에 ${Math.round(az).toLocaleString()} m²로, MOF-5가 ${(a5 / az).toFixed(1)}배 넓었다. 벽이 분자 한 겹 두께라 거의 모든 원자가 빈 공간에 드러나 있기 때문이다.`, `Measured the same way, zeolite had ${Math.round(az).toLocaleString()} m² per gram; MOF-5 was ${(a5 / az).toFixed(1)} times larger, because its walls are one molecule thick so nearly every atom faces empty space.`);
    } else ctx.host.result('c2m3', tr(ctx, '제올라이트도 비우고 같은 방법으로 재세요', 'Empty the zeolite and measure it the same way'));
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
    const sv = segment<Survive>({
      label: ko ? '내 예상: 비우면 어느 틀이 버틸까?' : 'My guess: which frame survives emptying?',
      options: [
        { v: 'robson', label: ko ? '롭슨 틀만' : "only Robson's" },
        { v: 'mof5', label: ko ? 'MOF-5만' : 'only MOF-5' },
        { v: 'both', label: ko ? '둘 다' : 'both' },
      ],
      value: st.survive ?? ('' as Survive),
      onChange: (v) => ((st.survive = v), check()),
    });
    const sz = segment<Size>({
      label: ko ? '내 예상: MOF-5 2 g의 안쪽 넓이는?' : 'My guess: the inner area of 2 g of MOF-5 is about…',
      options: [
        { v: 'room', label: ko ? '교실' : 'classroom' },
        { v: 'court', label: ko ? '농구장' : 'basketball court' },
        { v: 'pitch', label: ko ? '축구장' : 'football pitch' },
      ],
      value: st.size ?? ('' as Size),
      onChange: (v) => ((st.size = v), check()),
    });
    const smp = segment<Sample>({
      label: ko ? '시료 (1 g)' : 'Sample (1 g)',
      options: (['robson', 'kitagawa', 'mof5', 'zeolite'] as Sample[]).map((v) => ({ v, label: nm(v) })),
      value: st.sample,
      onChange: (v) => ((st.sample = v), (st.auto = false)),
    });
    const temp = slider({ label: ko ? '가열 온도' : 'Heating temperature', min: 25, max: 450, step: 5, value: st.T, unit: '°C', onInput: (v) => (st.T = v) });
    const vac = toggle({ label: ko ? '진공 펌프' : 'Vacuum pump', on: st.vac, onText: ko ? '켜짐' : 'on', offText: ko ? '꺼짐' : 'off', onChange: (v) => (st.vac = v) });
    ctx.host.controls.append(
      sv.el,
      sz.el,
      smp.el,
      temp.el,
      vac.el,
      row(stepButton({ label: ko ? '가열하며 비우기' : 'Heat and empty', onClick: activate }).el),
      row(
        stepButton({ label: ko ? '질소 한 번 넣기' : 'Dose nitrogen once', onClick: () => dose() }).el,
        stepButton({ label: ko ? '끝까지 자동으로' : 'Dose to the end', onClick: () => (st.auto = true) }).el,
      ),
      ui.ro.el,
    );
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 64 : 58;
    const leftW = narrow ? W : W * 0.46;
    const fr: Box = { x: 16, y: top + 28, w: leftW - 32, h: narrow ? 60 : Math.min(170, H * 0.24) };
    // 좁은 화면에서는 장치 그림을 빼고 그래프를 키운다
    const ap: Box = narrow ? { x: 0, y: 0, w: 0, h: 0 } : { x: 16, y: fr.y + fr.h + 44, w: leftW - 32, h: Math.min(230, H - fr.y - fr.h - 90) };
    const g: Box = narrow ? { x: 52, y: fr.y + fr.h + 76, w: W - 70, h: Math.max(110, H - fr.y - fr.h - 160) } : { x: leftW + 60, y: top + 40, w: W - leftW - 84, h: H - top - 150 };
    return { W, H, narrow, fr, ap, g };
  };

  /** 틀 그림: 마디 종류, 비운 상태, 무너짐 */
  function frame(c: CanvasRenderingContext2D, x: number, y: number, s: number, smp: Sample, use: number | null, heat: number): void {
    const pal = ctx.pal();
    const collapsed = use != null && use < 0.1;
    const filled = use == null ? 1 : 1 - use;
    c.save();
    if (collapsed) {
      c.strokeStyle = pal.red;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(x, y + s);
      c.lineTo(x + s * 0.3, y + s * 0.72);
      c.lineTo(x + s * 0.55, y + s * 0.88);
      c.lineTo(x + s * 0.8, y + s * 0.68);
      c.lineTo(x + s, y + s);
      c.closePath();
      c.stroke();
    } else {
      const jig = heat > 0 ? Math.sin(st.t * 30) * heat * 1.5 : 0;
      c.strokeStyle = pal.red;
      c.lineWidth = smp === 'mof5' ? 3 : 2.2;
      c.strokeRect(x + jig, y, s, s);
      if (smp === 'kitagawa') {
        c.beginPath();
        c.moveTo(x + s / 2 + jig, y);
        c.lineTo(x + s / 2 + jig, y + s);
        c.stroke();
      }
      c.fillStyle = pal.red;
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (smp === 'mof5' || smp === 'zeolite') c.fillRect(x + u * s - 6 + jig, y + v * s - 6, 12, 12);
        else {
          c.beginPath();
          c.arc(x + u * s + jig, y + v * s, 5, 0, TAU);
          c.fill();
        }
      }
      // 구멍 속 용매 분자
      c.strokeStyle = pal.blue;
      c.lineWidth = 1.5;
      const n = Math.round(6 * filled);
      for (let i = 0; i < n; i++) {
        c.beginPath();
        c.arc(x + s * (0.25 + (i % 3) * 0.25), y + s * (0.3 + Math.floor(i / 3) * 0.4), 4, 0, TAU);
        c.stroke();
      }
      if (smp === 'robson' && filled > 0.5) {
        c.fillStyle = pal.ink;
        text(c, pal, '−', x + s * 0.5, y + s * 0.58, { size: 13, align: 'center' });
      }
    }
    c.restore();
  }

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(c, pal, ko ? '시료를 데우며 진공으로 구멍 속 용매를 빼고, 질소를 조금씩 넣어 몇 개가 표면에 붙는지 잽니다. 77 K(액체 질소 온도)에서 측정합니다.' : 'Heat the sample under vacuum to pull solvent out of the pores, then dose nitrogen and measure how much sticks. Measured at 77 K (liquid nitrogen).', 16, 24, L.W - 32, L.narrow ? 13 : 15);
    // 네 시료의 지금 상태
    const F = L.fr;
    const list: Sample[] = ['robson', 'kitagawa', 'mof5', 'zeolite'];
    const cell = F.w / 4;
    const s = Math.min(cell * 0.5, F.h * 0.5);
    text(c, pal, ko ? '시료 상태 (파란 원: 구멍 속 용매)' : 'Sample state (blue rings: solvent in pores)', F.x, F.y - 10, { size: 13, title: true });
    list.forEach((smp, i) => {
      const x = F.x + i * cell + (cell - s) / 2;
      const a = st.act[smp];
      const heat = smp === st.sample ? st.heating : 0;
      frame(c, x, F.y + 10, s, smp, heat > 0 ? null : a ? a.use : null, heat);
      if (smp === st.sample) {
        c.strokeStyle = pal.blue;
        c.lineWidth = 2;
        c.setLineDash([4, 4]);
        c.strokeRect(F.x + i * cell + 4, F.y, cell - 8, F.h);
        c.setLineDash([]);
      }
      const lab = a ? (a.use < 0.1 ? (ko ? '무너짐' : 'collapsed') : `${ko ? '빈 공간' : 'open'} ${Math.round(a.use * 100)}%`) : ko ? '용매 가득' : 'full of solvent';
      text(c, pal, NAME[smp][ko ? 0 : 1], F.x + i * cell + cell / 2, F.y + s + 30, { size: 11, align: 'center' });
      text(c, pal, lab, F.x + i * cell + cell / 2, F.y + s + 45, { size: 11, align: 'center', color: pal.blue });
    });
    // 측정 장치
    const A = L.ap;
    if (!L.narrow) {
    const by = A.y + A.h * 0.25;
    c.save();
    c.strokeStyle = pal.red;
    c.lineWidth = 2;
    c.strokeRect(A.x, by - 16, A.w * 0.16, 32);
    const vx = A.x + A.w * 0.3;
    c.beginPath();
    c.moveTo(A.x + A.w * 0.16, by);
    c.lineTo(vx - 10, by);
    c.moveTo(vx + 10, by);
    c.lineTo(A.x + A.w * 0.62, by);
    c.lineTo(A.x + A.w * 0.62, A.y + A.h * 0.45);
    c.stroke();
    c.beginPath();
    c.arc(vx, by, 10, 0, TAU);
    c.stroke();
    c.beginPath();
    c.moveTo(vx - 6, by - 6);
    c.lineTo(vx + 6, by + 6);
    c.stroke();
    const gx = A.x + A.w * 0.8;
    c.beginPath();
    c.arc(gx, by, 16, 0, TAU);
    c.stroke();
    const cur = pts(st.sample);
    const pNow = cur.length ? cur[cur.length - 1].p : 0;
    const ang = -Math.PI * 0.85 + pNow * Math.PI * 0.7;
    c.beginPath();
    c.moveTo(gx, by);
    c.lineTo(gx + Math.cos(ang) * 12, by + Math.sin(ang) * 12);
    c.stroke();
    c.beginPath();
    c.moveTo(A.x + A.w * 0.62, by);
    c.lineTo(gx - 16, by);
    c.stroke();
    // 시료관과 액체 질소 통
    const tx = A.x + A.w * 0.62;
    const ty = A.y + A.h * 0.45;
    c.beginPath();
    c.moveTo(tx - 12, ty);
    c.lineTo(tx - 12, A.y + A.h - 22);
    c.quadraticCurveTo(tx, A.y + A.h - 8, tx + 12, A.y + A.h - 22);
    c.lineTo(tx + 12, ty);
    c.stroke();
    const a = st.act[st.sample];
    const fill = a ? clamp(cur.length ? cur[cur.length - 1].q / monolayer(3000) : 0, 0, 1) : 0;
    c.fillStyle = alpha(pal.red, 0.15 + 0.5 * fill);
    c.fillRect(tx - 10, A.y + A.h - 50, 20, 28);
    c.strokeStyle = pal.blue;
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    c.strokeRect(tx - 34, ty + 18, 68, A.h - (ty - A.y) - 18);
    c.setLineDash([]);
    if (st.heating > 0) {
      c.strokeStyle = pal.red;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        const hx = tx - 10 + i * 10;
        c.moveTo(hx, A.y + A.h - 4);
        c.quadraticCurveTo(hx + 4, A.y + A.h - 12, hx, A.y + A.h - 20 - Math.sin(st.t * 8 + i) * 3);
        c.stroke();
      }
    }
    c.restore();
    text(c, pal, ko ? '질소 통' : 'N₂ tank', A.x + A.w * 0.08, by + 32, { size: 12, align: 'center' });
    text(c, pal, ko ? '밸브' : 'valve', vx, by + 26, { size: 12, align: 'center' });
    text(c, pal, ko ? '압력계' : 'gauge', gx, by + 32, { size: 12, align: 'center' });
    text(c, pal, ko ? '시료관 (77 K)' : 'sample tube (77 K)', tx + 40, A.y + A.h - 10, { size: 12 });
    text(c, pal, ko ? '측정 장치' : 'Apparatus', A.x, A.y - 10, { size: 13, title: true });
    }
    // 등온선
    const qmax = monolayer(3100);
    const G = axes(c, pal, L.g, { x0: 0, x1: 0.8, y0: 0, y1: qmax, xt: [0, 0.2, 0.4, 0.6, 0.8], yt: [0, 10, 20, 30], fx: (v) => v.toFixed(1), fy: String, xl: ko ? '상대 압력 p/p₀ →' : 'relative pressure p/p₀ →', yl: ko ? '질소 흡착량 (mmol/g)' : 'N₂ uptake (mmol/g)' });
    const order: Sample[] = ['robson', 'kitagawa', 'zeolite', 'mof5'];
    for (const smp of order) {
      const l = pts(smp);
      if (!l.length) continue;
      c.strokeStyle = smp === st.sample ? pal.red : alpha(pal.ink, 0.5);
      c.lineWidth = smp === st.sample ? 2 : 1.2;
      c.setLineDash(smp === st.sample ? [] : [4, 4]);
      c.beginPath();
      l.forEach((d, i) => (i ? c.lineTo(G.X(d.p), G.Y(d.q)) : c.moveTo(G.X(d.p), G.Y(d.q))));
      c.stroke();
      c.setLineDash([]);
      if (smp === st.sample) l.forEach((d) => dot(c, pal, G.X(d.p), G.Y(d.q), 4, true));
      const last = l[l.length - 1];
      text(c, pal, NAME[smp][ko ? 0 : 1], G.X(last.p) - 4, G.Y(last.q) - 8, { size: 11, align: 'right', color: smp === st.sample ? pal.blue : pal.ink });
    }
    const ar = areaOf(st.sample);
    if (ar != null) {
      const ym = G.Y(Math.max(...pts(st.sample).map((d) => d.q)));
      c.strokeStyle = alpha(pal.red, 0.7);
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(L.g.x, ym);
      c.lineTo(L.g.x + L.g.w, ym);
      c.stroke();
      c.setLineDash([]);
      text(c, pal, ko ? `한 겹 덮은 양 → 1 g에 ${Math.round(ar).toLocaleString()} m²` : `one layer → ${Math.round(ar).toLocaleString()} m² per g`, L.g.x + 10, ym + 16, { size: 12, color: pal.blue });
      const two = 2 * ar;
      const bw = Math.min(L.g.w, 320);
      const bx = L.g.x + L.g.w - bw;
      const byy = L.g.y + L.g.h + 52;
      c.strokeStyle = pal.ink;
      c.lineWidth = 1;
      c.strokeRect(bx, byy, bw, 14);
      c.fillStyle = alpha(pal.red, 0.6);
      c.fillRect(bx, byy, bw * Math.min(1, two / PITCH), 14);
      text(c, pal, ko ? `2 g이면 축구장의 ${Math.round((two / PITCH) * 100)}%` : `2 g = ${Math.round((two / PITCH) * 100)}% of a football pitch`, bx, byy - 4, { size: 12, color: pal.blue });
    }
    const aNow = st.act[st.sample];
    ui.ro.set(
      ko
        ? `${nm(st.sample)}: ${st.heating > 0 ? '비우는 중' : aNow ? `${aNow.T}°C${aNow.vac ? ', 진공' : ''}로 비움, 쓸 수 있는 공간 ${Math.round(aNow.use * 100)}%` : '아직 비우지 않음'}\n질소 ${pts(st.sample).length}번 넣음${ar != null ? `, 넓이 1 g에 ${Math.round(ar).toLocaleString()} m²` : ''}`
        : `${nm(st.sample)}: ${st.heating > 0 ? 'emptying' : aNow ? `emptied at ${aNow.T}°C${aNow.vac ? ' under vacuum' : ''}, ${Math.round(aNow.use * 100)}% usable` : 'not emptied yet'}\n${pts(st.sample).length} nitrogen doses${ar != null ? `, area ${Math.round(ar).toLocaleString()} m² per g` : ''}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '2',
    ko: '비워도 버티는 틀',
    en: 'A frame that survives emptying',
    missions: [
      {
        id: 'c2m1',
        ko: '어느 틀이 버틸지 예상한 뒤, 롭슨의 틀과 MOF-5를 각각 가열하며 진공으로 비워 보라.',
        en: "Guess which frame survives, then empty Robson's frame and MOF-5 by heating under vacuum.",
        hint_ko: '시료를 고르고 가열 온도를 150°C 넘게, 진공 펌프를 켠 채 "가열하며 비우기"를 누르세요. 두 시료 모두요.',
        hint_en: 'Choose a sample, set the temperature above 150°C with the pump on, and press "Heat and empty" for both samples.',
      },
      {
        id: 'c2m2',
        ko: 'MOF-5 2 g의 넓이를 예상한 뒤, 비운 MOF-5에 질소를 조금씩 넣어 등온선을 그리고 넓이를 계산하라.',
        en: 'Guess the area of 2 g of MOF-5, then dose nitrogen into emptied MOF-5, draw the isotherm and work out the area.',
        hint_ko: 'MOF-5를 200°C 근처에서 비운 뒤 "끝까지 자동으로"를 누르세요. 평평해진 높이로 넓이가 계산됩니다.',
        hint_en: 'Empty MOF-5 near 200°C and press "Dose to the end"; the plateau gives the area.',
      },
      {
        id: 'c2m3',
        ko: '같은 무게의 제올라이트도 같은 방법으로 재서 MOF-5와 비교하라.',
        en: 'Measure the same weight of zeolite the same way and compare with MOF-5.',
        hint_ko: '시료를 제올라이트로 바꾸고 비운 다음 끝까지 재세요.',
        hint_en: 'Switch the sample to zeolite, empty it, and dose to the end.',
      },
    ],
    content: {
      ko: {
        observe: `<p>롭슨의 틀은 비우면 무너졌습니다. 연구비 심사에서도 "이미 단단한 제올라이트가 있는데 왜 필요하냐"는 질문을 받았지요. 그래서 남은 숙제는 분명했습니다. <b>빈 공간을 정말로 비워도 버티는 틀</b>을 만들고, 그 안에 기체가 들어간다는 것을 재서 보여 주는 것이었습니다.</p><p>야기는 마디를 금속 이온 하나에서 <b>금속 여러 개와 카복실산염이 뭉친 덩어리</b>로 바꿨습니다. MOF-5의 마디 Zn₄O에는 테레프탈산염 여섯 개가 정팔면체 방향으로 붙어 정육면체 그물을 만듭니다. 기타가와는 코발트, 니켈, 아연 이온과 4,4′-바이피리딘으로 통로가 열린 3차원 틀을 만들어 상온에서 기체를 넣고 빼 봤습니다.</p><p class="q">가열하며 비우면 어느 틀이 버틸까? 버틴다면 2 g 안의 넓이는 얼마나 될까?</p>`,
        interact: '시료를 고르고 가열하며 비운 뒤, 질소를 조금씩 넣어 등온선을 그리세요. 평평해진 높이에서 넓이가 계산됩니다.',
        understand: `<h4>왜 덩어리 마디는 버틸까</h4><p>카복실산염(–COO⁻)은 음전하를 띠고 산소 두 개로 금속을 붙잡아 니트릴보다 훨씬 강하게 붙습니다. 금속 여러 개가 뭉친 마디는 결합 각도가 고정돼 잘 휘지 않습니다. 또 음전하가 금속의 양전하와 상쇄되어 틀 전체가 중성이 되니, 빈 공간에 받쳐 줄 이온이 필요 없습니다. MOF-5는 비운 상태로 공기 중 300°C에서도 안정했고, 결정 부피의 55~60%가 빈 공간이었습니다.</p><h4>흡착 등온선 읽기</h4><p>기체 분자는 벽 가까이에서 반데르발스 힘으로 에너지가 낮아져 잠시 머뭅니다(물리 흡착). 붙는 빠르기와 떨어지는 빠르기가 같아지는 평형에서 흡착량은 랭뮤어 식을 따릅니다.</p>$$q = q_m \\frac{Kp}{1 + Kp}$$<p>낮은 압력에서 빠르게 오르다 표면이 한 겹 덮이면 $q_m$에서 평평해지는 모양이 I형 등온선이고, 미세한 구멍이 열려 있다는 증거입니다. 넓이는 한 겹의 분자 수에 질소 한 분자가 차지하는 면적을 곱해 구합니다.</p>$$S = n_m N_A \\sigma, \\qquad \\sigma_{N_2} \\approx 0.162\\ \\text{nm}^2$$<h4>넓이가 이렇게 큰 까닭</h4><p>MOF-5의 벽은 벤젠 고리 한 겹 두께라 거의 모든 원자가 양쪽 면 모두 빈 공간에 드러나 있습니다. 덩어리 고체는 표면 원자가 극히 일부지만, MOF는 "온통 표면"입니다.</p><h4>실제와 다른 점</h4><p>시료별 넓이와 랭뮤어 상수는 실제 크기에 맞춘 모형 값이고, 비우는 온도에 따른 변화도 단순화했습니다. 실제 넓이 계산에는 BET 식을 더 많이 씁니다.</p>`,
      },
      en: {
        observe: `<p>Robson's frame collapsed when emptied, and funders asked why anyone needed it when sturdy zeolites already existed. The task was clear: build <b>a frame that survives real emptying</b>, and prove by measurement that gas goes inside.</p><p>Yaghi replaced the single-ion node with a <b>cluster of several metals and carboxylates</b>. In MOF-5 each Zn₄O node holds six terephthalates in octahedral directions, giving a cubic net. Kitagawa built 3D frames with open channels from cobalt, nickel or zinc ions and 4,4′-bipyridine, and loaded and unloaded gases at room temperature.</p><p class="q">Heated under vacuum, which frame survives? And if it does, how much area is inside 2 g?</p>`,
        interact: 'Choose a sample, heat and empty it, then dose nitrogen step by step to draw the isotherm. The plateau gives the area.',
        understand: `<h4>Why cluster nodes hold up</h4><p>A carboxylate (–COO⁻) is negatively charged and grips the metal with two oxygens, far more strongly than a nitrile. A node of several metals locks its bond angles, so it hardly bends. The negative charges cancel the metals' positive charge, making the frame neutral, so no ions are needed in the pores to hold it up. Emptied MOF-5 was stable in air at 300°C, and 55 to 60% of the crystal volume was empty.</p><h4>Reading an isotherm</h4><p>Near a wall a gas molecule's energy drops through van der Waals forces and it lingers (physisorption). At equilibrium between sticking and leaving, the uptake follows the Langmuir equation:</p>$$q = q_m \\frac{Kp}{1 + Kp}$$<p>Rising fast at low pressure and flattening at $q_m$ once one layer covers the surface is a type I isotherm, the signature of open micropores. The area is the number of molecules in one layer times the area each nitrogen takes:</p>$$S = n_m N_A \\sigma, \\qquad \\sigma_{N_2} \\approx 0.162\\ \\text{nm}^2$$<h4>Why the area is so large</h4><p>MOF-5's walls are a single benzene ring thick, so nearly every atom faces empty space on both sides. A lump of solid has only a sliver of surface atoms; a MOF is almost all surface.</p><h4>How this differs from reality</h4><p>Sample areas and Langmuir constants are model values of realistic size, and the effect of emptying temperature is simplified. Real area measurements usually use the BET equation.</p>`,
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
      if (st.heating > 0) {
        st.heating += ctx.host.reduced ? 1 : dt / 1.6;
        if (st.heating >= 1) finishActivate();
      }
      if (st.auto && dt > 0) {
        st.autoT += dt;
        if (st.autoT > 0.25) {
          st.autoT = 0;
          if (!dose()) st.auto = false;
        }
      }
      draw();
    },
    reset() {
      st.act = {};
      st.pts = {};
      st.survive = null;
      st.size = null;
      st.heating = 0;
      st.auto = false;
      st.sample = 'robson';
      st.T = 200;
      st.vac = true;
      panel();
      check();
    },
    leave() {
      st.auto = false;
    },
  };
}
