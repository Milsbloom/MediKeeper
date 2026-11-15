import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, ColorDot } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createProfile,
  deleteProfile,
  listMedications,
  listProfiles,
  OWNER_PROFILE_ID,
  PROFILE_COLORS,
  updateProfile,
} from '@/lib/db';
import { FREE_PROFILE_LIMIT, refreshPlus } from '@/lib/plus';

export default function EditProfileScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id != null ? Number(id) : null;

  const [name, setName] = useState('');
  const [color, setColor] = useState(PROFILE_COLORS[1]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingId === null) return;
    listProfiles().then((ps) => {
      const p = ps.find((x) => x.id === editingId);
      if (p) {
        setName(p.name);
        setColor(p.color);
      }
    });
  }, [editingId]);

  async function save() {
    if (!name.trim()) return setError('Enter a name.');
    setSaving(true);
    try {
      if (editingId === null) {
        const existing = await listProfiles();
        // Adding someone beyond the free limit needs Plus.
        if (existing.length >= FREE_PROFILE_LIMIT && !(await refreshPlus())) {
          router.replace({ pathname: '/plus', params: { reason: 'family' } });
          return;
        }
        await createProfile(name, color);
      } else {
        await updateProfile(editingId, name, color);
      }
      router.back();
    } catch (e) {
      console.error(e);
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (editingId === null) return;
    const count = (await listMedications(editingId)).length;
    Alert.alert(
      `Remove ${name}?`,
      count > 0
        ? `Their ${count} medication${count === 1 ? '' : 's'} and dose history will be deleted from this phone.`
        : 'They will be removed from this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(editingId);
            router.back();
          },
        },
      ],
    );
  }

  const inputStyle = [styles.input, { color: c.text, backgroundColor: c.backgroundElement, borderColor: c.border }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: editingId === null ? 'Add a person' : 'Edit person' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Name
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Mum"
            placeholderTextColor={c.textSecondary}
            value={name}
            onChangeText={setName}
            autoFocus={editingId === null}
            maxLength={30}
          />
        </View>

        <View style={{ gap: Spacing.two }}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Colour
          </ThemedText>
          <View style={styles.wrap}>
            {PROFILE_COLORS.map((col) => (
              <Pressable
                key={col}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${col}`}
                accessibilityState={{ selected: color === col }}
                onPress={() => setColor(col)}
                style={[styles.swatch, { borderColor: color === col ? c.text : 'transparent' }]}>
                <ColorDot color={col} size={28} />
              </Pressable>
            ))}
          </View>
        </View>

        {error && <ThemedText style={{ color: c.danger }}>{error}</ThemedText>}
        <Button label={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
        {editingId !== null && editingId !== OWNER_PROFILE_ID && (
          <Button label="Remove this person" variant="danger" onPress={confirmDelete} />
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.three, gap: Spacing.four },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { padding: 3, borderRadius: 999, borderWidth: 2 },
});
