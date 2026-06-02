import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Radius, Shadow } from '../../src/constants/theme';
import { useAuthStore } from '../../src/lib/auth-store';
import { apiClient } from '../../src/lib/api';

type Beneficiary = {
  id: string;
  user: { firstName: string; lastName: string; phone: string };
  totalAllocated: number;
  totalSpent: number;
  activeAllocations: number;
  createdAt: string;
};

export default function BeneficiariesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery<Beneficiary[]>({
    queryKey: ['sponsor-beneficiaries'],
    queryFn: async () => {
      const res = await apiClient.get('/sponsor/beneficiaries');
      return res.data;
    },
  });

  const filtered = (data ?? []).filter(b => {
    const name = `${b.user.firstName} ${b.user.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase()) || b.user.phone.includes(search);
  });

  const getInitials = (b: Beneficiary) =>
    `${(b.user.firstName ?? '')[0] ?? ''}`.toUpperCase();

  const usagePercent = (b: Beneficiary) =>
    b.totalAllocated > 0 ? Math.min(100, Math.round((b.totalSpent / b.totalAllocated) * 100)) : 0;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bénéficiaires</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(sponsor)/invite')}>
          <Text style={styles.addBtnText}>+ Inviter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Nom ou téléphone…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{data?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{data?.filter(b => b.activeAllocations > 0).length ?? 0}</Text>
          <Text style={styles.statLabel}>Actifs</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>
            {(data ?? []).reduce((s, b) => s + b.totalAllocated, 0).toLocaleString('fr-MA')} MAD
          </Text>
          <Text style={styles.statLabel}>Alloué</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>Aucun bénéficiaire</Text>
            <Text style={styles.emptySubtext}>Invitez votre premier bénéficiaire</Text>
          </View>
        }
        renderItem={({ item }) => {
          const pct = usagePercent(item);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push({ pathname: '/(sponsor)/create-allocation', params: { beneficiaryId: item.id } })}
              activeOpacity={0.85}
            >
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.user.firstName} {item.user.lastName}</Text>
                  <Text style={styles.phone}>{item.user.phone}</Text>
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
                    </View>
                    <Text style={styles.progressLabel}>{pct}%</Text>
                  </View>
                  <Text style={styles.budgetText}>
                    {item.totalSpent.toLocaleString('fr-MA')} / {item.totalAllocated.toLocaleString('fr-MA')} MAD
                  </Text>
                </View>
                <View style={[styles.badge, item.activeAllocations > 0 ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={styles.badgeText}>{item.activeAllocations} alloc.</Text>
                </View>
              </View>
            </TouchableOpacity>
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
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  searchRow: { paddingHorizontal: 16, paddingBottom: 12 },
  searchInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 4 },
  statChip: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(91,61,245,0.12)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  phone: { fontSize: 12, color: Colors.textSecondary, marginTop: 1, marginBottom: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' as any, backgroundColor: Colors.primary, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: Colors.textSecondary, minWidth: 28 },
  budgetText: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  badgeActive: { backgroundColor: Colors.successBg },
  badgeInactive: { backgroundColor: Colors.bg },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  emptySubtext: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
