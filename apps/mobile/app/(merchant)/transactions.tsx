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
  beneficiary: { user: { firstName: string; lastName: string } };
  createdAt: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
};

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍔', TRANSPORT: '🚌', HEALTH: '💊',
  EDUCATION: '📚', CLOTHING: '👕', OTHER: '📦',
};

export default function MerchantTransactionsScreen() {
  const [filter, setFilter] = useState<'ALL' | 'TODAY' | 'WEEK'>('ALL');

  const { data, isLoading, refetch, isRefetching } = useQuery<Transaction[]>({
    queryKey: ['merchant-transactions'],
    queryFn: async () => {
      const res = await apiClient.get('/mobile/merchant/transactions');
      return res.data;
    },
  });

  const now = new Date();
  const filtered = (data ?? []).filter(t => {
    if (filter === 'TODAY') {
      const d = new Date(t.createdAt);
      return d.toDateString() === now.toDateString();
    }
    if (filter === 'WEEK') {
      const d = new Date(t.createdAt);
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    return true;
  });

  const totalFiltered = filtered.filter(t => t.status === 'SUCCESS').reduce((s, t) => s + t.amount, 0);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <View style={styles.totalChip}>
          <Text style={styles.totalText}>{totalFiltered.toLocaleString('fr-MA')} MAD</Text>
        </View>
      </View>

      <View style={styles.filters}>
        {(['ALL', 'TODAY', 'WEEK'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'ALL' ? 'Tout' : f === 'TODAY' ? "Aujourd'hui" : 'Cette semaine'}
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
          const clientName = `${item.beneficiary.user.firstName} ${item.beneficiary.user.lastName}`;
          const date = new Date(item.createdAt).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconBox}>
                  <Text style={{ fontSize: 22 }}>{CATEGORY_ICONS[item.category] ?? '📦'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{clientName}</Text>
                  <Text style={styles.date}>{date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amount, item.status !== 'SUCCESS' && styles.amountFailed]}>
                    +{item.amount.toLocaleString('fr-MA')} MAD
                  </Text>
                  <View style={[styles.statusDot,
                    item.status === 'SUCCESS' ? styles.dotSuccess :
                    item.status === 'FAILED'  ? styles.dotFailed  : styles.dotPending
                  ]} />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  totalChip: { backgroundColor: Colors.successBg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
  totalText: { color: Colors.success, fontWeight: '700', fontSize: 13 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  clientName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  date: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: Colors.success },
  amountFailed: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  dotSuccess: { backgroundColor: Colors.success },
  dotFailed: { backgroundColor: Colors.error },
  dotPending: { backgroundColor: Colors.warning },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
});
