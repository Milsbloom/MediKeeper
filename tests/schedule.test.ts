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
