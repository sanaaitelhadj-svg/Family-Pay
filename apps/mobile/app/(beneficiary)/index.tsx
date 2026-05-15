import { View, FlatList, StyleSheet, RefreshControl, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { AllocationCard } from '../../src/components/AllocationCard';

export default function BeneficiaryAllocationsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['beneficiary-allocations'],
    queryFn: () => api.get('/allocations/my').then((r) => r.data),
  });

  if (isLoading) return <View style={styles.center}><Text>Chargement...</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mes budgets</Text>
      <FlatList
        data={data?.allocations ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AllocationCard allocation={item} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Aucun budget disponible</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', padding: 16, paddingBottom: 0 },
  empty: { textAlign: 'center', color: '#999', marginTop: 48 },
});
