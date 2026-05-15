import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';

interface Props {
  value: string;
  onChange: (v: string) => void;
  length?: number;
}

export function OtpInput({ value, onChange, length = 6 }: Props) {
  const inputs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState(0);

  const digits = value.padEnd(length, '').split('').slice(0, length);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    const newVal = next.join('').replace(/ /g, '');
    onChange(newVal);
    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
      setFocused(index + 1);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setFocused(index - 1);
      const next = [...digits];
      next[index - 1] = '';
      onChange(next.join('').replace(/ /g, ''));
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => (
        <Pressable key={i} onPress={() => { inputs.current[i]?.focus(); setFocused(i); }}>
          <TextInput
            ref={(r) => { inputs.current[i] = r; }}
            style={[styles.box, focused === i && styles.boxFocused]}
            value={digits[i] === ' ' ? '' : digits[i]}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={1}
            onFocus={() => setFocused(i)}
            selectTextOnFocus
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  box: {
    width: 48, height: 56, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#d1d5db',
    textAlign: 'center', fontSize: 22, fontWeight: '600', color: '#111',
    backgroundColor: '#f9fafb',
  },
  boxFocused: { borderColor: '#1B4FD8', backgroundColor: '#eff6ff' },
});
