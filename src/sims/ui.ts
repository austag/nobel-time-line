// 공통 컨트롤 (SPEC.md 6.3): Slider, Toggle, HoldButton, StepButton, Segment, Readout

type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;

export function h(tag: string, attrs: Attrs | null = null, ...kids: (Node | string | null | undefined | (Node | string)[])[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

let uid = 0;

export interface SliderOpts {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  fmt?: (v: number) => string;
  onInput?: (v: number) => void;
}

export function slider(o: SliderOpts) {
  const id = `ctl-${++uid}`;
  const f = o.fmt ?? ((v: number) => String(v));
  const unit = o.unit ?? '';
  const val = h('span', { class: 'v' }, f(o.value) + unit);
  const input = h('input', {
    type: 'range',
    id,
    min: o.min,
    max: o.max,
    step: o.step,
    value: o.value,
    'aria-valuetext': f(o.value) + unit,
  }) as HTMLInputElement;
  const paint = () => {
    const x = Number(input.value);
    val.textContent = f(x) + unit;
    input.setAttribute('aria-valuetext', f(x) + unit);
  };
  input.addEventListener('input', () => {
    paint();
    o.onInput?.(Number(input.value));
  });
  const el = h('div', { class: 'ctl' }, h('label', { class: 'ctl-row', for: id }, h('span', null, o.label), val), input);
  return {
    el,
    set(x: number) {
      input.value = String(x);
      paint();
    },
  };
}

export function toggle(o: { label: string; on?: boolean; onText: string; offText: string; onChange?: (on: boolean) => void }) {
  const st = h('span', { class: 'st' });
  const b = h('button', { class: 'tgl', type: 'button', 'aria-pressed': String(!!o.on) }, h('span', { class: 'sw', 'aria-hidden': 'true' }), h('span', null, o.label), st);
  const paint = () => {
    st.textContent = b.getAttribute('aria-pressed') === 'true' ? o.onText : o.offText;
  };
  b.addEventListener('click', () => {
    const nv = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(nv));
    paint();
    o.onChange?.(nv);
  });
  paint();
  return {
    el: b,
    set(x: boolean) {
      b.setAttribute('aria-pressed', String(x));
      paint();
    },
  };
}

/** 누르고 있는 동안만 켜지는 버튼 (터치와 키보드 지원) */
export function hold(o: { label: string; onChange?: (on: boolean) => void }) {
  const b = h('button', { class: 'hold', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'lamp', 'aria-hidden': 'true' }), o.label);
  let on = false;
  const set = (x: boolean) => {
    if (x === on) return;
    on = x;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    o.onChange?.(on);
  };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      b.setPointerCapture((e as PointerEvent).pointerId);
    } catch {
      /* 무시 */
    }
    set(true);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) b.addEventListener(ev, () => set(false));
  b.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if ((k === ' ' || k === 'Enter') && !(e as KeyboardEvent).repeat) {
      e.preventDefault();
      set(true);
    }
  });
  b.addEventListener('keyup', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      set(false);
    }
  });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return { el: b, release: () => set(false) };
}

export function stepButton(o: { label: string; onClick: () => void }) {
  return { el: h('button', { class: 'stepb', type: 'button', onclick: o.onClick }, o.label) };
}

export function segment<T extends string>(o: { label: string; options: { v: T; label: string }[]; value: T; onChange?: (v: T) => void }) {
  let cur = o.value;
  const btns = o.options.map((opt) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(cur === opt.v) }, opt.label);
    b.addEventListener('click', () => {
      cur = opt.v;
      btns.forEach((x, i) => x.setAttribute('aria-pressed', String(cur === o.options[i].v)));
      o.onChange?.(cur);
    });
    return b;
  });
  return { el: h('div', { class: 'ctl', role: 'group', 'aria-label': o.label }, h('div', { class: 'ctl-row' }, h('span', null, o.label)), h('div', { class: 'seg' }, btns)) };
}

export function readout() {
  const el = h('div', { class: 'readout', 'aria-live': 'polite' });
  return {
    el,
    set(s: string) {
      if (el.textContent !== s) el.textContent = s;
    },
  };
}
