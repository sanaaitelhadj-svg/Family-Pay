import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Radius } from '../../src/constants/theme';
import { apiClient } from '../../src/lib/api';

const MOROCCAN_PHONE = /^(\+212|00212|0)[67]\d{8}$/;

export default function RegisterBeneficiaryScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    phone: '', firstName: '', lastName: '',
    dob: '',  // format AAAA-MM-JJ pour l'API
    invitationToken: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cndp, setCndp]             = useState(false);
  const [parentalConsent, setParent] = useState(false);
  const [errors, setErrors]          = useState<Record<string, string>>({});
  const [loading, setLoading]        = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const getAge = () => {
    if (!form.dob) return null;
    const d = new Date(form.dob);
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  };

  const isMinor = () => { const a = getAge(); return a !== null && a < 18; };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!MOROCCAN_PHONE.test(form.phone)) e.phone = 'Format : +212 6XXXXXXXX ou 06XXXXXXXX';
    if (form.firstName.trim().length < 2)  e.firstName = 'Prénom requis';
    if (form.lastName.trim().length < 2)   e.lastName  = 'Nom requis';

    if (!form.dob) {
      e.dob = 'Date de naissance invalide';
    } else {
      const age = getAge();
      if (age === null || age < 0 || age > 120) e.dob = 'Date de naissance invalide';
    }

    if (isMinor()) {
      if (!form.invitationToken.trim()) e.token = 'Token d\'invitation obligatoire pour un mineur';
      if (!parentalConsent)            e.parental = 'Consentement parental obligatoire pour un mineur';
    }
    if (!cndp) e.cndp = 'Le consentement CNDP est obligatoire';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    const dob = form.dob;
    try {
      await apiClient.post('/auth/beneficiary/register', {
        phone:           form.phone.replace(/\s/g, ''),
        firstName:       form.firstName.trim(),
        lastName:        form.lastName.trim(),
        dateOfBirth:     dob,
        invitationToken: form.invitationToken.trim() || undefined,
        parentalConsent: isMinor() ? parentalConsent : undefined,
        cndpConsent:     true,
      });
      router.push({ pathname: '/(auth)/otp', params: { phone: form.phone.replace(/\s/g, ''), purpose: 'SIGNUP', role: 'BENEFICIARY' } });
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message ?? 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  const minor = isMinor();
  const age   = getAge();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Créer un compte Bénéficiaire</Text>
          <Text style={styles.subtitle}>Recevez et utilisez les allocations de votre sponsor.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Téléphone *</Text>
            <TextInput style={[styles.input, errors.phone && styles.inputErr]} placeholder="+212 6XXXXXXXX" placeholderTextColor={Colors.textMuted} value={form.phone} onChangeText={v => set('phone', v)} keyboardType="phone-pad" />
            {errors.phone && <Text style={styles.err}>{errors.phone}</Text>}
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Prénom *</Text>
              <TextInput style={[styles.input, errors.firstName && styles.inputErr]} placeholder="Amal" placeholderTextColor={Colors.textMuted} value={form.firstName} onChangeText={v => set('firstName', v)} autoCapitalize="words" />
              {errors.firstName && <Text style={styles.err}>{errors.firstName}</Text>}
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Nom *</Text>
              <TextInput style={[styles.input, errors.lastName && styles.inputErr]} placeholder="Benali" placeholderTextColor={Colors.textMuted} value={form.lastName} onChangeText={v => set('lastName', v)} autoCapitalize="words" />
              {errors.lastName && <Text style={styles.err}>{errors.lastName}</Text>}
            </View>
          </View>

          {/* Date de naissance */}
          <View style={styles.field}>
            <Text style={styles.label}>Date de naissance *</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                style={{ backgroundColor: '#F8F8FC', border: errors.dob ? '1px solid #ef4444' : '1px solid #E5E7EB', borderRadius: 10, padding: '13px 14px', fontSize: 15, color: '#1a1a2e', width: '100%', boxSizing: 'border-box' } as any}
                onChange={e => {
                  const d = e.target.value; // YYYY-MM-DD
                  if (d) {
                    const [y, m, day] = d.split('-');
                    set('dobDay', day); set('dobMonth', m); set('dobYear', y);
                  }
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.input, styles.dateBtn, errors.dob && styles.inputErr]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: form.dob ? Colors.textPrimary : Colors.textMuted, fontSize: 15 }}>
                    {form.dob ? (() => { const [y,m,d] = form.dob.split('-'); return `${d}/${m}/${y}`; })() : 'JJ/MM/AAAA'}
                  </Text>
                  <Text style={{ fontSize: 18 }}>📅</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={form.dob ? new Date(form.dob) : new Date(2005, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                    maximumDate={new Date()}
                    minimumDate={new Date(1920, 0, 1)}
                    onChange={(_: any, date?: Date) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (date) {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        set('dob', `${y}-${m}-${d}`);
                      }
                    }}
                  />
                )}
              </>
            )}
            {errors.dob && <Text style={styles.err}>{errors.dob}</Text>}
            {age !== null && age >= 0 && age <= 120 && (
              <View style={[styles.ageBadge, minor ? styles.ageBadgeMinor : styles.ageBadgeAdult]}>
                <Text style={[styles.ageBadgeText, { color: minor ? Colors.warning : Colors.success }]}>
                  {minor ? `⚠️ Mineur (${age} ans) — token d'invitation requis` : `✓ Majeur (${age} ans)`}
                </Text>
              </View>
            )}
          </View>

          {/* Token d'invitation (toujours visible, obligatoire si mineur) */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Token d'invitation {minor ? '*' : <Text style={styles.optional}>(optionnel)</Text>}
            </Text>
            <TextInput
              style={[styles.input, errors.token && styles.inputErr]}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              placeholderTextColor={Colors.textMuted}
              value={form.invitationToken}
              onChangeText={v => set('invitationToken', v)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.token && <Text style={styles.err}>{errors.token}</Text>}
            {!minor && <Text style={styles.hint}>Facultatif pour les adultes — permet d'être directement rattaché à un sponsor.</Text>}
          </View>

          {/* Consentement parental (mineur uniquement) */}
          {minor && (
            <TouchableOpacity style={styles.cndpRow} onPress={() => setParent(p => !p)} activeOpacity={0.7}>
              <View style={[styles.checkbox, parentalConsent && styles.checkboxActive]}>
                {parentalConsent && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.cndpText}>
                Le représentant légal consent à l'utilisation de FamilyPay par ce mineur et assume la responsabilité de supervision.
              </Text>
            </TouchableOpacity>
          )}
          {errors.parental && <Text style={[styles.err, { marginTop: -4 }]}>{errors.parental}</Text>}

          {/* CNDP */}
          <TouchableOpacity style={styles.cndpRow} onPress={() => setCndp(c => !c)} activeOpacity={0.7}>
            <View style={[styles.checkbox, cndp && styles.checkboxActive]}>
              {cndp && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.cndpText}>J'accepte le traitement de mes données (loi CNDP 09-08) et les CGU FamilyPay.</Text>
          </TouchableOpacity>
          {errors.cndp && <Text style={[styles.err, { marginTop: -4 }]}>{errors.cndp}</Text>}

          <TouchableOpacity style={[styles.btn, { backgroundColor: '#22C55E' }, loading && styles.btnDisabled]} onPress={submit} disabled={loading} activeOpacity={0.85}>
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
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: 20, marginTop: 8 },
  backArrow: { fontSize: 18, color: Colors.textPrimary },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 24, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  optional: { fontWeight: '400', color: Colors.textMuted },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.textPrimary },
  inputErr: { borderColor: Colors.error },
  err: { fontSize: 12, color: Colors.error },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  dobRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dobInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 13, fontSize: 16, color: Colors.textPrimary, textAlign: 'center', width: 54 },
  dobInputYear: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 13, fontSize: 16, color: Colors.textPrimary, textAlign: 'center', width: 74 },
  dobSep: { fontSize: 20, color: Colors.textMuted, fontWeight: '300' },
  ageBadge: { marginTop: 6, padding: 8, borderRadius: Radius.sm },
  ageBadgeMinor: { backgroundColor: Colors.warningBg },
  ageBadgeAdult: { backgroundColor: Colors.successBg },
  ageBadgeText: { fontSize: 12, fontWeight: '600' },
  cndpRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cndpText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  loginLink: { alignItems: 'center', marginTop: 16 },
  loginLinkText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },

  dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
});
