import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

function sanitizeSvg(rawSvg: string): string {
  return rawSvg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

function extractErrorDetails(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'Gemini API key permission issue. Please check Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit reached briefly. Please wait a moment and try again.',
    };
  }
  return {
    status: 500,
    message: raw || 'An unexpected server error occurred.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Full 4-beat Storyboard Generation endpoint (text/JSON only)
  app.post('/api/storyboard/generate', async (req: Request, res: Response) => {
    try {
      const { expressions, scene } = req.body ?? {};
      if (!Array.isArray(expressions) || expressions.length === 0) {
        res.status(400).json({ error: 'At least one expression is required.' });
        return;
      }
      if (!scene || typeof scene.place !== 'string') {
        res.status(400).json({ error: 'Scene settings are required.' });
        return;
      }

      const expressionList = expressions
        .filter((e: { expression?: string }) => typeof e?.expression === 'string' && e.expression.trim())
        .map(
          (e: { expression: string; meaning?: string; movie?: string }, i: number) =>
            `${i + 1}. "${e.expression.trim()}" (Korean meaning: ${e.meaning || ''}, Movie: ${e.movie || ''})`
        )
        .join('\n');

      const ai = getAiClient();
      const prompt = `Write a 30-second, 4-beat short animated film script for Korean university students learning everyday English.

SCENE SETTINGS:
- Place: ${scene.place}
- Characters: ${scene.characters}
- Situation: ${scene.situation}
- Visual Style: ${scene.style}

EXPRESSIONS TO INCLUDE (EVERY SINGLE ONE MUST APPEAR VERBATIM IN THE SPOKEN DIALOGUE):
${expressionList}

STRICT RULES:
1. Split into 4 beats:
   - Beat 0: Hook (0-7s)
   - Beat 1: Problem (7-15s)
   - Beat 2: Turn (15-23s)
   - Beat 3: Close (23-30s)
2. Keep the TOTAL spoken dialogue across all 4 beats between 60 and 70 words (around 14-18 words per beat so each line fits naturally in 7-8 seconds).
3. Use every expression above naturally and accurately in the spoken lines. If an expression ends with "...", you may use the phrase naturally without trailing dots if mid-sentence (e.g., "the thing is").
4. Keep characters, outfits, and colors consistent across every beat's sceneDescription.
5. Family-friendly, warm, relatable tone. No real people, celebrities, copyrighted movie characters, or brand logos.
6. Each beat should have 2 spoken dialogue lines alternating between the two characters (e.g. Alex and Mia).`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a friendly short-film writer for Korean university students learning everyday English. Always output valid JSON matching the schema.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                beats: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      sceneDescription: { type: Type.STRING },
                      lines: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            speaker: { type: Type.STRING },
                            text: { type: Type.STRING },
                            koreanTranslation: { type: Type.STRING },
                            emotion: { type: Type.STRING },
                          },
                          required: ['speaker', 'text', 'koreanTranslation', 'emotion'],
                        },
                      },
                    },
                    required: ['label', 'sceneDescription', 'lines'],
                  },
                },
              },
              required: ['beats'],
            },
          },
        })
      );

      const jsonStr = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed.beats) || parsed.beats.length !== 4) {
        res.status(502).json({ error: 'Model did not return 4 storyboard beats.' });
        return;
      }

      res.json({ beats: parsed.beats });
    } catch (err) {
      const details = extractErrorDetails(err);
      res.status(details.status).json({ error: details.message });
    }
  });

  // 2. Regenerate Single Beat endpoint (text/JSON only)
  app.post('/api/storyboard/regenerate-beat', async (req: Request, res: Response) => {
    try {
      const { beatIndex, currentBeats, expressions, scene, targetExpressions } = req.body ?? {};
      if (typeof beatIndex !== 'number' || beatIndex < 0 || beatIndex > 3) {
        res.status(400).json({ error: 'beatIndex must be 0, 1, 2, or 3.' });
        return;
      }

      const labels = ['Hook (0-7s)', 'Problem (7-15s)', 'Turn (15-23s)', 'Close (23-30s)'];
      const otherBeatsSummary = Array.isArray(currentBeats)
        ? currentBeats
            .map(
              (b: { label?: string; sceneDescription?: string; lines?: { speaker: string; text: string }[] }, idx: number) =>
                idx === beatIndex
                  ? `Beat ${idx + 1} (${labels[idx]}): [REGENERATE THIS BEAT]`
                  : `Beat ${idx + 1} (${labels[idx]}): Scene="${b.sceneDescription}" | Lines=${(b.lines || [])
                      .map((l) => `${l.speaker}: ${l.text}`)
                      .join(' / ')}`
            )
            .join('\n')
        : '';

      const mustInclude =
        Array.isArray(targetExpressions) && targetExpressions.length > 0
          ? targetExpressions.join(', ')
          : (expressions || []).map((e: { expression: string }) => e.expression).slice(0, 1).join(', ');

      const ai = getAiClient();
      const prompt = `Regenerate ONLY Beat ${beatIndex + 1} (${labels[beatIndex]}) of this 30-second short film while preserving continuity with the other beats.

SCENE SETTINGS:
- Place: ${scene?.place || ''}
- Characters: ${scene?.characters || ''}
- Situation: ${scene?.situation || ''}

STORY CONTEXT:
${otherBeatsSummary}

REQUIREMENTS FOR BEAT ${beatIndex + 1}:
1. Keep spoken dialogue concise (~14-18 words across 2 lines) so total 4-beat dialogue stays around 60-70 words.
2. You MUST include these expression(s) verbatim in Beat ${beatIndex + 1}'s dialogue: ${mustInclude || 'none required'}.
3. Keep the same character names, outfits, and visual setting.
4. Family-friendly, natural everyday English for Korean university learners.`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a friendly short-film writer. Regenerate a single beat cleanly in JSON.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sceneDescription: { type: Type.STRING },
                lines: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      speaker: { type: Type.STRING },
                      text: { type: Type.STRING },
                      koreanTranslation: { type: Type.STRING },
                      emotion: { type: Type.STRING },
                    },
                    required: ['speaker', 'text', 'koreanTranslation', 'emotion'],
                  },
                },
              },
              required: ['sceneDescription', 'lines'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      if (!parsed.sceneDescription || !Array.isArray(parsed.lines)) {
        res.status(502).json({ error: 'Model returned an incomplete beat.' });
        return;
      }

      res.json({ beat: parsed });
    } catch (err) {
      const details = extractErrorDetails(err);
      res.status(details.status).json({ error: details.message });
    }
  });

  // 3. Silent Scene Visual Generator (visual parameters only, no audio/speech fields)
  app.post('/api/scene-visual', async (req: Request, res: Response) => {
    try {
      const { sceneDescription, place, characters, style, beatLabel } = req.body ?? {};
      if (typeof sceneDescription !== 'string' || !sceneDescription.trim()) {
        res.status(400).json({ error: 'sceneDescription is required.' });
        return;
      }

      const ai = getAiClient();
      const prompt = `Create a rich, expressive, family-friendly 1280x720 silent SVG visual illustration for a short film scene.

BEAT: ${beatLabel || 'Scene'}
VISUAL STYLE: ${style || '2D animation'}
PLACE: ${place || ''}
CHARACTERS & OUTFITS (MUST MATCH CONSISTENTLY): ${characters || ''}
ACTION IN THIS BEAT: ${sceneDescription}

SVG REQUIREMENTS:
- Root tag MUST be <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">.
- Include layered background, furniture/props, soft lighting gradients (<defs><linearGradient>/<radialGradient>), and expressive stylized characters wearing their exact described outfits and colors.
- NO text, NO speech bubbles, NO watermarks, NO logos, NO <script> tags.
- Leave the bottom 130px slightly darker/calmer so white subtitles remain legible.
- Match the requested style ("${style}") through colors, stroke weights, filters, or textures.`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'Output ONLY raw valid SVG markup starting with <svg and ending with </svg>. Do not wrap in markdown code fences.',
          },
        })
      );

      let svg = (response.text ?? '').trim();
      svg = svg.replace(/^```(?:svg|xml)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const startIdx = svg.indexOf('<svg');
      const endIdx = svg.lastIndexOf('</svg>');
      if (startIdx === -1 || endIdx === -1) {
        res.status(502).json({ error: 'Failed to generate valid scene illustration.' });
        return;
      }

      svg = sanitizeSvg(svg.slice(startIdx, endIdx + 6));
      res.json({ svg });
    } catch (err) {
      const details = extractErrorDetails(err);
      res.status(details.status).json({ error: details.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Time to Say Goodbye server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
