// 장마다 보여 주는 "질문 → 연구 → 결과" 카드의 질문과 연구 문구.
// 결과는 사용자가 잰 값으로 채워진 연구 노트 문장을 그대로 쓴다.
import type { Lang } from './sims/types';

export interface QR {
  q: string;
  r: string;
}
type Entry = Record<Lang, QR>;

const QRR: Record<string, Record<string, Entry>> = {
  '2026-physics-icecube': {
    '1': {
      ko: { q: '얼음 속에서 빛보다 빨리 달리는 입자는 어떤 빛의 흔적을 남길까?', r: '입자가 지나간 자리마다 퍼지는 빛의 원을 겹쳐 보며, 원뿔 모양 빛의 충격파(체렌코프 빛)가 생기는 각도를 쟀다.' },
      en: { q: 'What trail of light does a particle leave when it outruns light in ice?', r: 'Overlapping the circles of light left along the path, I measured the angle of the cone-shaped light shock wave (Cherenkov light).' },
    },
    '2': {
      ko: { q: '정해진 수의 센서로 드문 우주 중성미자를 가장 많이 잡으려면 얼음에 어떻게 묻어야 할까?', r: '줄 수, 줄 길이, 묻는 깊이를 바꿔 가며 같은 시험 사건 100개를 흘려보내고 몇 개를 잡았는지 셌다.' },
      en: { q: 'With a fixed number of sensors, how should they be buried to catch the most rare cosmic neutrinos?', r: 'Changing the number of strings, their length and depth, I ran the same 100 test events and counted how many were caught.' },
    },
    '3': {
      ko: { q: '대기에서 쏟아지는 수많은 잡음 사건 속에서 우주에서 온 중성미자를 어떻게 골라낼까?', r: '사건의 방향과 에너지로 거르는 기준을 정하고, 남은 사건 가운데 신호와 잡음이 얼마씩인지 비교했다.' },
      en: { q: 'How do you pick out cosmic neutrinos from the flood of background events made in the atmosphere?', r: 'I set cuts on direction and energy and compared how much signal and background survived.' },
    },
    '4': {
      ko: { q: '센서에 빛이 언제, 얼마나 왔는지만으로 입자의 방향과 에너지를 알아낼 수 있을까?', r: '센서마다 빛이 도착한 시각과 양을 맞추며 입자의 길을 거꾸로 찾아(재구성) 방향과 에너지를 구했다.' },
      en: { q: 'Can a particle’s direction and energy be worked out just from when and how much light reached the sensors?', r: 'Fitting the arrival time and amount of light at each sensor, I worked back to the track (reconstruction) to get direction and energy.' },
    },
    '5': {
      ko: { q: '하늘에 흩어진 사건 속에서 "진짜 원천을 찾았다"고 말하려면 무엇이 필요할까?', r: '하늘 지도에서 사건이 몰린 곳을 찾고, 우연히 그만큼 몰릴 확률을 계산해 원천을 확인했다.' },
      en: { q: 'Among events scattered over the sky, what does it take to say “we found a real source”?', r: 'I looked for a pile-up of events on the sky map and calculated how likely such a pile-up is by chance.' },
    },
  },
  '2026-chemistry-soai': {
    '1': {
      ko: { q: '거울에 비친 모습과 겹치지 않는 두 분자는 어떻게 다르고, 섞여 있으면 어떻게 가려낼까?', r: '분자 모형을 돌려 거울상과 겹쳐 보고, 파스퇴르처럼 결정을 골라 두 접시에 나누며 한쪽으로 치우친 정도(ee)를 쟀다.' },
      en: { q: 'How do two molecules that cannot be laid on their mirror images differ, and how can a mixture be sorted?', r: 'I turned models against their mirror images and, like Pasteur, sorted crystals into two dishes while measuring the imbalance (ee).' },
    },
    '2': {
      ko: { q: '촉매의 리간드가 섞여 있으면, 생성물의 치우침도 리간드만큼일까?', r: '카강처럼 리간드를 짝지어 촉매를 만들고, 섞인 짝이 일하지 않을 때 생성물의 치우침이 리간드보다 커지는 것을 쟀다.' },
      en: { q: 'If a catalyst’s ligands are mixed, is the product just as imbalanced as the ligands?', r: 'Like Kagan, I paired ligands into catalysts and measured the product imbalance growing beyond the ligands’ when mixed pairs sit idle.' },
    },
    '3': {
      ko: { q: '생성물이 바로 자기 자신을 만드는 촉매라면, 작은 치우침은 어디까지 커질까?', r: '소아이처럼 생성물을 다음 플라스크에 부어 되먹임을 되풀이하고, 되먹임이 없는 플라스크와 나란히 비교했다.' },
      en: { q: 'If the product is the catalyst that makes more of itself, how far can a small imbalance grow?', r: 'Like Soai, I poured the product into the next flask again and again and compared it with a flask without feedback.' },
    },
    '4': {
      ko: { q: '처음이 정확히 반반이라면, 한쪽으로 기우는 일은 무엇이 시작할까?', r: '완벽한 반반에서 많은 플라스크를 동시에 돌려 무작위로 갈라지는 것을 보고, 석영 결정 같은 씨앗을 넣어 방향을 정해 봤다.' },
      en: { q: 'If the start is exactly 50:50, what starts the tilt to one side?', r: 'I ran many flasks from a perfect 50:50 and watched them split at random, then added seeds such as quartz crystals to set the direction.' },
    },
  },
  '2026-medicine-optogenetics': {
    '1': {
      ko: { q: '초록색 조류는 어떻게 그렇게 빨리 빛을 향해 움직일까?', r: '헤게만처럼 클라미도모나스에 빛을 비춰 반응 속도를 재고, 빛을 받는 부분과 이온이 지나는 문이 한 몸이라는 가설을 세웠다.' },
      en: { q: 'How does a green alga turn towards light so quickly?', r: 'Like Hegemann, I timed Chlamydomonas responding to light and proposed that the light sensor and the ion gate are one and the same.' },
    },
    '2': {
      ko: { q: '빛을 받는 단백질이 정말 그 자체로 이온이 지나는 문일까?', r: '나겔처럼 채널로돕신 유전자를 개구리 알에 넣고, 빛과 유전자 유무, 빛 색깔을 바꿔 가며 전류를 재서 대조군과 비교했다.' },
      en: { q: 'Is the light-catching protein really the ion gate itself?', r: 'Like Nagel, I put the channelrhodopsin gene into frog eggs and measured current with and without gene and light, and with different colours, against controls.' },
    },
    '3': {
      ko: { q: '같은 문을 포유류 신경세포에 달면 빛으로 신경 신호를 일으킬 수 있을까?', r: '다이서로스처럼 쥐 신경세포에 채널로돕신을 넣고, 빛을 깜빡이는 빠르기를 바꾸며 신경 신호가 따라오는지 쟀다.' },
      en: { q: 'Put the same gate in a mammalian neuron: can light fire nerve signals?', r: 'Like Deisseroth, I put channelrhodopsin into rat neurons and changed the flash rate to see whether spikes followed.' },
    },
    '4': {
      ko: { q: '살아 움직이는 동물의 뇌에서도 원하는 세포만 켜고 끌 수 있을까?', r: '고른 세포에만 스위치를 달고 광섬유로 빛을 쏘아 행동이 바뀌는지 보고, 끄는 스위치로 원인과 결과를 확인했다.' },
      en: { q: 'In the brain of a living animal, can chosen cells be switched on and off?', r: 'I put switches only into chosen cells, shone light through an optical fibre to see behaviour change, and used an off switch to confirm cause and effect.' },
    },
  },
  '2025-physics-tunneling': {
    '1': {
      ko: { q: '넘을 힘이 없는 벽을 입자가 지나갈 수 있을까? 벽이 두꺼워지면 얼마나 어려워질까?', r: '전자 파동이 사각형 벽을 만날 때 벽 두께와 높이, 입자 무게를 바꿔 가며 건너편에 닿을 확률을 계산했다.' },
      en: { q: 'Can a particle pass a wall it lacks the energy to climb? How much harder does a thicker wall make it?', r: 'For an electron wave meeting a square barrier, I changed thickness, height and particle mass and worked out the chance of getting through.' },
    },
    '2': {
      ko: { q: '수십억 개 쿠퍼쌍이 한 몸처럼 움직이는 회로도 통째로 터널링을 할까?', r: '클라크, 드보레, 마르티니스처럼 조셉슨 접합에 전류를 올리며 전압이 튀는 순간을 100번 재고, 냉동기 온도를 내리며 탈출 온도를 비교했다. 구리 차폐와 회로 먼저 재기로 의심을 지웠다.' },
      en: { q: 'Can a circuit whose billions of Cooper pairs move as one tunnel as a whole?', r: 'Like Clarke, Devoret and Martinis, I timed the voltage jump of a Josephson junction 100 times while cooling the fridge, and removed doubts with copper shielding and by measuring the circuit hot first.' },
    },
    '3': {
      ko: { q: '이 회로의 에너지는 아무 값이나 가질 수 있을까?', r: '접합에 마이크로파를 쪼이며 주파수를 바꿔 탈출이 크게 늘어나는 공명을 찾고, 전류에 따라 공명이 움직이는 것을 쟀다.' },
      en: { q: 'Can this circuit take any energy at all?', r: 'Shining microwaves on the junction, I swept the frequency to find resonances where escape jumps, and tracked how they move with current.' },
    },
    '4': {
      ko: { q: '가장 낮은 두 에너지 준위를 0과 1로 쓰면 계산에 쓸 양자 비트가 될까?', r: '마이크로파를 쏘는 시간을 바꾸며 100번씩 읽어, 회로가 0과 1 사이를 오가는 라비 진동을 쟀다.' },
      en: { q: 'Can the two lowest levels serve as 0 and 1 of a quantum bit?', r: 'Changing the pulse length and reading out 100 times each, I measured Rabi oscillations between 0 and 1.' },
    },
  },
  '2025-chemistry-mof': {
    '1': {
      ko: { q: '분자가 결합하는 방향을 미리 정해 두면, 원하는 모양의 빈 공간이 있는 결정을 조립할 수 있을까?', r: '롭슨처럼 네 방향으로 결합하는 구리(I) 이온과 팔이 네 개인 분자를 섞고, X선으로 결정 구조를 확인한 뒤 빈 공간의 이온을 바꾸고 비워 봤다.' },
      en: { q: 'If the bonding directions are set in advance, can a crystal with designed empty space be assembled?', r: 'Like Robson, I mixed copper(I) ions that bond in four directions with four-armed molecules, checked the structure by X-rays, then swapped the ions in the cavities and tried emptying them.' },
    },
    '2': {
      ko: { q: '빈 공간을 정말로 비워도 버티는 틀을 만들 수 있을까? 그렇다면 그 안은 얼마나 넓을까?', r: '마디를 금속 이온 하나에서 단단한 아연 덩어리로 바꾸고, 가열하며 진공으로 비운 뒤 질소를 조금씩 넣어 흡착량을 쟀다.' },
      en: { q: 'Can a framework survive being truly emptied? If so, how much surface is inside?', r: 'I swapped the single-ion node for a rigid zinc cluster, emptied the crystal by heating under vacuum, and measured nitrogen uptake dose by dose.' },
    },
    '3': {
      ko: { q: '구멍의 크기와 성질을 만들기 전에 미리 정할 수 있을까?', r: '같은 뼈대에 길이와 곁가지가 다른 막대를 끼운 변형을 만들어 구멍 크기와 메테인 저장량을 재고, 모양이 바뀌는 유연한 틀에도 기체를 넣었다 뺐다.' },
      en: { q: 'Can the size and character of the pores be chosen before the material is made?', r: 'On the same skeleton I swapped in struts of different lengths and side groups, measured pore size and methane storage, and loaded and unloaded a flexible framework.' },
    },
    '4': {
      ko: { q: '이 구멍으로 사막의 메마른 공기에서 마실 물을 얻을 수 있을까?', r: '물을 붙잡는 습도(계단 위치)가 다른 MOF로 밤에는 수증기를 붙잡고 낮에는 데워 내보내는 하루 순환을 돌려 수확량을 쟀다.' },
      en: { q: 'Can these pores pull drinking water out of dry desert air?', r: 'With MOFs whose water step sits at different humidities, I ran a day cycle of capturing vapour at night and releasing it by heating in the day, and measured the yield.' },
    },
  },
};

export function qrrFor(sim: string, chapter: string | undefined, lang: Lang): QR | null {
  if (!chapter) return null;
  return QRR[sim]?.[chapter]?.[lang] ?? null;
}
