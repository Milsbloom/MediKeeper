import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { Profile } from '@/lib/db';

/** "Everyone / Me / Mum / …" switcher. Renders nothing when there's only one person. */
export function ProfileBar({
  profiles,
  filter,
  onChange,
}: {
  profiles: Profile[];
  filter: number | null;
  onChange: (id: number | null) => void;
}) {
  if (profiles.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="Everyone" selected={filter === null} onPress={() => onChange(null)} />
      {profiles.map((p) => (
        <Chip key={p.id} label={p.name} selected={filter === p.id} onPress={() => onChange(p.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two, paddingVertical: 2 },
});
