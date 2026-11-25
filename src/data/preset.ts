import { Beat, ExpressionItem, SceneSettings, VisualStyle } from '../types';

export const VISUAL_STYLES: {
  id: VisualStyle;
  label: string;
  summary: string;
  paletteHint: string;
}[] = [
  {
    id: '2D animation',
    label: '2D Animation',
    summary: 'Warm cel-shaded indie film look with clean outlines and soft night lighting.',
    paletteHint: 'Warm amber lamp & calm midnight slate',
  },
  {
    id: 'Clay',
    label: 'Clay',
    summary: 'Tactile handcrafted claymation look with soft matte lighting and 12fps motion.',
    paletteHint: 'Soft sculpted matte tones & gentle stop-motion',
  },
  {
    id: 'Watercolor',
    label: 'Watercolor',
    summary: 'Gentle storybook paper texture with soft pigment edges and calm pastel washes.',
    paletteHint: 'Cold-press paper grain & warm ink wash',
  },
  {
    id: 'Live-action style',
    label: 'Live-Action Style',
    summary: 'Cinematic 35mm night film look with subtle anamorphic framing and depth.',
    paletteHint: 'Cinematic tungsten & cool night grading',
  },
];

export const DEFAULT_EXPRESSIONS: ExpressionItem[] = [
  {
    id: 'exp-1',
    expression: 'The thing is...',
    meaning: '사실은 말야',
    movie: 'Notting Hill',
  },
  {
    id: 'exp-2',
    expression: 'Millions down the drain',
    meaning: '거액의 돈이 헛수고로 날아가다',
    movie: 'Minari',
  },
  {
    id: 'exp-3',
    expression: "You've been through a lot",
    meaning: '고생했다',
    movie: 'Inside Out 2',
  },
  {
    id: 'exp-4',
    expression: 'That gives me the ick',
    meaning: '그건 정 떨어져',
    movie: 'Inside Out 2',
  },
  {
    id: 'exp-5',
    expression: 'bittersweet',
    meaning: '씁쓸하면서도 달콤한',
    movie: 'Notting Hill',
  },
];

export const DEFAULT_SCENE: SceneSettings = {
  place: 'A dim, messy startup office late at night with stacked coffee cups and laptops.',
  characters:
    'Alex (a tired young male co-founder in a casual hoodie) and Mia (a calm young female co-founder wearing glasses and a sweater).',
  situation:
    "Their big app launch failed and investors pulled out because of Alex's cringeworthy promotional dance video, yet they feel relieved to finally go home and sleep.",
  style: '2D animation',
};

export const PRESET_BEAT_IMAGES = [
  '/src/assets/images/beat_1_hook_1795578035220.jpg',
  '/src/assets/images/beat_2_problem_1795578034714.jpg',
  '/src/assets/images/beat_3_turn_1795578036458.jpg',
  '/src/assets/images/beat_4_close_1795578036460.jpg',
];

export const PRESET_SHOT_IMAGES = {
  b1_l1: '/src/assets/images/shot_1a_alex_shock_1795579004348.jpg',
  b1_l2: '/src/assets/images/shot_1b_mia_calm_1795579006332.jpg',
  b2_l1: '/src/assets/images/beat_2_problem_1795578034714.jpg',
  b2_l2: '/src/assets/images/shot_2b_mia_comfort_1795579006058.jpg',
  b3_l1: '/src/assets/images/beat_3_turn_1795578036458.jpg',
  b3_l2: '/src/assets/images/shot_3b_alex_ick_1795579007814.jpg',
  b4_l1: '/src/assets/images/shot_4a_mia_bittersweet_1795579007713.jpg',
  b4_l2: '/src/assets/images/beat_4_close_1795578036460.jpg',
};

