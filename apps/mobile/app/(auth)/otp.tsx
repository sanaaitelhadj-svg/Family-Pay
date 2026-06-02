import { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components/Button';

export default function OtpScreen() {
  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { phone, role } = useLocalSearchParams<{ phone: string; role: string }>();
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const code = otp.join('');

  const handleChange = (val: string, idx: number) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[idx] = d;
    setOtp(next);
    if (d && idx < 5) inputs.current[idx + 1]?.focus();
    if (!d && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { phone, code, purpose: 'LOGIN' });
      const { accessToken, refreshToken, user } = res.data;
      await setAuth(user, accessToken, refreshToken);
      const dest = user.role === 'SPONSOR' ? '/(sponsor)/'
        : user.role === 'BENEFICIARY' ? '/(beneficiary)/'
        : '/(merchant)/';
      router.replace(dest as any);
    } catch (err: any) {
      Alert.alert('Code invalide', err.response?.data?.message ?? 'Vérifiez le code reçu par SMS');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    const endpoint = role === 'SPONSOR' ? '/auth/sponsor/login'
      : role === 'MERCHANT' ? '/auth/merchant/login'
      : '/auth/beneficiary/login';
    try {
      await api.post(endpoint, { phone });
      Alert.alert('SMS renvoyé', `Nouveau code envoyé au ${phone}`);
    } catch {
      Alert.alert('Erreur', 'Impossible de renvoyer le code');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Retour</Text>
      </TouchableOpacity>

      <View style={styles.iconWrap}>
        <Text style={styles.icon}>📱</Text>
      </View>
      <Text style={styles.title}>Code de vérification</Text>
      <Text style={styles.subtitle}>Code SMS envoyé au{'\n'}<Text style={styles.phone}>{phone}</Text></Text>

      {/* OTP boxes */}
      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={el => { inputs.current[i] = el; }}
            style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
            value={digit}
            onChangeText={v => handleChange(v, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      <Button label="Valider" onPress={handleVerify} loading={loading}
        disabled={code.length !== 6} style={{ marginBottom: 16 }} />

      <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendBtn}>
        <Text style={styles.resendText}>{resending ? 'Envoi...' : 'Renvoyer le code'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: Colors.bg, justifyContent: 'center' },
  back:      { position: 'absolute', top: 56, left: 24 },
  backText:  { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  iconWrap:  { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 },
  icon:      { fontSize: 32 },
  title:     { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle:  { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  phone:     { fontWeight: '700', color: Colors.textPrimary },
  otpRow:    { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  otpBox:    { width: 48, height: 56, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, textAlign: 'center', fontSize: 22, fontWeight: '700', color: Colors.textPrimary, ...Shadow.sm },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  resendBtn: { alignItems: 'center', padding: 12 },
  resendText:{ fontSize: 14, color: Colors.primary, fontWeight: '600' },
});
