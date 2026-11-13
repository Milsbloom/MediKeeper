import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updateSettings } from '@/lib/db';

const POINTS = [
  {
    title: 'Reminders that keep at it',
    body: 'A notification at every dose time, with Take and Snooze buttons. If you miss it, MediKeeper reminds you again.',
  },
  {
    title: 'No account, no limits',
    body: 'Add as many medications as you need. Everything works offline, with no sign-up.',
  },
  {
    title: 'Your data stays on your phone',
    body: "Nothing is uploaded anywhere. You can export your full history at any time, free.",
  },
];

export default function WelcomeScreen() {
  const c = useTheme();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    await updateSettings({ onboarded: true });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.icon}
              accessibilityIgnoresInvertColors
              accessible={false}
            />
            <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
              Welcome to MediKeeper
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
              The simple way to remember your medication.
            </ThemedText>
          </View>

          {POINTS.map((p) => (
            <Card key={p.title}>
              <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                {p.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {p.body}
              </ThemedText>
            </Card>
          ))}

          <View style={[styles.note, { borderColor: c.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              MediKeeper is a reminder and tracking tool. It doesn't give medical advice and doesn't replace your
              doctor or pharmacist. Always follow the instructions you were given for your medication.
            </ThemedText>
          </View>

          <Button label={busy ? 'Starting…' : 'Get started'} onPress={start} disabled={busy} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: { padding: Spacing.four, gap: Spacing.three, flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
  icon: { width: 96, height: 96, borderRadius: 22 },
  note: { borderWidth: 1, borderRadius: 12, padding: Spacing.three },
});
