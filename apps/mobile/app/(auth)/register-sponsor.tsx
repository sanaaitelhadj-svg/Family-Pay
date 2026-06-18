import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '../../src/constants/theme';
import { apiClient } from '../../src/lib/api';

const MOROCCAN_PHONE = /^(\+212|00212|0)[67]\d{8}$/;

export default function RegisterSponsorScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: '', firstName: '', lastName: '', email: '' });
  const [cndp, setCndp]   = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!MOROCCAN_PHONE.test(form.phone)) e.phone = 'Format : +212 6XXXXXXXX ou 06XXXXXXXX';
    if (form.firstName.trim().length < 2)  e.firstName = 'Prénom requis (min 2 caractères)';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email invalide';
    if (!cndp) e.cndp = 'Le consentement CNDP est obligatoire';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/sponsor/register', {
        phone:       form.phone.replace(/\s/g, ''),
        firstName:   form.firstName.trim(),
        lastName:    form.lastName.trim() || undefined,
        email:       form.email.trim()    || undefined,
        cndpConsent: true,
      });
      router.push({ pathname: '/otp', params: { phone: form.phone.replace(/\s/g, ''), purpose: 'SIGNUP', role: 'SPONSOR' } });
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message ?? "Impossible de créer le compte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Créer un compte Sponsor</Text>
          <Text style={styles.subtitle}>Vous pourrez ajouter votre carte bancaire après la création.</Text>

          {/* Téléphone */}
          <View style={styles.field}>
            <Text style={styles.label}>Téléphone *</Text>
            <TextInput style={[styles.input, errors.phone && styles.inputErr]} placeholder="+212 6XXXXXXXX" placeholderTextColor={Colors.textMuted} value={form.phone} onChangeText={v => set('phone', v)} keyboardType="phone-pad" />
            {errors.phone && <Text style={styles.err}>{errors.phone}</Text>}
          </View>

          {/* Prénom */}
          <View style={styles.field}>
            <Text style={styles.label}>Prénom *</Text>
            <TextInput style={[styles.input, errors.firstName && styles.inputErr]} placeholder="Ex : Karim" placeholderTextColor={Colors.textMuted} value={form.firstName} onChangeText={v => set('firstName', v)} autoCapitalize="words" />
            {errors.firstName && <Text style={styles.err}>{errors.firstName}</Text>}
          </View>

          {/* Nom */}
          <View style={styles.field}>
            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.input} placeholder="Ex : Bennani" placeholderTextColor={Colors.textMuted} value={form.lastName} onChangeText={v => set('lastName', v)} autoCapitalize="words" />
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email <Text style={styles.optional}>(optionnel)</Text></Text>
            <TextInput style={[styles.input, errors.email && styles.inputErr]} placeholder="exemple@email.com" placeholderTextColor={Colors.textMuted} value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
            {errors.email && <Text style={styles.err}>{errors.email}</Text>}
          </View>

          {/* CNDP */}
          <TouchableOpacity style={styles.cndpRow} onPress={() => setCndp(c => !c)} activeOpacity={0.7}>
            <View style={[styles.checkbox, cndp && styles.checkboxActive]}>
              {cndp && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.cndpText}>
              J'accepte le traitement de mes données conformément à la loi CNDP 09-08 et aux CGU FamilyPay.
            </Text>
          </TouchableOpacity>
          {errors.cndp && <Text style={[styles.err, { marginTop: -4 }]}>{errors.cndp}</Text>}

          {/* Submit */}
          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Créer mon compte →</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Déjà un compte ? Se connecter</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  scroll:     { padding: 24, paddingBottom: 48 },
  backBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: 24, marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  backArrow:  { fontSize: 18, color: Colors.textPrimary, fontWeight: '600' },
  title:      { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6, letterSpacing: -0.5 },
  subtitle:   { fontSize: 14, color: Colors.textSecondary, marginBottom: 28, lineHeight: 20 },
  field:      { marginBottom: 18, gap: 6 },
  label:      { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  optional:   { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  input:      { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  inputErr:   { borderColor: Colors.error, borderWidth: 1.5 },
  err:        { fontSize: 12, color: Colors.error, marginTop: 2 },
  cndpRow:    { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 16, backgroundColor: Colors.surface, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  checkbox:   { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  cndpText:   { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  btn:        { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
  loginLink:  { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  loginLinkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
