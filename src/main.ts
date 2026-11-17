import './styles.css';
import { FIELDS, FIRST_YEAR, LAST_YEAR, PRIZES, YEARS, findPrize, type Field, type Prize } from './data';
import { STR, type Lang, type Strings } from './i18n';
import { previewSvg } from './previews';
import { experimentHash, homeHash, parseHash, type Route } from './router';
import { closeExperiment, isOpen, mountExperiment, showChapter } from './experiment';
import { hasSim } from './sims/registry';

type Theme = 'light' | 'dark';

// 저장소를 쓸 수 없는 환경에서도 동작하도록 감싼다.
function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 실패는 무시한다 */
  }
}

const state = {
  lang: (load('lang') ?? (navigator.language.startsWith('ko') ? 'ko' : 'en')) as Lang,
  theme: (load('theme') ??
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) as Theme,
  field: 'all' as Field | 'all',
  year: 'all' as number | 'all',
  page: '' as '' | 'home' | 'about' | 'notfound',
  lastHomeHash: '#/',
  lastCardId: '',
  openInfo: new Set<string>(),
};

const app = document.querySelector<HTMLDivElement>('#app')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;

const t = (): Strings => STR[state.lang];

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

let toastTimer = 0;
function toast(message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2000);
}

function applyChrome(): void {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.lang;
  document.title = t().siteName;
}

/* ---------- 조각 ---------- */

function shape(field: Field): string {
  return `<span class="shape shape-${field}" aria-hidden="true"></span>`;
}

function headerHtml(): string {
  const s = t();
  return `
  <header class="site-header">
    <div class="wrap header-row">
      <a class="logo" href="#/">${esc(s.siteName)}</a>
      <nav class="nav">
        <a class="nav-btn" href="#/about">${esc(s.about)}</a>
        <button class="nav-btn" data-action="lang">${esc(s.langToggle)}</button>
        <button class="nav-btn" data-action="theme">${esc(state.theme === 'dark' ? s.themeToLight : s.themeToDark)}</button>
        <a class="nav-btn nav-github" href="https://github.com/austag/nobel-time-line" target="_blank" rel="noopener">GitHub</a>
      </nav>
    </div>
  </header>`;
}

function footerHtml(): string {
  const s = t();
  return `
  <footer class="site-footer">
    <div class="wrap">
      <p>${esc(s.footNotice)}</p>
      <p>${esc(s.footSource)}</p>
      <p>${esc(s.footLicense)}</p>
    </div>
  </footer>`;
}

function dialHtml(): string {
  let ticks = '';
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
    if (YEARS.includes(y)) {
      const on = state.year === y;
      ticks += `<button class="tick tick-data${on ? ' on' : ''}" data-action="year" data-year="${y}" aria-pressed="${on}"><span class="tick-line"></span><span class="tick-label">${y}</span></button>`;
    } else if (y % 10 === 0) {
      ticks += `<div class="tick tick-decade"><span class="tick-line"></span><span class="tick-label">${y}</span></div>`;
    } else {
      ticks += `<div class="tick"><span class="tick-line"></span></div>`;
    }
  }
  return `
  <section class="dial">
    <div class="dial-scroll"><div class="dial-track">${ticks}</div></div>
    <p class="dial-caption">${esc(t().available)}: ${YEARS.join(', ')}</p>
  </section>`;
}

function filtersHtml(): string {
  const s = t();
  const chip = (action: string, value: string, label: string, on: boolean, extra = '') =>
    `<button class="chip${on ? ' on' : ''}" data-action="${action}" data-value="${value}" aria-pressed="${on}">${extra}${esc(label)}</button>`;
  const fields =
    chip('field', 'all', s.all, state.field === 'all') +
    FIELDS.map((f) => chip('field', f, s[f], state.field === f, shape(f))).join('');
  const years =
    chip('yearchip', 'all', s.all, state.year === 'all') +
    YEARS.map((y) => chip('yearchip', String(y), String(y), state.year === y)).join('');
  return `
  <section class="filters">
    <div class="chip-group"><span class="chip-title">${esc(s.filterField)}</span>${fields}</div>
    <div class="chip-group"><span class="chip-title">${esc(s.filterYear)}</span>${years}</div>
  </section>`;
}

