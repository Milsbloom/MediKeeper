import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ProfileBar } from '@/components/profile-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Chip, PillIcon } from '@/components/ui';
import { BottomTabInset, fontFor, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProfiles } from '@/hooks/use-profiles';
import { useTheme } from '@/hooks/use-theme';
import { listMedications, type Medication } from '@/lib/db';
import { describeSchedule } from '@/lib/schedule';

type Show = 'all' | 'low' | 'as_needed';

const isLow = (m: Medication) => m.pillsLeft !== null && m.pillsLeft <= m.refillAt;

export default function MedicationsScreen() {
  const c = useTheme();
  const { profiles, filter, setFilter, byId, multiple } = useProfiles();
  const [allMeds, setMeds] = useState<Medication[] | null>(null);
  const [show, setShow] = useState<Show>('all');
  const personMeds = allMeds && allMeds.filter((m) => filter === null || m.profileId === filter);
  const lowCount = personMeds?.filter(isLow).length ?? 0;
  const asNeededCount = personMeds?.filter((m) => m.schedule.kind === 'as_needed').length ?? 0;
  const meds =
    personMeds &&
    personMeds.filter((m) => (show === 'low' ? isLow(m) : show === 'as_needed' ? m.schedule.kind === 'as_needed' : true));

  useFocusEffect(
    useCallback(() => {
      listMedications().then(setMeds);
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Medications</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add medication"
            onPress={() => router.push('/med/edit')}
            style={({ pressed }) => [styles.add, { backgroundColor: c.tint, opacity: pressed ? 0.75 : 1 }]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={c.onTint} strokeWidth={2.4} strokeLinecap="round">
              <Path d="M12 5v14 M5 12h14" />
            </Svg>
          </Pressable>
        </View>
        <ProfileBar profiles={profiles} filter={filter} onChange={setFilter} />
        {personMeds && personMeds.length > 0 && (lowCount > 0 || asNeededCount > 0) && (
          <View style={styles.chips}>
            <Chip label={`All ${personMeds.length}`} selected={show === 'all'} onPress={() => setShow('all')} />
            {lowCount > 0 && (
              <Chip label={`Low on refill ${lowCount}`} selected={show === 'low'} onPress={() => setShow('low')} />
            )}
            {asNeededCount > 0 && (
              <Chip label={`As needed ${asNeededCount}`} selected={show === 'as_needed'} onPress={() => setShow('as_needed')} />
            )}
          </View>
        )}
        <FlatList
          data={meds ?? []}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four }}
          ListEmptyComponent={
            meds ? (
              <Card style={{ alignItems: 'center', paddingVertical: Spacing.five }}>
                <ThemedText type="heading" style={{ textAlign: 'center' }}>
                  No medications yet
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                  Add your first one and it will show up on your Today list.
                </ThemedText>
                <Button label="Add medication" onPress={() => router.push('/med/edit')} style={{ marginTop: Spacing.two, alignSelf: 'stretch' }} />
              </Card>
            ) : undefined
          }
          renderItem={({ item }) => {
            const low = isLow(item);
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/med/edit', params: { id: String(item.id) } })}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: c.backgroundElement, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <PillIcon color={item.color} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: c.text, fontFamily: fontFor('600'), fontSize: 16 }}>
                    {item.name}
                    {item.dose ? ` ${item.dose}` : ''}
                  </Text>
                  <Text numberOfLines={1} style={{ color: c.textSecondary, fontFamily: fontFor('400'), fontSize: 13, marginTop: 2 }}>
                    {multiple && filter === null ? `${byId.get(item.profileId)?.name ?? ''} · ` : ''}
                    {describeSchedule(item.schedule)}
                  </Text>
                </View>
                {item.pillsLeft !== null && (
                  <View style={[styles.left, { backgroundColor: low ? c.warningSoft : c.stone }]}>
                    <Text style={{ color: low ? c.warning : c.textSecondary, fontFamily: fontFor('600'), fontSize: 13 }}>
                      {item.pillsLeft} left
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  add: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: {
    minHeight: 80,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  left: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
});
