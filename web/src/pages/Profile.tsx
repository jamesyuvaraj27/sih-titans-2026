import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Briefcase, Target, Building, Mail, Hash, BookOpen, GraduationCap, Calendar, Award } from 'lucide-react';
import { useAuth } from '../lib/auth.js';
import { roleLabel } from '../lib/format.js';
import { Card, CardHeader, Badge } from '../components/ui.js';

export function Profile() {
  const { me } = useAuth();
  if (!me) return null;

  // Extract stored registration or qualification data
  const quals = me.qualifications;

  const currentJobRole = (typeof quals === 'object' && quals !== null && !Array.isArray(quals) && quals.currentJobRole)
    ? quals.currentJobRole
    : (me.designation || 'Not provided');

  const desiredJobRole = (typeof quals === 'object' && quals !== null && !Array.isArray(quals) && quals.desiredJobRole)
    ? quals.desiredJobRole
    : 'Not provided';

  const declaredSkills: string[] = (typeof quals === 'object' && quals !== null && !Array.isArray(quals) && Array.isArray(quals.skills))
    ? quals.skills
    : [];

  // Academic details resolution:
  // 1. New registered users: quals.academic object
  // 2. Existing demo users: quals array e.g. [{ degree: 'M.Sc.', subject: 'Statistics', year: 2010, institution: 'Andhra University' }]
  const academicObj = (typeof quals === 'object' && quals !== null && !Array.isArray(quals) && typeof quals.academic === 'object')
    ? quals.academic
    : null;

  const demoAcademic = Array.isArray(quals) && quals.length > 0 ? quals[0] : null;

  const highestQualification = academicObj?.highestQualification
    || demoAcademic?.degree
    || 'Not provided';

  const degree = academicObj?.degree
    || demoAcademic?.degree
    || 'Not provided';

  const specialization = academicObj?.specialization
    || demoAcademic?.subject
    || 'Not provided';

  const institution = academicObj?.institution
    || demoAcademic?.institution
    || 'Not provided';

  const graduationYear = academicObj?.graduationYear
    || (demoAcademic?.year ? String(demoAcademic.year) : 'Not provided');

  const academicScore = academicObj?.academicScore
    || 'Not provided';

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Top navigation */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to Dashboard
        </Link>
      </div>

      {/* Profile Header Banner */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-soft border border-primary/20 text-primary text-[22px] font-bold">
              {me.nameEn.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-ink">
                {me.nameEn}
                {me.nameHi && <span lang="hi" className="ml-2 text-[18px] font-normal text-muted">{me.nameHi}</span>}
              </h1>
              <p className="text-[14px] text-muted mt-0.5">{me.designation || 'Official'}</p>
              <p className="text-[12px] text-subtle">{me.department?.nameEn}</p>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1">
            <span className="text-[11px] uppercase tracking-wider text-subtle font-semibold">Application Role</span>
            <Badge tone="primary" title="Non-editable system permissions role">
              <Shield size={12} className="mr-1" />
              {roleLabel(me.role)}
            </Badge>
            <span className="text-[10px] text-subtle">Governs access permissions (non-editable)</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Career & Job Roles */}
        <Card>
          <CardHeader
            title="Career & Job Roles"
            subtitle="Current professional position and targeted career pathway"
          />
          <div className="p-4 space-y-4 text-[13px]">
            <div>
              <dt className="text-subtle flex items-center gap-1.5 text-[12px] font-medium">
                <Briefcase size={14} className="text-primary" /> Current Job Role
              </dt>
              <dd className="mt-1 font-semibold text-ink text-[15px]">
                {currentJobRole}
              </dd>
            </div>

            <div className="pt-2 border-t border-border">
              <dt className="text-subtle flex items-center gap-1.5 text-[12px] font-medium">
                <Target size={14} className="text-primary" /> Desired Next Job Role
              </dt>
              <dd className="mt-1 font-semibold text-ink text-[15px]">
                {desiredJobRole}
              </dd>
            </div>

            <div className="pt-2 border-t border-border">
              <dt className="text-subtle text-[12px] font-medium">Current Assignment</dt>
              <dd className="mt-0.5 text-ink font-medium">
                {(typeof quals === 'object' && quals !== null && !Array.isArray(quals) && quals.currentAssignment) || 'Not provided'}
              </dd>
            </div>

            <div className="pt-2 border-t border-border">
              <dt className="text-subtle text-[12px] font-medium">Official Designation</dt>
              <dd className="mt-0.5 text-ink font-medium">{me.designation || 'Not provided'}</dd>
            </div>

            <div className="pt-2 border-t border-border">
              <dt className="text-subtle text-[12px] font-medium">Role Profile (Competency Standard)</dt>
              <dd className="mt-0.5 text-ink font-medium">{me.roleProfile?.titleEn || 'Not provided'}</dd>
            </div>
          </div>
        </Card>

        {/* Account & Organisation Information */}
        <Card>
          <CardHeader
            title="Account & Organisation"
            subtitle="Verified official credentials and department association"
          />
          <div className="p-4 space-y-4 text-[13px]">
            <div>
              <dt className="text-subtle flex items-center gap-1.5 text-[12px] font-medium">
                <Mail size={14} className="text-primary" /> Official Email
              </dt>
              <dd className="mt-1 text-ink font-mono text-[14px]">{me.email}</dd>
            </div>

            <div className="pt-2 border-t border-border">
              <dt className="text-subtle flex items-center gap-1.5 text-[12px] font-medium">
                <Building size={14} className="text-primary" /> Department
              </dt>
              <dd className="mt-0.5 text-ink font-medium">{me.department?.nameEn || 'Not provided'}</dd>
            </div>

            <div className="pt-2 border-t border-border">
              <dt className="text-subtle flex items-center gap-1.5 text-[12px] font-medium">
                <Hash size={14} className="text-primary" /> Employee Code
              </dt>
              <dd className="mt-0.5 text-ink font-mono">{me.employeeCode || 'Not provided'}</dd>
            </div>

            <div className="pt-2 border-t border-border">
              <dt className="text-subtle text-[12px] font-medium">Cadre / Service</dt>
              <dd className="mt-0.5 text-ink font-medium">{me.cadre || 'Not provided'}</dd>
            </div>
          </div>
        </Card>
      </div>

      {/* Experience & Previous Training Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Work Experience"
            subtitle="Prior official postings, survey rounds, and operational tenures"
          />
          <div className="p-4 text-[13px]">
            {(typeof quals === 'object' && quals !== null && !Array.isArray(quals) && quals.workExperience) ? (
              <p className="text-ink leading-relaxed">{quals.workExperience}</p>
            ) : (
              <p className="text-muted italic">Not provided</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Previous Training"
            subtitle="Historical induction courses, workshops, and certified programs"
          />
          <div className="p-4 text-[13px]">
            {(typeof quals === 'object' && quals !== null && !Array.isArray(quals) && quals.previousTraining) ? (
              <p className="text-ink leading-relaxed">{quals.previousTraining}</p>
            ) : (
              <p className="text-muted italic">Not provided</p>
            )}
          </div>
        </Card>
      </div>


      {/* Academic Details Section */}
      <Card>
        <CardHeader
          title="Academic Details"
          subtitle="Educational background, highest qualification, and academic credentials"
        />
        <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-[13px]">
          <div>
            <dt className="text-subtle text-[12px] font-medium flex items-center gap-1.5">
              <GraduationCap size={14} className="text-primary" /> Highest Qualification
            </dt>
            <dd className="mt-1 font-semibold text-ink text-[14px]">{highestQualification}</dd>
          </div>

          <div>
            <dt className="text-subtle text-[12px] font-medium flex items-center gap-1.5">
              <BookOpen size={14} className="text-primary" /> Degree / Course
            </dt>
            <dd className="mt-1 font-semibold text-ink text-[14px]">{degree}</dd>
          </div>

          <div>
            <dt className="text-subtle text-[12px] font-medium">Specialization / Branch</dt>
            <dd className="mt-1 font-medium text-ink">{specialization}</dd>
          </div>

          <div>
            <dt className="text-subtle text-[12px] font-medium flex items-center gap-1.5">
              <Building size={14} className="text-primary" /> Institution / University
            </dt>
            <dd className="mt-1 font-medium text-ink">{institution}</dd>
          </div>

          <div>
            <dt className="text-subtle text-[12px] font-medium flex items-center gap-1.5">
              <Calendar size={14} className="text-primary" /> Graduation Year
            </dt>
            <dd className="mt-1 font-medium text-ink">{graduationYear}</dd>
          </div>

          <div>
            <dt className="text-subtle text-[12px] font-medium flex items-center gap-1.5">
              <Award size={14} className="text-primary" /> Academic Score
            </dt>
            <dd className="mt-1 font-medium text-ink">{academicScore}</dd>
          </div>
        </div>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader
          title="Skills & Competencies"
          subtitle="Declared technical and professional capabilities"
        />
        <div className="p-4">
          {declaredSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {declaredSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded bg-primary-soft border border-primary/25 px-2.5 py-1 text-[12px] font-medium text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted italic">Not provided</p>
          )}
        </div>
      </Card>
    </div>
  );
}
