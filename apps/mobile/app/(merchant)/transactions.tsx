import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { apiClient } from '../../src/lib/api';

type Transaction = {
  id:          string;
  amount:      number;
  category:    string;
  status:      string;
  createdAt:   string;
  beneficiary: string;
  sponsorName: string;
  card:        { brand: string; maskedNumber: string; cardHolder: string } | null;
};

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍔', PHARMACY: '💊', EDUCATION: '📚', CLOTHING: '👕', LEISURE: '🎮', GENERAL: '🏪',
};

const FILTERS = [
  { key: 'ALL',       label: 'Tout' },
  { key: 'COMPLETED', label: '✓ Encaissé' },
  { key: 'FAILED',    label: '✗ Échoué' },
] as const;

export default function MerchantTransactionsScreen() {
  const [filter, setFilter] = useState<string>('ALL');

  const { data, isLoading, refetch, isRefetching } = useQuery<Transaction[]>({
    queryKey: ['merchant-transactions'],
    queryFn:  async () => (await apiClient.get('/mobile/merchant/transactions')).data,
  });

  const filtered = (data ?? []).filter(t =>
    filter === 'ALL' || t.status === filter || (filter === 'COMPLETED' && t.status === 'SUCCESS')
  );

  const totalEncaisse = filtered
    .filter(t => t.status === 'COMPLETED' || t.status === 'SUCCESS')
    .reduce((s, t) => s + t.amount, 0);

  if (isLoading) return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>📋 Transactions</Text>
        <View style={s.totalBox}>
          <Text style={s.totalLabel}>Total encaissé</Text>
          <Text style={s.totalAmount}>{totalEncaisse.toLocaleString('fr-MA')} MAD</Text>
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
          const isOk  = item.status === 'COMPLETED' || item.status === 'SUCCESS';
          const icon  = CATEGORY_ICONS[item.category] ?? '💳';
          const date  = new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          return (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={s.iconBox}><Text style={{ fontSize: 22 }}>{icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>👤 {item.beneficiary || '—'}</Text>
                  <Text style={s.sub}>🏠 {item.sponsorName || '—'}</Text>
                  {item.card && (
                    <Text style={s.sub}>
                      {item.card.brand === 'VISA' ? '💳' : '💳'} {item.card.brand} •••• {item.card.maskedNumber.slice(-4)}
                    </Text>
                  )}
                  <Text style={s.date}>🕐 {date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.amount, !isOk && s.amountFailed]}>+{item.amount.toLocaleString('fr-MA')} MAD</Text>
                  <View style={[s.badge, isOk ? s.badgeOk : s.badgeErr]}>
                    <Text style={[s.badgeText, isOk ? { color: '#166534' } : { color: '#991B1B' }]}>
                      {isOk ? '✓ Encaissé' : '✗ Échoué'}
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
  header:    { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14 },
  title:     { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14, letterSpacing: -0.5 },
  totalBox:  { backgroundColor: '#16A34A', borderRadius: Radius.lg, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#16A34A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  totalLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#fff' },
  filters:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  chip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:  { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  card:      { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox:   { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  name:      { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  sub:       { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  date:      { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  amount:    { fontSize: 16, fontWeight: '800', color: '#16A34A' },
  amountFailed: { textDecorationLine: 'line-through', color: Colors.textMuted },
  badge:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeOk:   { backgroundColor: '#DCFCE7' },
  badgeErr:  { backgroundColor: '#FEE2E2' },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
});