function cardHtml(p: Prize): string {
  const s = t();
  const ko = state.lang === 'ko';
  const id = `card-${p.year}-${p.category}`;
  const open = state.openInfo.has(id);
  const names = p.laureates.map((l) => (ko ? l.name_ko : l.name)).join(', ');
  const info = open
    ? `<div class="card-info">
        <p class="motivation"><em>${esc(p.motivation)}</em></p>
        ${ko ? `<p>${esc(p.motivation_ko)}</p>` : ''}
        ${p.motivation_verified ? '' : `<p class="note">${esc(s.unverified)}</p>`}
        <p><a href="${esc(p.official_url)}" target="_blank" rel="noopener" data-stop>${esc(s.official)}</a></p>
      </div>`
    : '';
  return `
  <article class="card" id="${id}" tabindex="0" data-action="open" data-year="${p.year}" data-field="${p.category}">
    <div class="card-field">${shape(p.category)}<span>${esc(s[p.category])}</span></div>
    <div class="card-preview">${previewSvg(p.sim)}</div>
    <h3 class="card-title">${esc(ko ? p.title_ko : p.title_en)}</h3>
    <p class="card-summary">${esc(ko ? p.summary_ko : p.summary_en)}</p>
    <p class="card-names">${esc(names)}</p>
    <div class="card-actions">
      <button class="btn-primary" data-action="open" data-year="${p.year}" data-field="${p.category}">${esc(s.start)}</button>
      <button class="btn-text" data-action="info" data-card="${id}" aria-expanded="${open}">${esc(s.info)}</button>
    </div>
    ${info}
  </article>`;
}

function listHtml(): string {
  const shown = PRIZES.filter(
    (p) =>
      (state.field === 'all' || p.category === state.field) &&
      (state.year === 'all' || p.year === state.year),
  );
  if (shown.length === 0) return `<p class="empty">${esc(t().empty)}</p>`;
  const years = [...new Set(shown.map((p) => p.year))];
  return years
    .map(
      (y) => `
    <section class="year-group">
      <h2 class="year-heading">${y}</h2>
      <div class="grid">${shown.filter((p) => p.year === y).map(cardHtml).join('')}</div>
    </section>`,
    )
    .join('');
}

/* ---------- 페이지 ---------- */

function renderHome(): void {
  const s = t();
  state.page = 'home';
  app.innerHTML = `
  ${headerHtml()}
  <main class="wrap main">
    <section class="intro">
      <h1 class="site-title">${esc(s.siteName)}</h1>
      <p class="site-subtitle">${esc(s.subtitle)}</p>
    </section>
    <div id="dial">${dialHtml()}</div>
    <div id="filters">${filtersHtml()}</div>
    <div id="list">${listHtml()}</div>
    <section class="more">${esc(s.more)}</section>
  </main>
  ${footerHtml()}`;
}

// 필터만 바뀔 때는 목록 부분만 다시 그려서 스크롤 위치를 지킨다.
function updateHome(): void {
  document.querySelector('#dial')!.innerHTML = dialHtml();
  document.querySelector('#filters')!.innerHTML = filtersHtml();
  document.querySelector('#list')!.innerHTML = listHtml();
}

function renderAbout(): void {
  const s = t();
  state.page = 'about';
  app.innerHTML = `
  ${headerHtml()}
  <main class="wrap main about">
    <h1 class="page-title">${esc(s.aboutTitle)}</h1>
    <p>${esc(s.aboutWhy)}</p>
    <p>${esc(s.footNotice)}</p>
    <p>${esc(s.footSource)}</p>
    <p>${esc(s.footLicense)}</p>
    <p>${esc(s.aboutFonts)}</p>
    <p><a class="btn-primary as-link" href="#/">${esc(s.home)}</a></p>
  </main>
  ${footerHtml()}`;
  window.scrollTo(0, 0);
}

function renderNotFound(): void {
  const s = t();
  state.page = 'notfound';
  app.innerHTML = `
  ${headerHtml()}
  <main class="wrap main about">
    <h1 class="page-title">${esc(s.notFound)}</h1>
    <p><a class="btn-primary as-link" href="#/">${esc(s.home)}</a></p>
  </main>
  ${footerHtml()}`;
}

/* ---------- 체험 오버레이 ---------- */

