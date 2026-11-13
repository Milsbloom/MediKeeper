// On-device storage. Everything is kept as one small JSON document in AsyncStorage,
// which ships inside Expo Go, so the app runs there without a custom build.

import { toDateKey, type Schedule } from '@/lib/schedule';

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

type Data = {
  version: 1;
  nextId: number;
  medications: Medication[];
  logs: DoseLog[];
};

const STORAGE_KEY = 'medikeeper.data.v1';

type KeyValue = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

let kv: KeyValue | null = null;
/** True when no persistent storage is available and data lives only in memory. */
export let storageUnavailable = false;

function storage(): KeyValue | null {
  if (kv || storageUnavailable) return kv;
  try {
    // Required lazily so a missing native module degrades instead of crashing the app.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    kv = require('@react-native-async-storage/async-storage').default as KeyValue;
  } catch (e) {
    console.warn('Persistent storage unavailable; using memory only.', e);
    storageUnavailable = true;
  }
  return kv;
}

let cache: Data | null = null;
let loading: Promise<Data> | null = null;

function emptyData(): Data {
  return { version: 1, nextId: 1, medications: [], logs: [] };
}

async function load(): Promise<Data> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      let data = emptyData();
      try {
        const raw = await storage()?.getItem(STORAGE_KEY);
        if (raw) data = { ...emptyData(), ...JSON.parse(raw) };
      } catch (e) {
        console.warn('Could not read saved data.', e);
        storageUnavailable = true;
      }
      cache = data;
      return data;
    })();
  }
  return loading;
}

// Writes are chained so two quick taps can't save out of order.
let writeChain: Promise<void> = Promise.resolve();

async function mutate<T>(fn: (data: Data) => T): Promise<T> {
  const data = await load();
  const result = fn(data);
  const snapshot = JSON.stringify(data);
  writeChain = writeChain.then(async () => {
    try {
      await storage()?.setItem(STORAGE_KEY, snapshot);
    } catch (e) {
      console.warn('Could not save data.', e);
      storageUnavailable = true;
    }
  });
  await writeChain;
  return result;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function nowLocal(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${toDateKey(d)} ${hh}:${mm}:${ss}`;
}

function normalize(m: MedicationInput): MedicationInput {
  return {
    ...m,
    name: m.name.trim(),
    dose: m.dose.trim(),
    notes: m.notes.trim(),
    schedule: { ...m.schedule, startDate: m.schedule.startDate || toDateKey(new Date()) },
  };
}

export async function listMedications(): Promise<Medication[]> {
  const data = await load();
  return clone(data.medications).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export async function getMedication(id: number): Promise<Medication | null> {
  const data = await load();
  const m = data.medications.find((x) => x.id === id);
  return m ? clone(m) : null;
}

export async function createMedication(input: MedicationInput): Promise<number> {
  return mutate((data) => {
    const id = data.nextId++;
    data.medications.push({ id, ...normalize(input) });
    return id;
  });
}

export async function updateMedication(id: number, input: MedicationInput): Promise<void> {
  await mutate((data) => {
    const i = data.medications.findIndex((m) => m.id === id);
    if (i >= 0) data.medications[i] = { id, ...normalize(input) };
  });
}

export async function deleteMedication(id: number): Promise<void> {
  await mutate((data) => {
    data.medications = data.medications.filter((m) => m.id !== id);
    data.logs = data.logs.filter((l) => l.medicationId !== id);
  });
}

/** All logs whose slot falls on the given day ("YYYY-MM-DD"). */
export async function logsForDay(dateKey: string): Promise<DoseLog[]> {
  const data = await load();
  return clone(data.logs.filter((l) => l.slot.startsWith(dateKey))).sort((a, b) =>
    a.slot.localeCompare(b.slot),
  );
}

function adjustPills(data: Data, medicationId: number, delta: number) {
  const m = data.medications.find((x) => x.id === medicationId);
  if (m && m.pillsLeft !== null) m.pillsLeft = Math.max(0, m.pillsLeft + delta);
}

/**
 * Marks a dose taken or skipped. Taking a dose uses one unit from the refill count;
 * changing a taken dose to skipped gives it back.
 */
export async function setDoseStatus(medicationId: number, slot: string, status: DoseStatus): Promise<void> {
  await mutate((data) => {
    const existing = data.logs.find((l) => l.medicationId === medicationId && l.slot === slot);
    const wasTaken = existing?.status === 'taken';
    if (existing) {
      existing.status = status;
      existing.loggedAt = nowLocal();
    } else {
      data.logs.push({ id: data.nextId++, medicationId, slot, status, loggedAt: nowLocal() });
    }
    const delta = (status === 'taken' ? -1 : 0) + (wasTaken ? 1 : 0);
    if (delta !== 0) adjustPills(data, medicationId, delta);
  });
}

/** Removes a dose mark, returning a unit to the refill count if it had been taken. */
export async function clearDose(medicationId: number, slot: string): Promise<void> {
  await mutate((data) => {
    const existing = data.logs.find((l) => l.medicationId === medicationId && l.slot === slot);
    if (!existing) return;
    data.logs = data.logs.filter((l) => l !== existing);
    if (existing.status === 'taken') adjustPills(data, medicationId, 1);
  });
}
