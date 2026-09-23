import clsx from 'clsx';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { Gap, LedgerLine } from '../lib/api.js';
import { confidenceLabel, EVIDENCE_LABEL, fmtDate, levelLabel, monthsAgo, num, pct } from '../lib/format.js';
import { Badge, Td, Th } from './ui.js';

const PROF_VAR = ['--prof-0', '--prof-1', '--prof-2', '--prof-3', '--prof-4'];

/** Level as colour AND text, never colour alone. */
export function LevelBadge({ level, target }: { level: number; target?: number | null }) {
  const met = target == null || level >= target;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 rounded-sm border border-border-strong"
        style={{ background: `var(${PROF_VAR[Math.max(0, Math.min(4, level))]})` }}
      />
      <span className="text-[13px] font-medium text-ink">{levelLabel(level)}</span>
      {target != null && (
        <span className={clsx('text-[12px]', met ? 'text-success' : 'text-muted')}>
          {met ? '· meets target' : `· target L${target}`}
        </span>
      )}
    </span>
  );
}

export function ScoreWithConfidence({ score, level, confidence, target }: {
  score: number; level: number; confidence: number; target?: number | null;
}) {
  const c = confidenceLabel(confidence);
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-[34px] font-bold leading-none text-ink">{num(score, 1)}</span>
        <span className="text-[13px] text-subtle">/ 100</span>
      </div>
      <div className="mt-2"><LevelBadge level={level} target={target} /></div>
      <p className={clsx(
        'mt-1.5 flex items-start gap-1 text-[12px]',
        c.tone === 'low' ? 'text-moderate' : c.tone === 'medium' ? 'text-muted' : 'text-success',
      )}>
        {c.tone === 'low'
          ? <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          : <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />}
        <span>{c.text} ({num(confidence * 100)}%)</span>
      </p>
    </div>
  );
}

export function GapSeverityChip({ band }: { band: Gap['severityBand'] }) {
  const map = {
    CRITICAL: { tone: 'critical' as const, icon: <AlertOctagon size={12} aria-hidden="true" />, label: 'Critical' },
    MODERATE: { tone: 'moderate' as const, icon: <AlertTriangle size={12} aria-hidden="true" />, label: 'Moderate' },
    MINOR: { tone: 'minor' as const, icon: <Info size={12} aria-hidden="true" />, label: 'Minor' },
  }[band];
  return <Badge tone={map.tone} icon={map.icon}>{map.label}</Badge>;
}

/**
 * THE EVIDENCE LEDGER.
 *
 * The most important component in the product. Every column is a factor in the
 * score, and the contributions sum — through the saturating curve stated in the
 * footer — to the number on the card above. A jury member can check the
 * arithmetic on the screen with a calculator. That is the entire claim of the
 * product, rendered.
 */
export function EvidenceLedgerTable({ ledger, score }: { ledger: LedgerLine[]; score: number }) {
  const total = ledger.reduce((a, l) => a + l.contribution, 0);
  const recomputed = 100 * (1 - Math.exp(-Math.max(total, 0) / 1.6));

  if (ledger.length === 0) {
    return (
      <p className="px-4 py-6 text-[13px] text-muted">
        No evidence has been recorded against this competency yet, so the score is 0.
        Taking a diagnostic assessment is the fastest way to establish a baseline.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Evidence contributing to this competency score. Each row shows the evidence type weight,
            its quality, its relevance to this competency, its time decay, and the resulting contribution.
          </caption>
          <thead>
            <tr>
              <Th>Evidence</Th>
              <Th>Type</Th>
              <Th align="right">When</Th>
              <Th align="right">Quality</Th>
              <Th align="right">Weight</Th>
              <Th align="right">Relevance</Th>
              <Th align="right">Decay</Th>
              <Th align="right">Contribution</Th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.evidenceId} className="align-top">
                <Td>
                  <span className="text-ink">{l.summary}</span>
                  {l.relevance < 1 && (
                    <span className="mt-0.5 block text-[12px] text-subtle">
                      recorded against {l.sourceCompetency} — counted at {pct(l.relevance * 100)} relevance
                    </span>
                  )}
                </Td>
                <Td><span className="text-muted">{EVIDENCE_LABEL[l.kind] ?? l.kind}</span></Td>
                <Td align="right">
                  <span className="text-ink">{fmtDate(l.occurredAt)}</span>
                  <span className="block text-[12px] text-subtle">{monthsAgo(l.occurredAt)}</span>
                </Td>
                <Td align="right">{num(l.quality, 2)}</Td>
                <Td align="right">{num(l.weight, 2)}</Td>
                <Td align="right">{num(l.relevance, 2)}</Td>
                <Td align="right" className={l.decay < 0.5 ? 'text-moderate' : undefined}>{num(l.decay, 2)}</Td>
                <Td align="right" className="font-semibold">{num(l.contribution, 3)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <Td className="font-semibold">Total raw evidence</Td>
              <Td /><Td /><Td /><Td /><Td /><Td />
              <Td align="right" className="font-semibold">{num(total, 3)}</Td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t border-border bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
        <span className="font-semibold text-ink">How this becomes {num(score, 1)}.</span>{' '}
        Every row is <span className="tnum">weight × quality × relevance × decay</span>. Decay is{' '}
        <span className="tnum">2^(−months / half-life)</span>, so unused skill fades on its own. The raw
        total {num(total, 3)} is passed through a saturating curve,{' '}
        <span className="tnum">100 × (1 − e^(−raw / 1.6)) = {num(recomputed, 1)}</span>, which is why twenty
        shallow course completions cannot buy the score that one real assessment earns. No language model
        is involved at any point in this calculation.
      </p>
    </div>
  );
}

/** Compact competency row used in lists. */
export function CompetencyRow({ nameEn, area, level, target, score, confidence, onClick }: {
  nameEn: string; area: string; level: number; target?: number | null;
  score: number; confidence: number; onClick?: () => void;
}) {
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={clsx(
        'flex w-full min-w-0 items-center gap-3 border-b border-border px-4 py-2.5 text-left',
        onClick && 'cursor-pointer hover:bg-surface',
      )}
    >
      <span
        aria-hidden="true"
        className="h-8 w-1.5 shrink-0 rounded-sm"
        style={{ background: `var(${PROF_VAR[Math.max(0, Math.min(4, level))]})` }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{nameEn}</span>
        <span className="block truncate text-[12px] text-subtle">{area}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tnum block text-[14px] font-semibold text-ink">{num(score, 0)}</span>
        <span className="block text-[12px] text-subtle">
          {levelLabel(level)}{target != null && level < target ? ` → L${target}` : ''}
        </span>
      </span>
      {confidence < 0.4 && (
        <AlertTriangle size={14} className="shrink-0 text-moderate" aria-label="Low confidence score" />
      )}
    </Wrapper>
  );
}
