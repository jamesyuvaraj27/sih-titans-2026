import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth.js';
import { Alert, Button, Field, Input } from '../components/ui.js';

const DEMO = [
  ['anitha@mospi.gov.in', 'Senior Statistical Officer — the learner journey'],
  ['rajesh@nssta.gov.in', 'NSSTA Faculty — upload material, review questions'],
  ['admin@mospi.gov.in', 'Deputy Director — workforce view, all departments'],
  ['dept@ap.gov.in', 'Joint Director, AP — scoped to one department'],
  ['auditor@cag.gov.in', 'Audit Officer — read-only across the system'],
] as const;

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('anitha@mospi.gov.in');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="text-[22px] font-bold tracking-tight text-ink">SAMIKSHA</p>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            समीक्षा — Competency intelligence for India’s Official Statistical System
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {error && <Alert tone="critical" title="Could not sign in">{error}</Alert>}

            <Field label="Official email" htmlFor="email" required>
              <Input
                id="email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} required
              />
            </Field>

            <Field label="Password" htmlFor="password" required
              hint="Single sign-on is an OIDC provider configuration, not a rewrite — see docs/ADR-003.">
              <Input
                id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required
              />
            </Field>

            <Button type="submit" loading={busy} className="w-full">Sign in</Button>
          </form>

          <div className="mt-8 rounded border border-border bg-surface p-3">
            <p className="text-[12px] font-semibold text-ink">Demo accounts · password <code className="tnum">demo1234</code></p>
            <ul className="mt-2 space-y-1.5">
              {DEMO.map(([mail, role]) => (
                <li key={mail}>
                  <button
                    type="button"
                    onClick={() => { setEmail(mail); setPassword('demo1234'); }}
                    className="w-full cursor-pointer rounded px-1.5 py-1 text-left hover:bg-bg"
                  >
                    <span className="block text-[12px] font-medium text-primary">{mail}</span>
                    <span className="block text-[11px] text-subtle">{role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <aside className="hidden flex-col justify-center border-l border-border bg-surface px-10 lg:flex">
        <div className="max-w-md">
          <ShieldCheck size={26} className="text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-[26px] font-bold leading-tight text-ink">
            Every competency score here is computed, never stored.
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Scores are derived on demand from an append-only ledger of dated, weighted, decaying
            evidence. Any score can be replayed, explained and audited down to the individual
            assessment item that produced it — and no language model is ever in the scoring path.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            <div>
              <dt className="text-subtle">Evidence ledger</dt>
              <dd className="font-medium text-ink">Append-only, enforced in PostgreSQL</dd>
            </div>
            <div>
              <dt className="text-subtle">Generated questions</dt>
              <dd className="font-medium text-ink">Source-cited, gated, with a visible reject rate</dd>
            </div>
            <div>
              <dt className="text-subtle">Course integration</dt>
              <dd className="font-medium text-ink">Built to the Sunbird API contract iGOT runs on</dd>
            </div>
            <div>
              <dt className="text-subtle">Embeddings</dt>
              <dd className="font-medium text-ink">Local — no text leaves the machine</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
