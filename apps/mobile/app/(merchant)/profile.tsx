import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/lib/auth-store';
import { apiClient } from '../../src/lib/api';

type MerchantProfile = {
  id: string;
  businessName?: string;
  user: { firstName: string; lastName: string; phone: string; email?: string; createdAt: string };
  acceptedCategories: string[];
  _count: { transactions: number };
  totalRevenue: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: '🍔 Alimentation', TRANSPORT: '🚌 Transport', HEALTH: '💊 Santé',
  EDUCATION: '📚 Éducation', CLOTHING: '👕 Habillement', OTHER: '📦 Autre',
};

export default function MerchantProfileScreen() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [notif, setNotif] = useState(true);

  const { data, isLoading } = useQuery<MerchantProfile>({
    queryKey: ['merchant-profile'],
    queryFn: async () => {
      const res = await apiClient.get('/mobile/merchant/profile');
      return res.data;
    },
  });

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => { await clearAuth(); router.replace('/(auth)'); } },
    ]);
  };

  if (isLoading || !data) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  const { user } = data;
  const initials = `${(user.firstName ?? '')[0] ?? ''}`.toUpperCase();
  const memberSince = new Date(user.createdAt).toLocaleDateString('fr-MA', { year: 'numeric', month: 'long' });
  const displayName = data.businessName || `${user.firstName} ${user.lastName}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        {user.email && <Text style={styles.email}>{user.email}</Text>}
        <View style={styles.memberBadge}><Text style={styles.memberText}>Membre depuis {memberSince}</Text></View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data.totalRevenue.toLocaleString('fr-MA')}</Text>
          <Text style={styles.statLabel}>MAD encaissés</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={styles.statNum}>{data._count.transactions}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data.acceptedCategories.length}</Text>
          <Text style={styles.statLabel}>Catégories</Text>
        </View>
      </View>

      {data.acceptedCategories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏷️ Catégories acceptées</Text>
          <View style={styles.catList}>
            {data.acceptedCategories.map(cat => (
              <View key={cat} style={styles.catChip}>
                <Text style={styles.catChipText}>{CATEGORY_LABELS[cat] ?? cat}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <View style={styles.switchRow}>
          <View><Text style={styles.switchLabel}>Alertes de paiement</Text><Text style={styles.switchSub}>Recevoir les confirmations de transaction</Text></View>
          <Switch value={notif} onValueChange={setNotif} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="#fff" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Compte</Text>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}><Text style={styles.actionText}>Modifier les informations</Text><Text style={styles.chevron}>›</Text></TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}><Text style={styles.actionText}>Conditions d'utilisation</Text><Text style={styles.chevron}>›</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>
      <Text style={styles.version}>FamilyPay v1.0.0 — © ALTIVAX 2026</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: '#F59E0B' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 26 },
  name: { color: '#fff', fontSize: 20, fontWeight: '700' },
  phone: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  email: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 1 },
  memberBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  memberText: { color: '#fff', fontSize: 12 },
  statsRow: { flexDirection: 'row', margin: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statCardMiddle: { borderColor: '#F59E0B', borderWidth: 1.5 },
  statNum: { fontSize: 16, fontWeight: '800', color: '#F59E0B' },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  section: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  catList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { backgroundColor: Colors.warningBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: '#FDE68A' },
  catChipText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  switchSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  actionText: { fontSize: 14, color: Colors.textPrimary },
  chevron: { fontSize: 20, color: Colors.textMuted },
  logoutBtn: { marginHorizontal: 16, marginTop: 8, backgroundColor: Colors.errorBg, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: 16 },
});
