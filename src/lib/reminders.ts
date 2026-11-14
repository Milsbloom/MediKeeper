// Local reminder notifications. Nothing here talks to a server: every reminder is
// scheduled on the phone from the medication schedules.

import type * as NotificationsModule from './local-notifications';
import { Platform } from 'react-native';

import {
  getMedication,
  getSettings,
  listMedications,
  markedKeysSince,
  onDataChange,
  setDoseStatus,
} from '@/lib/db';
import { formatTime, planReminders, toDateKey } from '@/lib/schedule';

const CHANNEL_ID = 'reminders';
const CATEGORY_ID = 'dose';
export const ACTION_TAKE = 'take';
export const ACTION_SNOOZE = 'snooze';

/** Days ahead to keep scheduled. Topped up every time the app opens or data changes. */
const DAYS_AHEAD = 4;
/** iOS keeps at most 64 pending notifications per app; leave room for snoozes. */
const MAX_SCHEDULED = 56;
const REPEAT_COUNT = 3;

type ReminderData = { medicationId: number; slot: string };

type NotificationsApi = typeof NotificationsModule;
let api: NotificationsApi | null | undefined;

/**
 * Loads expo-notifications lazily. If the native module is missing (as happened with
 * SQLite in Expo Go), reminders switch off quietly instead of crashing the whole app.
 */
function notifications(): NotificationsApi | null {
  if (api !== undefined) return api;
  if (Platform.OS === 'web') return (api = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    api = require('./local-notifications') as NotificationsApi;
  } catch (e) {
    console.warn('Notifications are not available in this build.', e);
    api = null;
  }
  return api;
}

export type NotificationResponse = NotificationsModule.NotificationResponse;

let setupDone = false;
/** Android only: whether our own high-importance channel exists. */
let channelReady = false;

/**
 * Creates the Android "Medication reminders" channel. Expo Go rejects some channel
 * options, so fall back to the bare minimum, and if even that fails, use the default channel.
 */
async function createChannel(Notifications: NotificationsApi): Promise<boolean> {
  const attempts = [
    {
      name: 'Medication reminders',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      vibrationPattern: [0, 300, 200, 300],
    },
    { name: 'Medication reminders', importance: Notifications.AndroidImportance.HIGH },
  ];
  for (const options of attempts) {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, options);
      return true;
    } catch {
      // try the next, simpler set of options
    }
  }
  console.warn('Using the default notification channel for reminders.');
  return false;
}

/** Channel to post on, or undefined to let Android use its default. */
function channel(): { channelId?: string } {
  return Platform.OS === 'android' && channelReady ? { channelId: CHANNEL_ID } : {};
}

