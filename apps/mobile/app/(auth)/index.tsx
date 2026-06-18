import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components/Button';
import { useAuthStore } from '@/lib/auth-store';

type Role = 'SPONSOR' | 'BENEFICIARY' | 'MERCHANT';

const ROLES: { key: Role; label: string; icon: string; desc: string }[] = [
  { key: 'SPONSOR',     label: 'Sponsor',      icon: '💳', desc: 'Gérez vos allocations' },
  { key: 'BENEFICIARY', label: 'Bénéficiaire',  icon: '🛒', desc: 'Consultez vos budgets' },
  { key: 'MERCHANT',    label: 'Marchand',      icon: '🏪', desc: 'Acceptez les paiements' },
];

export default function WelcomeScreen() {
  const [role, setRole]         = useState<Role>('SPONSOR');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  // ── OTP flow (SPONSOR / BENEFICIARY) ──────────────────────────────────
  const handleOtpContinue = async () => {
    const clean = phone.replace(/\s/g, '');
    if (!/^(\+212|00212|0)[5-7]\d{8}$/.test(clean)) {
      Alert.alert('Numéro invalide', 'Entrez un numéro marocain valide (ex: 0612345678)'); return;
    }
    setLoading(true);
    try {
      const endpoint = role === 'SPONSOR' ? '/auth/sponsor/login' : '/auth/beneficiary/login';
      await api.post(endpoint, { phone: clean });
      router.push({ pathname: '/(auth)/otp', params: { phone: clean, role, purpose: 'LOGIN' } });
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message ?? err.response?.data?.error ?? 'Numéro non reconnu');
    } finally {
      setLoading(false);
    }
  };

  // ── Password flow (MERCHANT) ───────────────────────────────────────────
  const handleMerchantLogin = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Email invalide', 'Entrez un email valide'); return;
    }
    if (!password.trim()) {
      Alert.alert('Mot de passe requis', 'Entrez votre mot de passe'); return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/merchant/login', { email: email.trim().toLowerCase(), password });
      const { accessToken, refreshToken, user } = res.data;
      await setAuth(user, accessToken, refreshToken);
      if (Platform.OS === 'web') {
        (window as any).location.href = '/';
      } else {
        router.replace('/(merchant)' as any);
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.response?.data?.message ?? 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  const isMerchant = role === 'MERCHANT';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoText}>FP</Text>
          </View>
          <Text style={styles.appName}>FamilyPay</Text>
          <Text style={styles.tagline}>Dépenses contrôlées, familles sereines</Text>
        </View>

        {/* Role selector */}
        <Text style={styles.sectionLabel}>Je suis…</Text>
        <View style={styles.roleRow}>
          {ROLES.map(r => (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleCard, role === r.key && styles.roleCardActive]}
              onPress={() => { setRole(r.key); setPhone(''); setEmail(''); setPassword(''); }}
              activeOpacity={0.8}
            >
              <Text style={styles.roleIcon}>{r.icon}</Text>
              <Text style={[styles.roleLabel, role === r.key && styles.roleLabelActive]}>{r.label}</Text>
              <Text style={styles.roleDesc}>{r.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone input (Sponsor/Bénéficiaire) ou Email (Marchand) */}
        {!isMerchant ? (
          <>
            <Text style={styles.sectionLabel}>Téléphone</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.flag}>🇲🇦</Text>
              <TextInput
                style={styles.input}
                placeholder="0612 345 678"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                autoFocus
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Email</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.flag}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="contact@commerce.ma"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                autoFocus
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </>
        )}

        {/* Mot de passe (Marchand uniquement) */}
        {isMerchant && (
          <>
            <Text style={styles.sectionLabel}>Mot de passe</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.flag}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Votre mot de passe"
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={{ padding: 8 }}>
                <Text style={{ fontSize: 16 }}>{showPwd ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Button
          label={isMerchant ? 'Se connecter' : 'Recevoir le code SMS'}
          onPress={isMerchant ? handleMerchantLogin : handleOtpContinue}
          loading={loading}
          disabled={(isMerchant ? (!email.trim() || !password.trim()) : phone.length < 9)}
          style={{ marginTop: 8 }}
        />

        {isMerchant && (
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password' as any)}
            style={{ alignItems: 'center', paddingVertical: 10 }}
          >
            <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>
              Mot de passe oublié ?
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.push('/(auth)/register' as any)}
          style={{ alignItems: 'center', paddingVertical: 14 }}
        >
          <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 15 }}>
            Pas encore de compte ? Créer un compte →
          </Text>
        </TouchableOpacity>

        <Text style={styles.legal}>En continuant, vous acceptez les{' '}
          <Text style={styles.legalLink}>CGU FamilyPay</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:         { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32, backgroundColor: Colors.bg, justifyContent: 'center' },

  // ── Header ──────────────────────────────────────────────────────────
  header:         { alignItems: 'center', marginBottom: 40 },
  logoWrap:       {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText:       { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  appName:        { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.8 },
  tagline:        { fontSize: 14, color: Colors.textSecondary, marginTop: 6, letterSpacing: 0.1 },

  // ── Role selector ────────────────────────────────────────────────────
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginTop: 4 },
  roleRow:        { flexDirection: 'row', gap: 10, marginBottom: 28 },
  roleCard:       {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: 14,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.xs,
  },
  roleCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: Colors.primaryLight,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  roleIcon:       { fontSize: 24, marginBottom: 6 },
  roleLabel:      { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  roleLabelActive:{ color: Colors.primary },
  roleDesc:       { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 3, lineHeight: 14 },

  // ── Inputs ───────────────────────────────────────────────────────────
  inputWrap:      {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, marginBottom: 14,
    ...Shadow.xs,
  },
  flag:           { fontSize: 20, marginRight: 12, opacity: 0.8 },
  input:          { flex: 1, fontSize: 16, paddingVertical: 15, color: Colors.textPrimary },

  // ── Footer ───────────────────────────────────────────────────────────
  legal:          { textAlign: 'center', fontSize: 11, color: Colors.textMuted, marginTop: 24, lineHeight: 16 },
  legalLink:      { color: Colors.primary, fontWeight: '600' },
});
