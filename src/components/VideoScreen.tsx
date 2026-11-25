import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Palette,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import { VISUAL_STYLES } from '../data/preset';
import { Beat, ExpressionItem, SceneSettings, VisualStyle } from '../types';
import {
  cancelWebSpeech,
  speakLineWithWebSpeech,
  VoicePair,
  warmUpWebSpeech,
} from '../utils/speechUtils';
import { isUsingDefaultBeatVisuals } from '../utils/storyUtils';
import { FilmPlayer } from './FilmPlayer';

interface VideoScreenProps {
  beats: Beat[];
  scene: SceneSettings;
  expressions: ExpressionItem[];
  scriptAuthor: string;
  showKoreanSubtitles: boolean;
  onToggleKoreanSubtitles: (next: boolean) => void;
  backgroundMusicEnabled: boolean;
  onToggleBackgroundMusic: (next: boolean) => void;
  preferredMaleVoiceURI: string;
  preferredFemaleVoiceURI: string;
  onChangeVoiceURIs: (maleURI: string, femaleURI: string) => void;
  onChangeStyle: (nextStyle: VisualStyle) => void;
  onUpdateBeats: (next: Beat[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export function VideoScreen({
  beats,
  scene,
  expressions,
  scriptAuthor,
  showKoreanSubtitles,
  onToggleKoreanSubtitles,
  backgroundMusicEnabled,
  onToggleBackgroundMusic,
  preferredMaleVoiceURI,
  preferredFemaleVoiceURI,
  onChangeVoiceURIs,
  onChangeStyle,
  onUpdateBeats,
  onBack,
  onNext,
}: VideoScreenProps) {
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingStyle, setPendingStyle] = useState<VisualStyle>(scene.style);
  const [voicePair, setVoicePair] = useState<VoicePair>({
    maleVoice: null,
    femaleVoice: null,
    englishVoices: [],
  });

  useEffect(() => {
    setPendingStyle(scene.style);
  }, [scene.style]);

  const beatsNeedingCustomVisuals = beats.filter(
    (b) => !isUsingDefaultBeatVisuals(b, scene) && !b.customImageUrl
  );

  const generateSilentCustomVisuals = async (targetStyle: VisualStyle, forceRegenerate = false) => {
    const targets = forceRegenerate
      ? beats.filter((b) => !isUsingDefaultBeatVisuals(b, scene))
      : beats.filter((b) => !isUsingDefaultBeatVisuals(b, scene) && !b.customImageUrl);

    if (targets.length === 0) return;

    setErrorMsg(null);
    setIsGeneratingVisuals(true);
    try {
      const updatedBeats = [...beats];
      for (let i = 0; i < targets.length; i++) {
        const beat = targets[i];
        setProgressText(
          `Rendering silent visual clip for Beat ${beat.index + 1} in ${targetStyle} style (${i + 1}/${targets.length})...`
        );
        const res = await fetch('/api/scene-visual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneDescription: beat.sceneDescription,
            place: scene.place,
            characters: scene.characters,
            style: targetStyle,
            beatLabel: `${beat.label} (${beat.startSec}-${beat.endSec}s)`,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not generate custom scene illustration.');
        }
        const svgBlob = new Blob([data.svg], { type: 'image/svg+xml' });
        const blobUrl = URL.createObjectURL(svgBlob);
        updatedBeats[beat.index] = {
          ...updatedBeats[beat.index],
          customImageUrl: blobUrl,
        };
      }
      onUpdateBeats(updatedBeats);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not render custom beat visuals.'
      );
    } finally {
      setIsGeneratingVisuals(false);
      setProgressText('');
    }
  };

  useEffect(() => {
    if (beatsNeedingCustomVisuals.length > 0 && !isGeneratingVisuals && !errorMsg) {
      generateSilentCustomVisuals(scene.style);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchStyleAndRegenerate = async (nextStyle: VisualStyle) => {
    setPendingStyle(nextStyle);
    onChangeStyle(nextStyle);
    // If the story uses custom generated scenes, regenerate them in the new style;
    // preset scenes automatically re-render all 8 shots + thumbnail in the new style on Canvas!
    await generateSilentCustomVisuals(nextStyle, true);
  };

  const handleTestVoice = (speaker: 'Alex' | 'Mia', sampleText: string) => {
    cancelWebSpeech();
    warmUpWebSpeech(voicePair);
    window.setTimeout(() => {
      speakLineWithWebSpeech({
        text: sampleText,
        speaker,
        voicePair,
      });
    }, 80);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-sm font-medium text-[#3B5B7D]">
            Step 4 of 5 · Video Studio
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E242B] text-balance">
            Watch your 8-shot film with voice & subtitles
          </h1>
          <p className="text-base text-[#5A6572] leading-relaxed">
            Currently styled in <strong className="text-[#1E242B]">{scene.style}</strong>. Switch styles anytime or toggle Korean translations and ambient lo-fi music below.
          </p>
        </div>
      </div>

      {/* Bonus #1: Change Style ("스타일 바꾸기") Quick Switcher */}
      <div className="rounded-2xl border border-[#E5E3DC] bg-white p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-[#3B5B7D] shrink-0" />
          <div>
            <div className="text-sm font-semibold text-[#1E242B]">
              스타일 바꾸기 · Switch Style & Regenerate Visuals
            </div>
            <div className="text-xs text-[#5A6572]">
              Re-render the same 30-second script and cover thumbnail in another art style with one click.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {VISUAL_STYLES.map((opt) => {
            const active = pendingStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isGeneratingVisuals}
                onClick={() => handleSwitchStyleAndRegenerate(opt.id)}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-[#3B5B7D] bg-[#3B5B7D] text-white'
                    : 'border-[#D8D5CC] bg-[#FAF9F6] text-[#1E242B] hover:bg-[#F0EFEA]'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingVisuals && active ? 'animate-spin' : ''}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isGeneratingVisuals && (
        <div className="rounded-2xl border border-[#C6D4E3] bg-[#F2F6FA] px-5 py-4 flex items-center gap-3 text-[#1E242B]">
          <Loader2 className="w-5 h-5 animate-spin text-[#3B5B7D] shrink-0" />
          <div className="text-sm sm:text-base font-medium">
            {progressText || 'Preparing silent animated beat scenes...'}
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-[#F3B0A8] bg-[#FEF3F2] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#B42318]"
        >
          <span className="font-medium">{errorMsg}</span>
          <button
            type="button"
            onClick={() => generateSilentCustomVisuals(scene.style, true)}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-white border border-[#F3B0A8] font-semibold hover:bg-[#FFF5F5] cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <FilmPlayer
            beats={beats}
            style={scene.style}
            expressions={expressions}
            scriptAuthor={scriptAuthor}
            showKoreanSubtitles={showKoreanSubtitles}
            onToggleKoreanSubtitles={onToggleKoreanSubtitles}
            backgroundMusicEnabled={backgroundMusicEnabled}
            onToggleBackgroundMusic={onToggleBackgroundMusic}
            preferredMaleVoiceURI={preferredMaleVoiceURI}
            preferredFemaleVoiceURI={preferredFemaleVoiceURI}
            onVoicesLoaded={setVoicePair}
          />
        </div>

        {/* Right Companion Card: Voices & 4 Beat Clips */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-[#E5E3DC] bg-white p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-[#1E242B]">
                English Voiceover Cast
              </h2>
              <p className="text-sm text-[#5A6572]">
                Distinct male & female voices with 300ms warm-up lead.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[#ECEAE4] bg-[#FAF9F6] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#1E242B]">
                    Alex (Male)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleTestVoice('Alex', 'Our big app launch just failed.')
                    }
                    className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg border border-[#D8D5CC] bg-white text-xs font-medium text-[#1E242B] hover:bg-[#F0EFEA] cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#3B5B7D]" />
                    <span>Test</span>
                  </button>
                </div>
                {voicePair.englishVoices.length > 0 ? (
                  <select
                    aria-label="Select voice for Alex"
                    value={voicePair.maleVoice?.voiceURI || ''}
                    onChange={(e) =>
                      onChangeVoiceURIs(
                        e.target.value,
                        voicePair.femaleVoice?.voiceURI || preferredFemaleVoiceURI
                      )
                    }
                    className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D8D5CC] bg-white text-xs text-[#1E242B] focus:outline-none focus:border-[#3B5B7D]"
                  >
                    {voicePair.englishVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-[#5A6572]">Default system male voice</p>
                )}
              </div>

              <div className="rounded-xl border border-[#ECEAE4] bg-[#FAF9F6] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#1E242B]">
                    Mia (Female)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleTestVoice('Mia', 'Well, the thing is, nobody clicked.')
                    }
                    className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg border border-[#D8D5CC] bg-white text-xs font-medium text-[#1E242B] hover:bg-[#F0EFEA] cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#3B5B7D]" />
                    <span>Test</span>
                  </button>
                </div>
                {voicePair.englishVoices.length > 0 ? (
                  <select
                    aria-label="Select voice for Mia"
                    value={voicePair.femaleVoice?.voiceURI || ''}
                    onChange={(e) =>
                      onChangeVoiceURIs(
                        voicePair.maleVoice?.voiceURI || preferredMaleVoiceURI,
                        e.target.value
                      )
                    }
                    className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D8D5CC] bg-white text-xs text-[#1E242B] focus:outline-none focus:border-[#3B5B7D]"
                  >
                    {voicePair.englishVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-[#5A6572]">Default system female voice</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E3DC] bg-white p-5 space-y-3">
            <h2 className="font-display text-lg font-semibold text-[#1E242B]">
              4 Beats · 8 Dialogue Cuts
            </h2>

            <div className="space-y-2.5">
              {beats.map((beat) => {
                const visualReady =
                  isUsingDefaultBeatVisuals(beat, scene) || Boolean(beat.customImageUrl);
                return (
                  <div
                    key={beat.id}
                    className="rounded-xl border border-[#ECEAE4] bg-[#FAF9F6] p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#1E242B]">
                        {beat.index + 1}. {beat.label} ({beat.startSec}–{beat.endSec}s)
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          visualReady ? 'text-[#2D6A4F]' : 'text-[#5A6572]'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{visualReady ? '2 shots ready' : 'Rendering'}</span>
                      </span>
                    </div>
                    <p className="text-xs text-[#5A6572] line-clamp-2 leading-relaxed">
                      {beat.lines.map((l) => `${l.speaker}: "${l.text}"`).join(' ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 min-h-[52px] px-6 py-3 rounded-xl border border-[#D8D5CC] bg-white text-base font-medium text-[#1E242B] hover:bg-[#F0EFEA] active:scale-[0.98] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#5A6572]" />
          <span>Back to Storyboard</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center gap-2.5 min-h-[52px] px-8 py-3 rounded-xl bg-[#3B5B7D] text-white text-base font-semibold hover:bg-[#2F4A67] active:scale-[0.98] transition-all cursor-pointer"
        >
          <span>Next: Final Screen & Quiz</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
