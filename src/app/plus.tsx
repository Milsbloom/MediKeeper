import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buyPlan, devSetPlus, getPlans, paymentsAvailable, restorePlus, usePlus, type Plan } from '@/lib/plus';

const REASONS: Record<string, string> = {
  family: 'Add family members with Plus',
  report: 'Doctor reports come with Plus',
};

const BENEFITS = [
  {
    title: 'Family profiles',
    body: 'Look after a parent, partner or child too. Each person gets their own list, reminders and history.',
  },
  {
    title: 'Report for your doctor',
    body: 'A clear PDF of your medications and which doses were taken or missed, ready to share or print.',
  },
  {
    title: 'Keep MediKeeper independent',
    body: 'No ads, no tracking and no selling your data, ever. Plus is how the app pays its way.',
  },
];

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

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
            MediKeeper Plus
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {(reason && REASONS[reason]) || 'More for the people you look after.'}
          </ThemedText>
        </View>

        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefit}>
            <ThemedText style={{ color: c.success, fontSize: 18, fontWeight: '800' }}>✓</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                {b.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {b.body}
              </ThemedText>
            </View>
          </View>
        ))}

        <ThemedText type="small" themeColor="textSecondary">
          Everything you use today stays free: unlimited medications, reminders, history and CSV export.
        </ThemedText>

        {plus ? (
          <Card>
            <ThemedText type="smallBold" style={{ fontSize: 17, color: c.success }}>
              You have Plus. Thank you!
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              You can manage or cancel a subscription in your {store} account settings.
            </ThemedText>
            <Button label="Done" onPress={() => router.back()} />
          </Card>
        ) : plans === null ? (
          <ActivityIndicator style={{ marginVertical: Spacing.four }} />
        ) : plans.length > 0 ? (
          <>
            {plans.map((p) => {
              const on = p.id === selected;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setSelected(p.id)}
                  style={[
                    styles.plan,
                    { borderColor: on ? c.tint : c.border, backgroundColor: c.backgroundElement },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold" style={{ fontSize: 17 }}>
                      {p.title}
                      {p.badge ? <ThemedText type="smallBold" style={{ color: c.success }}>  {p.badge}</ThemedText> : null}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.price} {p.period}
                    </ThemedText>
                  </View>
                  <View style={[styles.radio, { borderColor: on ? c.tint : c.border }]}>
                    {on && <View style={[styles.radioDot, { backgroundColor: c.tint }]} />}
                  </View>
                </Pressable>
              );
            })}
            <Button label={busy === 'buy' ? 'Opening the store…' : 'Continue'} onPress={buy} disabled={!!busy || !selected} />
          </>
        ) : (
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              {canPay
                ? 'Plus is not available right now. Please try again later.'
                : 'Payments are not set up in this version of the app yet.'}
            </ThemedText>
            {__DEV__ && !canPay && (
              <Button label="Unlock Plus for testing (developer only)" variant="secondary" onPress={() => devSetPlus(true)} />
            )}
          </Card>
        )}

        {message && <ThemedText style={{ color: c.danger }}>{message}</ThemedText>}

        {canPay && !plus && (
          <Button
            label={busy === 'restore' ? 'Checking…' : 'Restore purchases'}
            variant="secondary"
            onPress={restore}
            disabled={!!busy}
          />
        )}
        {__DEV__ && plus && (
          <Button label="Turn Plus off (developer only)" variant="secondary" onPress={() => devSetPlus(false)} />
        )}

        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Payment is taken by your {store} account. Subscriptions renew automatically unless cancelled at least 24
          hours before the end of the current period, and can be managed in your {store} account settings. The
          lifetime option is a single payment.
        </ThemedText>
        <Button label="Not now" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  scroll: { padding: Spacing.four, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%' },
  hero: { alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  benefit: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  plan: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 16, padding: Spacing.three },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
});
