import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius } from '../../src/constants/theme';
import { apiClient } from '../../src/lib/api';

const MOROCCAN_PHONE = /^(\+212|00212|0)[67]\d{8}$/;

const CATEGORIES = [
  { key: 'FOOD',      label: '🍔 Alimentation' },
  { key: 'PHARMACY',  label: '💊 Pharmacie'    },
  { key: 'CLOTHING',  label: '👕 Habillement'  },
  { key: 'EDUCATION', label: '📚 Éducation'    },
  { key: 'LEISURE',   label: '🎭 Loisirs'      },
  { key: 'GENERAL',   label: '📦 Général'      },
] as const;

const STEPS = ['Infos de base', 'Légal & Bancaire', 'Contacts', 'Localisation'];

export default function RegisterMerchantScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [cndp, setCndp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    businessName: '', category: '' as any, address: '', city: '', phone: '', email: '',
    registrationNumber: '', iceNumber: '', cinRepresentant: '', rib: '',
    contactAdminNom: '', contactAdminPhone: '',
    contactFinanceNom: '', contactFinancePhone: '',
    gpsLat: '', gpsLng: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const detectLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée', 'Activez la localisation dans les paramètres.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      set('gpsLat', loc.coords.latitude.toFixed(6));
      set('gpsLng', loc.coords.longitude.toFixed(6));
    } catch { Alert.alert('Erreur', 'Impossible de récupérer la position.'); }
    finally { setLocLoading(false); }
  };

  const validateStep = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (form.businessName.trim().length < 2) e.businessName = 'Nom requis';
      if (!form.category) e.category = 'Catégorie requise';
      if (form.address.trim().length < 5)      e.address = 'Adresse requise (min 5 car.)';
      if (form.city.trim().length < 2)         e.city = 'Ville requise';
      if (!MOROCCAN_PHONE.test(form.phone))    e.phone = 'Format : +212 6XXXXXXXX';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email invalide';
    }
    if (s === 1) {
      if (form.registrationNumber.trim().length < 2) e.registrationNumber = 'N° RC requis';
      if (form.iceNumber.trim().length < 5)          e.iceNumber = 'N° ICE requis';
      if (form.cinRepresentant.trim().length < 5)    e.cinRepresentant = 'CIN du représentant requis';
      if (form.rib.trim().length < 10)               e.rib = 'RIB requis';
    }
    if (s === 2) {
      if (form.contactAdminNom.trim().length < 2)    e.contactAdminNom = 'Nom contact admin requis';
      if (!MOROCCAN_PHONE.test(form.contactAdminPhone)) e.contactAdminPhone = 'Téléphone invalide';
      if (form.contactFinanceNom.trim().length < 2)  e.contactFinanceNom = 'Nom contact finance requis';
      if (!MOROCCAN_PHONE.test(form.contactFinancePhone)) e.contactFinancePhone = 'Téléphone invalide';
    }
    if (s === 3) {
      if (!form.gpsLat || !form.gpsLng) e.gps = 'Position GPS requise';
      if (!cndp) e.cndp = 'Le consentement CNDP est obligatoire';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep(s => s + 1); };
  const prev = () => { setStep(s => s - 1); setErrors({}); };

  const submit = async () => {
    if (!validateStep(3)) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/merchant/register', {
        businessName: form.businessName.trim(),
        category:     form.category,
        address:      form.address.trim(),
        city:         form.city.trim(),
        phone:        form.phone.replace(/\s/g, ''),
        email:        form.email.trim() || undefined,
        registrationNumber: form.registrationNumber.trim(),
        iceNumber:          form.iceNumber.trim(),
        cinRepresentant:    form.cinRepresentant.trim(),
        rib:                form.rib.trim(),
        contactAdmin:   { nom: form.contactAdminNom.trim(),   phone: form.contactAdminPhone },
        contactFinance: { nom: form.contactFinanceNom.trim(), phone: form.contactFinancePhone },
        gpsLat: parseFloat(form.gpsLat),
        gpsLng: parseFloat(form.gpsLng),
        photos: [],
        cndpConsent: true,
      });
      Alert.alert(
        '✅ Compte créé',
        'Votre demande est en cours de validation par notre équipe. Vous serez notifié par SMS.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)') }],
      );
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message ?? 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, k, placeholder, keyboard = 'default', optional = false }: any) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{optional ? <Text style={styles.optional}> (optionnel)</Text> : ' *'}</Text>
      <TextInput
        style={[styles.input, errors[k] && styles.inputErr]}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        value={(form as any)[k]}
        onChangeText={v => set(k, v)}
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
      />
      {errors[k] && <Text style={styles.err}>{errors[k]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <TouchableOpacity onPress={() => step > 0 ? prev() : router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.stepsRow}>
            {STEPS.map((s, i) => (
              <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                {i < step
                  ? <Text style={styles.stepCheck}>✓</Text>
                  : <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>}
              </View>
            ))}
          </View>
          <Text style={styles.stepLabel}>{STEPS[step]}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* ÉTAPE 0 — Infos de base */}
          {step === 0 && <>
            <Text style={styles.stepTitle}>Informations de base</Text>
            <Field label="Nom commercial" k="businessName" placeholder="Ex : Pharmacie Al Amal" />
            <View style={styles.field}>
              <Text style={styles.label}>Catégorie *</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catBtn, form.category === c.key && styles.catBtnActive]}
                    onPress={() => set('category', c.key)}
                  >
                    <Text style={[styles.catText, form.category === c.key && styles.catTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.category && <Text style={styles.err}>{errors.category}</Text>}
            </View>
            <Field label="Adresse" k="address" placeholder="123 Rue Mohammed V" />
            <Field label="Ville" k="city" placeholder="Casablanca" />
            <Field label="Téléphone" k="phone" placeholder="+212 6XXXXXXXX" keyboard="phone-pad" />
            <Field label="Email" k="email" placeholder="contact@commerce.ma" keyboard="email-address" optional />
          </>}

          {/* ÉTAPE 1 — Légal & Bancaire */}
          {step === 1 && <>
            <Text style={styles.stepTitle}>Documents légaux & Bancaire</Text>
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>Ces informations sont requises pour la conformité BAM et le KYC marchand.</Text>
            </View>
            <Field label="N° Registre de Commerce (RC)" k="registrationNumber" placeholder="Ex : 123456" />
            <Field label="N° ICE" k="iceNumber" placeholder="Ex : 001234567000012" />
            <Field label="CIN du représentant légal" k="cinRepresentant" placeholder="Ex : AB123456" />
            <Field label="RIB bancaire" k="rib" placeholder="Ex : 0114 2010 0000 1234 5678 9013" keyboard="number-pad" />
          </>}

          {/* ÉTAPE 2 — Contacts */}
          {step === 2 && <>
            <Text style={styles.stepTitle}>Contacts</Text>
            <Text style={styles.stepSubtitle}>Ces contacts seront utilisés pour la gestion du compte.</Text>
            <Text style={styles.contactSection}>👤 Contact administratif</Text>
            <Field label="Nom" k="contactAdminNom" placeholder="Ex : Youssef Alami" />
            <Field label="Téléphone" k="contactAdminPhone" placeholder="+212 6XXXXXXXX" keyboard="phone-pad" />
            <Text style={styles.contactSection}>💰 Contact financier</Text>
            <Field label="Nom" k="contactFinanceNom" placeholder="Ex : Sara Idrissi" />
            <Field label="Téléphone" k="contactFinancePhone" placeholder="+212 6XXXXXXXX" keyboard="phone-pad" />
          </>}

          {/* ÉTAPE 3 — Localisation + CNDP */}
          {step === 3 && <>
            <Text style={styles.stepTitle}>Localisation & Confirmation</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Position GPS *</Text>
              <TouchableOpacity style={styles.gpsBtn} onPress={detectLocation} disabled={locLoading} activeOpacity={0.8}>
                {locLoading
                  ? <ActivityIndicator color={Colors.primary} size="small" />
                  : <Text style={styles.gpsBtnText}>📍 Détecter ma position</Text>}
              </TouchableOpacity>
              {form.gpsLat && form.gpsLng && (
                <View style={styles.gpsResult}>
                  <Text style={styles.gpsCoords}>Lat: {form.gpsLat}  |  Lng: {form.gpsLng}</Text>
                </View>
              )}
              <View style={styles.manualGps}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Latitude" placeholderTextColor={Colors.textMuted} value={form.gpsLat} onChangeText={v => set('gpsLat', v)} keyboardType="numbers-and-punctuation" />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Longitude" placeholderTextColor={Colors.textMuted} value={form.gpsLng} onChangeText={v => set('gpsLng', v)} keyboardType="numbers-and-punctuation" />
              </View>
              {errors.gps && <Text style={styles.err}>{errors.gps}</Text>}
            </View>

            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>📸 Les photos de votre établissement seront demandées par notre équipe lors de la validation.</Text>
            </View>

            <TouchableOpacity style={styles.cndpRow} onPress={() => setCndp(c => !c)} activeOpacity={0.7}>
              <View style={[styles.checkbox, cndp && styles.checkboxActive]}>
                {cndp && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.cndpText}>
                J'accepte les CGU FamilyPay, la charte marchands, et le traitement de mes données (loi CNDP 09-08). Je certifie l'exactitude des informations fournies.
              </Text>
            </TouchableOpacity>
            {errors.cndp && <Text style={styles.err}>{errors.cndp}</Text>}

            <View style={styles.pendingBanner}>
              <Text style={styles.pendingIcon}>⏳</Text>
              <Text style={styles.pendingText}>
                Après inscription, votre dossier sera examiné sous 48h. Vous recevrez un SMS de confirmation.
              </Text>
            </View>
          </>}

          {/* Navigation */}
          <View style={styles.navRow}>
            {step < 3
              ? <TouchableOpacity style={[styles.btn, { backgroundColor: '#F59E0B' }]} onPress={next} activeOpacity={0.85}>
                  <Text style={styles.btnText}>Suivant →</Text>
                </TouchableOpacity>
              : <TouchableOpacity style={[styles.btn, { backgroundColor: '#F59E0B' }, loading && styles.btnDisabled]} onPress={submit} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Soumettre la demande</Text>}
                </TouchableOpacity>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  progressContainer: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginBottom: 10 },
  backArrow: { fontSize: 18, color: Colors.textPrimary },
  stepsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  stepDotActive: { borderColor: '#F59E0B', backgroundColor: '#FFF8E6' },
  stepDotDone: { borderColor: '#F59E0B', backgroundColor: '#F59E0B' },
  stepNum: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  stepNumActive: { color: '#F59E0B' },
  stepCheck: { fontSize: 12, fontWeight: '700', color: '#fff' },
  stepLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  scroll: { padding: 16, paddingBottom: 40 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4, marginTop: 4 },
  stepSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  contactSection: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 8, marginBottom: 8 },
  infoBanner: { backgroundColor: 'rgba(91,61,245,0.07)', borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  infoText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  pendingBanner: { backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: 14, flexDirection: 'row', gap: 10, marginTop: 12 },
  pendingIcon: { fontSize: 20 },
  pendingText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  field: { marginBottom: 14, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  optional: { fontWeight: '400', color: Colors.textMuted },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },
  inputErr: { borderColor: Colors.error },
  err: { fontSize: 12, color: Colors.error },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  catBtnActive: { borderColor: '#F59E0B', backgroundColor: '#FFF8E6' },
  catText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catTextActive: { color: '#92400E' },
  gpsBtn: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  gpsBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  gpsResult: { backgroundColor: Colors.successBg, borderRadius: Radius.sm, padding: 8, marginBottom: 8 },
  gpsCoords: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  manualGps: { flexDirection: 'row', gap: 8 },
  cndpRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cndpText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  navRow: { marginTop: 8 },
  btn: { borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
