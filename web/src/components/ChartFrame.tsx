import { useId, useState, type ReactNode } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { Button } from './ui.js';

/**
 * Every chart in STATINTEL is wrapped in this.
 *
 * Two WCAG requirements are satisfied structurally rather than by remembering:
 *   • a chart alone is not screen-reader navigable, so every chart ships with
 *     a real <table> alternative behind a one-key toggle;
 *   • the accessible name states the chart's INSIGHT, not its title —
 *     "your Statistical competencies average L2 against a target of L3" tells
 *     a screen-reader user something; "Radar chart" does not.
 *
 * It is also a good demo beat: press one button, the picture becomes a table.
 */
export function ChartFrame({
  title, insight, chart, table, action, minHeight = 260,
}: {
  title: string;
  /** One sentence stating what the chart shows. Becomes the aria-label. */
  insight: string;
  chart: ReactNode;
  table: ReactNode;
  action?: ReactNode;
  minHeight?: number;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();

  return (
    <section className="card min-w-0 overflow-hidden" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-[15px] font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{insight}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
          >
            {asTable
              ? <><BarChart3 size={14} aria-hidden="true" />View as chart</>
              : <><Table2 size={14} aria-hidden="true" />View as table</>}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {asTable ? (
          <div className="overflow-x-auto">{table}</div>
        ) : (
          <figure className="m-0" role="img" aria-label={`${title}. ${insight}`} style={{ minHeight }}>
            {chart}
          </figure>
        )}
      </div>
    </section>
  );
}
