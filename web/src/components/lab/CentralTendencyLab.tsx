import { useState, useMemo } from 'react';
import { Play, RotateCcw, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell
} from 'recharts';
import type { LabMeta } from '../../data/labsData.js';
import { Card, CardHeader, Button, Badge } from '../ui.js';
import { LabQuestionSection } from './LabQuestionSection.js';
import { LabAiInsightBox } from './LabAiInsightBox.js';

interface CentralTendencyLabProps {
  lab: LabMeta;
  onComplete: () => void;
}

const PRESETS = [
  { label: 'With Outlier (Default)', data: '20, 24, 25, 25, 28, 30, 95' },
  { label: 'Symmetric (Balanced)', data: '12, 14, 16, 16, 16, 18, 20' },
  { label: 'Bimodal (Two Peaks)', data: '10, 10, 15, 20, 25, 25' },
  { label: 'Severe Outlier', data: '5, 8, 9, 12, 14, 150' },
];

export function CentralTendencyLab({ lab, onComplete }: CentralTendencyLabProps) {
  const [rawInput, setRawInput] = useState('20, 24, 25, 25, 28, 30, 95');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    values: number[];
    count: number;
    sum: number;
    mean: number;
    median: number;
    modes: number[];
    isUniqueMode: boolean;
    min: number;
    max: number;
    skewness: 'Right-skewed' | 'Left-skewed' | 'Symmetric';
    explanation: string;
  } | null>(null);

  function parseInput(inputStr: string): number[] {
    const tokens = inputStr.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
    const parsed: number[] = [];
    for (const t of tokens) {
      const num = Number(t);
      if (isNaN(num)) throw new Error(`Invalid number found: "${t}". Please enter valid numeric values.`);
      parsed.push(num);
    }
    if (parsed.length < 2) {
      throw new Error('Please enter at least 2 numbers to calculate measures of central tendency.');
    }
    return parsed;
  }

  function runExperiment(inputToProcess = rawInput) {
    setError(null);
    try {
      const nums = parseInput(inputToProcess);
      const sorted = [...nums].sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);
      const mean = sum / count;

      // Median calculation
      let median = 0;
      const mid = Math.floor(count / 2);
      if (count % 2 === 1) {
        median = sorted[mid]!;
      } else {
        median = (sorted[mid - 1]! + sorted[mid]!) / 2;
      }

      // Mode calculation
      const freqMap: Record<number, number> = {};
      let maxFreq = 0;
      for (const n of sorted) {
        freqMap[n] = (freqMap[n] || 0) + 1;
        if (freqMap[n] > maxFreq) maxFreq = freqMap[n];
      }

      let modes: number[] = [];
      let isUniqueMode = false;
      if (maxFreq > 1) {
        modes = Object.keys(freqMap)
          .map(Number)
          .filter((k) => freqMap[k] === maxFreq);
        isUniqueMode = modes.length === 1;
      }

      // Skewness determination
      const diff = mean - median;
      const threshold = 0.5;
      let skewness: 'Right-skewed' | 'Left-skewed' | 'Symmetric' = 'Symmetric';
      let explanation = '';

      if (Math.abs(diff) < threshold) {
        skewness = 'Symmetric';
        explanation = `The distribution is approximately symmetric because the Mean (${mean.toFixed(2)}) is almost identical to the Median (${median.toFixed(2)}). Both metrics are good representations of the center.`;
      } else if (diff > 0) {
        skewness = 'Right-skewed';
        explanation = `The distribution is right-skewed (positively skewed). Notice how the extreme high value (${sorted[count - 1]}) pulled the Mean (${mean.toFixed(2)}) significantly higher than the Median (${median.toFixed(2)}). In this scenario, the Median gives a much more realistic picture of the "typical" observation.`;
      } else {
        skewness = 'Left-skewed';
        explanation = `The distribution is left-skewed (negatively skewed). The low values pulled the Mean (${mean.toFixed(2)}) below the Median (${median.toFixed(2)}).`;
      }

      setResults({
        values: sorted,
        count,
        sum,
        mean,
        median,
        modes,
        isUniqueMode,
        min: sorted[0]!,
        max: sorted[count - 1]!,
        skewness,
        explanation,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to process input values.');
      setResults(null);
    }
  }

  // Run automatically on first load with default data
  useMemo(() => {
    runExperiment('20, 24, 25, 25, 28, 30, 95');
  }, []);

  const chartData = useMemo(() => {
    if (!results) return [];
    return results.values.map((val, idx) => ({
      index: `#${idx + 1}`,
      value: val,
      isOutlier: Math.abs(val - results.median) > (results.values[results.count - 1]! - results.values[0]!) * 0.4,
    }));
  }, [results]);

  return (
    <div className="space-y-6">
      {/* Concept & Instructions */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-[16px] font-bold text-ink">Lab Concept: Understanding Central Tendency</h3>
        <p className="mt-1 text-[13px] text-muted leading-relaxed">
          Central tendency summarizes an entire dataset with a single representative score. While the <strong>Mean</strong> sums all numbers, the <strong>Median</strong> identifies the midpoint by position, making it impervious to extreme outliers.
        </p>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader
          title="Interactive Data Input"
          subtitle="Enter custom comma-separated numbers or pick a preset to see the effect on center measures."
          action={
            <Button size="sm" variant="ghost" onClick={() => { setRawInput('20, 24, 25, 25, 28, 30, 95'); runExperiment('20, 24, 25, 25, 28, 30, 95'); }}>
              <RotateCcw size={14} className="mr-1" /> Reset Default
            </Button>
          }
        />
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[12px] font-semibold text-subtle uppercase tracking-wider mr-1">Presets:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setRawInput(preset.data);
                  runExperiment(preset.data);
                }}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
                  rawInput === preset.data
                    ? 'border-primary bg-primary-soft text-primary font-semibold'
                    : 'border-border bg-surface text-ink hover:bg-raised'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="dataInput" className="block text-[13px] font-medium text-ink mb-1.5">
              Dataset Values (comma or space separated):
            </label>
            <div className="flex gap-2">
              <input
                id="dataInput"
                type="text"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="e.g. 10, 15, 20, 25, 100"
                className="min-h-[44px] flex-1 rounded border border-border-strong bg-raised px-4 text-[14px] text-ink font-mono focus:border-primary focus:outline-none"
              />
              <Button onClick={() => runExperiment()} className="shrink-0">
                <Play size={15} className="mr-1.5" /> Run Experiment
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-[12px] text-critical flex items-center gap-1.5">
                <AlertTriangle size={14} /> {error}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Results Section */}
      {results && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Arithmetic Mean (x̄)</p>
              <p className="text-[26px] font-bold text-ink mt-1">{results.mean.toFixed(2)}</p>
              <p className="text-[11px] text-muted mt-0.5">Sum: {results.sum} ÷ N: {results.count}</p>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Median (50th %ile)</p>
              <p className="text-[26px] font-bold text-ink mt-1">{results.median.toFixed(2)}</p>
              <p className="text-[11px] text-muted mt-0.5">Middle position in sorted array</p>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Mode (Most Frequent)</p>
              <p className="text-[24px] font-bold text-ink mt-1">
                {results.modes.length > 0 ? results.modes.join(', ') : 'None'}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                {results.modes.length > 0 ? (results.isUniqueMode ? 'Single unique mode' : 'Bimodal/Multimodal') : 'All values unique'}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Distribution Shape</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={results.skewness === 'Symmetric' ? 'neutral' : 'primary'}>
                  <TrendingUp size={12} className="mr-1" />
                  {results.skewness}
                </Badge>
              </div>
              <p className="text-[11px] text-muted mt-1.5">Mean - Median = {(results.mean - results.median).toFixed(2)}</p>
            </Card>
          </div>

          {/* Visualization of Data Points & Reference Lines */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Distribution Visualization"
              subtitle="Comparison of individual values with Mean (dashed sky blue line) and Median (solid slate line)."
            />
            <div className="p-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="index" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0]!.payload;
                          return (
                            <div className="rounded border border-border bg-surface p-2 shadow-md text-[12px]">
                              <p className="font-semibold text-ink">{data.index}: Value = {data.value}</p>
                              {data.isOutlier && <p className="text-critical font-medium mt-0.5">Potential Outlier</p>}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={results.mean}
                      stroke="#0284c7"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{ value: `Mean: ${results.mean.toFixed(1)}`, fill: '#0284c7', fontSize: 11, position: 'top' }}
                    />
                    <ReferenceLine
                      y={results.median}
                      stroke="#475569"
                      strokeWidth={2}
                      label={{ value: `Median: ${results.median.toFixed(1)}`, fill: '#475569', fontSize: 11, position: 'insideBottomRight' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.isOutlier ? '#ef4444' : 'var(--primary)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sorted Sequence & Mathematical Breakdown */}
              <div className="mt-4 rounded-lg border border-border bg-raised/50 p-3.5 text-[13px]">
                <p className="text-subtle font-medium text-[11px] uppercase tracking-wider mb-1">Sorted Array:</p>
                <div className="flex flex-wrap gap-1.5 font-mono text-[13px]">
                  {results.values.map((v, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded border ${
                        v === results.median
                          ? 'bg-success/15 border-success text-success font-bold'
                          : v === results.max && results.skewness === 'Right-skewed'
                          ? 'bg-critical/15 border-critical text-critical font-bold'
                          : 'bg-surface border-border text-ink'
                      }`}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Explanation of the Result with AI Enhancement and Built-in Fallback */}
          <LabAiInsightBox
            labId="mean-median-mode"
            results={results}
            dataset={results.values}
            defaultExplanation={results.explanation}
          />
        </div>
      )}

      {/* Practice Questions */}
      <LabQuestionSection
        questions={lab.practiceQuestions}
        onAllAnswered={() => onComplete()}
      />
    </div>
  );
}
