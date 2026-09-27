import { useState, useMemo } from 'react';
import { Play, RotateCcw, AlertTriangle, Sigma } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea
} from 'recharts';
import type { LabMeta } from '../../data/labsData.js';
import { Card, CardHeader, Button, Badge } from '../ui.js';
import { LabQuestionSection } from './LabQuestionSection.js';
import { LabAiInsightBox } from './LabAiInsightBox.js';

interface StandardDeviationLabProps {
  lab: LabMeta;
  onComplete: () => void;
}

const PRESETS = [
  { label: 'Prompt Default (10, 12, 14, 16, 18)', data: '10, 12, 14, 16, 18' },
  { label: 'Tightly Clustered (Low Spread)', data: '14, 14, 14, 15, 15' },
  { label: 'Widely Spread (High Spread)', data: '2, 8, 14, 20, 26' },
  { label: 'With Outlier (80)', data: '10, 12, 14, 16, 80' },
];

export function StandardDeviationLab({ lab, onComplete }: StandardDeviationLabProps) {
  const [rawInput, setRawInput] = useState('10, 12, 14, 16, 18');
  const [isSample, setIsSample] = useState(true); // true = sample (n-1), false = population (n)
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<{
    values: number[];
    count: number;
    mean: number;
    deviations: { val: number; dev: number; sqDev: number }[];
    sumSqDev: number;
    variance: number;
    stdDev: number;
    typeLabel: string;
    divisorDesc: string;
    min: number;
    max: number;
    range: number;
    explanation: string;
  } | null>(null);

  function parseInput(inputStr: string): number[] {
    const tokens = inputStr.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
    const parsed: number[] = [];
    for (const t of tokens) {
      const num = Number(t);
      if (isNaN(num)) throw new Error(`Invalid numeric input: "${t}".`);
      parsed.push(num);
    }
    if (parsed.length < 2) {
      throw new Error('Please enter at least 2 numbers to compute standard deviation.');
    }
    return parsed;
  }

  function runExperiment(inputToProcess = rawInput, useSample = isSample) {
    setError(null);
    try {
      const nums = parseInput(inputToProcess);
      const count = nums.length;
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / count;

      const deviations = nums.map((val) => {
        const dev = val - mean;
        const sqDev = dev * dev;
        return { val, dev, sqDev };
      });

      const sumSqDev = deviations.reduce((a, b) => a + b.sqDev, 0);
      const denominator = useSample ? count - 1 : count;
      const variance = sumSqDev / denominator;
      const stdDev = Math.sqrt(variance);

      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const range = max - min;

      const typeLabel = useSample ? 'Sample Standard Deviation (s)' : 'Population Standard Deviation (σ)';
      const divisorDesc = useSample ? `n - 1 = ${denominator} (Bessel's correction)` : `N = ${denominator}`;

      let explanation = `The ${typeLabel.toLowerCase()} is ${stdDev.toFixed(2)}. This means that on average, observations in this dataset deviate from the mean (${mean.toFixed(2)}) by approximately ${stdDev.toFixed(2)} units.`;
      if (stdDev < 2.0) {
        explanation += ` This dataset has low dispersion, meaning values are tightly packed around the average.`;
      } else if (stdDev > 10.0) {
        explanation += ` This dataset exhibits high dispersion and variability, indicating that data points are widely dispersed or contain extreme values.`;
      }

      setResults({
        values: nums,
        count,
        mean,
        deviations,
        sumSqDev,
        variance,
        stdDev,
        typeLabel,
        divisorDesc,
        min,
        max,
        range,
        explanation,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to process input values.');
      setResults(null);
    }
  }

  // Run automatically on first load
  useMemo(() => {
    runExperiment('10, 12, 14, 16, 18', true);
  }, []);

  const chartData = useMemo(() => {
    if (!results) return [];
    return results.values.map((v, i) => ({
      index: `Pt ${i + 1}`,
      value: v,
      mean: Number(results.mean.toFixed(2)),
    }));
  }, [results]);

  return (
    <div className="space-y-6">
      {/* Concept & Instructions */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-[16px] font-bold text-ink">Lab Concept: Standard Deviation & Variability</h3>
        <p className="mt-1 text-[13px] text-muted leading-relaxed">
          Standard deviation quantifies how far numbers spread out from their average. When observations are identical, standard deviation is <strong>0</strong>. As values spread farther apart, standard deviation increases.
        </p>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader
          title="Experiment Configuration"
          subtitle="Modify values and select calculation mode (Sample vs. Population)."
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRawInput('10, 12, 14, 16, 18');
                setIsSample(true);
                runExperiment('10, 12, 14, 16, 18', true);
              }}
            >
              <RotateCcw size={14} className="mr-1" /> Reset Default
            </Button>
          }
        />
        <div className="p-4 sm:p-5 space-y-4">
          {/* Presets */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[12px] font-semibold text-subtle uppercase tracking-wider mr-1">Presets:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setRawInput(preset.data);
                  runExperiment(preset.data, isSample);
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

          {/* Sample vs Population Selector */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <span className="text-[13px] font-semibold text-ink">Calculation Mode:</span>
            <label className="flex items-center gap-1.5 text-[13px] text-ink cursor-pointer">
              <input
                type="radio"
                name="sdType"
                checked={isSample}
                onChange={() => {
                  setIsSample(true);
                  runExperiment(rawInput, true);
                }}
                className="accent-[color:var(--primary)]"
              />
              <span>Sample Standard Deviation (divisor: <strong>n - 1</strong>)</span>
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-ink cursor-pointer">
              <input
                type="radio"
                name="sdType"
                checked={!isSample}
                onChange={() => {
                  setIsSample(false);
                  runExperiment(rawInput, false);
                }}
                className="accent-[color:var(--primary)]"
              />
              <span>Population Standard Deviation (divisor: <strong>N</strong>)</span>
            </label>
          </div>

          {/* Data input */}
          <div>
            <label htmlFor="sdInput" className="block text-[13px] font-medium text-ink mb-1.5">
              Enter numbers (comma or space separated):
            </label>
            <div className="flex gap-2">
              <input
                id="sdInput"
                type="text"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="e.g. 10, 12, 14, 16, 18"
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
          {/* Key Metrics Row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                {results.typeLabel.split('(')[0]}
              </p>
              <p className="text-[28px] font-bold text-ink mt-1 font-mono">
                {results.stdDev.toFixed(2)}
              </p>
              <div className="mt-1">
                <Badge tone="primary">
                  <Sigma size={11} className="mr-1" />
                  {isSample ? 's (Sample)' : 'σ (Population)'}
                </Badge>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Variance (s² or σ²)</p>
              <p className="text-[28px] font-bold text-ink mt-1 font-mono">{results.variance.toFixed(2)}</p>
              <p className="text-[11px] text-muted mt-0.5">Sum of Squares ÷ ({results.divisorDesc})</p>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Arithmetic Mean (x̄)</p>
              <p className="text-[28px] font-bold text-ink mt-1 font-mono">{results.mean.toFixed(2)}</p>
              <p className="text-[11px] text-muted mt-0.5">N = {results.count} data points</p>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Data Range (Max - Min)</p>
              <p className="text-[28px] font-bold text-ink mt-1 font-mono">{results.range.toFixed(2)}</p>
              <p className="text-[11px] text-muted mt-0.5">Min: {results.min} | Max: {results.max}</p>
            </Card>
          </div>

          {/* Visualization: Spread from Mean with ±1σ Band */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Spread Analysis & 1-Standard-Deviation Band"
              subtitle={`Individual observations with Mean (${results.mean.toFixed(1)}) and shaded 1σ variation band [${(results.mean - results.stdDev).toFixed(1)} to ${(results.mean + results.stdDev).toFixed(1)}].`}
            />
            <div className="p-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="index" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                    <YAxis
                      domain={[
                        Math.max(0, Math.floor(results.min - results.stdDev)),
                        Math.ceil(results.max + results.stdDev * 0.5)
                      ]}
                      tick={{ fontSize: 12, fill: 'var(--muted)' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const pt = payload[0]!.payload;
                          const dev = pt.value - results.mean;
                          return (
                            <div className="rounded border border-border bg-surface p-2 shadow-md text-[12px]">
                              <p className="font-semibold text-ink">{pt.index}: Value = {pt.value}</p>
                              <p className="text-muted mt-0.5">Distance from mean: {dev >= 0 ? `+${dev.toFixed(2)}` : dev.toFixed(2)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* 1 Sigma Band Area */}
                    <ReferenceArea
                      y1={Math.max(0, results.mean - results.stdDev)}
                      y2={results.mean + results.stdDev}
                      fill="#0284c7"
                      fillOpacity={0.10}
                    />
                    {/* Mean Reference Line */}
                    <ReferenceLine
                      y={results.mean}
                      stroke="#0284c7"
                      strokeWidth={2}
                      label={{ value: `Mean: ${results.mean.toFixed(1)}`, fill: '#0284c7', fontSize: 11, position: 'insideTopRight' }}
                    />
                    {/* Upper 1-Sigma Bound */}
                    <ReferenceLine
                      y={results.mean + results.stdDev}
                      stroke="#64748b"
                      strokeDasharray="3 3"
                      label={{ value: `+1σ: ${(results.mean + results.stdDev).toFixed(1)}`, fill: '#64748b', fontSize: 10, position: 'right' }}
                    />
                    {/* Lower 1-Sigma Bound */}
                    <ReferenceLine
                      y={Math.max(0, results.mean - results.stdDev)}
                      stroke="#64748b"
                      strokeDasharray="3 3"
                      label={{ value: `-1σ: ${(results.mean - results.stdDev).toFixed(1)}`, fill: '#64748b', fontSize: 10, position: 'right' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ r: 5, fill: 'var(--primary)', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Step-by-Step Mathematical Calculation Table */}
              <div className="mt-4">
                <p className="text-subtle font-semibold text-[11px] uppercase tracking-wider mb-2">
                  Step-by-Step Calculation Table:
                </p>
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-raised text-ink border-b border-border">
                      <tr>
                        <th className="px-3 py-2">Data Point (x)</th>
                        <th className="px-3 py-2">Mean (x̄)</th>
                        <th className="px-3 py-2">Deviation (x - x̄)</th>
                        <th className="px-3 py-2 font-mono">Squared Deviation (x - x̄)²</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {results.deviations.map((row, idx) => (
                        <tr key={idx} className="hover:bg-raised/40">
                          <td className="px-3 py-1.5 font-medium">{row.val}</td>
                          <td className="px-3 py-1.5 text-muted">{results.mean.toFixed(2)}</td>
                          <td className="px-3 py-1.5 font-mono text-muted">
                            {row.dev >= 0 ? `+${row.dev.toFixed(2)}` : row.dev.toFixed(2)}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-ink font-semibold">
                            {row.sqDev.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-raised/70 font-semibold border-t-2 border-border">
                        <td colSpan={3} className="px-3 py-2 text-right">Sum of Squared Deviations (SS):</td>
                        <td className="px-3 py-2 font-mono text-primary font-bold">{results.sumSqDev.toFixed(2)}</td>
                      </tr>
                      <tr className="bg-raised/70 font-semibold">
                        <td colSpan={3} className="px-3 py-2 text-right">
                          Variance = SS ÷ ({results.divisorDesc}):
                        </td>
                        <td className="px-3 py-2 font-mono text-accent font-bold">{results.variance.toFixed(2)}</td>
                      </tr>
                      <tr className="bg-raised font-bold">
                        <td colSpan={3} className="px-3 py-2 text-right">
                          Standard Deviation = √Variance:
                        </td>
                        <td className="px-3 py-2 font-mono text-primary text-[15px] font-bold">
                          {results.stdDev.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>

          {/* Explanation of the Result with AI Enhancement and Built-in Fallback */}
          <LabAiInsightBox
            labId="standard-deviation"
            results={{ ...results, isSample }}
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
