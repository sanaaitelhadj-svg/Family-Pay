import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/lib/api';
import { Colors, Radius } from '../../src/constants/theme';

const MOROCCAN_PHONE = /^(\+212|00212|0)[67]\d{8}$/;

export default function ChangePhoneScreen() {
  const router = useRouter();
  const [step, setStep]       = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone]     = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const requestOtp = async () => {
    if (!MOROCCAN_PHONE.test(phone)) { setError('Format invalide : 06XXXXXXXX ou +212 6XXXXXXXX'); return; }
    setLoading(true); setError(null);
    try {
      await apiClient.post('/mobile/sponsor/phone/change-request', { newPhone: phone.replace(/\s/g, '') });
      setStep('otp');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erreur lors de l\'envoi du code');
    } finally { setLoading(false); }
  };

  const confirmOtp = async () => {
    if (otp.length < 4) { setError('Entrez le code reçu par SMS'); return; }
    setLoading(true); setError(null);
    try {
      await apiClient.post('/mobile/sponsor/phone/change-confirm', { newPhone: phone.replace(/\s/g, ''), code: otp });
      if (typeof window !== 'undefined') {
        window.alert('Numéro mis à jour avec succès !');
        window.location.href = '/';
      } else {
        router.replace('/(sponsor)');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Code invalide ou expiré');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Changer de numéro</Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'Entrez votre nouveau numéro de téléphone. Un code OTP vous sera envoyé pour confirmation.'
              : `Un code a été envoyé au ${phone}. Entrez-le ci-dessous.`}
          </Text>

          {error && <View style={styles.errorBanner}><Text style={styles.errorText}>⚠️ {error}</Text></View>}

          {step === 'phone' ? (
            <View style={styles.field}>
              <Text style={styles.label}>Nouveau numéro *</Text>
              <TextInput
                style={styles.input}
                placeholder="06XXXXXXXX"
                placeholderTextColor={Colors.textMuted}
                value={phone}
                onChangeText={v => { setPhone(v); setError(null); }}
                keyboardType="phone-pad"
                autoFocus
              />
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Code OTP *</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="------"
                placeholderTextColor={Colors.textMuted}
                value={otp}
                onChangeText={v => { setOtp(v); setError(null); }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); setError(null); }}>
                <Text style={styles.resend}>← Changer le numéro</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={step === 'phone' ? requestOtp : confirmOtp}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>{step === 'phone' ? 'Envoyer le code →' : 'Confirmer →'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  scroll:      { padding: 24, paddingBottom: 40 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: 24, marginTop: 8 },
  backArrow:   { fontSize: 18, color: Colors.textPrimary },
  title:       { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  subtitle:    { fontSize: 13, color: Colors.textSecondary, marginBottom: 24, lineHeight: 20 },
  errorBanner: { backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#fecaca', borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  errorText:   { color: Colors.error, fontSize: 13 },
  field:       { marginBottom: 20 },
  label:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input:       { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.textPrimary },
  otpInput:    { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  resend:      { marginTop: 10, fontSize: 13, color: Colors.primary, textAlign: 'center' },
  btn:         { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
});
