import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { fontFor, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updateSettings } from '@/lib/db';

const POINTS = ['Everything stays on this phone', 'Works with no internet', 'Export your data to CSV, free, any time'];

/** The app mark: a two-tone capsule on a pine tile. */
function Mark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width={64} height={64} rx={18} fill="#1E5B4A" />
      <G transform="rotate(-40 32 32)">
        <Rect x={11} y={22} width={42} height={20} rx={10} fill="#F6F4EE" />
        <Path d="M32 22h11a10 10 0 0 1 0 20H32Z" fill="#E8B04A" />
      </G>
    </Svg>
  );
}

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
          <View style={styles.brand}>
            <Mark />
            <ThemedText type="heading" style={{ fontWeight: '600' }}>
              Medi<ThemedText type="heading" style={{ color: c.tint, fontWeight: '600' }}>Keeper</ThemedText>
            </ThemedText>
          </View>

          <View style={[styles.hero, { backgroundColor: '#1E5B4A' }]} accessible={false}>
            <View style={[styles.heroRing, { width: 250, height: 250, marginLeft: -125, marginTop: -125, borderColor: 'rgba(255,255,255,0.16)' }]} />
            <View style={[styles.heroRing, { width: 400, height: 400, marginLeft: -200, marginTop: -200, borderColor: 'rgba(255,255,255,0.1)' }]} />
            <View style={styles.capsule}>
              <View style={{ flex: 1, backgroundColor: '#F6F4EE' }} />
              <View style={{ flex: 1, backgroundColor: '#E8B04A' }} />
            </View>
            <View style={[styles.sample, { backgroundColor: '#FFFFFF' }]}>
              <View style={[styles.sampleIcon, { backgroundColor: '#F9E6C0' }]}>
                <View style={styles.sampleCapsule}>
                  <View style={{ flex: 1, backgroundColor: '#F2EFE6' }} />
                  <View style={{ flex: 1, backgroundColor: '#E27D60' }} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#14201D', fontFamily: fontFor('600'), fontSize: 15 }}>Your medication</Text>
                <Text style={{ color: '#51605B', fontFamily: fontFor('400'), fontSize: 13 }}>1:00 PM · tap when taken</Text>
              </View>
              <View style={[styles.sampleButton, { backgroundColor: '#1E5B4A' }]}>
                <Text style={{ color: '#FFFFFF', fontFamily: fontFor('600'), fontSize: 14 }}>Taken</Text>
              </View>
            </View>
          </View>

          <ThemedText type="subtitle" style={{ fontSize: 36, lineHeight: 38, marginTop: 22 }}>
            Reminders that respect you.
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={{ marginTop: 10 }}>
            Unlimited medications, forever free. No account, no lock-out, no surprises.
          </ThemedText>

          <View style={{ marginTop: 18, gap: 10 }}>
            {POINTS.map((p) => (
              <View key={p} style={styles.point}>
                <View style={[styles.check, { backgroundColor: c.tintSoft }]}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c.success} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M5 12.5l4.5 4.5L19 7.5" />
                  </Svg>
                </View>
                <ThemedText style={{ fontSize: 15, flex: 1 }}>{p}</ThemedText>
              </View>
            ))}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 18, fontSize: 13, lineHeight: 18 }}>
            MediKeeper is a reminder and tracking tool. It doesn&apos;t give medical advice or replace your doctor or
            pharmacist. Always follow the instructions you were given for your medication.
          </ThemedText>

          <View style={styles.bottom}>
            <Button label={busy ? 'Starting…' : 'Get started'} size="large" onPress={start} disabled={busy} style={{ alignSelf: 'stretch' }} />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
              Takes about a minute. No sign-up.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, flexGrow: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hero: { marginTop: 18, height: 290, borderRadius: 32, overflow: 'hidden' },
  heroRing: { position: 'absolute', left: '50%', top: '44%', borderRadius: 999, borderWidth: 1 },
  capsule: {
    position: 'absolute',
    left: '50%',
    top: '44%',
    width: 210,
    height: 92,
    marginLeft: -105,
    marginTop: -46,
    borderRadius: 46,
    overflow: 'hidden',
    flexDirection: 'row',
    transform: [{ rotate: '-32deg' }],
  },
  sample: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 20,
    padding: 12,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sampleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sampleCapsule: {
    width: 22,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#CFC9BA',
    transform: [{ rotate: '-35deg' }],
  },
  sampleButton: { height: 36, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center' },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bottom: { marginTop: 'auto', paddingTop: 24, gap: 10, alignItems: 'center' },
});
