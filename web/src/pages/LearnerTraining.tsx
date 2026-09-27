import { useState } from 'react';
import { Clock, ShieldCheck, PlayCircle } from 'lucide-react';
import { Card, Badge, Button } from '../components/ui.js';

interface Course {
  id: string;
  name: string;
  provider: 'iGOT Karmayogi' | 'NSSTA TPAC';
  durationMins: number;
  level: string;
  competency: string;
  description: string;
  tpacFlagged?: boolean;
}

const COURSES: Course[] = [
  {
    id: 'CRS.IGOT.STAT.01',
    name: 'Survey Design & Sampling Frames (iGOT Karmayogi)',
    provider: 'iGOT Karmayogi',
    durationMins: 480,
    level: 'L2 Guided',
    competency: 'STAT.SURV.DESIGN (Survey Design)',
    description: 'Fundamental principles of multi-stage stratified sampling, area frame creation, and enumeration block demarcation.',
  },
  {
    id: 'CRS.NSSTA.TPAC.01',
    name: 'National Accounts Statistics & SUT Compilation (NSSTA TPAC)',
    provider: 'NSSTA TPAC',
    durationMins: 720,
    level: 'L3 Independent',
    competency: 'STAT.NAS.BASE (National Accounts)',
    description: 'Practical training on Supply-Use Tables (SUT), Gross Value Added (GVA) estimation, and base year revisions.',
    tpacFlagged: true,
  },
  {
    id: 'CRS.IGOT.TECH.02',
    name: 'Python for Statistical Computing & Pandas (iGOT Karmayogi)',
    provider: 'iGOT Karmayogi',
    durationMins: 600,
    level: 'L2 Guided',
    competency: 'TECH.PY.BASIC (Python)',
    description: 'Algorithmic data cleaning, reproducible survey pipelines, and tabular aggregation using modern Python libraries.',
  },
  {
    id: 'CRS.NSSTA.TPAC.02',
    name: 'Data Quality Frameworks & GSBPM Standards (NSSTA TPAC)',
    provider: 'NSSTA TPAC',
    durationMins: 360,
    level: 'L2 Guided',
    competency: 'STAT.DQ (Data Quality Frameworks)',
    description: 'Validation protocols, non-sampling error audit trails, and international standards alignment across survey phases.',
    tpacFlagged: true,
  },
  {
    id: 'CRS.IGOT.GOVN.03',
    name: 'Digital Governance & Government Data Privacy (iGOT Karmayogi)',
    provider: 'iGOT Karmayogi',
    durationMins: 300,
    level: 'L2 Guided',
    competency: 'GOVN.PRIVACY (Data Privacy & Governance)',
    description: 'Statutory compliance with DPDP Act, data anonymization protocols, and sovereign microdata access policies.',
  },
  {
    id: 'CRS.NSSTA.TPAC.03',
    name: 'Price Statistics & CPI Compilation Methods (NSSTA TPAC)',
    provider: 'NSSTA TPAC',
    durationMins: 420,
    level: 'L3 Independent',
    competency: 'STAT.PRICE (Price Statistics)',
    description: 'Consumer Price Index basket weighting, chained Laspeyres formulas, and state-level price tabulation rules.',
    tpacFlagged: true,
  },
];

