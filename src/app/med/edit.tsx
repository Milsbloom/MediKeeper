import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Chip, ColorDot } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createMedication,
  deleteMedication,
  getMedication,
  getSettings,
  listProfiles,
  OWNER_PROFILE_ID,
  updateMedication,
  type Profile,
  type MedForm,
  type MedicationInput,
} from '@/lib/db';
import { ensureReminderPermission } from '@/lib/reminders';
import { formatTime, shiftTime, sortTimes, toDateKey, validateSchedule, type ScheduleKind } from '@/lib/schedule';

const FORMS: { value: MedForm; label: string }[] = [
  { value: 'pill', label: 'Pill' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'injection', label: 'Injection' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'drops', label: 'Drops' },
  { value: 'other', label: 'Other' },
];

const KINDS: { value: ScheduleKind; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Specific days' },
  { value: 'interval', label: 'Every few days' },
  { value: 'as_needed', label: 'As needed' },
];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6B7280'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function emptyMed(): MedicationInput {
  return {
    profileId: OWNER_PROFILE_ID,
    name: '',
    dose: '',
    form: 'pill',
    color: COLORS[0],
    notes: '',
    pillsLeft: null,
    refillAt: 7,
    schedule: {
      kind: 'daily',
      times: ['08:00'],
      weekdays: [1, 2, 3, 4, 5],
      intervalDays: 2,
      startDate: toDateKey(new Date()),
    },
  };
}