export const DEFAULT_BEATS: Beat[] = [
  {
    id: 'beat-1',
    index: 0,
    label: 'Hook',
    startSec: 0,
    endSec: 7,
    sceneDescription:
      'Late at night in a dim office. Empty coffee cups are stacked on the desk as two co-founders, Alex and Mia, stare blankly at a frozen laptop screen.',
    defaultImageUrl: PRESET_BEAT_IMAGES[0],
    lines: [
      {
        id: 'b1-l1',
        speaker: 'Alex',
        text: 'Our big app launch just failed.',
        koreanTranslation: '우리 야심찬 앱 출시가 방금 망했어.',
        emotion: 'Tired, deflated, quiet sigh',
        imageUrl: PRESET_SHOT_IMAGES.b1_l1,
        focusX: 0.36,
        focusY: 0.40,
        speakerSide: 'left',
      },
      {
        id: 'b1-l2',
        speaker: 'Mia',
        text: 'Well, the thing is, nobody clicked.',
        koreanTranslation: '음, 사실은 말야, 아무도 클릭을 안 했어.',
        emotion: 'Calm, gentle, matter-of-fact',
        imageUrl: PRESET_SHOT_IMAGES.b1_l2,
        focusX: 0.67,
        focusY: 0.43,
        speakerSide: 'right',
      },
    ],
  },
  {
    id: 'beat-2',
    index: 1,
    label: 'Problem',
    startSec: 7,
    endSec: 15,
    sceneDescription:
      'Alex buries his face in his hands in frustration. A monitor in the background shows a sharp drop in funding graphs. Mia pats Alex on the shoulder to comfort him.',
    defaultImageUrl: PRESET_BEAT_IMAGES[1],
    lines: [
      {
        id: 'b2-l1',
        speaker: 'Alex',
        text: 'Millions down the drain!',
        koreanTranslation: '거액의 돈이 헛수고로 날아갔어!',
        emotion: 'Frustrated, exasperated groan',
        imageUrl: PRESET_SHOT_IMAGES.b2_l1,
        focusX: 0.46,
        focusY: 0.46,
        speakerSide: 'left',
      },
      {
        id: 'b2-l2',
        speaker: 'Mia',
        text: "You've been through a lot. But why did investors suddenly leave?",
        koreanTranslation: '그동안 고생 많았어. 근데 투자자들이 왜 갑자기 떠난 걸까?',
        emotion: 'Warm, empathetic, curious',
        imageUrl: PRESET_SHOT_IMAGES.b2_l2,
        focusX: 0.68,
        focusY: 0.43,
        speakerSide: 'right',
      },
    ],
  },
  {
    id: 'beat-3',
    index: 2,
    label: 'Turn',
    startSec: 15,
    endSec: 23,
    sceneDescription:
      'Mia turns her smartphone screen toward Alex. The video playing on the phone shows Alex doing an awkward, cringeworthy dance in front of serious investors to promote the app.',
    defaultImageUrl: PRESET_BEAT_IMAGES[2],
    lines: [
      {
        id: 'b3-l1',
        speaker: 'Mia',
        text: 'Because of your promotional dance video.',
        koreanTranslation: '네가 찍은 홍보 댄스 영상 때문이잖아.',
        emotion: 'Dry humor, deadpan, gentle',
        imageUrl: PRESET_SHOT_IMAGES.b3_l1,
        focusX: 0.31,
        focusY: 0.44,
        speakerSide: 'left',
      },
      {
        id: 'b3-l2',
        speaker: 'Alex',
        text: 'That gives me the ick right now.',
        koreanTranslation: '지금 보니까 진짜 정 떨어지네.',
        emotion: 'Embarrassed, cringing, sheepish',
        imageUrl: PRESET_SHOT_IMAGES.b3_l2,
        focusX: 0.68,
        focusY: 0.41,
        speakerSide: 'right',
      },
    ],
  },
  {
    id: 'beat-4',
    index: 3,
    label: 'Close',
    startSec: 23,
    endSec: 30,
    sceneDescription:
      'Alex and Mia look at each other and burst out laughing at the absurdity. They turn off the office lights, grab their bags, and walk out the door relieved.',
    defaultImageUrl: PRESET_BEAT_IMAGES[3],
    lines: [
      {
        id: 'b4-l1',
        speaker: 'Mia',
        text: 'Honestly, losing this company feels bittersweet.',
        koreanTranslation: '솔직히 회사를 잃은 게 씁쓸하면서도 달콤하네.',
        emotion: 'Warm, relieved, gentle smile',
        imageUrl: PRESET_SHOT_IMAGES.b4_l1,
        focusX: 0.66,
        focusY: 0.46,
        speakerSide: 'right',
      },
      {
        id: 'b4-l2',
        speaker: 'Alex',
        text: 'True. At least we can finally go sleep!',
        koreanTranslation: '맞아. 적어도 이제 드디어 자러 갈 순 있잖아!',
        emotion: 'Relieved, cheerful, light chuckle',
        imageUrl: PRESET_SHOT_IMAGES.b4_l2,
        focusX: 0.47,
        focusY: 0.44,
        speakerSide: 'center',
      },
    ],
  },
];
