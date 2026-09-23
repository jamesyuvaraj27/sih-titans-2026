import { useState, type ChangeEvent } from 'react';
import { CheckCircle2, FileText, Filter, ShieldAlert, Upload, XCircle } from 'lucide-react';
import { api, getToken, post, type GenerationSummary, type QuestionItem } from '../lib/api.js';
import { num, pct } from '../lib/format.js';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Spinner, Td, Th } from '../components/ui.js';

interface Ingest {
  documentId: string; pages: number; chunks: number;
  tagged: { competencyId: string; nameEn: string; chunks: number; terms: string[] }[];
}

export function Trainer() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(20);
  const [provider, setProvider] = useState<'default' | 'mock' | 'gemini' | 'ollama'>('default');

  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [items, setItems] = useState<QuestionItem[] | null>(null);
  const [filter, setFilter] = useState<'CANDIDATE' | 'REJECTED' | 'APPROVED'>('CANDIDATE');
  const [busy, setBusy] = useState<null | 'upload' | 'generate'>(null);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  }

  async function upload() {
    if (!file) return;
    setBusy('upload'); setError(null); setSummary(null); setItems(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title || file.name);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Upload failed');
      setIngest(body);
    } catch (e: any) { setError(e?.message ?? 'Upload failed'); }
    finally { setBusy(null); }
  }

  async function generate() {
    if (!ingest) return;
    setBusy('generate'); setError(null);
    try {
      const s = await post<GenerationSummary>(`/documents/${ingest.documentId}/generate`, {
        target, ...(provider === 'default' ? {} : { provider }),
      });
      setSummary(s);
      setItems(await api<QuestionItem[]>(`/documents/${ingest.documentId}/questions`));
    } catch (e: any) { setError(e?.message ?? 'Generation failed'); }
    finally { setBusy(null); }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    await post(`/questions/${id}/review`, { action });
    if (ingest) setItems(await api<QuestionItem[]>(`/documents/${ingest.documentId}/questions`));
  }

  const shown = (items ?? []).filter((q) => q.status === filter);
  const counts = {
    CANDIDATE: (items ?? []).filter((q) => q.status === 'CANDIDATE').length,
    APPROVED: (items ?? []).filter((q) => q.status === 'APPROVED').length,
    REJECTED: (items ?? []).filter((q) => q.status === 'REJECTED').length,
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Upload &amp; generate</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-muted">
          Turn a training document into an assessment. Every generated question is checked against eight
          deterministic gates before a human ever sees it, and the questions that fail are kept, with their
          reasons, rather than quietly discarded.
        </p>
      </header>

      {error && <Alert tone="critical" title="Something went wrong">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="1 · Upload material" subtitle="PDF, PPTX, DOCX, TXT or Markdown, up to 25 MB" />
            <div className="space-y-3 p-4">
              <Field label="File" htmlFor="file" required>
                <input
                  id="file" type="file" onChange={onPick}
                  accept=".pdf,.pptx,.docx,.txt,.md"
                  className="block w-full text-[13px] text-muted file:mr-3 file:min-h-[36px] file:cursor-pointer file:rounded file:border file:border-border-strong file:bg-surface file:px-3 file:text-[13px] file:font-medium file:text-ink"
                />
              </Field>
              <Field label="Title" htmlFor="title" hint="Shown on every citation generated from this document.">
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Stratified Sampling (NSSTA)" />
              </Field>
              <Button onClick={upload} disabled={!file} loading={busy === 'upload'} className="w-full">
                <Upload size={16} aria-hidden="true" />Extract and tag
              </Button>
            </div>
          </Card>

          {ingest && (
            <Card>
              <CardHeader
                title="2 · Competency tagging"
                subtitle={`${ingest.pages} pages → ${ingest.chunks} chunks, each keeping its page number`}
              />
              <div className="p-4">
                <p className="text-[12px] text-muted">
                  Tagging runs on a local embedding — nothing was sent anywhere. The matched terms are shown
                  so you can see why each competency was chosen.
                </p>
                <ul className="mt-3 space-y-2">
                  {ingest.tagged.slice(0, 6).map((t) => (
                    <li key={t.competencyId} className="rounded border border-border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">{t.nameEn}</span>
                        <Badge tone="neutral">{t.chunks} chunk{t.chunks === 1 ? '' : 's'}</Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-subtle">matched on: {t.terms.join(', ') || '—'}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {ingest && (
            <Card>
              <CardHeader title="3 · Generate questions" />
              <div className="space-y-3 p-4">
                <Field label="Target accepted questions" htmlFor="target"
                  hint="Generation over-produces by ~1.6× because the gate is expected to reject 15–45%.">
                  <Input id="target" type="number" min={4} max={60} value={target}
                    onChange={(e) => setTarget(Number(e.target.value))} />
                </Field>
                <Field label="Generator" htmlFor="provider"
                  hint="Ollama runs a local model — the air-gapped deployment mode.">
                  <Select id="provider" value={provider} onChange={(e) => setProvider(e.target.value as any)}>
                    <option value="default">Server default</option>
                    <option value="gemini">Gemini (hosted)</option>
                    <option value="ollama">Ollama (local, sovereign)</option>
                    <option value="mock">Offline template generator</option>
                  </Select>
                </Field>
                <Button onClick={generate} loading={busy === 'generate'} className="w-full">Generate</Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {busy === 'generate' && <Card><Spinner label="Generating and gating candidates" /></Card>}

          {summary && (
            <Card>
              <CardHeader
                title="Generation report"
                subtitle={`${summary.candidates} candidates in ${num(summary.elapsedMs)} ms · ${summary.provider}${summary.sovereign ? ' · nothing left this machine' : ''} · prompt ${summary.promptVersion}`}
              />
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Accepted</p>
                  <p className="tnum mt-1 text-[26px] font-bold leading-none text-success">{summary.accepted}</p>
                </div>
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Rejected by the gate</p>
                  <p className="tnum mt-1 text-[26px] font-bold leading-none text-critical">{summary.rejected}</p>
                </div>
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Rejection rate</p>
                  <p className="tnum mt-1 text-[26px] font-bold leading-none text-ink">{pct(summary.rejectionRate * 100)}</p>
                  <p className={`mt-0.5 text-[12px] ${summary.rejectionRateHealthy ? 'text-success' : 'text-moderate'}`}>
                    {summary.rejectionRateHealthy ? 'within the healthy 15–45% band' : 'outside the healthy 15–45% band'}
                  </p>
                </div>
              </div>

              {summary.byReason.length > 0 && (
                <div className="border-t border-border px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <ShieldAlert size={14} aria-hidden="true" />Why candidates failed
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {summary.byReason.map((r) => (
                      <li key={r.code}>
                        <Badge tone="neutral" title={r.label}>
                          <span className="tnum font-semibold">{r.code}</span> {r.label} · {r.count}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-muted">
                    A generator without a rejection rate is not an assessment engine. These candidates are kept
                    so a trainer can see what was thrown away and why.
                  </p>
                </div>
              )}
            </Card>
          )}

          {items && (
            <Card>
              <CardHeader
                title="4 · Review"
                subtitle="Only approved questions can ever appear in an assessment or move a competency record."
                action={
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-subtle" aria-hidden="true" />
                    <label className="sr-only" htmlFor="status-filter">Filter by status</label>
                    <Select id="status-filter" value={filter} onChange={(e) => setFilter(e.target.value as any)}
                      className="min-h-[36px] w-auto text-[13px]">
                      <option value="CANDIDATE">Awaiting review ({counts.CANDIDATE})</option>
                      <option value="APPROVED">Approved ({counts.APPROVED})</option>
                      <option value="REJECTED">Rejected by the gate ({counts.REJECTED})</option>
                    </Select>
                  </div>
                }
              />

              {shown.length === 0 ? (
                <EmptyState title="Nothing in this bucket">
                  {filter === 'CANDIDATE' ? 'Every candidate has been reviewed.' : 'No items with this status.'}
                </EmptyState>
              ) : (
                <ul className="divide-y divide-border">
                  {shown.map((q) => (
                    <li key={q.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="primary">{q.competency.nameEn}</Badge>
                        <Badge tone="neutral">{q.bloom}</Badge>
                        <Badge tone="neutral" title={`Cold-start heuristic score ${num(q.difficultyScore, 2)}`}>{q.difficulty}</Badge>
                        <Badge tone="neutral">page {q.page}</Badge>
                      </div>

                      <p className="mt-2 text-[15px] font-medium leading-relaxed text-ink">{q.stem}</p>

                      <ol className="mt-2 space-y-1">
                        {q.options.map((opt, i) => (
                          <li key={i} className={`flex gap-2 text-[13px] ${i === q.correctIndex ? 'font-medium text-ink' : 'text-muted'}`}>
                            <span className="font-semibold text-subtle">{String.fromCharCode(65 + i)}.</span>
                            <span>{opt}</span>
                            {i === q.correctIndex && <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" aria-label="Correct answer" />}
                          </li>
                        ))}
                      </ol>

                      <figure className="mt-3 rounded border border-border bg-surface p-3">
                        <figcaption className="flex items-center gap-1.5 text-[12px] font-medium text-subtle">
                          <FileText size={13} aria-hidden="true" />Source · {q.headingPath || 'untitled section'} · page {q.page}
                        </figcaption>
                        <blockquote className="mt-1.5 border-l-2 border-primary pl-3 text-[13px] italic leading-relaxed text-muted">
                          {q.sourceQuote}
                        </blockquote>
                      </figure>

                      <details className="mt-2">
                        <summary className="cursor-pointer text-[12px] font-medium text-primary">Gate results (8 checks)</summary>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full border-collapse">
                            <caption className="sr-only">Quality gate results for this generated question</caption>
                            <thead><tr><Th>Check</Th><Th>Result</Th><Th>Detail</Th></tr></thead>
                            <tbody>
                              {q.gateResults.map((g) => (
                                <tr key={g.code}>
                                  <Td><span className="tnum font-semibold">{g.code}</span> {g.label}</Td>
                                  <Td>
                                    {g.passed
                                      ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={13} aria-hidden="true" />pass</span>
                                      : <span className="inline-flex items-center gap-1 text-critical"><XCircle size={13} aria-hidden="true" />fail</span>}
                                  </Td>
                                  <Td className="text-muted">{g.detail}</Td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>

                      {q.rejectReason && (
                        <p className="mt-2 text-[12px] text-critical">Rejected: {q.rejectReason}</p>
                      )}

                      {q.status === 'CANDIDATE' && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => review(q.id, 'approve')}>Approve</Button>
                          <Button size="sm" variant="secondary" onClick={() => review(q.id, 'reject')}>Reject</Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {!ingest && !busy && (
            <Card>
              <EmptyState title="Upload a document to begin">
                Try <code>server/samples/stratified-sampling-nssta.pdf</code> — a five-page NSSTA-style note on
                stratified sampling that exercises the whole pipeline.
              </EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
