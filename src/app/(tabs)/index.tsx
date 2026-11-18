import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { ProfileBar } from '@/components/profile-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, ColorDot, PillIcon, StatusPill } from '@/components/ui';
import { BottomTabInset, fontFor, MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfiles } from '@/hooks/use-profiles';
import { useTheme } from '@/hooks/use-theme';
import {
  clearDose,
  getSettings,
  listAllLogs,
  listMedications,
  onDataChange,
  setDoseStatus,
  storageUnavailable,
  type DoseLog,
  type DoseStatus,
  type Medication,
} from '@/lib/db';
import { dosesOn, formatTime, historyStats, slotToDate, toDateKey } from '@/lib/schedule';

type Row = { med: Medication; slot: string; time: string; log?: DoseLog };

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ago(slot: string): string {
  const mins = Math.max(0, Math.round((Date.now() - slotToDate(slot).getTime()) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min ago`;
}

export default function TodayScreen() {
  const c = useTheme();
  const { profiles, filter, setFilter, byId: profilesById, multiple } = useProfiles();
  const [allMeds, setMeds] = useState<Medication[]>([]);
  const [allLogs, setLogs] = useState<DoseLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState(() => toDateKey(new Date()));
  const [showEarlier, setShowEarlier] = useState(false);

  // First launch: show the welcome screen once.
  useEffect(() => {
    getSettings().then((s) => {
      if (!s.onboarded) router.push('/welcome');
    });
  }, []);

  const load = useCallback(async () => {
    setToday(toDateKey(new Date()));
    const [m, l] = await Promise.all([listMedications(), listAllLogs()]);
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

  const meds = useMemo(() => allMeds.filter((m) => filter === null || m.profileId === filter), [allMeds, filter]);
  const logs = useMemo(() => {
    const ids = new Set(meds.map((m) => m.id));
    return allLogs.filter((l) => ids.has(l.medicationId));
  }, [allLogs, meds]);
  const todayLogs = useMemo(() => logs.filter((l) => l.slot.startsWith(today)), [logs, today]);
  /** "Mum" when several people are shown together, so you know whose dose it is. */
  const whose = (med: Medication) => (multiple && filter === null ? profilesById.get(med.profileId)?.name : undefined);

  const { scheduled, asNeeded } = useMemo(() => {
    const logByKey = new Map(todayLogs.map((l) => [`${l.medicationId}|${l.slot}`, l]));
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
  }, [meds, todayLogs, today]);

  const streak = useMemo(() => historyStats(meds, logs, new Date(), 30).streak, [meds, logs]);

  const current = nowTime();
  const done = scheduled.filter((r) => r.log);
  const open = scheduled.filter((r) => !r.log);
  const dueNow = open.find((r) => r.time <= current);
  const rest = open.filter((r) => r !== dueNow);
  const taken = done.filter((r) => r.log?.status === 'taken').length;
  const next = rest.find((r) => r.time > current) ?? null;

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

  const headerDate = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '500' }}>
                {headerDate}
              </ThemedText>
              <ThemedText type="heading" style={{ fontSize: 28, lineHeight: 34 }}>
                {greeting(new Date().getHours())}
              </ThemedText>
            </View>
            {streak > 0 && (
              <View style={[styles.streak, { backgroundColor: c.warningSoft }]} accessibilityLabel={`${streak} day streak`}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c.warning} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-1-5 1-8Z" />
                </Svg>
                <ThemedText type="smallBold" style={{ color: c.warning, fontSize: 13 }}>
                  {streak} {streak === 1 ? 'day' : 'days'}
                </ThemedText>
              </View>
            )}
          </View>

          <ProfileBar profiles={profiles} filter={filter} onChange={setFilter} />

          {loaded && storageUnavailable && (
            <Card tone="coral">
              <ThemedText type="small" style={{ color: c.danger }}>
                Saving isn't available on this device, so changes will be lost when the app closes.
              </ThemedText>
            </Card>
          )}

          {loaded && meds.length === 0 && (
            <Card style={{ alignItems: 'center', paddingVertical: Spacing.five, gap: Spacing.three }}>
              <ThemedText type="heading" style={{ textAlign: 'center' }}>
                {filter !== null && allMeds.length > 0
                  ? `No medications for ${profilesById.get(filter)?.name ?? 'this person'} yet`
                  : 'Nothing scheduled yet'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Add a medication and its doses will appear here each day.
              </ThemedText>
              <Button label="Add medication" onPress={() => router.push('/med/edit')} style={{ alignSelf: 'stretch' }} />
            </Card>
          )}

          {scheduled.length > 0 && (
            <View style={[styles.progress, { backgroundColor: c.tint }]}>
              <ProgressRing done={done.length} total={scheduled.length} track={c.onTint} accent={c.gold} text={c.onTint} />
              <View style={{ flex: 1 }}>
                <ThemedText type="heading" style={{ color: c.onTint }}>
                  {open.length === 0
                    ? 'All done for today'
                    : taken === 0
                      ? 'Nothing taken yet'
                      : `${taken} ${taken === 1 ? 'dose' : 'doses'} taken so far`}
                </ThemedText>
                <ThemedText type="small" style={{ color: c.onTint, opacity: 0.8 }}>
                  {next
                    ? `Next up: ${next.med.name} at ${formatTime(next.time)}`
                    : open.length === 0
                      ? 'Nice work. See you tomorrow.'
                      : 'Everything left is due now.'}
                </ThemedText>
              </View>
            </View>
          )}

          {dueNow && (
            <Card tone="amber" style={{ gap: 14 }}>
              <View style={styles.between}>
                <ThemedText type="label" style={{ color: c.warning, fontWeight: '700' }}>
                  Due now · {ago(dueNow.slot)}
                </ThemedText>
                <ThemedText type="heading">{formatTime(dueNow.time)}</ThemedText>
              </View>
              <View style={styles.rowHead}>
                <PillIcon color={dueNow.med.color} size={52} tile={c.backgroundElement} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontSize: 19, lineHeight: 25, fontWeight: '600' }}>
                    {dueNow.med.name}
                    {dueNow.med.dose ? ` ${dueNow.med.dose}` : ''}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: c.warning }}>
                    {[whose(dueNow.med), dueNow.med.notes].filter(Boolean).join(' · ') || 'Tap Taken once you have had it'}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.actions}>
                <Button label="Taken" size="large" style={{ flex: 2 }} onPress={() => mark(dueNow, 'taken')} />
                <Button label="Skip" size="large" variant="secondary" style={{ flex: 1, borderWidth: 0 }} onPress={() => mark(dueNow, 'skipped')} />
              </View>
            </Card>
          )}

          {rest.length > 0 && (
            <>
              <ThemedText type="label" style={{ marginTop: Spacing.one }}>
                {dueNow ? 'Also today' : 'Later today'}
              </ThemedText>
              {rest.map((row) => {
                const late = row.time <= current;
                return (
                  <View
                    key={`${row.med.id}|${row.slot}`}
                    style={[styles.doseRow, { backgroundColor: c.backgroundElement, borderColor: late ? c.gold : c.border }]}>
                    <ThemedText type="heading" style={{ fontSize: 18, lineHeight: 22, width: 78, color: late ? c.warning : c.text }}>
                      {formatTime(row.time)}
                    </ThemedText>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 15, lineHeight: 20, fontWeight: '600' }} numberOfLines={1}>
                        {row.med.name}
                        {row.med.dose ? ` ${row.med.dose}` : ''}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 13 }}>
                        {[whose(row.med), late ? 'not marked yet' : row.med.notes].filter(Boolean).join(' · ') || ' '}
                      </ThemedText>
                    </View>
                    <Button label="Take" size="compact" variant="quiet" onPress={() => mark(row, 'taken')} />
                  </View>
                );
              })}
            </>
          )}

          {done.length > 0 && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showEarlier }}
                onPress={() => setShowEarlier((v) => !v)}
                style={[styles.earlier, { backgroundColor: c.tintSoft }]}>
                <ThemedText type="smallBold" style={{ color: c.success }}>
                  Earlier · {taken} taken{done.length > taken ? `, ${done.length - taken} skipped` : ''}
                </ThemedText>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.success} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: showEarlier ? '180deg' : '0deg' }] }}>
                  <Path d="M7 10l5 5 5-5" />
                </Svg>
              </Pressable>
              {showEarlier &&
                done.map((row) => (
                  <View key={`${row.med.id}|${row.slot}`} style={[styles.doneRow, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
                    <PillIcon color={row.med.color} size={40} />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 15, lineHeight: 20, fontWeight: '600' }} numberOfLines={1}>
                        {row.med.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                        {formatTime(row.time)}
                        {whose(row.med) ? ` · ${whose(row.med)}` : ''}
                      </ThemedText>
                    </View>
                    <StatusPill label={row.log?.status === 'taken' ? 'Taken' : 'Skipped'} tone={row.log?.status === 'taken' ? 'taken' : 'skipped'} />
                    <Button label="Undo" size="compact" variant="link" onPress={() => undo(row)} />
                  </View>
                ))}
            </>
          )}

          {asNeeded.length > 0 && (
            <ThemedText type="label" style={{ marginTop: Spacing.one }}>
              As needed
            </ThemedText>
          )}
          {asNeeded.map((med) => {
            const takenToday = todayLogs.filter((l) => l.medicationId === med.id && l.status === 'taken');
            return (
              <View key={med.id} style={[styles.asNeeded, { backgroundColor: c.backgroundElement, borderColor: c.borderStrong }]}>
                <ColorDot color={med.color} size={12} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontSize: 15, lineHeight: 20, fontWeight: '600' }} numberOfLines={1}>
                    {med.name}
                    {med.dose ? ` ${med.dose}` : ''}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }} numberOfLines={1}>
                    {whose(med) ? `${whose(med)} · ` : ''}
                    {takenToday.length === 0
                      ? 'None today'
                      : `Today at ${takenToday.map((l) => formatTime(l.slot.slice(11, 16))).join(', ')}`}
                  </ThemedText>
                </View>
                <Button label="Log dose" size="compact" variant="quiet" onPress={() => logAsNeeded(med)} />
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ProgressRing({ done, total, track, accent, text }: { done: number; total: number; track: string; accent: string; text: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const frac = total === 0 ? 0 : done / total;
  return (
    <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${done} of ${total} doses done`}>
      <Svg width={72} height={72} viewBox="0 0 72 72" style={StyleSheet.absoluteFill}>
        <Circle cx={36} cy={36} r={r} fill="none" stroke={track} strokeOpacity={0.2} strokeWidth={7} />
        <Circle
          cx={36}
          cy={36}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${circ * frac} ${circ}`}
          transform="rotate(-90 36 36)"
        />
      </Svg>
      <ThemedText style={{ color: text, fontFamily: fontFor('500', true), fontSize: 20, lineHeight: 24 }}>
        {done}/{total}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  streak: { height: 36, paddingHorizontal: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  progress: { borderRadius: 28, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  doseRow: { minHeight: 64, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  earlier: { height: 52, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doneRow: { minHeight: 60, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  asNeeded: { minHeight: 60, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
