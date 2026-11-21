// 3장: 고장 난 설계도 찾기.
// 브런코와 램즈델은 X 염색체에서 구간을 좁혀 후보 유전자를 20개로 줄이고,
// 하나씩 정상 생쥐와 맞춰 본 끝에 스무 번째에서 고장을 찾았다. 그 유전자가 Foxp3 다.
import { alpha, clamp, text } from '../canvas';
import { readout, slider, stepButton } from '../ui';
import { k, tr, type Chapter, type Ctx } from './chapter';
import { caption, inBox, mouse, type Box } from './draw';
import { CULPRIT, GENE_COUNT, NT_NARROW, PATIENTS, SEQ_MUTANT, SEQ_NORMAL, geneCount, regionNt } from './model';

export function chapter3(): Chapter {
  let ctx: Ctx;
  const st = {
    narrow: 0,
    checked: new Set<number>(),
    open: null as number | null,
    patients: 0,
    t: 0,
  };
  let ui: { ro: ReturnType<typeof readout>; sl?: ReturnType<typeof slider> };
  let cells: { n: number; b: Box }[] = [];
  let patientBox: Box | null = null;

  const nt = () => regionNt(st.narrow);
  const genes = () => geneCount(nt());
  const narrowed = () => genes() <= GENE_COUNT;
  const found = () => st.checked.has(CULPRIT);

  const ntText = (v: number) => `${v >= 1e7 ? Math.round(v / 1e4) : (v / 1e4).toFixed(v >= 1e6 ? 0 : 0)}만`;
  const ntTextEn = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} million` : `${Math.round(v / 1000)},000`);

  function openGene(n: number): void {
    if (!narrowed()) {
      ctx.host.toast(tr(ctx, '먼저 구간을 좁혀 후보를 20개로 줄이세요', 'First narrow the region down to 20 candidates'));
      return;
    }
    st.open = n;
    st.checked.add(n);
    check();
  }

  function checkPatient(): void {
    if (!found()) {
      ctx.host.toast(tr(ctx, '먼저 생쥐에서 고장 난 설계도를 찾으세요', 'First find the broken blueprint in the mouse'));
      return;
    }
    if (st.patients < PATIENTS) st.patients++;
    check();
  }

  function check(): void {
    const ko = k(ctx);
    if (narrowed()) {
      ctx.host.complete('c3m1', tr(ctx, `구간 ${ntText(nt())} 염기, 후보 ${genes()}개`, `Region ${ntTextEn(nt())} bases, ${genes()} candidates`));
      ctx.note(
        'narrow',
        `병이 X 염색체를 따라 이어지는 것을 단서로 구간을 좁혀 가자, 약 ${ntText(NT_NARROW)} 염기 안에 후보 유전자 ${GENE_COUNT}개가 남았다. 여기서부터는 하나씩 맞춰 보는 수밖에 없었다.`,
        `Using the fact that the disease follows the X chromosome, the region was narrowed to about ${ntTextEn(NT_NARROW)} bases holding ${GENE_COUNT} candidate genes. From there the only way on was to check them one by one.`,
      );
    } else ctx.host.result('c3m1', tr(ctx, `지금 후보 ${genes()}개 — 20개까지 좁히세요`, `${genes()} candidates now — narrow to 20`));

    if (found()) {
      ctx.host.complete('c3m2', tr(ctx, `${st.checked.size}개를 맞춰 본 끝에 ${CULPRIT}번에서 고장을 찾음`, `Checked ${st.checked.size} and found the break in number ${CULPRIT}`));
      ctx.note(
        'culprit',
        `후보 ${GENE_COUNT}개를 정상 생쥐와 하나씩 맞춰 본 끝에, ${st.checked.size}개째인 ${CULPRIT}번 설계도에서 글자가 끼어든 것을 찾았다. 이 유전자에 Foxp3 라는 이름이 붙었다.`,
        `Checking the ${GENE_COUNT} candidates against a normal mouse one at a time, the break turned up in number ${CULPRIT} after ${st.checked.size} checks: extra letters inserted into the sequence. The gene was named Foxp3.`,
      );
    } else ctx.host.result('c3m2', tr(ctx, `맞춰 본 후보 ${st.checked.size}/${GENE_COUNT}`, `Candidates checked ${st.checked.size}/${GENE_COUNT}`));

    if (st.patients >= PATIENTS) {
      ctx.host.complete('c3m3', tr(ctx, `같은 증상을 보이는 환자 ${PATIENTS}명 모두에서 같은 유전자의 고장을 확인`, `Found breaks in the same gene in all ${PATIENTS} patients`));
      ctx.note(
        'human',
        `생쥐에서 찾은 설계도와 짝이 되는 사람 유전자를, 같은 증상을 보이는 환자 ${PATIENTS}명에게서 확인하자 모두 같은 유전자가 고장나 있었다. 생쥐의 병과 사람의 병이 같은 원인에서 나온 것이다.`,
        `The human counterpart of the gene found in mice was broken in all ${PATIENTS} patients with the same symptoms, showing that the mouse disease and the human disease come from the same cause.`,
      );
    } else ctx.host.result('c3m3', tr(ctx, `확인한 환자 ${st.patients}/${PATIENTS}`, `Patients checked ${st.patients}/${PATIENTS}`));
  }

  function panel(): void {
    const ko = k(ctx);
    ctx.host.controls.replaceChildren();
    ui = { ro: readout() };
    ui.sl = slider({
      label: ko ? '구간 좁히기' : 'Narrow the region',
      min: 0,
      max: 100,
      step: 1,
      value: st.narrow,
      fmt: (v) => (ko ? `${ntText(regionNt(v))} 염기 · 후보 ${geneCount(regionNt(v))}개` : `${ntTextEn(regionNt(v))} bases · ${geneCount(regionNt(v))} genes`),
      onInput: (v) => (st.narrow = v),
    });
    ctx.host.controls.append(
      ui.sl.el,
      stepButton({
        label: ko ? '다음 후보 맞춰 보기' : 'Check the next candidate',
        onClick: () => {
          for (let n = 1; n <= GENE_COUNT; n++)
            if (!st.checked.has(n)) {
              openGene(n);
              return;
            }
        },
      }).el,
      stepButton({ label: ko ? '사람 환자 한 명 확인' : 'Check one patient', onClick: checkPatient }).el,
      ui.ro.el,
    );
  }

  const lay = () => {
    const { w: W, h: H } = ctx.cvs;
    const narrow = W < 760;
    const top = narrow ? 66 : 56;
    const chr: Box = { x: 14, y: top + 8, w: W - 28, h: narrow ? 34 : 44 };
    const gw = narrow ? W - 28 : W * 0.52;
    const grid: Box = { x: 14, y: chr.y + chr.h + (narrow ? 24 : 30), w: gw, h: narrow ? 104 : Math.max(150, (H - chr.y - chr.h - 60) * 0.56) };
    const seq: Box = narrow
      ? { x: 14, y: grid.y + grid.h + 12, w: W - 28, h: 96 }
      : { x: grid.x + gw + 24, y: grid.y, w: W - gw - 60, h: 130 };
    const pb: Box = narrow
      ? { x: 14, y: seq.y + seq.h + 10, w: W - 28, h: Math.max(72, H - seq.y - seq.h - 20) }
      : { x: seq.x, y: seq.y + seq.h + 22, w: seq.w, h: 108 };
    const mb: Box = narrow
      ? { x: 0, y: 0, w: 0, h: 0 }
      : { x: grid.x + 8, y: grid.y + grid.h + 26, w: Math.min(220, gw * 0.5), h: Math.max(60, H - grid.y - grid.h - 56) };
    return { W, H, narrow, top, chr, grid, seq, pb, mb };
  };

  function draw(): void {
    const { ctx: c } = ctx.cvs;
    const pal = ctx.pal();
    const ko = k(ctx);
    const L = lay();
    c.clearRect(0, 0, L.W, L.H);
    caption(
      c,
      pal,
      L.narrow
        ? ko
          ? '구간을 좁히고 후보 설계도를 하나씩 맞춰 봅니다.'
          : 'Narrow the region, then check the candidate blueprints one by one.'
        : ko
          ? '비늘 같은 살갗에 지라가 붓고 몇 주 만에 죽는 생쥐가 있었습니다. 병이 아들에게만 이어져 범인은 X 염색체에 있었습니다. 구간을 좁히고 후보를 하나씩 맞춰 봅니다.'
          : 'Some mice had scaly skin and swollen spleens and died within weeks. The disease passed only to males, so the culprit lay on the X chromosome. Narrow the region, then check the candidates one by one.',
      16,
      24,
      L.W - 32,
      L.narrow ? 13 : 15,
    );

    // X 염색체 막대와 좁힌 구간
    const B = L.chr;
    c.save();
    c.strokeStyle = pal.ink;
    c.lineWidth = 1.5;
    c.fillStyle = alpha(pal.blue, 0.08);
    c.beginPath();
    c.roundRect(B.x, B.y, B.w, B.h * 0.56, B.h * 0.28);
    c.fill();
    c.stroke();
    const frac = Math.max(0.012, nt() / regionNt(0));
    const cx = B.x + B.w * 0.56;
    const ww = Math.max(6, B.w * frac);
    c.strokeStyle = pal.red;
    c.lineWidth = 2.5;
    c.fillStyle = alpha(pal.red, 0.14);
    c.beginPath();
    c.roundRect(cx - ww / 2, B.y - 3, ww, B.h * 0.56 + 6, 5);
    c.fill();
    c.stroke();
    c.restore();
    text(c, pal, ko ? 'X 염색체' : 'X chromosome', B.x, B.y - 6, { size: 12 });
    text(c, pal, ko ? `좁힌 구간 ${ntText(nt())} 염기 · 후보 ${genes()}개` : `region ${ntTextEn(nt())} bases · ${genes()} candidates`, B.x + B.w, B.y - 6, { size: 12, align: 'right', color: pal.blue });

    // 후보 유전자 격자
    const G = L.grid;
    const cols = L.narrow ? 5 : 10;
    const rows = Math.ceil(GENE_COUNT / cols);
    const cw = G.w / cols;
    // 칸이 너무 길쭉해지지 않게 높이를 묶고, 격자를 세로 가운데에 둔다
    const ch = Math.min(G.h / rows, cw * 0.78);
    const gy = G.y;
    cells = [];
    for (let i = 0; i < GENE_COUNT; i++) {
      const n = i + 1;
      const b: Box = { x: G.x + (i % cols) * cw + 3, y: gy + Math.floor(i / cols) * ch + 3, w: cw - 6, h: ch - 6 };
      cells.push({ n, b });
      const done = st.checked.has(n);
      const isIt = done && n === CULPRIT;
      c.save();
      c.strokeStyle = isIt ? pal.red : done ? pal.grid : narrowed() ? pal.blue : pal.grid;
      c.lineWidth = isIt ? 2.6 : 1.4;
      c.fillStyle = done ? alpha(pal.ink, 0.04) : pal.surface;
      c.globalAlpha = narrowed() ? 1 : 0.4;
      c.beginPath();
      c.roundRect(b.x, b.y, b.w, b.h, 5);
      c.fill();
      c.stroke();
      c.restore();
      const lab = isIt ? `${n} ✗` : done ? `${n} ✓` : String(n);
      text(c, pal, lab, b.x + b.w / 2, b.y + b.h / 2 + 5, { size: Math.min(14, b.h * 0.42), align: 'center', color: isIt ? pal.blue : narrowed() ? pal.ink : pal.grid });
    }
    text(c, pal, ko ? `후보 설계도 ${GENE_COUNT}개` : `${GENE_COUNT} candidate blueprints`, G.x, G.y - 8, { size: 12 });

    // 염기 비교 창
    const S = L.seq;
    c.save();
    c.strokeStyle = pal.grid;
    c.lineWidth = 1.2;
    c.beginPath();
    c.roundRect(S.x, S.y, S.w, S.h, 6);
    c.stroke();
    c.restore();
    const open = st.open;
    if (open == null) {
      text(c, pal, ko ? '후보를 눌러 두 생쥐의 염기를 맞춰 보세요' : 'Tap a candidate to compare the two mice', S.x + S.w / 2, S.y + S.h / 2, { size: 12, align: 'center' });
    } else {
      const bad = open === CULPRIT;
      const fs = Math.min(15, S.w / 16);
      text(c, pal, ko ? `${open}번 설계도` : `blueprint ${open}`, S.x + 10, S.y + 18, { size: 12 });
      text(c, pal, ko ? '정상' : 'normal', S.x + 10, S.y + 42, { size: 12 });
      text(c, pal, SEQ_NORMAL.split('').join(' '), S.x + 62, S.y + 42, { size: fs, color: pal.ink });
      text(c, pal, ko ? '병든 생쥐' : 'sick mouse', S.x + 10, S.y + 66, { size: 12 });
      text(c, pal, (bad ? SEQ_MUTANT : SEQ_NORMAL).split('').join(' '), S.x + 62, S.y + 66, { size: fs, color: bad ? pal.blue : pal.ink });
      if (bad) {
        // 끼어든 글자에 밑줄
        const pre = c.measureText('').width;
        void pre;
        text(c, pal, ko ? '글자가 끼어들어 단백질이 중간에 끊긴다' : 'extra letters cut the protein short', S.x + 10, S.y + S.h - 10, { size: 12, color: pal.blue });
      } else {
        text(c, pal, ko ? '정상과 같다' : 'same as normal', S.x + 10, S.y + S.h - 10, { size: 12 });
      }
    }

    // 사람 환자
    const P = L.pb;
    patientBox = P;
    c.save();
    c.strokeStyle = pal.grid;
    c.lineWidth = 1.2;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.roundRect(P.x, P.y, P.w, P.h, 6);
    c.stroke();
    c.setLineDash([]);
    c.restore();
    text(c, pal, ko ? '같은 증상을 보이는 사람 환자' : 'patients with the same symptoms', P.x + 10, P.y + 16, { size: 12 });
    for (let i = 0; i < PATIENTS; i++) {
      const bx = P.x + 12 + i * ((P.w - 24) / PATIENTS);
      const on = i < st.patients;
      text(c, pal, ko ? `환자 ${i + 1}` : `patient ${i + 1}`, bx, P.y + 40, { size: 12 });
      text(c, pal, on ? (ko ? '같은 유전자 고장' : 'same gene broken') : ko ? '확인 전' : 'not checked', bx, P.y + 58, { size: 12, color: on ? pal.blue : pal.grid });
    }

    // 병든 생쥐: 넓은 화면에서는 격자 바로 아래 빈자리에 둔다
    if (!L.narrow) {
      const my = gy + ch * rows + 24;
      const mh = L.H - my - 34;
      if (mh > 50) {
        const mb: Box = { x: L.mb.x, y: my, w: L.mb.w, h: mh };
        mouse(c, pal, mb, { alpha: 0.75 });
        text(c, pal, ko ? '병이 아들에게만 이어진 생쥐 계통' : 'a strain whose disease passed only to sons', mb.x + mb.w / 2, my + mh + 16, { size: 12, align: 'center' });
      }
    }

    ui.ro.set(
      ko
        ? `구간 ${ntText(nt())} 염기 · 후보 ${genes()}개\n맞춰 본 후보 ${st.checked.size}/${GENE_COUNT}${found() ? ` · ${CULPRIT}번에서 고장 찾음` : ''} · 환자 ${st.patients}/${PATIENTS}`
        : `region ${ntTextEn(nt())} bases · ${genes()} candidates\nchecked ${st.checked.size}/${GENE_COUNT}${found() ? ` · break found in ${CULPRIT}` : ''} · patients ${st.patients}/${PATIENTS}`,
    );
    ctx.cvs.cv.setAttribute('aria-label', ui.ro.el.textContent ?? '');
  }

  return {
    id: '3',
    ko: '고장 난 설계도 찾기',
    en: 'Finding the broken blueprint',
    missions: [
      {
        id: 'c3m1',
        ko: 'X 염색체의 구간을 좁혀 후보 유전자를 20개까지 줄여라.',
        en: 'Narrow the region on the X chromosome down to 20 candidate genes.',
        hint_ko: '"구간 좁히기" 손잡이를 끝까지 올리세요. 막대 위 빨간 구간이 줄어듭니다.',
        hint_en: 'Push the "Narrow the region" slider to the end and watch the red window shrink.',
      },
      {
        id: 'c3m2',
        ko: '후보를 하나씩 정상 생쥐와 맞춰 보고 고장 난 설계도를 찾아라.',
        en: 'Check the candidates against a normal mouse one by one and find the broken blueprint.',
        hint_ko: '격자의 번호를 누르거나 "다음 후보 맞춰 보기"를 반복해서 누르세요.',
        hint_en: 'Tap the numbers in the grid, or press "Check the next candidate" repeatedly.',
      },
      {
        id: 'c3m3',
        ko: '같은 증상을 보이는 사람 환자에게서도 같은 유전자의 고장을 확인하라.',
        en: 'Confirm the same gene is broken in human patients with the same symptoms.',
        hint_ko: '생쥐에서 고장을 찾은 뒤 "사람 환자 한 명 확인"을 세 번 누르세요.',
        hint_en: 'After finding the break in the mouse, press "Check one patient" three times.',
      },
    ],
    content: {
      ko: {
        observe: `<p>1940년대 미국 오크리지의 한 실험실에서 이상한 생쥐 계통이 나타났습니다. 수컷 새끼들이 비늘 같은 살갗에 지라와 림프절이 붓고 몇 주 만에 죽었습니다. 병이 아들에게만 이어졌으니 원인은 <b>X 염색체</b>에 있었습니다.</p><p>1990년대에 메리 브런코와 프레드 램즈델이 그 유전자를 찾아 나섰습니다. 사람 유전체를 다 읽기 전이라, 구간을 좁히고 후보를 하나씩 손으로 맞춰 보는 수밖에 없었습니다.</p><p class="q">브레이크를 쥔 세포는 어떤 설계도로 만들어질까?</p>`,
        interact: '손잡이로 구간을 좁혀 후보를 20개까지 줄인 뒤, 번호를 눌러 정상 생쥐와 염기를 맞춰 보세요.',
        understand: `<h4>좁히고, 하나씩 맞춰 보기</h4><p>병이 어느 염색체를 따라 이어지는지 보면 범인이 있는 구역을 알 수 있고, 가족 안에서 병과 함께 전해지는 표지를 따라가면 구역이 점점 줄어듭니다. 이렇게 약 ${Math.round(NT_NARROW / 1e4)}만 염기, 후보 ${GENE_COUNT}개까지 줄였습니다. 그다음은 하나씩 정상과 맞춰 보는 수밖에 없고, 범인은 ${CULPRIT}번째였습니다.</p><p>이 유전자에는 Foxp3 라는 이름이 붙었습니다. 유전자가 만드는 단백질은 다른 유전자를 켜고 끄는 스위치 노릇을 합니다. 세포 하나의 성격을 통째로 정하는 자리라는 뜻입니다.</p><h4>사람에게도 같은 병이 있다</h4><p>두 사람은 생쥐의 병과 증상이 닮은 사람 병을 떠올렸습니다. 소아과 의사들의 도움으로 환자들의 유전자를 확인하자, 생쥐 유전자와 짝이 되는 사람 유전자가 똑같이 고장나 있었습니다. 생쥐의 병과 사람의 병이 하나로 이어진 것입니다.</p><h4>2장과 3장이 만나는 곳</h4><p>남은 질문은 이것이었습니다. 이 설계도가 고장나면 왜 온몸을 공격할까? 답은 2장의 세포였습니다. 2003년에 사카구치와 동료들이 이 유전자가 바로 브레이크를 쥔 세포를 만드는 스위치임을 보였습니다. CD25 는 활성화된 세포에도 나타나는 명찰이라 논쟁이 남아 있었지만, 유전자가 나오자 이 세포가 따로 있는 종류라는 것이 분명해졌습니다.</p><h4>실제와 다른 점</h4><p>구간 크기와 후보 수는 보고된 값에 맞췄고, 좁히는 손잡이와 염기 글자는 과정을 보여 주기 위한 모형입니다. 실제로는 여러 해에 걸친 작업이었습니다.</p>`,
      },
      en: {
        observe: `<p>In the 1940s a strange mouse strain turned up in a laboratory at Oak Ridge in the United States. Affected males had scaly skin, swollen spleens and lymph nodes, and died within weeks. The disease passed only to sons, so the cause lay on the <b>X chromosome</b>.</p><p>In the 1990s Mary Brunkow and Fred Ramsdell set out to find the gene. The human genome had not yet been read, so the only way was to narrow the region and check the candidates by hand, one at a time.</p><p class="q">From what blueprint are the cells holding the brake built?</p>`,
        interact: 'Narrow the region to 20 candidates with the slider, then tap a number to compare its sequence with a normal mouse.',
        understand: `<h4>Narrow, then check one by one</h4><p>Which chromosome a disease follows tells you the neighbourhood, and markers that travel with the disease through a family shrink it further. That took the search down to about ${Math.round(NT_NARROW / 1000)} thousand bases holding ${GENE_COUNT} candidates. After that the only way on was to compare each with a normal mouse — and the culprit was number ${CULPRIT}.</p><p>The gene was named Foxp3. The protein it makes acts as a switch that turns other genes on and off, which means it can set the whole character of a cell.</p><h4>The same disease in people</h4><p>The pair suspected a rare human disease whose symptoms resembled the mouse one. With the help of paediatricians they checked patients' genes, and the human counterpart of the mouse gene was broken in just the same way, tying the mouse disease and the human disease together.</p><h4>Where chapters two and three meet</h4><p>One question remained: why does a break in this blueprint cause an attack on the whole body? The answer was the cells of chapter two. In 2003 Sakaguchi and colleagues showed that this gene is the switch that builds the cells holding the brake. CD25 also appears on activated cells, so doubt had lingered — but with a gene in hand it was clear that these cells are a kind of their own.</p><h4>How this differs from reality</h4><p>The region size and candidate count match the reported values; the slider and the letters are a model of the process. In reality the work took years.</p>`,
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
      draw();
    },
    reset() {
      st.narrow = 0;
      st.checked.clear();
      st.open = null;
      st.patients = 0;
      panel();
      check();
    },
    down(p) {
      for (const cell of cells)
        if (inBox(cell.b, p.x, p.y)) {
          openGene(cell.n);
          return;
        }
      if (patientBox && inBox(patientBox, p.x, p.y)) checkPatient();
    },
  };
}
