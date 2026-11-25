import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Languages,
  Music,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Beat, ExpressionItem, VisualStyle } from '../types';
import { AmbientMusicController, startLiveAmbientMusic } from '../utils/ambientMusic';
import {
  cancelWebSpeech,
  getEnglishVoices,
  isSpeechSynthesisSupported,
  selectMaleAndFemaleVoices,
  speakLineWithWebSpeech,
  VoicePair,
  warmUpWebSpeech,
} from '../utils/speechUtils';
import {
  buildVideoTimeline,
  loadImageElement,
  renderTitleThumbnail,
  renderVideoFrame,
  VideoTimeline,
} from '../utils/videoRenderer';

interface FilmPlayerProps {
  beats: Beat[];
  style: VisualStyle;
  expressions: ExpressionItem[];
  scriptAuthor?: string;
  showKoreanSubtitles: boolean;
  onToggleKoreanSubtitles: (next: boolean) => void;
  backgroundMusicEnabled: boolean;
  onToggleBackgroundMusic: (next: boolean) => void;
  preferredMaleVoiceURI?: string;
  preferredFemaleVoiceURI?: string;
  onVoicesLoaded?: (pair: VoicePair) => void;
  onTimelineReady?: (
    timeline: VideoTimeline,
    imagesByShotId: Record<string, HTMLImageElement | null>
  ) => void;
}

