// On-device storage. Everything is kept as one small JSON document in AsyncStorage,
// which ships inside Expo Go, so the app runs there without a custom build.

import { toDateKey, type Schedule } from '@/lib/schedule';

export type MedForm = 'pill' | 'capsule' | 'liquid' | 'injection' | 'inhaler' | 'drops' | 'other';

/** A person whose medications are tracked: you, or someone you look after. */
export type Profile = {
  id: number;
  name: string;
  color: string;
};

export type Medication = {
  id: number;
  /** The person who takes it. */
  profileId: number;
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

export type Settings = {
  remindersOn: boolean;
  /** Minutes between repeat reminders while a dose is unmarked; 0 = no repeats. */
  repeatEvery: number;
  /** Minutes a Snooze pushes the reminder back. */
  snoozeMinutes: number;
  /** Has the person been through the first-launch welcome? */
  onboarded: boolean;
  /** Which person's medications the screens show; null shows everyone. */
  profileFilter: number | null;
  /** Last known MediKeeper Plus status, so Plus keeps working offline. */
  plusCached: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  remindersOn: true,
  repeatEvery: 10,
  snoozeMinutes: 10,
  onboarded: false,
  profileFilter: null,
  plusCached: false,
};

/** The first profile, created for everyone. It can be renamed but not deleted. */
export const OWNER_PROFILE_ID = 0;
export const PROFILE_COLORS = ['#2563EB', '#DB2777', '#059669', '#D97706', '#7C3AED', '#0891B2'];

type Data = {
  version: 1;
  nextId: number;
  profiles: Profile[];
  medications: Medication[];
  logs: DoseLog[];
  settings: Settings;
};

type Listener = () => void;
const listeners = new Set<Listener>();

/** Called after every saved change, so screens and reminders can refresh. */
export function onDataChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

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
  return {
    version: 1,
    nextId: 1,
    profiles: [{ id: OWNER_PROFILE_ID, name: 'Me', color: PROFILE_COLORS[0] }],
    medications: [],
    logs: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Brings data saved by an older version up to date. */
function migrate(data: Data): Data {
  if (!Array.isArray(data.profiles) || data.profiles.length === 0) {
    data.profiles = [{ id: OWNER_PROFILE_ID, name: 'Me', color: PROFILE_COLORS[0] }];
  }
  const ids = new Set(data.profiles.map((p) => p.id));
  for (const m of data.medications) {
    if (m.profileId == null || !ids.has(m.profileId)) m.profileId = data.profiles[0].id;
  }
  if (data.settings.profileFilter !== null && !ids.has(data.settings.profileFilter)) {
    data.settings.profileFilter = null;
  }
  return data;
}

async function load(): Promise<Data> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      let data = emptyData();
      try {
        const raw = await storage()?.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          data = migrate({ ...emptyData(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } });
        }
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
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.warn(e);
    }
  });
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

/** Medications, all of them or just one person's. */
export async function listMedications(profileId: number | null = null): Promise<Medication[]> {
  const data = await load();
  return clone(data.medications.filter((m) => profileId === null || m.profileId === profileId)).sort((a, b) =>
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

export async function getSettings(): Promise<Settings> {
  const data = await load();
  return { ...data.settings };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await mutate((data) => {
    data.settings = { ...data.settings, ...patch };
  });
}

/** "medId|slot" keys for every dose marked on or after the given day. */
export async function markedKeysSince(dateKey: string): Promise<Set<string>> {
  const data = await load();
  return new Set(data.logs.filter((l) => l.slot >= dateKey).map((l) => `${l.medicationId}|${l.slot}`));
}

/** Every dose ever logged, oldest first. */
export async function listAllLogs(): Promise<DoseLog[]> {
  const data = await load();
  return clone(data.logs).sort((a, b) => a.slot.localeCompare(b.slot));
}

// ---- Profiles (family members) ----

export async function listProfiles(): Promise<Profile[]> {
  const data = await load();
  return clone(data.profiles);
}

export async function createProfile(name: string, color: string): Promise<number> {
  return mutate((data) => {
    const id = data.nextId++;
    data.profiles.push({ id, name: name.trim(), color });
    return id;
  });
}

export async function updateProfile(id: number, name: string, color: string): Promise<void> {
  await mutate((data) => {
    const p = data.profiles.find((x) => x.id === id);
    if (p) {
      p.name = name.trim();
      p.color = color;
    }
  });
}

/** Removes a person with their medications and dose history. The first profile can't be removed. */
export async function deleteProfile(id: number): Promise<void> {
  if (id === OWNER_PROFILE_ID) return;
  await mutate((data) => {
    const medIds = new Set(data.medications.filter((m) => m.profileId === id).map((m) => m.id));
    data.profiles = data.profiles.filter((p) => p.id !== id);
    data.medications = data.medications.filter((m) => !medIds.has(m.id));
    data.logs = data.logs.filter((l) => !medIds.has(l.medicationId));
    if (data.settings.profileFilter === id) data.settings.profileFilter = null;
  });
}
