// The doctor report (a Plus feature), built as HTML and turned into a PDF by expo-print.
// Pure functions only, so it can be unit tested in Node.

import {
  describeSchedule,
  formatTime,
  parseDateKey,
  summarizeDay,
  toDateKey,
  type HistoryLog,
  type Schedule,
} from './schedule.ts';

export type ReportMedication = {
  id: number;
  name: string;
  dose: string;
  form: string;
  notes: string;
  schedule: Schedule;
};

export type MedStats = {
  medicationId: number;
  taken: number;
  skipped: number;
  missed: number;
  /** Share of due doses taken, 0 to 100, or null if nothing was due. */
  adherence: number | null;
};

export type ReportEvent = { dateKey: string; time: string; medicationId: number; outcome: 'missed' | 'skipped' };

export type ReportData = {
  from: string;
  to: string;
  overall: { taken: number; skipped: number; missed: number; adherence: number | null };
  perMed: MedStats[];
  /** Missed and skipped scheduled doses, newest first. */
  problems: ReportEvent[];
  /** As-needed doses taken in the period, per medication. */
  asNeeded: { medicationId: number; times: string[] }[];
};

const pct = (taken: number, due: number) => (due === 0 ? null : Math.round((taken / due) * 100));

/** Totals for the `days` days ending today. Today's doses that aren't due yet are left out. */
export function buildReportData(meds: ReportMedication[], logs: HistoryLog[], now: Date, days: number): ReportData {
  const today = toDateKey(now);
  const per = new Map<number, MedStats>(
    meds.map((m) => [m.id, { medicationId: m.id, taken: 0, skipped: 0, missed: 0, adherence: null }]),
  );
  const problems: ReportEvent[] = [];
  let from = today;

  for (let i = 0; i < days; i++) {
    const d = parseDateKey(today);
    d.setDate(d.getDate() - i);
    const dateKey = toDateKey(d);
    from = dateKey;
    const day = summarizeDay(meds, logs, dateKey, now);
    for (const dose of day.doses) {
      const s = per.get(dose.medicationId);
      if (!s || dose.outcome === 'upcoming') continue;
      s[dose.outcome]++;
      if (dose.outcome !== 'taken') {
        problems.push({ dateKey, time: dose.time, medicationId: dose.medicationId, outcome: dose.outcome });
      }
    }
  }

  const perMed = [...per.values()].map((s) => ({ ...s, adherence: pct(s.taken, s.taken + s.skipped + s.missed) }));
  const taken = perMed.reduce((n, s) => n + s.taken, 0);
  const skipped = perMed.reduce((n, s) => n + s.skipped, 0);
  const missed = perMed.reduce((n, s) => n + s.missed, 0);

  const asNeededIds = new Set(meds.filter((m) => m.schedule.kind === 'as_needed').map((m) => m.id));
  const asNeeded = [...asNeededIds].map((id) => ({
    medicationId: id,
    times: logs
      .filter((l) => l.medicationId === id && l.status === 'taken' && l.slot.slice(0, 10) >= from && l.slot.slice(0, 10) <= today)
      .map((l) => l.slot.slice(0, 16))
      .sort()
      .reverse(),
  }));

  problems.sort((a, b) => (b.dateKey + b.time).localeCompare(a.dateKey + a.time));
  return { from, to: today, overall: { taken, skipped, missed, adherence: pct(taken, taken + skipped + missed) }, perMed, problems, asNeeded };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function longDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MAX_PROBLEM_ROWS = 60;

export function buildReportHtml(opts: {
  personName: string;
  meds: ReportMedication[];
  logs: HistoryLog[];
  now: Date;
  days: number;
}): string {
  const { personName, meds, logs, now, days } = opts;
  const data = buildReportData(meds, logs, now, days);
  const e = escapeHtml;
  const byId = new Map(meds.map((m) => [m.id, m]));
  const scheduled = meds.filter((m) => m.schedule.kind !== 'as_needed');
  const fmtPct = (v: number | null) => (v === null ? '–' : `${v}%`);

  const medRows = meds
    .map(
      (m) => `<tr><td><b>${e(m.name)}</b></td><td>${e(m.dose || '–')}</td><td>${e(m.form)}</td>` +
        `<td>${e(describeSchedule(m.schedule))}</td><td>${e(m.notes || '')}</td></tr>`,
    )
    .join('');

  const statRows = data.perMed
    .filter((s) => byId.get(s.medicationId)?.schedule.kind !== 'as_needed')
    .map((s) => {
      const m = byId.get(s.medicationId)!;
      return `<tr><td>${e(m.name)}</td><td class="n">${s.taken}</td><td class="n">${s.skipped}</td>` +
        `<td class="n">${s.missed}</td><td class="n"><b>${fmtPct(s.adherence)}</b></td></tr>`;
    })
    .join('');

  const problemRows = data.problems
    .slice(0, MAX_PROBLEM_ROWS)
    .map(
      (p) => `<tr><td>${longDate(p.dateKey)}</td><td>${e(formatTime(p.time))}</td>` +
        `<td>${e(byId.get(p.medicationId)?.name ?? '')}</td><td>${p.outcome === 'missed' ? 'Missed' : 'Skipped'}</td></tr>`,
    )
    .join('');
  const moreProblems = data.problems.length - MAX_PROBLEM_ROWS;

  const asNeededRows = data.asNeeded
    .map((a) => {
      const m = byId.get(a.medicationId)!;
      const recent = a.times.slice(0, 12).map((t) => `${longDate(t.slice(0, 10))} ${formatTime(t.slice(11, 16))}`);
      return `<tr><td>${e(m.name)}</td><td class="n">${a.times.length}</td><td>${e(recent.join(', ') || '–')}${a.times.length > 12 ? ' …' : ''}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; font-size: 11pt; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4px; color: #1E3A8A; }
  h2 { font-size: 13pt; margin: 22px 0 8px; color: #1E3A8A; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
  .sub { color: #475569; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  th { background: #F1F5F9; font-size: 9.5pt; text-transform: uppercase; letter-spacing: .03em; color: #334155; }
  td.n, th.n { text-align: right; }
  .cards { display: flex; gap: 10px; margin-top: 14px; }
  .card { flex: 1; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px; }
  .big { font-size: 20pt; font-weight: 700; }
  .muted { color: #64748B; font-size: 9.5pt; }
  .foot { margin-top: 26px; color: #64748B; font-size: 9pt; }
</style></head>
<body>
  <h1>Medication report</h1>
  <p class="sub"><b>${e(personName)}</b> · ${longDate(data.from)} to ${longDate(data.to)} (${days} days)</p>
  <p class="muted">Generated ${e(now.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))} with MediKeeper. Doses are recorded by the patient.</p>

  <div class="cards">
    <div class="card"><div class="big">${fmtPct(data.overall.adherence)}</div><div class="muted">of due doses taken</div></div>
    <div class="card"><div class="big">${data.overall.taken}</div><div class="muted">taken</div></div>
    <div class="card"><div class="big">${data.overall.missed}</div><div class="muted">missed</div></div>
    <div class="card"><div class="big">${data.overall.skipped}</div><div class="muted">skipped</div></div>
  </div>

  <h2>Current medications</h2>
  ${meds.length ? `<table><tr><th>Medication</th><th>Dose</th><th>Type</th><th>Schedule</th><th>Notes</th></tr>${medRows}</table>` : '<p class="muted">No medications.</p>'}

  ${scheduled.length ? `<h2>Doses by medication</h2>
  <table><tr><th>Medication</th><th class="n">Taken</th><th class="n">Skipped</th><th class="n">Missed</th><th class="n">Taken %</th></tr>${statRows}</table>` : ''}

  ${scheduled.length ? `<h2>Missed and skipped doses</h2>
  ${problemRows ? `<table><tr><th>Date</th><th>Time</th><th>Medication</th><th>What happened</th></tr>${problemRows}</table>` : '<p class="muted">None in this period.</p>'}
  ${moreProblems > 0 ? `<p class="muted">…and ${moreProblems} earlier.</p>` : ''}` : ''}

  ${asNeededRows ? `<h2>As-needed medicines taken</h2>
  <table><tr><th>Medication</th><th class="n">Times</th><th>Most recent</th></tr>${asNeededRows}</table>` : ''}

  <p class="foot">A dose not marked within an hour of its time is counted as missed. This report is a record kept by the
  patient and is not a medical assessment.</p>
</body></html>`;
}
