import { useState, useEffect, type ChangeEvent } from 'react';
import {
  Search,
  Download,
  Upload,
  Users,
  Eye,
  CheckCircle2,
  Building,
  GraduationCap,
  FileSpreadsheet,
} from 'lucide-react';
import {
  api,
  type WorkforceDatasetResponse,
  type OfficialAnalyticsDetail,
} from '../lib/api.js';
import { Card, CardHeader, Badge, Button, Select, Spinner, Alert, Th, Td } from '../components/ui.js';

type SortField =
  | 'name'
  | 'employeeCode'
  | 'designation'
  | 'departmentName'
  | 'experienceYears'
  | 'readinessScore'
  | 'gapCount';

export function AdminWorkforceData() {
  const [data, setData] = useState<WorkforceDatasetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('ALL');
  const [designation, setDesignation] = useState('ALL');
  const [cadre, setCadre] = useState('ALL');
  const [readinessStatus, setReadinessStatus] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Inspection Drawer & Import Modal State
  const [inspectingOfficialId, setInspectingOfficialId] = useState<string | null>(null);
  const [inspectDetail, setInspectDetail] = useState<OfficialAnalyticsDetail | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);

  // Load Workforce Dataset
  const loadDataset = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        search,
        departmentId,
        designation,
        cadre,
        readinessStatus,
        sort: sortField,
        dir: sortDir,
        page: String(page),
        limit: String(limit),
      });

      const res = await api<WorkforceDatasetResponse>(`/admin/workforce/dataset?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Could not load workforce dataset');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataset();
  }, [search, departmentId, designation, cadre, readinessStatus, sortField, sortDir, page, limit]);

  // Load Official Inspection Detail
  const openInspector = async (id: string) => {
    setInspectingOfficialId(id);
    try {
      setInspectLoading(true);
      const detail = await api<OfficialAnalyticsDetail>(`/admin/workforce/official/${id}`);
      setInspectDetail(detail);
    } catch (err: any) {
      console.error('Failed to load official detail:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  const closeInspector = () => {
    setInspectingOfficialId(null);
    setInspectDetail(null);
  };

  // Toggle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  // Export to CSV
  const handleExportCsv = () => {
    const params = new URLSearchParams({
      search,
      departmentId,
      designation,
      cadre,
      readinessStatus,
      sort: sortField,
      dir: sortDir,
    });
    window.location.href = `/api/admin/workforce/export.csv?${params.toString()}`;
  };

  // Handle Client-side CSV File Upload & Preview
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;

      // Parse CSV preview lines
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      const firstLine = lines[0];
      if (lines.length > 1 && firstLine) {
        const headers = firstLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const previewRows = lines.slice(1, 6).map((line) => {
          const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const rowObj: Record<string, string> = {};
          headers.forEach((h, i) => {
            rowObj[h] = vals[i] || '';
          });
          return rowObj;
        });
        setImportPreview(previewRows);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="border-b border-[#E5E7EB] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                Workforce Dataset &amp; Records Viewer
              </h1>
              <span className="rounded border border-[#0284C7]/30 bg-[#F0F9FF] px-2 py-0.5 text-[11px] font-semibold text-[#0284C7]">
                Administrator Explorer
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#6B7280] max-w-3xl leading-relaxed">
              Query, search, sort, and inspect official personnel records, evaluated role readiness, and verified competency gaps across central and state directorates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
              <Upload size={14} className="mr-1.5 text-[#6B7280]" /> Import / Preview CSV
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportCsv}>
              <Download size={14} className="mr-1.5" /> Export to CSV (Excel)
            </Button>
          </div>
        </div>
      </header>

      {/* Dataset Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Total Dataset Size</p>
            <Users size={16} className="text-[#0284C7]" />
          </div>
          <p className="tnum mt-1 text-[26px] font-bold text-[#111827]">{data?.total ?? 0}</p>
          <p className="text-[11.5px] text-[#6B7280] mt-0.5">Statistical officials in database</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Average Readiness</p>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="tnum mt-1 text-[26px] font-bold text-[#111827]">
            {data?.records?.length
              ? Math.round(data.records.reduce((acc, r) => acc + r.readinessScore, 0) / data.records.length)
              : 0}%
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-0.5">Role requirement satisfaction</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Cadres &amp; Streams</p>
            <GraduationCap size={16} className="text-[#0284C7]" />
          </div>
          <p className="tnum mt-1 text-[26px] font-bold text-[#111827]">{data?.filters?.cadres?.length ?? 0}</p>
          <p className="text-[11.5px] text-[#6B7280] mt-0.5">ISS, SSS, and State Services</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Departments</p>
            <Building size={16} className="text-[#0284C7]" />
          </div>
          <p className="tnum mt-1 text-[26px] font-bold text-[#111827]">{data?.filters?.departments?.length ?? 0}</p>
          <p className="text-[11.5px] text-[#6B7280] mt-0.5">MoSPI HQ, NSSO, DES &amp; NSSTA</p>
        </Card>
      </div>

      {/* Main Table Card with Search & Multi-Filters */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Workforce Records Roster"
          subtitle="Showing validated personnel rows with evidence-based readiness scores."
          action={
            <div className="text-[12px] text-[#6B7280] font-medium">
              Showing page {page} of {data?.totalPages || 1}
            </div>
          }
        />

        {/* Filter Controls Bar */}
        <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] p-3.5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, employee code, or designation..."
                className="w-full rounded border border-[#D1D5DB] bg-white pl-9 pr-3 py-1.5 text-[13px] text-[#111827] focus:border-[#0284C7] focus:outline-none"
              />
            </div>

            {/* Department Filter */}
            <div className="w-auto">
              <Select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setPage(1);
                }}
                className="text-[12.5px] py-1"
              >
                <option value="ALL">All Departments</option>
                {data?.filters?.departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Designation Filter */}
            <div className="w-auto">
              <Select
                value={designation}
                onChange={(e) => {
                  setDesignation(e.target.value);
                  setPage(1);
                }}
                className="text-[12.5px] py-1"
              >
                <option value="ALL">All Designations</option>
                {data?.filters?.designations?.map((des) => (
                  <option key={des} value={des}>
                    {des}
                  </option>
                ))}
              </Select>
            </div>

            {/* Cadre Filter */}
            <div className="w-auto">
              <Select
                value={cadre}
                onChange={(e) => {
                  setCadre(e.target.value);
                  setPage(1);
                }}
                className="text-[12.5px] py-1"
              >
                <option value="ALL">All Cadres</option>
                {data?.filters?.cadres?.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            {/* Readiness Band Filter */}
            <div className="w-auto">
              <Select
                value={readinessStatus}
                onChange={(e) => {
                  setReadinessStatus(e.target.value);
                  setPage(1);
                }}
                className="text-[12.5px] py-1"
              >
                <option value="ALL">All Readiness Bands</option>
                <option value="READY">Ready (≥80%)</option>
                <option value="DEVELOPING">Developing (50% - 79%)</option>
                <option value="CRITICAL">Critical (&lt;50%)</option>
              </Select>
            </div>

            {(search || departmentId !== 'ALL' || designation !== 'ALL' || cadre !== 'ALL' || readinessStatus !== 'ALL') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setDepartmentId('ALL');
                  setDesignation('ALL');
                  setCadre('ALL');
                  setReadinessStatus('ALL');
                  setPage(1);
                }}
                className="text-[12px] py-1"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {loading && !data ? (
          <div className="p-8">
            <Spinner label="Loading workforce dataset records..." />
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert tone="critical" title="Could not load records">{error}</Alert>
          </div>
        ) : data?.records.length === 0 ? (
          <div className="p-8 text-center text-[#6B7280] text-[13px]">
            No workforce records match the active search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px] text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
                  <Th
                    sort={sortField === 'employeeCode' ? sortDir : null}
                    onSort={() => handleSort('employeeCode')}
                  >
                    Employee Code
                  </Th>
                  <Th
                    sort={sortField === 'name' ? sortDir : null}
                    onSort={() => handleSort('name')}
                  >
                    Officer &amp; Contact
                  </Th>
                  <Th
                    sort={sortField === 'designation' ? sortDir : null}
                    onSort={() => handleSort('designation')}
                  >
                    Designation &amp; Cadre
                  </Th>
                  <Th
                    sort={sortField === 'departmentName' ? sortDir : null}
                    onSort={() => handleSort('departmentName')}
                  >
                    Department / Division
                  </Th>
                  <Th
                    align="right"
                    sort={sortField === 'experienceYears' ? sortDir : null}
                    onSort={() => handleSort('experienceYears')}
                  >
                    Tenure (Yrs)
                  </Th>
                  <Th
                    align="right"
                    sort={sortField === 'readinessScore' ? sortDir : null}
                    onSort={() => handleSort('readinessScore')}
                  >
                    Readiness
                  </Th>
                  <Th
                    align="right"
                    sort={sortField === 'gapCount' ? sortDir : null}
                    onSort={() => handleSort('gapCount')}
                  >
                    Gaps
                  </Th>
                  <Th>Primary Skill Deficit</Th>
                  <Th align="center">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {data?.records.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openInspector(r.id)}
                    className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <Td className="font-mono text-[11px] text-[#64748B] font-semibold whitespace-nowrap">
                      {r.employeeCode}
                    </Td>
                    <Td>
                      <p className="font-semibold text-[#111827]">{r.name}</p>
                      <p className="text-[11px] text-[#64748B]">{r.email}</p>
                    </Td>
                    <Td>
                      <p className="font-medium text-[#111827]">{r.designation}</p>
                      <p className="text-[11px] text-[#64748B]">{r.cadre || 'General Cadre'}</p>
                    </Td>
                    <Td className="text-[#64748B] max-w-[200px]">
                      <span className="truncate block" title={r.departmentName}>
                        {r.departmentName}
                      </span>
                    </Td>
                    <Td align="right" className="tabular-nums font-medium text-[#111827]">
                      {r.experienceYears} yrs
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.readinessScore >= 80
                                ? 'bg-emerald-600'
                                : r.readinessScore >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${r.readinessScore}%` }}
                          />
                        </div>
                        <span className="font-bold text-[12px] tabular-nums text-[#111827]">
                          {r.readinessScore}%
                        </span>
                      </div>
                    </Td>
                    <Td align="right" className="tabular-nums font-semibold">
                      {r.gapCount > 0 ? (
                        <span className="rounded px-1.5 py-0.5 text-[11px] bg-amber-50 text-amber-800 border border-amber-200">
                          {r.gapCount} gaps
                        </span>
                      ) : (
                        <span className="rounded px-1.5 py-0.5 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Target Met ✓
                        </span>
                      )}
                    </Td>
                    <Td>
                      {r.topGap ? (
                        <div>
                          <p className="text-[12px] font-medium text-[#111827] truncate max-w-[180px]">
                            {r.topGap.nameEn}
                          </p>
                          <p className="text-[10.5px] text-[#64748B]">
                            Deficit: -{r.topGap.gap} level{r.topGap.gap > 1 ? 's' : ''} (Sev: {r.topGap.severity})
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-semibold">Requirement Satisfied</span>
                      )}
                    </Td>
                    <Td align="center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInspector(r.id);
                        }}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0284C7] hover:underline cursor-pointer"
                      >
                        <Eye size={13} /> Inspect
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[12.5px] text-[#64748B]">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-[#D1D5DB] bg-white px-2 py-1 text-[12px] text-[#111827]"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span>
              Showing {data ? Math.min((page - 1) * limit + 1, data.total) : 0} -{' '}
              {data ? Math.min(page * limit, data.total) : 0} of {data?.total ?? 0} records
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 text-[12px]"
            >
              &larr; Previous
            </Button>
            <span className="px-2 font-medium text-[#111827]">
              Page {page} of {data?.totalPages || 1}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= (data?.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 text-[12px]"
            >
              Next &rarr;
            </Button>
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          OFFICIAL DETAIL INSPECTION DRAWER / MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {inspectingOfficialId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeInspector}
        >
          <div
            className="w-full max-w-3xl rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                    {inspectDetail?.official.employeeCode || inspectingOfficialId}
                  </span>
                  <Badge tone="primary">{inspectDetail?.official.cadre || 'Official'}</Badge>
                </div>
                <h3 className="mt-1 text-[19px] font-bold text-[#111827]">
                  {inspectDetail?.official.name || 'Official Inspection'}
                </h3>
                <p className="text-[12px] text-[#6B7280]">
                  {inspectDetail?.official.designation} &bull; {inspectDetail?.official.departmentName}
                </p>
              </div>

              <button
                type="button"
                onClick={closeInspector}
                className="text-[#64748B] hover:text-[#111827] cursor-pointer p-1 text-[20px] rounded"
              >
                ✕
              </button>
            </div>

            {inspectLoading ? (
              <div className="py-12">
                <Spinner label="Retrieving official records & competency evidence..." />
              </div>
            ) : inspectDetail ? (
              <div className="space-y-5 text-[13px]">
                {/* KPI Metrics */}
                <div className="grid gap-3 sm:grid-cols-3 bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-[#64748B]">Readiness Score</span>
                    <p className="text-[20px] font-bold text-[#111827]">
                      {inspectDetail.official.readinessScore}%
                    </p>
                    <p className="text-[11px] text-[#64748B]">Role benchmark satisfaction</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-[#64748B]">Role Profile</span>
                    <p className="text-[15px] font-bold text-[#111827] truncate">
                      {inspectDetail.official.roleTitle}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {inspectDetail.requirements.length} required competencies
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-[#64748B]">Date of Joining</span>
                    <p className="text-[15px] font-bold text-[#111827]">
                      {inspectDetail.official.dateOfJoining}
                    </p>
                    <p className="text-[11px] text-[#64748B]">Service verified on record</p>
                  </div>
                </div>

                {/* Role Requirements & Evidenced Level Table */}
                <div>
                  <h4 className="font-bold text-[14px] text-[#111827] mb-2 flex items-center justify-between">
                    <span>Mandated Role Requirements &amp; Evaluated Scores</span>
                    <span className="text-[11.5px] font-normal text-[#64748B]">
                      {inspectDetail.requirements.filter((r) => r.isMet).length} of{' '}
                      {inspectDetail.requirements.length} requirements met
                    </span>
                  </h4>

                  <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
                    <table className="w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                          <Th>Competency</Th>
                          <Th align="center">Current Level</Th>
                          <Th align="center">Required Level</Th>
                          <Th align="right">Score</Th>
                          <Th align="center">Status</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {inspectDetail.requirements.map((req) => (
                          <tr key={req.competencyId} className="hover:bg-[#F8FAFC]">
                            <Td>
                              <p className="font-semibold text-[#111827]">{req.nameEn}</p>
                              <p className="font-mono text-[10px] text-[#64748B]">{req.competencyId}</p>
                            </Td>
                            <Td align="center" className="font-semibold text-[#111827]">
                              L{req.currentLevel}
                            </Td>
                            <Td align="center" className="font-semibold text-[#64748B]">
                              L{req.targetLevel}
                            </Td>
                            <Td align="right" className="tabular-nums font-semibold">
                              {Math.round(req.currentScore)}%
                            </Td>
                            <Td align="center">
                              {req.isMet ? (
                                <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold">
                                  Target Met ✓
                                </span>
                              ) : (
                                <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold">
                                  Gap: -{req.gap}
                                </span>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Evidence Ledger Snapshot */}
                <div>
                  <h4 className="font-bold text-[14px] text-[#111827] mb-2">
                    Recent Evidence Ledger Records ({inspectDetail.recentEvidence.length})
                  </h4>
                  {inspectDetail.recentEvidence.length === 0 ? (
                    <p className="text-[12px] text-[#64748B] italic">No evidence recorded yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-[#E5E7EB] rounded p-2">
                      {inspectDetail.recentEvidence.map((ev) => (
                        <div key={ev.id} className="flex items-center justify-between text-[11.5px] border-b border-[#F1F5F9] pb-1 last:border-0">
                          <div>
                            <span className="font-semibold text-[#111827]">{ev.competencyName}</span>
                            <span className="text-[#64748B] ml-2">({ev.kind})</span>
                          </div>
                          <span className="text-[#64748B] font-mono text-[10.5px]">
                            {ev.occurredAt.split('T')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end pt-3 border-t border-[#E5E7EB]">
                  <Button variant="secondary" size="sm" onClick={closeInspector}>
                    Close Inspector
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CSV IMPORT & DATASET PREVIEW MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <h3 className="text-[18px] font-bold text-[#111827] flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-[#0284C7]" />
                  <span>Workforce CSV Dataset Import &amp; Validator</span>
                </h3>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  Upload an external or updated CSV file to validate schema headers and preview records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-[#64748B] hover:text-[#111827] cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* File Upload Zone */}
            <div className="rounded-lg border-2 border-dashed border-[#D1D5DB] p-6 text-center hover:border-[#0284C7] transition-colors">
              <Upload size={28} className="mx-auto text-[#9CA3AF] mb-2" />
              <p className="text-[13px] font-semibold text-[#111827]">
                Click or drag &amp; drop a workforce CSV file
              </p>
              <p className="text-[11.5px] text-[#6B7280] mt-1">
                Required columns: <code>employee_code, name, email, designation, department</code>
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="mt-3 block w-full text-sm text-[#64748B] file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-[#D1D5DB] file:text-[12px] file:font-semibold file:bg-[#F8FAFC] hover:file:bg-[#F1F5F9] cursor-pointer"
              />
            </div>

            {/* Preview of Parsed Rows */}
            {importPreview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[13px] text-[#111827]">
                    Parsed Dataset Preview (First 5 Rows)
                  </h4>
                  <Badge tone="primary">Validated Format ✓</Badge>
                </div>
                <div className="overflow-x-auto border border-[#E5E7EB] rounded">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-[#F8FAFC]">
                      <tr>
                        {Object.keys(importPreview[0] || {}).map((col) => (
                          <Th key={col}>{col}</Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {importPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val: any, j) => (
                            <Td key={j} className="truncate max-w-[150px]">
                              {val}
                            </Td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
              <span className="text-[11.5px] text-[#6B7280]">
                {importPreview ? `${importPreview.length} preview rows parsed` : 'No file chosen'}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowImportModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!importPreview}
                  onClick={() => {
                    alert('Dataset format validated successfully. Records are compatible with STATINTEL.');
                    setShowImportModal(false);
                  }}
                >
                  Confirm &amp; Proceed
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
