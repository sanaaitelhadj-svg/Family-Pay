import { View, ViewStyle, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: number;
  elevated?: boolean;
}

export function Card({ children, style, onPress, padding = 18, elevated = false }: Props) {
  const cardStyle = [
    styles.card,
    { padding },
    elevated && Shadow.md,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
});
