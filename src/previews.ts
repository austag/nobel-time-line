// 카드 미리보기 그림. 파란 잉크(currentColor)로 그리고 빨간 볼펜(.r-f, .r-s)으로 강조한다.
// 체험 모듈이 완성되면 캔버스 미리보기로 바뀔 자리다.
const open = '<svg viewBox="0 0 320 160" aria-hidden="true">';

const ICE = `${open}<defs><pattern id="ice-dots" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></pattern></defs><rect width="320" height="160" fill="url(#ice-dots)"/><path class="r-s" d="M100 4 252 156" stroke-width="2.5" stroke-dasharray="5 6" stroke-linecap="round"/><g class="r-f"><circle cx="112" cy="16" r="9"/><circle cx="144" cy="48" r="8"/><circle cx="176" cy="80" r="7"/><circle cx="208" cy="112" r="6"/><circle cx="240" cy="144" r="5"/></g></svg>`;

const SOAI = `${open}<path d="M144 14h32v42l38 66a10 10 0 0 1-9 15h-90a10 10 0 0 1-9-15l38-66z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M127 96c12-5 22 5 34 0s22 5 33 0" fill="none" stroke="currentColor" stroke-width="2"/><g fill="currentColor"><circle cx="140" cy="112" r="5"/><circle cx="160" cy="124" r="5"/><circle cx="178" cy="110" r="5"/><circle cx="194" cy="128" r="5"/><circle cx="130" cy="128" r="5"/><circle cx="164" cy="108" r="5"/></g><g class="w-f r-s" stroke-width="2.5"><circle cx="180" cy="126" r="5"/><circle cx="147" cy="124" r="5"/></g></svg>`;

const OPTO = `${open}<path d="M150 0 116 66h68z" fill="currentColor" opacity=".16"/><path d="M150 0v30" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M132 84C108 70 96 52 70 46M130 92C104 92 88 104 60 102M134 100C116 116 104 130 84 140M170 92h20"/></g><circle class="w-f" cx="150" cy="90" r="20" stroke="currentColor" stroke-width="3"/><circle cx="150" cy="90" r="7" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" opacity=".4"><path d="M196 92h12M222 92h12M248 92h12M274 92h12"/></g><circle class="r-f" cx="241" cy="92" r="7"/></svg>`;

const TUNNEL = `${open}<path d="M10 44C50 44 62 112 104 112S146 58 176 58 224 134 256 134 292 104 312 104" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path class="r-s" d="M118 96h74" stroke-width="3" stroke-dasharray="4 7" stroke-linecap="round"/><circle cx="104" cy="100" r="10" fill="currentColor"/><circle class="r-f" cx="202" cy="96" r="8"/></svg>`;

const MOF = `${open}<g stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M70 44h180M70 116h180M70 44v72M130 44v72M190 44v72M250 44v72"/></g><g class="w-f" stroke="currentColor" stroke-width="3"><rect x="61" y="35" width="18" height="18"/><rect x="121" y="35" width="18" height="18"/><rect x="181" y="35" width="18" height="18"/><rect x="241" y="35" width="18" height="18"/><rect x="61" y="107" width="18" height="18"/><rect x="121" y="107" width="18" height="18"/><rect x="181" y="107" width="18" height="18"/><rect x="241" y="107" width="18" height="18"/></g><g class="r-f"><circle cx="150" cy="80" r="7"/><circle cx="170" cy="80" r="7"/><circle cx="160" cy="80" r="7"/></g><g fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="22" cy="70" r="6"/><circle cx="33" cy="70" r="6"/><circle cx="34" cy="104" r="6"/><circle cx="45" cy="104" r="6"/></g></svg>`;

const TREG = `${open}<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="60" cy="40" r="14"/><circle cx="110" cy="40" r="14"/><circle cx="160" cy="40" r="14"/><circle cx="210" cy="40" r="14"/><circle cx="260" cy="40" r="14"/><circle cx="85" cy="82" r="14"/><circle cx="135" cy="82" r="14"/><circle cx="235" cy="82" r="14"/><circle cx="60" cy="124" r="14"/><circle cx="110" cy="124" r="14"/><circle cx="160" cy="124" r="14"/><circle cx="210" cy="124" r="14"/><circle cx="260" cy="124" r="14"/></g><circle cx="185" cy="82" r="11" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/><g class="r-s" stroke-width="7" stroke-linecap="round"><path d="M146 60l10 6M160 100l10-5M118 98l8 6"/></g><circle cx="208" cy="64" r="9" fill="currentColor"/><circle cx="104" cy="70" r="9" fill="currentColor"/><circle cx="186" cy="114" r="10" fill="currentColor"/><path class="w-f" d="M186 109l5 5-5 5-5-5z"/></svg>`;

const PREVIEWS: Record<string, string> = {
  '2026-physics-icecube': ICE,
  '2026-chemistry-soai': SOAI,
  '2026-medicine-optogenetics': OPTO,
  '2025-physics-tunneling': TUNNEL,
  '2025-chemistry-mof': MOF,
  '2025-medicine-treg': TREG,
};

export function previewSvg(sim: string): string {
  return PREVIEWS[sim] ?? `${open}</svg>`;
}
