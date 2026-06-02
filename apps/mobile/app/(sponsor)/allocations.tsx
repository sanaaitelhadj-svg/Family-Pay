import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

const CAT_ICONS:  Record<string,string> = { GENERAL:'💰',PHARMACY:'💊',FOOD:'🍕',CLOTHING:'👗',EDUCATION:'📚',LEISURE:'🎮' };
const CAT_LABELS: Record<string,string> = { GENERAL:'Général',PHARMACY:'Pharmacie',FOOD:'Alimentation',CLOTHING:'Habillement',EDUCATION:'Éducation',LEISURE:'Loisirs' };
const STATUS_MAP: Record<string,{label:string;color:string;bg:string}> = {
  ACTIVE:    {label:'Actif',    color:'#166534', bg:'#F0FDF4'},
  PAUSED:    {label:'Pausé',    color:'#B45309', bg:'#FFF8E6'},
  EXPIRED:   {label:'Expiré',   color:'#6B7280', bg:'#F3F4F6'},
  EXHAUSTED: {label:'Épuisé',   color:'#991B1B', bg:'#FEF2F2'},
};

export default function AllocationsScreen() {
  const router  = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('ALL');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sponsor-allocations'],
    queryFn: () => api.get('/allocations').then(r => r.data.allocations ?? []),
  });

  const all: any[] = data ?? [];
  const filtered = all.filter(a => {
    const matchStatus = filter === 'ALL' || a.status === filter;
    const matchSearch = !search || `${a.beneficiary?.user?.firstName ?? ''} ${CAT_LABELS[a.category] ?? ''}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Allocations</Text>
        <Button label="+ Nouvelle" onPress={() => router.push('/(sponsor)/create-allocation' as any)} style={styles.newBtn} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput style={styles.searchInput} placeholder="Bénéficiaire, catégorie…"
          value={search} onChangeText={setSearch} placeholderTextColor={Colors.textMuted} />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {['ALL','ACTIVE','PAUSED','EXHAUSTED','EXPIRED'].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'ALL' ? 'Toutes' : STATUS_MAP[f]?.label ?? f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.primary]} />}>
        {isLoading ? (
          <Text style={styles.emptyText}>Chargement…</Text>
        ) : filtered.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={{fontSize:36,marginBottom:8}}>💳</Text>
            <Text style={styles.emptyText}>Aucune allocation</Text>
          </Card>
        ) : filtered.map((a: any) => {
          const st = STATUS_MAP[a.status] ?? STATUS_MAP.EXPIRED;
          const pct = Math.min(100, (Number(a.remainingAmount) / Number(a.limitAmount)) * 100);
          return (
            <Card key={a.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.catIcon}><Text style={{fontSize:22}}>{CAT_ICONS[a.category]??'💰'}</Text></View>
                <View style={{flex:1}}>
                  <Text style={styles.catLabel}>{CAT_LABELS[a.category]??a.category}</Text>
                  <Text style={styles.beneLabel}>{a.beneficiary?.user?.firstName??'—'} {a.beneficiary?.user?.lastName??''}</Text>
                </View>
                <View>
                  <View style={[styles.badge,{backgroundColor:st.bg}]}>
                    <Text style={[styles.badgeText,{color:st.color}]}>{st.label}</Text>
                  </View>
                  <Text style={styles.amount}>{Number(a.remainingAmount).toFixed(0)} MAD</Text>
                  <Text style={styles.limit}>/ {Number(a.limitAmount).toFixed(0)}</Text>
                </View>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, {width:`${pct}%` as any, backgroundColor: a.status==='ACTIVE'?Colors.primary:'#9CA3AF'}]} />
              </View>
              {a.expiresAt && (
                <Text style={styles.expiry}>Expire le {new Date(a.expiresAt).toLocaleDateString('fr-FR')}</Text>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:Colors.bg },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, paddingBottom:12 },
  title:       { fontSize:22, fontWeight:'800', color:Colors.textPrimary },
  newBtn:      { paddingVertical:8, paddingHorizontal:14 },
  searchWrap:  { flexDirection:'row', alignItems:'center', backgroundColor:Colors.surface, borderRadius:Radius.md, borderWidth:1, borderColor:Colors.border, marginHorizontal:20, paddingHorizontal:12, marginBottom:12, ...Shadow.sm },
  searchIcon:  { fontSize:16, marginRight:8 },
  searchInput: { flex:1, fontSize:14, paddingVertical:11, color:Colors.textPrimary },
  filterRow:   { marginBottom:12 },
  filterChip:  { paddingHorizontal:14, paddingVertical:7, borderRadius:Radius.full, backgroundColor:Colors.surface, borderWidth:1, borderColor:Colors.border },
  filterChipActive:    { backgroundColor:Colors.primary, borderColor:Colors.primary },
  filterChipText:      { fontSize:13, color:Colors.textSecondary, fontWeight:'600' },
  filterChipTextActive:{ color:'#fff' },
  list:        { padding:20, paddingTop:4, gap:10 },
  card:        { padding:14 },
  cardRow:     { flexDirection:'row', alignItems:'center', gap:12, marginBottom:10 },
  catIcon:     { width:44, height:44, borderRadius:12, backgroundColor:Colors.bg, justifyContent:'center', alignItems:'center' },
  catLabel:    { fontSize:15, fontWeight:'700', color:Colors.textPrimary },
  beneLabel:   { fontSize:12, color:Colors.textSecondary, marginTop:2 },
  badge:       { alignSelf:'flex-end', paddingHorizontal:8, paddingVertical:3, borderRadius:Radius.full, marginBottom:4 },
  badgeText:   { fontSize:11, fontWeight:'700' },
  amount:      { fontSize:15, fontWeight:'700', color:Colors.textPrimary, textAlign:'right' },
  limit:       { fontSize:11, color:Colors.textMuted, textAlign:'right' },
  bar:         { height:4, backgroundColor:Colors.border, borderRadius:2, overflow:'hidden' },
  barFill:     { height:'100%', borderRadius:2 },
  expiry:      { fontSize:11, color:Colors.textMuted, marginTop:6 },
  emptyCard:   { alignItems:'center', padding:32 },
  emptyText:   { fontSize:14, color:Colors.textSecondary, textAlign:'center' },
});