export function FilmPlayer({
  beats,
  style,
  expressions,
  scriptAuthor = 'Kim Seonghun',
  showKoreanSubtitles,
  onToggleKoreanSubtitles,
  backgroundMusicEnabled,
  onToggleBackgroundMusic,
  preferredMaleVoiceURI,
  preferredFemaleVoiceURI,
  onVoicesLoaded,
  onTimelineReady,
}: FilmPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const spokenLineIdsRef = useRef<Set<string>>(new Set());
  const musicCtxRef = useRef<AudioContext | null>(null);
  const musicCtrlRef = useRef<AmbientMusicController | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [imagesByShotId, setImagesByShotId] = useState<
    Record<string, HTMLImageElement | null>
  >({});

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;
    const syncVoices = () => {
      setVoices(getEnglishVoices());
    };
    syncVoices();
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', syncVoices);
    };
  }, []);

  const voicePair = useMemo(
    () =>
      selectMaleAndFemaleVoices(
        voices,
        preferredMaleVoiceURI,
        preferredFemaleVoiceURI
      ),
    [voices, preferredMaleVoiceURI, preferredFemaleVoiceURI]
  );

  useEffect(() => {
    onVoicesLoaded?.(voicePair);
  }, [voicePair, onVoicesLoaded]);

  useEffect(() => {
    let cancelled = false;
    async function loadAllShots() {
      const lineTasks = beats.flatMap((beat) =>
        beat.lines.map(async (line) => {
          const url =
            line.customImageUrl ||
            beat.customImageUrl ||
            line.imageUrl ||
            beat.defaultImageUrl;
          if (!url) return [line.id, null] as const;
          const img = await loadImageElement(url);
          return [line.id, img] as const;
        })
      );
      const entries = await Promise.all(lineTasks);
      if (cancelled) return;
      const map: Record<string, HTMLImageElement | null> = {};
      for (const [lineId, img] of entries) {
        map[lineId] = img;
      }
      setImagesByShotId(map);
    }
    loadAllShots();
    return () => {
      cancelled = true;
    };
  }, [beats]);

  const timeline = useMemo(() => buildVideoTimeline(beats), [beats]);

  useEffect(() => {
    onTimelineReady?.(timeline, imagesByShotId);
  }, [timeline, imagesByShotId, onTimelineReady]);

  const stopAmbientMusic = useCallback(() => {
    if (musicCtrlRef.current) {
      musicCtrlRef.current.stop();
      musicCtrlRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    cancelWebSpeech();
    spokenLineIdsRef.current.clear();
    stopAmbientMusic();
  }, [stopAmbientMusic]);

  // Render Title Thumbnail before Play, or paused video frame otherwise
  useEffect(() => {
    if (isPlaying) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    if (!hasStarted && currentTime === 0) {
      const firstLineId = beats[0]?.lines[0]?.id;
      const coverImg =
        (firstLineId ? imagesByShotId[firstLineId] : null) ||
        Object.values(imagesByShotId).find(Boolean) ||
        null;
      renderTitleThumbnail(ctx, coverImg, style);
    } else {
      renderVideoFrame(ctx, currentTime, beats, timeline, imagesByShotId, style, {
        showKoreanSubtitles,
        scriptAuthor,
      });
    }
  }, [
    isPlaying,
    hasStarted,
    currentTime,
    beats,
    timeline,
    imagesByShotId,
    style,
    showKoreanSubtitles,
    scriptAuthor,
  ]);

  useEffect(() => {
    if (isMuted) {
      cancelWebSpeech();
    }
    if (musicCtrlRef.current) {
      musicCtrlRef.current.setEnabled(backgroundMusicEnabled && !isMuted);
    }
  }, [isMuted, backgroundMusicEnabled]);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (musicCtxRef.current) {
        musicCtxRef.current.close().catch(() => {});
        musicCtxRef.current = null;
      }
    };
  }, [stopPlayback]);

  const startPlaybackFrom = useCallback(
    async (startOffset: number) => {
      stopPlayback();

      const clampedStart = startOffset >= 29.8 ? 0 : Math.max(0, startOffset);
      setHasStarted(true);

      // Warm up speechSynthesis immediately on user gesture so first word ("Our") is never clipped
      if (!isMuted) {
        warmUpWebSpeech(voicePair);
      }

      // Start gentle Web Audio ambient electric-piano background music
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!musicCtxRef.current) {
          musicCtxRef.current = new AudioCtx();
        }
        if (musicCtxRef.current.state === 'suspended') {
          await musicCtxRef.current.resume();
        }
        musicCtrlRef.current = startLiveAmbientMusic(
          musicCtxRef.current,
          backgroundMusicEnabled && !isMuted
        );
      } catch {
        // ignore Web Audio failure
      }

      for (const line of timeline.scheduledLines) {
        if (line.endSec <= clampedStart) {
          spokenLineIdsRef.current.add(line.lineId);
        }
      }

      const startTimeMs = performance.now();
      const minimumAudioUnlockAtMs = startTimeMs + 300;
      setIsPlaying(true);

      const tick = () => {
        const now = performance.now();
        const elapsed = (now - startTimeMs) / 1000;
        const t = clampedStart + elapsed;
        const canvas = canvasRef.current;
        const canvasCtx = canvas?.getContext('2d');

        if (now >= minimumAudioUnlockAtMs) {
          for (const line of timeline.scheduledLines) {
            if (
              !spokenLineIdsRef.current.has(line.lineId) &&
              t >= line.startSec &&
              t < line.endSec
            ) {
              spokenLineIdsRef.current.add(line.lineId);
              speakLineWithWebSpeech({
                text: line.text,
                speaker: line.speaker,
                rate: line.speechRate,
                muted: isMuted,
                voicePair,
              });
            }
          }
        }

        if (t >= 30) {
          setCurrentTime(30);
          if (canvasCtx) {
            renderVideoFrame(canvasCtx, 30, beats, timeline, imagesByShotId, style, {
              showKoreanSubtitles,
              scriptAuthor,
            });
          }
          stopPlayback();
          setIsPlaying(false);
          return;
        }

        setCurrentTime(t);
        if (canvasCtx) {
          renderVideoFrame(canvasCtx, t, beats, timeline, imagesByShotId, style, {
            showKoreanSubtitles,
            scriptAuthor,
          });
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [
      backgroundMusicEnabled,
      beats,
      imagesByShotId,
      isMuted,
      scriptAuthor,
      showKoreanSubtitles,
      stopPlayback,
      style,
      timeline,
      voicePair,
    ]
  );

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlayback();
      setIsPlaying(false);
    } else {
      startPlaybackFrom(currentTime);
    }
  };

  const handleRestart = () => {
    setCurrentTime(0);
    startPlaybackFrom(0);
  };

  const handleSeek = (nextTime: number) => {
    const clamped = Math.max(0, Math.min(30, nextTime));
    setHasStarted(true);
    setCurrentTime(clamped);
    if (isPlaying) {
      startPlaybackFrom(clamped);
    } else {
      cancelWebSpeech();
    }
  };

  const handleDownloadThumbnail = () => {
    const offscreen = document.createElement('canvas');
    offscreen.width = 1280;
    offscreen.height = 720;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    const firstLineId = beats[0]?.lines[0]?.id;
    const coverImg =
      (firstLineId ? imagesByShotId[firstLineId] : null) ||
      Object.values(imagesByShotId).find(Boolean) ||
      null;
    renderTitleThumbnail(ctx, coverImg, style);

    const url = offscreen.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `time-to-say-goodbye-thumbnail-${style.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeBeat =
    beats.find((b) => currentTime >= b.startSec && currentTime < b.endSec) ||
    beats[beats.length - 1];

  const activeShot =
    timeline.scheduledLines.find(
      (s) => currentTime >= s.shotStartSec && currentTime < s.shotEndSec
    ) || timeline.scheduledLines[timeline.scheduledLines.length - 1];

  const activeExpressions = useMemo(() => {
    const textToCheck =
      activeShot?.text || activeBeat.lines.map((l) => l.text).join(' ');
    return expressions.filter((e) => {
      const clean = e.expression.replace(/\.{2,}$/, '').trim().toLowerCase();
      return clean && textToCheck.toLowerCase().includes(clean);
    });
  }, [activeBeat, activeShot, expressions]);

  return (
    <div className="space-y-4">
      {/* 16:9 Video Canvas Stage (Shows Title Thumbnail before pressing Play) */}
      <div className="relative rounded-2xl overflow-hidden bg-[#10151E] border border-[#D8D5CC]">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          onClick={handleTogglePlay}
          className="w-full aspect-video block cursor-pointer"
        />

        {!isPlaying && (
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label={currentTime >= 29.8 ? 'Replay 30-second video' : 'Play 30-second video'}
            className="absolute inset-0 flex items-center justify-center bg-black/15 hover:bg-black/25 transition-colors cursor-pointer group"
          >
            <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 text-[#1E242B] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              {currentTime >= 29.8 ? (
                <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8" />
              ) : (
                <Play className="w-7 h-7 sm:w-8 sm:h-8 ml-1" />
              )}
            </span>
          </button>
        )}
      </div>

      {/* Transport, Toggles & 8-Shot Scrubber */}
      <div className="rounded-2xl border border-[#E5E3DC] bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-2 min-h-[46px] px-5 py-2 rounded-xl bg-[#3B5B7D] text-white text-base font-semibold hover:bg-[#2F4A67] active:scale-[0.98] transition-all cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>{currentTime >= 29.8 ? 'Replay' : 'Play 30s Film'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              aria-label="Restart from beginning"
              className="min-h-[46px] min-w-[46px] inline-flex items-center justify-center rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-[#1E242B] hover:bg-[#F0EFEA] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="min-h-[46px] min-w-[46px] inline-flex items-center justify-center rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-[#1E242B] hover:bg-[#F0EFEA] transition-colors cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-[#B42318]" />
              ) : (
                <Volume2 className="w-5 h-5 text-[#3B5B7D]" />
              )}
            </button>
          </div>

          {/* Bonus Toggles: Korean Subtitles, Ambient BGM, Title Thumbnail Download */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleKoreanSubtitles(!showKoreanSubtitles)}
              aria-pressed={showKoreanSubtitles}
              className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                showKoreanSubtitles
                  ? 'border-[#3B5B7D] bg-[#F2F6FA] text-[#1E242B]'
                  : 'border-[#D8D5CC] bg-[#FAF9F6] text-[#5A6572] hover:text-[#1E242B]'
              }`}
            >
              <Languages className="w-4 h-4 text-[#3B5B7D]" />
              <span>한국어 해석 {showKoreanSubtitles ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleBackgroundMusic(!backgroundMusicEnabled)}
              aria-pressed={backgroundMusicEnabled}
              className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                backgroundMusicEnabled
                  ? 'border-[#3B5B7D] bg-[#F2F6FA] text-[#1E242B]'
                  : 'border-[#D8D5CC] bg-[#FAF9F6] text-[#5A6572] hover:text-[#1E242B]'
              }`}
            >
              <Music className="w-4 h-4 text-[#3B5B7D]" />
              <span>배경음악 {backgroundMusicEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadThumbnail}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-1.5 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-xs sm:text-sm font-semibold text-[#1E242B] hover:bg-[#F0EFEA] transition-colors cursor-pointer whitespace-nowrap"
            >
              <ImageIcon className="w-4 h-4 text-[#3B5B7D]" />
              <span>썸네일 저장</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs sm:text-sm text-[#5A6572] font-mono tabular-nums">
          <span>
            <strong className="text-[#1E242B]">{currentTime.toFixed(1)}s</strong> / 30.0s
          </span>
          <span className="font-sans font-medium text-[#1E242B]">
            {!hasStarted && currentTime === 0
              ? `Cover Thumbnail · ${style}`
              : currentTime >= 28.8
                ? 'Ending Credit Card'
                : activeShot
                  ? `Shot ${activeShot.shotLabel} · ${activeShot.speaker}`
                  : activeBeat.label}
          </span>
        </div>

        <div className="space-y-2.5">
          <input
            type="range"
            min={0}
            max={30}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            aria-label="Video timeline"
            className="w-full h-2.5 accent-[#3B5B7D] cursor-pointer"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {beats.map((beat) => {
              const beatShots = timeline.scheduledLines.filter(
                (s) => s.beatIndex === beat.index
              );
              const isBeatActive =
                hasStarted &&
                currentTime >= beat.startSec &&
                (beat.index === 3 ? currentTime <= 30 : currentTime < beat.endSec);
              return (
                <div
                  key={beat.id}
                  className={`rounded-xl border p-2 transition-colors ${
                    isBeatActive
                      ? 'border-[#3B5B7D] bg-[#F2F6FA]'
                      : 'border-[#ECEAE4] bg-[#FAF9F6]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSeek(beat.startSec)}
                    className="w-full text-left px-1 pb-1.5 cursor-pointer"
                  >
                    <div className="text-[11px] font-mono text-[#5A6572] tabular-nums">
                      {beat.startSec}–{beat.endSec}s · {beat.label}
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    {beatShots.map((shot) => {
                      const isShotActive =
                        hasStarted && currentTime < 28.8 && activeShot?.lineId === shot.lineId;
                      return (
                        <button
                          key={shot.lineId}
                          type="button"
                          onClick={() => handleSeek(shot.shotStartSec)}
                          className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-medium truncate transition-colors cursor-pointer ${
                            isShotActive
                              ? 'bg-[#3B5B7D] text-white'
                              : 'bg-white border border-[#E5E3DC] text-[#3A434D] hover:bg-[#F0EFEA]'
                          }`}
                        >
                          {shot.shotLabel} · {shot.speaker}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-[#ECEAE4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
          <div className="text-[#5A6572]">
            {activeShot && currentTime < 28.8 ? (
              <span>
                Active shot:{' '}
                <strong className="text-[#1E242B]">
                  {activeShot.shotLabel} · {activeShot.speaker}
                </strong>
              </span>
            ) : (
              <span>Scene · {activeBeat.label}</span>
            )}
          </div>

          {activeExpressions.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#1E242B]">
              {activeExpressions.map((exp) => (
                <span key={exp.id}>
                  <strong className="text-[#9A6700]">{exp.expression}</strong>
                  <span className="text-[#5A6572]">
                    {' '}
                    · {exp.meaning} ({exp.movie})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
