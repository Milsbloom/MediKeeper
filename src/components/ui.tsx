import { Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
};

export function Button({ label, variant = 'primary', style, disabled, ...rest }: ButtonProps) {
  const c = useTheme();
  const bg = variant === 'primary' ? c.tint : variant === 'danger' ? 'transparent' : c.backgroundElement;
  const fg = variant === 'primary' ? c.onTint : variant === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        variant === 'danger' && { borderWidth: 1, borderColor: c.danger },
        style,
      ]}
      {...rest}>
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.tint : c.backgroundElement,
          borderColor: selected ? c.tint : c.border,
        },
      ]}>
      <Text style={{ color: selected ? c.onTint : c.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useTheme();
  return <View style={[styles.card, { backgroundColor: c.backgroundElement }, style]}>{children}</View>;
}

export function ColorDot({ color, size = 14 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
});
