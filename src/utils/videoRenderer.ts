import { Beat, SubtitleChunk, VisualStyle } from '../types';
import { scheduleAmbientMusicForExport } from './ambientMusic';
import { buildSubtitleChunksForLine } from './storyUtils';

export interface ScheduledLine {
  beatIndex: number;
  lineIndexInBeat: number;
  shotLabel: string;
  lineId: string;
  speaker: string;
  text: string;
  koreanTranslation?: string;
  startSec: number;
  endSec: number;
  shotStartSec: number;
  shotEndSec: number;
  speechRate: number;
  focusX: number;
  focusY: number;
  speakerSide: 'left' | 'right' | 'center';
  subtitles: SubtitleChunk[];
}

export interface VideoTimeline {
  totalDurationSec: number;
  scheduledLines: ScheduledLine[];
  allSubtitles: SubtitleChunk[];
}

function estimateSpeechSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.4, words / 2.45 + 0.4);
}

export function buildVideoTimeline(beats: Beat[]): VideoTimeline {
  const scheduledLines: ScheduledLine[] = [];
  const allSubtitles: SubtitleChunk[] = [];

  for (const beat of beats) {
    const beatStart = beat.startSec;
    // Leave 1.2s at the very end of Beat 4 (28.8s - 30.0s) for the Ending Credit Card
    const beatEnd = beat.index === 3 ? Math.min(beat.endSec, 28.8) : beat.endSec;
    const beatDur = beatEnd - beatStart;
    const lines = beat.lines.filter((l) => l.text.trim().length > 0);
    if (lines.length === 0) continue;

    // Guaranteed >= 350ms pause before the first line of every beat (420ms on Beat 1)
    const leadIn = beat.index === 0 ? 0.42 : 0.36;
    const gapBetween = 0.34;
    const tailPad = 0.2;
    const availableSpeechWindow = Math.max(
      1.5,
      beatDur - leadIn - tailPad - gapBetween * Math.max(0, lines.length - 1)
    );

    const rawDurations = lines.map((line) => estimateSpeechSeconds(line.text));
    const totalRaw = rawDurations.reduce((a, b) => a + b, 0);

    const rate =
      totalRaw > availableSpeechWindow
        ? Math.min(1.28, totalRaw / availableSpeechWindow)
        : 1.0;

    let cursor = beatStart + leadIn;
    const beatLines: ScheduledLine[] = [];

    lines.forEach((line, idx) => {
      const dur = rawDurations[idx] / rate;
      const startSec = cursor;
      const endSec = Math.min(beatEnd - 0.1, cursor + dur);
      const subtitles = buildSubtitleChunksForLine(
        line.id,
        line.speaker,
        line.text,
        startSec,
        endSec,
        line.koreanTranslation
      );

      const defaultSide = idx % 2 === 0 ? 'left' : 'right';
      const speakerSide = line.speakerSide || defaultSide;
      const focusX =
        line.focusX ?? (speakerSide === 'left' ? 0.35 : speakerSide === 'right' ? 0.66 : 0.5);
      const focusY = line.focusY ?? 0.43;

      beatLines.push({
        beatIndex: beat.index,
        lineIndexInBeat: idx,
        shotLabel: `${beat.index + 1}${String.fromCharCode(65 + idx)}`,
        lineId: line.id,
        speaker: line.speaker,
        text: line.text,
        koreanTranslation: line.koreanTranslation,
        startSec,
        endSec,
        shotStartSec: beatStart,
        shotEndSec: beatEnd,
        speechRate: rate,
        focusX,
        focusY,
        speakerSide,
        subtitles,
      });

      allSubtitles.push(...subtitles);
      cursor = endSec + gapBetween;
    });

    for (let i = 0; i < beatLines.length; i++) {
      const prev = beatLines[i - 1];
      const curr = beatLines[i];
      const next = beatLines[i + 1];

      curr.shotStartSec = prev
        ? (prev.endSec + curr.startSec) / 2
        : beatStart;
      curr.shotEndSec = next
        ? (curr.endSec + next.startSec) / 2
        : beat.endSec;
    }

    scheduledLines.push(...beatLines);
  }

  return {
    totalDurationSec: 30,
    scheduledLines,
    allSubtitles,
  };
}

let cachedPaperPattern: CanvasPattern | null = null;
let cachedGrainCanvas: HTMLCanvasElement | null = null;

