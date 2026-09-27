import { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle, RotateCcw, Sparkles, Lightbulb, RefreshCw } from 'lucide-react';
import type { PracticeQuestion } from '../../data/labsData.js';
import { Card, CardHeader, Button, Badge } from '../ui.js';
import { post } from '../../lib/api.js';

interface LabQuestionSectionProps {
  questions: PracticeQuestion[];
  onAllAnswered?: (score: number) => void;
}

export function LabQuestionSection({ questions, onAllAnswered }: LabQuestionSectionProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [hints, setHints] = useState<Record<string, { text: string; source: 'gemini' | 'fallback' }>>({});
  const [loadingHint, setLoadingHint] = useState<string | null>(null);

  async function handleGetHint(qId: string, questionText: string) {
    setLoadingHint(qId);
    try {
      const res = await post<any>('/learner/lab/explain', {
        labId: 'practice-question',
        mode: 'hint',
        questionContext: { question: questionText },
      });
      setHints((prev) => ({
        ...prev,
        [qId]: { text: res.data.explanation, source: res.source },
      }));
    } catch {
      setHints((prev) => ({
        ...prev,
        [qId]: {
          text: 'Pedagogical Hint: Think about how extreme outliers or sample variance calculations affect this statistical concept.',
          source: 'fallback',
        },
      }));
    } finally {
      setLoadingHint(null);
    }
  }

  function handleSelect(questionId: string, optionIdx: number) {
    if (submitted[questionId]) return;
    const nextAnswers = { ...selectedAnswers, [questionId]: optionIdx };
    const nextSubmitted = { ...submitted, [questionId]: true };
    setSelectedAnswers(nextAnswers);
    setSubmitted(nextSubmitted);

    // If all questions are now answered, trigger completion
    if (Object.keys(nextSubmitted).length === questions.length) {
      let correct = 0;
      for (const q of questions) {
        if (nextAnswers[q.id] === q.correctIndex) correct++;
      }
      onAllAnswered?.(correct);
    }
  }

  function handleReset() {
    setSelectedAnswers({});
    setSubmitted({});
  }

  const answeredCount = Object.keys(submitted).length;
  const correctCount = questions.filter((q) => selectedAnswers[q.id] === q.correctIndex).length;

  return (
    <Card className="mt-8 overflow-hidden shadow-sm">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-primary" />
            <span>Lab Practice & Conceptual Check</span>
          </div>
        }
        subtitle="Test your conceptual understanding of this experiment's results."
        action={
          answeredCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge tone={correctCount === questions.length ? 'success' : 'primary'}>
                {correctCount} / {questions.length} Correct
              </Badge>
              <Button size="sm" variant="ghost" onClick={handleReset} title="Reset all questions">
                <RotateCcw size={14} className="mr-1" /> Reset
              </Button>
            </div>
          )
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {questions.map((q, qIdx) => {
          const isSubmitted = !!submitted[q.id];
          const selected = selectedAnswers[q.id];
          const isCorrect = selected === q.correctIndex;

          return (
            <div
              key={q.id}
              className={`rounded-lg border p-4 transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'border-success/40 bg-success/5'
                    : 'border-critical/40 bg-critical/5'
                  : 'border-border bg-surface'
              }`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised font-mono text-[12px] font-bold text-ink border border-border">
                    {qIdx + 1}
                  </span>
                  <p className="font-semibold text-ink text-[14px] leading-snug pt-0.5">
                    {q.question}
                  </p>
                </div>

                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={() => handleGetHint(q.id, q.question)}
                    disabled={loadingHint === q.id}
                    className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover bg-primary-soft/50 border border-primary/20 px-2 py-0.5 rounded cursor-pointer"
                  >
                    {loadingHint === q.id ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <Lightbulb size={11} />
                    )}
                    <span>Hint</span>
                  </button>
                )}
              </div>

              {hints[q.id] && !isSubmitted && (
                <div className="mt-2.5 ml-8 rounded bg-primary-soft/30 border border-primary/20 p-2.5 text-[12px] text-ink">
                  <p className="font-semibold text-primary flex items-center gap-1 text-[11px] mb-0.5">
                    <Sparkles size={11} /> {hints[q.id]?.source === 'gemini' ? 'AI Hint' : 'STATINTEL Hint'}:
                  </p>
                  <p className="text-muted leading-relaxed">{hints[q.id]?.text}</p>
                </div>
              )}

              <div className="mt-3 space-y-2 pl-8">
                {q.options.map((option, optIdx) => {
                  const isSelected = selected === optIdx;
                  const isCorrectOpt = q.correctIndex === optIdx;

                  let optionStyle = 'border-border bg-surface text-ink hover:border-primary/50 hover:bg-primary-soft/30 cursor-pointer';

                  if (isSubmitted) {
                    if (isCorrectOpt) {
                      optionStyle = 'border-success bg-success/10 text-ink font-medium';
                    } else if (isSelected && !isCorrectOpt) {
                      optionStyle = 'border-critical bg-critical/10 text-critical font-medium line-through';
                    } else {
                      optionStyle = 'border-border/50 bg-surface/50 text-subtle opacity-70';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelect(q.id, optIdx)}
                      disabled={isSubmitted}
                      className={`w-full rounded-md border p-2.5 text-left text-[13px] transition-all flex items-center justify-between gap-3 ${optionStyle}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-subtle">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <span>{option}</span>
                      </div>

                      {isSubmitted && isCorrectOpt && (
                        <CheckCircle2 size={16} className="text-success shrink-0" />
                      )}
                      {isSubmitted && isSelected && !isCorrectOpt && (
                        <XCircle size={16} className="text-critical shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback and Explanation */}
              {isSubmitted && (
                <div className="mt-3 pl-8">
                  <div
                    className={`rounded p-3 text-[13px] leading-relaxed border ${
                      isCorrect
                        ? 'border-success/30 bg-success/10 text-ink'
                        : 'border-critical/30 bg-critical/10 text-ink'
                    }`}
                  >
                    <p className="font-semibold flex items-center gap-1.5 mb-1">
                      {isCorrect ? (
                        <>
                          <CheckCircle2 size={15} className="text-success" />
                          <span className="text-success">Correct!</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={15} className="text-critical" />
                          <span className="text-critical">Incorrect.</span>
                        </>
                      )}
                    </p>
                    <p className="text-muted text-[12px]">{q.explanation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
