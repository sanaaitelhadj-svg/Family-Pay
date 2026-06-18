import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components/Button';

export default function EditAllocationScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: alloc, isLoading } = useQuery({
    queryKey: ['allocation', id],
    queryFn: () => api.get('/mobile/sponsor/allocations').then(r =>
      (r.data.allocations ?? []).find((a: any) => a.id === id)
    ),
  });

  const [amount,               setAmount]               = useState('');
  const [expiresAt,            setExpiresAt]            = useState('');
  const [requiresApproval,     setRequiresApproval]     = useState(false);
  const [thresholdEnabled,     setThresholdEnabled]     = useState(false);
  const [thresholdType,        setThresholdType]        = useState<'AMOUNT'|'PERCENT'>('PERCENT');
  const [thresholdValue,       setThresholdValue]       = useState('');
  const [thresholdPeriod,      setThresholdPeriod]      = useState<'DAILY'|'MONTHLY'|'SEMIANNUAL'|'ANNUAL'|'TOTAL'>('MONTHLY');
  const [thresholdAutoSuspend, setThresholdAutoSuspend] = useState(false);
  const [renewalPeriod,      setRenewalPeriod]      = useState<string>('');

  useEffect(() => {
    if (!alloc) return;
    setAmount(String(alloc.limitAmount ?? ''));
    setExpiresAt(alloc.expiresAt ? new Date(alloc.expiresAt).toISOString().split('T')[0] : '');
    setRequiresApproval(alloc.requiresApproval ?? false);
    setThresholdEnabled(!!alloc.thresholdValue);
    setThresholdType(alloc.thresholdType ?? 'PERCENT');
    setThresholdValue(alloc.thresholdValue ? String(alloc.thresholdValue) : '');
    setThresholdPeriod(alloc.thresholdPeriod ?? 'MONTHLY');
    setThresholdAutoSuspend(alloc.thresholdAutoSuspend ?? false);
    setRenewalPeriod(alloc.renewalPeriod ?? '');
  }, [alloc]);

  const isMinor = alloc?.beneficiary?.isMinor ?? false;

  const mutation = useMutation({
    mutationFn: () => api.patch(`/mobile/sponsor/allocations/${id}`, {
      limitAmount:         Number(amount),
      expiresAt:           expiresAt || null,
      requiresApproval,
      renewalPeriod: renewalPeriod || null,
      ...(thresholdEnabled && thresholdValue ? {
        thresholdValue:       Number(thresholdValue),
        thresholdType,
        thresholdPeriod,
        thresholdAutoSuspend,
      } : {
        thresholdValue:  null,
        thresholdType:   null,
        thresholdPeriod: null,
        thresholdAutoSuspend: false,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-allocations'] });
      qc.invalidateQueries({ queryKey: ['sponsor-beneficiaries'] });
      router.back();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Erreur';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erreur', msg);
    },
  });

  const canSave = amount && Number(amount) > 0 && !mutation.isPending &&
    !(thresholdEnabled && (!thresholdValue || Number(thresholdValue) <= 0));

  if (isLoading || !alloc) {
    return <View style={styles.center}><Text>Chargement…</Text></View>;
  }

  const benefName = `${alloc.beneficiary?.user?.firstName ?? ''} ${alloc.beneficiary?.user?.lastName ?? ''}`.trim();

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Retour</Text></TouchableOpacity>
        <Text style={styles.title}>Modifier l'allocation</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        {/* Info bénéficiaire */}
        <View style={styles.benefCard}>
          <Text style={styles.benefLabel}>Bénéficiaire</Text>
          <Text style={styles.benefName}>{benefName}</Text>
          {isMinor && <View style={styles.minorBadge}><Text style={styles.minorBadgeText}>👶 Mineur</Text></View>}
          <View style={[styles.catBadge]}>
            <Text style={styles.catBadgeText}>{alloc.category}</Text>
          </View>
        </View>

        {/* Montant */}
        <Text style={styles.label}>MONTANT LIMITE (MAD) *</Text>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount}
            keyboardType="numeric" placeholder="ex: 1000" placeholderTextColor="#9CA3AF" />
          <Text style={styles.inputSuffix}>MAD</Text>
        </View>
        <Text style={styles.hint}>Restant actuel : {alloc.remainingAmount} MAD</Text>

        {/* Date expiration */}
        <Text style={styles.label}>DATE D'EXPIRATION (optionnel)</Text>
        <TextInput style={styles.input} value={expiresAt} onChangeText={setExpiresAt}
          placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />

        {/* Approbation */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>🔐 Approbation par transaction{isMinor ? '  ⚠️ Mineur' : ''}</Text>
            <Text style={styles.switchSub}>{requiresApproval ? 'Chaque paiement devra être approuvé' : 'Paiements automatiquement autorisés'}</Text>
          </View>
          <Switch value={requiresApproval || isMinor} onValueChange={setRequiresApproval}
            trackColor={{ false: '#d1d5db', true: Colors.primary }} thumbColor="#fff"
            disabled={isMinor} />
        </View>

        {/* Seuil */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>📊 Seuil d'alerte</Text>
            <Text style={styles.switchSub}>{thresholdEnabled ? 'Alerte et/ou suspension automatique' : 'Aucun seuil'}</Text>
          </View>
          <Switch value={thresholdEnabled} onValueChange={v => { setThresholdEnabled(v); if (!v) setThresholdValue(''); }}
            trackColor={{ false: '#D1D5DB', true: '#5B3DF5' }} thumbColor="#fff" />
        </View>

        {thresholdEnabled && (
          <View style={styles.thresholdBox}>
            <Text style={styles.thresholdLabel}>Type</Text>
            <View style={styles.segmentRow}>
              {(['PERCENT', 'AMOUNT'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.segBtn, thresholdType === t && styles.segBtnActive]} onPress={() => setThresholdType(t)}>
                  <Text style={[styles.segBtnText, thresholdType === t && styles.segBtnTextActive]}>{t === 'PERCENT' ? '% Pourcentage' : 'MAD Montant'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.thresholdLabel}>Valeur</Text>
            <View style={styles.thresholdInputRow}>
              <TextInput style={styles.thresholdInput} value={thresholdValue} onChangeText={setThresholdValue}
                keyboardType="numeric" placeholder={thresholdType === 'PERCENT' ? 'ex: 80' : 'ex: 500'} placeholderTextColor="#9CA3AF" />
              <Text style={styles.thresholdUnit}>{thresholdType === 'PERCENT' ? '%' : 'MAD'}</Text>
            </View>
            <Text style={styles.thresholdLabel}>Période</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([{v:'DAILY',l:'Journalier'},{v:'MONTHLY',l:'Mensuel'},{v:'SEMIANNUAL',l:'Semestriel'},{v:'ANNUAL',l:'Annuel'},{v:'TOTAL',l:'Global'}] as const).map(({v,l}) => (
                  <TouchableOpacity key={v} style={[styles.periodBtn, thresholdPeriod === v && styles.periodBtnActive]} onPress={() => setThresholdPeriod(v)}>
                    <Text style={[styles.periodBtnText, thresholdPeriod === v && styles.periodBtnTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={[styles.switchRow, { marginBottom: 0, marginTop: 4 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>🔴 Suspension automatique</Text>
                <Text style={styles.switchSub}>{thresholdAutoSuspend ? "Suspension dès le seuil atteint" : 'Alerte uniquement'}</Text>
              </View>
              <Switch value={thresholdAutoSuspend} onValueChange={setThresholdAutoSuspend}
                trackColor={{ false: '#D1D5DB', true: '#EF4444' }} thumbColor="#fff" />
            </View>
          </View>
        )}

        {/* Renouvellement */}
        <View style={[styles.switchRow, { marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>🔄 Renouvellement automatique</Text>
            <Text style={styles.switchSub}>{renewalPeriod ? `Période : ${renewalPeriod === 'DAILY' ? 'Journalier' : renewalPeriod === 'WEEKLY' ? 'Hebdomadaire' : renewalPeriod === 'MONTHLY' ? 'Mensuel' : renewalPeriod === 'QUARTERLY' ? 'Trimestriel' : 'Annuel'}` : 'Aucun renouvellement'}</Text>
          </View>
          <Switch value={!!renewalPeriod} onValueChange={v => setRenewalPeriod(v ? 'MONTHLY' : '')} trackColor={{ false: '#D1D5DB', true: '#10B981' }} thumbColor="#fff" />
        </View>
        {!!renewalPeriod && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([{v:'DAILY',l:'Journalier'},{v:'WEEKLY',l:'Hebdomadaire'},{v:'MONTHLY',l:'Mensuel'},{v:'QUARTERLY',l:'Trimestriel'},{v:'ANNUAL',l:'Annuel'}] as const).map(({v,l}) => (
                <TouchableOpacity key={v} style={[styles.periodBtn, renewalPeriod === v && styles.periodBtnActive, renewalPeriod === v && { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]} onPress={() => setRenewalPeriod(v)}>
                  <Text style={[styles.periodBtnText, renewalPeriod === v && { color: '#10B981' }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

                <Button label="Enregistrer les modifications" onPress={() => mutation.mutate()}
          loading={mutation.isPending} disabled={!canSave} style={{ marginTop: 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back:       { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  title:      { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  form:       { padding: 16, gap: 4, paddingBottom: 40 },
  benefCard:  { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  benefLabel: { fontSize: 11, color: Colors.textMuted, width: '100%' },
  benefName:  { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  minorBadge: { backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  minorBadgeText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  catBadge:   { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontWeight: '700', color: '#5B3DF5' },
  label:      { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginTop: 12, marginBottom: 6, letterSpacing: 0.5 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input:      { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: Colors.surface, color: Colors.textPrimary },
  inputSuffix: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  hint:       { fontSize: 11, color: Colors.textMuted, marginTop: 4, marginBottom: 4 },
  switchRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  switchSub:  { fontSize: 12, color: Colors.textSecondary },
  thresholdBox: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginTop: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  thresholdLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 },
  thresholdInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  thresholdInput: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff', color: '#111827' },
  thresholdUnit: { fontSize: 14, fontWeight: '700', color: '#5B3DF5', minWidth: 36 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segBtn:     { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', backgroundColor: '#fff' },
  segBtnActive: { backgroundColor: '#EEF2FF', borderColor: '#5B3DF5' },
  segBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  segBtnTextActive: { color: '#5B3DF5' },
  periodBtn:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  periodBtnActive: { backgroundColor: '#5B3DF5', borderColor: '#5B3DF5' },
  periodBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  periodBtnTextActive: { color: '#fff' },
});
