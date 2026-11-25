import { ArrowLeft, ArrowRight, Check, MapPin, Sparkles, Users } from 'lucide-react';
import { VISUAL_STYLES } from '../data/preset';
import { SceneSettings, VisualStyle } from '../types';

interface SceneScreenProps {
  scene: SceneSettings;
  onChangeScene: (next: SceneSettings) => void;
  onBack: () => void;
  onNext: () => void;
}

export function SceneScreen({
  scene,
  onChangeScene,
  onBack,
  onNext,
}: SceneScreenProps) {
  const updateField = <K extends keyof SceneSettings>(
    key: K,
    value: SceneSettings[K]
  ) => {
    onChangeScene({ ...scene, [key]: value });
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2 max-w-2xl">
        <p className="text-sm font-medium text-[#3B5B7D]">
          Step 2 of 5 · Scene & Visual Style
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E242B] text-balance">
          Set the place, characters, and animation style
        </h1>
        <p className="text-base text-[#5A6572] leading-relaxed">
          Characters, outfits, and room colors stay consistent across all 4 beats of your 30-second film.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Place, Characters, Situation */}
        <div className="lg:col-span-7 space-y-5 rounded-2xl border border-[#E5E3DC] bg-white p-5 sm:p-6">
          <label className="block space-y-2">
            <span className="inline-flex items-center gap-2 text-base font-semibold text-[#1E242B]">
              <MapPin className="w-4 h-4 text-[#3B5B7D]" />
              <span>Place</span>
            </span>
            <textarea
              rows={2}
              value={scene.place}
              onChange={(e) => updateField('place', e.target.value)}
              placeholder="Describe the room or setting..."
              className="w-full px-4 py-3 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-base text-[#1E242B] leading-relaxed focus:outline-none focus:border-[#3B5B7D] focus:bg-white transition-colors resize-y"
            />
          </label>

          <label className="block space-y-2">
            <span className="inline-flex items-center gap-2 text-base font-semibold text-[#1E242B]">
              <Users className="w-4 h-4 text-[#3B5B7D]" />
              <span>Characters & Outfits</span>
            </span>
            <textarea
              rows={3}
              value={scene.characters}
              onChange={(e) => updateField('characters', e.target.value)}
              placeholder="Describe Alex and Mia so their appearance stays consistent..."
              className="w-full px-4 py-3 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-base text-[#1E242B] leading-relaxed focus:outline-none focus:border-[#3B5B7D] focus:bg-white transition-colors resize-y"
            />
          </label>

          <label className="block space-y-2">
            <span className="inline-flex items-center gap-2 text-base font-semibold text-[#1E242B]">
              <Sparkles className="w-4 h-4 text-[#3B5B7D]" />
              <span>Situation</span>
            </span>
            <textarea
              rows={3}
              value={scene.situation}
              onChange={(e) => updateField('situation', e.target.value)}
              placeholder="What happened just before the scene starts?"
              className="w-full px-4 py-3 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-base text-[#1E242B] leading-relaxed focus:outline-none focus:border-[#3B5B7D] focus:bg-white transition-colors resize-y"
            />
          </label>
        </div>

        {/* Right column: Style Menu */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E5E3DC] bg-white p-5 sm:p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-[#1E242B]">
              Visual Style
            </h2>
            <p className="text-sm text-[#5A6572]">
              Pick the look for all 4 clips.
            </p>
          </div>

          <div className="space-y-3">
            {VISUAL_STYLES.map((styleOption) => {
              const selected = scene.style === styleOption.id;
              return (
                <button
                  key={styleOption.id}
                  type="button"
                  onClick={() => updateField('style', styleOption.id as VisualStyle)}
                  className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer min-h-[72px] ${
                    selected
                      ? 'border-[#3B5B7D] bg-[#F2F6FA]'
                      : 'border-[#E5E3DC] bg-[#FAF9F6] hover:bg-[#F3F2EE]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold text-[#1E242B]">
                      {styleOption.label}
                    </span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                        selected
                          ? 'bg-[#3B5B7D] border-[#3B5B7D] text-white'
                          : 'border-[#C8C4BA] bg-white'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                  <p className="text-sm text-[#5A6572] mt-1 leading-snug">
                    {styleOption.summary}
                  </p>
                </button>
              );
            })}
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
          <span>Back to Expressions</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center gap-2.5 min-h-[52px] px-8 py-3 rounded-xl bg-[#3B5B7D] text-white text-base font-semibold hover:bg-[#2F4A67] active:scale-[0.98] transition-all cursor-pointer"
        >
          <span>Next: 4-Beat Storyboard</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