function openOverlay(p: Prize, chapter?: string): void {
  const s = t();
  const ko = state.lang === 'ko';
  // 같은 체험이 이미 열려 있으면 그대로 둔다 (진행 상태 유지).
  if (!overlay.hidden && isOpen(p)) {
    const th = overlay.querySelector<HTMLButtonElement>('[data-action="theme"]');
    if (th) th.textContent = state.theme === 'dark' ? s.themeToLight : s.themeToDark;
    showChapter(chapter);
    return;
  }
  closeExperiment();
  const bar = `
  <div class="ov-bar">
    <div class="ov-title" id="ov-title">${shape(p.category)}<span>${p.year} ${esc(s[p.category])} | ${esc(ko ? p.title_ko : p.title_en)}</span></div>
    <button class="chip" data-action="theme">${esc(state.theme === 'dark' ? s.themeToLight : s.themeToDark)}</button>
    <button class="chip" data-action="copy">${esc(s.copyLink)}</button>
    <button class="chip" data-action="close" aria-label="${esc(s.close)}">✕</button>
  </div>`;
  if (hasSim(p.sim)) {
    overlay.innerHTML = bar;
    mountExperiment(overlay, p, {
      lang: state.lang,
      strings: s,
      toast,
      chapter,
      // 장을 바꾸면 주소에도 남겨서 공유 링크가 그 장으로 열리게 한다.
      onChapter: (id) => history.replaceState(null, '', experimentHash(p.year, p.category, id)),
    });
  } else {
    overlay.innerHTML = `${bar}
  <div class="ov-body">
    <div class="ov-preview">${previewSvg(p.sim)}</div>
    <div class="ov-panel">
      <h2 class="card-title">${esc(s.comingTitle)}</h2>
      <p>${esc(s.comingBody)}</p>
      <p><a href="${esc(p.official_url)}" target="_blank" rel="noopener">${esc(s.official)}</a></p>
    </div>
  </div>`;
  }
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'ov-title');
  overlay.hidden = false;
  document.body.classList.add('locked');
  overlay.querySelector<HTMLButtonElement>('[data-action="close"]')?.focus();
}

function closeOverlay(): void {
  if (overlay.hidden) return;
  closeExperiment();
  overlay.hidden = true;
  overlay.innerHTML = '';
  document.body.classList.remove('locked');
  if (state.lastCardId) document.getElementById(state.lastCardId)?.focus({ preventScroll: true });
}

/* ---------- 라우팅 ---------- */

function applyRoute(): void {
  const route: Route = parseHash(location.hash);
  applyChrome();

  if (route.name === 'experiment') {
    const prize = findPrize(route.year, route.field);
    if (!prize) {
      history.replaceState(null, '', state.lastHomeHash);
      toast(t().notFoundExp);
      applyRoute();
      return;
    }
    if (state.page !== 'home') renderHome();
    openOverlay(prize, route.chapter);
    return;
  }

  closeOverlay();
  if (route.name === 'home') {
    const fresh = state.page !== 'home';
    state.field = route.field;
    state.year = route.year !== 'all' && YEARS.includes(route.year) ? route.year : 'all';
    state.lastHomeHash = homeHash(state.field, state.year);
    if (fresh) renderHome();
    else updateHome();
  } else if (route.name === 'about') {
    renderAbout();
  } else {
    renderNotFound();
  }
}

function setFilters(field: Field | 'all', year: number | 'all'): void {
  history.replaceState(null, '', homeHash(field, year));
  applyRoute();
}

function rerenderAll(): void {
  const y = window.scrollY;
  state.page = '';
  applyRoute();
  window.scrollTo(0, y);
}

/* ---------- 이벤트 ---------- */

function onClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (target.closest('[data-stop]')) return;
  const el = target.closest<HTMLElement>('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'lang') {
    state.lang = state.lang === 'ko' ? 'en' : 'ko';
    save('lang', state.lang);
    rerenderAll();
  } else if (action === 'theme') {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    save('theme', state.theme);
    rerenderAll();
  } else if (action === 'field') {
    setFilters(el.dataset.value as Field | 'all', state.year);
  } else if (action === 'yearchip') {
    setFilters(state.field, el.dataset.value === 'all' ? 'all' : Number(el.dataset.value));
  } else if (action === 'year') {
    const y = Number(el.dataset.year);
    setFilters(state.field, state.year === y ? 'all' : y);
  } else if (action === 'info') {
    const id = el.dataset.card!;
    if (state.openInfo.has(id)) state.openInfo.delete(id);
    else state.openInfo.add(id);
    updateHome();
    document.querySelector<HTMLElement>(`#${id} [data-action="info"]`)?.focus();
  } else if (action === 'open') {
    state.lastCardId = `card-${el.dataset.year}-${el.dataset.field}`;
    location.hash = `#/${el.dataset.year}/${el.dataset.field}`;
  } else if (action === 'close') {
    location.hash = state.lastHomeHash;
  } else if (action === 'copy') {
    // 클립보드를 쓸 수 없으면 주소를 그대로 보여 준다.
    const fallback = () => toast(location.href);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(location.href).then(() => toast(t().copied), fallback);
    } else {
      fallback();
    }
  }
}

document.addEventListener('click', onClick);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) {
    location.hash = state.lastHomeHash;
  } else if (e.key === 'Enter' && (e.target as HTMLElement).classList.contains('card')) {
    (e.target as HTMLElement).click();
  }
});
window.addEventListener('hashchange', applyRoute);

applyRoute();
