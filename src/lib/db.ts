import type { SQLiteDatabase } from 'expo-sqlite';

import { toDateKey, type Schedule, type ScheduleKind } from '@/lib/schedule';

export const DATABASE_NAME = 'medikeeper.db';
const SCHEMA_VERSION = 1;

export type MedForm = 'pill' | 'capsule' | 'liquid' | 'injection' | 'inhaler' | 'drops' | 'other';

export type Medication = {
  id: number;
  name: string;
  dose: string;
  form: MedForm;
  color: string;
  notes: string;
  /** Units left, or null when the person doesn't track refills. */
  pillsLeft: number | null;
  /** Warn when pillsLeft is at or below this number. */
  refillAt: number;
  schedule: Schedule;
};

export type MedicationInput = Omit<Medication, 'id'>;

export type DoseStatus = 'taken' | 'skipped';

export type DoseLog = {
  id: number;
  medicationId: number;
  /** "YYYY-MM-DD HH:MM" for scheduled doses; for as-needed doses, the time it was logged. */
  slot: string;
  status: DoseStatus;
  loggedAt: string;
};

/** Runs once per app start inside SQLiteProvider, migrating the schema forward. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        dose TEXT NOT NULL DEFAULT '',
        form TEXT NOT NULL DEFAULT 'pill',
        color TEXT NOT NULL DEFAULT '#3B82F6',
        notes TEXT NOT NULL DEFAULT '',
        pills_left INTEGER,
        refill_at INTEGER NOT NULL DEFAULT 7,
        schedule_kind TEXT NOT NULL DEFAULT 'daily',
        times TEXT NOT NULL DEFAULT '[]',
        weekdays TEXT NOT NULL DEFAULT '[]',
        interval_days INTEGER NOT NULL DEFAULT 1,
        start_date TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS dose_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        slot TEXT NOT NULL,
        status TEXT NOT NULL,
        logged_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        UNIQUE (medication_id, slot)
      );
      CREATE INDEX IF NOT EXISTS idx_dose_logs_slot ON dose_logs (slot);
    `);
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

type MedRow = {
  id: number;
  name: string;
  dose: string;
  form: MedForm;
  color: string;
  notes: string;
  pills_left: number | null;
  refill_at: number;
  schedule_kind: ScheduleKind;
  times: string;
  weekdays: string;
  interval_days: number;
  start_date: string;
};

function parseJsonArray<T>(raw: string): T[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function fromRow(r: MedRow): Medication {
  return {
    id: r.id,
    name: r.name,
    dose: r.dose,
    form: r.form,
    color: r.color,
    notes: r.notes,
    pillsLeft: r.pills_left,
    refillAt: r.refill_at,
    schedule: {
      kind: r.schedule_kind,
      times: parseJsonArray<string>(r.times),
      weekdays: parseJsonArray<number>(r.weekdays),
      intervalDays: r.interval_days,
      startDate: r.start_date,
    },
  };
}

export async function listMedications(db: SQLiteDatabase): Promise<Medication[]> {
  const rows = await db.getAllAsync<MedRow>(
    'SELECT * FROM medications WHERE archived = 0 ORDER BY name COLLATE NOCASE',
  );
  return rows.map(fromRow);
}

export async function getMedication(db: SQLiteDatabase, id: number): Promise<Medication | null> {
  const row = await db.getFirstAsync<MedRow>('SELECT * FROM medications WHERE id = ?', id);
  return row ? fromRow(row) : null;
}

function params(m: MedicationInput) {
  return [
    m.name.trim(),
    m.dose.trim(),
    m.form,
    m.color,
    m.notes.trim(),
    m.pillsLeft,
    m.refillAt,
    m.schedule.kind,
    JSON.stringify(m.schedule.times),
    JSON.stringify(m.schedule.weekdays),
    m.schedule.intervalDays,
    m.schedule.startDate || toDateKey(new Date()),
  ];
}

export async function createMedication(db: SQLiteDatabase, m: MedicationInput): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO medications
      (name, dose, form, color, notes, pills_left, refill_at, schedule_kind, times, weekdays, interval_days, start_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...params(m),
  );
  return result.lastInsertRowId;
}

export async function updateMedication(db: SQLiteDatabase, id: number, m: MedicationInput): Promise<void> {
  await db.runAsync(
    `UPDATE medications SET
      name = ?, dose = ?, form = ?, color = ?, notes = ?, pills_left = ?, refill_at = ?,
      schedule_kind = ?, times = ?, weekdays = ?, interval_days = ?, start_date = ?
     WHERE id = ?`,
    ...params(m),
    id,
  );
}

export async function deleteMedication(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM medications WHERE id = ?', id);
}

/** All logs whose slot falls on the given day ("YYYY-MM-DD"). */
export async function logsForDay(db: SQLiteDatabase, dateKey: string): Promise<DoseLog[]> {
  return db.getAllAsync<DoseLog>(
    `SELECT id, medication_id AS medicationId, slot, status, logged_at AS loggedAt
     FROM dose_logs WHERE slot LIKE ? ORDER BY slot`,
    `${dateKey}%`,
  );
}

/**
 * Marks a dose taken or skipped. Taking a dose uses one unit from the refill count;
 * changing a taken dose to skipped gives it back.
 */
export async function setDoseStatus(
  db: SQLiteDatabase,
  medicationId: number,
  slot: string,
  status: DoseStatus,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const prev = await db.getFirstAsync<{ status: DoseStatus }>(
      'SELECT status FROM dose_logs WHERE medication_id = ? AND slot = ?',
      medicationId,
      slot,
    );
    await db.runAsync(
      `INSERT INTO dose_logs (medication_id, slot, status) VALUES (?, ?, ?)
       ON CONFLICT (medication_id, slot) DO UPDATE SET status = excluded.status,
         logged_at = datetime('now', 'localtime')`,
      medicationId,
      slot,
      status,
    );
    const delta = (status === 'taken' ? -1 : 0) - (prev?.status === 'taken' ? -1 : 0);
    if (delta !== 0) await adjustPills(db, medicationId, delta);
  });
}

/** Removes a dose mark, returning a unit to the refill count if it had been taken. */
export async function clearDose(db: SQLiteDatabase, medicationId: number, slot: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const prev = await db.getFirstAsync<{ status: DoseStatus }>(
      'SELECT status FROM dose_logs WHERE medication_id = ? AND slot = ?',
      medicationId,
      slot,
    );
    if (!prev) return;
    await db.runAsync('DELETE FROM dose_logs WHERE medication_id = ? AND slot = ?', medicationId, slot);
    if (prev.status === 'taken') await adjustPills(db, medicationId, 1);
  });
}

async function adjustPills(db: SQLiteDatabase, medicationId: number, delta: number) {
  await db.runAsync(
    'UPDATE medications SET pills_left = MAX(pills_left + ?, 0) WHERE id = ? AND pills_left IS NOT NULL',
    delta,
    medicationId,
  );
}
