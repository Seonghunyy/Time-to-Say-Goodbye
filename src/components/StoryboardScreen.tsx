import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Film,
  Loader2,
  RefreshCw,
  Wand2,
  X,
} from 'lucide-react';
import { Beat, ExpressionItem, SceneSettings } from '../types';
import {
  buildSubtitleChunksForLine,
  getMatchedExpressionIds,
  getStoryboardWordStats,
  highlightExpressionsInText,
} from '../utils/storyUtils';

interface StoryboardScreenProps {
  beats: Beat[];
  expressions: ExpressionItem[];
  scene: SceneSettings;
  onChangeBeats: (next: Beat[]) => void;
  onBack: () => void;
  onNext: () => void;
}

interface ActivePopover {
  key: string;
  item: ExpressionItem;
}

export function StoryboardScreen({
  beats,
  expressions,
  scene,
  onChangeBeats,
  onBack,
  onNext,
}: StoryboardScreenProps) {
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const [rewritingAll, setRewritingAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<ActivePopover | null>(null);
  const popoverRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        popoverRootRef.current &&
        !popoverRootRef.current.contains(e.target as Node)
      ) {
        setActivePopover(null);
      }
    };
    if (activePopover) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [activePopover]);

  const wordStats = getStoryboardWordStats(beats);
  const matchedIds = getMatchedExpressionIds(expressions, beats);
  const nonEmptyExpressions = expressions.filter((e) => e.expression.trim().length > 0);
  const missingExpressions = nonEmptyExpressions.filter((e) => !matchedIds.has(e.id));

  const updateBeatScene = (beatIdx: number, sceneDescription: string) => {
    onChangeBeats(
      beats.map((b, idx) =>
        idx === beatIdx
          ? { ...b, sceneDescription, customImageUrl: undefined }
          : b
      )
    );
  };

  const updateBeatLine = (
    beatIdx: number,
    lineId: string,
    field: 'speaker' | 'text' | 'koreanTranslation',
    value: string
  ) => {
    onChangeBeats(
      beats.map((b, idx) =>
        idx === beatIdx
          ? {
              ...b,
              lines: b.lines.map((l) =>
                l.id === lineId ? { ...l, [field]: value } : l
              ),
            }
          : b
      )
    );
  };

  const handleRegenerateSingleBeat = async (beatIdx: number) => {
    setErrorMsg(null);
    setRegeneratingIdx(beatIdx);
    try {
      const currentBeatText = beats[beatIdx].lines.map((l) => l.text).join(' ');
      const targetExpressions = nonEmptyExpressions
        .filter((e) =>
          currentBeatText
            .toLowerCase()
            .includes(e.expression.replace(/\.{2,}$/, '').trim().toLowerCase())
        )
        .map((e) => e.expression);

      const res = await fetch('/api/storyboard/regenerate-beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatIndex: beatIdx,
          currentBeats: beats,
          expressions: nonEmptyExpressions,
          scene,
          targetExpressions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not regenerate beat.');
      }

      const regenerated = data.beat;
      onChangeBeats(
        beats.map((b, idx) =>
          idx === beatIdx
            ? {
                ...b,
                sceneDescription: regenerated.sceneDescription,
                customImageUrl: undefined,
                lines: regenerated.lines.map(
                  (
                    l: {
                      speaker: string;
                      text: string;
                      koreanTranslation?: string;
                      emotion?: string;
                    },
                    lIdx: number
                  ) => ({
                    ...b.lines[lIdx],
                    id: `b${idx + 1}-l${lIdx + 1}-${Date.now()}`,
                    speaker: l.speaker,
                    text: l.text,
                    koreanTranslation: l.koreanTranslation,
                    emotion: l.emotion,
                  })
                ),
              }
            : b
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to regenerate beat.');
    } finally {
      setRegeneratingIdx(null);
    }
  };

  const handleRewriteAllBeats = async () => {
    setErrorMsg(null);
    setRewritingAll(true);
    try {
      const res = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expressions: nonEmptyExpressions,
          scene,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not rewrite storyboard.');
      }

      const labels: ('Hook' | 'Problem' | 'Turn' | 'Close')[] = [
        'Hook',
        'Problem',
        'Turn',
        'Close',
      ];
      const timings = [
        [0, 7],
        [7, 15],
        [15, 23],
        [23, 30],
      ];

      const nextBeats: Beat[] = data.beats.map(
        (
          rawBeat: {
            sceneDescription: string;
            lines: {
              speaker: string;
              text: string;
              koreanTranslation?: string;
              emotion?: string;
            }[];
          },
          idx: number
        ) => ({
          id: `beat-${idx + 1}`,
          index: idx,
          label: labels[idx],
          startSec: timings[idx][0],
          endSec: timings[idx][1],
          sceneDescription: rawBeat.sceneDescription,
          defaultImageUrl: beats[idx]?.defaultImageUrl,
          customImageUrl: undefined,
          lines: rawBeat.lines.map((l, lIdx) => ({
            ...beats[idx]?.lines[lIdx],
            id: `b${idx + 1}-l${lIdx + 1}-${Date.now()}`,
            speaker: l.speaker,
            text: l.text,
            koreanTranslation: l.koreanTranslation,
            emotion: l.emotion,
          })),
        })
      );
      onChangeBeats(nextBeats);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate storyboard.');
    } finally {
      setRewritingAll(false);
    }
  };

  const renderHighlightedText = (text: string, keyPrefix: string) => {
    const segments = highlightExpressionsInText(text, nonEmptyExpressions);
    return segments.map((seg, sIdx) => {
      if (!seg.matchedExpression) {
        return <span key={`${keyPrefix}-${sIdx}`}>{seg.text}</span>;
      }
      const popKey = `${keyPrefix}-${sIdx}`;
      const isOpen = activePopover?.key === popKey;
      const exp = seg.matchedExpression;

      return (
        <span key={popKey} className="relative inline-block">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActivePopover(isOpen ? null : { key: popKey, item: exp });
            }}
            className="inline font-bold text-[#9A4E00] bg-[#FEF0C7] hover:bg-[#FDE68A] px-1.5 py-0.5 rounded underline decoration-[#D97706] decoration-2 underline-offset-2 cursor-pointer transition-colors"
          >
            {seg.text}
          </button>

          {isOpen && (
            <div
              role="dialog"
              aria-label={`Meaning for ${exp.expression}`}
              className="absolute left-0 bottom-full mb-2 z-30 w-64 rounded-xl border border-[#D8D5CC] bg-white p-3.5 shadow-xl text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-sm text-[#1E242B]">
                  {exp.expression}
                </div>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  aria-label="Close tooltip"
                  className="p-0.5 rounded text-[#5A6572] hover:text-[#1E242B] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-medium text-[#3B5B7D] mt-1">
                {exp.meaning || 'No meaning provided'}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#5A6572]">
                <Film className="w-3.5 h-3.5" />
                <span>Movie: {exp.movie || 'Movie'}</span>
              </div>
            </div>
          )}
        </span>
      );
    });
  };

  return (
    <section className="space-y-6" ref={popoverRootRef}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-sm font-medium text-[#3B5B7D]">
            Step 3 of 5 · 30-Second Storyboard Table
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E242B] text-balance">
            Review or edit your 4-beat storyboard
          </h1>
          <p className="text-base text-[#5A6572] leading-relaxed">
            Click any highlighted expression to view its Korean meaning and source movie. Edit any line or regenerate a single beat anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0">
          <div className="text-sm text-[#5A6572] tabular-nums">
            <span className="font-semibold text-[#1E242B]">
              {wordStats.totalWithSpeakers} script words
            </span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>{wordStats.dialogueWords} spoken (target 60–70)</span>
          </div>

          <button
            type="button"
            onClick={handleRewriteAllBeats}
            disabled={rewritingAll || regeneratingIdx !== null}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-[#D8D5CC] bg-white text-sm font-semibold text-[#1E242B] hover:bg-[#F0EFEA] disabled:opacity-60 transition-all cursor-pointer whitespace-nowrap"
          >
            {rewritingAll ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#3B5B7D]" />
            ) : (
              <Wand2 className="w-4 h-4 text-[#3B5B7D]" />
            )}
            <span>{rewritingAll ? 'Writing Script...' : 'Write New Script from Inputs'}</span>
          </button>
        </div>
      </div>

      {/* Expression Coverage Bar */}
      <div className="rounded-2xl border border-[#E5E3DC] bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#1E242B]">
            Target Expressions ({matchedIds.size}/{nonEmptyExpressions.length} included)
          </span>
          {missingExpressions.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#9A6700]">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Missing: {missingExpressions.map((e) => `"${e.expression}"`).join(', ')}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2D6A4F]">
              <CheckCircle2 className="w-4 h-4" />
              <span>All expressions appear in the script (click highlighted words below)</span>
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border border-[#F3B0A8] bg-[#FEF3F2] px-5 py-4 text-sm font-medium text-[#B42318]"
        >
          {errorMsg}
        </div>
      )}

      {/* Structured 4-Beat Storyboard Table */}
      <div className="rounded-2xl border border-[#E5E3DC] bg-white overflow-visible">
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3.5 bg-[#FAF9F6] border-b border-[#E5E3DC] text-xs font-semibold uppercase tracking-wide text-[#5A6572] rounded-t-2xl">
          <div className="col-span-2">Time / Beat</div>
          <div className="col-span-3">Scene Description</div>
          <div className="col-span-4">English Lines (Editable)</div>
          <div className="col-span-3">Subtitles Preview (Click Highlights)</div>
        </div>

        <div className="divide-y divide-[#ECEAE4]">
          {beats.map((beat, beatIdx) => {
            const isRegenerating = regeneratingIdx === beatIdx;
            return (
              <div
                key={beat.id}
                className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
              >
                {/* Col 1: Time / Beat & Regenerate */}
                <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-mono font-semibold text-[#3B5B7D] tabular-nums">
                      {beat.startSec}–{beat.endSec}s
                    </p>
                    <h2 className="font-display text-lg font-bold text-[#1E242B]">
                      Beat {beatIdx + 1} · {beat.label}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRegenerateSingleBeat(beatIdx)}
                    disabled={isRegenerating || rewritingAll}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-xs font-semibold text-[#1E242B] hover:bg-[#F0EFEA] disabled:opacity-60 transition-colors cursor-pointer shrink-0"
                  >
                    {isRegenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B5B7D]" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-[#5A6572]" />
                    )}
                    <span>{isRegenerating ? 'Rewriting...' : 'Regenerate Beat'}</span>
                  </button>
                </div>

                {/* Col 2: Scene Description */}
                <div className="lg:col-span-3">
                  <label className="block space-y-1.5">
                    <span className="lg:hidden text-xs font-semibold uppercase tracking-wide text-[#5A6572]">
                      Scene Description
                    </span>
                    <textarea
                      rows={4}
                      value={beat.sceneDescription}
                      onChange={(e) => updateBeatScene(beatIdx, e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-sm text-[#1E242B] leading-relaxed focus:outline-none focus:border-[#3B5B7D] focus:bg-white transition-colors resize-y"
                    />
                  </label>
                </div>

                {/* Col 3: Editable English Lines */}
                <div className="lg:col-span-4 space-y-2.5">
                  <span className="lg:hidden block text-xs font-semibold uppercase tracking-wide text-[#5A6572]">
                    English Lines
                  </span>
                  {beat.lines.map((line) => (
                    <div
                      key={line.id}
                      className="rounded-xl border border-[#ECEAE4] bg-[#FAF9F6] p-2.5 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={line.speaker}
                          onChange={(e) =>
                            updateBeatLine(beatIdx, line.id, 'speaker', e.target.value)
                          }
                          aria-label="Speaker name"
                          className="w-20 min-h-[38px] px-2.5 py-1 rounded-lg border border-[#D8D5CC] bg-white text-xs font-bold text-[#1E242B] focus:outline-none focus:border-[#3B5B7D]"
                        />
                        <input
                          type="text"
                          value={line.text}
                          onChange={(e) =>
                            updateBeatLine(beatIdx, line.id, 'text', e.target.value)
                          }
                          aria-label={`${line.speaker} dialogue line`}
                          className="flex-1 min-h-[38px] px-2.5 py-1 rounded-lg border border-[#D8D5CC] bg-white text-sm text-[#1E242B] focus:outline-none focus:border-[#3B5B7D]"
                        />
                      </div>
                      <input
                        type="text"
                        value={line.koreanTranslation || ''}
                        onChange={(e) =>
                          updateBeatLine(
                            beatIdx,
                            line.id,
                            'koreanTranslation',
                            e.target.value
                          )
                        }
                        placeholder="Korean subtitle translation (한국어 뜻)"
                        aria-label={`${line.speaker} Korean translation`}
                        className="w-full min-h-[34px] px-2.5 py-1 rounded-lg border border-[#E5E3DC] bg-white text-xs text-[#5A6572] focus:outline-none focus:border-[#3B5B7D]"
                      />
                    </div>
                  ))}
                </div>

                {/* Col 4: Interactive Expression Highlight & Burned-In Subtitle Preview */}
                <div className="lg:col-span-3 space-y-2.5">
                  <span className="lg:hidden block text-xs font-semibold uppercase tracking-wide text-[#5A6572]">
                    Subtitles Preview (Click Highlights)
                  </span>
                  {beat.lines.map((line) => {
                    const chunks = buildSubtitleChunksForLine(
                      line.id,
                      line.speaker,
                      line.text,
                      0,
                      3
                    );
                    const subtitleLines = chunks.flatMap((c) => c.lines).slice(0, 2);
                    return (
                      <div
                        key={`sub-${line.id}`}
                        className="rounded-xl border border-[#ECEAE4] bg-[#FAF9F6] p-3 space-y-1.5"
                      >
                        <div className="text-xs font-semibold text-[#5A6572]">
                          {line.speaker}
                        </div>
                        <div className="text-sm text-[#1E242B] leading-relaxed space-y-0.5">
                          {subtitleLines.map((subLine, lIdx) => (
                            <div key={lIdx}>
                              {renderHighlightedText(subLine, `${line.id}-${lIdx}`)}
                            </div>
                          ))}
                        </div>
                        {line.koreanTranslation && (
                          <div className="text-xs text-[#5A6572]">
                            {line.koreanTranslation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 min-h-[52px] px-6 py-3 rounded-xl border border-[#D8D5CC] bg-white text-base font-medium text-[#1E242B] hover:bg-[#F0EFEA] active:scale-[0.98] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#5A6572]" />
          <span>Back to Scene</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center gap-2.5 min-h-[52px] px-8 py-3 rounded-xl bg-[#3B5B7D] text-white text-base font-semibold hover:bg-[#2F4A67] active:scale-[0.98] transition-all cursor-pointer"
        >
          <span>Next: Generate Video & Voice</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
