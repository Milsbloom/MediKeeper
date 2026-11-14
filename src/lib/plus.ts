// MediKeeper Plus: the paid tier, sold through RevenueCat (App Store and Google Play).
//
// Free forever: unlimited medications, reminders, history and CSV export for one person.
// Plus adds family profiles (more than one person) and the PDF report for your doctor.
//
// RevenueCat keys come from environment variables (see docs/plus-setup.md). In Expo Go the
// SDK runs in "browser mode", which works with a RevenueCat Test Store key, so the whole
// purchase flow can be tried without a real build or a real payment.

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getSettings, updateSettings } from '@/lib/db';

/** The RevenueCat entitlement that unlocks Plus. Must match the dashboard. */
export const ENTITLEMENT_ID = 'plus';

/** What a free user gets before Plus is needed. */
export const FREE_PROFILE_LIMIT = 1;

type PurchasesApi = typeof import('react-native-purchases').default;
type PurchasesPackage = import('react-native-purchases').PurchasesPackage;
type CustomerInfo = import('react-native-purchases').CustomerInfo;

export type Plan = {
  id: string;
  title: string;
  price: string;
  /** e.g. "per month", "one payment" */
  period: string;
  /** e.g. "Save 44%" for yearly */
  badge?: string;
};

function apiKey(): string | undefined {
  const isExpoGo = !!(globalThis as { expo?: { modules?: { ExpoGo?: unknown } } }).expo?.modules?.ExpoGo;
  // Expo Go can't reach the real stores, so it uses the Test Store key.
  if (isExpoGo || Platform.OS === 'web') return process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY || undefined;
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  return key || (__DEV__ ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY : undefined) || undefined;
}

let purchases: PurchasesApi | null | undefined;
let configured = false;

/** Loads and configures RevenueCat once. Null when payments aren't set up in this build. */
function sdk(): PurchasesApi | null {
  if (purchases !== undefined) return purchases;
  const key = apiKey();
  if (!key) return (purchases = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default as PurchasesApi;
    if (!configured) {
      Purchases.configure({ apiKey: key });
      configured = true;
      Purchases.addCustomerInfoUpdateListener((info) => {
        void setPlus(hasPlus(info));
      });
    }
    purchases = Purchases;
  } catch (e) {
    console.warn('Payments are not available in this build.', e);
    purchases = null;
  }
  return purchases;
}

/** True when this build can sell Plus (a RevenueCat key is set). */
export function paymentsAvailable(): boolean {
  return sdk() !== null;
}

function hasPlus(info: CustomerInfo): boolean {
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

// ---- Shared Plus state ----

let plusNow: boolean | null = null;
const listeners = new Set<(plus: boolean) => void>();

async function setPlus(value: boolean) {
  const changed = plusNow !== value;
  plusNow = value;
  if (changed) listeners.forEach((l) => l(value));
  const settings = await getSettings();
  if (settings.plusCached !== value) await updateSettings({ plusCached: value });
}

/**
 * Whether Plus is unlocked. Uses the saved status straight away (so it works offline), then
 * checks with RevenueCat in the background.
 */
export async function refreshPlus(): Promise<boolean> {
  if (plusNow === null) {
    plusNow = (await getSettings()).plusCached;
    listeners.forEach((l) => l(plusNow!));
  }
  const Purchases = sdk();
  if (Purchases) {
    try {
      await setPlus(hasPlus(await Purchases.getCustomerInfo()));
    } catch {
      // Offline or store unavailable: keep the saved status.
    }
  }
  return plusNow;
}

/** React hook: the current Plus status, or null while it's first loading. */
export function usePlus(): boolean | null {
  const [plus, setPlusState] = useState<boolean | null>(plusNow);
  useEffect(() => {
    const listener = (v: boolean) => setPlusState(v);
    listeners.add(listener);
    void refreshPlus().then(setPlusState);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return plus;
}

// ---- Buying ----

let packages = new Map<string, PurchasesPackage>();

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: 'per month',
  ANNUAL: 'per year',
  LIFETIME: 'one payment, yours forever',
};
const ORDER = ['ANNUAL', 'MONTHLY', 'LIFETIME'];

/** The plans on sale, from the current RevenueCat offering. Empty if none could be loaded. */
export async function getPlans(): Promise<Plan[]> {
  const Purchases = sdk();
  if (!Purchases) return [];
  const offerings = await Purchases.getOfferings();
  const available = offerings.current?.availablePackages ?? [];
  packages = new Map(available.map((p) => [p.identifier, p]));

  const monthly = available.find((p) => p.packageType === 'MONTHLY');
  return [...available]
    .sort((a, b) => rank(a.packageType) - rank(b.packageType))
    .map((p) => {
      let badge: string | undefined;
      if (p.packageType === 'ANNUAL' && monthly && monthly.product.price > 0) {
        const saving = Math.round((1 - p.product.price / (monthly.product.price * 12)) * 100);
        if (saving > 0) badge = `Save ${saving}%`;
      }
      return {
        id: p.identifier,
        title: p.packageType === 'ANNUAL' ? 'Yearly' : p.packageType === 'MONTHLY' ? 'Monthly' : p.packageType === 'LIFETIME' ? 'Lifetime' : p.product.title,
        price: p.product.priceString,
        period: PERIOD_LABEL[p.packageType] ?? '',
        badge,
      };
    });
}

function rank(type: string): number {
  const i = ORDER.indexOf(type);
  return i === -1 ? ORDER.length : i;
}

export type PurchaseOutcome = 'unlocked' | 'cancelled' | 'not_unlocked';

export async function buyPlan(planId: string): Promise<PurchaseOutcome> {
  const Purchases = sdk();
  const pkg = packages.get(planId);
  if (!Purchases || !pkg) throw new Error('That plan is not available right now.');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const unlocked = hasPlus(customerInfo);
    await setPlus(unlocked);
    return unlocked ? 'unlocked' : 'not_unlocked';
  } catch (e) {
    if ((e as { userCancelled?: boolean | null }).userCancelled) return 'cancelled';
    throw e;
  }
}

/** Restores Plus bought earlier on this store account (new phone, reinstall). */
export async function restorePlus(): Promise<boolean> {
  const Purchases = sdk();
  if (!Purchases) return false;
  const unlocked = hasPlus(await Purchases.restorePurchases());
  await setPlus(unlocked);
  return unlocked;
}

/**
 * Development only: switches Plus on or off without a purchase, for trying the Plus
 * features before RevenueCat is set up. Does nothing in a store build.
 */
export async function devSetPlus(value: boolean): Promise<void> {
  if (!__DEV__) return;
  await setPlus(value);
}
