// Makes the doctor report PDF (MediKeeper Plus) and opens the share sheet.

import { Platform } from 'react-native';

import { listAllLogs, listMedications, listProfiles, OWNER_PROFILE_ID } from '@/lib/db';
import { buildReportHtml } from '@/lib/report-html';
import { toDateKey } from '@/lib/schedule';

export const REPORT_PERIODS = [30, 90] as const;

export async function shareDoctorReport(profileId: number, days: number): Promise<void> {
  const [profiles, meds, logs] = await Promise.all([listProfiles(), listMedications(profileId), listAllLogs()]);
  const profile = profiles.find((p) => p.id === profileId);
  const medIds = new Set(meds.map((m) => m.id));
  const html = buildReportHtml({
    personName: profile && !(profile.id === OWNER_PROFILE_ID && profile.name === 'Me') ? profile.name : 'Patient',
    meds,
    logs: logs.filter((l) => medIds.has(l.medicationId)),
    now: new Date(),
    days,
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print') as typeof import('expo-print');
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, margins: { top: 36, bottom: 36, left: 36, right: 36 } });

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sharing = require('expo-sharing') as typeof import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      // Give the file a readable name instead of the random one expo-print picks.
      const slug = (profile?.name ?? 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
      const named = new File(Paths.cache, `medikeeper-${slug}-${toDateKey(new Date())}.pdf`);
      if (named.exists) named.delete();
      await new File(uri).copy(named);
      await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share report' });
      return;
    }
  } catch (e) {
    console.warn('Could not share the PDF file, opening print instead.', e);
  }
  await Print.printAsync({ uri });
}
