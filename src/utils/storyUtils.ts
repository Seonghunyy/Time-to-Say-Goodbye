import { Beat, ExpressionItem, QuizQuestion, SceneSettings, SubtitleChunk } from '../types';
import { DEFAULT_BEATS, DEFAULT_SCENE } from '../data/preset';

export function buildExpressionVariants(expr: string): string[] {
  const trimmed = expr.trim();
  if (!trimmed) return [];
  const noTrailingDots = trimmed.replace(/\.{2,}$/, '').trim();
  const variants = new Set<string>([trimmed]);
  if (noTrailingDots && noTrailingDots.length >= 2) {
    variants.add(noTrailingDots);
  }
  return Array.from(variants);
}

export function doesTextContainExpression(text: string, expr: string): boolean {
  const lower = text.toLowerCase();
  return buildExpressionVariants(expr).some((variant) =>
    lower.includes(variant.toLowerCase())
  );
}

export function getMatchedExpressionIds(
  expressions: ExpressionItem[],
  beats: Beat[]
): Set<string> {
  const allDialogue = beats
    .flatMap((b) => b.lines.map((l) => l.text))
    .join(' ');
  const matched = new Set<string>();
  for (const item of expressions) {
    if (item.expression.trim() && doesTextContainExpression(allDialogue, item.expression)) {
      matched.add(item.id);
    }
  }
  return matched;
}

export function validateExpressions(expressions: ExpressionItem[]) {
  const nonEmpty = expressions.filter((e) => e.expression.trim().length > 0);
  const uniqueMovies = new Set(
    nonEmpty
      .map((e) => e.movie.trim().toLowerCase())
      .filter((m) => m.length > 0)
  );
  const tooFewExpressions = nonEmpty.length < 5;
  const tooFewMovies = uniqueMovies.size <= 1;

  return {
    count: nonEmpty.length,
    uniqueMovieCount: uniqueMovies.size,
    tooFewExpressions,
    tooFewMovies,
    hasWarning: tooFewExpressions || tooFewMovies,
  };
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function getStoryboardWordStats(beats: Beat[]) {
  let dialogueWords = 0;
  let speakerTags = 0;
  for (const beat of beats) {
    for (const line of beat.lines) {
      dialogueWords += countWords(line.text);
      if (line.text.trim()) speakerTags += 1;
    }
  }
  return {
    dialogueWords,
    totalWithSpeakers: dialogueWords + speakerTags,
  };
}

export function highlightExpressionsInText(
  text: string,
  expressions: ExpressionItem[]
): { text: string; matchedExpression?: ExpressionItem }[] {
  const candidates: { pattern: string; item: ExpressionItem }[] = [];
  for (const item of expressions) {
    for (const v of buildExpressionVariants(item.expression)) {
      candidates.push({ pattern: v, item });
    }
  }
  candidates.sort((a, b) => b.pattern.length - a.pattern.length);

  if (candidates.length === 0 || !text) {
    return [{ text }];
  }

  const escaped = candidates.map((c) =>
    c.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      const found = candidates.find(
        (c) => c.pattern.toLowerCase() === part.toLowerCase()
      );
      return found ? { text: part, matchedExpression: found.item } : { text: part };
    });
}

