import { useCallback, useEffect, useMemo, useState } from 'react';
import { FinalScreen } from './components/FinalScreen';
import { InputScreen } from './components/InputScreen';
import { SceneScreen } from './components/SceneScreen';
import { StepHeader } from './components/StepHeader';
import { StoryboardScreen } from './components/StoryboardScreen';
import { VideoScreen } from './components/VideoScreen';
import {
  DEFAULT_BEATS,
  DEFAULT_EXPRESSIONS,
  DEFAULT_SCENE,
} from './data/preset';
import { AppStep, Beat, ExpressionItem, SceneSettings, VisualStyle } from './types';
import { cancelWebSpeech } from './utils/speechUtils';
import { getMatchedExpressionIds } from './utils/storyUtils';

const STORAGE_KEY = 'ttsg_studio_state_v2';

interface PersistedState {
  expressions: ExpressionItem[];
  scene: SceneSettings;
  beats: Beat[];
  scriptAuthor?: string;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (
        Array.isArray(parsed.expressions) &&
        parsed.expressions.length > 0 &&
        parsed.scene &&
        Array.isArray(parsed.beats) &&
        parsed.beats.length === 4
      ) {
        const cleanBeats = parsed.beats.map((b, idx) => {
          const defBeat = DEFAULT_BEATS[idx];
          return {
            ...b,
            defaultImageUrl: defBeat?.defaultImageUrl,
            customImageUrl: undefined,
            lines: (b.lines || []).map((line, lIdx) => {
              const defLine =
                defBeat?.lines.find((dl) => dl.id === line.id) ||
                defBeat?.lines[lIdx];
              return {
                ...line,
                koreanTranslation:
                  line.koreanTranslation ?? defLine?.koreanTranslation,
                imageUrl: line.imageUrl || defLine?.imageUrl,
                customImageUrl: undefined,
                focusX: line.focusX ?? defLine?.focusX,
                focusY: line.focusY ?? defLine?.focusY,
                speakerSide: line.speakerSide ?? defLine?.speakerSide,
              };
            }),
          };
        });
        return {
          expressions: parsed.expressions,
          scene: parsed.scene,
          beats: cleanBeats,
          scriptAuthor: parsed.scriptAuthor || 'Kim Seonghun',
        };
      }
    }
  } catch {
    // fallback to default preset
  }
  return {
    expressions: DEFAULT_EXPRESSIONS,
    scene: DEFAULT_SCENE,
    beats: DEFAULT_BEATS,
    scriptAuthor: 'Kim Seonghun',
  };
}

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);

  const [currentStep, setCurrentStep] = useState<AppStep>('input');
  const [expressions, setExpressions] = useState<ExpressionItem[]>(
    initial.expressions
  );
  const [scene, setScene] = useState<SceneSettings>(initial.scene);
  const [beats, setBeats] = useState<Beat[]>(initial.beats);
  const [scriptAuthor, setScriptAuthor] = useState<string>(
    initial.scriptAuthor || 'Kim Seonghun'
  );

  // Bonus toggles shared smoothly between Video Studio & Final Screen
  const [showKoreanSubtitles, setShowKoreanSubtitles] = useState(false);
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(true);

  const [preferredMaleVoiceURI, setPreferredMaleVoiceURI] = useState('');
  const [preferredFemaleVoiceURI, setPreferredFemaleVoiceURI] = useState('');

  useEffect(() => {
    try {
      const serializableBeats = beats.map((b) => ({
        ...b,
        customImageUrl: undefined,
        lines: b.lines.map((l) => ({ ...l, customImageUrl: undefined })),
      }));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          expressions,
          scene,
          beats: serializableBeats,
          scriptAuthor,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [expressions, scene, beats, scriptAuthor]);

  const handleSelectStep = (step: AppStep) => {
    cancelWebSpeech();
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeScene = useCallback((nextScene: SceneSettings) => {
    setScene((prev) => {
      const visualContextChanged =
        prev.place !== nextScene.place ||
        prev.characters !== nextScene.characters ||
        prev.style !== nextScene.style;
      if (visualContextChanged) {
        setBeats((currBeats) =>
          currBeats.map((b) => ({ ...b, customImageUrl: undefined }))
        );
      }
      return nextScene;
    });
  }, []);

  const handleChangeStyle = useCallback((nextStyle: VisualStyle) => {
    setScene((prev) => ({ ...prev, style: nextStyle }));
  }, []);

  const handleResetPreset = () => {
    cancelWebSpeech();
    setExpressions(DEFAULT_EXPRESSIONS);
    setScene(DEFAULT_SCENE);
    setBeats(DEFAULT_BEATS);
    setScriptAuthor('Kim Seonghun');
    localStorage.removeItem(STORAGE_KEY);
    setCurrentStep('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const matchedIds = useMemo(
    () => getMatchedExpressionIds(expressions, beats),
    [expressions, beats]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6F2] text-[#1E242B]">
      <StepHeader
        currentStep={currentStep}
        onSelectStep={handleSelectStep}
        onResetPreset={handleResetPreset}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 md:pb-14">
        {currentStep === 'input' && (
          <InputScreen
            expressions={expressions}
            matchedIds={matchedIds}
            onChangeExpressions={setExpressions}
            onNext={() => handleSelectStep('scene')}
          />
        )}

        {currentStep === 'scene' && (
          <SceneScreen
            scene={scene}
            onChangeScene={handleChangeScene}
            onBack={() => handleSelectStep('input')}
            onNext={() => handleSelectStep('storyboard')}
          />
        )}

        {currentStep === 'storyboard' && (
          <StoryboardScreen
            beats={beats}
            expressions={expressions}
            scene={scene}
            onChangeBeats={setBeats}
            onBack={() => handleSelectStep('scene')}
            onNext={() => handleSelectStep('video')}
          />
        )}

        {currentStep === 'video' && (
          <VideoScreen
            beats={beats}
            scene={scene}
            expressions={expressions}
            scriptAuthor={scriptAuthor}
            showKoreanSubtitles={showKoreanSubtitles}
            onToggleKoreanSubtitles={setShowKoreanSubtitles}
            backgroundMusicEnabled={backgroundMusicEnabled}
            onToggleBackgroundMusic={setBackgroundMusicEnabled}
            preferredMaleVoiceURI={preferredMaleVoiceURI}
            preferredFemaleVoiceURI={preferredFemaleVoiceURI}
            onChangeVoiceURIs={(maleURI, femaleURI) => {
              setPreferredMaleVoiceURI(maleURI);
              setPreferredFemaleVoiceURI(femaleURI);
            }}
            onChangeStyle={handleChangeStyle}
            onUpdateBeats={setBeats}
            onBack={() => handleSelectStep('storyboard')}
            onNext={() => handleSelectStep('final')}
          />
        )}

        {currentStep === 'final' && (
          <FinalScreen
            beats={beats}
            scene={scene}
            expressions={expressions}
            scriptAuthor={scriptAuthor}
            onChangeScriptAuthor={setScriptAuthor}
            showKoreanSubtitles={showKoreanSubtitles}
            onToggleKoreanSubtitles={setShowKoreanSubtitles}
            backgroundMusicEnabled={backgroundMusicEnabled}
            onToggleBackgroundMusic={setBackgroundMusicEnabled}
            preferredMaleVoiceURI={preferredMaleVoiceURI}
            preferredFemaleVoiceURI={preferredFemaleVoiceURI}
            onBack={() => handleSelectStep('video')}
            onStartOver={() => handleSelectStep('input')}
          />
        )}
      </main>
    </div>
  );
}
