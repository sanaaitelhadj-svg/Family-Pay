import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, FlatList, StyleSheet, RefreshControl, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/auth-store';
import { AllocationCard } from '../../src/components/AllocationCard';

export default function BeneficiaryAllocationsScreen() {
  const { user, setAuth } = useAuthStore();
  const router = useRouter();
  const [dismissing, setDismissing]   = useState(false);
  const isFirstLogin = (user as any)?.isFirstLogin === true;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['beneficiary-allocations'],
    queryFn: () => api.get('/mobile/beneficiary/allocations').then((r) => r.data),
  });

  const handleDismissWelcome = async () => {
    setDismissing(true);
    try {
      await api.post('/mobile/beneficiary/complete-onboarding');
      // Update local user state
      if (user) {
        const updatedUser = { ...user, isFirstLogin: false };
          useAuthStore.setState({ user: updatedUser });
      }
    } catch { /* ignore */ } finally {
      setDismissing(false);
    }
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator color="#6C47FF" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mes budgets</Text>
      <TouchableOpacity
        style={styles.merchantsBtn}
        onPress={() => router.push('/(beneficiary)/merchants' as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.merchantsBtnText}>🏬 Voir les marchands disponibles</Text>
      </TouchableOpacity>
      <FlatList
        data={data ?? []}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => <AllocationCard allocation={item} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Aucun budget disponible pour le moment</Text>}
      />

      {/* Welcome modal for first login */}
      <Modal visible={isFirstLogin} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeIcon}>🎉</Text>
            <Text style={styles.welcomeTitle}>Bienvenue sur FamilyPay !</Text>
            <Text style={styles.welcomeText}>
              Votre compte a été créé avec succès.{'\n'}
              Vous pouvez désormais utiliser vos allocations chez les marchands partenaires.
            </Text>
            <TouchableOpacity style={styles.welcomeBtn} onPress={handleDismissWelcome} disabled={dismissing}>
              {dismissing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.welcomeBtnText}>Commencer →</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5f5f5' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { fontSize: 24, fontWeight: '700', color: '#1a1a2e', padding: 16, paddingBottom: 0 },
  empty:          { textAlign: 'center', color: '#999', marginTop: 48 },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  welcomeCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 380 },
  welcomeIcon:    { fontSize: 52, marginBottom: 12 },
  welcomeTitle:   { fontSize: 22, fontWeight: '800', color: '#1a1a2e', textAlign: 'center', marginBottom: 12 },
  welcomeText:    { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  welcomeBtn:     { backgroundColor: '#6C47FF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  welcomeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  merchantsBtn:     { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#EEF2FF', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE' },
  merchantsBtnText: { fontSize: 14, fontWeight: '700', color: '#5B3DF5' },
});
