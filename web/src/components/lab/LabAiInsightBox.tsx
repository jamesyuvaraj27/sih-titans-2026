import { useState } from 'react';
import { Sparkles, Info, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { post } from '../../lib/api.js';
import { Button } from '../ui.js';
import { useTranslation } from '../../lib/i18n/index.js';

interface LabAiInsightBoxProps {
  labId: string;
  results: any;
  dataset?: any;
  defaultExplanation: string;
}

interface AiResponse {
  data: {
    explanation: string;
    keyTakeaway?: string;
  };
  source: 'gemini' | 'fallback';
  notice: string;
  executionTimeMs?: number;
}

export function LabAiInsightBox({
  labId,
  results,
  dataset,
  defaultExplanation,
}: LabAiInsightBoxProps) {
  const { t } = useTranslation();
  const [aiData, setAiData] = useState<AiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAiExplanation = async (simulate = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await post<AiResponse>('/learner/lab/explain', {
        labId,
        results,
        dataset,
        mode: 'result_explanation',
        simulateFallback: simulate,
      });
      setAiData(res);
    } catch {
      // Graceful fallback to default explanation without crashing or throwing
      setError('Unable to fetch live insights. Displaying verified local explanation.');
    } finally {
      setLoading(false);
    }
  };

  const currentExplanation = aiData ? aiData.data.explanation : defaultExplanation;
  const isAi = aiData?.source === 'gemini';

  return (
    <div className="rounded-lg border border-primary/25 bg-primary-soft/30 p-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="font-semibold text-primary text-[14px] flex items-center gap-1.5">
          {isAi ? <Sparkles size={16} className="text-primary animate-pulse" /> : <Info size={16} />}
          <span>{isAi ? t('status.aiEnhanced', 'AI-Enhanced Explanation') : t('status.builtIn', 'STATINTEL Built-in Explanation')}</span>
        </h4>

        <div className="flex items-center gap-2">
          {aiData && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                isAi
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface border-border text-subtle'
              }`}
            >
              {isAi ? (
                <>
                  <Sparkles size={11} /> Gemini 2.0
                </>
              ) : (
                <>
                  <ShieldCheck size={11} /> Deterministic Local Engine
                </>
              )}
            </span>
          )}

          {!aiData ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => requestAiExplanation(false)}
              disabled={loading}
              className="text-[12px] h-7 px-2.5 py-0 border border-primary/30 text-primary hover:bg-primary-soft"
            >
              {loading ? (
                <>
                  <RefreshCw size={12} className="mr-1.5 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={12} className="mr-1.5 text-primary" /> {t('action.askAi', 'Ask AI for Insights')}
                </>
              )}
            </Button>
          ) : (
            <button
              onClick={() => setAiData(null)}
              className="text-[11px] text-subtle hover:text-ink underline cursor-pointer"
            >
              Show standard explanation
            </button>
          )}
        </div>
      </div>

      <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">
        {currentExplanation}
      </p>

      {aiData?.data.keyTakeaway && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-primary/90 bg-surface/70 px-2.5 py-1.5 rounded border border-primary/15">
          <CheckCircle2 size={13} className="shrink-0 text-primary" />
          <span>{aiData.data.keyTakeaway}</span>
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-subtle italic">
          {error}
        </p>
      )}
    </div>
  );
}
