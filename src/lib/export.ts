// Free, always-available export of the person's own dose history as a CSV file.

import { Platform, Share } from 'react-native';

import { listAllLogs, listMedications, listProfiles } from '@/lib/db';
import { csvCell, toDateKey } from '@/lib/schedule';

export async function buildHistoryCsv(): Promise<string> {
  const [meds, logs, profiles] = await Promise.all([listMedications(), listAllLogs(), listProfiles()]);
  const byId = new Map(meds.map((m) => [m.id, m]));
  const people = new Map(profiles.map((p) => [p.id, p.name]));
  const rows = [['Date', 'Time', 'Person', 'Medication', 'Dose', 'Status', 'Recorded at']];
  for (const l of logs) {
    const med = byId.get(l.medicationId);
    rows.push([
      l.slot.slice(0, 10),
      l.slot.slice(11, 16),
      med ? (people.get(med.profileId) ?? '') : '',
      med?.name ?? '(deleted)',
      med?.dose ?? '',
      l.status,
      l.loggedAt,
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/**
 * Saves the CSV to a file and opens the share sheet (save to Files, email, Drive...).
 * Falls back to sharing the text itself if file sharing isn't available.
 */
export async function shareHistoryCsv(): Promise<void> {
  const csv = await buildHistoryCsv();
  const fileName = `medikeeper-history-${toDateKey(new Date())}.csv`;

  if (Platform.OS !== 'web') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        const file = new File(Paths.cache, fileName);
        if (file.exists) file.delete();
        file.create();
        await file.write(csv);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          UTI: 'public.comma-separated-values-text',
          dialogTitle: 'Export dose history',
        });
        return;
      }
    } catch (e) {
      console.warn('File sharing unavailable, sharing as text instead.', e);
    }
  }
  await Share.share({ title: fileName, message: csv });
}
