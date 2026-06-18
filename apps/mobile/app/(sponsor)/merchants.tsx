import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';

const CAT_LABELS: Record<string,string> = { GENERAL:'Général',PHARMACY:'Pharmacie',FOOD:'Alimentation',CLOTHING:'Habillement',EDUCATION:'Éducation',LEISURE:'Loisirs' };
const CAT_ICONS:  Record<string,string> = { GENERAL:'💰',PHARMACY:'💊',FOOD:'🍕',CLOTHING:'👗',EDUCATION:'📚',LEISURE:'🎮' };
const CAT_COLORS: Record<string,string> = { GENERAL:'#5B3DF5',PHARMACY:'#EF4444',FOOD:'#F59E0B',CLOTHING:'#EC4899',EDUCATION:'#3B82F6',LEISURE:'#10B981' };
const CATS = ['', 'GENERAL','PHARMACY','FOOD','CLOTHING','EDUCATION','LEISURE'];

export default function MerchantsScreen() {
  const [search, setSearch]   = useState('');
  const [catFilter, setCat]   = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sponsor-merchants', catFilter],
    queryFn: () => api.get(`/mobile/sponsor/merchants${catFilter ? `?category=${catFilter}` : ''}`).then(r => r.data ?? []),
  });

  const merchants: any[] = (data ?? []).filter((m: any) =>
    !search || m.businessName?.toLowerCase().includes(search.toLowerCase()) || m.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Marchands partenaires</Text>
        <Text style={styles.subtitle}>{merchants.length} marchand{merchants.length > 1 ? 's' : ''}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <TextInput style={styles.searchInput} placeholder="🔍 Rechercher par nom ou ville..."
          value={search} onChangeText={setSearch} placeholderTextColor={Colors.textMuted} />
      </View>

      {/* Filtres catégorie */}
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={CATS}
        keyExtractor={i => i}
        style={styles.catScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.catChip, catFilter === item && { backgroundColor: CAT_COLORS[item] ?? Colors.primary, borderColor: CAT_COLORS[item] ?? Colors.primary }]}
            onPress={() => setCat(item)}
          >
            <Text style={[styles.catChipText, catFilter === item && { color: '#fff' }]}>
              {item ? `${CAT_ICONS[item] ?? ''} ${CAT_LABELS[item] ?? item}` : '🏬 Tous'}
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
          data={merchants}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
          renderItem={({ item: m }) => {
            const color = CAT_COLORS[m.category] ?? Colors.primary;
            return (
              <View style={styles.card}>
                <View style={[styles.cardIcon, { backgroundColor: color + '18' }]}>
                  <Text style={styles.cardIconText}>{CAT_ICONS[m.category] ?? '🏬'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName}>{m.businessName}</Text>
                    <View style={[styles.catTag, { backgroundColor: color + '18' }]}>
                      <Text style={[styles.catTagText, { color }]}>{CAT_LABELS[m.category] ?? m.category}</Text>
                    </View>
                  </View>
                  {m.city && <Text style={styles.cardCity}>📍 {m.city}{m.address ? ` · ${m.address}` : ''}</Text>}
                  {m.phone && <Text style={styles.cardPhone}>📞 {m.phone}</Text>}
                  {m.description && <Text style={styles.cardDesc} numberOfLines={2}>{m.description}</Text>}
                </View>
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
  header:       { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:        { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  subtitle:     { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  searchBox:    { padding: 12, paddingBottom: 4 },
  searchInput:  { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary },
  catScroll:    { flexGrow: 0, marginVertical: 8 },
  catChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  catChipText:  { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon:    { fontSize: 40 },
  emptyText:    { fontSize: 15, color: Colors.textSecondary },
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardIcon:     { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardIconText: { fontSize: 22 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  cardName:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  catTag:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  catTagText:   { fontSize: 11, fontWeight: '700' },
  cardCity:     { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  cardPhone:    { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  cardDesc:     { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
