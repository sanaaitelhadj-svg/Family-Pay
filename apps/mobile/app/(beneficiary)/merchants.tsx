import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';

const CAT_LABELS: Record<string,string> = { GENERAL:'Général',PHARMACY:'Pharmacie',FOOD:'Alimentation',CLOTHING:'Habillement',EDUCATION:'Éducation',LEISURE:'Loisirs' };
const CAT_ICONS:  Record<string,string> = { GENERAL:'💰',PHARMACY:'💊',FOOD:'🍕',CLOTHING:'👗',EDUCATION:'📚',LEISURE:'🎮' };
const CAT_COLORS: Record<string,string> = { GENERAL:'#5B3DF5',PHARMACY:'#EF4444',FOOD:'#F59E0B',CLOTHING:'#EC4899',EDUCATION:'#3B82F6',LEISURE:'#10B981' };

export default function BeneficiaryMerchantsScreen() {
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['beneficiary-merchants'],
    queryFn: () => api.get('/mobile/beneficiary/merchants').then(r => r.data ?? []),
  });

  const merchants: any[] = (data ?? []).filter((m: any) =>
    !search || m.businessName?.toLowerCase().includes(search.toLowerCase()) || m.city?.toLowerCase().includes(search.toLowerCase())
  );

  // Grouper par catégorie
  const grouped = merchants.reduce((acc: Record<string, any[]>, m: any) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Marchands disponibles</Text>
        <Text style={styles.subtitle}>Selon vos allocations actives</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput style={styles.searchInput} placeholder="🔍 Rechercher..."
          value={search} onChangeText={setSearch} placeholderTextColor={Colors.textMuted} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : merchants.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🏬</Text>
          <Text style={styles.emptyTitle}>Aucun marchand disponible</Text>
          <Text style={styles.emptySub}>Vos allocations actives déterminent les marchands accessibles</Text>
        </View>
      ) : (
        <FlatList
          data={Object.keys(grouped)}
          keyExtractor={k => k}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={({ item: cat }) => {
            const color = CAT_COLORS[cat] ?? Colors.primary;
            const items = grouped[cat];
            return (
              <View>
                {/* Entête catégorie */}
                <View style={styles.catHeader}>
                  <View style={[styles.catIconBox, { backgroundColor: color + '18' }]}>
                    <Text style={styles.catIconText}>{CAT_ICONS[cat] ?? '🏬'}</Text>
                  </View>
                  <Text style={[styles.catName, { color }]}>{CAT_LABELS[cat] ?? cat}</Text>
                  <View style={[styles.catCount, { backgroundColor: color + '18' }]}>
                    <Text style={[styles.catCountText, { color }]}>{items.length}</Text>
                  </View>
                </View>
                {/* Marchands */}
                {items.map((m: any) => (
                  <View key={m.id} style={styles.card}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardName}>{m.businessName}</Text>
                        {m.isRestricted && (
                          <View style={styles.restrictBadge}>
                            <Text style={styles.restrictText}>🔒 Dédié</Text>
                          </View>
                        )}
                      </View>
                      {m.city && <Text style={styles.cardCity}>📍 {m.city}{m.address ? ` · ${m.address}` : ''}</Text>}
                      {m.phone && <Text style={styles.cardPhone}>📞 {m.phone}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  header:       { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:        { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle:     { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  searchBox:    { padding: 12 },
  searchInput:  { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptySub:     { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  catHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catIconBox:   { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  catIconText:  { fontSize: 16 },
  catName:      { fontSize: 14, fontWeight: '800', flex: 1 },
  catCount:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  catCountText: { fontSize: 12, fontWeight: '700' },
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  cardName:     { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  restrictBadge:{ backgroundColor: '#F5F3FF', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  restrictText: { fontSize: 10, fontWeight: '700', color: '#5B3DF5' },
  cardCity:     { fontSize: 12, color: Colors.textSecondary, marginBottom: 1 },
  cardPhone:    { fontSize: 12, color: Colors.textSecondary },
});
