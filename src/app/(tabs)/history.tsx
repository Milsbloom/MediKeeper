import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, ColorDot } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listAllLogs, listMedications, onDataChange, type DoseLog, type Medication } from '@/lib/db';
import { shareHistoryCsv } from '@/lib/export';
import {
  dayState,
  formatTime,
  historyStats,
  summarizeDay,
  toDateKey,
  type DayState,
  type DoseOutcome,
} from '@/lib/schedule';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function HistoryScreen() {
  const c = useTheme();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => toDateKey(new Date()));
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const [m, l] = await Promise.all([listMedications(), listAllLogs()]);
    setMeds(m);
    setLogs(l);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const unsubscribe = onDataChange(() => {
        void load();
      });
      return () => {
        unsubscribe();
      };
    }, [load]),
  );

  const now = new Date();
  const today = toDateKey(now);
  const stats = useMemo(() => historyStats(meds, logs, new Date(), 30), [meds, logs]);

  const days = useMemo(() => {
    const first = month.getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: ({ dateKey: string; day: number; state: DayState } | null)[] = Array(first).fill(null);
    for (let d = 1; d <= count; d++) {
      const dateKey = toDateKey(new Date(month.getFullYear(), month.getMonth(), d));
      const state = dateKey > today ? 'none' : dayState(summarizeDay(meds, logs, dateKey, new Date()));
      cells.push({ dateKey, day: d, state });
    }
    return cells;
  }, [month, meds, logs, today]);

  const daySummary = useMemo(() => summarizeDay(meds, logs, selected, new Date()), [meds, logs, selected]);
  const medsById = new Map(meds.map((m) => [m.id, m]));

  const stateColor: Record<DayState, string> = {
    perfect: c.success,
    partial: c.warning,
    missed: c.danger,
    pending: c.textSecondary,
    none: 'transparent',
  };
  const outcomeLabel: Record<DoseOutcome, { text: string; color: string }> = {
    taken: { text: 'Taken', color: c.success },
    skipped: { text: 'Skipped', color: c.textSecondary },
    missed: { text: 'Missed', color: c.danger },
    upcoming: { text: 'Not yet', color: c.textSecondary },
  };

  const isCurrentMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedLabel = new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  async function exportCsv() {
    setExporting(true);
    try {
      await shareHistoryCsv();
    } finally {
      setExporting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">History</ThemedText>

          <View style={styles.statsRow}>
            <Card style={styles.stat}>
              <ThemedText style={styles.statValue}>{stats.adherence === null ? '–' : `${stats.adherence}%`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                taken, last 30 days
              </ThemedText>
            </Card>
            <Card style={styles.stat}>
              <ThemedText style={styles.statValue}>{stats.streak}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {stats.streak === 1 ? 'day' : 'days'} in a row
              </ThemedText>
            </Card>
          </View>

          <Card>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                hitSlop={12}
                onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                <ThemedText style={styles.arrow}>‹</ThemedText>
              </Pressable>
              <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                {monthLabel}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                hitSlop={12}
                disabled={isCurrentMonth}
                onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                <ThemedText style={[styles.arrow, isCurrentMonth && { opacity: 0.25 }]}>›</ThemedText>
              </Pressable>
            </View>

            <View style={styles.grid}>
              {WEEKDAYS.map((w, i) => (
                <View key={`h${i}`} style={styles.cell}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {w}
                  </ThemedText>
                </View>
              ))}
              {days.map((d, i) =>
                d ? (
                  <Pressable
                    key={d.dateKey}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.dateKey}, ${d.state}`}
                    accessibilityState={{ selected: d.dateKey === selected }}
                    disabled={d.dateKey > today}
                    onPress={() => setSelected(d.dateKey)}
                    style={styles.cell}>
                    <View
                      style={[
                        styles.dayCircle,
                        d.dateKey === selected && { borderColor: c.tint, borderWidth: 2 },
                      ]}>
                      <ThemedText
                        type="small"
                        style={{ opacity: d.dateKey > today ? 0.3 : 1, fontWeight: d.dateKey === today ? '800' : '500' }}>
                        {d.day}
                      </ThemedText>
                      <View style={[styles.dot, { backgroundColor: stateColor[d.state] }]} />
                    </View>
                  </Pressable>
                ) : (
                  <View key={`e${i}`} style={styles.cell} />
                ),
              )}
            </View>

            <View style={styles.legend}>
              {(
                [
                  ['perfect', 'All taken'],
                  ['partial', 'Some missed'],
                  ['missed', 'All missed'],
                ] as const
              ).map(([state, label]) => (
                <View key={state} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: stateColor[state] }]} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {label}
                  </ThemedText>
                </View>
              ))}
            </View>
          </Card>

          <ThemedText type="smallBold" themeColor="textSecondary">
            {selected === today ? 'Today' : selectedLabel}
          </ThemedText>
          {daySummary.doses.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No scheduled doses on this day.
            </ThemedText>
          ) : (
            <Card>
              {daySummary.doses.map((d) => {
                const med = medsById.get(d.medicationId);
                const label = outcomeLabel[d.outcome];
                return (
                  <View key={`${d.medicationId}|${d.slot}`} style={styles.doseRow}>
                    <ColorDot color={med?.color ?? c.textSecondary} />
                    <ThemedText style={{ flex: 1 }}>
                      {med?.name ?? 'Deleted medication'}
                      <ThemedText themeColor="textSecondary"> · {formatTime(d.time)}</ThemedText>
                    </ThemedText>
                    <ThemedText type="smallBold" style={{ color: label.color }}>
                      {label.text}
                    </ThemedText>
                  </View>
                );
              })}
            </Card>
          )}

          <Card>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>
              Export your history
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              A spreadsheet (CSV) of every dose you've logged. It's your data, so this is always free.
            </ThemedText>
            <Button
              label={exporting ? 'Preparing…' : 'Export as CSV'}
              variant="secondary"
              disabled={exporting || logs.length === 0}
              onPress={exportCsv}
            />
          </Card>
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
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, alignItems: 'flex-start' },
  statValue: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { fontSize: 28, lineHeight: 32, paddingHorizontal: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  dayCircle: {
    width: 40,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 4 },
});
