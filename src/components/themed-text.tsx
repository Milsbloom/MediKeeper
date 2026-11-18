import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { fontFor, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  /**
   * default/small/smallBold: Inter body text.
   * title/subtitle/heading/number: Fraunces display (screen titles, dose times, big numbers).
   * label: small caps-style group label.
   */
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'heading' | 'number' | 'label' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

const DISPLAY = new Set(['title', 'subtitle', 'heading', 'number']);

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const flat = StyleSheet.flatten([styles[type], style]) as TextStyle;
  // Custom fonts need the right file per weight; fontWeight itself is reset so Android doesn't double-bold.
  const fontFamily = flat.fontFamily ?? fontFor(flat.fontWeight, DISPLAY.has(type));
  return (
    <Text
      style={[
        { color: theme[themeColor ?? (type === 'label' ? 'textSecondary' : 'text')] },
        styles[type],
        style,
        { fontFamily, fontWeight: 'normal' },
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 56, lineHeight: 60, fontWeight: '500', letterSpacing: -1.5 },
  subtitle: { fontSize: 32, lineHeight: 38, fontWeight: '500', letterSpacing: -0.6 },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '500', letterSpacing: -0.3 },
  number: { fontSize: 34, lineHeight: 38, fontWeight: '500', letterSpacing: -0.7 },
  link: { lineHeight: 30, fontSize: 14 },
  linkPrimary: { lineHeight: 30, fontSize: 14, color: '#1E5B4A' },
  code: { fontSize: 12 },
});
