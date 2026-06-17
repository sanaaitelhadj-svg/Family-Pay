import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, Switch } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card } from '@/components/Card';

const CATEGORIES = [
  {key:'GENERAL',   label:'Général',      icon:'💰'},
  {key:'PHARMACY',  label:'Pharmacie',    icon:'💊'},
  {key:'FOOD',      label:'Alimentation', icon:'🍕'},
  {key:'CLOTHING',  label:'Habillement',  icon:'👗'},
  {key:'EDUCATION', label:'Éducation',    icon:'📚'},
  {key:'LEISURE',   label:'Loisirs',      icon:'🎮'},
];

export default function CreateAllocationScreen() {
  const { data: profile } = useQuery({
    queryKey: ['sponsor-profile'],
    queryFn: async () => { const r = await api.get('/mobile/sponsor/profile'); return r.data; },
  });

  const router  = useRouter();
  const qc      = useQueryClient();
  const [category,           setCategory]           = useState('GENERAL');
  const [beneficiary,        setBeneficiary]        = useState('');
  const [amount,             setAmount]             = useState('');
  const [expiresAt,          setExpiresAt]          = useState('');
  const [cardId,             setCardId]             = useState('');
  const [requiresApproval,   setRequiresApproval]   = useState(false);
  const [thresholdEnabled,   setThresholdEnabled]   = useState(false);
  const [thresholdType,      setThresholdType]      = useState<'AMOUNT'|'PERCENT'>('PERCENT');
  const [thresholdValue,     setThresholdValue]     = useState('');
  const [thresholdPeriod,    setThresholdPeriod]    = useState<'DAILY'|'MONTHLY'|'SEMIANNUAL'|'ANNUAL'|'TOTAL'>('MONTHLY');
  const [thresholdAutoSuspend, setThresholdAutoSuspend] = useState(false);
  const [renewalPeriod,      setRenewalPeriod]      = useState<string>('');
  const [limitMerchants,     setLimitMerchants]     = useState(false);
  const [selectedMerchants,  setSelectedMerchants]  = useState<string[]>([]);
  const [showDatePicker,     setShowDatePicker]     = useState(false);

  // Reset complet du formulaire à chaque ouverture de l'écran
  useFocusEffect(useCallback(() => {
    setCategory('GENERAL');
    setBeneficiary('');
    setAmount('');
    setExpiresAt('');
    setCardId('');
    setRequiresApproval(false);
    setThresholdEnabled(false);
    setThresholdType('PERCENT');
    setThresholdValue('');
    setThresholdPeriod('MONTHLY');
    setThresholdAutoSuspend(false);
    setRenewalPeriod('');
    setLimitMerchants(false);
    setSelectedMerchants([]);
    setShowDatePicker(false);
  }, []));

  const { data: cards } = useQuery({
    queryKey: ['sponsor-cards'],
    queryFn: () => api.get('/mobile/sponsor/cards').then(r => r.data ?? []),
  });

  const { data: beneficiaries } = useQuery({
    queryKey: ['sponsor-beneficiaries'],
    queryFn: () => api.get('/mobile/sponsor/beneficiaries').then(r => r.data ?? []),
  });

  const { data: merchants, isLoading: loadingMerchants } = useQuery({
    queryKey: ['sponsor-merchants', category],
    queryFn: () => api.get(`/mobile/sponsor/merchants?category=${category}`).then(r => r.data ?? []),
    enabled: limitMerchants,
  });

  const defaultCard = (cards ?? []).find((c: any) => c.isDefault);
  const selectedBenef = (beneficiaries ?? []).find((b: any) => b.id === beneficiary);

  React.useEffect(() => {
    if (selectedBenef?.isMinor) setRequiresApproval(true);
  }, [beneficiary]);

  // Reset merchant selection when category changes
  React.useEffect(() => {
    setSelectedMerchants([]);
  }, [category]);

  const toggleMerchant = (id: string) => {
    setSelectedMerchants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const mutation = useMutation({
    mutationFn: () => api.post('/mobile/sponsor/allocations', {
      beneficiaryId: beneficiary,
      category,
      limitAmount: Number(amount),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      cardId: cardId || defaultCard?.id || undefined,
      requiresApproval,
      renewalPeriod: renewalPeriod || null,
      ...(thresholdEnabled && thresholdValue ? {
        thresholdValue:       Number(thresholdValue),
        thresholdType,
        thresholdPeriod,
        thresholdAutoSuspend,
      } : {}),
      allowedMerchantIds: limitMerchants && selectedMerchants.length > 0 ? selectedMerchants : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-allocations'] });
      if (typeof window !== 'undefined') { window.alert('✅ Allocation créée avec succès !'); router.back(); }
      else { Alert.alert('✅ Allocation créée', "L'allocation a été créée avec succès.", [{ text: 'OK', onPress: () => router.back() }]); }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erreur lors de la création';
      if (typeof window !== 'undefined') { window.alert('Erreur : ' + msg); } else { Alert.alert('Erreur', msg); }
    },
  });

  const canSubmit = beneficiary && amount && Number(amount) > 0 && !mutation.isPending && !(thresholdEnabled && (!thresholdValue || Number(thresholdValue) <= 0));

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Retour</Text></TouchableOpacity>
        <Text style={styles.title}>Nouvelle allocation</Text>
        <View style={{width:60}} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Catégorie */}
        <Text style={styles.label}>Catégorie *</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c.key} onPress={() => setCategory(c.key)} activeOpacity={0.8}
              style={[styles.catCard, category === c.key && styles.catCardActive]}>
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text style={[styles.catLabel, category === c.key && styles.catLabelActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bénéficiaire */}
        <Text style={styles.label}>Bénéficiaire *</Text>
        {!beneficiaries || beneficiaries.length === 0 ? (
          <Card style={styles.noBeneCard}>
            <Text style={styles.noBeneText}>Aucun bénéficiaire lié</Text>
            <Button label="🔗 Inviter par lien" onPress={() => router.push('/(sponsor)/invite' as any)} variant="outline" style={{marginTop:10}} />
            <Button label="➕ Créer un compte bénéficiaire" onPress={() => router.push('/(sponsor)/create-beneficiary' as any)} style={{marginTop:8}} />
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}} contentContainerStyle={{gap:10}}>
            {beneficiaries.map((b: any) => (
              <TouchableOpacity key={b.id} onPress={() => setBeneficiary(b.id)} activeOpacity={0.8}
                style={[styles.beneChip, beneficiary === b.id && styles.beneChipActive]}>
                <View style={styles.beneAvatar}>
                  <Text style={styles.beneAvatarText}>{b.user?.firstName?.charAt(0)??'?'}</Text>
                </View>
                <Text style={[styles.beneName, beneficiary === b.id && styles.beneNameActive]}>
                  {b.user?.firstName} {b.user?.lastName??''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Montant */}
        <Text style={styles.label}>Montant limite (MAD) *</Text>
        <View style={styles.inputWrap}>
          <TextInput style={styles.input} placeholder="ex: 500" keyboardType="numeric"
            value={amount} onChangeText={setAmount} placeholderTextColor={Colors.textMuted} />
          <Text style={styles.inputSuffix}>MAD</Text>
        </View>

        {/* Date expiration */}
        <Text style={styles.label}>Date d'expiration <Text style={styles.optional}>(optionnel)</Text></Text>
        <View style={styles.inputWrap}>
          {Platform.OS === 'web' ? (
            <input type="date"
              style={{ flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#1a1a2e', padding: '2px 0' } as any}
              onChange={e => setExpiresAt(e.target.value)} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: expiresAt ? '#1a1a2e' : Colors.textMuted, fontSize: 15 }}>
                  {expiresAt ? (() => { const [y,m,d] = expiresAt.split('-'); return `${d}/${m}/${y}`; })() : 'JJ/MM/AAAA'}
                </Text>
                <Text style={{ fontSize: 18 }}>📅</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={expiresAt ? new Date(expiresAt) : new Date()}
                  mode="date"
                  display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                  minimumDate={new Date()}
                  onChange={(_: any, date?: Date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setExpiresAt(`${y}-${m}-${d}`);
                    }
                  }}
                />
              )}
            </>
          )}
        </View>

        {/* Approbation */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>🔐 Approbation par transaction{selectedBenef?.isMinor ? '  ⚠️ Mineur' : ''}</Text>
            <Text style={styles.switchSub}>{requiresApproval ? 'Chaque paiement devra être approuvé par vous' : 'Les paiements sont automatiquement autorisés'}</Text>
          </View>
          <Switch value={requiresApproval} onValueChange={setRequiresApproval}
            trackColor={{ false: '#d1d5db', true: Colors.primary }} thumbColor="#fff"
            disabled={selectedBenef?.isMinor === true} />
        </View>

        {/* ── Seuil d'alerte ── */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>📊 Seuil d'alerte</Text>
            <Text style={styles.switchSub}>{thresholdEnabled ? 'Alerte et/ou suspension automatique' : 'Aucun seuil défini'}</Text>
          </View>
          <Switch value={thresholdEnabled} onValueChange={setThresholdEnabled} trackColor={{ false: '#D1D5DB', true: '#5B3DF5' }} thumbColor="#fff" />
        </View>

        {thresholdEnabled && (
          <View style={styles.thresholdBox}>
            {/* Type */}
            <Text style={styles.thresholdLabel}>Type de seuil</Text>
            <View style={styles.segmentRow}>
              {(['PERCENT', 'AMOUNT'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.segBtn, thresholdType === t && styles.segBtnActive]} onPress={() => setThresholdType(t)}>
                  <Text style={[styles.segBtnText, thresholdType === t && styles.segBtnTextActive]}>{t === 'PERCENT' ? '% Pourcentage' : 'MAD Montant'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Valeur */}
            <Text style={styles.thresholdLabel}>Valeur du seuil</Text>
            <View style={styles.thresholdInputRow}>
              <TextInput
                style={styles.thresholdInput}
                placeholder={thresholdType === 'PERCENT' ? 'ex: 80' : 'ex: 500'}
                keyboardType="numeric"
                value={thresholdValue}
                onChangeText={setThresholdValue}
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.thresholdUnit}>{thresholdType === 'PERCENT' ? '%' : 'MAD'}</Text>
            </View>

            {/* Période */}
            <Text style={styles.thresholdLabel}>Période</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([
                  { v: 'DAILY',      l: 'Journalier' },
                  { v: 'MONTHLY',    l: 'Mensuel' },
                  { v: 'SEMIANNUAL', l: 'Semestriel' },
                  { v: 'ANNUAL',     l: 'Annuel' },
                  { v: 'TOTAL',      l: 'Global' },
                ] as const).map(({ v, l }) => (
                  <TouchableOpacity key={v} style={[styles.periodBtn, thresholdPeriod === v && styles.periodBtnActive]} onPress={() => setThresholdPeriod(v)}>
                    <Text style={[styles.periodBtnText, thresholdPeriod === v && styles.periodBtnTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Auto-suspension */}
            <View style={[styles.switchRow, { marginBottom: 0, marginTop: 4 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>🔴 Suspension automatique</Text>
                <Text style={styles.switchSub}>{thresholdAutoSuspend ? "L'allocation sera suspendue dès le seuil atteint" : 'Alerte uniquement, pas de suspension'}</Text>
              </View>
              <Switch value={thresholdAutoSuspend} onValueChange={setThresholdAutoSuspend} trackColor={{ false: '#D1D5DB', true: '#EF4444' }} thumbColor="#fff" />
            </View>
          </View>
        )}

        {/* Limiter aux marchands */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>🏪 Limiter à des marchands spécifiques</Text>
            <Text style={styles.switchSub}>{limitMerchants ? 'Sélectionnez les marchands autorisés ci-dessous' : 'Tous les marchands de la catégorie sont acceptés'}</Text>
          </View>
          <Switch value={limitMerchants} onValueChange={v => { setLimitMerchants(v); if (!v) setSelectedMerchants([]); }}
            trackColor={{ false: '#d1d5db', true: Colors.primary }} thumbColor="#fff" />
        </View>

        {/* Liste marchands */}
        {limitMerchants && (
          <View style={styles.merchantSection}>
            <View style={styles.merchantHeader}>
              <Text style={styles.merchantTitle}>Marchands disponibles en {CATEGORIES.find(c=>c.key===category)?.label ?? category}</Text>
              {selectedMerchants.length > 0 && (
                <TouchableOpacity onPress={() => setSelectedMerchants([])}>
                  <Text style={styles.clearBtn}>Tout effacer</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingMerchants ? (
              <Text style={styles.loadingText}>Chargement...</Text>
            ) : !merchants || merchants.length === 0 ? (
              <View style={styles.emptyMerchants}>
                <Text style={styles.emptyMerchantsText}>Aucun marchand actif dans cette catégorie</Text>
              </View>
            ) : (
              <View style={styles.merchantList}>
                {merchants.map((m: any) => {
                  const selected = selectedMerchants.includes(m.id);
                  return (
                    <TouchableOpacity key={m.id} onPress={() => toggleMerchant(m.id)} activeOpacity={0.7}
                      style={[styles.merchantItem, selected && styles.merchantItemSelected]}>
                      <View style={[styles.merchantCheck, selected && styles.merchantCheckSelected]}>
                        {selected && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.merchantName, selected && styles.merchantNameSelected]}>{m.businessName}</Text>
                        <Text style={styles.merchantCity}>{m.city}{m.address ? ` — ${m.address}` : ''}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedMerchants.length > 0 && (
              <View style={styles.selectionBadge}>
                <Text style={styles.selectionBadgeText}>✓ {selectedMerchants.length} marchand{selectedMerchants.length > 1 ? 's' : ''} sélectionné{selectedMerchants.length > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        )}

        {/* Carte bancaire */}
        <Text style={styles.label}>Carte bancaire</Text>
        {(cards ?? []).length === 0 ? (
          <TouchableOpacity style={styles.noCardBtn} onPress={() => router.push('/(sponsor)/cards' as any)}>
            <Text style={styles.noCardText}>+ Ajouter une carte de paiement</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.cardsRow}>
            {(cards ?? []).map((c: any) => (
              <TouchableOpacity key={c.id}
                style={[styles.cardChip, (cardId === c.id || (!cardId && c.isDefault)) && styles.cardChipActive]}
                onPress={() => setCardId(c.id)}>
                <Text style={styles.cardChipNum}>{c.maskedNumber}</Text>
                <Text style={styles.cardChipSub}>{String(c.expiryMonth).padStart(2,'0')}/{c.expiryYear}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cardChipAdd} onPress={() => router.push('/(sponsor)/cards' as any)}>
              <Text style={styles.cardChipAddText}>+ Carte</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Renouvellement automatique ── */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>🔄 Renouvellement automatique</Text>
            <Text style={styles.switchSub}>{renewalPeriod ? `Remis à zéro chaque période : ${renewalPeriod === 'DAILY' ? 'Journalier' : renewalPeriod === 'WEEKLY' ? 'Hebdomadaire' : renewalPeriod === 'MONTHLY' ? 'Mensuel' : renewalPeriod === 'QUARTERLY' ? 'Trimestriel' : 'Annuel'}` : 'Aucun renouvellement'}</Text>
          </View>
          <Switch value={!!renewalPeriod} onValueChange={v => setRenewalPeriod(v ? 'MONTHLY' : '')} trackColor={{ false: '#D1D5DB', true: '#10B981' }} thumbColor="#fff" />
        </View>
        {!!renewalPeriod && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
              {([
                { v: 'DAILY',     l: 'Journalier' },
                { v: 'WEEKLY',    l: 'Hebdomadaire' },
                { v: 'MONTHLY',   l: 'Mensuel' },
                { v: 'QUARTERLY', l: 'Trimestriel' },
                { v: 'ANNUAL',    l: 'Annuel' },
              ] as const).map(({ v, l }) => (
                <TouchableOpacity key={v} style={[styles.periodBtn, renewalPeriod === v && styles.periodBtnActive, renewalPeriod === v && { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]} onPress={() => setRenewalPeriod(v)}>
                  <Text style={[styles.periodBtnText, renewalPeriod === v && { color: '#10B981' }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

                <Button label="Créer l'allocation" onPress={() => mutation.mutate()}
          loading={mutation.isPending} disabled={!canSubmit} style={{marginTop:8}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:Colors.bg },
  topBar:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:20, paddingTop:56, backgroundColor:Colors.surface, borderBottomWidth:1, borderBottomColor:Colors.border },
  back:        { fontSize:15, color:Colors.primary, fontWeight:'600', width:60 },
  title:       { fontSize:17, fontWeight:'700', color:Colors.textPrimary },
  content:     { padding:20, gap:4, paddingBottom:40 },
  label:       { fontSize:13, fontWeight:'600', color:Colors.textSecondary, textTransform:'uppercase', letterSpacing:0.6, marginBottom:10, marginTop:16 },
  optional:    { fontWeight:'400', textTransform:'none' },
  catGrid:     { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:4 },
  catCard:     { width:'30%', backgroundColor:Colors.surface, borderRadius:Radius.md, padding:12, alignItems:'center', borderWidth:1.5, borderColor:Colors.border, ...Shadow.sm },
  catCardActive:{ borderColor:Colors.primary, backgroundColor:Colors.primaryLight },
  catIcon:     { fontSize:24, marginBottom:4 },
  catLabel:    { fontSize:11, fontWeight:'600', color:Colors.textSecondary, textAlign:'center' },
  catLabelActive:{ color:Colors.primary },
  noBeneCard:  { alignItems:'center', padding:20 },
  noBeneText:  { fontSize:14, color:Colors.textSecondary },
  beneChip:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:Colors.surface, borderRadius:Radius.full, paddingHorizontal:14, paddingVertical:10, borderWidth:1.5, borderColor:Colors.border, ...Shadow.sm },
  beneChipActive:{ borderColor:Colors.primary, backgroundColor:Colors.primaryLight },
  beneAvatar:  { width:28, height:28, borderRadius:14, backgroundColor:Colors.primary, justifyContent:'center', alignItems:'center' },
  beneAvatarText:{ color:'#fff', fontSize:12, fontWeight:'700' },
  beneName:    { fontSize:14, fontWeight:'600', color:Colors.textSecondary },
  beneNameActive:{ color:Colors.primary },
  inputWrap:   { flexDirection:'row', alignItems:'center', backgroundColor:Colors.surface, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.border, paddingHorizontal:14, ...Shadow.sm, marginBottom:4 },
  input:       { flex:1, fontSize:16, paddingVertical:13, color:Colors.textPrimary },
  inputSuffix: { fontSize:14, fontWeight:'600', color:Colors.textSecondary },
  switchRow:   { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:Colors.surface, borderRadius:10, padding:14, borderWidth:1, borderColor:Colors.border, marginBottom:8, marginTop:8 },
  switchLabel: { fontSize:14, fontWeight:'600', color:Colors.textPrimary },
  switchSub:   { fontSize:11, color:Colors.textSecondary, marginTop:3 },
  // Merchant selection
  merchantSection: { backgroundColor:Colors.surface, borderRadius:Radius.lg, borderWidth:1.5, borderColor:Colors.primary, padding:14, marginBottom:8 },
  merchantHeader:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  merchantTitle:   { fontSize:13, fontWeight:'700', color:Colors.primary, flex:1 },
  clearBtn:        { fontSize:12, color:Colors.error, fontWeight:'600' },
  loadingText:     { fontSize:13, color:Colors.textSecondary, textAlign:'center', paddingVertical:12 },
  emptyMerchants:  { paddingVertical:16, alignItems:'center' },
  emptyMerchantsText:{ fontSize:13, color:Colors.textMuted },
  merchantList:    { gap:8 },
  merchantItem:    { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:Colors.bg, borderRadius:Radius.md, padding:12, borderWidth:1, borderColor:Colors.border },
  merchantItemSelected:{ borderColor:Colors.primary, backgroundColor:Colors.primaryLight },
  merchantCheck:   { width:22, height:22, borderRadius:11, borderWidth:2, borderColor:Colors.border, justifyContent:'center', alignItems:'center' },
  merchantCheckSelected:{ borderColor:Colors.primary, backgroundColor:Colors.primary },
  checkMark:       { color:'#fff', fontSize:12, fontWeight:'800' },
  merchantName:    { fontSize:14, fontWeight:'600', color:Colors.textPrimary },
  merchantNameSelected:{ color:Colors.primary },
  merchantCity:    { fontSize:12, color:Colors.textSecondary, marginTop:2 },
  selectionBadge:  { marginTop:10, backgroundColor:Colors.primaryLight, borderRadius:Radius.md, padding:10, alignItems:'center', borderWidth:1, borderColor:Colors.primary },
  selectionBadgeText:{ fontSize:13, fontWeight:'700', color:Colors.primary },
  // Cards
  noCardBtn:    { borderWidth:1, borderColor:Colors.primary, borderRadius:10, paddingVertical:12, alignItems:'center', marginBottom:8 },
  noCardText:   { fontSize:13, fontWeight:'600', color:Colors.primary },
  cardsRow:     { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 },
  cardChip:     { flex:1, minWidth:140, backgroundColor:Colors.surface, borderRadius:10, padding:10, borderWidth:1, borderColor:Colors.border },
  cardChipActive:{ borderColor:Colors.primary, borderWidth:2, backgroundColor:'rgba(91,61,245,0.05)' },
  cardChipNum:  { fontSize:12, fontWeight:'700', color:Colors.textPrimary, letterSpacing:1 },
  cardChipSub:  { fontSize:11, color:Colors.textSecondary, marginTop:2 },
  cardChipAdd:  { paddingHorizontal:14, paddingVertical:10, borderRadius:10, backgroundColor:Colors.bg, borderWidth:1, borderColor:Colors.border, justifyContent:'center', alignItems:'center' },
  cardChipAddText:{ fontSize:12, fontWeight:'600', color:Colors.primary },
  divider:            { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },
  thresholdToggleCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  thresholdToggleTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  thresholdBox:      { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginTop: 4, gap: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  thresholdLabel:    { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 },
  thresholdInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  thresholdInput:    { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff', color: '#111827' },
  thresholdUnit:     { fontSize: 14, fontWeight: '700', color: '#5B3DF5', minWidth: 36 },
  segmentRow:        { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segBtn:            { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', backgroundColor: '#fff' },
  segBtnActive:      { backgroundColor: '#EEF2FF', borderColor: '#5B3DF5' },
  segBtnText:        { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  segBtnTextActive:  { color: '#5B3DF5' },
  periodBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  periodBtnActive:   { backgroundColor: '#5B3DF5', borderColor: '#5B3DF5' },
  periodBtnText:     { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  periodBtnTextActive: { color: '#fff' },
});
