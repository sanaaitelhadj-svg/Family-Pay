import { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';

const CAT_ICONS:  Record<string,string> = { GENERAL:'💰',PHARMACY:'💊',FOOD:'🍕',CLOTHING:'👗',EDUCATION:'📚',LEISURE:'🎮' };
const CAT_LABELS: Record<string,string> = { GENERAL:'Général',PHARMACY:'Pharmacie',FOOD:'Alimentation',CLOTHING:'Habillement',EDUCATION:'Éducation',LEISURE:'Loisirs' };
const CAT_COLORS: Record<string,string> = { GENERAL:'#5B3DF5',PHARMACY:'#EF4444',FOOD:'#F59E0B',CLOTHING:'#EC4899',EDUCATION:'#3B82F6',LEISURE:'#10B981' };

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  ACTIVE:    { label:'Actif',   color:'#166534', bg:'#F0FDF4' },
  PAUSED:    { label:'Suspendu',color:'#B45309', bg:'#FFF8E6' },
  EXPIRED:   { label:'Expiré', color:'#6B7280', bg:'#F3F4F6' },
  EXHAUSTED: { label:'Épuisé', color:'#991B1B', bg:'#FEF2F2' },
};

function confirm(msg: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg));
  return new Promise(resolve =>
    Alert.alert('Confirmation', msg, [
      { text: 'Annuler', onPress: () => resolve(false), style: 'cancel' },
      { text: 'Confirmer', onPress: () => resolve(true), style: 'destructive' },
    ])
  );
}

