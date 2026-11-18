import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { fontFor, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buyPlan, devSetPlus, getPlans, paymentsAvailable, restorePlus, usePlus, type Plan } from '@/lib/plus';

const REASONS: Record<string, string> = {
  family: 'Look after your family too.',
  report: 'A clear report for your doctor.',
};

const BENEFITS = [
  'Family profiles on one phone',
  'Doctor report as a clean PDF',
  'No ads and no tracking, ever',
]

export default function PlusScreen() {
  const c = useTheme();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const plus = usePlus();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canPay = paymentsAvailable();

  useEffect(() => {
    if (!canPay) return setPlans([]);
    getPlans()
      .then((p) => {
        setPlans(p);
        setSelected(p[0]?.id ?? null);
      })
      .catch((e) => {
        console.warn('Could not load plans.', e);
        setPlans([]);
        setMessage("Couldn't load the plans. Check your internet connection and try again.");
      });
  }, [canPay]);

  async function buy() {
    if (!selected) return;
    setBusy('buy');
    setMessage(null);
    try {
      const outcome = await buyPlan(selected);
      if (outcome === 'unlocked') router.back();
      else if (outcome === 'not_unlocked') setMessage('The payment went through but Plus did not unlock. Try Restore purchases.');
    } catch (e) {
      console.warn(e);
      setMessage('The purchase did not complete. You have not been charged.');
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    setMessage(null);
    try {
      const ok = await restorePlus();
      if (ok) router.back();
      else setMessage(`No earlier Plus purchase was found for this ${Platform.OS === 'ios' ? 'Apple ID' : 'Google account'}.`);
    } catch (e) {
      console.warn(e);
      setMessage("Couldn't reach the store. Check your internet connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const chosen = plans?.find((p) => p.id === selected);

  return (
    <View style={[styles.container, { backgroundColor: c.night }]}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={[styles.ring, { width: 380, height: 380, right: -120, top: -120, borderColor: 'rgba(243,198,110,0.22)' }]} />
      <View pointerEvents="none" style={[styles.ring, { width: 260, height: 260, right: -60, top: -60, borderColor: 'rgba(243,198,110,0.16)' }]} />
      <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: MaxContentWidth }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.top}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={PAPER} strokeWidth={2} strokeLinecap="round">
                <Path d="M6 6l12 12 M18 6L6 18" />
              </Svg>
            </Pressable>
            <Text style={[styles.eyebrow, { color: GOLD_TEXT }]}>MEDIKEEPER PLUS</Text>
          </View>

          <ThemedText type="subtitle" style={{ color: PAPER, fontSize: 36, lineHeight: 38 }}>
            {(reason && REASONS[reason]) || 'Built for families and caregivers.'}
          </ThemedText>
          <Text style={[styles.body, { color: MUTED, marginTop: 8 }]}>Core reminders stay free, forever.</Text>

          <View style={{ marginTop: 14, gap: 10 }}>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefit}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={GOLD_TEXT} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12.5l4.5 4.5L19 7.5" />
                </Svg>
                <Text style={[styles.body, { color: PAPER, flex: 1 }]}>{b}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 20, gap: 10 }}>
            {plus ? (
              <View style={[styles.plan, { borderColor: c.gold, backgroundColor: 'rgba(232,176,74,0.12)', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                <Text style={[styles.planTitle, { color: PAPER }]}>You have Plus. Thank you!</Text>
                <Text style={[styles.small, { color: MUTED }]}>
                  You can manage or cancel a subscription in your {store} account settings.
                </Text>
              </View>
            ) : plans === null ? (
              <ActivityIndicator color={c.gold} style={{ marginVertical: Spacing.four }} />
            ) : plans.length > 0 ? (
              plans.map((p) => {
                const on = p.id === selected;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setSelected(p.id)}
                    style={[
                      styles.plan,
                      on
                        ? { borderColor: c.gold, borderWidth: 2, backgroundColor: 'rgba(232,176,74,0.12)' }
                        : { borderColor: 'rgba(246,244,238,0.25)' },
                    ]}>
                    {p.badge && (
                      <View style={[styles.badge, { backgroundColor: c.gold }]}>
                        <Text style={{ color: c.onGold, fontFamily: fontFor('700'), fontSize: 11, letterSpacing: 0.4 }}>
                          {p.badge.toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.radio, on ? { backgroundColor: c.gold, borderWidth: 0 } : { borderColor: '#8FA9A0' }]}>
                      {on && (
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={c.onGold} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M5 12.5l4.5 4.5L19 7.5" />
                        </Svg>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.planTitle, { color: PAPER }]}>{p.title}</Text>
                      {p.period ? <Text style={[styles.small, { color: MUTED }]}>{p.period}</Text> : null}
                    </View>
                    <Text style={[styles.planTitle, { color: PAPER }]}>{p.price}</Text>
                  </Pressable>
                );
              })
            ) : (
              <View style={[styles.plan, { borderColor: 'rgba(246,244,238,0.25)', flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
                <Text style={[styles.small, { color: MUTED }]}>
                  {canPay
                    ? 'Plus is not available right now. Please try again later.'
                    : 'Payments are not set up in this version of the app yet.'}
                </Text>
                {__DEV__ && !canPay && (
                  <Button label="Unlock Plus for testing (developer only)" variant="secondary" onPress={() => devSetPlus(true)} />
                )}
              </View>
            )}
          </View>

          {message && <Text style={[styles.small, { color: '#F7B4A3', marginTop: 12 }]}>{message}</Text>}

          <View style={styles.bottom}>
            {plus ? (
              <Button label="Done" variant="plus" size="large" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
            ) : (
              plans &&
              plans.length > 0 && (
                <Button
                  label={busy === 'buy' ? 'Opening the store…' : 'Continue'}
                  variant="plus"
                  size="large"
                  onPress={buy}
                  disabled={!!busy || !selected}
                  style={{ alignSelf: 'stretch' }}
                />
              )
            )}
            {chosen && !plus && (
              <Text style={[styles.small, { color: MUTED, textAlign: 'center' }]}>
                {chosen.price} {chosen.period}. Everything you use today stays free.
              </Text>
            )}
            <View style={styles.links}>
              {canPay && !plus && (
                <Pressable accessibilityRole="button" onPress={restore} disabled={!!busy} style={styles.link}>
                  <Text style={[styles.linkText, { color: PAPER }]}>{busy === 'restore' ? 'Checking…' : 'Restore purchases'}</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} style={styles.link}>
                <Text style={[styles.linkText, { color: PAPER }]}>Terms</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} style={styles.link}>
                <Text style={[styles.linkText, { color: PAPER }]}>Privacy</Text>
              </Pressable>
            </View>
            {__DEV__ && plus && (
              <Pressable onPress={() => devSetPlus(false)} style={styles.link}>
                <Text style={[styles.linkText, { color: MUTED }]}>Turn Plus off (developer only)</Text>
              </Pressable>
            )}
            <Text style={[styles.fine, { color: MUTED }]}>
              Payment is taken by your {store} account. Subscriptions renew automatically unless cancelled at least 24 hours
              before the end of the current period, and can be managed in your {store} account settings. The lifetime
              option is a single payment.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// The paywall is always dark, in both themes.
const PAPER = '#F6F4EE';
const MUTED = '#C9DDD4';
const GOLD_TEXT = '#F3C66E';

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  close: { width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: fontFor('700'), fontSize: 12, letterSpacing: 1.2 },
  body: { fontFamily: fontFor('400'), fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fontFor('400'), fontSize: 13, lineHeight: 18 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plan: {
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planTitle: { fontFamily: fontFor('600'), fontSize: 16 },
  badge: { position: 'absolute', top: -11, right: 14, height: 22, paddingHorizontal: 10, borderRadius: 11, justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bottom: { marginTop: 'auto', paddingTop: 24, gap: 8, alignItems: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  link: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  linkText: { fontFamily: fontFor('400'), fontSize: 13, textDecorationLine: 'underline' },
  fine: { fontFamily: fontFor('400'), fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 4 },
});
