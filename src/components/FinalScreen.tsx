import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Film,
  HelpCircle,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { Beat, ExpressionItem, QuizQuestion, SceneSettings } from '../types';
import { generateQuizQuestions, generateSrtContent } from '../utils/storyUtils';
import { exportTimelineToVideoBlob, VideoTimeline } from '../utils/videoRenderer';
import { FilmPlayer } from './FilmPlayer';

interface FinalScreenProps {
  beats: Beat[];
  scene: SceneSettings;
  expressions: ExpressionItem[];
  scriptAuthor: string;
  onChangeScriptAuthor: (name: string) => void;
  showKoreanSubtitles: boolean;
  onToggleKoreanSubtitles: (next: boolean) => void;
  backgroundMusicEnabled: boolean;
  onToggleBackgroundMusic: (next: boolean) => void;
  preferredMaleVoiceURI: string;
  preferredFemaleVoiceURI: string;
  onBack: () => void;
  onStartOver: () => void;
}

export function FinalScreen({
  beats,
  scene,
  expressions,
  scriptAuthor,
  onChangeScriptAuthor,
  showKoreanSubtitles,
  onToggleKoreanSubtitles,
  backgroundMusicEnabled,
  onToggleBackgroundMusic,
  preferredMaleVoiceURI,
  preferredFemaleVoiceURI,
  onBack,
  onStartOver,
}: FinalScreenProps) {
  const timelineRef = useRef<VideoTimeline | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement | null>>({});
  const quizSectionRef = useRef<HTMLDivElement | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadedUrl, setDownloadedUrl] = useState<string | null>(null);
  const [downloadedExt, setDownloadedExt] = useState<string>('webm');

  // 3-Question Expression Quiz ("표현 퀴즈")
  const [quizSeed, setQuizSeed] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const quizQuestions: QuizQuestion[] = useMemo(
    () => generateQuizQuestions(expressions, beats),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expressions, beats, quizSeed]
  );

  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = quizQuestions.reduce(
    (sum, q) => (selectedAnswers[q.id] === q.correctIndex ? sum + 1 : sum),
    0
  );

  const handleTimelineReady = useCallback(
    (
      timeline: VideoTimeline,
      imagesByShotId: Record<string, HTMLImageElement | null>
    ) => {
      timelineRef.current = timeline;
      imagesRef.current = imagesByShotId;
    },
    []
  );

  const handleDownloadVideo = async () => {
    if (!timelineRef.current) return;
    setExportError(null);
    setIsExporting(true);
    setExportProgress(0);

    try {
      const { blob, extension } = await exportTimelineToVideoBlob({
        beats,
        timeline: timelineRef.current,
        imagesByShotId: imagesRef.current,
        style: scene.style,
        showKoreanSubtitles,
        includeBackgroundMusic: backgroundMusicEnabled,
        scriptAuthor,
        onProgress: (pct) => setExportProgress(pct),
      });

      const url = URL.createObjectURL(blob);
      setDownloadedUrl(url);
      setDownloadedExt(extension);

      const link = document.createElement('a');
      link.href = url;
      link.download = `time-to-say-goodbye.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Could not export video in this browser.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSrt = () => {
    if (!timelineRef.current) return;
    const srt = generateSrtContent(timelineRef.current.allSubtitles);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'time-to-say-goodbye.srt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setQuizSeed((s) => s + 1);
  };

  const scrollToQuiz = () => {
    quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-sm font-medium text-[#3B5B7D]">
            Step 5 of 5 · Final Film & Quiz
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E242B] text-balance">
            Time to Say Goodbye
          </h1>
          <p className="text-base text-[#5A6572] leading-relaxed">
            Play your finished 30-second animated short film, download the video with subtitles and music, or test your memory with the 3-question quiz below.
          </p>
        </div>

        <button
          type="button"
          onClick={scrollToQuiz}
          className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-2.5 rounded-xl border border-[#D8D5CC] bg-white text-sm font-semibold text-[#1E242B] hover:bg-[#F0EFEA] transition-colors cursor-pointer shrink-0"
        >
          <HelpCircle className="w-4 h-4 text-[#3B5B7D]" />
          <span>Take 3-Question Quiz</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
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
            onTimelineReady={handleTimelineReady}
          />

          {/* Ending Credit Card Bar */}
          <div className="rounded-2xl border border-[#E5E3DC] bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#5A6572]">
            <span className="font-semibold text-[#1E242B]">
              Made with Google AI Studio · Script by [{scriptAuthor.trim() || 'Kim Seonghun'}]
            </span>
            <label className="inline-flex items-center gap-2 text-xs">
              <span>Script by:</span>
              <input
                type="text"
                value={scriptAuthor}
                onChange={(e) => onChangeScriptAuthor(e.target.value)}
                placeholder="Your Name"
                className="w-36 min-h-[34px] px-2.5 py-1 rounded-lg border border-[#D8D5CC] bg-[#FAF9F6] text-xs font-medium text-[#1E242B] focus:outline-none focus:border-[#3B5B7D]"
              />
            </label>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-[#E5E3DC] bg-white p-5 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#1E242B]">
              Export & Download
            </h2>

            <button
              type="button"
              onClick={handleDownloadVideo}
              disabled={isExporting}
              className="w-full inline-flex items-center justify-center gap-2.5 min-h-[52px] px-6 py-3 rounded-xl bg-[#3B5B7D] text-white text-base font-semibold hover:bg-[#2F4A67] disabled:opacity-70 active:scale-[0.98] transition-all cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="tabular-nums">Rendering Video ({exportProgress}%)</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Download 30s Video</span>
                </>
              )}
            </button>

            {isExporting && (
              <div className="w-full h-2 rounded-full bg-[#ECEAE4] overflow-hidden">
                <div
                  className="h-full bg-[#3B5B7D] transition-all duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            )}

            {downloadedUrl && !isExporting && (
              <p className="text-sm text-[#2D6A4F] font-medium">
                Video ready.{' '}
                <a
                  href={downloadedUrl}
                  download={`time-to-say-goodbye.${downloadedExt}`}
                  className="underline hover:text-[#1E242B]"
                >
                  Save again (.{downloadedExt})
                </a>
              </p>
            )}

            {exportError && (
              <p className="text-sm text-[#B42318] font-medium">{exportError}</p>
            )}

            <button
              type="button"
              onClick={handleDownloadSrt}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2.5 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-sm font-semibold text-[#1E242B] hover:bg-[#F0EFEA] transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#5A6572]" />
              <span>Download Subtitles (.srt)</span>
            </button>
          </div>

          <div className="rounded-2xl border border-[#E5E3DC] bg-white p-5 space-y-3">
            <h2 className="font-display text-lg font-semibold text-[#1E242B]">
              Expressions Learned
            </h2>

            <div className="divide-y divide-[#ECEAE4]">
              {expressions
                .filter((e) => e.expression.trim())
                .map((item) => (
                  <div key={item.id} className="py-3 first:pt-1 last:pb-1 space-y-1">
                    <div className="text-base font-semibold text-[#1E242B]">
                      {item.expression}
                    </div>
                    <div className="text-sm text-[#5A6572] flex items-center justify-between gap-2">
                      <span>{item.meaning}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-[#737E8B] shrink-0">
                        <Film className="w-3 h-3" />
                        <span>{item.movie}</span>
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bonus #3: 3-Question Expression Quiz ("표현 퀴즈") */}
      <div
        ref={quizSectionRef}
        className="rounded-2xl border border-[#E5E3DC] bg-white p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-[#1E242B]">
              표현 퀴즈 · 3-Question Expression Quiz
            </h2>
            <p className="text-sm text-[#5A6572]">
              Test what you learned from the 30-second video with instant feedback.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1E242B] tabular-nums">
              Score: {correctCount} / {quizQuestions.length}
            </span>
            <button
              type="button"
              onClick={handleResetQuiz}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-xs font-semibold text-[#1E242B] hover:bg-[#F0EFEA] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#3B5B7D]" />
              <span>New Quiz</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {quizQuestions.map((q, qIdx) => {
            const chosenIdx = selectedAnswers[q.id];
            const hasAnswered = chosenIdx !== undefined;
            const isCorrect = chosenIdx === q.correctIndex;

            return (
              <div
                key={q.id}
                className="rounded-xl border border-[#ECEAE4] bg-[#FAF9F6] p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="text-xs font-mono font-semibold text-[#3B5B7D]">
                    Question {qIdx + 1} of {quizQuestions.length}
                  </div>
                  <h3 className="text-base font-bold text-[#1E242B] leading-snug">
                    {q.prompt}
                  </h3>
                  {q.contextLine && (
                    <p className="text-xs text-[#5A6572] italic leading-relaxed">
                      {q.contextLine}
                    </p>
                  )}

                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, oIdx) => {
                      const isThisSelected = chosenIdx === oIdx;
                      const isThisCorrect = oIdx === q.correctIndex;
                      let optionStyle =
                        'border-[#D8D5CC] bg-white text-[#1E242B] hover:bg-[#F0EFEA]';
                      if (hasAnswered) {
                        if (isThisCorrect) {
                          optionStyle =
                            'border-[#2D6A4F] bg-[#ECFDF3] text-[#1E4620] font-semibold';
                        } else if (isThisSelected) {
                          optionStyle =
                            'border-[#B42318] bg-[#FEF3F2] text-[#B42318]';
                        } else {
                          optionStyle =
                            'border-[#E5E3DC] bg-white/60 text-[#737E8B]';
                        }
                      }

                      return (
                        <button
                          key={oIdx}
                          type="button"
                          disabled={hasAnswered}
                          onClick={() =>
                            setSelectedAnswers((prev) => ({
                              ...prev,
                              [q.id]: oIdx,
                            }))
                          }
                          className={`w-full min-h-[42px] px-3 py-2 rounded-xl border text-left text-sm transition-colors cursor-pointer disabled:cursor-default flex items-center justify-between gap-2 ${optionStyle}`}
                        >
                          <span>{opt}</span>
                          {hasAnswered && isThisCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                          )}
                          {hasAnswered && isThisSelected && !isThisCorrect && (
                            <XCircle className="w-4 h-4 text-[#B42318] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {hasAnswered && (
                  <div
                    className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      isCorrect
                        ? 'bg-[#ECFDF3] text-[#1E4620]'
                        : 'bg-[#FEF8EC] text-[#7C4A03]'
                    }`}
                  >
                    <strong>{isCorrect ? 'Correct! ' : 'Good try! '}</strong>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {answeredCount === quizQuestions.length && quizQuestions.length > 0 && (
          <div className="rounded-xl border border-[#C6D4E3] bg-[#F2F6FA] px-4 py-3 text-sm font-medium text-[#1E242B]">
            Quiz complete: You scored {correctCount} out of {quizQuestions.length}!
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 min-h-[52px] px-6 py-3 rounded-xl border border-[#D8D5CC] bg-white text-base font-medium text-[#1E242B] hover:bg-[#F0EFEA] active:scale-[0.98] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#5A6572]" />
          <span>Back to Video Studio</span>
        </button>

        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex items-center justify-center gap-2 min-h-[52px] px-6 py-3 rounded-xl border border-[#D8D5CC] bg-white text-base font-medium text-[#1E242B] hover:bg-[#F0EFEA] active:scale-[0.98] transition-all cursor-pointer"
        >
          <RotateCcw className="w-5 h-5 text-[#3B5B7D]" />
          <span>Make Another Film</span>
        </button>
      </div>
    </section>
  );
}
