import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, ColorDot } from '@/components/ui';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listMedications, type Medication } from '@/lib/db';
import { describeSchedule } from '@/lib/schedule';

export default function MedicationsScreen() {
  const db = useSQLiteContext();
  const c = useTheme();
  const [meds, setMeds] = useState<Medication[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      listMedications(db).then(setMeds);
    }, [db]),
  );

  const addButton = <Button label="Add medication" onPress={() => router.push('/med/edit')} />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ThemedText type="subtitle">Medications</ThemedText>
        <FlatList
          data={meds ?? []}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four }}
          ListEmptyComponent={
            meds ? (
              <Card style={{ alignItems: 'center', paddingVertical: Spacing.five }}>
                <ThemedText style={{ textAlign: 'center' }}>No medications yet.</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                  Add your first one and it will show up on your Today list.
                </ThemedText>
              </Card>
            ) : undefined
          }
          ListFooterComponent={<View style={{ marginTop: Spacing.three }}>{addButton}</View>}
          renderItem={({ item }) => {
            const low = item.pillsLeft !== null && item.pillsLeft <= item.refillAt;
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/med/edit', params: { id: String(item.id) } })}>
                <Card style={styles.row}>
                  <ColorDot color={item.color} size={18} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                      {item.name}
                      {item.dose ? <ThemedText themeColor="textSecondary"> · {item.dose}</ThemedText> : null}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {describeSchedule(item.schedule)}
                    </ThemedText>
                    {item.pillsLeft !== null && (
                      <ThemedText type="small" style={{ color: low ? c.warning : c.textSecondary }}>
                        {item.pillsLeft} left{low ? ' · time to refill' : ''}
                      </ThemedText>
                    )}
                  </View>
                </Card>
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
