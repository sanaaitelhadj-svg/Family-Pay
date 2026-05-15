import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CATEGORIES, type Category } from '@/constants/categories';

interface Allocation {
  id: string;
  category: Category;
  limitAmount: number;
  remainingAmount: number;
  status: string;
  isLowBalance?: boolean;
  beneficiary?: { user: { firstName: string | null } };
}

export function AllocationCard({ allocation }: { allocation: Allocation }) {
  const cat = CATEGORIES[allocation.category];
  const pct = Math.round((allocation.remainingAmount / allocation.limitAmount) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconBg, { backgroundColor: cat.color + '20' }]}>
          <Text style={styles.icon}>{cat.icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.label}>{cat.label}</Text>
          {allocation.beneficiary && (
            <Text style={styles.sub}>{allocation.beneficiary.user.firstName ?? '—'}</Text>
          )}
        </View>
        <View style={[styles.badge, allocation.status === 'ACTIVE' ? styles.badgeActive : styles.badgePaused]}>
          <Text style={styles.badgeText}>{allocation.status}</Text>
        </View>
      </View>

      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
      </View>

      <View style={styles.amounts}>
        <Text style={[styles.remaining, allocation.isLowBalance && styles.low]}>
          {allocation.remainingAmount.toFixed(2)} MAD
        </Text>
        <Text style={styles.limit}>/ {allocation.limitAmount.toFixed(2)} MAD</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBg: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  info: { flex: 1, marginLeft: 10 },
  label: { fontSize: 15, fontWeight: '600', color: '#111' },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeActive: { backgroundColor: '#d1fae5' },
  badgePaused: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  bar: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: 6, borderRadius: 3 },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  remaining: { fontSize: 18, fontWeight: '700', color: '#111' },
  low: { color: '#ef4444' },
  limit: { fontSize: 13, color: '#9ca3af' },
});
