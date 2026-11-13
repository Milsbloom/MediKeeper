// Pure scheduling logic. No React Native imports, so it can be unit tested with plain Node.

export type ScheduleKind = 'daily' | 'weekdays' | 'interval' | 'as_needed';

export type Schedule = {
  kind: ScheduleKind;
  /** Times of day as "HH:MM", 24-hour. Ignored for as_needed. */
  times: string[];
  /** Days of week, 0 = Sunday ... 6 = Saturday. Used when kind is 'weekdays'. */
  weekdays: number[];
  /** Every N days, counted from startDate. Used when kind is 'interval'. */
  intervalDays: number;
  /** First day of the schedule, "YYYY-MM-DD". */
  startDate: string;
};

export type DoseSlot = {
  /** "YYYY-MM-DD HH:MM" in local time; unique per medication. */
  slot: string;
  time: string;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(t: string): boolean {
  return TIME_RE.test(t);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole calendar days from a to b (b - a), immune to DST shifts. */
export function daysBetween(a: string, b: string): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

export function sortTimes(times: string[]): string[] {
  return [...new Set(times.filter(isValidTime))].sort();
}

/** Does this schedule have doses on the given day? */
export function isScheduledOn(schedule: Schedule, dateKey: string): boolean {
  if (schedule.kind === 'as_needed') return false;
  const offset = daysBetween(schedule.startDate, dateKey);
  if (offset < 0) return false;
  switch (schedule.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return schedule.weekdays.includes(parseDateKey(dateKey).getDay());
    case 'interval':
      return schedule.intervalDays >= 1 && offset % schedule.intervalDays === 0;
  }
}

/** The dose slots a schedule produces on one day, in time order. */
export function dosesOn(schedule: Schedule, dateKey: string): DoseSlot[] {
  if (!isScheduledOn(schedule, dateKey)) return [];
  return sortTimes(schedule.times).map((time) => ({ slot: `${dateKey} ${time}`, time }));
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatTime(t: string, use24h = false): string {
  if (use24h) return t;
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Short human description, e.g. "Daily at 8:00 AM, 8:00 PM". */
export function describeSchedule(s: Schedule): string {
  if (s.kind === 'as_needed') return 'As needed';
  const times = sortTimes(s.times).map((t) => formatTime(t)).join(', ');
  const at = times ? ` at ${times}` : '';
  switch (s.kind) {
    case 'daily':
      return `Daily${at}`;
    case 'weekdays': {
      const days = [...s.weekdays].sort().map((d) => DAY_NAMES[d]).join(', ');
      return `${days || 'No days'}${at}`;
    }
    case 'interval':
      return s.intervalDays === 1 ? `Daily${at}` : `Every ${s.intervalDays} days${at}`;
  }
}

/** Returns an error message, or null when the schedule is usable. */
export function validateSchedule(s: Schedule): string | null {
  if (s.kind === 'as_needed') return null;
  if (sortTimes(s.times).length === 0) return 'Add at least one reminder time.';
  if (s.kind === 'weekdays' && s.weekdays.length === 0) return 'Pick at least one day.';
  if (s.kind === 'interval' && (!Number.isInteger(s.intervalDays) || s.intervalDays < 1))
    return 'Repeat interval must be 1 day or more.';
  return null;
}

/** Step a "HH:MM" time by minutes, wrapping around midnight. */
export function shiftTime(t: string, minutes: number): string {
  const [h, m] = t.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