/** Call once at startup: foreground display, Android channel and the Take/Snooze buttons. */
export async function setupReminders(): Promise<void> {
  const Notifications = notifications();
  if (setupDone || !Notifications) return;
  setupDone = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') channelReady = await createChannel(Notifications);
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      { identifier: ACTION_TAKE, buttonTitle: 'Take', options: { opensAppToForeground: true } },
      { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze', options: { opensAppToForeground: true } },
    ]);
  } catch (e) {
    console.warn('Could not set up the Take and Snooze buttons.', e);
  }

  // Keep reminders in step with every change to medications or doses.
  onDataChange(() => {
    void syncReminders();
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getReminderPermission(): Promise<PermissionState> {
  const Notifications = notifications();
  if (!Notifications) return 'denied';
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/** Asks for permission if it hasn't been decided yet. Returns true when reminders can be shown. */
export async function ensureReminderPermission(): Promise<boolean> {
  const Notifications = notifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

let syncChain: Promise<void> = Promise.resolve();

/**
 * Brings the scheduled notifications in line with the current medications, settings and
 * dose marks. Safe to call often; calls are queued so they never overlap.
 */
export function syncReminders(): Promise<void> {
  syncChain = syncChain.then(doSync).catch((e) => console.warn('Reminder sync failed.', e));
  return syncChain;
}

async function doSync(): Promise<void> {
  const Notifications = notifications();
  if (!Notifications) return;
  const [settings, meds, marked, scheduled] = await Promise.all([
    getSettings(),
    listMedications(),
    markedKeysSince(toDateKey(new Date())),
    Notifications.getAllScheduledNotificationsAsync(),
  ]);

  const existing = new Set(scheduled.map((n) => n.identifier));
  // A snoozed dose waits for its snooze instead of its regular repeats.
  const snoozed = new Set(
    scheduled.filter((n) => n.identifier.startsWith('snooze|')).map((n) => n.identifier.split('|').slice(1).join('|')),
  );
  const fullPlan = settings.remindersOn
    ? planReminders(meds, marked, new Date(), {
        days: DAYS_AHEAD,
        repeatEvery: settings.repeatEvery,
        repeatCount: REPEAT_COUNT,
        cap: MAX_SCHEDULED,
      })
    : [];
  const plan = fullPlan.filter((p) => !snoozed.has(`${p.medicationId}|${p.slot}`));
  const wanted = new Set(plan.map((p) => p.id));

  // Drop reminders that are no longer needed: medication edited or deleted, dose marked,
  // settings changed. Snoozes go once their dose is marked or reminders are off.
  for (const n of scheduled) {
    const id = n.identifier;
    if (id.startsWith('dose|') && !wanted.has(id)) {
      await Notifications.cancelScheduledNotificationAsync(id);
    } else if (id.startsWith('snooze|')) {
      const [, medId, slot] = id.split('|');
      if (!settings.remindersOn || marked.has(`${medId}|${slot}`)) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }
  }

  const medsById = new Map(meds.map((m) => [m.id, m]));
  for (const p of plan) {
    if (existing.has(p.id)) continue;
    const med = medsById.get(p.medicationId);
    if (!med) continue;
    const time = formatTime(p.slot.slice(11, 16));
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.repeat === 0 ? `Time for ${med.name}` : `Reminder: ${med.name} not marked yet`,
        body: [med.dose, `due ${time}`].filter(Boolean).join(' · '),
        data: { medicationId: med.id, slot: p.slot } satisfies ReminderData,
        categoryIdentifier: CATEGORY_ID,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.at,
        ...channel(),
      },
    });
  }

  await dismissMarked(marked);
}

/** Clears reminders already sitting in the notification tray for doses that are now marked. */
async function dismissMarked(marked: Set<string>) {
  const Notifications = notifications();
  if (!Notifications) return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      const d = n.request.content.data as Partial<ReminderData> | undefined;
      if (d?.medicationId != null && d.slot && marked.has(`${d.medicationId}|${d.slot}`)) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {
    // Not supported everywhere; harmless to skip.
  }
}

async function snooze(data: ReminderData, minutes: number) {
  const Notifications = notifications();
  if (!Notifications) return;
  const med = await getMedication(data.medicationId);
  if (!med) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze|${data.medicationId}|${data.slot}`,
    content: {
      title: `Snoozed: ${med.name}`,
      body: [med.dose, `was due ${formatTime(data.slot.slice(11, 16))}`].filter(Boolean).join(' · '),
      data: { ...data },
      categoryIdentifier: CATEGORY_ID,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + minutes * 60_000),
      ...channel(),
    },
  });
}

const handled = new Set<string>();

/**
 * Acts on a tap or button press. Returns true when the dose was handled by a button,
 * false for a plain tap (the caller then just shows the Today screen).
 */
export async function handleNotificationResponse(r: NotificationResponse): Promise<boolean> {
  const Notifications = notifications();
  if (!Notifications) return false;
  // The same response can arrive from both the listener and the launch check.
  const key = `${r.notification.request.identifier}|${r.notification.date}|${r.actionIdentifier}`;
  if (handled.has(key)) return true;
  handled.add(key);

  const data = r.notification.request.content.data as Partial<ReminderData> | undefined;
  if (data?.medicationId == null || !data.slot) return false;
  const reminder: ReminderData = { medicationId: data.medicationId, slot: data.slot };

  try {
    await Notifications.dismissNotificationAsync(r.notification.request.identifier);
  } catch {
    // ignore
  }

  if (r.actionIdentifier === ACTION_TAKE) {
    await setDoseStatus(reminder.medicationId, reminder.slot, 'taken'); // triggers a sync
    return true;
  }
  if (r.actionIdentifier === ACTION_SNOOZE) {
    const settings = await getSettings();
    // Pause the remaining repeats for this dose while it's snoozed.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier.startsWith(`dose|${reminder.medicationId}|${reminder.slot}|`)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    await snooze(reminder, settings.snoozeMinutes);
    return true;
  }
  return false;
}

/** Fires a reminder in 5 seconds so the person can check sound, buttons and banners. */
export async function sendTestReminder(): Promise<void> {
  const Notifications = notifications();
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `test|${Date.now()}`,
    content: {
      title: 'Test reminder',
      body: 'This is how MediKeeper reminders will look.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      ...channel(),
    },
  });
}

/** Subscribes to taps and button presses on reminders. Returns an unsubscribe function. */
export function onNotificationResponse(listener: (r: NotificationResponse) => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(listener);
  return () => sub.remove();
}

/** The reminder that launched the app, if any. Cleared once read. */
export async function takeLaunchResponse(): Promise<NotificationResponse | null> {
  const Notifications = notifications();
  if (!Notifications) return null;
  const last = await Notifications.getLastNotificationResponseAsync();
  if (last) await Notifications.clearLastNotificationResponseAsync();
  return last;
}