export function buildSubtitleChunksForLine(
  lineId: string,
  speaker: string,
  text: string,
  startSec: number,
  endSec: number,
  koreanTranslation?: string
): SubtitleChunk[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const rawClauses = clean
    .split(/(?<=[.!?])\s+|(?<=,)\s+(?=(?:but|and|so|yet|because|well|honestly|at least)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const thoughtLines: string[] = [];
  for (const clause of rawClauses) {
    if (clause.length <= 38) {
      thoughtLines.push(clause);
    } else {
      const words = clause.split(' ');
      const mid = Math.ceil(words.length / 2);
      const firstHalf = words.slice(0, mid).join(' ');
      const secondHalf = words.slice(mid).join(' ');
      if (firstHalf) thoughtLines.push(firstHalf);
      if (secondHalf) thoughtLines.push(secondHalf);
    }
  }

  const chunkGroups: string[][] = [];
  for (let i = 0; i < thoughtLines.length; i += 2) {
    const first = thoughtLines[i];
    const second = thoughtLines[i + 1];
    if (second) {
      chunkGroups.push([first, second]);
    } else {
      const words = first.split(' ');
      if (first.length > 34 && words.length >= 5) {
        const commaIdx = first.indexOf(',');
        if (commaIdx > 6 && commaIdx < first.length - 6) {
          chunkGroups.push([
            first.slice(0, commaIdx + 1).trim(),
            first.slice(commaIdx + 1).trim(),
          ]);
        } else {
          const mid = Math.ceil(words.length / 2);
          chunkGroups.push([
            words.slice(0, mid).join(' '),
            words.slice(mid).join(' '),
          ]);
        }
      } else {
        chunkGroups.push([first]);
      }
    }
  }

  const totalChars = chunkGroups.reduce(
    (sum, grp) => sum + grp.join(' ').length,
    0
  );
  const totalDur = Math.max(0.4, endSec - startSec);
  let cursor = startSec;

  return chunkGroups.map((lines, idx) => {
    const share =
      totalChars > 0
        ? (lines.join(' ').length / totalChars) * totalDur
        : totalDur / chunkGroups.length;
    const chunkStart = cursor;
    const chunkEnd =
      idx === chunkGroups.length - 1 ? endSec : Math.min(endSec, cursor + share);
    cursor = chunkEnd;
    return {
      lineId,
      speaker,
      lines,
      koreanLine: koreanTranslation?.trim() || undefined,
      startSec: chunkStart,
      endSec: chunkEnd,
    };
  });
}

export function isUsingDefaultBeatVisuals(beat: Beat, scene: SceneSettings): boolean {
  if (!beat.defaultImageUrl) return false;
  if (beat.customImageUrl) return false;
  const defaultBeat = DEFAULT_BEATS[beat.index];
  if (!defaultBeat) return false;
  const sameSceneDesc =
    beat.sceneDescription.trim() === defaultBeat.sceneDescription.trim();
  const samePlaceAndChars =
    scene.place.trim() === DEFAULT_SCENE.place.trim() &&
    scene.characters.trim() === DEFAULT_SCENE.characters.trim();
  return sameSceneDesc && samePlaceAndChars;
}

export function generateSrtContent(chunks: SubtitleChunk[]): string {
  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec - Math.floor(sec)) * 1000);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  };

  return chunks
    .map(
      (chunk, i) =>
        `${i + 1}\n${fmt(chunk.startSec)} --> ${fmt(chunk.endSec)}\n${chunk.lines.join('\n')}\n`
    )
    .join('\n');
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Builds a 3-question multiple-choice quiz testing the movie expressions used in the film.
 */
export function generateQuizQuestions(
  expressions: ExpressionItem[],
  beats: Beat[]
): QuizQuestion[] {
  const valid = expressions.filter(
    (e) => e.expression.trim().length > 0 && e.meaning.trim().length > 0
  );
  if (valid.length === 0) return [];

  const allLines = beats.flatMap((b) => b.lines);
  const picked = shuffleArray(valid).slice(0, 3);
  const fallbackMeanings = [
    '시간이 꽤 걸리다',
    '예상보다 훨씬 순조롭다',
    '마음이 놓여 안심되다',
    '아쉬움을 뒤로하고 떠나다',
  ];

  return picked.map((target, qIdx) => {
    const matchingLine = allLines.find((l) =>
      doesTextContainExpression(l.text, target.expression)
    );

    const distractors = shuffleArray(
      valid.filter((e) => e.id !== target.id).map((e) => e.meaning.trim())
    );
    const pool = [...distractors, ...fallbackMeanings].filter(
      (m) => m !== target.meaning.trim()
    );
    const uniqueDistractors = Array.from(new Set(pool)).slice(0, 3);
    const rawOptions = shuffleArray([target.meaning.trim(), ...uniqueDistractors]);
    const correctIndex = rawOptions.indexOf(target.meaning.trim());

    return {
      id: `quiz-${qIdx}-${target.id}`,
      prompt: `What does "${target.expression}" mean in Korean?`,
      contextLine: matchingLine
        ? `${matchingLine.speaker}: "${matchingLine.text}"`
        : undefined,
      options: rawOptions,
      correctIndex,
      explanation: `"${target.expression}" means "${target.meaning}" (from ${target.movie || 'Movie'}).`,
    };
  });
}
