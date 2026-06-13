import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components/Button';

type Step = 'EMAIL' | 'OTP' | 'PASSWORD';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step,        setStep]        = useState<Step>('EMAIL');
  const [email,       setEmail]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const showErr = (msg: string) => {
    setError(msg);
    Alert.alert('Erreur', msg);
  };

  const handleSendEmail = async () => {
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showErr('Adresse email invalide'); return;
    }
    setLoading(true);
    try {
      await api.post('/auth/merchant/forgot-password', { email: email.trim().toLowerCase() });
      setStep('OTP');
    } catch (e: any) {
      showErr(e?.response?.data?.message ?? 'Erreur lors de l\'envoi');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = () => {
    setError('');
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      showErr('Le code doit contenir 6 chiffres'); return;
    }
    setStep('PASSWORD');
  };

  const handleResetPassword = async () => {
    setError('');
    if (newPassword.length < 8) {
      showErr('Minimum 8 caractères'); return;
    }
    if (newPassword !== confirmPwd) {
      showErr('Les mots de passe ne correspondent pas'); return;
    }
    setLoading(true);
    try {
      await api.post('/auth/merchant/reset-password', {
        email: email.trim().toLowerCase(),
        otp,
        newPassword,
      });
      if (Platform.OS === 'web') {
        window.alert('✅ Mot de passe réinitialisé avec succès ! Vous allez être redirigé.');
        router.replace('/(auth)' as any);
      } else {
        Alert.alert('✅ Succès', 'Mot de passe réinitialisé. Vous pouvez vous connecter.', [
          { text: 'OK', onPress: () => router.replace('/(auth)' as any) },
        ]);
      }
    } catch (e: any) {
      const code = e?.response?.data?.error;
      const msg  = e?.response?.data?.message ?? 'Erreur';
      if (code === 'PASSWORD_REUSED') {
        showErr('Ce mot de passe a déjà été utilisé récemment. Choisissez-en un autre.');
      } else if (code === 'OTP_INVALID') {
        showErr('Code OTP incorrect ou expiré. Recommencez.');
        setStep('EMAIL'); setOtp('');
      } else {
        showErr(msg);
      }
    } finally { setLoading(false); }
  };

  const STEPS   = ['Email', 'Code OTP', 'Nouveau MDP'];
  const stepIdx = step === 'EMAIL' ? 0 : step === 'OTP' ? 1 : 2;

  const strength = [
    { label: '8+ caractères', ok: newPassword.length >= 8 },
    { label: 'Majuscule',     ok: /[A-Z]/.test(newPassword) },
    { label: 'Chiffre',       ok: /\d/.test(newPassword) },
    { label: 'Spécial',       ok: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={s.title}>🔐 Mot de passe oublié</Text>
        <Text style={s.subtitle}>Réinitialisation en 3 étapes</Text>

        {/* Stepper */}
        <View style={s.stepper}>
          {STEPS.map((label, i) => (
            <View key={i} style={s.stepWrap}>
              {i > 0 && <View style={[s.stepLine, i <= stepIdx && s.stepLineActive]} />}
              <View style={[s.stepDot, i <= stepIdx && s.stepDotActive]}>
                <Text style={[s.stepNum, i <= stepIdx && s.stepNumActive]}>
                  {i < stepIdx ? '✓' : String(i + 1)}
                </Text>
              </View>
              <Text style={[s.stepLabel, i === stepIdx && s.stepLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>

        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* ─── Étape 1 : Email ─── */}
        {step === 'EMAIL' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Entrez votre email marchand</Text>
            <Text style={s.cardDesc}>Un code à 6 chiffres vous sera envoyé par email.</Text>
            <Text style={s.label}>Adresse email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#9CA3AF"
            />
            <Button label="Envoyer le code" onPress={handleSendEmail} loading={loading} style={{ marginTop: 16 }} />
          </View>
        )}

        {/* ─── Étape 2 : OTP ─── */}
        {step === 'OTP' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Vérification</Text>
            <Text style={s.cardDesc}>
              Code envoyé à{' '}
              <Text style={{ fontWeight: '700', color: Colors.primary }}>{email}</Text>
            </Text>
            <Text style={s.label}>Code OTP</Text>
            <TextInput
              style={[s.input, s.otpInput]}
              value={otp}
              onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="• • • • • •"
              keyboardType="numeric"
              maxLength={6}
              placeholderTextColor="#9CA3AF"
            />
            <Button
              label="Vérifier le code"
              onPress={handleVerifyOtp}
              disabled={otp.length !== 6}
              style={{ marginTop: 16 }}
            />
            <TouchableOpacity style={s.resendBtn} onPress={() => { setStep('EMAIL'); setOtp(''); }}>
              <Text style={s.resendText}>Renvoyer le code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Étape 3 : Nouveau mot de passe ─── */}
        {step === 'PASSWORD' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Nouveau mot de passe</Text>
            <Text style={s.cardDesc}>Différent de vos 6 derniers mots de passe.</Text>

            <Text style={s.label}>Nouveau mot de passe</Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Minimum 8 caractères"
                secureTextEntry={!showPwd}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPwd(!showPwd)}>
                <Text style={{ fontSize: 18 }}>{showPwd ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {newPassword.length > 0 && (
              <View style={s.strengthRow}>
                {strength.map(({ label, ok }) => (
                  <View key={label} style={s.strengthItem}>
                    <Text style={[s.dot, { color: ok ? '#16A34A' : '#D1D5DB' }]}>●</Text>
                    <Text style={[s.strengthLabel, ok && { color: '#16A34A' }]}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={[s.label, { marginTop: 12 }]}>Confirmer</Text>
            <TextInput
              style={[s.input, confirmPwd.length > 0 && newPassword !== confirmPwd && { borderColor: '#EF4444' }]}
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              placeholder="Répétez le mot de passe"
              secureTextEntry={!showPwd}
              placeholderTextColor="#9CA3AF"
            />
            {confirmPwd.length > 0 && newPassword !== confirmPwd && (
              <Text style={s.mismatch}>Les mots de passe ne correspondent pas</Text>
            )}
            <Button
              label="Réinitialiser"
              onPress={handleResetPassword}
              loading={loading}
              disabled={newPassword.length < 8 || newPassword !== confirmPwd}
              style={{ marginTop: 16 }}
            />
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bg },
  content:         { padding: 20, paddingBottom: 48 },
  backBtn:         { marginBottom: 20 },
  backText:        { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  title:           { fontSize: 26, fontWeight: '900', color: Colors.textPrimary, marginBottom: 4 },
  subtitle:        { fontSize: 14, color: Colors.textSecondary, marginBottom: 28 },
  stepper:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', marginBottom: 28, gap: 0 },
  stepWrap:        { alignItems: 'center', flex: 1, position: 'relative' },
  stepLine:        { position: 'absolute', top: 15, right: '50%', left: '-50%', height: 2, backgroundColor: Colors.border },
  stepLineActive:  { backgroundColor: Colors.primary },
  stepDot:         { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  stepDotActive:   { backgroundColor: Colors.primary },
  stepNum:         { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  stepNumActive:   { color: '#fff' },
  stepLabel:       { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  stepLabelActive: { color: Colors.primary, fontWeight: '700' },
  errorBox:        { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorText:       { color: '#DC2626', fontSize: 13, fontWeight: '500' },
  card:            { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 20, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  cardTitle:       { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  cardDesc:        { fontSize: 13, color: Colors.textSecondary, marginBottom: 20, lineHeight: 18 },
  label:           { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  input:           { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: Colors.bg, color: Colors.textPrimary },
  otpInput:        { textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: 10, paddingVertical: 16 },
  inputRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:          { padding: 10 },
  strengthRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  strengthItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot:             { fontSize: 10 },
  strengthLabel:   { fontSize: 11, color: Colors.textMuted },
  mismatch:        { fontSize: 11, color: '#EF4444', marginTop: 4 },
  resendBtn:       { alignItems: 'center', marginTop: 14, padding: 8 },
  resendText:      { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
