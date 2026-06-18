import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';

const CAT_LABELS: Record<string,string> = { GENERAL:'Général',PHARMACY:'Pharmacie',FOOD:'Alimentation',CLOTHING:'Habillement',EDUCATION:'Éducation',LEISURE:'Loisirs' };
const CAT_ICONS:  Record<string,string> = { GENERAL:'💰',PHARMACY:'💊',FOOD:'🍕',CLOTHING:'👗',EDUCATION:'📚',LEISURE:'🎮' };
const CAT_COLORS: Record<string,string> = { GENERAL:'#5B3DF5',PHARMACY:'#EF4444',FOOD:'#F59E0B',CLOTHING:'#EC4899',EDUCATION:'#3B82F6',LEISURE:'#10B981' };
const CATS = ['','GENERAL','PHARMACY','FOOD','CLOTHING','EDUCATION','LEISURE'];

export default function BeneficiaryMerchantsScreen() {
  const [search, setSearch] = useState('');
  const [catFilter, setCat] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['beneficiary-merchants', catFilter],
    queryFn: () => api.get(`/mobile/beneficiary/merchants${catFilter ? `?category=${catFilter}` : ''}`).then(r => r.data ?? []),
  });

  const merchants: any[] = (data ?? []).filter((m: any) =>
    !search || m.businessName?.toLowerCase().includes(search.toLowerCase()) || m.city?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = merchants.reduce((acc: Record<string,any[]>, m: any) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Marchands partenaires</Text>
        <Text style={styles.subtitle}>{merchants.length} marchand{merchants.length > 1 ? 's' : ''} disponible{merchants.length > 1 ? 's' : ''}</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput style={styles.searchInput} placeholder="🔍 Rechercher par nom ou ville..."
          value={search} onChangeText={setSearch} placeholderTextColor={Colors.textMuted} />
      </View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={CATS} keyExtractor={i => i}
        style={styles.catScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.catChip, catFilter === item && { backgroundColor: CAT_COLORS[item] ?? Colors.primary, borderColor: CAT_COLORS[item] ?? Colors.primary }]}
            onPress={() => setCat(item)}
          >
            <Text style={[styles.catChipText, catFilter === item && { color: '#fff' }]}>
              {item ? `${CAT_ICONS[item]} ${CAT_LABELS[item]}` : '🏬 Tous'}
            </Text>
          </TouchableOpacity>
        )}
      />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : merchants.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🏬</Text>
          <Text style={styles.emptyText}>Aucun marchand trouvé</Text>
        </View>
      ) : (
        <FlatList
          data={Object.keys(grouped)} keyExtractor={k => k}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={({ item: cat }) => {
            const color = CAT_COLORS[cat] ?? Colors.primary;
            return (
              <View>
                <View style={styles.catHeader}>
                  <View style={[styles.catIconBox, { backgroundColor: color + '18' }]}>
                    <Text style={styles.catIconText}>{CAT_ICONS[cat] ?? '🏬'}</Text>
                  </View>
                  <Text style={[styles.catName, { color }]}>{CAT_LABELS[cat] ?? cat}</Text>
                  <View style={[styles.catCount, { backgroundColor: color + '18' }]}>
                    <Text style={[styles.catCountText, { color }]}>{grouped[cat].length}</Text>
                  </View>
                </View>
                {grouped[cat].map((m: any) => (
                  <View key={m.id} style={styles.card}>
                    <View style={[styles.cardIcon, { backgroundColor: color + '18' }]}>
                      <Text style={styles.cardIconText}>{CAT_ICONS[m.category] ?? '🏬'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{m.businessName}</Text>
                      {m.city && <Text style={styles.cardCity}>📍 {m.city}{m.address ? ` · ${m.address}` : ''}</Text>}
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
  title:        { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle:     { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  searchBox:    { padding: 12, paddingBottom: 4 },
  searchInput:  { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  catScroll:    { flexGrow: 0, marginVertical: 8 },
  catChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  catChipText:  { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon:    { fontSize: 40 },
  emptyText:    { fontSize: 15, color: Colors.textSecondary },
  catHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catIconBox:   { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  catIconText:  { fontSize: 16 },
  catName:      { fontSize: 14, fontWeight: '800', flex: 1 },
  catCount:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  catCountText: { fontSize: 12, fontWeight: '700' },
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', gap: 10, alignItems: 'center', ...Shadow.sm },
  cardIcon:     { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardIconText: { fontSize: 18 },
  cardName:     { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  cardCity:     { fontSize: 12, color: Colors.textSecondary },
});
