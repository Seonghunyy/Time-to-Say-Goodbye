import { RotateCcw } from 'lucide-react';
import { AppStep } from '../types';

interface StepHeaderProps {
  currentStep: AppStep;
  onSelectStep: (step: AppStep) => void;
  onResetPreset: () => void;
}

const STEPS: { id: AppStep; label: string; shortLabel: string; num: number }[] = [
  { id: 'input', label: '1. Expressions', shortLabel: '1. Words', num: 1 },
  { id: 'scene', label: '2. Scene', shortLabel: '2. Scene', num: 2 },
  { id: 'storyboard', label: '3. Storyboard', shortLabel: '3. Script', num: 3 },
  { id: 'video', label: '4. Video', shortLabel: '4. Video', num: 4 },
  { id: 'final', label: '5. Final', shortLabel: '5. Final', num: 5 },
];

export function StepHeader({
  currentStep,
  onSelectStep,
  onResetPreset,
}: StepHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-[#F7F6F2]/92 backdrop-blur-md border-b border-[#E5E3DC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onSelectStep('input')}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#1E242B] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3B5B7D] rounded"
          >
            Time to Say Goodbye
          </button>

          <nav
            aria-label="Creation steps"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {STEPS.map((step) => {
              const active = step.id === currentStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelectStep(step.id)}
                  className={`py-2 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3B5B7D] ${
                    active
                      ? 'border-[#3B5B7D] text-[#1E242B] font-semibold'
                      : 'border-transparent text-[#5A6572] hover:text-[#1E242B]'
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onResetPreset}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl border border-[#D8D5CC] bg-white text-sm font-medium text-[#1E242B] hover:bg-[#F0EFEA] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B5B7D]"
            >
              <RotateCcw className="w-4 h-4 text-[#5A6572]" />
              <span>Reset Preset</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom step bar: compact <= 60px to preserve >= 85% open viewport */}
      <nav
        aria-label="Mobile step navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E3DC] pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-14 px-1">
          {STEPS.map((step) => {
            const active = step.id === currentStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectStep(step.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'text-[#3B5B7D] font-semibold bg-[#3B5B7D]/8'
                    : 'text-[#5A6572]'
                }`}
              >
                <span className="tabular-nums">{step.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
