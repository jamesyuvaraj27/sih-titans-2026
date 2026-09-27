import { useState, useMemo, type FormEvent } from 'react';
import { ShieldCheck, Search, Plus, X, Check, ArrowLeft, UserPlus, Info, GraduationCap } from 'lucide-react';
import { Alert, Button, Card, Field, Input } from '../components/ui.js';
import { post } from '../lib/api.js';
import { JOB_ROLE_CATALOG, COMMON_SKILLS } from '../data/jobRoles.js';

const QUALIFICATION_OPTIONS = [
  'Diploma',
  'B.Tech',
  'B.E.',
  'B.Sc',
  'BCA',
  'B.Com',
  'BA',
  'BBA',
  'B.Pharm',
  'M.Tech',
  'M.E.',
  'M.Sc',
  'MCA',
  'MBA',
  'MA',
  'M.Com',
  'PhD',
  'Other',
];

const GRADUATION_YEARS = Array.from({ length: 2030 - 1970 + 1 }, (_, i) => String(2030 - i));

interface JobRolePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
}

function SearchableJobRolePicker({
  id,
  label,
  value,
  onChange,
  required,
  placeholder = 'Search job role...',
}: JobRolePickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return JOB_ROLE_CATALOG;
    return JOB_ROLE_CATALOG.filter(
      (r) => r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
  }, [query]);

  const select = (title: string) => {
    onChange(title);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
        {required && <span className="text-critical" aria-hidden="true"> *</span>}
      </label>

      {value && !open ? (
        <div className="flex min-h-[44px] w-full items-center justify-between rounded border border-border-strong bg-raised px-3 py-2 text-[15px] text-ink">
          <span className="font-medium text-ink">{value}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setQuery(value);
                setOpen(true);
              }}
              className="text-[12px] font-medium text-primary hover:underline cursor-pointer"
            >
              Change
            </button>
            <button
              type="button"
              onClick={clear}
              className="text-subtle hover:text-critical cursor-pointer p-0.5"
              aria-label="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Input
            id={id}
            type="text"
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            required={required && !value}
            className="pr-10"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-subtle">
            <Search size={16} aria-hidden="true" />
          </div>
        </div>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-md">
            {query.trim() && !filtered.some((r) => r.title.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => select(query.trim())}
                className="flex w-full cursor-pointer items-center justify-between rounded px-3 py-2 text-left text-[13px] font-medium text-primary hover:bg-primary-soft"
              >
                <span>Use custom: “{query.trim()}”</span>
                <Plus size={14} />
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="p-3 text-center text-[12px] text-subtle">
                No matching role in catalog. You can type any custom role above.
              </div>
            ) : (
              filtered.slice(0, 30).map((role) => {
                const isSelected = value === role.title;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => select(role.title)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded px-3 py-1.5 text-left text-[13px] ${
                      isSelected
                        ? 'bg-primary text-white font-medium'
                        : 'text-ink hover:bg-surface'
                    }`}
                  >
                    <div>
                      <span className="block font-medium">{role.title}</span>
                      <span className={`block text-[11px] ${isSelected ? 'text-white/80' : 'text-subtle'}`}>
                        {role.category}
                      </span>
                    </div>
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface QualificationPickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
}

function SearchableQualificationPicker({ id, label, value, onChange, required }: QualificationPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUALIFICATION_OPTIONS;
    return QUALIFICATION_OPTIONS.filter((opt) => opt.toLowerCase().includes(q));
  }, [query]);

  const select = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
        {required && <span className="text-critical" aria-hidden="true"> *</span>}
      </label>

      {value && !open ? (
        <div className="flex min-h-[44px] w-full items-center justify-between rounded border border-border-strong bg-raised px-3 py-2 text-[15px] text-ink">
          <span className="font-medium text-ink">{value}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setQuery(value);
                setOpen(true);
              }}
              className="text-[12px] font-medium text-primary hover:underline cursor-pointer"
            >
              Change
            </button>
            <button
              type="button"
              onClick={clear}
              className="text-subtle hover:text-critical cursor-pointer p-0.5"
              aria-label="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <Input
            id={id}
            type="text"
            value={query}
            placeholder="Search qualification (e.g. B.Tech, M.Sc)..."
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            required={required && !value}
            className="pr-10"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-subtle">
            <Search size={16} aria-hidden="true" />
          </div>
        </div>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-md">
            {query.trim() && !filtered.some((opt) => opt.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => select(query.trim())}
                className="flex w-full cursor-pointer items-center justify-between rounded px-3 py-2 text-left text-[13px] font-medium text-primary hover:bg-primary-soft"
              >
                <span>Use custom: “{query.trim()}”</span>
                <Plus size={14} />
              </button>
            )}

            {filtered.map((opt) => {
              const isSelected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => select(opt)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded px-3 py-1.5 text-left text-[13px] ${
                    isSelected
                      ? 'bg-primary text-white font-medium'
                      : 'text-ink hover:bg-surface'
                  }`}
                >
                  <span className="font-medium">{opt}</span>
                  {isSelected && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function Register({ onGoToLogin }: { onGoToLogin: (registeredEmail?: string) => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentJobRole, setCurrentJobRole] = useState('');
  const [desiredJobRole, setDesiredJobRole] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');

  // Academic fields
  const [highestQualification, setHighestQualification] = useState('');
  const [degree, setDegree] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [institution, setInstitution] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [academicScore, setAcademicScore] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (!trimmed) return;
    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setCustomSkill('');
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Please enter your full name (minimum 2 characters)');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!currentJobRole.trim()) {
      setError('Please select your current job role');
      return;
    }
    if (!desiredJobRole.trim()) {
      setError('Please select your desired next job role');
      return;
    }
    if (skills.length === 0) {
      setError('Please select or enter at least one skill');
      return;
    }
    if (!highestQualification.trim()) {
      setError('Please select or specify your highest qualification');
      return;
    }
    if (!degree.trim()) {
      setError('Please enter your degree / course');
      return;
    }
    if (!institution.trim()) {
      setError('Please enter your institution / university');
      return;
    }
    if (!graduationYear.trim()) {
      setError('Please select your graduation year');
      return;
    }

    setBusy(true);
    try {
      await post('/auth/register', {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        currentJobRole: currentJobRole.trim(),
        desiredJobRole: desiredJobRole.trim(),
        skills,
        academic: {
          highestQualification: highestQualification.trim(),
          degree: degree.trim(),
          specialization: specialization.trim(),
          institution: institution.trim(),
          graduationYear: graduationYear.trim(),
          academicScore: academicScore.trim(),
        },
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed. Please check the information provided.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-12 bg-bg">
      <div className="flex items-center justify-center px-6 py-10 lg:col-span-7">
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[22px] font-bold tracking-tight text-ink">STATINTEL</p>
              <p className="text-[12px] font-medium text-primary">
                AI-Enabled Competency &amp; Learning Intelligence Platform
              </p>
              <p className="text-[11px] text-muted">
                for India's Official Statistical System · Registration
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onGoToLogin()}
              className="gap-1.5 text-primary"
            >
              <ArrowLeft size={14} /> Back to Sign in
            </Button>
          </div>

          {success ? (
            <Card className="mt-8 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success">
                <Check size={28} />
              </div>
              <h2 className="mt-4 text-[20px] font-bold text-ink">Registration Successful!</h2>
              <p className="mt-2 text-[14px] text-muted leading-relaxed">
                Your account for <strong className="text-ink">{email}</strong> has been created with standard Learner application access.
                Your profile information, skills, and academic qualifications will power your tailored competency dashboard.
              </p>
              <div className="mt-6 flex justify-center">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => onGoToLogin(email)}
                  className="min-w-[180px]"
                >
                  Proceed to Sign in
                </Button>
              </div>
            </Card>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
              {error && <Alert tone="critical" title="Registration error">{error}</Alert>}

              <div className="rounded border border-primary/20 bg-primary-soft p-3 text-[12px] text-ink flex items-start gap-2">
                <Info size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong>Learner Access:</strong> Every new registration in STATINTEL is automatically provisioned with the standard <strong>Learner</strong> application role. Your job role, skills, and academic profile configure your personalized competency path.
                </p>
              </div>

              {/* Basic credentials */}
              <div className="space-y-4">
                <p className="text-[14px] font-semibold text-ink border-b border-border pb-1">Basic Credentials</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name" htmlFor="name" required>
                    <Input
                      id="name"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ravi Kumar"
                      required
                    />
                  </Field>

                  <Field label="Email" htmlFor="email" required>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@mospi.gov.in"
                      required
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" htmlFor="password" required hint="At least 6 characters">
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>

                  <Field label="Confirm Password" htmlFor="confirmPassword" required>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </Field>
                </div>
              </div>

              {/* Job Roles */}
              <div className="space-y-4 pt-2">
                <p className="text-[14px] font-semibold text-ink border-b border-border pb-1">Professional Roles</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SearchableJobRolePicker
                    id="currentJobRole"
                    label="Current Job Role"
                    value={currentJobRole}
                    onChange={setCurrentJobRole}
                    placeholder="Search job role (e.g. Data Analyst)..."
                    required
                  />

                  <SearchableJobRolePicker
                    id="desiredJobRole"
                    label="Desired Next Job Role"
                    value={desiredJobRole}
                    onChange={setDesiredJobRole}
                    placeholder="Search desired role (e.g. Data Scientist)..."
                    required
                  />
                </div>
              </div>

              {/* Academic Details Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-1.5 border-b border-border pb-1">
                  <GraduationCap size={16} className="text-primary" />
                  <p className="text-[14px] font-semibold text-ink">Academic Details</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SearchableQualificationPicker
                    id="highestQualification"
                    label="Highest Qualification"
                    value={highestQualification}
                    onChange={setHighestQualification}
                    required
                  />

                  <Field label="Degree / Course" htmlFor="degree" required hint="e.g. B.Tech in CSE, M.Sc in Statistics">
                    <Input
                      id="degree"
                      type="text"
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      placeholder="e.g. B.Tech, M.Sc, BCA"
                      required
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Specialization / Branch" htmlFor="specialization" hint="Optional">
                    <Input
                      id="specialization"
                      type="text"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="e.g. Artificial Intelligence, Statistics"
                    />
                  </Field>

                  <Field label="Institution / University" htmlFor="institution" required>
                    <Input
                      id="institution"
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="e.g. Indian Statistical Institute, IIT Delhi"
                      required
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Graduation Year" htmlFor="graduationYear" required>
                    <select
                      id="graduationYear"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      required
                      className="min-h-[44px] w-full rounded border border-border-strong bg-raised px-3 text-[15px] text-ink cursor-pointer"
                    >
                      <option value="">Select graduation year...</option>
                      {GRADUATION_YEARS.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Academic Score"
                    htmlFor="academicScore"
                    hint="Enter as CGPA (e.g. 8.5) or Percentage (e.g. 85%)"
                  >
                    <Input
                      id="academicScore"
                      type="text"
                      value={academicScore}
                      onChange={(e) => setAcademicScore(e.target.value)}
                      placeholder="e.g. 8.5 CGPA or 85%"
                    />
                  </Field>
                </div>
              </div>

              {/* Skills Multi-Selection */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between border-b border-border pb-1">
                  <p className="text-[14px] font-semibold text-ink">
                    Skills Known <span className="text-critical">*</span>
                  </p>
                  <span className="text-[12px] text-subtle">
                    {skills.length} selected
                  </span>
                </div>

                {/* Selected tags */}
                {skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded border border-border bg-surface min-h-[40px] items-center">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 rounded bg-primary-soft border border-primary/20 px-2 py-0.5 text-[12px] font-medium text-primary"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="hover:text-critical cursor-pointer"
                          aria-label={`Remove ${skill}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted italic p-2 rounded border border-dashed border-border bg-surface/50">
                    No skills selected yet. Click any skill below or add custom skills.
                  </p>
                )}

                {/* Quick selection common skills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {COMMON_SKILLS.map((item) => {
                    const active = skills.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleSkill(item)}
                        className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? 'bg-primary text-white shadow-sm'
                            : 'border border-border bg-raised text-muted hover:border-primary/50 hover:text-ink'
                        }`}
                      >
                        {active ? `✓ ${item}` : `+ ${item}`}
                      </button>
                    );
                  })}
                </div>

                {/* Custom skill add input */}
                <div className="flex gap-2 pt-1">
                  <Input
                    type="text"
                    placeholder="Add other skill (e.g. Econometrics, PowerBI)..."
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomSkill();
                      }
                    }}
                    className="min-h-[38px] text-[13px]"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addCustomSkill}
                    disabled={!customSkill.trim()}
                  >
                    <Plus size={14} /> Add
                  </Button>
                </div>
              </div>

              <Button type="submit" loading={busy} className="w-full mt-4">
                <UserPlus size={16} /> Complete Registration
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => onGoToLogin()}
                  className="cursor-pointer text-[13px] text-primary hover:underline"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <aside className="hidden flex-col justify-center border-l border-border bg-surface px-10 lg:col-span-5 lg:flex">
        <div className="max-w-md">
          <ShieldCheck size={28} className="text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-[22px] font-bold leading-tight text-ink">
            AI-Enabled Competency &amp; Learning Intelligence Platform
          </h2>
          <p className="mt-1.5 text-[13px] font-medium text-primary">
            for India's Official Statistical System
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            STATINTEL maps official roles to National Statistical Systems Training Academy (NSSTA) curricula and real-world survey operations.
          </p>

          <div className="mt-8 space-y-4 text-[13px]">
            <div className="rounded border border-border bg-raised p-3">
              <p className="font-semibold text-ink">Guaranteed Safe Access</p>
              <p className="mt-1 text-muted text-[12px]">
                Registration automatically initializes you with the safe <strong>Learner</strong> profile. Administrative elevations for Directorate and Division leadership are strictly managed by system administrators.
              </p>
            </div>

            <div className="rounded border border-border bg-raised p-3">
              <p className="font-semibold text-ink">Personalized Career Growth</p>
              <p className="mt-1 text-muted text-[12px]">
                Your declared current role, desired goal, skills, and academic qualifications establish your initial diagnostic baseline, generating customized learning paths and diagnostic quizzes.
              </p>
            </div>

            <div className="rounded border border-border bg-raised p-3">
              <p className="font-semibold text-ink">Verifiable Competency Ledger</p>
              <p className="mt-1 text-muted text-[12px]">
                Every score is mathematically derived from dated assessments, courses, and project artefacts — transparent, auditable, and unchangeable.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
