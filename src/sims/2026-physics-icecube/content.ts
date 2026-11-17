import type { Lang, TabContent } from '../types';

// 탭별 해설. $...$ 와 $$...$$ 는 수식으로 그려진다.
export const CONTENT: Record<Lang, TabContent> = {
  ko: {
    observe: `<p>중성미자는 거의 아무것과도 반응하지 않아 직접 볼 수 없습니다. 아주 드물게 얼음 속 원자와 부딪히면 빠른 하전 입자(뮤온)가 생기고, 이 입자가 얼음 속을 지나며 푸른 빛을 냅니다.</p><p>새 이벤트를 발사하면 입자의 궤적 뒤로 V자 모양 빛의 파면이 퍼지고, 빛이 닿는 순서대로 센서가 켜집니다.</p><p class="q">입자가 얼음 속 빛보다 빠를 때만 빛이 나는 이유는 무엇일까?</p>`,
    interact: `컨트롤은 처음부터 모두 쓸 수 있어요. 미션은 선택 사항입니다.`,
    understand: `<h4>핵심 원리: 체렌코프 복사</h4><p>얼음 속에서 빛은 진공보다 느리게 $c/n$의 속도로 갑니다. 하전 입자가 이보다 빠르면 소닉붐처럼 빛의 충격파가 생깁니다. 빛이 나가는 각도는</p>$$\\cos\\theta_c = \\frac{1}{n\\beta}$$<p>이고, 빛이 생기는 조건은</p>$$\\beta > \\frac{1}{n}$$<p>입니다. 센서에 빛이 닿는 시간은 입자가 방출 지점까지 간 시간에 그 지점에서 센서까지의 거리를 $c/n$으로 나눈 값을 더한 것입니다. 이 시간 차이를 거꾸로 풀면 입자의 방향, 곧 중성미자가 온 하늘의 방향을 알 수 있습니다.</p><h4>왜 1세제곱킬로미터의 얼음인가</h4><p>우주에서 오는 고에너지 중성미자는 너무 드물게 반응합니다. IceCube는 남극 얼음 1 km³에 5천 개가 넘는 광센서를 깊이 묻어, 1년에 손꼽을 만한 사건을 붙잡습니다. 깊은 남극 얼음은 매우 투명하고 어두워서 거대한 검출기 재료가 됩니다.</p><h4>실생활 연결</h4><p>원자로 냉각수 속에서 보이는 푸른 빛도 체렌코프 복사입니다.</p><h4>실제와 다른 점</h4><p>실제 검출기는 3차원이고 얼음 속 빛의 산란과 흡수가 중요하지만, 여기서는 2D로 줄이고 산란을 무시했습니다. 빛의 양은 프랑크-탐 공식의 $\\sin^2\\theta_c$ 비례만 반영했습니다.</p>`,
  },
  en: {
    observe: `<p>Neutrinos barely interact, so we cannot see them directly. On rare occasions one hits an atom in the ice and creates a fast charged particle (a muon), which glows blue as it races through the ice.</p><p>Fire an event: a V-shaped light front trails behind the particle, and sensors light up in the order the light reaches them.</p><p class="q">Why does light appear only when the particle outruns light in ice?</p>`,
    interact: `All controls work from the start. Missions are optional.`,
    understand: `<h4>Key idea: Cherenkov radiation</h4><p>In ice, light travels slower than in vacuum, at $c/n$. A charged particle moving faster than that creates an optical shock wave, like a sonic boom. The light leaves at</p>$$\\cos\\theta_c = \\frac{1}{n\\beta}$$<p>and appears only when</p>$$\\beta > \\frac{1}{n}$$<p>Each sensor's arrival time is the particle's travel time to the emission point plus the distance from there to the sensor divided by $c/n$. Inverting those times gives the particle's direction, and so the patch of sky the neutrino came from.</p><h4>Why a cubic kilometre of ice</h4><p>Cosmic high-energy neutrinos interact very rarely. IceCube buries more than 5,000 light sensors in a cubic kilometre of Antarctic ice to catch a handful of events per year. Deep polar ice is dark and remarkably clear.</p><h4>Everyday link</h4><p>The blue glow in a reactor's cooling pool is Cherenkov light too.</p><h4>How this differs from reality</h4><p>The real detector is 3D and light scattering and absorption in ice matter a lot. Here it is 2D with no scattering. Light yield only follows the $\\sin^2\\theta_c$ dependence of the Frank–Tamm formula.</p>`,
  },
};
