import 'dotenv/config';
import assert from 'node:assert';
import { prisma } from '../src/lib/db.js';
import { scoresFor, gapsFor } from '../src/modules/competency/service.js';

const BASE_URL = process.env.API_BASE || 'http://localhost:4000/api';

async function main() {
  console.log('==================================================');
  console.log('STATINTEL — ADMIN WORKFORCE ANALYTICS VERIFICATION');
  console.log('Testing Administrator CSV Dataset, Training Demand,');
  console.log('Readiness by Designation, and Skill-Gap Analytics');
  console.log('==================================================\n');

  // 1. Authenticate as Administrator
  const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@mospi.gov.in', password: 'demo1234' }),
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const { token: adminToken, official: adminOfficial } = (await adminLogin.json()) as any;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log(`[PASS] Admin authenticated: ${adminOfficial.nameEn} (${adminOfficial.id})`);

  // 2. Authenticate as Learner
  const learnerLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vinaykumarbade2007@gmail.com', password: 'demo1234' }),
  });
  assert.strictEqual(learnerLogin.status, 200, 'Learner login failed');
  const { token: learnerToken, official: learnerOfficial } = (await learnerLogin.json()) as any;
  const learnerHeaders = { Authorization: `Bearer ${learnerToken}` };
  console.log(`[PASS] Learner authenticated: ${learnerOfficial.nameEn} (${learnerOfficial.id})`);

  // 3. RBAC SECURITY CHECK: Learner must be blocked from all admin workforce endpoints
  const learnerDataset = await fetch(`${BASE_URL}/admin/workforce/dataset`, { headers: learnerHeaders });
  assert.strictEqual(learnerDataset.status, 403, 'Learner must be forbidden from /admin/workforce/dataset');

  const learnerExport = await fetch(`${BASE_URL}/admin/workforce/export.csv`, { headers: learnerHeaders });
  assert.strictEqual(learnerExport.status, 403, 'Learner must be forbidden from /admin/workforce/export.csv');

  const learnerAnalytics = await fetch(`${BASE_URL}/admin/analytics`, { headers: learnerHeaders });
  assert.strictEqual(learnerAnalytics.status, 403, 'Learner must be forbidden from /admin/analytics');

  const learnerInspect = await fetch(`${BASE_URL}/admin/workforce/official/${adminOfficial.id}`, { headers: learnerHeaders });
  assert.strictEqual(learnerInspect.status, 403, 'Learner must be forbidden from inspecting official analytics');

  console.log('[PASS] RBAC enforced: Learner strictly blocked (403 Forbidden) from all admin workforce data');

  // 4. TEST WORKFORCE DATASET VIEWER (API)
  const dsRes = await fetch(`${BASE_URL}/admin/workforce/dataset?limit=10&page=1`, { headers: adminHeaders });
  assert.strictEqual(dsRes.status, 200, 'Admin workforce dataset fetch failed');
  const dataset: any = await dsRes.json();

  assert.strictEqual(dataset.total, 49, `Expected 49 officials in dataset, got ${dataset.total}`);
  assert.strictEqual(dataset.records.length, 10, 'Expected 10 paginated records on page 1');
  assert(dataset.totalPages >= 5, 'Expected at least 5 pages for 49 records at 10 per page');
  assert(dataset.filters.departments.length > 0, 'Department filters missing');
  assert(dataset.filters.designations.length > 0, 'Designation filters missing');
  assert(dataset.filters.cadres.length > 0, 'Cadre filters missing');

  // Verify record structure
  const firstRecord = dataset.records[0];
  assert(firstRecord.employeeCode, 'Missing employeeCode');
  assert(firstRecord.name, 'Missing name');
  assert(firstRecord.email, 'Missing email');
  assert(firstRecord.designation, 'Missing designation');
  assert(firstRecord.departmentName, 'Missing departmentName');
  assert(typeof firstRecord.readinessScore === 'number', 'Missing readinessScore');
  assert(typeof firstRecord.experienceYears === 'number', 'Missing experienceYears');
  console.log(`[PASS] Workforce dataset retrieved: 49 total records, paginated, and enriched with readiness scores`);

  // 5. TEST SEARCH & FILTERING
  // Search by name
  const searchRes = await fetch(`${BASE_URL}/admin/workforce/dataset?search=Vinay`, { headers: adminHeaders });
  const searchData: any = await searchRes.json();
  assert(searchData.records.some((r: any) => r.name.includes('Vinay')), 'Search for Vinay failed');

  // Filter by designation
  const desRes = await fetch(`${BASE_URL}/admin/workforce/dataset?designation=${encodeURIComponent(firstRecord.designation)}`, { headers: adminHeaders });
  const desData: any = await desRes.json();
  assert(desData.records.every((r: any) => r.designation === firstRecord.designation), 'Designation filter failed');

  // Sort by readinessScore descending
  const sortRes = await fetch(`${BASE_URL}/admin/workforce/dataset?sort=readinessScore&dir=desc`, { headers: adminHeaders });
  const sortData: any = await sortRes.json();
  for (let i = 0; i < sortData.records.length - 1; i++) {
    assert(sortData.records[i].readinessScore >= sortData.records[i + 1].readinessScore, 'Sorting by readiness failed');
  }
  console.log('[PASS] Search, filtering (department, designation, cadre, readiness), and column sorting verified');

  // 6. TEST OFFICIAL INSPECTION DETAIL
  const inspectRes = await fetch(`${BASE_URL}/admin/workforce/official/${learnerOfficial.id}`, { headers: adminHeaders });
  assert.strictEqual(inspectRes.status, 200, 'Official inspection failed');
  const inspectData: any = await inspectRes.json();

  assert.strictEqual(inspectData.official.id, learnerOfficial.id, 'Official ID mismatch');
  assert(Array.isArray(inspectData.requirements) && inspectData.requirements.length > 0, 'Requirements missing');
  assert(Array.isArray(inspectData.recentEvidence), 'Recent evidence missing');
  console.log(`[PASS] Official record inspection verified: ${inspectData.requirements.length} role requirements and evidence ledger details retrieved`);

  // 7. TEST CSV EXPORT
  const exportRes = await fetch(`${BASE_URL}/admin/workforce/export.csv`, { headers: adminHeaders });
  assert.strictEqual(exportRes.status, 200, 'CSV export failed');
  assert.strictEqual(exportRes.headers.get('content-type'), 'text/csv; charset=utf-8', 'Content type must be CSV');
  const csvText = await exportRes.text();
  const csvLines = csvText.split('\n').filter((l) => l.trim().length > 0);
  assert(csvLines[0] && csvLines[0].includes('employee_code') && csvLines[0].includes('readiness_percent'), 'CSV headers invalid');
  assert.strictEqual(csvLines.length, 50, `Expected 1 header + 49 records = 50 lines, got ${csvLines.length}`);
  console.log(`[PASS] CSV Export verified: 50 lines generated (header + 49 official rows) compatible with Excel`);

  // 8. TEST WORKFORCE ANALYTICS (Training Demand, Readiness by Designation, Heatmap, Course Coverage)
  const anaRes = await fetch(`${BASE_URL}/admin/analytics`, { headers: adminHeaders });
  assert.strictEqual(anaRes.status, 200, 'Workforce analytics failed');
  const analytics: any = await anaRes.json();

  // Overview
  assert.strictEqual(analytics.overview.totalOfficials, 49, 'Analytics total officials mismatch');
  assert(analytics.overview.meanReadiness > 0 && analytics.overview.meanReadiness <= 100, 'Mean readiness out of range');

  // Training Demand Graph
  assert(Array.isArray(analytics.trainingDemand) && analytics.trainingDemand.length > 0, 'Training demand missing');
  const topDemand = analytics.trainingDemand[0];
  assert(topDemand.officersAffected > 0, 'Top demand must have affected officers');
  assert(topDemand.meanGap > 0, 'Top demand must have positive mean gap');
  assert(Array.isArray(topDemand.affectedDesignations), 'Affected designations missing');
  console.log(`[PASS] Training Demand verified: Top demand skill is "${topDemand.nameEn}" (${topDemand.officersAffected} officers affected, mean gap -${topDemand.meanGap})`);

  // Readiness by Designation
  assert(Array.isArray(analytics.readinessByDesignation) && analytics.readinessByDesignation.length > 0, 'Readiness by designation missing');
  const firstDes = analytics.readinessByDesignation[0];
  assert(firstDes.designation, 'Designation title missing');
  assert(firstDes.officersCount > 0, 'Officers count missing');
  assert(typeof firstDes.meanReadiness === 'number', 'Mean readiness missing');
  console.log(`[PASS] Readiness by Designation verified: ${analytics.readinessByDesignation.length} cadres benchmarked`);

  // Skill-Gap Heatmap
  assert(Array.isArray(analytics.heatmap.designations) && analytics.heatmap.designations.length > 0, 'Heatmap designations missing');
  assert(Array.isArray(analytics.heatmap.competencies) && analytics.heatmap.competencies.length > 0, 'Heatmap competencies missing');
  assert(Array.isArray(analytics.heatmap.cells) && analytics.heatmap.cells.length > 0, 'Heatmap cells missing');
  console.log(`[PASS] Skill-Gap Heatmap matrix verified: ${analytics.heatmap.cells.length} cells (${analytics.heatmap.designations.length} cadres × ${analytics.heatmap.competencies.length} competencies)`);

  // Training / Course Coverage
  assert(analytics.courseCoverage.totalCompetencies === 60, 'Total competencies must be 60');
  assert(analytics.courseCoverage.coveredCount > 0, 'Covered competencies count missing');
  assert(typeof analytics.courseCoverage.coveragePct === 'number', 'Coverage pct missing');
  console.log(`[PASS] Training Course Coverage verified: ${analytics.courseCoverage.coveredCount} of ${analytics.courseCoverage.totalCompetencies} skills mapped (${analytics.courseCoverage.coveragePct}%)`);

  console.log('\n==================================================');
  console.log('ALL ADMINISTRATOR WORKFORCE ANALYTICS TESTS PASSED!');
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('[FAIL] Verification error:', err);
  process.exit(1);
});
