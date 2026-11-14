import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, ColorDot } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  clearDose,
  listMedications,
  logsForDay,
  onDataChange,
  setDoseStatus,
  storageUnavailable,
  type DoseLog,
  type DoseStatus,
  type Medication,
} from '@/lib/db';
import { dosesOn, formatTime, toDateKey } from '@/lib/schedule';

type Row = { med: Medication; slot: string; time: string; log?: DoseLog };

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TodayScreen() {
  const c = useTheme();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(() => toDateKey(new Date()));

  const load = useCallback(async () => {
    const day = toDateKey(new Date());
    setToday(day);
    const [m, l] = await Promise.all([listMedications(), logsForDay(day)]);
    setMeds(m);
    setLogs(l);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Refresh when a dose is marked from a notification button while this screen is open.
      const unsubscribe = onDataChange(() => {
        void load();
      });
      return () => {
        unsubscribe();
      };
    }, [load]),
  );

  const { scheduled, asNeeded } = useMemo(() => {
    const logByKey = new Map(logs.map((l) => [`${l.medicationId}|${l.slot}`, l]));
    const scheduled: Row[] = meds
      .flatMap((med) =>
        dosesOn(med.schedule, today).map((d) => ({
          med,
          slot: d.slot,
          time: d.time,
          log: logByKey.get(`${med.id}|${d.slot}`),
        })),
      )
      .sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name));
    const asNeeded = meds.filter((m) => m.schedule.kind === 'as_needed');
    return { scheduled, asNeeded };
  }, [meds, logs, today]);

  const done = scheduled.filter((r) => r.log).length;
  const current = nowTime();

  async function mark(row: Row, status: DoseStatus) {
    await setDoseStatus(row.med.id, row.slot, status);
    await load();
  }

  async function undo(row: Row) {
    await clearDose(row.med.id, row.slot);
    await load();
  }

  async function logAsNeeded(med: Medication) {
    // A seconds suffix keeps two doses in the same minute from colliding.
    const d = new Date();
    const slot = `${today} ${nowTime()}:${String(d.getSeconds()).padStart(2, '0')}`;
    await setDoseStatus(med.id, slot, 'taken');
    await load();
  }

  const headerDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View>
            <ThemedText type="subtitle">Today</ThemedText>
            <ThemedText themeColor="textSecondary">{headerDate}</ThemedText>
          </View>

          {loaded && storageUnavailable && (
            <Card>
              <ThemedText type="small" style={{ color: c.warning }}>
                Saving isn't available on this device, so changes will be lost when the app closes.
              </ThemedText>
            </Card>
          )}

          {loaded && meds.length === 0 && (
            <Card style={{ alignItems: 'center', paddingVertical: Spacing.five }}>
              <ThemedText style={{ textAlign: 'center' }}>Nothing scheduled yet.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Add a medication and its doses will appear here each day.
              </ThemedText>
              <Button label="Add medication" onPress={() => router.push('/med/edit')} />
            </Card>
          )}

          {scheduled.length > 0 && (
            <ThemedText type="smallBold" themeColor="textSecondary">
              {done} of {scheduled.length} doses done
            </ThemedText>
          )}

          {scheduled.map((row) => {
            const late = !row.log && row.time < current;
            return (
              <Card key={`${row.med.id}|${row.slot}`}>
                <View style={styles.rowHead}>
                  <ColorDot color={row.med.color} size={16} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                      {row.med.name}
                      {row.med.dose ? <ThemedText themeColor="textSecondary"> · {row.med.dose}</ThemedText> : null}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: late ? c.warning : c.textSecondary }}>
                      {formatTime(row.time)}
                      {late ? ' · not marked yet' : ''}
                    </ThemedText>
                  </View>
                  {row.log && (
                    <ThemedText
                      type="smallBold"
                      style={{ color: row.log.status === 'taken' ? c.success : c.textSecondary }}>
                      {row.log.status === 'taken' ? 'Taken ✓' : 'Skipped'}
                    </ThemedText>
                  )}
                </View>
                {row.log ? (
                  <Button label="Undo" variant="secondary" onPress={() => undo(row)} />
                ) : (
                  <View style={styles.actions}>
                    <Button label="Take" style={{ flex: 2 }} onPress={() => mark(row, 'taken')} />
                    <Button label="Skip" variant="secondary" style={{ flex: 1 }} onPress={() => mark(row, 'skipped')} />
                  </View>
                )}
              </Card>
            );
          })}

          {asNeeded.length > 0 && (
            <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
              As needed
            </ThemedText>
          )}
          {asNeeded.map((med) => {
            const taken = logs.filter((l) => l.medicationId === med.id && l.status === 'taken');
            return (
              <Card key={med.id}>
                <View style={styles.rowHead}>
                  <ColorDot color={med.color} size={16} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                      {med.name}
                      {med.dose ? <ThemedText themeColor="textSecondary"> · {med.dose}</ThemedText> : null}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {taken.length === 0
                        ? 'None taken today'
                        : `Taken today at ${taken.map((l) => formatTime(l.slot.slice(11, 16))).join(', ')}`}
                    </ThemedText>
                  </View>
                </View>
                <Button label="Log a dose now" variant="secondary" onPress={() => logAsNeeded(med)} />
              </Card>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
