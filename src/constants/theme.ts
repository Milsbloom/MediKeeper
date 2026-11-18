/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// MediKeeper design system: warm paper, deep pine, and amber for what needs you now.
export const Colors = {
  light: {
    text: '#14201D', // ink
    background: '#F6F4EE', // paper
    backgroundElement: '#FFFFFF', // surface: cards, sheets
    backgroundSelected: '#E9E6DD', // stone
    textSecondary: '#51605B',
    tint: '#1E5B4A', // pine: primary actions, taken
    onTint: '#FFFFFF',
    tintSoft: '#DDEBE4', // pine tint: done states
    success: '#1E5B4A',
    warning: '#7A4600', // text on amber
    warningSoft: '#F9E6C0', // amber tint: due now, low refill
    danger: '#8C2A18', // text on coral
    dangerSoft: '#F8DAD2', // coral tint: missed
    stone: '#E9E6DD', // skipped, inactive
    border: '#E6E2D8',
    borderStrong: '#CFC9BA',
    gold: '#E8B04A', // Plus only
    onGold: '#14201D',
    night: '#0F2A24', // paywall
  },
  dark: {
    text: '#EEF0EA',
    background: '#0E1613',
    backgroundElement: '#17221E',
    backgroundSelected: '#24302B',
    textSecondary: '#A7B3AE',
    tint: '#6FBF9F',
    onTint: '#0B1612',
    tintSoft: '#1C3A2F',
    success: '#7CCBA8',
    warning: '#F2C46B',
    warningSoft: '#3B2D12',
    danger: '#F29C87',
    dangerSoft: '#3D1F18',
    stone: '#26302C',
    border: '#2A3732',
    borderStrong: '#3B4943',
    gold: '#E8B04A',
    onGold: '#14201D',
    night: '#0A1C18',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Font families loaded in the root layout. Body is Inter; display numbers and titles are Fraunces. */
export const FontFamily = {
  body: { '400': 'Inter_400Regular', '500': 'Inter_500Medium', '600': 'Inter_600SemiBold', '700': 'Inter_700Bold' },
  display: { '400': 'Fraunces_500Medium', '500': 'Fraunces_500Medium', '600': 'Fraunces_600SemiBold', '700': 'Fraunces_600SemiBold' },
} as const;

/** Picks the font file for a weight, so Android doesn't fake bold on a custom font. */
export function fontFor(weight: string | number | undefined, display = false): string {
  const w = String(weight ?? '400');
  const key = (w === 'bold' ? '700' : w === 'normal' ? '400' : Number(w) >= 700 ? '700' : Number(w) >= 600 ? '600' : Number(w) >= 500 ? '500' : '400') as '400' | '500' | '600' | '700';
  return (display ? FontFamily.display : FontFamily.body)[key];
}

export const Radius = { input: 12, button: 16, card: 24, pill: 999 } as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