export default function EditMedicationScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;

  const [med, setMed] = useState<MedicationInput>(emptyMed);
  const [trackRefills, setTrackRefills] = useState(false);
  const [pillsText, setPillsText] = useState('');
  const [refillText, setRefillText] = useState('7');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    listProfiles().then(setProfiles);
    if (editingId !== null) return;
    // A new medication belongs to whoever the list is showing.
    getSettings().then((st) => {
      if (st.profileFilter !== null) setMed((m) => ({ ...m, profileId: st.profileFilter! }));
    });
  }, [editingId]);

  useEffect(() => {
    if (editingId === null) return;
    getMedication(editingId).then((m) => {
      if (!m) return;
      const { id: _ignored, ...rest } = m;
      setMed(rest);
      setTrackRefills(m.pillsLeft !== null);
      setPillsText(m.pillsLeft !== null ? String(m.pillsLeft) : '');
      setRefillText(String(m.refillAt));
    });
  }, [editingId]);

  const s = med.schedule;
  const setSchedule = (patch: Partial<MedicationInput['schedule']>) =>
    setMed((m) => ({ ...m, schedule: { ...m.schedule, ...patch } }));

  function addTime() {
    const times = sortTimes(s.times);
    const last = times[times.length - 1];
    const next = last ? shiftTime(last, 4 * 60) : '08:00';
    setSchedule({ times: sortTimes([...times, next]) });
  }

  function changeTime(index: number, minutes: number) {
    const times = [...s.times];
    times[index] = shiftTime(times[index], minutes);
    setSchedule({ times });
  }

  function removeTime(index: number) {
    setSchedule({ times: s.times.filter((_, i) => i !== index) });
  }

  function toggleDay(day: number) {
    const has = s.weekdays.includes(day);
    setSchedule({ weekdays: has ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day].sort() });
  }

  async function save() {
    if (!med.name.trim()) return setError('Give the medication a name.');
    const scheduleError = validateSchedule(s);
    if (scheduleError) return setError(scheduleError);

    let pillsLeft: number | null = null;
    let refillAt = 7;
    if (trackRefills) {
      pillsLeft = Number.parseInt(pillsText, 10);
      refillAt = Number.parseInt(refillText, 10);
      if (!Number.isFinite(pillsLeft) || pillsLeft < 0) return setError('Enter how many you have left.');
      if (!Number.isFinite(refillAt) || refillAt < 0) return setError('Enter when to warn you about a refill.');
    }

    const input: MedicationInput = {
      ...med,
      pillsLeft,
      refillAt,
      schedule: { ...s, times: s.kind === 'as_needed' ? [] : sortTimes(s.times) },
    };

    setSaving(true);
    try {
      if (editingId === null) {
        await createMedication(input);
        // Ask for notification permission the first time it's actually needed.
        if (input.schedule.kind !== 'as_needed') await ensureReminderPermission().catch(() => false);
      }
      else await updateMedication(editingId, input);
      router.back();
    } catch (e) {
      setError('Could not save. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (editingId === null) return;
    Alert.alert('Delete medication?', `${med.name} and its dose history will be removed from this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMedication(editingId);
          router.back();
        },
      },
    ]);
  }

  const inputStyle = [styles.input, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.border }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: editingId === null ? 'Add medication' : 'Edit medication' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Section title="Name">
            <TextInput
              style={inputStyle}
              placeholder="e.g. Metformin"
              placeholderTextColor={c.textSecondary}
              value={med.name}
              onChangeText={(name) => setMed((m) => ({ ...m, name }))}
              autoFocus={editingId === null}
            />
          </Section>

          {profiles.length > 1 && (
            <Section title="Who takes it">
              <View style={styles.wrap}>
                {profiles.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    selected={med.profileId === p.id}
                    onPress={() => setMed((m) => ({ ...m, profileId: p.id }))}
                  />
                ))}
              </View>
            </Section>
          )}

          <Section title="Dose">
            <TextInput
              style={inputStyle}
              placeholder="e.g. 500 mg, 1 tablet"
              placeholderTextColor={c.textSecondary}
              value={med.dose}
              onChangeText={(dose) => setMed((m) => ({ ...m, dose }))}
            />
          </Section>

          <Section title="Type">
            <View style={styles.wrap}>
              {FORMS.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label}
                  selected={med.form === f.value}
                  onPress={() => setMed((m) => ({ ...m, form: f.value }))}
                />
              ))}
            </View>
          </Section>

          <Section title="Colour">
            <View style={styles.wrap}>
              {COLORS.map((color) => (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={`Colour ${color}`}
                  accessibilityState={{ selected: med.color === color }}
                  onPress={() => setMed((m) => ({ ...m, color }))}
                  style={[styles.swatch, { borderColor: med.color === color ? c.text : 'transparent' }]}>
                  <ColorDot color={color} size={28} />
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="How often">
            <View style={styles.wrap}>
              {KINDS.map((k) => (
                <Chip key={k.value} label={k.label} selected={s.kind === k.value} onPress={() => setSchedule({ kind: k.value })} />
              ))}
            </View>

            {s.kind === 'weekdays' && (
              <View style={[styles.wrap, { marginTop: Spacing.two }]}>
                {DAYS.map((d, i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={DAY_LABELS[i]}
                    accessibilityState={{ selected: s.weekdays.includes(i) }}
                    onPress={() => toggleDay(i)}
                    style={[
                      styles.day,
                      { backgroundColor: s.weekdays.includes(i) ? c.tint : c.backgroundElement },
                    ]}>
                    <ThemedText style={{ color: s.weekdays.includes(i) ? c.onTint : c.text, fontWeight: '700' }}>
                      {d}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            {s.kind === 'interval' && (
              <View style={[styles.stepperRow, { marginTop: Spacing.two }]}>
                <ThemedText>Every</ThemedText>
                <Button label="−" variant="secondary" onPress={() => setSchedule({ intervalDays: Math.max(1, s.intervalDays - 1) })} />
                <ThemedText type="smallBold" style={{ fontSize: 18, minWidth: 24, textAlign: 'center' }}>
                  {s.intervalDays}
                </ThemedText>
                <Button label="+" variant="secondary" onPress={() => setSchedule({ intervalDays: s.intervalDays + 1 })} />
                <ThemedText>days, starting today</ThemedText>
              </View>
            )}
          </Section>

          {s.kind !== 'as_needed' && (
            <Section title="Reminder times">
              {s.times.map((t, i) => (
                <View key={i} style={[styles.timeRow, { backgroundColor: c.backgroundElement }]}>
                  <Button label="−1h" variant="secondary" style={styles.compact} onPress={() => changeTime(i, -60)} />
                  <Button label="−15" variant="secondary" style={styles.compact} onPress={() => changeTime(i, -15)} />
                  <ThemedText type="smallBold" style={styles.timeText}>
                    {formatTime(t)}
                  </ThemedText>
                  <Button label="+15" variant="secondary" style={styles.compact} onPress={() => changeTime(i, 15)} />
                  <Button label="+1h" variant="secondary" style={styles.compact} onPress={() => changeTime(i, 60)} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Remove time" onPress={() => removeTime(i)} hitSlop={8}>
                    <ThemedText style={{ color: c.danger, fontSize: 20, paddingHorizontal: 4 }}>✕</ThemedText>
                  </Pressable>
                </View>
              ))}
              <Button label="Add a time" variant="secondary" onPress={addTime} />
            </Section>
          )}

          <Section title="Refills">
            <View style={styles.switchRow}>
              <ThemedText style={{ flex: 1 }}>Track how many I have left</ThemedText>
              <Switch value={trackRefills} onValueChange={setTrackRefills} />
            </View>
            {trackRefills && (
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <View style={{ flex: 1, gap: Spacing.one }}>
                  <ThemedText type="small" themeColor="textSecondary">Left now</ThemedText>
                  <TextInput style={inputStyle} keyboardType="number-pad" value={pillsText} onChangeText={setPillsText} placeholder="30" placeholderTextColor={c.textSecondary} />
                </View>
                <View style={{ flex: 1, gap: Spacing.one }}>
                  <ThemedText type="small" themeColor="textSecondary">Warn me at</ThemedText>
                  <TextInput style={inputStyle} keyboardType="number-pad" value={refillText} onChangeText={setRefillText} placeholder="7" placeholderTextColor={c.textSecondary} />
                </View>
              </View>
            )}
          </Section>

          <Section title="Notes">
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              multiline
              placeholder="e.g. Take with food"
              placeholderTextColor={c.textSecondary}
              value={med.notes}
              onChangeText={(notes) => setMed((m) => ({ ...m, notes }))}
            />
          </Section>

          {error && <ThemedText style={{ color: c.danger }}>{error}</ThemedText>}

          <Button label={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
          {editingId !== null && <Button label="Delete medication" variant="danger" onPress={confirmDelete} />}

          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            MediKeeper is a reminder tool and doesn't give medical advice. Follow your doctor or pharmacist's instructions.
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { padding: 3, borderRadius: 999, borderWidth: 2 },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: 12 },
  timeText: { flex: 1, textAlign: 'center', fontSize: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  compact: { paddingHorizontal: 8, minWidth: 44 },
});
