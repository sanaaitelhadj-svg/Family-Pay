import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Radius } from '@/constants/theme';
import { api } from '@/lib/api';

type Transaction = {
  id: string; amount: number; status: string; createdAt: string;
  category: string; allocationLimit: number; merchantName: string;
  beneficiary: string; isMinor: boolean;
  card: { brand: string; maskedNumber: string; cardHolder: string } | null;
};

type PendingAuth = {
  id: string; amount: number; createdAt: string;
  category: string; merchantName: string; beneficiary: string;
};

type Item =
  | { kind: 'tx';      data: Transaction }
  | { kind: 'pending'; data: PendingAuth };

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍔', PHARMACY: '💊', EDUCATION: '📚', CLOTHING: '👕', LEISURE: '🎮', GENERAL: '🏪',
};
const CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Alimentation', PHARMACY: 'Pharmacie', EDUCATION: 'Éducation',
  CLOTHING: 'Habillement', LEISURE: 'Loisirs', GENERAL: 'Général',
};

const FILTERS = [
  { key: 'ALL',     label: 'Tout' },
  { key: 'PENDING', label: '⏳ En attente' },
  { key: 'COMPLETED', label: '✓ Réussi' },
  { key: 'FAILED',  label: '✗ Échoué' },
] as const;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function SponsorTransactionsScreen() {
  const [filter, setFilter] = useState<string>('ALL');
  const qc = useQueryClient();

  const { data: txs = [], isLoading: txLoading, refetch: refetchTx, isRefetching: rTx } =
    useQuery<Transaction[]>({
      queryKey: ['sponsor-transactions'],
      queryFn: async () => (await api.get('/mobile/sponsor/transactions')).data,
    });

  const { data: pending = [], isLoading: pendLoading, refetch: refetchPend, isRefetching: rPend } =
    useQuery<PendingAuth[]>({
      queryKey: ['sponsor-pending-auth'],
      queryFn: async () => (await api.get('/mobile/sponsor/pending-authorizations')).data,
    });

  const approveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      (await api.patch(`/mobile/sponsor/authorizations/${id}`, { action })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-transactions'] });
      qc.invalidateQueries({ queryKey: ['sponsor-pending-auth'] });
    },
  });

  const handleApprove = (auth: PendingAuth) => {
    Alert.alert(
      'Approuver le paiement ?',
      `${auth.beneficiary} → ${auth.merchantName}\n${auth.amount.toLocaleString('fr-MA')} MAD`,
      [
        { text: 'Refuser', style: 'destructive', onPress: () => approveMutation.mutate({ id: auth.id, action: 'reject' }) },
        { text: 'Approuver', onPress: () => approveMutation.mutate({ id: auth.id, action: 'approve' }) },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  // Fusionner les deux listes par date décroissante
  const allItems: Item[] = [];
  if (filter === 'ALL' || filter === 'PENDING') {
    pending.forEach(p => allItems.push({ kind: 'pending', data: p }));
  }
  if (filter === 'ALL' || filter === 'COMPLETED' || filter === 'FAILED') {
    txs
      .filter(t => filter === 'ALL' || t.status === filter)
      .forEach(t => allItems.push({ kind: 'tx', data: t }));
  }
  allItems.sort((a, b) => {
    const da = a.kind === 'tx' ? a.data.createdAt : a.data.createdAt;
    const db = b.kind === 'tx' ? b.data.createdAt : b.data.createdAt;
    return new Date(db).getTime() - new Date(da).getTime();
  });

  const totalSpent = txs.filter(t => t.status === 'COMPLETED').reduce((s, t) => s + t.amount, 0);
  const isLoading = txLoading || pendLoading;
  const isRefreshing = rTx || rPend;
  const onRefresh = () => { refetchTx(); refetchPend(); };

  if (isLoading) return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>📋 Transactions</Text>
        <View style={s.row}>
          <View style={[s.statBox, { backgroundColor: Colors.primary }]}>
            <Text style={s.statLabel}>Total dépensé</Text>
            <Text style={s.statVal}>{totalSpent.toLocaleString('fr-MA')} MAD</Text>
          </View>
          {pending.length > 0 && (
            <View style={[s.statBox, { backgroundColor: '#D97706' }]}>
              <Text style={s.statLabel}>En attente</Text>
              <Text style={s.statVal}>{pending.length} paiement{pending.length > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} style={[s.chip, filter === f.key && s.chipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={allItems}
        keyExtractor={item => item.kind === 'pending' ? `p-${item.data.id}` : `t-${item.data.id}`}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyIcon}>📭</Text><Text style={s.emptyText}>Aucune transaction</Text></View>}
        renderItem={({ item }) => {
          if (item.kind === 'pending') {
            const p = item.data;
            return (
              <View style={[s.card, s.cardPending]}>
                <View style={s.cardRow}>
                  <View style={[s.iconBox, { backgroundColor: '#FEF3C7', borderColor: '#D97706' }]}>
                    <Text style={{ fontSize: 22 }}>{CATEGORY_ICONS[p.category] ?? '💳'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.titleRow}>
                      <Text style={s.merchantName}>{p.merchantName || 'Marchand'}</Text>
                      <Text style={[s.amount, { color: '#D97706' }]}>{p.amount.toLocaleString('fr-MA')} MAD</Text>
                    </View>
                    <Text style={s.catLabel}>{CATEGORY_LABELS[p.category] ?? p.category}</Text>
                  </View>
                </View>
                <View style={s.details}>
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>👤 Bénéficiaire</Text>
                    <Text style={s.detailVal}>{p.beneficiary || '—'}</Text>
                  </View>
                  <View style={[s.detailRow, { borderBottomWidth: 0 }]}>
                    <Text style={s.detailKey}>🕐 Date</Text>
                    <Text style={s.detailVal}>{fmtDate(p.createdAt)}</Text>
                  </View>
                </View>
                <View style={s.approvalRow}>
                  <TouchableOpacity
                    style={[s.btn, s.btnReject]}
                    onPress={() => approveMutation.mutate({ id: p.id, action: 'reject' })}
                    disabled={approveMutation.isPending}
                  >
                    <Text style={s.btnRejectText}>✗ Refuser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, s.btnApprove]}
                    onPress={() => approveMutation.mutate({ id: p.id, action: 'approve' })}
                    disabled={approveMutation.isPending}
                  >
                    <Text style={s.btnApproveText}>✓ Approuver</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          const t = item.data;
          const isOk  = t.status === 'COMPLETED';
          const icon  = CATEGORY_ICONS[t.category] ?? '💳';
          return (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={s.iconBox}><Text style={{ fontSize: 22 }}>{icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <View style={s.titleRow}>
                    <Text style={s.merchantName}>{t.merchantName || 'Marchand'}</Text>
                    <Text style={[s.amount, !isOk && s.amountFailed]}>-{t.amount.toLocaleString('fr-MA')} MAD</Text>
                  </View>
                  <Text style={s.catLabel}>{CATEGORY_LABELS[t.category] ?? t.category}</Text>
                </View>
              </View>
              <View style={s.details}>
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>👤 Bénéficiaire</Text>
                  <Text style={s.detailVal}>{t.beneficiary || '—'} {t.isMinor ? '👶' : ''}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>📂 Allocation</Text>
                  <Text style={s.detailVal}>{CATEGORY_LABELS[t.category] ?? t.category} · {t.allocationLimit.toLocaleString('fr-MA')} MAD</Text>
                </View>
                {t.card && (
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>💳 Carte</Text>
                    <Text style={s.detailVal}>{t.card.brand} •••• {t.card.maskedNumber.slice(-4)} · {t.card.cardHolder}</Text>
                  </View>
                )}
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>🕐 Date</Text>
                  <Text style={s.detailVal}>{fmtDate(t.createdAt)}</Text>
                </View>
                <View style={[s.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={s.detailKey}>Statut</Text>
                  <View style={[s.badge, isOk ? s.badgeOk : s.badgeErr]}>
                    <Text style={[s.badgeText, isOk ? { color: '#166534' } : { color: '#991B1B' }]}>
                      {isOk ? '✓ Réussi' : '✗ Échoué'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:    { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  title:     { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  row:       { flexDirection: 'row', gap: 10 },
  statBox:   { flex: 1, borderRadius: Radius.lg, padding: 12 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  statVal:   { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 2 },
  filters:   { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 8, flexWrap: 'wrap' },
  chip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:  { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  card:      { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardPending: { borderColor: '#D97706', borderWidth: 1.5 },
  cardRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  titleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBox:   { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  merchantName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  catLabel:  { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  amount:    { fontSize: 16, fontWeight: '800', color: Colors.error },
  amountFailed: { textDecorationLine: 'line-through', color: Colors.textMuted },
  details:   { borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailKey: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  detailVal: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, flex: 2, textAlign: 'right' },
  badge:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeOk:   { backgroundColor: '#DCFCE7' },
  badgeErr:  { backgroundColor: '#FEE2E2' },
  approvalRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#D97706' },
  btn:       { flex: 1, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  btnApprove: { backgroundColor: '#16A34A' },
  btnReject:  { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#DC2626' },
  btnApproveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnRejectText:  { color: '#DC2626', fontWeight: '700', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
});
