import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { apiClient } from '../../src/lib/api';

export default function AddCardScreen() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const [cardNumber, setCardNumber] = useState('');
  const [masked, setMasked]         = useState('');
  const [pspRef, setPspRef]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  // Format: **** **** **** 4242
  const formatCard = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    const parts  = digits.match(/.{1,4}/g) ?? [];
    setCardNumber(digits);
    const last4   = digits.slice(-4);
    const display = digits.length >= 4 ? `**** **** **** ${last4}` : digits;
    setMasked(display);
    // PSP ref simulé pour MVP
    if (digits.length === 16) {
      setPspRef(`PSP-MVP-${digits.slice(0,4)}-${digits.slice(-4)}`);
    }
    return parts.join(' ');
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (cardNumber.length !== 16) e.card = 'Numéro de carte invalide (16 chiffres)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const last4 = cardNumber.slice(-4);
      await apiClient.post('/mobile/sponsor/cards', {
        cardNumber:   cardNumber,
        cardHolder:   'CARTE MVP',
        expiryMonth:  12,
        expiryYear:   2099,
        brand:        'VISA',
      });
      await queryClient.invalidateQueries({ queryKey: ['sponsor-profile'] });
      Alert.alert('✅ Carte enregistrée', 'Votre carte a été ajoutée avec succès.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error ?? 'Impossible d\'enregistrer la carte');
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

          <Text style={styles.title}>Ajouter une carte</Text>
          <Text style={styles.subtitle}>
            Cette carte sera débitée lors des paiements de vos bénéficiaires.
          </Text>

          {/* Card preview */}
          <View style={styles.cardPreview}>
            <Text style={styles.cardPreviewLabel}>FamilyPay</Text>
            <Text style={styles.cardPreviewNumber}>
              {cardNumber.length > 0
                ? `${cardNumber.slice(0,4).padEnd(4,'•')} ${cardNumber.slice(4,8).padEnd(4,'•')} ${cardNumber.slice(8,12).padEnd(4,'•')} ${cardNumber.slice(12,16).padEnd(4,'•')}`
                : '•••• •••• •••• ••••'}
            </Text>
            <Text style={styles.cardPreviewChip}>💳 Visa / Mastercard / CMI</Text>
          </View>

          {/* Numéro de carte */}
          <View style={styles.field}>
            <Text style={styles.label}>Numéro de carte *</Text>
            <TextInput
              style={[styles.input, errors.card && styles.inputErr]}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={Colors.textMuted}
              value={cardNumber.replace(/(.{4})/g, '$1 ').trim()}
              onChangeText={v => formatCard(v)}
              keyboardType="number-pad"
              maxLength={19}
            />
            {errors.card && <Text style={styles.err}>{errors.card}</Text>}
          </View>

          {/* Info MVP */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoIcon}>🔒</Text>
            <Text style={styles.infoText}>
              MVP : La carte est stockée sous forme masquée. L'intégration PSP complète (CMI/NAPS) sera activée prochainement pour un débit réel.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, cardNumber.length !== 16 && styles.btnDisabled, loading && styles.btnDisabled]}
            onPress={submit}
            disabled={cardNumber.length !== 16 || loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enregistrer la carte</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={() => router.back()}>
            <Text style={styles.skipText}>Passer pour l'instant</Text>
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
  cardPreview: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 24, marginBottom: 24, aspectRatio: 1.6 },
  cardPreviewLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700', marginBottom: 'auto' as any },
  cardPreviewNumber: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 2, marginTop: 'auto' as any },
  cardPreviewChip: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 8 },
  field: { marginBottom: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 18, color: Colors.textPrimary, letterSpacing: 2 },
  inputErr: { borderColor: Colors.error },
  err: { fontSize: 12, color: Colors.error },
  infoBanner: { backgroundColor: 'rgba(91,61,245,0.07)', borderRadius: Radius.md, padding: 12, flexDirection: 'row', gap: 8, marginBottom: 20 },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipBtn: { alignItems: 'center', marginTop: 14 },
  skipText: { color: Colors.textMuted, fontSize: 14 },
});
