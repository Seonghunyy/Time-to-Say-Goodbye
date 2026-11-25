import { AlertTriangle, ArrowRight, CheckCircle2, Film, Plus, Trash2 } from 'lucide-react';
import { ExpressionItem } from '../types';
import { validateExpressions } from '../utils/storyUtils';

interface InputScreenProps {
  expressions: ExpressionItem[];
  matchedIds: Set<string>;
  onChangeExpressions: (next: ExpressionItem[]) => void;
  onNext: () => void;
}

export function InputScreen({
  expressions,
  matchedIds,
  onChangeExpressions,
  onNext,
}: InputScreenProps) {
  const validation = validateExpressions(expressions);

  const handleFieldChange = (
    id: string,
    field: keyof Omit<ExpressionItem, 'id'>,
    value: string
  ) => {
    onChangeExpressions(
      expressions.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddExpression = () => {
    onChangeExpressions([
      ...expressions,
      {
        id: `exp-${Date.now()}`,
        expression: '',
        meaning: '',
        movie: '',
      },
    ]);
  };

  const handleRemoveExpression = (id: string) => {
    if (expressions.length <= 1) return;
    onChangeExpressions(expressions.filter((item) => item.id !== id));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-sm font-medium text-[#3B5B7D]">
            Step 1 of 5 · Movie English Expressions
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1E242B] text-balance">
            Collect at least 5 expressions from 2 or more movies
          </h1>
          <p className="text-base text-[#5A6572] leading-relaxed">
            Your custom 5-expression startup story is pre-loaded in the table below. Edit any row or add new movie expressions anytime.
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm text-[#5A6572] tabular-nums shrink-0">
          <span>{validation.count} expressions</span>
          <span aria-hidden="true">·</span>
          <span>{validation.uniqueMovieCount} movies</span>
        </div>
      </div>

      {validation.hasWarning && (
        <div
          role="alert"
          className="rounded-2xl border border-[#E6B86A] bg-[#FEF8EC] px-5 py-4 flex items-start gap-3 text-[#7C4A03]"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#B45309]" />
          <div className="space-y-1 text-base">
            <p className="font-semibold">
              {validation.tooFewExpressions && validation.tooFewMovies
                ? 'Need more expressions and movies'
                : validation.tooFewExpressions
                  ? 'Fewer than 5 expressions entered'
                  : 'Only 1 movie entered'}
            </p>
            <p className="text-sm leading-relaxed">
              {validation.tooFewExpressions &&
                'Please enter at least 5 English expressions so your 30-second clip has enough material. '}
              {validation.tooFewMovies &&
                'Please include expressions from at least 2 different movies for a richer mix.'}
            </p>
          </div>
        </div>
      )}

      {/* Structured 5-Expression Input Table (Desktop table + Mobile cards) */}
      <div className="rounded-2xl border border-[#E5E3DC] bg-white overflow-hidden">
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3.5 bg-[#FAF9F6] border-b border-[#E5E3DC] text-xs font-semibold uppercase tracking-wide text-[#5A6572]">
          <div className="col-span-1">#</div>
          <div className="col-span-4">English Expression</div>
          <div className="col-span-3">Korean Meaning (뜻)</div>
          <div className="col-span-2">Source Movie</div>
          <div className="col-span-2 text-right">Status / Action</div>
        </div>

        <div className="divide-y divide-[#ECEAE4]">
          {expressions.map((item, idx) => {
            const isMatched = matchedIds.has(item.id);
            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 lg:py-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-center"
              >
                <div className="lg:col-span-1 flex items-center justify-between lg:justify-start">
                  <span className="text-sm font-semibold text-[#5A6572] tabular-nums">
                    {idx + 1}
                  </span>
                  {expressions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExpression(item.id)}
                      aria-label={`Remove expression ${idx + 1}`}
                      className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[#5A6572] hover:text-[#B42318] hover:bg-[#FEF3F2] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="lg:col-span-4">
                  <label className="block space-y-1 lg:space-y-0">
                    <span className="lg:hidden text-xs font-medium text-[#5A6572]">
                      English Expression
                    </span>
                    <input
                      type="text"
                      value={item.expression}
                      onChange={(e) =>
                        handleFieldChange(item.id, 'expression', e.target.value)
                      }
                      placeholder="e.g. The thing is..."
                      className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-base font-medium text-[#1E242B] placeholder:text-[#8C96A3] focus:outline-none focus:border-[#3B5B7D] focus:bg-white transition-colors"
                    />
                  </label>
                </div>

                <div className="lg:col-span-3">
                  <label className="block space-y-1 lg:space-y-0">
                    <span className="lg:hidden text-xs font-medium text-[#5A6572]">
                      Korean Meaning (뜻)
                    </span>
                    <input
                      type="text"
                      value={item.meaning}
                      onChange={(e) =>
                        handleFieldChange(item.id, 'meaning', e.target.value)
                      }
                      placeholder="e.g. 사실은 말야"
                      className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-base text-[#1E242B] placeholder:text-[#8C96A3] focus:outline-none focus:border-[#3B5B7D] focus:bg-white transition-colors"
                    />
                  </label>
                </div>

                <div className="lg:col-span-2">
                  <label className="block space-y-1 lg:space-y-0">
                    <span className="lg:hidden text-xs font-medium text-[#5A6572] inline-flex items-center gap-1">
                      <Film className="w-3.5 h-3.5" />
                      <span>Source Movie</span>
                    </span>
                    <input
                      type="text"
                      value={item.movie}
                      onChange={(e) =>
                        handleFieldChange(item.id, 'movie', e.target.value)
                      }
                      placeholder="e.g. Notting Hill"
                      className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#D8D5CC] bg-[#FAF9F6] text-sm text-[#1E242B] placeholder:text-[#8C96A3] focus:outline-none focus:border-[#3B5B7D] focus:bg-white transition-colors"
                    />
                  </label>
                </div>

                <div className="lg:col-span-2 flex items-center justify-between lg:justify-end gap-2">
                  {item.expression.trim() ? (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        isMatched ? 'text-[#2D6A4F]' : 'text-[#9A6700]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{isMatched ? 'In script' : 'Unused'}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-[#8C96A3]">Empty</span>
                  )}

                  {expressions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExpression(item.id)}
                      aria-label={`Remove expression ${idx + 1}`}
                      className="hidden lg:inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#5A6572] hover:text-[#B42318] hover:bg-[#FEF3F2] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={handleAddExpression}
          className="inline-flex items-center justify-center gap-2 min-h-[52px] px-6 py-3 rounded-xl border border-[#D8D5CC] bg-white text-base font-medium text-[#1E242B] hover:bg-[#F0EFEA] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5 text-[#3B5B7D]" />
          <span>Add Expression</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center gap-2.5 min-h-[52px] px-8 py-3 rounded-xl bg-[#3B5B7D] text-white text-base font-semibold hover:bg-[#2F4A67] active:scale-[0.98] transition-all cursor-pointer"
        >
          <span>Next: Scene & Style</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
