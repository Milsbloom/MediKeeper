import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Chip, ColorDot } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfiles } from '@/hooks/use-profiles';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_SETTINGS, getSettings, updateSettings, type Settings } from '@/lib/db';
import { FREE_PROFILE_LIMIT, usePlus } from '@/lib/plus';
import {
  ensureReminderPermission,
  getReminderPermission,
  sendTestReminder,
  type PermissionState,
} from '@/lib/reminders';

const REPEAT_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
];

const SNOOZE_OPTIONS = [5, 10, 15, 30];

export default function SettingsScreen() {
  const c = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [testSent, setTestSent] = useState(false);
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

  async function test() {
    if (!(await ensureReminderPermission())) return load();
    await sendTestReminder();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 6000);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Settings</ThemedText>

          <Pressable accessibilityRole="button" onPress={() => router.push('/plus')}>
            <Card style={{ borderWidth: 2, borderColor: plus ? c.success : c.tint }}>
              <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                {plus ? 'MediKeeper Plus is on ✓' : 'Get MediKeeper Plus'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {plus
                  ? 'Family profiles and doctor reports are unlocked. Thank you for supporting MediKeeper.'
                  : 'Family profiles and a PDF report for your doctor. Everything else stays free.'}
              </ThemedText>
            </Card>
          </Pressable>

          <Card>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>
              People
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Track medications for someone you look after, each with their own list and reminders.
            </ThemedText>
            {profiles.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${p.name}`}
                onPress={() => router.push({ pathname: '/profile/edit', params: { id: String(p.id) } })}
                style={styles.personRow}>
                <ColorDot color={p.color} size={16} />
                <ThemedText style={{ flex: 1 }}>{p.name}</ThemedText>
                <ThemedText themeColor="textSecondary">Edit ›</ThemedText>
              </Pressable>
            ))}
            <Button
              label={profiles.length >= FREE_PROFILE_LIMIT && !plus ? 'Add a person (Plus)' : 'Add a person'}
              variant="secondary"
              onPress={addPerson}
            />
          </Card>

          {permission !== 'granted' && (
            <Card>
              <ThemedText type="smallBold" style={{ color: c.warning }}>
                Notifications are turned off
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                MediKeeper can't remind you until you allow notifications.
              </ThemedText>
              <Button label={permission === 'denied' ? 'Open phone settings' : 'Allow notifications'} onPress={allow} />
            </Card>
          )}

          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                  Reminders
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  A notification at each dose time, with Take and Snooze buttons.
                </ThemedText>
              </View>
              <Switch value={settings.remindersOn} onValueChange={(v) => change({ remindersOn: v })} />
            </View>
          </Card>

          <Card>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>
              Remind me again if I don't respond
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Repeats up to 3 times until you mark the dose taken or skipped.
            </ThemedText>
            <View style={styles.wrap}>
              {REPEAT_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.value === 0 ? o.label : `Every ${o.label}`}
                  selected={settings.repeatEvery === o.value}
                  onPress={() => change({ repeatEvery: o.value })}
                />
              ))}
            </View>
          </Card>

          <Card>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>
              Snooze for
            </ThemedText>
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
          </Card>

          <Card>
            <ThemedText type="smallBold" style={{ fontSize: 17 }}>
              Check your reminders
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Sends a sample reminder in 5 seconds. Lock your phone to see it on the lock screen.
            </ThemedText>
            <Button
              label={testSent ? 'Sent, arriving in 5 seconds' : 'Send a test reminder'}
              variant="secondary"
              disabled={testSent}
              onPress={test}
            />
          </Card>

          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Reminders are scheduled on this phone and work without internet. If your phone uses battery
            saving, allow MediKeeper to run in the background so reminders aren't delayed.
          </ThemedText>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
