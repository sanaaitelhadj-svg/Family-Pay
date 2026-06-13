import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Radius } from '@/constants/theme';
import { api } from '@/lib/api';

type Transaction = {
  id:              string;
  amount:          number;
  status:          string;
  createdAt:       string;
  category:        string;
  allocationLimit: number;
  merchantName:    string;
  beneficiary:     string;
  isMinor:         boolean;
  card:            { brand: string; maskedNumber: string; cardHolder: string } | null;
};

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍔', PHARMACY: '💊', EDUCATION: '📚', CLOTHING: '👕', LEISURE: '🎮', GENERAL: '🏪',
};
const CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Alimentation', PHARMACY: 'Pharmacie', EDUCATION: 'Éducation',
  CLOTHING: 'Habillement', LEISURE: 'Loisirs', GENERAL: 'Général',
};

const FILTERS = [
  { key: 'ALL',       label: 'Tout' },
  { key: 'COMPLETED', label: '✓ Réussi' },
  { key: 'FAILED',    label: '✗ Échoué' },
] as const;

export default function SponsorTransactionsScreen() {
  const [filter, setFilter] = useState<string>('ALL');

  const { data, isLoading, refetch, isRefetching } = useQuery<Transaction[]>({
    queryKey: ['sponsor-transactions'],
    queryFn:  async () => (await api.get('/mobile/sponsor/transactions')).data,
  });

  const filtered = (data ?? []).filter(t =>
    filter === 'ALL' || t.status === filter || (filter === 'COMPLETED' && t.status === 'SUCCESS')
  );

  const totalSpent = filtered
    .filter(t => t.status === 'COMPLETED' || t.status === 'SUCCESS')
    .reduce((s, t) => s + t.amount, 0);

  if (isLoading) return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>📋 Transactions</Text>
        <View style={s.totalBox}>
          <Text style={s.totalLabel}>Total dépensé</Text>
          <Text style={s.totalAmount}>{totalSpent.toLocaleString('fr-MA')} MAD</Text>
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
        data={filtered}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyIcon}>📭</Text><Text style={s.emptyText}>Aucune transaction</Text></View>}
        renderItem={({ item }) => {
          const isOk = item.status === 'COMPLETED' || item.status === 'SUCCESS';
          const icon = CATEGORY_ICONS[item.category] ?? '💳';
          const date = new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

          return (
            <View style={s.card}>
              {/* Header carte */}
              <View style={s.cardRow}>
                <View style={s.iconBox}><Text style={{ fontSize: 22 }}>{icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <View style={s.titleRow}>
                    <Text style={s.merchantName}>{item.merchantName || 'Marchand'}</Text>
                    <Text style={[s.amount, !isOk && s.amountFailed]}>-{item.amount.toLocaleString('fr-MA')} MAD</Text>
                  </View>
                  <Text style={s.catLabel}>{CATEGORY_LABELS[item.category] ?? item.category}</Text>
                </View>
              </View>

              {/* Détails */}
              <View style={s.details}>
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>👤 Bénéficiaire</Text>
                  <Text style={s.detailVal}>{item.beneficiary || '—'} {item.isMinor ? '👶' : ''}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>📂 Allocation</Text>
                  <Text style={s.detailVal}>{CATEGORY_LABELS[item.category] ?? item.category} · {item.allocationLimit.toLocaleString('fr-MA')} MAD</Text>
                </View>
                {item.card && (
                  <View style={s.detailRow}>
                    <Text style={s.detailKey}>💳 Carte</Text>
                    <Text style={s.detailVal}>{item.card.brand} •••• {item.card.maskedNumber.slice(-4)} · {item.card.cardHolder}</Text>
                  </View>
                )}
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>🕐 Date</Text>
                  <Text style={s.detailVal}>{date}</Text>
                </View>
                <View style={[s.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={s.detailKey}>Statut</Text>
                  <View style={[s.badge, isOk ? s.badgeOk : item.status === 'FAILED' ? s.badgeErr : s.badgePend]}>
                    <Text style={[s.badgeText, isOk ? { color: '#166534' } : item.status === 'FAILED' ? { color: '#991B1B' } : { color: '#92400E' }]}>
                      {isOk ? '✓ Réussi' : item.status === 'FAILED' ? '✗ Échoué' : '⏳ En attente'}
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
  container:    { flex: 1, backgroundColor: Colors.bg },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  title:        { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  totalBox:     { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:   { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  totalAmount:  { fontSize: 20, fontWeight: '800', color: '#fff' },
  filters:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  titleRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBox:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  merchantName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  catLabel:     { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  amount:       { fontSize: 16, fontWeight: '800', color: Colors.error },
  amountFailed: { textDecorationLine: 'line-through', color: Colors.textMuted },
  details:      { borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 14 },
  detailRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailKey:    { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  detailVal:    { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, flex: 2, textAlign: 'right' },
  badge:        { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 11, fontWeight: '700' },
  badgeOk:      { backgroundColor: '#DCFCE7' },
  badgeErr:     { backgroundColor: '#FEE2E2' },
  badgePend:    { backgroundColor: '#FEF3C7' },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 16, color: Colors.textSecondary },
});
