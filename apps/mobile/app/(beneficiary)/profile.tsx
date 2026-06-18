import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/lib/auth-store';
import { apiClient } from '../../src/lib/api';

type BeneficiaryProfile = {
  id: string;
  user: { firstName: string; lastName: string; phone: string; email?: string; createdAt: string };
  _count: { allocations: number; transactions: number };
  totalReceived: number;
  totalSpent: number;
};

export default function BeneficiaryProfileScreen() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [notif, setNotif] = useState(true);

  const { data, isLoading } = useQuery<BeneficiaryProfile>({
    queryKey: ['beneficiary-profile'],
    queryFn: async () => {
      const res = await apiClient.get('/mobile/beneficiary/profile');
      return res.data;
    },
  });

  const handleLogout = async () => {
    // Sur mobile, déconnexion directe
    await clearAuth();
    if (typeof window !== 'undefined') {
      (window as any).location.href = '/';
    } else {
      router.replace('/(auth)');
    }
  };

  if (isLoading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <TouchableOpacity style={[styles.logoutBtn, { marginTop: 40 }]} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>🚪 Déconnexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { user } = data;
  const initials = `${(user.firstName ?? '')[0] ?? ''}`.toUpperCase();
  const memberSince = new Date(user.createdAt).toLocaleDateString('fr-MA', { year: 'numeric', month: 'long' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <Text style={styles.name}>{user.firstName ?? ''}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        {user.email && <Text style={styles.email}>{user.email}</Text>}
        <View style={styles.memberBadge}><Text style={styles.memberText}>Membre depuis {memberSince}</Text></View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data.totalReceived.toLocaleString('fr-MA')}</Text>
          <Text style={styles.statLabel}>MAD reçus</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={styles.statNum}>{data.totalSpent.toLocaleString('fr-MA')}</Text>
          <Text style={styles.statLabel}>MAD dépensés</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data._count.transactions}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <View style={styles.switchRow}>
          <View><Text style={styles.switchLabel}>Alertes de paiement</Text><Text style={styles.switchSub}>Recevoir les confirmations de transaction</Text></View>
          <Switch value={notif} onValueChange={setNotif} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="#fff" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Compte</Text>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}><Text style={styles.actionText}>Conditions d'utilisation</Text><Text style={styles.chevron}>›</Text></TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}><Text style={styles.actionText}>Politique de confidentialité</Text><Text style={styles.chevron}>›</Text></TouchableOpacity>
      </View>

      <Text style={styles.version}>FamilyPay v1.0.0 — © ALTIVAX 2026</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero:           { alignItems: 'center', paddingTop: 64, paddingBottom: 28, backgroundColor: '#22C55E', shadowColor: '#22C55E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  avatar:         { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  avatarText:     { color: '#fff', fontWeight: '800', fontSize: 30 },
  name:           { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  phone:          { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },
  email:          { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  memberBadge:    { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: Radius.full },
  memberText:     { color: '#fff', fontSize: 12, fontWeight: '500' },
  statsRow:       { flexDirection: 'row', margin: 16, gap: 10 },
  statCard:       { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statCardMiddle: { borderColor: '#22C55E', borderWidth: 1.5, backgroundColor: '#F0FDF4' },
  statNum:        { fontSize: 18, fontWeight: '800', color: '#22C55E', letterSpacing: -0.3 },
  statLabel:      { fontSize: 11, color: Colors.textSecondary, marginTop: 3, fontWeight: '500' },
  section:        { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  switchRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel:    { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  switchSub:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  actionRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  actionText:     { fontSize: 14, color: Colors.textPrimary },
  chevron:        { fontSize: 20, color: Colors.textMuted },
  logoutBtn:      { marginHorizontal: 16, marginTop: 8, marginBottom: 12, backgroundColor: Colors.errorBg, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: Colors.errorBorder },
  logoutText:     { color: Colors.error, fontWeight: '700', fontSize: 15 },
  version:        { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: 16, marginBottom: 8 },
});
