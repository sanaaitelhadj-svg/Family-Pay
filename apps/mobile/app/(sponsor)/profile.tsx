import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/lib/auth-store';
import { apiClient } from '../../src/lib/api';

type SponsorProfile = {
  id: string;
  user: { firstName: string; lastName: string; phone: string; email?: string; createdAt: string };
  _count: { allocations: number; beneficiaries: number };
};
type Card = { id: string; maskedNumber: string; cardHolder: string; expiryMonth: number; expiryYear: number; brand: string; isDefault: boolean };

const MOROCCAN_PHONE = /^(\+212|00212|0)[67]\d{8}$/;
const BRANDS = ['VISA', 'MASTERCARD', 'CMI', 'AUTRE'];

export default function ProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();

  const [openSection, setOpenSection] = useState<'phone' | 'cards' | null>(null);
  const [phoneStep, setPhoneStep]     = useState<'input' | 'otp'>('input');
  const [newPhone, setNewPhone]       = useState('');
  const [phoneOtp, setPhoneOtp]       = useState('');
  const [phoneErr, setPhoneErr]       = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm] = useState({ cardNumber: '', cardHolder: '', expiryMonth: '', expiryYear: '', brand: 'VISA' });
  const [cardErr, setCardErr]   = useState<string | null>(null);

  const { data, isLoading } = useQuery<SponsorProfile>({
    queryKey: ['sponsor-profile'],
    queryFn: () => apiClient.get('/mobile/sponsor/profile').then(r => r.data),
  });

  const { data: cards } = useQuery<Card[]>({
    queryKey: ['sponsor-cards'],
    queryFn: () => apiClient.get('/mobile/sponsor/cards').then(r => r.data),
    enabled: !!data,
  });

  const handleLogout = async () => {
    // Sur mobile, déconnexion directe (Alert optionnel)
    await clearAuth();
    if (typeof window !== 'undefined') { (window as any).location.href = '/'; } else { router.replace('/(auth)'); }
  };

  const toggle = (s: 'phone' | 'cards') => {
    setOpenSection(v => v === s ? null : s);
    setPhoneStep('input'); setPhoneErr(null); setCardErr(null); setShowCardForm(false);
  };

  const requestPhoneOtp = async () => {
    if (!MOROCCAN_PHONE.test(newPhone)) { setPhoneErr('Format invalide : 06XXXXXXXX'); return; }
    setPhoneLoading(true); setPhoneErr(null);
    try {
      await apiClient.post('/mobile/sponsor/phone/change-request', { newPhone: newPhone.replace(/\s/g, '') });
      setPhoneStep('otp');
    } catch (e: any) { setPhoneErr(e?.response?.data?.message ?? 'Erreur envoi SMS'); }
    finally { setPhoneLoading(false); }
  };

  const confirmPhoneOtp = async () => {
    if (phoneOtp.length < 4) { setPhoneErr('Entrez le code reçu'); return; }
    setPhoneLoading(true); setPhoneErr(null);
    try {
      await apiClient.post('/mobile/sponsor/phone/change-confirm', { newPhone: newPhone.replace(/\s/g, ''), code: phoneOtp });
      qc.invalidateQueries({ queryKey: ['sponsor-profile'] });
      setOpenSection(null); setPhoneStep('input'); setNewPhone(''); setPhoneOtp('');
      if (typeof window !== 'undefined') window.alert('Numéro mis à jour !');
    } catch (e: any) { setPhoneErr(e?.response?.data?.message ?? 'Code invalide'); }
    finally { setPhoneLoading(false); }
  };

  const addCard = useMutation({
    mutationFn: () => apiClient.post('/mobile/sponsor/cards', {
      cardNumber: cardForm.cardNumber.replace(/\s/g, ''),
      cardHolder: cardForm.cardHolder,
      expiryMonth: Number(cardForm.expiryMonth),
      expiryYear: Number(cardForm.expiryYear),
      brand: cardForm.brand,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-cards'] });
      setShowCardForm(false);
      setCardForm({ cardNumber: '', cardHolder: '', expiryMonth: '', expiryYear: '', brand: 'VISA' });
    },
    onError: (e: any) => setCardErr(e?.response?.data?.message ?? 'Erreur ajout carte'),
  });

  const deleteCard = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/mobile/sponsor/cards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-cards'] }),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/mobile/sponsor/cards/${id}/default`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-cards'] }),
  });

  const validateCard = () => {
    const num = cardForm.cardNumber.replace(/\s/g, '');
    if (num.length < 13) { setCardErr('Numéro invalide'); return false; }
    if (cardForm.cardHolder.trim().length < 3) { setCardErr('Nom requis'); return false; }
    if (!Number(cardForm.expiryMonth) || Number(cardForm.expiryMonth) > 12) { setCardErr('Mois invalide (1-12)'); return false; }
    if (!Number(cardForm.expiryYear) || Number(cardForm.expiryYear) < 2024) { setCardErr('Année invalide'); return false; }
    setCardErr(null); return true;
  };

  if (isLoading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <TouchableOpacity style={[styles.logoutBtn, { marginTop: 40, marginHorizontal: 40 }]} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Déconnexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { user } = data;
  const initials = `${(user.firstName ?? '')[0] ?? ''}`.toUpperCase();
  const defaultCard = (cards ?? []).find(c => c.isDefault);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Hero compact */}
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.heroInfo}>
          <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
          <Text style={styles.heroSub}>{user.phone}{user.email ? ` · ${user.email}` : ''}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtnSmall} onPress={handleLogout}>
          <Text style={styles.logoutBtnSmallText}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{data._count.beneficiaries}</Text><Text style={styles.statLabel}>Bénéficiaires</Text></View>
        <View style={[styles.statCard, styles.statCardMiddle]}><Text style={styles.statNum}>{data._count.allocations}</Text><Text style={styles.statLabel}>Allocations</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{(cards ?? []).length}</Text><Text style={styles.statLabel}>Cartes</Text></View>
      </View>

      {/* ── Téléphone (accordéon) ── */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionRow} onPress={() => toggle('phone')}>
          <Text style={styles.sectionIcon}>📱</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Téléphone</Text>
            <Text style={styles.sectionSub}>{user.phone}</Text>
          </View>
          <Text style={styles.chevron}>{openSection === 'phone' ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {openSection === 'phone' && (
          <View style={styles.accordionBody}>
            {phoneErr && <Text style={styles.errText}>⚠️ {phoneErr}</Text>}
            {phoneStep === 'input' ? (
              <>
                <TextInput style={styles.input} placeholder="Nouveau numéro" placeholderTextColor={Colors.textMuted} value={newPhone} onChangeText={v => { setNewPhone(v); setPhoneErr(null); }} keyboardType="phone-pad" />
                <TouchableOpacity style={[styles.btn, phoneLoading && styles.btnOff]} onPress={requestPhoneOtp} disabled={phoneLoading}>
                  {phoneLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Envoyer le code SMS →</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 20 }]} placeholder="------" placeholderTextColor={Colors.textMuted} value={phoneOtp} onChangeText={v => { setPhoneOtp(v); setPhoneErr(null); }} keyboardType="number-pad" maxLength={6} />
                <TouchableOpacity style={[styles.btn, phoneLoading && styles.btnOff]} onPress={confirmPhoneOtp} disabled={phoneLoading}>
                  {phoneLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Confirmer →</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setPhoneStep('input'); setPhoneOtp(''); }}>
                  <Text style={styles.backLink}>← Modifier le numéro</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* ── Cartes bancaires (accordéon) ── */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionRow} onPress={() => toggle('cards')}>
          <Text style={styles.sectionIcon}>💳</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Cartes bancaires</Text>
            <Text style={styles.sectionSub}>{defaultCard ? defaultCard.maskedNumber : (cards ?? []).length === 0 ? 'Aucune carte' : `${(cards ?? []).length} carte(s)`}</Text>
          </View>
          <Text style={styles.chevron}>{openSection === 'cards' ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {openSection === 'cards' && (
          <View style={styles.accordionBody}>
            {(cards ?? []).map(card => (
              <View key={card.id} style={[styles.cardRow, card.isDefault && styles.cardRowDefault]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardNum}>{card.maskedNumber} {card.isDefault && <Text style={styles.defaultTag}>✓ Défaut</Text>}</Text>
                  <Text style={styles.cardSub}>{card.cardHolder} · {String(card.expiryMonth).padStart(2,'0')}/{card.expiryYear} · {card.brand}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {!card.isDefault && <TouchableOpacity style={styles.iconBtn} onPress={() => setDefault.mutate(card.id)}><Text>⭐</Text></TouchableOpacity>}
                  <TouchableOpacity style={[styles.iconBtn, styles.iconBtnDanger]}
                    onPress={() => { if (typeof window !== 'undefined' && window.confirm('Supprimer cette carte ?')) deleteCard.mutate(card.id); }}>
                    <Text>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addCardBtn} onPress={() => { setShowCardForm(v => !v); setCardErr(null); }}>
              <Text style={styles.addCardBtnText}>{showCardForm ? '✕ Annuler' : '+ Ajouter une carte'}</Text>
            </TouchableOpacity>

            {showCardForm && (
              <View style={{ gap: 8, marginTop: 8 }}>
                {cardErr && <Text style={styles.errText}>⚠️ {cardErr}</Text>}
                <TextInput style={styles.input} placeholder="Numéro de carte" placeholderTextColor={Colors.textMuted} value={cardForm.cardNumber} onChangeText={v => setCardForm(f => ({ ...f, cardNumber: v }))} keyboardType="number-pad" maxLength={19} />
                <TextInput style={styles.input} placeholder="Titulaire (NOM PRÉNOM)" placeholderTextColor={Colors.textMuted} value={cardForm.cardHolder} onChangeText={v => setCardForm(f => ({ ...f, cardHolder: v.toUpperCase() }))} autoCapitalize="characters" />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="MM" placeholderTextColor={Colors.textMuted} value={cardForm.expiryMonth} onChangeText={v => setCardForm(f => ({ ...f, expiryMonth: v }))} keyboardType="number-pad" maxLength={2} />
                  <TextInput style={[styles.input, { flex: 2 }]} placeholder="AAAA" placeholderTextColor={Colors.textMuted} value={cardForm.expiryYear} onChangeText={v => setCardForm(f => ({ ...f, expiryYear: v }))} keyboardType="number-pad" maxLength={4} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {BRANDS.map(b => (
                    <TouchableOpacity key={b} style={[styles.chip, cardForm.brand === b && styles.chipActive]} onPress={() => setCardForm(f => ({ ...f, brand: b }))}>
                      <Text style={[styles.chipText, cardForm.brand === b && styles.chipTextActive]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.btn, addCard.isPending && styles.btnOff]} onPress={() => { if (validateCard()) addCard.mutate(); }} disabled={addCard.isPending}>
                  {addCard.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Enregistrer →</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <Text style={styles.version}>FamilyPay v1.0.0 — © ALTIVAX 2026</Text>
      {/* Bouton déconnexion */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bg },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero:            { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20, backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  avatar:          { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText:      { color: '#fff', fontWeight: '800', fontSize: 22 },
  heroInfo:        { flex: 1 },
  name:            { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  heroSub:         { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3 },
  logoutBtnSmall:  { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
  logoutBtnSmallText: { fontSize: 18 },
  statsRow:        { flexDirection: 'row', margin: 16, gap: 10 },
  statCard:        { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statCardMiddle:  { borderColor: Colors.primary, borderWidth: 1.5, backgroundColor: Colors.primaryLight },
  statNum:         { fontSize: 20, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  statLabel:       { fontSize: 10, color: Colors.textSecondary, marginTop: 3, fontWeight: '500' },
  logoutBtn:       { marginHorizontal: 16, marginBottom: 16, backgroundColor: Colors.errorBg, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: Colors.errorBorder },
  logoutText:      { color: Colors.error, fontWeight: '700', fontSize: 15 },
  section:         { marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  sectionRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  sectionIcon:     { fontSize: 20, width: 32, textAlign: 'center' },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  sectionSub:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  chevron:         { fontSize: 12, color: Colors.textMuted },
  accordionBody:   { borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, gap: 10 },
  errText:         { fontSize: 12, color: Colors.error, backgroundColor: Colors.errorBg, padding: 10, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.errorBorder },
  input:           { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary },
  btn:             { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnOff:          { opacity: 0.5 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 14 },
  backLink:        { textAlign: 'center', fontSize: 12, color: Colors.primary, marginTop: 6 },
  cardRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border },
  cardRowDefault:  { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  cardNum:         { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  defaultTag:      { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  cardSub:         { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  iconBtn:         { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  iconBtnDanger:   { borderColor: Colors.errorBorder, backgroundColor: Colors.errorBg },
  addCardBtn:      { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 11, alignItems: 'center', marginTop: 6 },
  addCardBtnText:  { fontSize: 13, fontWeight: '700', color: Colors.primary },
  chip:            { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  chipActive:      { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:        { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive:  { color: '#fff' },
  version:         { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: 16, marginBottom: 4 },
});
