import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius } from '../../src/constants/theme';
import { MOROCCAN_CITIES } from '../../src/constants/moroccan-cities';
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


interface MerchantFieldProps {
  label: string;
  fieldKey: string;
  placeholder: string;
  keyboard?: any;
  optional?: boolean;
  secure?: boolean;
  form: Record<string, string>;
  errors: Record<string, string>;
  onChange: (k: string, v: string) => void;
}

function MerchantField({ label, fieldKey, placeholder, keyboard = 'default', optional = false, secure = false, form, errors, onChange, onBlur }: MerchantFieldProps & { onBlur?: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{optional ? <Text style={styles.optional}> (optionnel)</Text> : ' *'}</Text>
      <TextInput
        style={[styles.input, errors[fieldKey] && styles.inputErr]}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        value={form[fieldKey] ?? ''}
        onChangeText={v => onChange(fieldKey, v)}
        onBlur={onBlur}
        keyboardType={keyboard}
        secureTextEntry={secure}
        autoCapitalize={keyboard === 'email-address' || secure ? 'none' : 'sentences'}
      />
      {errors[fieldKey] && <Text style={styles.err}>{errors[fieldKey]}</Text>}
    </View>
  );
}

export default function RegisterMerchantScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [cndp, setCndp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [checkingName, setCheckingName] = useState(false);

  const checkBusinessName = async (overrides?: { city?: string; address?: string; businessName?: string; category?: string }) => {
    const f = { ...formRef.current, ...overrides };
    if (!f.businessName.trim() || !f.city.trim() || !f.address.trim() || !f.category) return;
    setCheckingName(true);
    try {
      await apiClient.post('/auth/merchant/check', {
        businessName: f.businessName.trim(),
        city:         f.city.trim(),
        address:      f.address.trim(),
        category:     f.category,
      });
      setErrors(e => { const n = { ...e }; delete n.businessName; return n; });
    } catch (err: any) {
      const { field, message } = err?.response?.data ?? {};
      if (field === 'businessName') setErrors(e => ({ ...e, businessName: message }));
    } finally {
      setCheckingName(false);
    }
  };

  const [form, setForm] = useState({
    businessName: '', category: '' as any, address: '', city: '', phone: '', email: '',
    registrationNumber: '', iceNumber: '', cinRepresentant: '', rib: '',
    contactAdminNom: '', contactAdminPhone: '',
    contactFinanceNom: '', contactFinancePhone: '',
    gpsLat: '', gpsLng: '',
    password: '', confirmPassword: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const formRef = React.useRef(form);
  React.useEffect(() => { formRef.current = form; }, [form]);

  const geocodeAddress = async () => {
    if (!form.address || !form.city) {
      if (typeof window !== 'undefined') window.alert("Renseignez d'abord l'adresse et la ville (étape 1)");
      return;
    }
    setGeoLoading(true);
    try {
      const q = encodeURIComponent(`${form.address}, ${form.city}, Maroc`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        set('gpsLat', parseFloat(data[0].lat).toFixed(6));
        set('gpsLng', parseFloat(data[0].lon).toFixed(6));
      } else {
        if (typeof window !== 'undefined') window.alert('Adresse introuvable, essayez "Détecter ma position"');
      }
    } catch {
      if (typeof window !== 'undefined') window.alert('Erreur de géolocalisation');
    } finally {
      setGeoLoading(false);
    }
  };

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
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email obligatoire (identifiant de connexion)';
      if (form.password.trim().length < 6) e.password = 'Mot de passe requis (min 6 caractères)';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas';
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

  const next = async () => {
    if (!validateStep(step)) return;
    if (step === 0) {
      // Vérifier doublon phone/email avant de continuer
      try {
        await apiClient.post('/auth/merchant/check', {
          phone: form.phone.replace(/\s/g, ''),
          email: form.email.trim() || undefined,
        });
      } catch (err: any) {
        const { field, message } = err?.response?.data ?? {};
        setErrors(e => ({ ...e, [field ?? 'phone']: message ?? 'Déjà utilisé' }));
        return;
      }
    }
    setStep(s => s + 1);
  };
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
        password:     form.password,
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
      const msg = 'Votre demande est en cours de validation par notre équipe. Vous serez notifié par SMS.';
      if (typeof window !== 'undefined') {
        window.alert('✅ Compte marchand créé !\n\n' + msg);
        router.replace('/(auth)' as any);
      } else {
        Alert.alert('✅ Compte créé', msg, [{ text: 'OK', onPress: () => router.replace('/(auth)' as any) }]);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message ?? 'Impossible de créer le compte';
      if (typeof window !== 'undefined') { window.alert('Erreur : ' + errMsg); }
      else { Alert.alert('Erreur', errMsg); }
    } finally {
      setLoading(false);
    }
  };

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
            <MerchantField form={form} errors={errors} onChange={set} label="Nom commercial" fieldKey="businessName" onBlur={checkBusinessName} placeholder="Ex : Pharmacie Al Amal" />
            <View style={styles.field}>
              <Text style={styles.label}>Catégorie *</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catBtn, form.category === c.key && styles.catBtnActive]}
                    onPress={() => { set('category', c.key); checkBusinessName({ category: c.key }); }}
                  >
                    <Text style={[styles.catText, form.category === c.key && styles.catTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.category && <Text style={styles.err}>{errors.category}</Text>}
            </View>
            <MerchantField form={form} errors={errors} onChange={set} label="Adresse" fieldKey="address" onBlur={checkBusinessName} placeholder="123 Rue Mohammed V" />
            <View style={styles.field}>
              <Text style={styles.label}>Ville *</Text>
              <TouchableOpacity
                style={[styles.input, styles.cityPicker, errors.city && styles.inputErr]}
                onPress={() => { setShowCityPicker(v => !v); setCitySearch(''); }}
                activeOpacity={0.8}
              >
                <Text style={form.city ? { color: Colors.textPrimary, fontSize: 15 } : { color: Colors.textMuted, fontSize: 15 }}>
                  {form.city || 'Sélectionner une ville...'}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>{showCityPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {errors.city && <Text style={styles.err}>{errors.city}</Text>}
              {showCityPicker && (
                <View style={styles.cityDropdown}>
                  <TextInput
                    style={styles.citySearch}
                    placeholder="Rechercher une ville..."
                    placeholderTextColor={Colors.textMuted}
                    value={citySearch}
                    onChangeText={setCitySearch}
                    autoFocus
                  />
                  {MOROCCAN_CITIES.filter(c =>
                    citySearch.length < 1 || c.toLowerCase().includes(citySearch.toLowerCase())
                  ).map(city => (
                    <TouchableOpacity
                      key={city}
                      style={[styles.cityOption, form.city === city && styles.cityOptionActive]}
                      onPress={() => { set('city', city); setShowCityPicker(false); setCitySearch(''); checkBusinessName({ city }); }}
                    >
                      <Text style={[styles.cityOptionText, form.city === city && { color: Colors.primary, fontWeight: '700' }]}>{city}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <MerchantField form={form} errors={errors} onChange={set} label="Téléphone" fieldKey="phone" placeholder="+212 6XXXXXXXX" keyboard="phone-pad" />
            <MerchantField form={form} errors={errors} onChange={set} label="Email" fieldKey="email" placeholder="contact@commerce.ma" keyboard="email-address" optional />
            <MerchantField form={form} errors={errors} onChange={set} label="Mot de passe" fieldKey="password" placeholder="Min. 6 caractères" secure />
            <MerchantField form={form} errors={errors} onChange={set} label="Confirmer le mot de passe" fieldKey="confirmPassword" placeholder="Répéter le mot de passe" secure />
          </>}

          {/* ÉTAPE 1 — Légal & Bancaire */}
          {step === 1 && <>
            <Text style={styles.stepTitle}>Documents légaux & Bancaire</Text>
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>Ces informations sont requises pour la conformité BAM et le KYC marchand.</Text>
            </View>
            <MerchantField form={form} errors={errors} onChange={set} label="N° Registre de Commerce (RC)" fieldKey="registrationNumber" placeholder="Ex : 123456" />
            <MerchantField form={form} errors={errors} onChange={set} label="N° ICE" fieldKey="iceNumber" placeholder="Ex : 001234567000012" />
            <MerchantField form={form} errors={errors} onChange={set} label="CIN du représentant légal" fieldKey="cinRepresentant" placeholder="Ex : AB123456" />
            <MerchantField form={form} errors={errors} onChange={set} label="RIB bancaire" fieldKey="rib" placeholder="Ex : 0114 2010 0000 1234 5678 9013" keyboard="number-pad" />
          </>}

          {/* ÉTAPE 2 — Contacts */}
          {step === 2 && <>
            <Text style={styles.stepTitle}>Contacts</Text>
            <Text style={styles.stepSubtitle}>Ces contacts seront utilisés pour la gestion du compte.</Text>
            <Text style={styles.contactSection}>👤 Contact administratif</Text>
            <MerchantField form={form} errors={errors} onChange={set} label="Nom" fieldKey="contactAdminNom" placeholder="Ex : Youssef Alami" />
            <MerchantField form={form} errors={errors} onChange={set} label="Téléphone" fieldKey="contactAdminPhone" placeholder="+212 6XXXXXXXX" keyboard="phone-pad" />
            <Text style={styles.contactSection}>💰 Contact financier</Text>
            <MerchantField form={form} errors={errors} onChange={set} label="Nom" fieldKey="contactFinanceNom" placeholder="Ex : Sara Idrissi" />
            <MerchantField form={form} errors={errors} onChange={set} label="Téléphone" fieldKey="contactFinancePhone" placeholder="+212 6XXXXXXXX" keyboard="phone-pad" />
          </>}

          {/* ÉTAPE 3 — Localisation + CNDP */}
          {step === 3 && <>
            <Text style={styles.stepTitle}>Localisation & Confirmation</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Position GPS *</Text>
              <Text style={styles.hint}>Détectez automatiquement ou utilisez l'adresse saisie à l'étape 1</Text>
              <View style={styles.gpsButtons}>
                <TouchableOpacity style={[styles.gpsBtn, {flex:1}]} onPress={detectLocation} disabled={locLoading} activeOpacity={0.8}>
                  {locLoading
                    ? <ActivityIndicator color={Colors.primary} size="small" />
                    : <Text style={styles.gpsBtnText}>📍 Ma position</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.gpsBtn, {flex:1}]} onPress={geocodeAddress} disabled={geoLoading} activeOpacity={0.8}>
                  {geoLoading
                    ? <ActivityIndicator color={Colors.primary} size="small" />
                    : <Text style={styles.gpsBtnText}>🔍 Via adresse</Text>}
                </TouchableOpacity>
              </View>
              {form.gpsLat && form.gpsLng && (
                <View style={styles.gpsResult}>
                  <Text style={styles.gpsCoords}>✅ Position définie ({form.gpsLat}, {form.gpsLng})</Text>
                </View>
              )}
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
  navRow:          { marginTop: 8 },
  cityPicker:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  cityDropdown:    { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, maxHeight: 200, overflow: 'scroll' as any, marginTop: 4 },
  citySearch:      { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: Colors.primary, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.bg },
  cityOption:      { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cityOptionActive:{ backgroundColor: Colors.primaryLight },
  cityOptionText:  { fontSize: 14, color: Colors.textPrimary },
  btn: { borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
