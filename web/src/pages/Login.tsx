import { useState, useEffect, type FormEvent } from 'react';
import { ShieldCheck, UserPlus, KeyRound, X, Info } from 'lucide-react';
import { useAuth } from '../lib/auth.js';
import { Alert, Button, Field, Input } from '../components/ui.js';
import { Register } from './Register.js';
import { api } from '../lib/api.js';

const VISIBLE_DEMO_ACCOUNTS = [
  {
    role: 'Learner',
    name: 'Vinay Kumar Bade',
    email: 'vinaykumarbade2007@gmail.com',
    purpose: 'Personalized competency journey',
  },
  {
    role: 'Trainer',
    name: 'Rajesh Sharma',
    email: 'rajesh@nssta.gov.in',
    purpose: 'Training materials, assessment generation and learner assessment',
  },
  {
    role: 'Administrator',
    name: 'Sunita Menon',
    email: 'admin@mospi.gov.in',
    purpose: 'Workforce analytics, capacity building and administration',
  },
] as const;

interface SsoStatus {
  configured: boolean;
  providerName: string;
  scope: string;
  guidance?: {
    requiredEnvVars: string[];
    standard: string;
    roleProvisioning: string;
  };
}

export function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('vinaykumarbade2007@gmail.com');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ssoStatus, setSsoStatus] = useState<SsoStatus | null>(null);
  const [showSsoModal, setShowSsoModal] = useState(false);

  useEffect(() => {
    api<SsoStatus>('/auth/sso/status')
      .then(setSsoStatus)
      .catch(() => setSsoStatus({ configured: false, providerName: 'Parichay / MeriPehchan (National SSO)', scope: 'openid' }));
  }, []);

  if (mode === 'register') {
    return (
      <Register
        onGoToLogin={(registeredEmail) => {
          setMode('login');
          if (registeredEmail) {
            setEmail(registeredEmail);
            setPassword('');
          }
        }}
      />
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  const handleSsoClick = () => {
    if (ssoStatus?.configured) {
      window.location.href = '/api/auth/sso/login';
    } else {
      setShowSsoModal(true);
    }
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <header className="mb-7">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">STATINTEL</h1>
            <p className="mt-1 text-[13px] font-medium text-primary">
              AI-Enabled Competency &amp; Learning Intelligence Platform
            </p>
            <p className="text-[12px] text-muted">
              for India's Official Statistical System
            </p>
          </header>

          {error && (
            <div className="mb-4">
              <Alert tone="critical">{error}</Alert>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Government or registered email" htmlFor="email">
              <Input
                id="email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} required
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <Input
                id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required
              />
            </Field>

            <Button type="submit" loading={busy} className="w-full">Sign in</Button>

            <div className="pt-2 flex items-center justify-between text-[13px]">
              <span className="text-muted">New member?</span>
              <button
                type="button"
                onClick={() => setMode('register')}
                className="font-semibold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <UserPlus size={14} /> Register
              </button>
            </div>
          </form>

          {/* Institutional SSO / OIDC Section */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="relative flex items-center justify-center mb-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <span className="relative bg-bg px-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                Or Institutional Access
              </span>
            </div>

            <button
              type="button"
              onClick={handleSsoClick}
              className="w-full flex items-center justify-between gap-2 rounded border border-border bg-surface px-3 py-2 text-left hover:bg-raised transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-primary shrink-0" />
                <div>
                  <span className="block text-[13px] font-medium text-ink">
                    Parichay / MeriPehchan (National SSO)
                  </span>
                  <span className="block text-[10px] text-subtle">
                    OpenID Connect (OIDC) standard
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  ssoStatus?.configured
                    ? 'bg-success/15 border-success/30 text-success'
                    : 'bg-raised border-border text-subtle'
                }`}
              >
                {ssoStatus?.configured ? 'Live SSO' : 'Configuration Required'}
              </span>
            </button>
          </div>

          {/* Clean 3-Role Demo Accounts */}
          <div className="mt-6 rounded border border-border bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">DEMO ACCESS</p>
              <span className="text-[11px] text-muted">Password: <code className="tnum font-mono font-semibold text-ink">demo1234</code></span>
            </div>
            <div className="mt-2.5 space-y-2">
              {VISIBLE_DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword('demo1234'); }}
                  className={`w-full text-left rounded p-2 transition-all border cursor-pointer ${
                    email === acc.email
                      ? 'border-primary/40 bg-primary-soft/30 shadow-xs'
                      : 'border-border/60 hover:bg-raised/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      {acc.role} Demo
                    </span>
                    <span className="text-[11px] font-medium text-ink truncate">{acc.name}</span>
                  </div>
                  <div className="text-[12px] font-mono text-muted mt-0.5 truncate">{acc.email}</div>
                  <div className="text-[10.5px] text-subtle mt-1 leading-snug">
                    <span className="font-semibold text-ink/70">Purpose:</span> {acc.purpose}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="hidden flex-col justify-center border-l border-border bg-surface px-10 lg:flex">
        <div className="max-w-md">
          <ShieldCheck size={26} className="text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-[26px] font-bold leading-tight text-ink">
            Every competency score here is computed, never stored.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Scores are derived on demand from an append-only ledger of dated, weighted, decaying
            evidence. Any score can be replayed, explained and audited down to the individual
            assessment item that produced it — and no language model is ever in the scoring path.
          </p>
        </div>
      </aside>

      {/* SSO Configuration Guide Modal */}
      {showSsoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={20} className="text-primary" />
                <h3 className="text-[17px] font-bold text-ink">Institutional SSO (OIDC) Setup</h3>
              </div>
              <button
                onClick={() => setShowSsoModal(false)}
                className="text-muted hover:text-ink cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[13px] text-muted leading-relaxed">
              <p>
                STATINTEL is engineered with native <strong>OpenID Connect (OIDC Core 1.0)</strong> support,
                allowing seamless institutional integration with government SSO providers such as <strong>Parichay</strong>, <strong>MeriPehchan</strong>, or institutional Keycloak servers.
              </p>

              <div className="rounded bg-raised/70 border border-border p-3 text-[12px]">
                <p className="font-semibold text-ink mb-1 flex items-center gap-1.5">
                  <Info size={14} className="text-primary" /> Required Environment Configuration:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-subtle font-mono text-[11px]">
                  <li>OIDC_ISSUER_URL=https://parichay.nic.in</li>
                  <li>OIDC_CLIENT_ID=&lt;assigned-client-id&gt;</li>
                  <li>OIDC_CLIENT_SECRET=&lt;secure-client-secret&gt;</li>
                  <li>OIDC_REDIRECT_URI=http://localhost:4000/api/auth/sso/callback</li>
                </ul>
              </div>

              <div className="rounded bg-primary-soft/30 border border-primary/20 p-2.5 text-[12px] text-ink">
                <strong>Security Guarantee:</strong> Client secrets are kept strictly server-side and never exposed to the browser. Users logging in through institutional SSO automatically receive application role <strong>LEARNER</strong> to prevent privilege escalation.
              </div>

              <p className="text-[12px] text-subtle">
                Since external institutional SSO credentials are not pre-configured on this local evaluation instance, please use the provided demo accounts.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="primary"
                onClick={() => setShowSsoModal(false)}
              >
                Continue with Demo Login
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
