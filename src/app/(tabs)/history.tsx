import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ProfileBar } from '@/components/profile-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Chip, ListGroup, ListRow, StatusPill } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProfiles } from '@/hooks/use-profiles';
import { useTheme } from '@/hooks/use-theme';
import { listAllLogs, listMedications, onDataChange, type DoseLog, type Medication } from '@/lib/db';
import { shareHistoryCsv } from '@/lib/export';
import { usePlus } from '@/lib/plus';
import { REPORT_PERIODS, shareDoctorReport } from '@/lib/report';
import {
  dayState,
  formatTime,
  historyStats,
  summarizeDay,
  toDateKey,
  type DayState,
  type DoseOutcome,
} from '@/lib/schedule';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A calendar day's colour. "skipped" is a day where nothing was taken but nothing was missed either. */
type CellState = DayState | 'skipped';

function Chevron({ dir, color }: { dir: 'left' | 'right'; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </Svg>
  );
}

export default function HistoryScreen() {
  const c = useTheme();
  const { profiles, filter, setFilter, byId: profilesById, multiple } = useProfiles();
  const plus = usePlus();
  const [allMeds, setMeds] = useState<Medication[]>([]);
  const [allLogs, setLogs] = useState<DoseLog[]>([]);
  const [reportDays, setReportDays] = useState<number>(REPORT_PERIODS[0]);
  const [reportFor, setReportFor] = useState<number | null>(null);
  const [making, setMaking] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Everything below shows the selected person only (or everyone).
  const meds = useMemo(() => allMeds.filter((m) => filter === null || m.profileId === filter), [allMeds, filter]);
  const logs = useMemo(() => {
    const ids = new Set(meds.map((m) => m.id));
    return allLogs.filter((l) => ids.has(l.medicationId));
  }, [allLogs, meds]);
  // A report is about one person: the one selected, or the only/first one.
  const reportPerson = filter ?? reportFor ?? profiles[0]?.id ?? 0;
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
    // Weeks start on Monday, as in the design.
    const first = (month.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: ({ dateKey: string; day: number; state: CellState } | null)[] = Array(first).fill(null);
    for (let d = 1; d <= count; d++) {
      const dateKey = toDateKey(new Date(month.getFullYear(), month.getMonth(), d));
      let state: CellState = 'none';
      if (dateKey <= today) {
        const summary = summarizeDay(meds, logs, dateKey, new Date());
        state = dayState(summary);
        if (state === 'missed' && summary.missed === 0) state = 'skipped';
      }
      cells.push({ dateKey, day: d, state });
    }
    return cells;
  }, [month, meds, logs, today]);

  const daySummary = useMemo(() => summarizeDay(meds, logs, selected, new Date()), [meds, logs, selected]);
  const medsById = new Map(meds.map((m) => [m.id, m]));

  const cellLook: Record<CellState, [string, string]> = {
    perfect: [c.tintSoft, c.success],
    partial: [c.warningSoft, c.warning],
    missed: [c.dangerSoft, c.danger],
    skipped: [c.stone, c.textSecondary],
    pending: ['transparent', c.text],
    none: ['transparent', c.textSecondary],
  };
  const outcomeLabel: Record<DoseOutcome, { text: string; tone: 'taken' | 'due' | 'missed' | 'skipped' }> = {
    taken: { text: 'Taken', tone: 'taken' },
    skipped: { text: 'Skipped', tone: 'skipped' },
    missed: { text: 'Missed', tone: 'missed' },
    upcoming: { text: 'Not yet', tone: 'due' },
  };

  const isCurrentMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedLabel = new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  async function makeReport() {
    if (!plus) {
      router.push({ pathname: '/plus', params: { reason: 'report' } });
      return;
    }
    setMaking(true);
    setReportError(null);
    try {
      await shareDoctorReport(reportPerson, reportDays);
    } catch (e) {
      console.warn(e);
      setReportError("Couldn't make the report. Please try again.");
    } finally {
      setMaking(false);
    }
  }

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
          <ProfileBar profiles={profiles} filter={filter} onChange={setFilter} />

          <View style={[styles.stats, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
            {(
              [
                [String(stats.streak), 'day streak', c.tint],
                [stats.adherence === null ? '–' : `${stats.adherence}%`, 'last 30 days', c.text],
                [String(stats.taken), 'doses taken', c.text],
              ] as const
            ).map(([value, label, color], i) => (
              <View key={label} style={[styles.stat, i < 2 && { borderRightWidth: 1, borderRightColor: c.border }]}>
                <ThemedText type="number" style={{ color }}>
                  {value}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                  {label}
                </ThemedText>
              </View>
            ))}
          </View>

          <View>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={styles.arrow}
                onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                <Chevron dir="left" color={c.text} />
              </Pressable>
              <ThemedText type="heading">{monthLabel}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={styles.arrow}
                disabled={isCurrentMonth}
                onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                <Chevron dir="right" color={isCurrentMonth ? c.borderStrong : c.text} />
              </Pressable>
            </View>

            <View style={styles.grid}>
              {WEEKDAYS.map((w, i) => (
                <View key={`h${i}`} style={[styles.cell, { height: 22 }]}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={{ fontSize: 12 }}>
                    {w}
                  </ThemedText>
                </View>
              ))}
              {days.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={styles.cell} />;
                const isToday = d.dateKey === today;
                const [bg, fg] = isToday ? [c.tint, c.onTint] : cellLook[d.state];
                const future = d.dateKey > today;
                return (
                  <View key={d.dateKey} style={styles.cell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${d.dateKey}, ${d.state}`}
                      accessibilityState={{ selected: d.dateKey === selected }}
                      disabled={future}
                      onPress={() => setSelected(d.dateKey)}
                      style={[
                        styles.day,
                        { backgroundColor: bg },
                        d.dateKey === selected && !isToday && { borderWidth: 2, borderColor: c.text },
                      ]}>
                      <ThemedText style={{ color: fg, fontSize: 15, lineHeight: 20, fontWeight: '600', opacity: future ? 0.5 : 1 }}>
                        {d.day}
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.legend}>
              {(
                [
                  ['perfect', 'All taken'],
                  ['partial', 'Some missed'],
                  ['missed', 'Missed'],
                  ['skipped', 'Skipped'],
                ] as const
              ).map(([state, label]) => (
                <View key={state} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: cellLook[state][0] }]} />
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                    {label}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>

          <ThemedText type="label">{selected === today ? 'Today' : selectedLabel}</ThemedText>
          {daySummary.doses.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No scheduled doses on this day.
            </ThemedText>
          ) : (
            <ListGroup>
              {daySummary.doses.map((d, i) => {
                const med = medsById.get(d.medicationId);
                const label = outcomeLabel[d.outcome];
                return (
                  <ListRow
                    key={`${d.medicationId}|${d.slot}`}
                    title={med?.name ?? 'Deleted medication'}
                    detail={formatTime(d.time)}
                    right={<StatusPill label={label.text} tone={label.tone} />}
                    last={i === daySummary.doses.length - 1}
                  />
                );
              })}
            </ListGroup>
          )}

          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              <ThemedText type="heading" style={{ flex: 1 }}>
                Report for your doctor
              </ThemedText>
              {!plus && (
                <View style={[styles.plusTag, { backgroundColor: c.gold }]}>
                  <ThemedText type="smallBold" style={{ color: c.onGold, fontSize: 12, lineHeight: 16 }}>
                    PLUS
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              A PDF of current medications, doses taken and missed, ready to share or print before an appointment.
            </ThemedText>
            {multiple && filter === null && (
              <View style={styles.chips}>
                {profiles.map((p) => (
                  <Chip key={p.id} label={p.name} selected={reportPerson === p.id} onPress={() => setReportFor(p.id)} />
                ))}
              </View>
            )}
            <View style={styles.chips}>
              {REPORT_PERIODS.map((d) => (
                <Chip key={d} label={`Last ${d} days`} selected={reportDays === d} onPress={() => setReportDays(d)} />
              ))}
            </View>
            <Button
              label={
                making
                  ? 'Making the report…'
                  : plus
                    ? `Create PDF${multiple ? ` for ${profilesById.get(reportPerson)?.name ?? ''}` : ''}`
                    : 'Unlock with Plus'
              }
              variant={plus ? 'primary' : 'plus'}
              disabled={making || (plus === true && !allMeds.some((m) => m.profileId === reportPerson))}
              onPress={makeReport}
            />
            {reportError && <ThemedText type="small" style={{ color: c.danger }}>{reportError}</ThemedText>}
          </Card>

          <Card>
            <ThemedText type="heading">Export your history</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              A spreadsheet (CSV) of every dose you've logged. It's your data, so this is always free.
            </ThemedText>
            <Button
              label={exporting ? 'Preparing…' : 'Export as CSV'}
              variant="secondary"
              disabled={exporting || allLogs.length === 0}
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
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  stats: { flexDirection: 'row', borderRadius: Radius.card, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 8 },
  stat: { flex: 1, alignItems: 'center' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -8 },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingHorizontal: 2 },
  day: { alignSelf: 'stretch', height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  plusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
