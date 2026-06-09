import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/lib/auth-store';
import { apiClient } from '../../src/lib/api';

type SponsorProfile = {
  id: string;
  user: { firstName: string; lastName: string; phone: string; email?: string; createdAt: string };
  pspCustomerReference?: string;
  maskedCardReference?: string;
  phoneVerifiedAt?: string;
  _count: { allocations: number; beneficiaries: number };
};

export default function ProfileScreen() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [notif, setNotif] = useState(true);

  const { data, isLoading } = useQuery<SponsorProfile>({
    queryKey: ['sponsor-profile'],
    queryFn: async () => {
      const res = await apiClient.get('/mobile/sponsor/profile');
      return res.data;
    },
  });

  const handleLogout = async () => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Voulez-vous vraiment vous déconnecter ?')
      : true;
    if (!confirmed) return;
    await clearAuth();
    if (typeof window !== 'undefined') {
      (window as any).location.href = '/';
    } else {
      router.replace('/(auth)');
    }
  };

  if (isLoading || !data) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  const { user } = data;
  const initials = `${(user.firstName ?? '')[0] ?? ''}`.toUpperCase();
  const memberSince = new Date(user.createdAt).toLocaleDateString('fr-MA', { year: 'numeric', month: 'long' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user.firstName ?? ''}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        {user.email && <Text style={styles.email}>{user.email}</Text>}
        <View style={styles.memberBadge}>
          <Text style={styles.memberText}>Membre depuis {memberSince}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data._count.allocations}</Text>
          <Text style={styles.statLabel}>Allocations</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={styles.statNum}>{data._count.beneficiaries}</Text>
          <Text style={styles.statLabel}>Bénéficiaires</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: data.phoneVerifiedAt ? Colors.success : Colors.warning }]}>
            {data.phoneVerifiedAt ? '✓' : '⚠'}
          </Text>
          <Text style={styles.statLabel}>Téléphone</Text>
        </View>
      </View>

      {(data.pspCustomerReference || data.maskedCardReference) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 Moyen de paiement</Text>
          {data.pspCustomerReference && (
            <View style={styles.row}><Text style={styles.rowLabel}>Référence PSP</Text><Text style={styles.rowValue}>{data.pspCustomerReference}</Text></View>
          )}
          {data.maskedCardReference && (
            <View style={styles.row}><Text style={styles.rowLabel}>Carte enregistrée</Text><Text style={styles.rowValue}>{data.maskedCardReference}</Text></View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Alertes d'utilisation</Text>
            <Text style={styles.switchSub}>Recevoir les notifications de dépense</Text>
          </View>
          <Switch value={notif} onValueChange={setNotif} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="#fff" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Compte</Text>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}>
          <Text style={styles.actionText}>Changer de mot de passe</Text><Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}>
          <Text style={styles.actionText}>Conditions d'utilisation</Text><Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}>
          <Text style={styles.actionText}>Politique de confidentialité</Text><Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
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
  hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: Colors.primary },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 26 },
  name: { color: '#fff', fontSize: 20, fontWeight: '700' },
  phone: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  email: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 1 },
  memberBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  memberText: { color: '#fff', fontSize: 12 },
  statsRow: { flexDirection: 'row', margin: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statCardMiddle: { borderColor: Colors.primary, borderWidth: 1.5 },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  section: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: Colors.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
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
