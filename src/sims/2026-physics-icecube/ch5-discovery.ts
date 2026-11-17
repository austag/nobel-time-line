// 5장: 발견 재현하기. NGC 1068 하늘 지도, 새 하늘 도전, 2017년 실시간 경보.
import { TAU, alpha, mix, pow10, text } from '../canvas';
import { readout, segment, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx, type Pt } from './chapter';
import { angDist, hits, pToSigma, rng, sensors as gridSensors, timedHits } from './model';
import * as K from './sky';

type Sub = 'ngc' | 'challenge' | 'alert';

// 2017년 9월 22일 사건 (IceCube-170922A) 과 TXS 0506+056. 나머지 후보 천체는 가상이다.
const ALERT = { ra: 77.43, dec: 5.72, r: 0.8 };
const CANDIDATES = [
  { id: 'a', ra: 76.1, dec: 7.1, flare: false },
  { id: 'b', ra: 77.95, dec: 5.35, flare: false },
  { id: 'txs', ra: 77.36, dec: 5.69, flare: true },
  { id: 'c', ra: 78.9, dec: 4.1, flare: false },
];
const ZOOM = { ra0: 75, ra1: 80, dec0: 3, dec1: 8.5 };

export function chapter5(): Chapter {
  let ctx: Ctx;
  const st = {
    sub: 'ngc' as Sub,
    method: 'old' as K.Method,
    year: 2015,
    radius: 2,
    center: null as { ra: number; dec: number } | null,
    dragging: false,
    tried: { ngc: [] as { ra: number; dec: number }[], challenge: [] as { ra: number; dec: number }[] },
    skies: { ngc: K.makeSky(10, K.NGC1068), challenge: null as K.Sky | null },
    challengeSeed: 100,
    showLabel: false,
    result: null as K.Search | null,
    alertStep: 0,
    alertT: 0,
    picked: null as string | null,
  };
  let cache: { key: string; cv: HTMLCanvasElement } | null = null;
  let ui: { ro: ReturnType<typeof readout> };

  function newChallenge(): void {
    st.challengeSeed++;
    const r = rng(st.challengeSeed * 7919);
    const src = { ra: r() * 360, dec: 8 + r() * 60 };
    st.skies.challenge = K.makeSky(st.challengeSeed, src, 6000, 24);
    st.tried.challenge = [];
    st.center = null;
    st.result = null;
    cache = null;
  }

  const sky = () => (st.sub === 'challenge' ? st.skies.challenge! : st.skies.ngc);
  const method = (): K.Method => (st.sub === 'challenge' ? 'new' : st.method);
  const tried = () => (st.sub === 'challenge' ? st.tried.challenge : st.tried.ngc);

  function evaluate(): void {
    if (!st.center || st.sub === 'alert') return;
    const res = K.search(sky(), method(), st.year, st.center.ra, st.center.dec, st.radius);
    st.result = res;
    const n = Math.max(1, tried().length);
    const global = K.trialCorrected(res.p, n);
    const gs = sigmaFromP(global);
    if (st.sub === 'ngc') {
      const near = angDist(st.center.ra, st.center.dec, K.NGC1068.ra, K.NGC1068.dec) < 1.5;
      if (near && st.method === 'new' && st.year === K.YEARS[1] && res.sigma >= 3) {
        const old = K.search(sky(), 'old', st.year, st.center.ra, st.center.dec, Math.max(st.radius, 3));
        ctx.host.complete('c5m1', tr(ctx, `NGC 1068 방향 ${res.sigma.toFixed(1)}σ (예전 방법으로는 ${old.sigma.toFixed(1)}σ)`, `${res.sigma.toFixed(1)}σ toward NGC 1068 (old method: ${old.sigma.toFixed(1)}σ)`));
        ctx.note('ngc', `10년치 사건을 새 재구성 방법으로 모으자 NGC 1068 방향에서 ${res.sigma.toFixed(1)}σ의 몰림이 보였다. 예전 방법으로는 ${old.sigma.toFixed(1)}σ에 그쳤다.`, `With ten years of events and the new reconstruction, NGC 1068 showed a ${res.sigma.toFixed(1)}σ excess, versus ${old.sigma.toFixed(1)}σ with the old method.`);
        st.showLabel = true;
      }
    } else if (st.sub === 'challenge') {
      const src = sky().source;
      const near = angDist(st.center.ra, st.center.dec, src.ra, src.dec) < 2;
      if (near && gs >= 3) {
        ctx.host.complete('c5m2', tr(ctx, `${tried().length}곳을 찾아본 뒤 보정해도 ${gs.toFixed(1)}σ`, `${gs.toFixed(1)}σ even after correcting for ${tried().length} places searched`));
        ctx.note('challenge', `숨겨진 원천을 찾았다. ${tried().length}곳을 찾아본 것을 보정하고도 ${gs.toFixed(1)}σ였다.`, `I found a hidden source at ${gs.toFixed(1)}σ after correcting for ${tried().length} places searched.`);
      } else if (tried().length >= 10) {
        ctx.host.result('c5m2', tr(ctx, `찾아본 곳 ${tried().length}개. 한 곳만 보면 ${res.sigma.toFixed(1)}σ지만 보정하면 ${gs.toFixed(1)}σ`, `${tried().length} places searched. Locally ${res.sigma.toFixed(1)}σ, corrected ${gs.toFixed(1)}σ`));
      }
    }
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    const sub = segment({
      label: ko ? '이야기' : 'Story',
      value: st.sub,
      options: [
        { v: 'ngc', label: ko ? 'NGC 1068' : 'NGC 1068' },
        { v: 'challenge', label: ko ? '새 하늘 도전' : 'New sky' },
        { v: 'alert', label: ko ? '2017 경보' : '2017 alert' },
      ],
      onChange: (v) => {
        st.sub = v;
        st.center = null;
        st.result = null;
        if (v === 'challenge' && !st.skies.challenge) newChallenge();
        cache = null;
        panel();
      },
    });
    ui = { ro: readout() };
    if (st.sub === 'alert') {
      const steps = [ko ? '1. 방향 재구성' : '1. Reconstruct', ko ? '2. 경보 보내기' : '2. Send alert', ko ? '3. 망원경 관측' : '3. Observe'];
      const next = stepButton({
        label: st.alertStep < 3 ? steps[st.alertStep] : ko ? '빛나는 천체를 지도에서 누르세요' : 'Click the flaring source',
        onClick: () => {
          if (st.alertStep < 3) {
            st.alertStep++;
            st.alertT = 0;
            panel();
          }
        },
      });
      (next.el as HTMLButtonElement).disabled = st.alertStep >= 3;
      const again = stepButton({
        label: ko ? '처음부터' : 'Start over',
        onClick: () => {
          st.alertStep = 0;
          st.picked = null;
          panel();
        },
      });
      again.el.classList.add('ghost');
      ctx.host.controls.append(sub.el, next.el, again.el, ui.ro.el);
      return;
    }
    const year = slider({
      label: ko ? '모은 데이터 (2011년부터)' : 'Data collected (from 2011)',
      min: K.YEARS[0],
      max: K.YEARS[1],
      step: 1,
      value: st.year,
      fmt: (v) => `${v}`,
      onInput: (v) => {
        st.year = v;
        cache = null;
        evaluate();
      },
    });
    const rad = slider({
      label: ko ? '탐색 원 반지름' : 'Search radius',
      min: 0.5,
      max: 5,
      step: 0.1,
      value: st.radius,
      unit: '°',
      fmt: (v) => v.toFixed(1),
      onInput: (v) => {
        st.radius = v;
        evaluate();
      },
    });
    const items: HTMLElement[] = [sub.el, year.el, rad.el];
    if (st.sub === 'ngc') {
      const m = segment({
        label: ko ? '재구성 방법' : 'Reconstruction',
        value: st.method,
        options: [
          { v: 'old', label: ko ? '예전 (2020 분석)' : 'Old (2020)' },
          { v: 'new', label: ko ? '새 방법 (2022)' : 'New (2022)' },
        ],
        onChange: (v) => {
          st.method = v;
          cache = null;
          evaluate();
        },
      });
      items.push(m.el);
    } else {
      const nx = stepButton({ label: ko ? '다른 하늘로' : 'Another sky', onClick: newChallenge });
      nx.el.classList.add('ghost');
      items.push(nx.el);
    }
    ctx.host.controls.append(...items, ui.ro.el);
  }

  function mapRect() {
    const W = ctx.cvs.w;
    const H = ctx.cvs.h;
    const L = 44;
    const w = W - L - 18;
    const h = Math.min(H - 110, (w * (K.DEC_MAX - K.DEC_MIN)) / 360 * 1.6);
    return { L, T: 40, w, h, X: (ra: number) => L + (ra / 360) * w, Y: (dec: number) => 40 + ((K.DEC_MAX - dec) / (K.DEC_MAX - K.DEC_MIN)) * h };
  }

  function mapImage(): HTMLCanvasElement {
    const m = mapRect();
    const pal = ctx.pal();
    const key = `${st.sub}|${st.challengeSeed}|${method()}|${st.year}|${m.w}|${m.h}|${pal.ink}`;
    if (cache?.key === key) return cache.cv;
    const cv = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(m.w * dpr);
    cv.height = Math.round(m.h * dpr);
    const c = cv.getContext('2d')!;
    c.scale(dpr, dpr);
    c.fillStyle = alpha(pal.ink, 0.5);
    const s = sky();
    for (const e of s.events) {
      if (e.year > st.year) continue;
      const p = K.position(e, s, method());
      c.fillRect((p.ra / 360) * m.w - 0.9, ((K.DEC_MAX - p.dec) / (K.DEC_MAX - K.DEC_MIN)) * m.h - 0.9, 1.8, 1.8);
    }
    cache = { key, cv };
    return cv;
  }

  function drawMap(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const m = mapRect();
    c.fillStyle = alpha(pal.blue, pal.dark ? 0.08 : 0.04);
    c.fillRect(m.L, m.T, m.w, m.h);
    c.drawImage(mapImage(), m.L, m.T, m.w, m.h);
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.strokeRect(m.L, m.T, m.w, m.h);
    for (let ra = 0; ra <= 360; ra += 60) text(c, pal, `${ra}°`, m.X(ra), m.T + m.h + 16, { size: 12, align: 'center' });
    for (const dec of [0, 30, 60, 90]) text(c, pal, `${dec}°`, m.L - 6, m.Y(dec) + 4, { size: 12, align: 'right' });
    text(c, pal, ko ? `북쪽 하늘의 중성미자 사건 (${K.YEARS[0]}~${st.year}년, 가상 데이터)` : `Neutrino events in the northern sky (${K.YEARS[0]} to ${st.year}, simulated)`, m.L, m.T - 12, { size: 14, color: pal.blue });
    text(c, pal, ko ? '적경 →' : 'right ascension →', m.L + m.w, m.T + m.h + 34, { size: 12, align: 'right' });

    // 찾아본 곳
    c.strokeStyle = alpha(pal.ink, 0.35);
    c.lineWidth = 1;
    for (const t of tried()) {
      c.beginPath();
      c.ellipse(m.X(t.ra), m.Y(t.dec), (st.radius / 360) * m.w / Math.max(0.2, Math.cos((t.dec * Math.PI) / 180)), (st.radius / (K.DEC_MAX - K.DEC_MIN)) * m.h, 0, 0, TAU);
      c.stroke();
    }
    // 이름표
    if (st.sub === 'ngc' && st.showLabel) {
      c.strokeStyle = pal.red;
      c.lineWidth = 2;
      const x = m.X(K.NGC1068.ra);
      const y = m.Y(K.NGC1068.dec);
      c.beginPath();
      c.moveTo(x - 9, y);
      c.lineTo(x + 9, y);
      c.moveTo(x, y - 9);
      c.lineTo(x, y + 9);
      c.stroke();
      text(c, pal, 'NGC 1068', x + 12, y - 10, { size: 14, title: true });
    }
    // 탐색 원
    if (st.center) {
      const x = m.X(st.center.ra);
      const y = m.Y(st.center.dec);
      c.strokeStyle = pal.red;
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(x, y, (st.radius / 360) * m.w / Math.max(0.2, Math.cos((st.center.dec * Math.PI) / 180)), (st.radius / (K.DEC_MAX - K.DEC_MIN)) * m.h, 0, 0, TAU);
      c.stroke();
    } else {
      const wide = m.w > 520;
      const msg = wide
        ? ko
          ? '지도를 눌러 탐색 원을 놓으세요. 끌면 움직입니다.'
          : 'Click the map to place a search circle. Drag to move it.'
        : ko
          ? '지도를 눌러 탐색 원 놓기'
          : 'Tap to place a circle';
      c.fillStyle = alpha(pal.surface || '#ffffff', 0.85);
      c.font = `${wide ? 16 : 14}px ${pal.title}`;
      const tw = c.measureText(msg).width + 20;
      c.fillRect(m.L + m.w / 2 - tw / 2, m.T + m.h / 2 - 16, tw, 26);
      text(c, pal, msg, m.L + m.w / 2, m.T + m.h / 2 + 3, { size: wide ? 16 : 14, align: 'center', title: true });
    }
    const r = st.result;
    const n = tried().length;
    if (r) {
      const g = sigmaFromP(K.trialCorrected(r.p, Math.max(1, n)));
      ui.ro.set(
        ko
          ? `원 안 사건 ${r.n}개, 배경만이면 ${r.b.toFixed(1)}개\n우연일 확률 ${fmtP(r.p)} → ${r.sigma.toFixed(1)}σ\n찾아본 곳 ${n}개, 보정하면 ${g.toFixed(1)}σ`
          : `${r.n} events in circle, ${r.b.toFixed(1)} expected from background\nChance ${fmtP(r.p)} → ${r.sigma.toFixed(1)}σ\n${n} places searched, corrected ${g.toFixed(1)}σ`,
      );
    } else ui.ro.set(ko ? '탐색 원을 놓으면 계산합니다' : 'Place a search circle to compute');
  }

  function drawAlert(): void {
    const { ctx: c, w: W, h: H } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    // 왼쪽: 검출기에 들어온 고에너지 사건
    const dw = Math.min(W * 0.36, 320);
    const s = dw / 10.5;
    const ox = 20;
    const oy = 50;
    c.fillStyle = alpha(pal.blue, pal.dark ? 0.1 : 0.06);
    c.fillRect(ox, oy, s * 10, s * 6);
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.strokeRect(ox, oy, s * 10, s * 6);
    text(c, pal, ko ? '2017년 9월 22일, 약 290 TeV 사건' : '22 Sep 2017, about 290 TeV', ox, oy - 14, { size: 14, color: pal.blue });
    const ev = { p0: { x: 0, y: 5.4 }, d: { x: Math.cos(-0.5), y: Math.sin(-0.5) }, L: 11, ang: -0.5 };
    const list = gridSensors();
    const hs = hits(ev, 1.31, 0.99, list);
    const th = timedHits(list, hs);
    const tmax = Math.max(...th.map((x) => x.t));
    const tnow = st.alertT * 12;
    list.forEach((p, i) => {
      const hh = hs[i];
      const on = hh && tnow >= hh.t;
      c.beginPath();
      if (on && hh) {
        c.fillStyle = mix(pal.red, pal.blue, hh.t / tmax);
        c.arc(ox + p.x * s, oy + p.y * s, s * (0.12 + 0.22 * Math.sqrt(hh.amp)), 0, TAU);
        c.fill();
      } else {
        c.strokeStyle = alpha(pal.ink, 0.5);
        c.lineWidth = 1.2;
        c.arc(ox + p.x * s, oy + p.y * s, Math.max(2.5, s * 0.1), 0, TAU);
        c.stroke();
      }
    });
    if (st.alertStep >= 1) {
      c.strokeStyle = pal.ink;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(ox + ev.p0.x * s, oy + ev.p0.y * s);
      c.lineTo(ox + (ev.p0.x + ev.d.x * 11) * s, oy + (ev.p0.y + ev.d.y * 11) * s);
      c.stroke();
    }

    // 오른쪽: 확대한 하늘
    const mx = ox + s * 10 + 40;
    const mw = W - mx - 20;
    const mh = Math.min(H - 190, mw * ((ZOOM.dec1 - ZOOM.dec0) / (ZOOM.ra1 - ZOOM.ra0)));
    const my = 50;
    const X = (ra: number) => mx + ((ra - ZOOM.ra0) / (ZOOM.ra1 - ZOOM.ra0)) * mw;
    const Y = (dec: number) => my + ((ZOOM.dec1 - dec) / (ZOOM.dec1 - ZOOM.dec0)) * mh;
    c.fillStyle = alpha(pal.blue, pal.dark ? 0.08 : 0.04);
    c.fillRect(mx, my, mw, mh);
    c.strokeStyle = pal.ink;
    c.lineWidth = 2;
    c.strokeRect(mx, my, mw, mh);
    text(c, pal, ko ? '하늘 확대 (적경 75~80°, 적위 3~8.5°)' : 'Zoomed sky (RA 75 to 80°, Dec 3 to 8.5°)', mx, my - 14, { size: 14, color: pal.blue });
    if (st.alertStep >= 1) {
      c.strokeStyle = pal.red;
      c.lineWidth = 2.5;
      c.setLineDash([6, 5]);
      c.beginPath();
      c.ellipse(X(ALERT.ra), Y(ALERT.dec), (ALERT.r / (ZOOM.ra1 - ZOOM.ra0)) * mw, (ALERT.r / (ZOOM.dec1 - ZOOM.dec0)) * mh, 0, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      text(c, pal, ko ? '중성미자가 온 방향 (90% 범위)' : 'Neutrino direction (90% region)', X(ALERT.ra), Y(ALERT.dec) - (ALERT.r / (ZOOM.dec1 - ZOOM.dec0)) * mh - 8, { size: 13, align: 'center' });
    }
    if (st.alertStep >= 2) {
      CANDIDATES.forEach((cd, i) => {
        const x = X(cd.ra);
        const y = Y(cd.dec);
        c.fillStyle = pal.blue;
        c.beginPath();
        c.arc(x, y, 6, 0, TAU);
        c.fill();
        const name = st.picked === 'txs' && cd.id === 'txs' ? 'TXS 0506+056' : `${ko ? '후보' : 'Source'} ${i + 1}`;
        text(c, pal, name, x + 10, y + 5, { size: 14, title: true });
      });
    }
    // 아래: 밝기 변화
    if (st.alertStep >= 3) {
      const ly = my + mh + 34;
      const lh = H - ly - 30;
      const lw = (W - 60) / 4;
      CANDIDATES.forEach((cd, i) => {
        const lx = 20 + i * (lw + 7);
        c.strokeStyle = pal.ink;
        c.lineWidth = 1.5;
        c.strokeRect(lx, ly, lw, lh);
        text(c, pal, `${ko ? '후보' : 'Source'} ${i + 1}`, lx + 6, ly + 16, { size: 13, title: true });
        const r = rng(i + 3);
        c.strokeStyle = pal.blue;
        c.lineWidth = 2;
        c.beginPath();
        for (let d = 0; d <= 40; d++) {
          const day = d - 30;
          let b = 1 + (r() - 0.5) * 0.25;
          if (cd.flare) b += 3.2 * Math.exp(-((day + 2) ** 2) / 60) + (day > -25 ? 0.6 : 0);
          const x = lx + (d / 40) * lw;
          const y = ly + lh - 6 - (b / 5) * (lh - 26);
          if (d === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
        const x0 = lx + (30 / 40) * lw;
        c.strokeStyle = pal.red;
        c.setLineDash([3, 4]);
        c.beginPath();
        c.moveTo(x0, ly + 20);
        c.lineTo(x0, ly + lh);
        c.stroke();
        c.setLineDash([]);
      });
      text(c, pal, ko ? '감마선 밝기 (빨간 점선: 중성미자가 온 날)' : 'Gamma-ray brightness (red dashes: neutrino day)', 20, ly - 10, { size: 13, color: pal.blue });
    }
    const msgs = ko
      ? ['남극 검출기에 고에너지 중성미자 하나가 들어왔어요.', '방향을 재구성했어요. 이제 전 세계 망원경에 알려야 해요.', '경보를 받은 망원경들이 그 방향을 봐요. 후보 천체가 네 개 있어요.', '어느 천체가 지금 밝아져 있나요? 지도에서 눌러 보세요.']
      : ['A high-energy neutrino just hit the detector.', 'Direction reconstructed. Now tell telescopes around the world.', 'Telescopes look that way. There are four candidate sources.', 'Which one is flaring right now? Click it on the map.'];
    ui.ro.set(msgs[Math.min(3, st.alertStep)] + (st.picked === 'txs' ? (ko ? '\n찾았어요: TXS 0506+056' : '\nFound: TXS 0506+056') : ''));
    alertGeom = { X, Y, mw, mh };
  }

  let alertGeom: { X: (ra: number) => number; Y: (dec: number) => number; mw: number; mh: number } | null = null;

  function draw(): void {
    const { ctx: c, w: W, h: H } = ctx.cvs;
    c.clearRect(0, 0, W, H);
    if (st.sub === 'alert') drawAlert();
    else drawMap();
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  function toSky(p: Pt): { ra: number; dec: number } | null {
    const m = mapRect();
    if (p.x < m.L || p.x > m.L + m.w || p.y < m.T || p.y > m.T + m.h) return null;
    return { ra: ((p.x - m.L) / m.w) * 360, dec: K.DEC_MAX - ((p.y - m.T) / m.h) * (K.DEC_MAX - K.DEC_MIN) };
  }

  function pickAlert(p: Pt): void {
    if (st.alertStep < 3 || !alertGeom) return;
    const g = alertGeom;
    const hit = CANDIDATES.find((cd) => Math.hypot(g.X(cd.ra) - p.x, g.Y(cd.dec) - p.y) < 18);
    if (!hit) return;
    if (hit.flare) {
      st.picked = 'txs';
      ctx.host.complete('c5m3', tr(ctx, 'TXS 0506+056: 중성미자가 온 날 감마선이 크게 밝아져 있던 블레이자', 'TXS 0506+056: a blazar flaring in gamma rays when the neutrino arrived'));
      ctx.note('alert', '고에너지 중성미자 하나의 방향을 망원경에 알려, 그때 밝아져 있던 블레이자 TXS 0506+056을 찾았다. 우연일 가능성은 약 3σ 수준으로 낮았다.', 'Alerting telescopes to one neutrino’s direction led to the flaring blazar TXS 0506+056; chance coincidence was disfavoured at about 3σ.');
    } else {
      ctx.host.toast(tr(ctx, '이 천체는 밝기가 그대로예요. 밝기 그래프를 다시 보세요.', 'This one is steady. Check the brightness graphs again.'));
    }
  }

  return {
    id: '5',
    ko: '발견 재현',
    en: 'Recreate the discovery',
    missions: [
      {
        id: 'c5m1',
        ko: 'NGC 1068: 10년치 데이터와 새 재구성 방법으로 NGC 1068 방향에서 3σ 이상의 몰림을 찾아라.',
        en: 'NGC 1068: with ten years of data and the new reconstruction, find a 3σ excess toward NGC 1068.',
        hint_ko: 'NGC 1068은 적경 약 41°, 적위 0° 부근(지도 왼쪽 아래)에 있습니다. 예전 방법과 새 방법을 번갈아 보며 점들이 얼마나 모이는지 비교하세요.',
        hint_en: 'NGC 1068 sits near RA 41°, Dec 0° (lower left of the map). Switch between methods and watch the dots tighten.',
      },
      {
        id: 'c5m2',
        ko: '새 하늘 도전: 숨겨진 원천을 찾아, 여러 곳을 찾아본 것을 보정하고도 3σ 이상이 되게 하라.',
        en: 'New sky: find the hidden source at 3σ or more even after correcting for every place you searched.',
        hint_ko: '아무 데나 많이 찾아볼수록 보정 후 유의도가 떨어집니다. 먼저 점이 몰린 곳을 눈으로 찾고, 원 크기를 조절해 보세요.',
        hint_en: 'Every extra place you try lowers the corrected significance. Spot the cluster by eye first, then tune the radius.',
      },
      {
        id: 'c5m3',
        ko: '2017 경보: 중성미자 방향을 망원경에 알리고, 그때 밝아져 있던 천체를 찾아라.',
        en: '2017 alert: send the neutrino’s direction to telescopes and find the source that was flaring.',
        hint_ko: '단계 버튼을 차례로 누른 뒤, 빨간 범위 안에 있으면서 밝기 그래프가 솟은 후보를 누르세요.',
        hint_en: 'Step through the buttons, then click the candidate inside the red region whose brightness spikes.',
      },
    ],
    content: {
      ko: {
        observe: `<p>점 하나가 중성미자 사건 하나가 온 방향입니다. 대부분은 대기 중성미자로, 하늘 전체에 무작위로 흩어져 있습니다. 진짜 원천이 있다면 그 방향에 점이 조금 더 몰립니다.</p><p>탐색 원을 놓으면, 배경만 있을 때 기대되는 수보다 얼마나 많은지와 그것이 우연일 확률을 계산합니다.</p><p class="q">점 몇 개가 몰렸을 때 발견이라고 말할 수 있을까?</p>`,
        interact: '이야기를 골라 하늘을 탐색해 보세요. NGC 1068과 2017 경보는 실제 발견을 따라가고, 새 하늘 도전은 매번 새로운 가상 하늘입니다.',
        understand: `<h4>우연일 확률과 σ</h4><p>원 안에 배경만으로 $b$개가 기대될 때 $n$개 이상이 나올 확률은 포아송 분포로 계산합니다.</p>$$p = P(N \\ge n \\mid b) = 1 - \\sum_{k=0}^{n-1} \\frac{e^{-b} b^k}{k!}$$<p>이 확률을 정규분포의 몇 표준편차($\\sigma$)에 해당하는지로 바꿔 말합니다. 물리학에서는 보통 $3\\sigma$를 증거, $5\\sigma$를 발견으로 봅니다.</p><h4>여러 곳을 찾을 때의 함정</h4><p>$k$곳을 찾아보면 그중 하나가 우연히 몰릴 확률이 커집니다.</p>$$p_{\\text{보정}} = 1 - (1 - p)^k$$<h4>NGC 1068 (2022)</h4><p>IceCube는 2011~2020년 데이터에서 활동은하 NGC 1068 방향으로 중성미자 약 79개가 더 몰린 것을 찾았고, 유의도는 $4.2\\sigma$였습니다. 2020년 분석에서 같은 방향은 $2.9\\sigma$였는데, 재구성 방법과 보정이 좋아지면서 증거가 강해졌습니다.</p><h4>TXS 0506+056 (2017)</h4><p>2017년 9월 22일 약 290 TeV의 중성미자가 들어오자 IceCube는 방향을 곧바로 전 세계에 알렸습니다. 그 방향에서 감마선이 크게 밝아진 블레이자 TXS 0506+056이 발견되었고, 우연일 가능성은 약 $3\\sigma$ 수준으로 배제되었습니다. 이어 과거 9.5년 데이터를 다시 보니 2014~2015년에도 같은 방향에서 $3.5\\sigma$의 몰림이 있었습니다. 빛과 중성미자를 함께 보는 다중신호 천문학의 첫 성과입니다.</p><h4>실제와 다른 점</h4><p>하늘 지도의 사건은 모두 가상 데이터이고, 사건 수와 오차는 실제 분석의 흐름을 흉내 내도록 맞췄습니다. 2017 경보의 다른 후보 천체와 밝기 곡선도 가상입니다. 여기서 계산하는 σ는 원 하나만 보는 단순한 방식입니다.</p>`,
      },
      en: {
        observe: `<p>Each dot is the arrival direction of one neutrino event. Most are atmospheric neutrinos scattered randomly over the sky. A real source would make a few extra dots pile up in one direction.</p><p>Place a search circle to compare the count with what background alone would give, and the chance that it is luck.</p><p class="q">How many extra dots does it take to call it a discovery?</p>`,
        interact: 'Pick a story and search the sky. NGC 1068 and the 2017 alert follow real discoveries; the new sky is a fresh simulated sky each time.',
        understand: `<h4>Chance probability and σ</h4><p>If background alone predicts $b$ events in the circle, the chance of seeing $n$ or more follows the Poisson distribution.</p>$$p = P(N \\ge n \\mid b) = 1 - \\sum_{k=0}^{n-1} \\frac{e^{-b} b^k}{k!}$$<p>We quote it as the number of standard deviations $\\sigma$ of a normal distribution. Physicists usually call $3\\sigma$ evidence and $5\\sigma$ a discovery.</p><h4>The look-elsewhere trap</h4><p>Searching $k$ places raises the chance that one of them fluctuates up.</p>$$p_{\\text{corr}} = 1 - (1 - p)^k$$<h4>NGC 1068 (2022)</h4><p>In 2011 to 2020 data IceCube found about 79 extra neutrinos from the active galaxy NGC 1068, at $4.2\\sigma$. The same spot was $2.9\\sigma$ in the 2020 analysis; better reconstruction and calibration strengthened the evidence.</p><h4>TXS 0506+056 (2017)</h4><p>On 22 September 2017 a neutrino of about 290 TeV arrived and IceCube alerted the world within the day. Telescopes found the blazar TXS 0506+056 flaring in gamma rays in that direction; chance coincidence was disfavoured at about $3\\sigma$. Re-examining 9.5 years of archival data then revealed a $3.5\\sigma$ excess from the same spot in 2014 to 2015. It was the first success of multimessenger astronomy with neutrinos.</p><h4>How this differs from reality</h4><p>All sky-map events are simulated, tuned to echo the real analyses. The other alert candidates and light curves are invented. The σ here comes from a simple single-circle count.</p>`,
      },
    },
    enter(c) {
      ctx = c;
      panel();
    },
    panel,
    frame(dt) {
      st.alertT += dt;
      draw();
    },
    reset() {
      Object.assign(st, { method: 'old', year: 2015, radius: 2, center: null, result: null, alertStep: 0, picked: null, showLabel: false });
      st.tried = { ngc: [], challenge: [] };
      cache = null;
      panel();
    },
    down(p) {
      if (st.sub === 'alert') return pickAlert(p);
      const s = toSky(p);
      if (!s) return;
      st.center = s;
      st.dragging = true;
      evaluate();
    },
    move(p) {
      if (!st.dragging) return;
      const s = toSky(p);
      if (s) {
        st.center = s;
        evaluate();
      }
    },
    up() {
      if (!st.dragging || !st.center) return;
      st.dragging = false;
      const list = tried();
      const c0 = st.center;
      if (list.every((t) => angDist(t.ra, t.dec, c0.ra, c0.dec) > st.radius)) list.push({ ...c0 });
      evaluate();
    },
  };
}

function sigmaFromP(p: number): number {
  return p >= 0.5 ? 0 : pToSigma(p);
}

function fmtP(p: number): string {
  if (p >= 0.01) return p.toFixed(2);
  const e = Math.floor(Math.log10(p));
  return `${(p / Math.pow(10, e)).toFixed(1)}×${pow10(e)}`;
}
