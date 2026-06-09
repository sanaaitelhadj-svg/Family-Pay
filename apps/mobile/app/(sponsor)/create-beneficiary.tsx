import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { Colors, Radius } from '../../src/constants/theme';

const MOROCCAN_PHONE = /^(\+212|00212|0)[67]\d{8}$/;

const RELATIONSHIPS = [
  { value: 'ENFANT',   label: 'Enfant' },
  { value: 'CONJOINT', label: 'Conjoint(e)' },
  { value: 'PARENT',   label: 'Parent' },
  { value: 'FRERE',    label: 'Frère / Sœur' },
  { value: 'AUTRE',    label: 'Autre' },
];

export default function CreateBeneficiaryScreen() {
  const router = useRouter();
  const [form, setForm]     = useState({ phone: '', firstName: '', lastName: '', dateOfBirth: '', relationship: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrorMsg(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!MOROCCAN_PHONE.test(form.phone)) e.phone = 'Format : 06XXXXXXXX ou +212 6XXXXXXXX';
    if (form.firstName.trim().length < 2) e.firstName = 'Prénom requis (min. 2 caractères)';
    if (!form.relationship) e.relationship = 'Veuillez sélectionner le lien familial';
    if (form.dateOfBirth && !/^\d{2}\/\d{2}\/\d{4}$/.test(form.dateOfBirth)) e.dateOfBirth = 'Format : JJ/MM/AAAA';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      let dateOfBirth: string | undefined;
      if (form.dateOfBirth) {
        const [d, m, y] = form.dateOfBirth.split('/');
        dateOfBirth = `${y}-${m}-${d}`;
      }
      await api.post('/mobile/sponsor/beneficiaries/create', {
        phone:        form.phone.replace(/\s/g, ''),
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim() || undefined,
        dateOfBirth,
        relationship: form.relationship,
      });
      if (typeof window !== 'undefined') {
        window.alert(`Compte créé ! Le compte de ${form.firstName} a été créé. Un SMS lui a été envoyé.`);
      }
      router.back();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg    = err?.response?.data?.message ?? '';
      if (status === 409) {
        if (msg.toLowerCase().includes('phone') || msg.toLowerCase().includes('telephone') || msg.toLowerCase().includes('téléphone')) {
          setErrors(e => ({ ...e, phone: 'Ce numéro de téléphone est déjà utilisé' }));
        } else {
          setErrorMsg('Un compte avec ces informations existe déjà');
        }
      } else if (status === 400) {
        setErrorMsg(msg || 'Données invalides. Vérifiez le formulaire.');
      } else {
        setErrorMsg(msg || 'Une erreur est survenue. Réessayez.');
      }
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

          <Text style={styles.title}>Créer un compte bénéficiaire</Text>
          <Text style={styles.subtitle}>Le bénéficiaire recevra un SMS avec ses informations de connexion.</Text>

          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Téléphone *</Text>
            <TextInput style={[styles.input, errors.phone && styles.inputErr]} placeholder="06XXXXXXXX" placeholderTextColor={Colors.textMuted} value={form.phone} onChangeText={v => set('phone', v)} keyboardType="phone-pad" />
            {errors.phone && <Text style={styles.err}>{errors.phone}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Prénom *</Text>
            <TextInput style={[styles.input, errors.firstName && styles.inputErr]} placeholder="Ex : Amira" placeholderTextColor={Colors.textMuted} value={form.firstName} onChangeText={v => set('firstName', v)} autoCapitalize="words" />
            {errors.firstName && <Text style={styles.err}>{errors.firstName}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.input} placeholder="Ex : Bensalem" placeholderTextColor={Colors.textMuted} value={form.lastName} onChangeText={v => set('lastName', v)} autoCapitalize="words" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Lien familial *</Text>
            <View style={[styles.relGrid, errors.relationship && { borderColor: Colors.error }]}>
              {RELATIONSHIPS.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.relChip, form.relationship === r.value && styles.relChipActive]}
                  onPress={() => set('relationship', r.value)}
                >
                  <Text style={[styles.relChipText, form.relationship === r.value && styles.relChipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.relationship && <Text style={styles.err}>{errors.relationship}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Date de naissance <Text style={styles.optional}>(optionnel)</Text></Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                style={{ backgroundColor: '#F8F8FC', border: '1px solid #E5E7EB', borderRadius: 10, padding: '13px 14px', fontSize: 15, color: '#1a1a2e', width: '100%', boxSizing: 'border-box' } as any}
                onChange={e => {
                  const d = e.target.value;
                  if (d) { const [y, m, day] = d.split('-'); set('dateOfBirth', `${day}/${m}/${y}`); }
                }}
              />
            ) : (
              <TextInput style={[styles.input, errors.dateOfBirth && styles.inputErr]} placeholder="JJ/MM/AAAA" placeholderTextColor={Colors.textMuted} value={form.dateOfBirth} onChangeText={v => set('dateOfBirth', v)} keyboardType="number-pad" maxLength={10} />
            )}
            {errors.dateOfBirth && <Text style={styles.err}>{errors.dateOfBirth}</Text>}
          </View>

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Créer le compte →</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.bg },
  scroll:          { padding: 20, paddingBottom: 40 },
  backBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: 20, marginTop: 8 },
  backArrow:       { fontSize: 18, color: Colors.textPrimary },
  title:           { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  subtitle:        { fontSize: 13, color: Colors.textSecondary, marginBottom: 24, lineHeight: 18 },
  errorBanner:     { backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#fecaca', borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  errorBannerText: { color: Colors.error, fontSize: 13, fontWeight: '600' },
  field:           { marginBottom: 16, gap: 4 },
  label:           { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  optional:        { fontWeight: '400', color: Colors.textMuted },
  input:           { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.textPrimary },
  inputErr:        { borderColor: Colors.error },
  err:             { fontSize: 12, color: Colors.error },
  relGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  relChip:         { paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  relChipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  relChipText:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  relChipTextActive: { color: '#fff' },
  btn:             { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled:     { opacity: 0.6 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
});