function getGrainOverlay(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (cachedPaperPattern) return cachedPaperPattern;
  if (!cachedGrainCanvas) {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 160;
    const gctx = c.getContext('2d');
    if (gctx) {
      const imgData = gctx.createImageData(160, 160);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = 128 + Math.floor((Math.random() - 0.5) * 60);
        imgData.data[i] = v;
        imgData.data[i + 1] = v - 2;
        imgData.data[i + 2] = v - 6;
        imgData.data[i + 3] = 24;
      }
      gctx.putImageData(imgData, 0, 0);
    }
    cachedGrainCanvas = c;
  }
  cachedPaperPattern = ctx.createPattern(cachedGrainCanvas, 'repeat');
  return cachedPaperPattern;
}

export async function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function easeOutCubic(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return 1 - Math.pow(1 - t, 3);
}

function applyStyleFilter(ctx: CanvasRenderingContext2D, style: VisualStyle) {
  if (style === '2D animation') {
    ctx.filter = 'contrast(1.04) saturate(1.06)';
  } else if (style === 'Clay') {
    ctx.filter = 'contrast(0.98) saturate(1.16) brightness(1.04)';
  } else if (style === 'Watercolor') {
    ctx.filter = 'contrast(0.92) saturate(0.84) sepia(0.16) brightness(1.07)';
  } else if (style === 'Live-action style') {
    ctx.filter = 'contrast(1.10) saturate(0.90) brightness(0.96)';
  }
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  width: number,
  height: number
) {
  if (img) {
    const imgRatio = img.width / Math.max(1, img.height);
    const canvasRatio = width / height;
    let drawW = width;
    let drawH = height;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > canvasRatio) {
      drawH = height;
      drawW = height * imgRatio;
      offsetX = (width - drawW) / 2;
    } else {
      drawW = width;
      drawH = width / imgRatio;
      offsetY = (height - drawH) / 2;
    }
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawShotWithSpeakerFocus(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  shot: ScheduledLine,
  shotProgress: number,
  isSpeakingNow: boolean,
  style: VisualStyle,
  width: number,
  height: number
) {
  ctx.save();
  applyStyleFilter(ctx, style);

  const eased = easeOutCubic(shotProgress);
  const baseScale = shot.speakerSide === 'center' ? 1.0 : 1.02;
  const zoomTarget = shot.speakerSide === 'center' ? 1.07 : 1.13;
  const scale = baseScale + (zoomTarget - baseScale) * eased;

  const anchorX = shot.focusX * width;
  const anchorY = shot.focusY * height;

  ctx.translate(anchorX, anchorY);
  ctx.scale(scale, scale);
  ctx.translate(-anchorX, -anchorY);

  drawCoverImage(ctx, img, width, height);
  ctx.restore();

  if (shot.speakerSide !== 'center') {
    ctx.save();
    const dimStrength = isSpeakingNow ? 0.34 : 0.2;
    const spotlight = ctx.createRadialGradient(
      shot.focusX * width,
      shot.focusY * height,
      width * 0.18,
      shot.focusX * width,
      shot.focusY * height,
      width * 0.62
    );
    spotlight.addColorStop(0, 'rgba(8, 12, 20, 0)');
    spotlight.addColorStop(0.55, `rgba(8, 12, 20, ${(dimStrength * 0.45).toFixed(3)})`);
    spotlight.addColorStop(1, `rgba(8, 12, 20, ${dimStrength.toFixed(3)})`);
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function drawStyleTextureLayer(
  ctx: CanvasRenderingContext2D,
  style: VisualStyle,
  width: number,
  height: number
) {
  ctx.save();
  if (style === 'Watercolor') {
    const pattern = getGrainOverlay(ctx);
    if (pattern) {
      ctx.globalAlpha = 0.48;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(247, 242, 232, 0.38)';
    ctx.lineWidth = 22;
    ctx.strokeRect(11, 11, width - 22, height - 22);
  } else if (style === 'Clay') {
    const vig = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.28,
      width / 2,
      height / 2,
      width * 0.65
    );
    vig.addColorStop(0, 'rgba(255, 240, 220, 0.05)');
    vig.addColorStop(1, 'rgba(20, 16, 12, 0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  } else if (style === 'Live-action style') {
    const pattern = getGrainOverlay(ctx);
    if (pattern) {
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(8, 11, 16, 0.92)';
    ctx.fillRect(0, 0, width, 34);
    ctx.fillRect(0, height - 34, width, 34);
  }
  ctx.restore();
}

function drawAmbientBeatEffects(
  ctx: CanvasRenderingContext2D,
  beatIndex: number,
  t: number,
  beatProgress: number,
  style: VisualStyle,
  width: number,
  height: number
) {
  ctx.save();

  if (beatIndex === 0 || beatIndex === 1) {
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const phase = t * 1.4 + i * 1.7;
      const baseX = beatIndex === 0 ? 135 + i * 26 : 165 + i * 24;
      const baseY = 510 - ((phase * 18) % 55);
      const alpha = Math.max(0, 0.2 - ((phase * 18) % 55) / 260);
      ctx.strokeStyle = `rgba(255, 248, 235, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(
        baseX + Math.sin(phase) * 10,
        baseY - 22,
        baseX - Math.cos(phase) * 8,
        baseY - 42
      );
      ctx.stroke();
    }
  }

  if (beatIndex === 2) {
    const pulse = 0.07 + 0.05 * Math.sin(t * 7);
    const glow = ctx.createRadialGradient(
      width * 0.49,
      height * 0.48,
      10,
      width * 0.49,
      height * 0.48,
      200
    );
    glow.addColorStop(0, `rgba(186, 230, 253, ${pulse.toFixed(3)})`);
    glow.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  if (beatIndex === 3) {
    const glowAlpha = 0.06 + 0.08 * beatProgress;
    const warmDoor = ctx.createRadialGradient(
      width * 0.85,
      height * 0.45,
      20,
      width * 0.85,
      height * 0.45,
      460
    );
    warmDoor.addColorStop(0, `rgba(253, 230, 138, ${glowAlpha.toFixed(3)})`);
    warmDoor.addColorStop(1, 'rgba(253, 230, 138, 0)');
    ctx.fillStyle = warmDoor;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
  drawStyleTextureLayer(ctx, style, width, height);
}

function drawActiveSpeakerBadge(
  ctx: CanvasRenderingContext2D,
  shot: ScheduledLine,
  isSpeakingNow: boolean,
  t: number,
  style: VisualStyle
) {
  ctx.save();

  const x = 34;
  const y = style === 'Live-action style' ? 50 : 28;
  const badgeHeight = 42;

  ctx.font = '700 18px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  const nameText = shot.speaker;
  const textWidth = ctx.measureText(nameText).width;

  const waveBarsCount = 5;
  const waveBlockWidth = waveBarsCount * 6 + 6;
  const padX = 16;
  const badgeWidth = padX * 2 + textWidth + 14 + waveBlockWidth;

  ctx.fillStyle = isSpeakingNow
    ? 'rgba(15, 23, 36, 0.82)'
    : 'rgba(15, 23, 36, 0.56)';
  ctx.strokeStyle = isSpeakingNow
    ? 'rgba(251, 191, 36, 0.65)'
    : 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;

  const r = 12;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + badgeWidth - r, y);
  ctx.quadraticCurveTo(x + badgeWidth, y, x + badgeWidth, y + r);
  ctx.lineTo(x + badgeWidth, y + badgeHeight - r);
  ctx.quadraticCurveTo(x + badgeWidth, y + badgeHeight, x + badgeWidth - r, y + badgeHeight);
  ctx.lineTo(x + r, y + badgeHeight);
  ctx.quadraticCurveTo(x, y + badgeHeight, x, y + badgeHeight - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(nameText, x + padX, y + badgeHeight / 2 + 1);

  const waveStartX = x + padX + textWidth + 12;
  const centerY = y + badgeHeight / 2;

  for (let i = 0; i < waveBarsCount; i++) {
    const barX = waveStartX + i * 6;
    let barH = 4;
    if (isSpeakingNow) {
      const freq = 11 + i * 3.1;
      const phase = i * 1.15;
      const amp = 0.5 + 0.5 * Math.sin(t * freq + phase);
      barH = 5 + amp * 15;
    }
    ctx.fillStyle = isSpeakingNow ? '#FBBF24' : 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.roundRect(barX, centerY - barH / 2, 3.5, barH, 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBurnedInSubtitles(
  ctx: CanvasRenderingContext2D,
  chunk: SubtitleChunk | undefined,
  style: VisualStyle,
  showKorean: boolean,
  width: number,
  height: number
) {
  ctx.save();

  const scrimTop = height - 210;
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, height);
  scrim.addColorStop(0, 'rgba(8, 12, 18, 0)');
  scrim.addColorStop(0.5, 'rgba(8, 12, 18, 0.56)');
  scrim.addColorStop(1, 'rgba(8, 12, 18, 0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, width, 210);

  if (!chunk || chunk.lines.length === 0) {
    ctx.restore();
    return;
  }

  const lines = chunk.lines.slice(0, 2);
  const hasKorean = Boolean(showKorean && chunk.koreanLine);
  const baseBottomMargin = style === 'Live-action style' ? 54 : 32;
  const koreanOffset = hasKorean ? 34 : 0;
  const lineHeight = 42;

  ctx.font = '700 32px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  lines.forEach((line, idx) => {
    const y =
      height -
      baseBottomMargin -
      koreanOffset -
      (lines.length - 1 - idx) * lineHeight;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(10, 14, 22, 0.92)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.strokeText(line, width / 2, y);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(line, width / 2, y);
  });

  if (hasKorean && chunk.koreanLine) {
    ctx.font =
      '600 22px "Plus Jakarta Sans", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = 'rgba(10, 14, 22, 0.92)';
    ctx.shadowBlur = 8;
    const ky = height - baseBottomMargin;
    ctx.strokeText(chunk.koreanLine, width / 2, ky);
    ctx.fillStyle = '#FDE68A';
    ctx.fillText(chunk.koreanLine, width / 2, ky);
  }

  ctx.restore();
}

function drawEndingCreditCard(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  scriptAuthor: string,
  width: number,
  height: number
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  ctx.fillStyle = '#0F1520';
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width / 2,
    height / 2,
    40,
    width / 2,
    height / 2,
    500
  );
  glow.addColorStop(0, 'rgba(59, 91, 125, 0.25)');
  glow.addColorStop(1, 'rgba(15, 21, 32, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '700 44px "Outfit", "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Time to Say Goodbye', width / 2, height / 2 - 24);

  const authorText = scriptAuthor.trim() || 'Kim Seonghun';
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#CBD5E1';
  ctx.fillText(
    `Made with Google AI Studio · Script by ${authorText}`,
    width / 2,
    height / 2 + 34
  );

  ctx.restore();
}

/**
 * Draws a crisp 1280x720 Title Thumbnail image in the chosen art style featuring the characters.
 */
export function renderTitleThumbnail(
  ctx: CanvasRenderingContext2D,
  coverImg: HTMLImageElement | null,
  style: VisualStyle,
  title = 'Time to Say Goodbye',
  subtitle = '30-Second English Short Film'
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  applyStyleFilter(ctx, style);
  drawCoverImage(ctx, coverImg, width, height);
  ctx.restore();

  drawStyleTextureLayer(ctx, style, width, height);

  // Subtle top/bottom cinematic scrim for crisp title contrast
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(10, 15, 24, 0.55)');
  grad.addColorStop(0.4, 'rgba(10, 15, 24, 0.12)');
  grad.addColorStop(0.7, 'rgba(10, 15, 24, 0.45)');
  grad.addColorStop(1, 'rgba(10, 15, 24, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Style label kicker at top
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#FDE68A';
  ctx.fillText(`${subtitle} · ${style}`, width / 2, height - 154);

  // Main Bold Title
  ctx.font = '700 66px "Outfit", "Plus Jakarta Sans", sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(10, 14, 22, 0.85)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 16;
  ctx.strokeText(title, width / 2, height - 92);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(title, width / 2, height - 92);

  ctx.restore();
}

export function renderVideoFrame(
  ctx: CanvasRenderingContext2D,
  tRaw: number,
  beats: Beat[],
  timeline: VideoTimeline,
  imagesByShotId: Record<string, HTMLImageElement | null>,
  style: VisualStyle,
  options?: {
    showKoreanSubtitles?: boolean;
    scriptAuthor?: string;
  }
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const showKorean = Boolean(options?.showKoreanSubtitles);
  const scriptAuthor = options?.scriptAuthor || 'Kim Seonghun';

  const t = style === 'Clay' ? Math.floor(tRaw * 12) / 12 : tRaw;
  const clampedT = Math.max(0, Math.min(30, t));

  const activeBeat =
    beats.find((b) => clampedT >= b.startSec && clampedT < b.endSec) ||
    beats[beats.length - 1];

  const beatDur = Math.max(1, activeBeat.endSec - activeBeat.startSec);
  const beatProgress = Math.max(
    0,
    Math.min(1, (clampedT - activeBeat.startSec) / beatDur)
  );

  const shots = timeline.scheduledLines;
  const activeShotIdx = Math.max(
    0,
    shots.findIndex((s) => clampedT >= s.shotStartSec && clampedT < s.shotEndSec)
  );
  const activeShot = shots[activeShotIdx] || shots[shots.length - 1];

  ctx.clearRect(0, 0, width, height);

  if (activeShot) {
    const shotDur = Math.max(0.5, activeShot.shotEndSec - activeShot.shotStartSec);
    const shotProgress = Math.max(
      0,
      Math.min(1, (clampedT - activeShot.shotStartSec) / shotDur)
    );
    const isSpeakingNow =
      tRaw >= activeShot.startSec && tRaw <= activeShot.endSec + 0.08;

    const timeIntoShot = clampedT - activeShot.shotStartSec;
    const prevShot = activeShotIdx > 0 ? shots[activeShotIdx - 1] : null;
    const crossFadeDur = 0.22;

    if (prevShot && timeIntoShot < crossFadeDur) {
      drawShotWithSpeakerFocus(
        ctx,
        imagesByShotId[prevShot.lineId] ?? null,
        prevShot,
        1,
        false,
        style,
        width,
        height
      );
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, timeIntoShot / crossFadeDur));
      drawShotWithSpeakerFocus(
        ctx,
        imagesByShotId[activeShot.lineId] ?? null,
        activeShot,
        shotProgress,
        isSpeakingNow,
        style,
        width,
        height
      );
      ctx.restore();
    } else {
      drawShotWithSpeakerFocus(
        ctx,
        imagesByShotId[activeShot.lineId] ?? null,
        activeShot,
        shotProgress,
        isSpeakingNow,
        style,
        width,
        height
      );
    }

    drawAmbientBeatEffects(ctx, activeBeat.index, t, beatProgress, style, width, height);
    if (tRaw < 28.8) {
      drawActiveSpeakerBadge(ctx, activeShot, isSpeakingNow, tRaw, style);
    }
  } else {
    drawAmbientBeatEffects(ctx, activeBeat.index, t, beatProgress, style, width, height);
  }

  if (tRaw < 28.8) {
    const activeChunk = timeline.allSubtitles.find(
      (sub) => tRaw >= sub.startSec && tRaw <= sub.endSec + 0.08
    );
    drawBurnedInSubtitles(ctx, activeChunk, style, showKorean, width, height);
  }

  // Ending Credit Card from 28.8s to 30.0s
  if (tRaw >= 28.8) {
    const creditAlpha = Math.min(1, (tRaw - 28.8) / 0.45);
    drawEndingCreditCard(ctx, creditAlpha, scriptAuthor, width, height);
  }
}

export async function exportTimelineToVideoBlob(options: {
  beats: Beat[];
  timeline: VideoTimeline;
  imagesByShotId: Record<string, HTMLImageElement | null>;
  style: VisualStyle;
  showKoreanSubtitles?: boolean;
  includeBackgroundMusic?: boolean;
  scriptAuthor?: string;
  onProgress?: (pct: number) => void;
}): Promise<{ blob: Blob; extension: string }> {
  const {
    beats,
    timeline,
    imagesByShotId,
    style,
    showKoreanSubtitles = false,
    includeBackgroundMusic = true,
    scriptAuthor = 'Kim Seonghun',
    onProgress,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas for export.');
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const dest = audioCtx.createMediaStreamDestination();
  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const preferredTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  const mimeType =
    preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

  const recorder = new MediaRecorder(
    combinedStream,
    mimeType ? { mimeType, videoBitsPerSecond: 3_500_000 } : undefined
  );
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const startAudioTime = audioCtx.currentTime + 0.12;

  if (includeBackgroundMusic) {
    scheduleAmbientMusicForExport(audioCtx, dest, startAudioTime, 30);
  } else {
    const silentOsc = audioCtx.createOscillator();
    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0.0001;
    silentOsc.connect(silentGain);
    silentGain.connect(dest);
    silentOsc.start(startAudioTime);
    silentOsc.stop(startAudioTime + 30.2);
  }

  return new Promise((resolve, reject) => {
    recorder.onerror = () => {
      reject(new Error('Video recording failed in this browser.'));
    };
    recorder.onstop = () => {
      audioCtx.close().catch(() => {});
      const finalMime = recorder.mimeType || mimeType || 'video/webm';
      const extension = finalMime.includes('mp4') ? 'mp4' : 'webm';
      resolve({
        blob: new Blob(chunks, { type: finalMime }),
        extension,
      });
    };

    recorder.start(250);

    const intervalMs = 1000 / 30;
    const timer = window.setInterval(() => {
      const elapsed = audioCtx.currentTime - startAudioTime;
      if (elapsed < 0) {
        renderVideoFrame(ctx, 0, beats, timeline, imagesByShotId, style, {
          showKoreanSubtitles,
          scriptAuthor,
        });
        return;
      }
      if (elapsed >= 30.05) {
        window.clearInterval(timer);
        renderVideoFrame(ctx, 30, beats, timeline, imagesByShotId, style, {
          showKoreanSubtitles,
          scriptAuthor,
        });
        onProgress?.(100);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        return;
      }
      renderVideoFrame(ctx, elapsed, beats, timeline, imagesByShotId, style, {
        showKoreanSubtitles,
        scriptAuthor,
      });
      onProgress?.(Math.min(99, Math.round((elapsed / 30) * 100)));
    }, intervalMs);
  });
}
