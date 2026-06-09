import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../src/lib/api';
import { Colors, Radius } from '../../src/constants/theme';

type Card = { id: string; maskedNumber: string; cardHolder: string; expiryMonth: number; expiryYear: number; brand: string; isDefault: boolean };

const BRANDS = ['VISA', 'MASTERCARD', 'CMI', 'AUTRE'];
const BRAND_ICONS: Record<string, string> = { VISA: '💳', MASTERCARD: '💳', CMI: '🏦', AUTRE: '💳' };

export default function CardsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cardNumber: '', cardHolder: '', expiryMonth: '', expiryYear: '', brand: 'VISA' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: cards, isLoading } = useQuery<Card[]>({
    queryKey: ['sponsor-cards'],
    queryFn: () => apiClient.get('/mobile/sponsor/cards').then(r => r.data),
  });

  const addCard = useMutation({
    mutationFn: () => apiClient.post('/mobile/sponsor/cards', {
      cardNumber: form.cardNumber.replace(/\s/g, ''),
      cardHolder: form.cardHolder,
      expiryMonth: Number(form.expiryMonth),
      expiryYear: Number(form.expiryYear),
      brand: form.brand,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-cards'] });
      setShowForm(false);
      setForm({ cardNumber: '', cardHolder: '', expiryMonth: '', expiryYear: '', brand: 'VISA' });
      if (typeof window !== 'undefined') window.alert('Carte ajoutée avec succès !');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Erreur';
      if (typeof window !== 'undefined') window.alert('Erreur : ' + msg);
    },
  });

  const deleteCard = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/mobile/sponsor/cards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-cards'] }),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/mobile/sponsor/cards/${id}/default`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-cards'] }),
  });

  const validate = () => {
    const e: Record<string, string> = {};
    const num = form.cardNumber.replace(/\s/g, '');
    if (num.length < 13 || num.length > 19) e.cardNumber = 'Numéro invalide (13-19 chiffres)';
    if (form.cardHolder.trim().length < 3) e.cardHolder = 'Nom requis';
    const m = Number(form.expiryMonth);
    if (!m || m < 1 || m > 12) e.expiryMonth = 'Mois invalide (1-12)';
    const y = Number(form.expiryYear);
    if (!y || y < 2024) e.expiryYear = 'Année invalide';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => { if (validate()) addCard.mutate(); };

  const confirmDelete = (id: string) => {
    if (typeof window !== 'undefined') {
      if (window.confirm('Supprimer cette carte ?')) deleteCard.mutate(id);
    } else deleteCard.mutate(id);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Mes cartes</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(v => !v)}>
            <Text style={styles.addBtnText}>{showForm ? '✕ Annuler' : '+ Ajouter'}</Text>
          </TouchableOpacity>
        </View>

        {/* Formulaire ajout */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Nouvelle carte</Text>

            <Text style={styles.label}>Numéro de carte *</Text>
            <TextInput style={[styles.input, errors.cardNumber && styles.inputErr]} placeholder="1234 5678 9012 3456" placeholderTextColor={Colors.textMuted} value={form.cardNumber} onChangeText={v => setForm(f => ({ ...f, cardNumber: v }))} keyboardType="number-pad" maxLength={19} />
            {errors.cardNumber && <Text style={styles.err}>{errors.cardNumber}</Text>}

            <Text style={styles.label}>Titulaire *</Text>
            <TextInput style={[styles.input, errors.cardHolder && styles.inputErr]} placeholder="NOM PRÉNOM" placeholderTextColor={Colors.textMuted} value={form.cardHolder} onChangeText={v => setForm(f => ({ ...f, cardHolder: v.toUpperCase() }))} autoCapitalize="characters" />
            {errors.cardHolder && <Text style={styles.err}>{errors.cardHolder}</Text>}

            <View style={styles.expiryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Mois *</Text>
                <TextInput style={[styles.input, errors.expiryMonth && styles.inputErr]} placeholder="MM" placeholderTextColor={Colors.textMuted} value={form.expiryMonth} onChangeText={v => setForm(f => ({ ...f, expiryMonth: v }))} keyboardType="number-pad" maxLength={2} />
                {errors.expiryMonth && <Text style={styles.err}>{errors.expiryMonth}</Text>}
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Année *</Text>
                <TextInput style={[styles.input, errors.expiryYear && styles.inputErr]} placeholder="AAAA" placeholderTextColor={Colors.textMuted} value={form.expiryYear} onChangeText={v => setForm(f => ({ ...f, expiryYear: v }))} keyboardType="number-pad" maxLength={4} />
                {errors.expiryYear && <Text style={styles.err}>{errors.expiryYear}</Text>}
              </View>
            </View>

            <Text style={styles.label}>Réseau</Text>
            <View style={styles.brandRow}>
              {BRANDS.map(b => (
                <TouchableOpacity key={b} style={[styles.brandChip, form.brand === b && styles.brandChipActive]} onPress={() => setForm(f => ({ ...f, brand: b }))}>
                  <Text style={[styles.brandChipText, form.brand === b && styles.brandChipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.submitBtn, addCard.isPending && styles.btnDisabled]} onPress={handleAdd} disabled={addCard.isPending}>
              {addCard.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Enregistrer la carte →</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Liste des cartes */}
        {isLoading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />}
        {!isLoading && (cards ?? []).length === 0 && !showForm && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyText}>Aucune carte enregistrée</Text>
            <Text style={styles.emptySub}>Ajoutez une carte pour financer vos allocations</Text>
          </View>
        )}
        {(cards ?? []).map(card => (
          <View key={card.id} style={[styles.cardItem, card.isDefault && styles.cardItemDefault]}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardIcon}>{BRAND_ICONS[card.brand] ?? '💳'}</Text>
              <View>
                <View style={styles.cardNumRow}>
                  <Text style={styles.cardNum}>{card.maskedNumber}</Text>
                  {card.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Par défaut</Text></View>}
                </View>
                <Text style={styles.cardHolder}>{card.cardHolder}</Text>
                <Text style={styles.cardExpiry}>{String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              {!card.isDefault && (
                <TouchableOpacity style={styles.cardActionBtn} onPress={() => setDefault.mutate(card.id)}>
                  <Text style={styles.cardActionText}>⭐</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionDanger]} onPress={() => confirmDelete(card.id)}>
                <Text style={styles.cardActionText}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: Colors.bg },
  scroll:           { padding: 16, paddingBottom: 40 },
  topBar:           { flexDirection: 'row', alignItems: 'center', paddingTop: 40, paddingBottom: 16, gap: 12 },
  backBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  backArrow:        { fontSize: 18, color: Colors.textPrimary },
  title:            { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  addBtn:           { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
  addBtnText:       { color: '#fff', fontWeight: '600', fontSize: 13 },
  formCard:         { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20, gap: 6 },
  formTitle:        { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  label:            { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginTop: 8 },
  input:            { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: Colors.textPrimary, marginTop: 4 },
  inputErr:         { borderColor: Colors.error },
  err:              { fontSize: 11, color: Colors.error, marginTop: 2 },
  expiryRow:        { flexDirection: 'row', marginTop: 4 },
  brandRow:         { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  brandChip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  brandChipActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  brandChipText:    { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  brandChipTextActive: { color: '#fff' },
  submitBtn:        { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  btnDisabled:      { opacity: 0.6 },
  submitBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  cardItem:         { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardItemDefault:  { borderColor: Colors.primary, borderWidth: 1.5 },
  cardLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardIcon:         { fontSize: 28 },
  cardNumRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardNum:          { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 1 },
  defaultBadge:     { backgroundColor: 'rgba(91,61,245,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  cardHolder:       { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardExpiry:       { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  cardActions:      { flexDirection: 'row', gap: 6 },
  cardActionBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cardActionDanger: { borderColor: '#fecaca', backgroundColor: '#fff1f1' },
  cardActionText:   { fontSize: 14 },
  empty:            { alignItems: 'center', paddingTop: 60 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyText:        { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  emptySub:         { fontSize: 13, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
});
