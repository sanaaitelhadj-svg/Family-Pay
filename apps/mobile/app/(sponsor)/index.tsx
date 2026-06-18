import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Card } from '@/components/Card';

const CAT_ICONS: Record<string, string> = {
  GENERAL:'💰', PHARMACY:'💊', FOOD:'🍕', CLOTHING:'👗', EDUCATION:'📚', LEISURE:'🎮',
};
const CAT_LABELS: Record<string, string> = {
  GENERAL:'Général', PHARMACY:'Pharmacie', FOOD:'Alimentation',
  CLOTHING:'Habillement', EDUCATION:'Éducation', LEISURE:'Loisirs',
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:'#22C55E', PAUSED:'#F59E0B', EXPIRED:'#9CA3AF', EXHAUSTED:'#EF4444',
};

export default function SponsorHome() {
  const user   = useAuthStore(s => s.user);
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sponsor-allocations'],
    queryFn: () => api.get('/mobile/sponsor/allocations').then(r => r.data.allocations ?? []),
  });

  const allocations: any[] = data ?? [];
  const active    = allocations.filter(a => a.status === 'ACTIVE');
  const totalLeft = active.reduce((s: number, a: any) => s + Number(a.remainingAmount ?? 0), 0);
  const totalLimit= active.reduce((s: number, a: any) => s + Number(a.limitAmount ?? 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.primary]} />}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour 👋</Text>
          <Text style={styles.userName}>{user?.firstName ?? 'Sponsor'}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.firstName ?? 'S').charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      {/* KPI card */}
      <View style={styles.kpiCard}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiValue}>{active.length}</Text>
            <Text style={styles.kpiLabel}>Allocations actives</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={styles.kpiValue}>{totalLeft.toFixed(0)}</Text>
            <Text style={styles.kpiLabel}>MAD restants</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={styles.kpiValue}>{allocations.length}</Text>
            <Text style={styles.kpiLabel}>Total alloc.</Text>
          </View>
        </View>
        {totalLimit > 0 && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (totalLeft / totalLimit) * 100)}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>{((totalLeft / totalLimit) * 100).toFixed(0)}% du budget restant</Text>
          </View>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(sponsor)/create-allocation' as any)} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>➕</Text>
          <Text style={styles.actionLabel}>Nouvelle{'\n'}allocation</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(sponsor)/invite' as any)} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>👤</Text>
          <Text style={styles.actionLabel}>Inviter un{'\n'}bénéficiaire</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(sponsor)/allocations' as any)} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionLabel}>Voir toutes{'\n'}les alloc.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(sponsor)/merchants' as any)} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>🏬</Text>
          <Text style={styles.actionLabel}>Marchands{'\n'}partenaires</Text>
        </TouchableOpacity>
      </View>

      {/* Recent allocations */}
      <Text style={styles.sectionTitle}>Allocations récentes</Text>
      {isLoading ? (
        <Card style={styles.emptyCard}><Text style={styles.emptyText}>Chargement...</Text></Card>
      ) : allocations.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyText}>Aucune allocation</Text>
          <Text style={styles.emptySubtext}>Créez votre première allocation pour commencer</Text>
        </Card>
      ) : (
        allocations.slice(0, 5).map((a: any) => (
          <Card key={a.id} style={styles.allocCard}>
            <View style={styles.allocRow}>
              <View style={styles.allocIcon}>
                <Text style={{ fontSize: 20 }}>{CAT_ICONS[a.category] ?? '💰'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.allocTopRow}>
                  <Text style={styles.allocCat}>{CAT_LABELS[a.category] ?? a.category}</Text>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[a.status] ?? '#9CA3AF' }]} />
                </View>
                <Text style={styles.allocBene}>
                  {a.beneficiary?.user?.firstName ?? '—'} {a.beneficiary?.user?.lastName ?? ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.allocAmount}>{Number(a.remainingAmount ?? 0).toFixed(0)} MAD</Text>
                <Text style={styles.allocLimit}>/ {Number(a.limitAmount ?? 0).toFixed(0)} MAD</Text>
              </View>
            </View>
            <View style={styles.allocBar}>
              <View style={[styles.allocBarFill, {
                width: `${Math.min(100, (Number(a.remainingAmount) / Number(a.limitAmount)) * 100)}%` as any,
                backgroundColor: STATUS_COLORS[a.status] ?? Colors.primary,
              }]} />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  content:      { padding: 20, paddingBottom: 40 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting:     { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', letterSpacing: 0.2 },
  userName:     { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5, marginTop: 2 },
  avatar:       { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  avatarText:   { color: '#fff', fontSize: 18, fontWeight: '700' },
  kpiCard:      { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 22, marginBottom: 20, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.30, shadowRadius: 20, elevation: 8 },
  kpiRow:       { flexDirection: 'row', justifyContent: 'space-around' },
  kpiItem:      { alignItems: 'center', flex: 1 },
  kpiValue:     { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  kpiLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3, textAlign: 'center', fontWeight: '500' },
  kpiDivider:   { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  progressWrap: { marginTop: 18 },
  progressBg:   { height: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 3 },
  progressLabel:{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 7, textAlign: 'right', fontWeight: '500' },
  actionsRow:   { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn:    { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  actionIcon:   { fontSize: 24, marginBottom: 8 },
  actionLabel:  { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600', lineHeight: 15 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14, letterSpacing: -0.2 },
  emptyCard:    { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon:    { fontSize: 44, marginBottom: 14 },
  emptyText:    { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  emptySubtext: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  allocCard:    { marginBottom: 12, padding: 16 },
  allocRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  allocIcon:    { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  allocTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allocCat:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },
  allocBene:    { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  allocAmount:  { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  allocLimit:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  allocBar:     { height: 4, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  allocBarFill: { height: '100%', borderRadius: 3 },
});
