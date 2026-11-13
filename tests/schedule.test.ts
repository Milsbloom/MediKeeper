import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  daysBetween,
  describeSchedule,
  dosesOn,
  isScheduledOn,
  shiftTime,
  validateSchedule,
  type Schedule,
} from '../src/lib/schedule.ts';

const base: Schedule = {
  kind: 'daily',
  times: ['20:00', '08:00'],
  weekdays: [],
  intervalDays: 1,
  startDate: '2026-11-01',
};

test('daily schedule yields sorted slots', () => {
  assert.deepEqual(dosesOn(base, '2026-11-13'), [
    { slot: '2026-11-13 08:00', time: '08:00' },
    { slot: '2026-11-13 20:00', time: '20:00' },
  ]);
});

test('nothing before start date', () => {
  assert.equal(isScheduledOn(base, '2026-10-31'), false);
});

test('weekday schedule', () => {
  const s: Schedule = { ...base, kind: 'weekdays', weekdays: [1, 3, 5] }; // Mon Wed Fri
  assert.equal(isScheduledOn(s, '2026-11-13'), true); // Friday
  assert.equal(isScheduledOn(s, '2026-11-14'), false); // Saturday
});

test('interval schedule counts from start date', () => {
  const s: Schedule = { ...base, kind: 'interval', intervalDays: 3 };
  assert.equal(isScheduledOn(s, '2026-11-01'), true);
  assert.equal(isScheduledOn(s, '2026-11-02'), false);
  assert.equal(isScheduledOn(s, '2026-11-04'), true);
});

test('as needed never schedules', () => {
  assert.deepEqual(dosesOn({ ...base, kind: 'as_needed' }, '2026-11-13'), []);
});

test('daysBetween across DST change', () => {
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
});

test('validation', () => {
  assert.equal(validateSchedule(base), null);
  assert.match(validateSchedule({ ...base, times: [] })!, /time/);
  assert.match(validateSchedule({ ...base, kind: 'weekdays', weekdays: [] })!, /day/);
  assert.equal(validateSchedule({ ...base, kind: 'as_needed', times: [] }), null);
});

test('describe', () => {
  assert.equal(describeSchedule(base), 'Daily at 8:00 AM, 8:00 PM');
  assert.equal(describeSchedule({ ...base, kind: 'interval', intervalDays: 2, times: ['00:30'] }), 'Every 2 days at 12:30 AM');
});

test('shiftTime wraps', () => {
  assert.equal(shiftTime('23:45', 30), '00:15');
  assert.equal(shiftTime('00:00', -15), '23:45');
});

test('planReminders skips past and marked doses, adds repeats, caps', async () => {
  const { planReminders } = await import('../src/lib/schedule.ts');
  const med = { id: 7, schedule: { ...base, times: ['08:00', '20:00'] } };
  const now = new Date(2026, 10, 13, 9, 0); // 13 Nov 2026, 09:00 local
  const plan = planReminders([med], new Set(), now, { days: 2, repeatEvery: 10, repeatCount: 2, cap: 50 });
  assert.deepEqual(
    plan.map((p) => p.id),
    [
      'dose|7|2026-11-13 20:00|0',
      'dose|7|2026-11-13 20:00|1',
      'dose|7|2026-11-13 20:00|2',
      'dose|7|2026-11-14 08:00|0',
      'dose|7|2026-11-14 08:00|1',
      'dose|7|2026-11-14 08:00|2',
      'dose|7|2026-11-14 20:00|0',
      'dose|7|2026-11-14 20:00|1',
      'dose|7|2026-11-14 20:00|2',
    ],
  );
  // A 08:00 dose that is still unmarked at 08:15 keeps its 08:20 repeat.
  const early = new Date(2026, 10, 13, 8, 15);
  const p2 = planReminders([med], new Set(), early, { days: 1, repeatEvery: 10, repeatCount: 2, cap: 50 });
  assert.equal(p2[0].id, 'dose|7|2026-11-13 08:00|2');
  // Marked doses get nothing.
  const marked = new Set(['7|2026-11-13 20:00']);
  const p3 = planReminders([med], marked, now, { days: 1, repeatEvery: 0, repeatCount: 2, cap: 50 });
  assert.equal(p3.length, 0);
  // Cap keeps the soonest.
  const p4 = planReminders([med], new Set(), now, { days: 30, repeatEvery: 0, repeatCount: 0, cap: 3 });
  assert.equal(p4.length, 3);
  assert.equal(p4[0].slot, '2026-11-13 20:00');
});
