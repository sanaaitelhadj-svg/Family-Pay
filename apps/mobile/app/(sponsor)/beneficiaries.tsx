import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { apiClient } from '../../src/lib/api';

type Allocation = {
  id: string;
  category: string;
  limitAmount: number;
  remainingAmount: number;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'EXHAUSTED';
};

type Beneficiary = {
  id: string;
  user: { firstName: string; lastName: string; phone: string };
  totalAllocated: number;
  totalSpent: number;
  activeAllocations: number;
  isActive: boolean;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Alimentation', PHARMACY: 'Pharmacie', EDUCATION: 'Éducation',
  TRANSPORT: 'Transport', CLOTHING: 'Habillement', HEALTH: 'Santé',
  ENTERTAINMENT: 'Loisirs', OTHER: 'Autre',
};

export default function BeneficiariesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery<Beneficiary[]>({
    queryKey: ['sponsor-beneficiaries'],
    queryFn: async () => {
      const res = await apiClient.get('/mobile/sponsor/beneficiaries');
      return res.data;
    },
  });

  const { data: allocations, isLoading: allocLoading } = useQuery<Allocation[]>({
    queryKey: ['sponsor-allocations', expandedId],
    queryFn: async () => {
      const res = await apiClient.get(`/mobile/sponsor/beneficiaries/${expandedId}/allocations`);
      return res.data;
    },
    enabled: !!expandedId,
  });

  const suspendBenef = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/mobile/sponsor/beneficiaries/${id}/suspend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sponsor-beneficiaries'] }),
  });

  const deleteBenef = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/mobile/sponsor/beneficiaries/${id}`),
    onSuccess: () => {
      setExpandedId(null);
      queryClient.invalidateQueries({ queryKey: ['sponsor-beneficiaries'] });
    },
  });

  const pauseAlloc = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/mobile/sponsor/allocations/${id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sponsor-allocations', expandedId] }),
  });

  const deleteAlloc = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/mobile/sponsor/allocations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsor-allocations', expandedId] });
      queryClient.invalidateQueries({ queryKey: ['sponsor-beneficiaries'] });
    },
  });

  const confirmDelete = (label: string, onConfirm: () => void) => {
    if (typeof window !== 'undefined') {
      if (window.confirm(`Supprimer ${label} ? Cette action est irréversible.`)) onConfirm();
    } else {
      onConfirm();
    }
  };

  const filtered = (data ?? []).filter(b => {
    const name = `${b.user.firstName} ${b.user.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase()) || b.user.phone.includes(search);
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bénéficiaires</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(sponsor)/invite' as any)}>
            <Text style={styles.addBtnText}>🔗 Inviter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#16a34a' }]} onPress={() => router.push('/(sponsor)/create-beneficiary' as any)}>
            <Text style={styles.addBtnText}>+ Créer</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={styles.statNum}>{data?.filter(b => b.isActive).length ?? 0}</Text>
          <Text style={styles.statLabel}>Actifs</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statNum}>{(data ?? []).reduce((s, b) => s + b.totalAllocated, 0).toLocaleString('fr-MA')} MAD</Text>
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
            <Text style={styles.emptySubtext}>Créez ou invitez votre premier bénéficiaire</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.id;
          const initials = `${(item.user.firstName ?? '')[0] ?? ''}`.toUpperCase();

          return (
            <View style={[styles.card, !item.isActive && styles.cardInactive]}>
              <View style={styles.cardHeader}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{item.user.firstName} {item.user.lastName}</Text>
                  <Text style={styles.cardPhone}>{item.user.phone}</Text>
                </View>
                <View style={styles.rightCol}>
                  <View style={[styles.statusPill, { backgroundColor: item.isActive ? '#dcfce7' : '#f3f4f6' }]}>
                    <Text style={[styles.statusPillText, { color: item.isActive ? '#16a34a' : '#6b7280' }]}>
                      {item.isActive ? '● Actif' : '● Suspendu'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : item.id)} style={styles.chevronBtn}>
                    <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {isExpanded && (
                <View style={styles.expandedSection}>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => router.push({ pathname: '/(sponsor)/create-allocation' as any, params: { beneficiaryId: item.id } })}
                    >
                      <Text style={styles.actionBtnText}>✏️ Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnWarn]}
                      onPress={() => suspendBenef.mutate(item.id)}
                      disabled={suspendBenef.isPending}
                    >
                      <Text style={[styles.actionBtnText, { color: '#d97706' }]}>
                        {item.isActive ? '⏸ Suspendre' : '▶ Réactiver'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      onPress={() => confirmDelete(`${item.user.firstName}`, () => deleteBenef.mutate(item.id))}
                      disabled={deleteBenef.isPending}
                    >
                      <Text style={[styles.actionBtnText, { color: Colors.error }]}>🗑 Supprimer</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.allocTitle}>Allocations ({allocLoading ? '…' : (allocations?.length ?? 0)})</Text>
                  <TouchableOpacity
                    style={styles.addAllocBtn}
                    onPress={() => router.push({ pathname: '/(sponsor)/create-allocation' as any, params: { beneficiaryId: item.id } })}
                  >
                    <Text style={styles.addAllocBtnText}>+ Nouvelle allocation</Text>
                  </TouchableOpacity>

                  {allocLoading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />}
                  {(allocations ?? []).map(alloc => {
                    const spent = alloc.limitAmount - alloc.remainingAmount;
                    const pct = alloc.limitAmount > 0 ? Math.min(100, Math.round((spent / alloc.limitAmount) * 100)) : 0;
                    const isActive = alloc.status === 'ACTIVE';
                    return (
                      <View key={alloc.id} style={styles.allocCard}>
                        <View style={styles.allocHeader}>
                          <Text style={styles.allocName}>{CATEGORY_LABELS[alloc.category] ?? alloc.category}</Text>
                          <View style={[styles.allocBadge, { backgroundColor: isActive ? '#dcfce7' : '#fef3c7' }]}>
                            <Text style={[styles.allocBadgeText, { color: isActive ? '#16a34a' : '#d97706' }]}>{alloc.status}</Text>
                          </View>
                          <View style={styles.allocActions}>
                            <TouchableOpacity onPress={() => pauseAlloc.mutate(alloc.id)} style={styles.allocActionBtn}>
                              <Text style={styles.allocActionIcon}>{isActive ? '⏸' : '▶'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => confirmDelete(CATEGORY_LABELS[alloc.category] ?? alloc.category, () => deleteAlloc.mutate(alloc.id))}
                              style={styles.allocActionBtn}
                            >
                              <Text style={styles.allocActionIcon}>🗑</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.allocBar}>
                          <View style={[styles.allocBarFill, { width: `${pct}%` as any, backgroundColor: isActive ? Colors.primary : '#d1d5db' }]} />
                        </View>
                        <View style={styles.allocAmounts}>
                          <Text style={styles.allocAmountText}>{alloc.remainingAmount.toLocaleString('fr-MA')} MAD restant</Text>
                          <Text style={styles.allocAmountText}>{alloc.limitAmount.toLocaleString('fr-MA')} MAD limite</Text>
                        </View>
                      </View>
                    );
                  })}
                  {!allocLoading && (allocations ?? []).length === 0 && (
                    <Text style={styles.noAlloc}>Aucune allocation — créez-en une</Text>
                  )}
                </View>
              )}
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
  addBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  searchRow: { paddingHorizontal: 16, paddingBottom: 12 },
  searchInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 4 },
  statChip: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardInactive: { opacity: 0.65 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(91,61,245,0.12)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  cardName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  cardPhone: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  chevronBtn: { padding: 4 },
  chevron: { fontSize: 12, color: Colors.textMuted },
  expandedSection: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 14, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  actionBtnWarn: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  actionBtnDanger: { borderColor: '#fecaca', backgroundColor: '#fff1f1' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  allocTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  addAllocBtn: { paddingVertical: 8, borderRadius: Radius.md, backgroundColor: 'rgba(91,61,245,0.08)', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary },
  addAllocBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  allocCard: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  allocHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allocName: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  allocBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  allocBadgeText: { fontSize: 10, fontWeight: '700' },
  allocActions: { flexDirection: 'row', gap: 4 },
  allocActionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  allocActionIcon: { fontSize: 13 },
  allocBar: { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  allocBarFill: { height: '100%' as any, borderRadius: 3 },
  allocAmounts: { flexDirection: 'row', justifyContent: 'space-between' },
  allocAmountText: { fontSize: 11, color: Colors.textSecondary },
  noAlloc: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingVertical: 8 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  emptySubtext: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
