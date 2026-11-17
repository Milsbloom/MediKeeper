import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Chip, ColorDot, ListGroup, ListRow } from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { BottomTabInset, fontFor, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProfiles } from '@/hooks/use-profiles';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_SETTINGS, getSettings, updateSettings, type Settings } from '@/lib/db';
import { shareHistoryCsv } from '@/lib/export';
import { FREE_PROFILE_LIMIT, usePlus } from '@/lib/plus';
import {
  ensureReminderPermission,
  getOnTimeState,
  getReminderPermission,
  requestOnTimeReminders,
  sendTestReminder,
  type PermissionState,
} from '@/lib/reminders';

const REPEAT_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 5, label: 'Every 5 min' },
  { value: 10, label: 'Every 10 min' },
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
];

const SNOOZE_OPTIONS = [5, 10, 15, 30];

export default function SettingsScreen() {
  const c = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [testSent, setTestSent] = useState(false);
  const [onTime, setOnTime] = useState<'granted' | 'denied' | 'unneeded'>('unneeded');
  const { profiles } = useProfiles();
  const plus = usePlus();

  function addPerson() {
    if (profiles.length >= FREE_PROFILE_LIMIT && !plus) {
      router.push({ pathname: '/plus', params: { reason: 'family' } });
    } else {
      router.push('/profile/edit');
    }
  }

  const load = useCallback(async () => {
    setSettings(await getSettings());
    setPermission(await getReminderPermission().catch(() => 'denied' as const));
    setOnTime(await getOnTimeState());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function change(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }));
    await updateSettings(patch);
  }

  async function allow() {
    const ok = await ensureReminderPermission();
    if (!ok) await Linking.openSettings();
    await load();
  }

  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      await shareHistoryCsv();
    } finally {
      setExporting(false);
    }
  }

  async function test() {
    if (!(await ensureReminderPermission())) return load();
    await sendTestReminder();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 6000);
  }

  const tag = (label: string, tone: 'plus' | 'pine' | 'amber') => {
    const [bg, fg] = { plus: [c.gold, c.onGold], pine: [c.tintSoft, c.success], amber: [c.warningSoft, c.warning] }[tone];
    return (
      <View style={[styles.tag, { backgroundColor: bg }]}>
        <Text style={{ color: fg, fontFamily: fontFor('700'), fontSize: 12 }}>{label}</Text>
      </View>
    );
  };
  const value = (text: string) => (
    <Text style={{ color: c.textSecondary, fontFamily: fontFor('400'), fontSize: 15 }}>{text}</Text>
  );
  const hairline = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Settings</ThemedText>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/plus')}
            style={({ pressed }) => [styles.plusBanner, { backgroundColor: c.night, opacity: pressed ? 0.85 : 1 }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="heading" style={{ color: '#F3C66E', fontSize: 20 }}>
                MediKeeper Plus
              </ThemedText>
              <Text style={{ color: '#C9DDD4', fontFamily: fontFor('400'), fontSize: 13, marginTop: 2 }}>
                {plus ? 'Unlocked. Thank you for supporting MediKeeper.' : 'Family profiles and a report for your doctor.'}
              </Text>
            </View>
            <View style={[styles.plusButton, { backgroundColor: c.gold }]}>
              <Text style={{ color: c.onGold, fontFamily: fontFor('600'), fontSize: 14 }}>{plus ? 'On ✓' : 'See Plus'}</Text>
            </View>
          </Pressable>

          {permission !== 'granted' && (
            <Card tone="amber">
              <ThemedText type="smallBold" style={{ color: c.warning, fontSize: 16 }}>
                Notifications are turned off
              </ThemedText>
              <ThemedText type="small" themeColor="text">
                MediKeeper can't remind you until you allow notifications.
              </ThemedText>
              <Button label={permission === 'denied' ? 'Open phone settings' : 'Allow notifications'} onPress={allow} />
            </Card>
          )}

          {permission === 'granted' && onTime === 'denied' && (
            <Card tone="amber">
              <ThemedText type="smallBold" style={{ color: c.warning, fontSize: 16 }}>
                Reminders may arrive a few minutes late
              </ThemedText>
              <ThemedText type="small" themeColor="text">
                Allow "Alarms & reminders" for MediKeeper so Android shows each reminder right on time.
              </ThemedText>
              <Button
                label="Allow on-time reminders"
                onPress={async () => {
                  await requestOnTimeReminders();
                  await load();
                }}
              />
            </Card>
          )}

          <View>
            <ThemedText type="label" style={styles.groupLabel}>
              People
            </ThemedText>
            <ListGroup>
              {profiles.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${p.name}`}
                  onPress={() => router.push({ pathname: '/profile/edit', params: { id: String(p.id) } })}
                  style={({ pressed }) => [styles.line, hairline, { opacity: pressed ? 0.6 : 1 }]}>
                  <ColorDot color={p.color} size={14} />
                  <Text style={[styles.lineTitle, { color: c.text, flex: 1 }]}>{p.name}</Text>
                  {value('Edit')}
                </Pressable>
              ))}
              <ListRow
                title="Add a person"
                detail="Someone you look after, with their own list and reminders."
                right={profiles.length >= FREE_PROFILE_LIMIT && !plus ? tag('Plus', 'plus') : value('Add')}
                onPress={addPerson}
                last
              />
            </ListGroup>
          </View>

          <View>
            <ThemedText type="label" style={styles.groupLabel}>
              Reminders
            </ThemedText>
            <ListGroup>
              <ListRow
                title="Reminders"
                detail="A notification at each dose time, with Take and Snooze."
                right={
                  <Switch
                    value={settings.remindersOn}
                    onValueChange={(v) => change({ remindersOn: v })}
                    trackColor={{ true: c.tint, false: c.borderStrong }}
                    thumbColor="#FFFFFF"
                  />
                }
              />
              <View style={[styles.block, hairline]}>
                <Text style={[styles.lineTitle, { color: c.text }]}>Remind me again if I don't respond</Text>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13, lineHeight: 18 }}>
                  Up to 3 times, until you mark the dose taken or skipped.
                </ThemedText>
                <View style={styles.wrap}>
                  {REPEAT_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      label={o.label}
                      selected={settings.repeatEvery === o.value}
                      onPress={() => change({ repeatEvery: o.value })}
                    />
                  ))}
                </View>
              </View>
              <View style={[styles.block, hairline]}>
                <Text style={[styles.lineTitle, { color: c.text }]}>Snooze for</Text>
                <View style={styles.wrap}>
                  {SNOOZE_OPTIONS.map((m) => (
                    <Chip
                      key={m}
                      label={`${m} min`}
                      selected={settings.snoozeMinutes === m}
                      onPress={() => change({ snoozeMinutes: m })}
                    />
                  ))}
                </View>
              </View>
              <ListRow
                title="Send a test reminder"
                detail="Arrives in 5 seconds. Lock your phone to see it on the lock screen."
                right={testSent ? tag('Sent', 'pine') : value('Send')}
                onPress={testSent ? undefined : test}
                last
              />
            </ListGroup>
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Reminders are scheduled on this phone and work without internet. If your phone uses battery saving, allow
              MediKeeper to run in the background so reminders aren't delayed.
            </ThemedText>
          </View>

          <View>
            <ThemedText type="label" style={styles.groupLabel}>
              Your data
            </ThemedText>
            <ListGroup>
              <ListRow
                title={exporting ? 'Preparing…' : 'Export to CSV'}
                detail="Every dose you've logged, as a spreadsheet."
                right={tag('Free, always', 'pine')}
                onPress={exporting ? undefined : exportCsv}
                last
              />
            </ListGroup>
          </View>

          <View>
            <ThemedText type="label" style={styles.groupLabel}>
              About
            </ThemedText>
            <ListGroup>
              <ListRow title="Privacy" right={value('Data not collected')} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} />
              <ListRow title="Terms of use" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
              <ListRow title="Version" right={value(Constants.expoConfig?.version ?? '')} />
              <ListRow
                title="Not a substitute for medical advice"
                detail="MediKeeper is a reminder tool. Your data stays on this phone."
                last
              />
            </ListGroup>
          </View>
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
  plusBanner: {
    minHeight: 84,
    borderRadius: Radius.card,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  plusButton: { height: 40, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center' },
  groupLabel: { paddingHorizontal: 4, paddingBottom: 6 },
  line: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineTitle: { fontFamily: fontFor('600'), fontSize: 15 },
  block: { paddingVertical: 12, gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: 4 },
  note: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4, marginTop: 8 },
});
