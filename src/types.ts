export type VisualStyle =
  | '2D animation'
  | 'Clay'
  | 'Watercolor'
  | 'Live-action style';

export type AppStep = 'input' | 'scene' | 'storyboard' | 'video' | 'final';

export interface ExpressionItem {
  id: string;
  expression: string;
  meaning: string;
  movie: string;
}

export interface SceneSettings {
  place: string;
  characters: string;
  situation: string;
  style: VisualStyle;
}

export interface DialogueLine {
  id: string;
  speaker: 'Alex' | 'Mia' | string;
  text: string;
  koreanTranslation?: string;
  emotion?: string;
  imageUrl?: string;
  customImageUrl?: string;
  focusX?: number;
  focusY?: number;
  speakerSide?: 'left' | 'right' | 'center';
}

export interface Beat {
  id: string;
  index: number; // 0..3
  label: 'Hook' | 'Problem' | 'Turn' | 'Close';
  startSec: number;
  endSec: number;
  sceneDescription: string;
  lines: DialogueLine[];
  defaultImageUrl?: string;
  customImageUrl?: string;
}

export interface SubtitleChunk {
  lineId: string;
  speaker: string;
  lines: string[]; // Max 2 lines, 1 thought per line
  koreanLine?: string;
  startSec: number;
  endSec: number;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  contextLine?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