export default function AllocationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sponsor-allocations'],
    queryFn: () => api.get('/mobile/sponsor/allocations').then(r => r.data.allocations ?? []),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/mobile/sponsor/allocations/${id}/pause`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-allocations'] }),
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Erreur';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erreur', msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mobile/sponsor/allocations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-allocations'] }),
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Erreur';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erreur', msg);
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.patch(`/mobile/sponsor/allocations/${id}/approval`, { requiresApproval: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-allocations'] }),
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Erreur';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erreur', msg);
    },
  });

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm(`Supprimer l'allocation de ${name} ?`);
    if (ok) deleteMutation.mutate(id);
  };

  const all: any[] = data ?? [];

  // Group by category
  const grouped = all.reduce((acc: Record<string, any[]>, a: any) => {
    const cat = a.category ?? 'GENERAL';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Allocations</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/(sponsor)/create-allocation' as any)}>
          <Text style={styles.newBtnText}>+ Nouvelle</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        {categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>Aucune allocation</Text>
            <Text style={styles.emptySub}>Créez une allocation pour un bénéficiaire</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(sponsor)/create-allocation' as any)}>
              <Text style={styles.createBtnText}>+ Créer une allocation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          categories.map(cat => {
            const allocs = grouped[cat];
            const isOpen = expanded === cat;
            const totalBudget = allocs.reduce((s: number, a: any) => s + Number(a.limitAmount), 0);
            const totalRemaining = allocs.reduce((s: number, a: any) => s + Number(a.remainingAmount), 0);
            const totalSpent = totalBudget - totalRemaining;
            const pct = totalBudget > 0 ? Math.min(100, (totalRemaining / totalBudget) * 100) : 0;
            const activeCount = allocs.filter((a: any) => a.status === 'ACTIVE').length;
            const color = CAT_COLORS[cat] ?? Colors.primary;

            return (
              <View key={cat} style={styles.categoryBlock}>
                {/* Category header — clickable */}
                <TouchableOpacity
                  style={[styles.catHeader, { borderLeftColor: color, borderLeftWidth: 4 }]}
                  onPress={() => setExpanded(isOpen ? null : cat)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.catIconBox, { backgroundColor: color + '18' }]}>
                    <Text style={styles.catIconText}>{CAT_ICONS[cat] ?? '💰'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.catTitleRow}>
                      <Text style={styles.catName}>{CAT_LABELS[cat] ?? cat}</Text>
                      <View style={styles.catBadge}>
                        <Text style={[styles.catBadgeText, { color }]}>{allocs.length} allocation{allocs.length > 1 ? 's' : ''}</Text>
                      </View>
                    </View>
                    <View style={styles.catStats}>
                      <Text style={styles.catStatText}>
                        <Text style={{ color, fontWeight: '700' }}>{totalRemaining.toLocaleString('fr-MA')} MAD</Text>
                        <Text style={styles.catStatMuted}> restants / {totalBudget.toLocaleString('fr-MA')} MAD</Text>
                      </Text>
                    </View>
                    <View style={styles.catBar}>
                      <View style={[styles.catBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.catSubStat}>
                      {activeCount} actif{activeCount > 1 ? 's' : ''} · {totalSpent.toLocaleString('fr-MA')} MAD consommés
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color }]}>{isOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {/* Beneficiaries list */}
                {isOpen && (
                  <View style={styles.benefList}>
                    {allocs.map((a: any) => {
                      const st = STATUS_CFG[a.status] ?? STATUS_CFG.EXPIRED;
                      const spent = Number(a.limitAmount) - Number(a.remainingAmount);
                      const pctA = Number(a.limitAmount) > 0
                        ? Math.min(100, (Number(a.remainingAmount) / Number(a.limitAmount)) * 100)
                        : 0;
                      const firstName = a.beneficiary?.user?.firstName ?? '—';
                      const lastName = a.beneficiary?.user?.lastName ?? '';
                      const fullName = `${firstName} ${lastName}`.trim();
                      const isMinor = a.beneficiary?.isMinor;

                      return (
                        <View key={a.id} style={styles.benefItem}>
                          {/* Beneficiary info */}
                          <View style={styles.benefRow}>
                            <View style={[styles.benefAvatar, { backgroundColor: color + '22' }]}>
                              <Text style={[styles.benefAvatarText, { color }]}>{firstName[0] ?? '?'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.benefNameRow}>
                                <Text style={styles.benefName}>{fullName}</Text>
                                {isMinor && (
                                  <View style={styles.minorBadge}>
                                    <Text style={styles.minorBadgeText}>Mineur</Text>
                                  </View>
                                )}
                                <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                  <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                                </View>
                              </View>
                              <View style={styles.amountRow}>
                                <Text style={styles.remaining}>{Number(a.remainingAmount).toLocaleString('fr-MA')} MAD</Text>
                                <Text style={styles.amountSep}> / </Text>
                                <Text style={styles.limit}>{Number(a.limitAmount).toLocaleString('fr-MA')} MAD</Text>
                                <Text style={styles.spent}> · {spent.toLocaleString('fr-MA')} consommés</Text>
                              </View>
                              <View style={styles.miniBar}>
                                <View style={[styles.miniBarFill, { width: `${pctA}%` as any, backgroundColor: color }]} />
                              </View>
                            </View>
                          </View>

                          {/* Actions */}
                          <View style={styles.actionsRow}>
                            {/* Suspend / Resume */}
                            <TouchableOpacity
                              style={[styles.actionBtn, a.status === 'PAUSED' ? styles.actionBtnGreen : styles.actionBtnOrange]}
                              onPress={() => pauseMutation.mutate(a.id)}
                              disabled={pauseMutation.isPending}
                            >
                              <Text style={[styles.actionBtnText, { color: a.status === 'PAUSED' ? '#166534' : '#B45309' }]}>
                                {a.status === 'PAUSED' ? '▶ Reprendre' : '⏸ Suspendre'}
                              </Text>
                            </TouchableOpacity>

                            {/* Lock / Unlock (requiresApproval) */}
                            <TouchableOpacity
                              style={[styles.actionBtn, isMinor ? styles.actionBtnPurpleActive : (a.requiresApproval ? styles.actionBtnPurpleActive : styles.actionBtnPurple), isMinor && { opacity: 0.65 }]}
                              onPress={() => !isMinor && approvalMutation.mutate({ id: a.id, value: !a.requiresApproval })}
                              disabled={approvalMutation.isPending || isMinor}
                            >
                              <Text style={[styles.actionBtnText, { color: '#5B3DF5' }]}>
                                {isMinor ? '🔒 Auto' : (a.requiresApproval ? '🔒 Verrouillé' : '🔓 Libre')}
                              </Text>
                            </TouchableOpacity>

                            {/* Delete */}
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.actionBtnRed]}
                              onPress={() => handleDelete(a.id, fullName)}
                              disabled={deleteMutation.isPending}
                            >
                              <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>🗑 Suppr.</Text>
                            </TouchableOpacity>
                          </View>

                          {(a.requiresApproval || isMinor) && (
                            <View style={[styles.lockHint, isMinor && { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
                              <Text style={[styles.lockHintText, isMinor && { color: '#BE123C' }]}>
                                {isMinor ? '👶 Mineur — approbation obligatoire et non modifiable' : '🔐 Chaque paiement nécessite votre approbation'}
                              </Text>
                            </View>
                          )}
                          {a.thresholdValue && (
                            <View style={styles.thresholdBadge}>
                              <Text style={styles.thresholdBadgeText}>
                                📊 Seuil {a.thresholdPeriod === 'DAILY' ? 'journalier' : a.thresholdPeriod === 'MONTHLY' ? 'mensuel' : a.thresholdPeriod === 'SEMIANNUAL' ? 'semestriel' : a.thresholdPeriod === 'ANNUAL' ? 'annuel' : 'global'} : {a.thresholdType === 'PERCENT' ? `${a.thresholdValue}%` : `${a.thresholdValue} MAD`}{a.thresholdAutoSuspend ? ' · suspension auto' : ' · alerte'}
                              </Text>
                            </View>
                          )}
                          {a.expiresAt && (
                            <Text style={styles.expiry}>⏳ Expire le {new Date(a.expiresAt).toLocaleDateString('fr-FR')}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:      { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  newBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 14 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySub:   { fontSize: 13, color: Colors.textSecondary },
  createBtn:  { marginTop: 12, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 24 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Category block
  categoryBlock: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  catHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  catIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  catIconText: { fontSize: 22 },
  catTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  catName:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  catBadge:   { backgroundColor: Colors.bg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  catStats:   { marginBottom: 6 },
  catStatText: { fontSize: 13 },
  catStatMuted: { color: Colors.textSecondary, fontWeight: '400' },
  catBar:     { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  catBarFill: { height: '100%', borderRadius: 2 },
  catSubStat: { fontSize: 11, color: Colors.textMuted },
  chevron:    { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  // Beneficiaries
  benefList:  { borderTopWidth: 1, borderTopColor: Colors.border },
  benefItem:  { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  benefRow:   { flexDirection: 'row', gap: 12, marginBottom: 10 },
  benefAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  benefAvatarText: { fontSize: 16, fontWeight: '700' },
  benefNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' },
  benefName:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  minorBadge: { backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 },
  minorBadgeText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  amountRow:  { flexDirection: 'row', alignItems: 'baseline', marginBottom: 5 },
  remaining:  { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  amountSep:  { fontSize: 12, color: Colors.textMuted },
  limit:      { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  spent:      { fontSize: 11, color: Colors.textMuted },
  miniBar:    { height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },
  // Actions
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn:  { flex: 1, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1 },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
  actionBtnOrange: { backgroundColor: '#FFF8E6', borderColor: '#FDE68A' },
  actionBtnGreen:  { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  actionBtnPurple: { backgroundColor: Colors.bg, borderColor: Colors.border },
  actionBtnPurpleActive: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  actionBtnRed:    { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  lockHint:   { marginTop: 8, backgroundColor: '#F5F3FF', borderRadius: Radius.sm, padding: 7, borderWidth: 1, borderColor: '#DDD6FE' },
  lockHintText: { fontSize: 11, color: '#5B3DF5' },
  expiry:        { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  thresholdBadge: { marginTop: 6, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#BFDBFE' },
  thresholdBadgeText: { fontSize: 11, color: '#1D4ED8', fontWeight: '600' },
});
