import { useState, useMemo } from 'react';
import { Play, RotateCcw, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';
import { VISUALIZATION_DATASETS, type LabMeta } from '../../data/labsData.js';
import { Card, CardHeader, Button, Badge } from '../ui.js';
import { LabQuestionSection } from './LabQuestionSection.js';
import { LabAiInsightBox } from './LabAiInsightBox.js';

interface DataVisualizationLabProps {
  lab: LabMeta;
  onComplete: () => void;
}

type DatasetKey = keyof typeof VISUALIZATION_DATASETS;
type ChartType = 'bar' | 'line' | 'area';

export function DataVisualizationLab({ lab, onComplete }: DataVisualizationLabProps) {
  const [selectedDatasetKey, setSelectedDatasetKey] = useState<DatasetKey>('state_coverage');
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('bar');
  const [showGrid, setShowGrid] = useState(true);

  // Active visualization configuration (updated when user clicks "Run / Update")
  const [renderedConfig, setRenderedConfig] = useState({
    datasetKey: 'state_coverage' as DatasetKey,
    chartType: 'bar' as ChartType,
    showGrid: true,
  });

  const dataset = VISUALIZATION_DATASETS[renderedConfig.datasetKey];

  function handleUpdate() {
    setRenderedConfig({
      datasetKey: selectedDatasetKey,
      chartType: selectedChartType,
      showGrid,
    });
  }

  function handleReset() {
    setSelectedDatasetKey('state_coverage');
    setSelectedChartType('bar');
    setShowGrid(true);
    setRenderedConfig({
      datasetKey: 'state_coverage',
      chartType: 'bar',
      showGrid: true,
    });
  }

  // Educational evaluation of whether the selected chart type fits the dataset
  const chartFitExplanation = useMemo(() => {
    const isTimeSeries = renderedConfig.datasetKey === 'monthly_cpi';
    const isCategorical = renderedConfig.datasetKey === 'state_coverage';
    const isContinuousFactor = renderedConfig.datasetKey === 'survey_complexity';

    if (isCategorical && renderedConfig.chartType === 'bar') {
      return 'Excellent choice! Bar charts are the gold standard for comparing discrete, unordered entities like States. The height/length of each bar gives an unambiguous proportional comparison.';
    }
    if (isCategorical && (renderedConfig.chartType === 'line' || renderedConfig.chartType === 'area')) {
      return 'Note on visualization: Connecting categorical states with a continuous line or area implies an underlying sequence or timeline that does not exist in real life. Bar charts are generally preferred for non-sequential categories.';
    }
    if (isTimeSeries && renderedConfig.chartType === 'line') {
      return 'Optimal visual encoding! Line charts excel at showing temporal trends (months, quarters, years), highlighting the velocity and direction of changes in price indices over time.';
    }
    if (isTimeSeries && renderedConfig.chartType === 'area') {
      return 'Area charts effectively emphasize total cumulative volume over time, making inflation growth feel tactile and continuous.';
    }
    if (isContinuousFactor && renderedConfig.chartType === 'line') {
      return 'Great choice! Showing interview duration against questionnaire length as a line clearly illustrates the progression and non-linear increase in field errors as complexity climbs.';
    }
    return 'The chart renders the series cleanly. Remember to match categorical variables to bars, and continuous temporal trends to lines.';
  }, [renderedConfig]);

  return (
    <div className="space-y-6">
      {/* Concept & Instructions */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-[16px] font-bold text-ink">Lab Concept: Selecting the Right Chart Type</h3>
        <p className="mt-1 text-[13px] text-muted leading-relaxed">
          Choosing an appropriate chart prevents data distortion. <strong>Bar charts</strong> excel at discrete categorical comparisons; <strong>Line charts</strong> emphasize velocity over time; and <strong>Area charts</strong> convey cumulative volume.
        </p>
      </div>

      {/* Interactive Controls */}
      <Card>
        <CardHeader
          title="Interactive Visualization Controls"
          subtitle="Select a statistical dataset and test different chart encodings."
          action={
            <Button size="sm" variant="ghost" onClick={handleReset}>
              <RotateCcw size={14} className="mr-1" /> Reset Default
            </Button>
          }
        />
        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Dataset Picker */}
            <div>
              <label htmlFor="datasetSelect" className="block text-[13px] font-medium text-ink mb-1.5">
                Select Predefined Dataset:
              </label>
              <select
                id="datasetSelect"
                value={selectedDatasetKey}
                onChange={(e) => setSelectedDatasetKey(e.target.value as DatasetKey)}
                className="min-h-[44px] w-full rounded border border-border-strong bg-raised px-3 text-[14px] text-ink focus:border-primary focus:outline-none"
              >
                {Object.entries(VISUALIZATION_DATASETS).map(([key, data]) => (
                  <option key={key} value={key}>
                    {data.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-subtle">
                {VISUALIZATION_DATASETS[selectedDatasetKey].description}
              </p>
            </div>

            {/* Chart Type Picker */}
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">
                Select Chart Type:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChartType('bar')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded border text-[12px] font-medium transition-all cursor-pointer ${
                    selectedChartType === 'bar'
                      ? 'border-primary bg-primary-soft text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-ink hover:bg-raised'
                  }`}
                >
                  <BarChart3 size={18} className="mb-1" />
                  <span>Bar Chart</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChartType('line')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded border text-[12px] font-medium transition-all cursor-pointer ${
                    selectedChartType === 'line'
                      ? 'border-primary bg-primary-soft text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-ink hover:bg-raised'
                  }`}
                >
                  <LineChartIcon size={18} className="mb-1" />
                  <span>Line Chart</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChartType('area')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded border text-[12px] font-medium transition-all cursor-pointer ${
                    selectedChartType === 'area'
                      ? 'border-primary bg-primary-soft text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-ink hover:bg-raised'
                  }`}
                >
                  <AreaChartIcon size={18} className="mb-1" />
                  <span>Area Chart</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
            <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="accent-[color:var(--primary)]"
              />
              <span>Display Background Grid Lines</span>
            </label>

            <Button onClick={handleUpdate}>
              <Play size={15} className="mr-1.5" /> Run / Update Visualization
            </Button>
          </div>
        </div>
      </Card>

      {/* Rendered Chart Canvas */}
      <Card className="overflow-hidden">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <span>{dataset.title}</span>
              <Badge tone="primary">
                {renderedConfig.chartType.toUpperCase()} CHART
              </Badge>
            </div>
          }
          subtitle={dataset.description}
        />
        <div className="p-4 sm:p-6">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderedConfig.chartType === 'bar' ? (
                <BarChart data={dataset.data} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                  {renderedConfig.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />}
                  <XAxis dataKey={dataset.xAxisKey} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {dataset.series.map((s) => (
                    <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              ) : renderedConfig.chartType === 'line' ? (
                <LineChart data={dataset.data} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                  {renderedConfig.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />}
                  <XAxis dataKey={dataset.xAxisKey} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {dataset.series.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: s.color, stroke: '#fff', strokeWidth: 1.5 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={dataset.data} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                  {renderedConfig.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />}
                  <XAxis dataKey={dataset.xAxisKey} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {dataset.series.map((s) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      fill={s.color}
                      fillOpacity={0.25}
                    />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Raw Data Table Preview */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-subtle font-semibold text-[11px] uppercase tracking-wider mb-2">
              Underlying Tabular Data Preview:
            </p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-raised text-ink border-b border-border">
                  <tr>
                    <th className="px-3 py-2 uppercase">{dataset.xAxisKey}</th>
                    {dataset.series.map((s) => (
                      <th key={s.key} className="px-3 py-2">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {dataset.data.map((row: any, rIdx) => (
                    <tr key={rIdx} className="hover:bg-raised/40">
                      <td className="px-3 py-1.5 font-sans font-medium text-ink">{row[dataset.xAxisKey]}</td>
                      {dataset.series.map((s) => (
                        <td key={s.key} className="px-3 py-1.5 text-muted">{row[s.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {/* Visual Fit Explanation with AI Enhancement */}
      <LabAiInsightBox
        labId="data-visualization"
        results={{ chartType: renderedConfig.chartType, datasetName: dataset.title }}
        dataset={dataset.data}
        defaultExplanation={chartFitExplanation}
      />

      {/* Practice Questions */}
      <LabQuestionSection
        questions={lab.practiceQuestions}
        onAllAnswered={() => onComplete()}
      />
    </div>
  );
}
