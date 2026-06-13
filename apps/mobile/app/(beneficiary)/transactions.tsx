import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { apiClient } from '../../src/lib/api';

type Transaction = {
  id: string;
  amount: number;
  category: string;
  merchant: { user: { firstName: string; lastName: string }; businessName?: string };
  createdAt: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'COMPLETED';
};

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍔', TRANSPORT: '🚌', HEALTH: '💊',
  EDUCATION: '📚', CLOTHING: '👕', OTHER: '📦',
};

export default function TransactionsScreen() {
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');

  const { data, isLoading, refetch, isRefetching } = useQuery<Transaction[]>({
    queryKey: ['beneficiary-transactions'],
    queryFn: async () => {
      const res = await apiClient.get('/mobile/beneficiary/transactions');
      return res.data;
    },
  });

  const filtered = (data ?? []).filter(t => filter === 'ALL' || (filter === 'SUCCESS' && (t.status === 'SUCCESS' || t.status === 'COMPLETED')) || t.status === filter);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['ALL', 'SUCCESS', 'FAILED'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'ALL' ? 'Tout' : f === 'SUCCESS' ? '✓ Réussi' : '✗ Échoué'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Aucune transaction</Text>
          </View>
        }
        renderItem={({ item }) => {
          const merchantName = item.merchant.businessName
            ?? `${item.merchant.user.firstName} ${item.merchant.user.lastName}`;
          const date = new Date(item.createdAt).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconBox}>
                  <Text style={{ fontSize: 22 }}>{CATEGORY_ICONS[item.category] ?? '📦'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.merchantName}>{merchantName}</Text>
                  <Text style={styles.date}>{date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amount, item.status === 'FAILED' && styles.amountFailed]}>
                    -{item.amount.toLocaleString('fr-MA')} MAD
                  </Text>
                  <View style={[styles.statusBadge,
                    (item.status === 'SUCCESS' || item.status === 'COMPLETED') ? styles.badgeSuccess :
                    item.status === 'FAILED' ? styles.badgeFailed : styles.badgePending]}>
                    <Text style={[styles.statusBadgeText,
                      (item.status === 'SUCCESS' || item.status === 'COMPLETED') ? { color: '#166534' } :
                      item.status === 'FAILED' ? { color: '#991B1B' } : { color: '#92400E' }]}>
                      {(item.status === 'SUCCESS' || item.status === 'COMPLETED') ? '✓ Réussi' : item.status === 'FAILED' ? '✗ Échoué' : '⏳ En attente'}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  merchantName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  date: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: Colors.error },
  amountFailed: { textDecorationLine: 'line-through', color: Colors.textMuted },
  statusBadge:      { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  statusBadgeText:  { fontSize: 11, fontWeight: '700' },
  badgeSuccess:     { backgroundColor: '#DCFCE7' },
  badgeFailed:      { backgroundColor: '#FEE2E2' },
  badgePending:     { backgroundColor: '#FEF3C7' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  dotSuccess: { backgroundColor: Colors.success },
  dotFailed: { backgroundColor: Colors.error },
  dotPending: { backgroundColor: Colors.warning },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
});
