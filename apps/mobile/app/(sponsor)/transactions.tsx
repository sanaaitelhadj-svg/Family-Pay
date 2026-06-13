import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Radius } from '@/constants/theme';
import { api } from '@/lib/api';

type Transaction = {
  id:           string;
  amount:       number;
  status:       string;
  createdAt:    string;
  category:     string;
  merchantName: string;
  beneficiary:  string;
};

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍔', PHARMACY: '💊', EDUCATION: '📚',
  CLOTHING: '👕', LEISURE: '🎮', GENERAL: '🏪',
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

  const totalSpent = filtered.reduce((s, t) => s + (t.status === 'COMPLETED' || t.status === 'SUCCESS' ? t.amount : 0), 0);

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>📋 Transactions</Text>
        <View style={s.totalBox}>
          <Text style={s.totalLabel}>Total dépensé</Text>
          <Text style={s.totalAmount}>{totalSpent.toLocaleString('fr-MA')} MAD</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={s.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.chip, filter === f.key && s.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyText}>Aucune transaction</Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = CATEGORY_ICONS[item.category] ?? '💳';
          const date = new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          const isOk = item.status === 'COMPLETED' || item.status === 'SUCCESS';

          return (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={s.iconBox}><Text style={{ fontSize: 22 }}>{icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.merchantName}>{item.merchantName || 'Marchand'}</Text>
                  <Text style={s.benef}>👤 {item.beneficiary || '—'}</Text>
                  <Text style={s.date}>{date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.amount, !isOk && s.amountFailed]}>
                    -{item.amount.toLocaleString('fr-MA')} MAD
                  </Text>
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
  totalLabel:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  totalAmount:  { fontSize: 20, fontWeight: '800', color: '#fff' },
  filters:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  merchantName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  benef:        { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  date:         { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  amount:       { fontSize: 15, fontWeight: '700', color: Colors.error },
  amountFailed: { textDecorationLine: 'line-through', color: Colors.textMuted },
  badge:        { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText:    { fontSize: 11, fontWeight: '700' },
  badgeOk:      { backgroundColor: '#DCFCE7' },
  badgeErr:     { backgroundColor: '#FEE2E2' },
  badgePend:    { backgroundColor: '#FEF3C7' },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { fontSize: 16, color: Colors.textSecondary },
});
