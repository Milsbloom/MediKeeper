import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReportData, buildReportHtml, escapeHtml, type ReportMedication } from '../src/lib/report-html.ts';

const daily: ReportMedication = {
  id: 1,
  name: 'Metformin',
  dose: '500 mg',
  form: 'pill',
  notes: 'With food',
  schedule: { kind: 'daily', times: ['08:00'], weekdays: [], intervalDays: 1, startDate: '2026-11-10' },
};
const prn: ReportMedication = {
  id: 2,
  name: 'Ibuprofen',
  dose: '200 mg',
  form: 'pill',
  notes: '',
  schedule: { kind: 'as_needed', times: [], weekdays: [], intervalDays: 1, startDate: '2026-11-10' },
};
const now = new Date(2026, 10, 13, 7, 0); // 13 Nov, before today's 08:00 dose

const logs = [
  { medicationId: 1, slot: '2026-11-10 08:00', status: 'taken' as const },
  { medicationId: 1, slot: '2026-11-11 08:00', status: 'skipped' as const },
  // 12th: missed
  { medicationId: 2, slot: '2026-11-12 14:03:10', status: 'taken' as const },
  { medicationId: 2, slot: '2026-10-01 09:00:00', status: 'taken' as const }, // outside the period
];

test('report counts taken, skipped and missed, leaving out doses not due yet', () => {
  const r = buildReportData([daily, prn], logs, now, 30);
  assert.deepEqual(r.overall, { taken: 1, skipped: 1, missed: 1, adherence: 33 });
  assert.equal(r.to, '2026-11-13');
  assert.equal(r.from, '2026-10-15');
  assert.deepEqual(
    r.problems.map((p) => `${p.dateKey} ${p.outcome}`),
    ['2026-11-12 missed', '2026-11-11 skipped'],
  );
  assert.deepEqual(r.asNeeded, [{ medicationId: 2, times: ['2026-11-12 14:03'] }]);
});

test('report HTML escapes what the user typed', () => {
  assert.equal(escapeHtml('<b>"Tom" & Jerry\'s</b>'), '&lt;b&gt;&quot;Tom&quot; &amp; Jerry&#39;s&lt;/b&gt;');
  const html = buildReportHtml({
    personName: 'Mum <script>',
    meds: [{ ...daily, notes: '<img src=x>' }],
    logs,
    now,
    days: 30,
  });
  assert.ok(html.includes('Mum &lt;script&gt;'));
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('Metformin'));
  assert.ok(html.includes('33%'));
});
