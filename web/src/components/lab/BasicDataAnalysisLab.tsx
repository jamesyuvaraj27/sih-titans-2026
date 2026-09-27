import { useState, useMemo } from 'react';
import { Play, RotateCcw, Filter } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell
} from 'recharts';
import { DISTRICT_ANALYSIS_DATASET, type LabMeta } from '../../data/labsData.js';
import { Card, CardHeader, Button, Badge } from '../ui.js';
import { LabQuestionSection } from './LabQuestionSection.js';
import { LabAiInsightBox } from './LabAiInsightBox.js';

interface BasicDataAnalysisLabProps {
  lab: LabMeta;
  onComplete: () => void;
}

type MetricField = 'qualityScore' | 'returnRate' | 'completed' | 'sampleSize';
type Operation = 'average' | 'max' | 'min' | 'sum' | 'count';

export function BasicDataAnalysisLab({ lab, onComplete }: BasicDataAnalysisLabProps) {
  const [cadreFilter, setCadreFilter] = useState<'ALL' | 'SSS' | 'ISS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Verified' | 'Under Scrutiny'>('ALL');
  const [targetMetric, setTargetMetric] = useState<MetricField>('qualityScore');
  const [operation, setOperation] = useState<Operation>('average');

  const [activeAnalysis, setActiveAnalysis] = useState({
    cadre: 'ALL' as 'ALL' | 'SSS' | 'ISS',
    status: 'ALL' as 'ALL' | 'Verified' | 'Under Scrutiny',
    metric: 'qualityScore' as MetricField,
    op: 'average' as Operation,
  });

  function handleRun() {
    setActiveAnalysis({
      cadre: cadreFilter,
      status: statusFilter,
      metric: targetMetric,
      op: operation,
    });
  }

  function handleReset() {
    setCadreFilter('ALL');
    setStatusFilter('ALL');
    setTargetMetric('qualityScore');
    setOperation('average');
    setActiveAnalysis({
      cadre: 'ALL',
      status: 'ALL',
      metric: 'qualityScore',
      op: 'average',
    });
  }

  // Filter dataset based on active analysis configuration
  const filteredData = useMemo(() => {
    return DISTRICT_ANALYSIS_DATASET.filter((row) => {
      if (activeAnalysis.cadre !== 'ALL' && row.cadre !== activeAnalysis.cadre) return false;
      if (activeAnalysis.status !== 'ALL' && row.status !== activeAnalysis.status) return false;
      return true;
    });
  }, [activeAnalysis]);

  // Compute calculated values based on selected operation
  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const values = filteredData.map((r) => r[activeAnalysis.metric]);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);

    const maxRow = filteredData.find((r) => r[activeAnalysis.metric] === maxVal);
    const minRow = filteredData.find((r) => r[activeAnalysis.metric] === minVal);

    let calculatedValue = 0;
    let opName = '';
    switch (activeAnalysis.op) {
      case 'average':
        calculatedValue = avg;
        opName = 'Average (Mean)';
        break;
      case 'max':
        calculatedValue = maxVal;
        opName = 'Maximum Value';
        break;
      case 'min':
        calculatedValue = minVal;
        opName = 'Minimum Value';
        break;
      case 'sum':
        calculatedValue = sum;
        opName = 'Total Sum';
        break;
      case 'count':
        calculatedValue = count;
        opName = 'Record Count';
        break;
    }

    return {
      count,
      sum,
      avg,
      maxVal,
      minVal,
      maxRow,
      minRow,
      calculatedValue,
      opName,
    };
  }, [filteredData, activeAnalysis]);

  const metricLabel = useMemo(() => {
    switch (activeAnalysis.metric) {
      case 'qualityScore': return 'Audit Quality Score (1-100)';
      case 'returnRate': return 'Survey Return Rate (%)';
      case 'completed': return 'Households Surveyed';
      case 'sampleSize': return 'Allocated Sample Size';
    }
  }, [activeAnalysis.metric]);

  const explanation = useMemo(() => {
    if (!stats) return 'No records match the current filter criteria.';
    const metricStr = metricLabel.toLowerCase();

    if (activeAnalysis.op === 'average') {
      return `The calculated ${stats.opName.toLowerCase()} across the ${stats.count} filtered district returns is ${stats.calculatedValue.toFixed(2)}. ${
        activeAnalysis.metric === 'qualityScore' && stats.calculatedValue >= 85
          ? 'This indicates strong compliance with departmental scrutiny standards.'
          : activeAnalysis.metric === 'qualityScore'
          ? 'This signals that targeted quality-assurance training is needed in this cohort.'
          : ''
      }`;
    }
    if (activeAnalysis.op === 'max') {
      return `The ${stats.opName.toLowerCase()} is ${stats.calculatedValue} observed in ${stats.maxRow?.district} (${stats.maxRow?.cadre} cadre).`;
    }
    if (activeAnalysis.op === 'min') {
      return `The ${stats.opName.toLowerCase()} is ${stats.calculatedValue} in ${stats.minRow?.district} (Status: ${stats.minRow?.status}).`;
    }
    if (activeAnalysis.op === 'sum') {
      return `The cumulative sum for ${metricStr} is ${stats.calculatedValue.toLocaleString()} across ${stats.count} district units.`;
    }
    return `There are currently ${stats.calculatedValue} district records meeting your selected criteria.`;
  }, [stats, activeAnalysis, metricLabel]);

  return (
    <div className="space-y-6">
      {/* Concept & Instructions */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-[16px] font-bold text-ink">Lab Concept: Exploratory Data Analysis & Aggregation</h3>
        <p className="mt-1 text-[13px] text-muted leading-relaxed">
          Real-world statistical intelligence requires filtering datasets by criteria (cadre, status) and running targeted aggregations (Mean, Min, Max, Count) to pinpoint operational variances.
        </p>
      </div>

      {/* Interactive Controls Panel */}
      <Card>
        <CardHeader
          title="Analytical Operations & Filtering Controls"
          subtitle="Configure demographic filters and specify the analytical operation to compute."
          action={
            <Button size="sm" variant="ghost" onClick={handleReset}>
              <RotateCcw size={14} className="mr-1" /> Reset Filters
            </Button>
          }
        />
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Filter 1: Cadre */}
            <div>
              <label htmlFor="cadreSelect" className="block text-[12px] font-semibold text-subtle uppercase tracking-wider mb-1.5">
                Cadre Filter:
              </label>
              <select
                id="cadreSelect"
                value={cadreFilter}
                onChange={(e) => setCadreFilter(e.target.value as any)}
                className="min-h-[40px] w-full rounded border border-border-strong bg-raised px-3 text-[13px] text-ink focus:border-primary focus:outline-none"
              >
                <option value="ALL">All Cadres (SSS & ISS)</option>
                <option value="SSS">Subordinate Statistical Service (SSS)</option>
                <option value="ISS">Indian Statistical Service (ISS)</option>
              </select>
            </div>

            {/* Filter 2: Status */}
            <div>
              <label htmlFor="statusSelect" className="block text-[12px] font-semibold text-subtle uppercase tracking-wider mb-1.5">
                Verification Status:
              </label>
              <select
                id="statusSelect"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="min-h-[40px] w-full rounded border border-border-strong bg-raised px-3 text-[13px] text-ink focus:border-primary focus:outline-none"
              >
                <option value="ALL">All Records (12 Districts)</option>
                <option value="Verified">Verified Only</option>
                <option value="Under Scrutiny">Under Scrutiny Only</option>
              </select>
            </div>

            {/* Target Metric */}
            <div>
              <label htmlFor="metricSelect" className="block text-[12px] font-semibold text-subtle uppercase tracking-wider mb-1.5">
                Target Column:
              </label>
              <select
                id="metricSelect"
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value as any)}
                className="min-h-[40px] w-full rounded border border-border-strong bg-raised px-3 text-[13px] text-ink focus:border-primary focus:outline-none"
              >
                <option value="qualityScore">Audit Quality Score</option>
                <option value="returnRate">Survey Return Rate (%)</option>
                <option value="completed">Households Surveyed</option>
                <option value="sampleSize">Allocated Sample Size</option>
              </select>
            </div>

            {/* Analytical Operation */}
            <div>
              <label htmlFor="opSelect" className="block text-[12px] font-semibold text-subtle uppercase tracking-wider mb-1.5">
                Operation:
              </label>
              <select
                id="opSelect"
                value={operation}
                onChange={(e) => setOperation(e.target.value as any)}
                className="min-h-[40px] w-full rounded border border-border-strong bg-raised px-3 text-[13px] text-ink focus:border-primary focus:outline-none"
              >
                <option value="average">Calculate Average (Mean)</option>
                <option value="max">Find Maximum (Max)</option>
                <option value="min">Find Minimum (Min)</option>
                <option value="sum">Calculate Sum (Total)</option>
                <option value="count">Count Records</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button onClick={handleRun}>
              <Play size={15} className="mr-1.5" /> Run Analysis
            </Button>
          </div>
        </div>
      </Card>

      {/* Results Section */}
      {stats && (
        <div className="space-y-6">
          {/* Main Computed Result Hero Card */}
          <Card className="p-5 border border-primary/20 bg-primary-soft/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-primary">
                  {stats.opName} Result for {metricLabel}
                </p>
                <p className="text-[34px] font-bold text-ink mt-1 font-mono">
                  {activeAnalysis.op === 'average'
                    ? stats.calculatedValue.toFixed(2)
                    : activeAnalysis.op === 'count'
                    ? stats.calculatedValue
                    : stats.calculatedValue.toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge tone="primary">
                  <Filter size={11} className="mr-1" />
                  {stats.count} of {DISTRICT_ANALYSIS_DATASET.length} Districts Matching
                </Badge>
                {activeAnalysis.cadre !== 'ALL' && (
                  <Badge tone="neutral">Cadre: {activeAnalysis.cadre}</Badge>
                )}
              </div>
            </div>
          </Card>

          {/* KPI Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Average {metricLabel.split('(')[0]}</p>
              <p className="text-[22px] font-bold text-ink mt-1">{stats.avg.toFixed(1)}</p>
              <p className="text-[11px] text-muted mt-0.5">Across {stats.count} matching records</p>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Highest Performer (Max)</p>
              <p className="text-[22px] font-bold text-success mt-1">{stats.maxVal}</p>
              <p className="text-[11px] text-muted mt-0.5">{stats.maxRow?.district} ({stats.maxRow?.cadre})</p>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Lowest Performer (Min)</p>
              <p className="text-[22px] font-bold text-critical mt-1">{stats.minVal}</p>
              <p className="text-[11px] text-muted mt-0.5">{stats.minRow?.district} ({stats.minRow?.status})</p>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Cumulative Total (Sum)</p>
              <p className="text-[22px] font-bold text-ink mt-1">{stats.sum.toLocaleString()}</p>
              <p className="text-[11px] text-muted mt-0.5">Summed across filtered cohort</p>
            </Card>
          </div>

          {/* Bar Chart Comparison across Filtered Districts */}
          <Card className="overflow-hidden">
            <CardHeader
              title={`District Comparison: ${metricLabel}`}
              subtitle="Bar chart visual of the filtered dataset with benchmark threshold line."
            />
            <div className="p-4 sm:p-6">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredData} margin={{ top: 15, right: 30, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="district" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '6px', fontSize: '12px' }}
                    />
                    {activeAnalysis.metric === 'qualityScore' && (
                      <ReferenceLine
                        y={80}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: '80% Benchmark Target', fill: '#ef4444', fontSize: 10, position: 'top' }}
                      />
                    )}
                    <ReferenceLine
                      y={stats.avg}
                      stroke="var(--primary)"
                      strokeWidth={2}
                      label={{ value: `Cohort Mean: ${stats.avg.toFixed(1)}`, fill: 'var(--primary)', fontSize: 11, position: 'insideBottomRight' }}
                    />
                    <Bar dataKey={activeAnalysis.metric} name={metricLabel} radius={[4, 4, 0, 0]}>
                      {filteredData.map((entry, idx) => {
                        const isUnderperforming = activeAnalysis.metric === 'qualityScore' && entry.qualityScore < 80;
                        return (
                          <Cell
                            key={`cell-${idx}`}
                            fill={isUnderperforming ? '#dc2626' : 'var(--primary)'}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table */}
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-subtle font-semibold text-[11px] uppercase tracking-wider mb-2">
                  Matching District Records ({filteredData.length}):
                </p>
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-raised text-ink border-b border-border">
                      <tr>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">District</th>
                        <th className="px-3 py-2">Cadre</th>
                        <th className="px-3 py-2">Sample</th>
                        <th className="px-3 py-2">Completed</th>
                        <th className="px-3 py-2">Return Rate (%)</th>
                        <th className="px-3 py-2">Quality Score</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredData.map((row) => (
                        <tr key={row.id} className="hover:bg-raised/40">
                          <td className="px-3 py-1.5 font-mono text-muted">{row.id}</td>
                          <td className="px-3 py-1.5 font-medium text-ink">{row.district}</td>
                          <td className="px-3 py-1.5">
                            <span className="font-mono px-1.5 py-0.5 rounded bg-raised text-subtle text-[11px]">
                              {row.cadre}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-muted">{row.sampleSize}</td>
                          <td className="px-3 py-1.5 font-mono text-muted">{row.completed}</td>
                          <td className="px-3 py-1.5 font-mono font-medium">{row.returnRate.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 font-mono font-bold">
                            <span className={row.qualityScore >= 80 ? 'text-success' : 'text-moderate'}>
                              {row.qualityScore}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            <Badge tone={row.status === 'Verified' ? 'success' : 'moderate'}>
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>

          {/* Analysis Explanation & Findings with AI Enhancement */}
          <LabAiInsightBox
            labId="basic-data-analysis"
            results={{ ...stats, metric: activeAnalysis.metric }}
            dataset={filteredData}
            defaultExplanation={explanation}
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
