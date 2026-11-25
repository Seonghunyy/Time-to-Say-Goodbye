/**
 * Web Speech API (window.speechSynthesis) helpers for distinct male (Alex) and female (Mia) English voiceovers.
 */

const MALE_VOICE_HINTS = [
  'male',
  'david',
  'daniel',
  'alex',
  'fred',
  'arthur',
  'mark',
  'george',
  'ryan',
  'guy',
  'andrew',
  'christopher',
  'eric',
  'liam',
  'aaron',
  'matthew',
  'thomas',
  'oliver',
];

const FEMALE_VOICE_HINTS = [
  'female',
  'samantha',
  'victoria',
  'karen',
  'zira',
  'aria',
  'jenny',
  'hazel',
  'libby',
  'sonia',
  'tessa',
  'fiona',
  'moira',
  'kate',
  'emma',
  'olivia',
  'ava',
  'allison',
  'susan',
  'serena',
];

export interface VoicePair {
  maleVoice: SpeechSynthesisVoice | null;
  femaleVoice: SpeechSynthesisVoice | null;
  englishVoices: SpeechSynthesisVoice[];
}

let hasWarmedUp = false;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Warms up the browser's speechSynthesis engine with a silent zero-volume utterance
 * so the very first spoken word ("Our") is never clipped on cold start.
 */
export function warmUpWebSpeech(voicePair?: VoicePair): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    if (!hasWarmedUp && !window.speechSynthesis.speaking) {
      const primer = new SpeechSynthesisUtterance(' ');
      primer.lang = 'en-US';
      primer.volume = 0;
      primer.rate = 2;
      if (voicePair?.maleVoice) {
        primer.voice = voicePair.maleVoice;
      }
      window.speechSynthesis.speak(primer);
      hasWarmedUp = true;
    }
  } catch {
    // ignore browser autoplay restrictions before gesture
  }
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  const all = window.speechSynthesis.getVoices();
  const english = all.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return english.length > 0 ? english : all;
}

export function selectMaleAndFemaleVoices(
  voices: SpeechSynthesisVoice[],
  preferredMaleURI?: string,
  preferredFemaleURI?: string
): VoicePair {
  if (voices.length === 0) {
    return { maleVoice: null, femaleVoice: null, englishVoices: [] };
  }

  let maleVoice = preferredMaleURI
    ? voices.find((v) => v.voiceURI === preferredMaleURI) || null
    : null;
  let femaleVoice = preferredFemaleURI
    ? voices.find((v) => v.voiceURI === preferredFemaleURI) || null
    : null;

  if (!maleVoice) {
    maleVoice =
      voices.find((v) =>
        MALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint))
      ) || null;
  }

  if (!femaleVoice) {
    femaleVoice =
      voices.find(
        (v) =>
          v.voiceURI !== maleVoice?.voiceURI &&
          FEMALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint))
      ) || null;
  }

  if (!maleVoice) {
    maleVoice =
      voices.find((v) => v.voiceURI !== femaleVoice?.voiceURI) || voices[0];
  }
  if (!femaleVoice) {
    femaleVoice =
      voices.find((v) => v.voiceURI !== maleVoice?.voiceURI) || voices[0];
  }

  return { maleVoice, femaleVoice, englishVoices: voices };
}

export function isFemaleSpeaker(speaker: string): boolean {
  const s = speaker.trim().toLowerCase();
  return (
    s === 'mia' ||
    s.includes('mia') ||
    s.includes('female') ||
    s.includes('woman') ||
    s.includes('girl')
  );
}

export function speakLineWithWebSpeech(options: {
  text: string;
  speaker: string;
  rate?: number;
  muted?: boolean;
  voicePair: VoicePair;
  onStart?: () => void;
  onEnd?: () => void;
}): SpeechSynthesisUtterance | null {
  if (!isSpeechSynthesisSupported() || options.muted) return null;

  const female = isFemaleSpeaker(options.speaker);
  // Leading thin space / clean trim avoids occasional engine onset clipping on some OSes
  const utterance = new SpeechSynthesisUtterance(options.text.trim());
  utterance.lang = 'en-US';

  const chosenVoice = female
    ? options.voicePair.femaleVoice
    : options.voicePair.maleVoice;
  if (chosenVoice) {
    utterance.voice = chosenVoice;
  }

  utterance.pitch = female ? 1.15 : 0.86;
  utterance.rate = Math.max(0.85, Math.min(1.25, options.rate ?? (female ? 1.0 : 0.96)));
  utterance.volume = 1;

  if (options.onStart) utterance.onstart = options.onStart;
  if (options.onEnd) utterance.onend = options.onEnd;

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function cancelWebSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
  }
}
