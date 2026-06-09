import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, TextInput } from 'react-native';
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
  const [notif, setNotif] = useState(true);

  // Phone change state
  const [phoneSection, setPhoneSection] = useState(false);
  const [phoneStep, setPhoneStep]       = useState<'input' | 'otp'>('input');
  const [newPhone, setNewPhone]         = useState('');
  const [phoneOtp, setPhoneOtp]         = useState('');
  const [phoneErr, setPhoneErr]         = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Card state
  const [cardSection, setCardSection]   = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm]         = useState({ cardNumber: '', cardHolder: '', expiryMonth: '', expiryYear: '', brand: 'VISA' });
  const [cardErr, setCardErr]           = useState<string | null>(null);

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
    const confirmed = typeof window !== 'undefined' ? window.confirm('Voulez-vous vraiment vous déconnecter ?') : true;
    if (!confirmed) return;
    await clearAuth();
    if (typeof window !== 'undefined') { (window as any).location.href = '/'; } else { router.replace('/(auth)'); }
  };

  // Phone change handlers
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
      setPhoneSection(false); setPhoneStep('input'); setNewPhone(''); setPhoneOtp('');
      if (typeof window !== 'undefined') window.alert('Numéro mis à jour !');
    } catch (e: any) { setPhoneErr(e?.response?.data?.message ?? 'Code invalide'); }
    finally { setPhoneLoading(false); }
  };

  // Card mutations
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
      setCardErr(null);
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
    if (num.length < 13) { setCardErr('Numéro de carte invalide'); return false; }
    if (cardForm.cardHolder.trim().length < 3) { setCardErr('Nom du titulaire requis'); return false; }
    if (!Number(cardForm.expiryMonth) || Number(cardForm.expiryMonth) > 12) { setCardErr('Mois invalide'); return false; }
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
  const memberSince = new Date(user.createdAt).toLocaleDateString('fr-MA', { year: 'numeric', month: 'long' });
  const defaultCard = (cards ?? []).find(c => c.isDefault);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        {user.email && <Text style={styles.email}>{user.email}</Text>}
        <View style={styles.memberBadge}><Text style={styles.memberText}>Membre depuis {memberSince}</Text></View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data._count.beneficiaries}</Text>
          <Text style={styles.statLabel}>Bénéficiaires</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={styles.statNum}>{data._count.allocations}</Text>
          <Text style={styles.statLabel}>Allocations</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{(cards ?? []).length}</Text>
          <Text style={styles.statLabel}>Cartes</Text>
        </View>
      </View>

      {/* Déconnexion */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>

      {/* ── Téléphone ── */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => { setPhoneSection(v => !v); setPhoneStep('input'); setPhoneErr(null); }}>
          <View>
            <Text style={styles.sectionTitle}>📱 Téléphone</Text>
            <Text style={styles.sectionSub}>{user.phone}</Text>
          </View>
          <Text style={styles.chevron}>{phoneSection ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {phoneSection && (
          <View style={styles.inlineForm}>
            {phoneErr && <View style={styles.errBanner}><Text style={styles.errBannerText}>⚠️ {phoneErr}</Text></View>}
            {phoneStep === 'input' ? (
              <>
                <Text style={styles.formLabel}>Nouveau numéro</Text>
                <TextInput style={styles.formInput} placeholder="06XXXXXXXX" placeholderTextColor={Colors.textMuted} value={newPhone} onChangeText={v => { setNewPhone(v); setPhoneErr(null); }} keyboardType="phone-pad" />
                <TouchableOpacity style={[styles.formBtn, phoneLoading && styles.btnDisabled]} onPress={requestPhoneOtp} disabled={phoneLoading}>
                  {phoneLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.formBtnText}>Envoyer le code SMS →</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.formLabel}>Code OTP reçu par SMS</Text>
                <TextInput style={[styles.formInput, { textAlign: 'center', letterSpacing: 8, fontSize: 20 }]} placeholder="------" placeholderTextColor={Colors.textMuted} value={phoneOtp} onChangeText={v => { setPhoneOtp(v); setPhoneErr(null); }} keyboardType="number-pad" maxLength={6} />
                <TouchableOpacity style={[styles.formBtn, phoneLoading && styles.btnDisabled]} onPress={confirmPhoneOtp} disabled={phoneLoading}>
                  {phoneLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.formBtnText}>Confirmer →</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setPhoneStep('input'); setPhoneOtp(''); setPhoneErr(null); }}>
                  <Text style={styles.backLink}>← Changer le numéro</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* ── Cartes bancaires ── */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setCardSection(v => !v)}>
          <View>
            <Text style={styles.sectionTitle}>💳 Cartes bancaires</Text>
            <Text style={styles.sectionSub}>{(cards ?? []).length === 0 ? 'Aucune carte' : defaultCard ? defaultCard.maskedNumber : `${(cards ?? []).length} carte(s)`}</Text>
          </View>
          <Text style={styles.chevron}>{cardSection ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {cardSection && (
          <View style={styles.inlineForm}>
            {/* Liste des cartes */}
            {(cards ?? []).map(card => (
              <View key={card.id} style={[styles.cardItem, card.isDefault && styles.cardItemDefault]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.cardNum}>💳 {card.maskedNumber}</Text>
                    {card.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Défaut</Text></View>}
                  </View>
                  <Text style={styles.cardSub}>{card.cardHolder} · {String(card.expiryMonth).padStart(2,'0')}/{card.expiryYear} · {card.brand}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {!card.isDefault && (
                    <TouchableOpacity style={styles.cardBtn} onPress={() => setDefault.mutate(card.id)}>
                      <Text style={{ fontSize: 14 }}>⭐</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.cardBtn, { borderColor: '#fecaca', backgroundColor: '#fff1f1' }]}
                    onPress={() => { if (typeof window !== 'undefined' && window.confirm('Supprimer cette carte ?')) deleteCard.mutate(card.id); }}>
                    <Text style={{ fontSize: 14 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Bouton ajouter */}
            <TouchableOpacity style={styles.addCardToggle} onPress={() => { setShowCardForm(v => !v); setCardErr(null); }}>
              <Text style={styles.addCardToggleText}>{showCardForm ? '✕ Annuler' : '+ Ajouter une carte'}</Text>
            </TouchableOpacity>

            {/* Formulaire ajout */}
            {showCardForm && (
              <View style={styles.cardFormWrap}>
                {cardErr && <View style={styles.errBanner}><Text style={styles.errBannerText}>⚠️ {cardErr}</Text></View>}

                <Text style={styles.formLabel}>Numéro de carte *</Text>
                <TextInput style={styles.formInput} placeholder="1234 5678 9012 3456" placeholderTextColor={Colors.textMuted} value={cardForm.cardNumber} onChangeText={v => setCardForm(f => ({ ...f, cardNumber: v }))} keyboardType="number-pad" maxLength={19} />

                <Text style={styles.formLabel}>Titulaire *</Text>
                <TextInput style={styles.formInput} placeholder="NOM PRÉNOM" placeholderTextColor={Colors.textMuted} value={cardForm.cardHolder} onChangeText={v => setCardForm(f => ({ ...f, cardHolder: v.toUpperCase() }))} autoCapitalize="characters" />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Mois *</Text>
                    <TextInput style={styles.formInput} placeholder="MM" placeholderTextColor={Colors.textMuted} value={cardForm.expiryMonth} onChangeText={v => setCardForm(f => ({ ...f, expiryMonth: v }))} keyboardType="number-pad" maxLength={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Année *</Text>
                    <TextInput style={styles.formInput} placeholder="AAAA" placeholderTextColor={Colors.textMuted} value={cardForm.expiryYear} onChangeText={v => setCardForm(f => ({ ...f, expiryYear: v }))} keyboardType="number-pad" maxLength={4} />
                  </View>
                </View>

                <Text style={styles.formLabel}>Réseau</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {BRANDS.map(b => (
                    <TouchableOpacity key={b} style={[styles.brandChip, cardForm.brand === b && styles.brandChipActive]} onPress={() => setCardForm(f => ({ ...f, brand: b }))}>
                      <Text style={[styles.brandChipText, cardForm.brand === b && styles.brandChipTextActive]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={[styles.formBtn, addCard.isPending && styles.btnDisabled]} onPress={() => { if (validateCard()) addCard.mutate(); }} disabled={addCard.isPending}>
                  {addCard.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.formBtnText}>Enregistrer la carte →</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <View style={styles.switchRow}>
          <View><Text style={styles.switchLabel}>Alertes de transaction</Text><Text style={styles.switchSub}>Recevoir les confirmations de paiement</Text></View>
          <Switch value={notif} onValueChange={setNotif} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="#fff" />
        </View>
      </View>

      {/* Compte */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Compte</Text>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}><Text style={styles.actionText}>Conditions d'utilisation</Text><Text style={styles.chevron}>›</Text></TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}><Text style={styles.actionText}>Politique de confidentialité</Text><Text style={styles.chevron}>›</Text></TouchableOpacity>
      </View>

      <Text style={styles.version}>FamilyPay v1.0.0 — © ALTIVAX 2026</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.bg },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero:              { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: Colors.primary },
  avatar:            { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText:        { color: '#fff', fontWeight: '800', fontSize: 26 },
  name:              { color: '#fff', fontSize: 20, fontWeight: '700' },
  phone:             { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  email:             { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 1 },
  memberBadge:       { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  memberText:        { color: '#fff', fontSize: 12 },
  statsRow:          { flexDirection: 'row', margin: 16, gap: 10 },
  statCard:          { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statCardMiddle:    { borderColor: Colors.primary, borderWidth: 1.5 },
  statNum:           { fontSize: 16, fontWeight: '800', color: Colors.primary },
  statLabel:         { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  logoutBtn:         { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.errorBg, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutText:        { color: Colors.error, fontWeight: '700', fontSize: 15 },
  section:           { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  sectionHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sectionTitle:      { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  sectionSub:        { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  chevron:           { fontSize: 12, color: Colors.textMuted },
  inlineForm:        { borderTopWidth: 1, borderTopColor: Colors.border, padding: 16, gap: 8 },
  errBanner:         { backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#fecaca', borderRadius: Radius.md, padding: 10 },
  errBannerText:     { color: Colors.error, fontSize: 12 },
  formLabel:         { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  formInput:         { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: Colors.textPrimary },
  formBtn:           { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  btnDisabled:       { opacity: 0.6 },
  formBtnText:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  backLink:          { textAlign: 'center', fontSize: 13, color: Colors.primary, marginTop: 8 },
  cardItem:          { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border },
  cardItemDefault:   { borderColor: Colors.primary },
  cardNum:           { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  cardSub:           { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  defaultBadge:      { backgroundColor: 'rgba(91,61,245,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  defaultBadgeText:  { fontSize: 9, fontWeight: '700', color: Colors.primary },
  cardBtn:           { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  addCardToggle:     { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  addCardToggleText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  cardFormWrap:      { gap: 6, marginTop: 4 },
  brandChip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  brandChipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  brandChipText:     { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  brandChipTextActive: { color: '#fff' },
  switchRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  switchLabel:       { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  switchSub:         { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  actionRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  actionText:        { fontSize: 14, color: Colors.textPrimary },
  version:           { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: 16 },
});
