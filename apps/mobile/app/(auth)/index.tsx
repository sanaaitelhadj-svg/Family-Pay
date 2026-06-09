import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components/Button';

type Role = 'SPONSOR' | 'BENEFICIARY' | 'MERCHANT';

const ROLES: { key: Role; label: string; icon: string; desc: string }[] = [
  { key: 'SPONSOR',     label: 'Sponsor',      icon: '💳', desc: 'Gérez vos allocations' },
  { key: 'BENEFICIARY', label: 'Bénéficiaire',  icon: '🛒', desc: 'Consultez vos budgets' },
  { key: 'MERCHANT',    label: 'Marchand',      icon: '🏪', desc: 'Acceptez les paiements' },
];

const LOGIN_ENDPOINT: Record<Role, string> = {
  SPONSOR:     '/auth/sponsor/login',
  BENEFICIARY: '/auth/beneficiary/login',
  MERCHANT:    '/auth/merchant/login',
};

export default function WelcomeScreen() {
  const [role, setRole]       = useState<Role>('SPONSOR');
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleContinue = async () => {
    const clean = phone.replace(/\s/g, '');
    if (!/^(\+212|00212|0)[5-7]\d{8}$/.test(clean)) {
      Alert.alert('Numéro invalide', 'Entrez un numéro marocain valide (ex: 0612345678)');
      return;
    }
    setLoading(true);
    try {
      await api.post(LOGIN_ENDPOINT[role], { phone: clean });
      router.push({ pathname: '/(auth)/otp', params: { phone: clean, role } });
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.response?.data?.error ?? 'Numéro non reconnu';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

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
              onPress={() => setRole(r.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.roleIcon}>{r.icon}</Text>
              <Text style={[styles.roleLabel, role === r.key && styles.roleLabelActive]}>{r.label}</Text>
              <Text style={styles.roleDesc}>{r.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone input */}
        <Text style={styles.sectionLabel}>Numéro de téléphone</Text>
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

        <Button label="Recevoir le code SMS" onPress={handleContinue} loading={loading}
          disabled={phone.length < 9} style={{ marginTop: 8 }} />

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
  scroll:         { flexGrow: 1, padding: 24, backgroundColor: Colors.bg, justifyContent: 'center' },
  header:         { alignItems: 'center', marginBottom: 36 },
  logoWrap:       { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12, ...Shadow.md },
  logoText:       { color: '#fff', fontSize: 28, fontWeight: '800' },
  appName:        { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  tagline:        { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  sectionLabel:   { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  roleRow:        { flexDirection: 'row', gap: 10, marginBottom: 24 },
  roleCard:       { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm },
  roleCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  roleIcon:       { fontSize: 22, marginBottom: 4 },
  roleLabel:      { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  roleLabelActive:{ color: Colors.primary },
  roleDesc:       { fontSize: 10, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, marginBottom: 16, ...Shadow.sm },
  flag:           { fontSize: 22, marginRight: 10 },
  input:          { flex: 1, fontSize: 17, paddingVertical: 14, color: Colors.textPrimary },
  legal:          { textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginTop: 20 },
  legalLink:      { color: Colors.primary, fontWeight: '600' },
});