export function LearnerTraining() {
  const [filter, setFilter] = useState<'ALL' | 'iGOT' | 'NSSTA'>('ALL');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const shown = COURSES.filter((c) => {
    if (filter === 'iGOT') return c.provider.includes('iGOT');
    if (filter === 'NSSTA') return c.provider.includes('NSSTA');
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-ink">Learning &amp; Training</h1>
              <span className="rounded border border-primary/30 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                SIH26101 Curriculum Hub
              </span>
            </div>
            <p className="mt-1 text-[13px] text-muted max-w-3xl">
              Access official training modules mapped to your competency gaps. Clearly distinguishing iGOT digital self-paced
              courses from NSSTA TPAC recommended in-person/nominated programs.
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filter === 'ALL' ? 'primary' : 'secondary'}
            onClick={() => setFilter('ALL')}
          >
            All Courses ({COURSES.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'iGOT' ? 'primary' : 'secondary'}
            onClick={() => setFilter('iGOT')}
          >
            iGOT Course Modules (3)
          </Button>
          <Button
            size="sm"
            variant={filter === 'NSSTA' ? 'primary' : 'secondary'}
            onClick={() => setFilter('NSSTA')}
          >
            NSSTA TPAC Programmes (3)
          </Button>
        </div>
      </header>

      {/* Integration Architecture Disclaimer */}
      <Card className="bg-raised/40 border-border p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
          <div className="text-[12px] text-muted space-y-1">
            <p className="font-semibold text-ink flex items-center gap-2">
              <span>National Integration Architecture</span>
              <span className="rounded bg-surface px-1.5 py-0.2 border border-border text-[10px] text-primary">
                Prototype / Integration-Ready
              </span>
            </p>
            <p className="leading-relaxed">
              STATINTEL integrates with government LMS infrastructure through standard REST adapters:
              <br />
              <code className="text-ink">STATINTEL → Integration Adapter → iGOT / NSSTA TPAC → Enrollment → Verification Webhook → Evidence Ledger</code>
              <br />
              (Live external API connections require institutional network authorization from DoPT and MoSPI).
            </p>
          </div>
        </div>
      </Card>

      {/* Course Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((c) => {
          const isIgot = c.provider.includes('iGOT');
          return (
            <Card key={c.id} className="p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] font-bold text-subtle bg-raised px-2 py-0.5 rounded border border-border">
                    {c.id}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${
                        isIgot
                          ? 'bg-primary-soft text-primary border-primary/25'
                          : 'bg-raised text-ink border-border'
                      }`}
                    >
                      {isIgot ? 'iGOT Module' : 'NSSTA TPAC'}
                    </span>
                    <Badge tone="neutral">{c.level}</Badge>
                  </div>
                </div>

                <h3 className="text-[16px] font-bold text-ink leading-snug">{c.name}</h3>
                <p className="mt-1 text-[12px] text-muted leading-relaxed">{c.description}</p>

                <div className="mt-3 rounded bg-surface/90 border border-border p-2.5 text-[12px]">
                  <p className="font-semibold text-primary text-[11px] uppercase tracking-wider mb-0.5">
                    Targeted Competency:
                  </p>
                  <p className="text-ink font-medium">{c.competency}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="flex items-center gap-1 text-[12px] text-subtle">
                  <Clock size={12} /> {Math.round(c.durationMins / 60)} hours curriculum
                </span>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedCourse(c)}
                  className="text-xs"
                >
                  <PlayCircle size={13} className="mr-1" /> View Syllabus
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Syllabus Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-md space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase text-subtle">{selectedCourse.id}</span>
                <h3 className="text-[17px] font-bold text-ink">{selectedCourse.name}</h3>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                className="text-muted hover:text-ink cursor-pointer p-1 text-[16px]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-muted">
              <p>{selectedCourse.description}</p>
              <div className="rounded border border-border bg-raised p-3 space-y-1.5">
                <p className="font-semibold text-ink">Curriculum Units:</p>
                <ul className="list-disc pl-4 space-y-1 text-[12px]">
                  <li>Unit 1: Theoretical foundation and statutory guidelines</li>
                  <li>Unit 2: Applied data tabulations &amp; sampling rules</li>
                  <li>Unit 3: Case studies from NSSO &amp; CSO official rounds</li>
                  <li>Unit 4: Milestone quiz &amp; competency verification</li>
                </ul>
              </div>

              <div className="rounded border border-primary/20 bg-primary-soft/40 p-2.5 text-[12px] text-ink">
                <strong>Status:</strong> Prototype / Integration-Ready module. Direct SSO launch from this sandbox is simulated for evaluation.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setSelectedCourse(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
