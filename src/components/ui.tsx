import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { fontFor, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** primary: pine. secondary: white with a line. quiet: stone. plus: gold. danger: outlined red. link: text only. */
  variant?: 'primary' | 'secondary' | 'quiet' | 'plus' | 'danger' | 'link';
  /** large = 56 tall, for the one action that matters (Taken). */
  size?: 'large' | 'normal' | 'compact';
  style?: ViewStyle;
};

export function Button({ label, variant = 'primary', size = 'normal', style, disabled, ...rest }: ButtonProps) {
  const c = useTheme();
  const look = {
    primary: { bg: c.tint, fg: c.onTint, border: undefined },
    secondary: { bg: c.backgroundElement, fg: c.text, border: c.borderStrong },
    quiet: { bg: c.stone, fg: c.text, border: undefined },
    plus: { bg: c.gold, fg: c.onGold, border: undefined },
    danger: { bg: 'transparent', fg: c.danger, border: c.danger },
    link: { bg: 'transparent', fg: c.tint, border: undefined },
  }[variant];
  const height = size === 'large' ? 56 : size === 'compact' ? 40 : 48;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: height,
          backgroundColor: look.bg,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          paddingHorizontal: size === 'compact' ? 14 : Spacing.three,
        },
        look.border && { borderWidth: 1, borderColor: look.border },
        style,
      ]}
      {...rest}>
      <Text
        style={{
          color: look.fg,
          fontSize: size === 'large' ? 17 : size === 'compact' ? 14 : 15,
          fontFamily: fontFor('600'),
          textDecorationLine: variant === 'link' ? 'underline' : 'none',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? c.text : c.backgroundElement, borderColor: selected ? c.text : c.border },
      ]}>
      <Text style={{ color: selected ? c.background : c.text, fontFamily: fontFor('600'), fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** A segmented control: one choice from a few, like Pill / Liquid / Injection. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.stone }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: c.tint }]}>
            <Text style={{ color: on ? c.onTint : c.textSecondary, fontFamily: fontFor('600'), fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: ViewStyle; tone?: 'surface' | 'paper' | 'amber' | 'pine' | 'coral' }) {
  const c = useTheme();
  const bg = {
    surface: c.backgroundElement,
    paper: c.background,
    amber: c.warningSoft,
    pine: c.tintSoft,
    coral: c.dangerSoft,
  }[tone];
  return (
    <View style={[styles.card, { backgroundColor: bg }, tone === 'surface' && { borderWidth: 1, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

/** A small rounded status label: Taken, Due now, Missed, Skipped, "6 left". */
export function StatusPill({ label, tone }: { label: string; tone: 'taken' | 'due' | 'missed' | 'skipped' }) {
  const c = useTheme();
  const [bg, fg] = {
    taken: [c.tintSoft, c.success],
    due: [c.warningSoft, c.warning],
    missed: [c.dangerSoft, c.danger],
    skipped: [c.stone, c.textSecondary],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontFamily: fontFor('600'), fontSize: 13 }}>{label}</Text>
    </View>
  );
}

export function ColorDot({ color, size = 14 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** The medication's colour as a little two-tone capsule on a tile, as in the design. */
export function PillIcon({ color, size = 48, tile }: { color: string; size?: number; tile?: string }) {
  const c = useTheme();
  const w = size * 0.58;
  const h = w * 0.46;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: tile ?? c.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: w,
          height: h,
          borderRadius: h / 2,
          flexDirection: 'row',
          overflow: 'hidden',
          transform: [{ rotate: '-35deg' }],
          borderWidth: 1,
          borderColor: c.borderStrong,
        }}>
        <View style={{ flex: 1, backgroundColor: '#F2EFE6' }} />
        <View style={{ flex: 1, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** A grouped settings-style list with hairlines between rows. */
export function ListGroup({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <View style={[styles.group, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>{children}</View>;
}

export function ListRow({
  title,
  detail,
  right,
  onPress,
  last,
}: {
  title: string;
  detail?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const c = useTheme();
  const body = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontFamily: fontFor('500'), fontSize: 15 }}>{title}</Text>
        {detail ? <Text style={{ color: c.textSecondary, fontFamily: fontFor('400'), fontSize: 13, lineHeight: 18 }}>{detail}</Text> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** A text box: 54 tall, white, with a pine border while focused. */
export function TextField({ style, onFocus, onBlur, multiline, ...rest }: TextInputProps) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={c.textSecondary}
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.field,
        {
          color: c.text,
          backgroundColor: c.backgroundElement,
          borderColor: focused ? c.tint : c.borderStrong,
          borderWidth: focused ? 1.5 : 1,
        },
        multiline && { minHeight: 88, paddingTop: 14, textAlignVertical: 'top' },
        style,
      ]}
      {...rest}
    />
  );
}

/** A form label above a field or group of choices. */
export function FieldLabel({ children }: { children: string }) {
  const c = useTheme();
  return <Text style={{ color: c.text, fontFamily: fontFor('600'), fontSize: 13 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  field: { minHeight: 54, borderRadius: 14, paddingHorizontal: 16, fontSize: 17, fontFamily: fontFor('400') },
  button: { borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  chip: { paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, height: 36, justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: Radius.card, padding: 18, gap: Spacing.two },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  group: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 10 },
});
