/**
 * Royalty-free soft lo-fi / electric-piano ambient background music synthesized via Web Audio API.
 * Plays at gentle ~14% volume so English dialogue always remains clear and prominent.
 */

// Calm late-night lo-fi progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
const CHORD_PROGRESSION_HZ: number[][] = [
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [164.81, 196.0, 246.94, 293.66], // Em7
  [146.83, 174.61, 220.0, 261.63], // Dm7
  [130.81, 164.81, 196.0, 246.94], // Cmaj7
];

export interface AmbientMusicController {
  stop: () => void;
  setEnabled: (enabled: boolean) => void;
}

/**
 * Starts live looping background electric-piano chords on the given AudioContext.
 */
export function startLiveAmbientMusic(
  audioCtx: AudioContext,
  initiallyEnabled: boolean
): AmbientMusicController {
  const masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(initiallyEnabled ? 0.14 : 0, audioCtx.currentTime);

  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(950, audioCtx.currentTime);
  lowpass.Q.setValueAtTime(0.7, audioCtx.currentTime);

  masterGain.connect(lowpass);
  lowpass.connect(audioCtx.destination);

  let chordIdx = 0;
  let stopped = false;

  const playChord = (freqs: number[], startAt: number, duration: number) => {
    if (stopped) return;
    freqs.forEach((freq, noteIdx) => {
      const osc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();

      // Soft Rhodes-like blend of sine & warm triangle
      osc.type = noteIdx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, startAt);

      const peak = noteIdx === 0 ? 0.22 : 0.14;
      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(peak, startAt + 0.35);
      noteGain.gain.exponentialRampToValueAtTime(peak * 0.65, startAt + duration * 0.7);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startAt);
      osc.stop(startAt + duration + 0.05);
    });
  };

  // Play initial chord immediately and schedule every 3.75 seconds (8 bars across 30s)
  playChord(CHORD_PROGRESSION_HZ[chordIdx % CHORD_PROGRESSION_HZ.length], audioCtx.currentTime + 0.05, 3.6);
  chordIdx++;

  const intervalId = window.setInterval(() => {
    if (stopped) return;
    const freqs = CHORD_PROGRESSION_HZ[chordIdx % CHORD_PROGRESSION_HZ.length];
    playChord(freqs, audioCtx.currentTime + 0.04, 3.6);
    chordIdx++;
  }, 3750);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(intervalId);
      try {
        masterGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.08);
        window.setTimeout(() => {
          try {
            masterGain.disconnect();
            lowpass.disconnect();
          } catch {
            // ignore
          }
        }, 250);
      } catch {
        // ignore
      }
    },
    setEnabled: (enabled: boolean) => {
      if (stopped) return;
      masterGain.gain.setTargetAtTime(enabled ? 0.14 : 0, audioCtx.currentTime, 0.08);
    },
  };
}

/**
 * Schedules 30 seconds of soft ambient electric-piano chords into a destination node (used during video export).
 */
export function scheduleAmbientMusicForExport(
  audioCtx: AudioContext,
  destination: AudioNode,
  startAudioTime: number,
  durationSec = 30
): void {
  const masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.14, startAudioTime);

  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(950, startAudioTime);

  masterGain.connect(lowpass);
  lowpass.connect(destination);

  const chordDur = 3.75;
  const totalChords = Math.ceil(durationSec / chordDur);

  for (let c = 0; c < totalChords; c++) {
    const t0 = startAudioTime + c * chordDur;
    const dur = Math.min(chordDur - 0.1, startAudioTime + durationSec - t0);
    if (dur <= 0.3) break;

    const freqs = CHORD_PROGRESSION_HZ[c % CHORD_PROGRESSION_HZ.length];
    freqs.forEach((freq, noteIdx) => {
      const osc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();
      osc.type = noteIdx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);

      const peak = noteIdx === 0 ? 0.22 : 0.14;
      noteGain.gain.setValueAtTime(0.0001, t0);
      noteGain.gain.exponentialRampToValueAtTime(peak, t0 + 0.35);
      noteGain.gain.exponentialRampToValueAtTime(peak * 0.6, t0 + dur * 0.72);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });
  }
}
