import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Button({
  label,
  icon,
  variant = 'primary',
  loading,
  style,
  ...rest
}: PressableProps & {
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.text : variant === 'secondary' ? colors.surfaceRaised : 'transparent';
  const fg = variant === 'primary' ? colors.background : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: pressed || rest.disabled ? 0.7 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, active, ...rest }: PressableProps & { icon: IconName; label: string; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} {...rest} style={styles.iconButton}>
      <View style={[styles.iconCircle, active && { backgroundColor: colors.accentDim, borderColor: colors.accent }]}>
        <Ionicons name={icon} size={20} color={active ? colors.accent : colors.text} />
      </View>
      <Text style={styles.iconLabel}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={type.meta}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
        style={[styles.input, style]}
      />
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <View style={[styles.center, { gap: spacing.md, padding: spacing.xl }]}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textDim} />
      <Text style={[type.body, { textAlign: 'center' }]}>{error.message}</Text>
      {onRetry && <Button label="Retry" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function Empty({ message, icon = 'film-outline' }: { message: string; icon?: IconName }) {
  return (
    <View style={[styles.center, { gap: spacing.md, padding: spacing.xl }]}>
      <Ionicons name={icon} size={40} color={colors.textDim} />
      <Text style={[type.meta, { textAlign: 'center' }]}>{message}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.text, borderColor: colors.text }]}
    >
      <Text style={[styles.chipText, active && { color: colors.background }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'success' | 'warning' }) {
  const c = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.accent;
  return (
    <View style={[styles.badge, { borderColor: c }]}>
      <Text style={[styles.badgeText, { color: c }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.md,
    minHeight: 46,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  iconButton: { alignItems: 'center', gap: 6, minWidth: 64 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { fontSize: 11, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  badge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: colors.progress },
});
