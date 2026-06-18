import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, View } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  style?: ViewStyle;
}

export function Button({ label, onPress, loading, disabled, variant = 'primary', size = 'md', icon, style }: Props) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[`size_${size}`],
    variant === 'primary' && styles.primary,
    variant === 'outline' && styles.outline,
    variant === 'ghost'   && styles.ghost,
    variant === 'danger'  && styles.danger,
    variant === 'success' && styles.success,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.label,
    styles[`labelSize_${size}`],
    variant === 'primary' && styles.labelPrimary,
    variant === 'outline' && styles.labelOutline,
    variant === 'ghost'   && styles.labelGhost,
    variant === 'danger'  && styles.labelDanger,
    variant === 'success' && styles.labelSuccess,
  ];

  const spinnerColor = (variant === 'primary' || variant === 'danger' || variant === 'success')
    ? '#fff' : Colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={containerStyle}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon ? <Text style={[styles.icon, { color: (variant === 'outline' || variant === 'ghost') ? Colors.primary : '#fff' }]}>{icon}</Text> : null}
          <Text style={textStyle}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon:  { fontSize: 16 },

  // Sizes
  size_sm: { paddingVertical: 9,  paddingHorizontal: 16 },
  size_md: { paddingVertical: 14, paddingHorizontal: 24 },
  size_lg: { paddingVertical: 17, paddingHorizontal: 28 },

  // Variants
  primary: { backgroundColor: Colors.primary },
  outline: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary },
  ghost:   { backgroundColor: 'transparent' },
  danger:  { backgroundColor: Colors.error },
  success: { backgroundColor: Colors.success },
  disabled:{ opacity: 0.45 },

  // Labels
  label:        { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  labelSize_sm: { fontSize: 13 },
  labelSize_md: { fontSize: 15 },
  labelSize_lg: { fontSize: 16 },
  labelPrimary: { color: '#fff' },
  labelOutline: { color: Colors.primary },
  labelGhost:   { color: Colors.primary },
  labelDanger:  { color: '#fff' },
  labelSuccess: { color: '#fff' },
});
