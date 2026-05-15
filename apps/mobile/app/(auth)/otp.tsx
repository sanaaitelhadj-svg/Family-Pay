import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/auth-store';
import { OtpInput } from '../../src/components/OtpInput';

export default function OtpScreen() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleVerify() {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/otp/verify', { phone, code: otp });
      const { accessToken, refreshToken, user } = res.data;
      await setAuth(accessToken, refreshToken, user);
      if (user.role === 'SPONSOR') {
        router.replace('/(sponsor)/');
      } else {
        router.replace('/(beneficiary)/');
      }
    } catch {
      Alert.alert('Code invalide', 'Vérifiez le code reçu par SMS');
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Code de vérification</Text>
      <Text style={styles.subtitle}>Code envoyé au {phone}</Text>
      <OtpInput value={otp} onChange={setOtp} />
      <TouchableOpacity
        style={[styles.btn, (otp.length !== 6 || loading) && styles.btnDisabled]}
        onPress={handleVerify}
        disabled={otp.length !== 6 || loading}
      >
        <Text style={styles.btnText}>{loading ? 'Vérification...' : 'Valider'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 40 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
