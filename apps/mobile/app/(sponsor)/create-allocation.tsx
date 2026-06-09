import { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

const CATEGORIES = [
  {key:'GENERAL',   label:'Général',      icon:'💰'},
  {key:'PHARMACY',  label:'Pharmacie',    icon:'💊'},
  {key:'FOOD',      label:'Alimentation', icon:'🍕'},
  {key:'CLOTHING',  label:'Habillement',  icon:'👗'},
  {key:'EDUCATION', label:'Éducation',    icon:'📚'},
  {key:'LEISURE',   label:'Loisirs',      icon:'🎮'},
];

export default function CreateAllocationScreen() {
  // Gate : vérifier si le sponsor a une carte enregistrée
  const { data: profile } = useQuery({
    queryKey: ['sponsor-profile'],
    queryFn: async () => { const r = await api.get('/mobile/sponsor/profile'); return r.data; },
  });

  const hasCard = !!(profile?.maskedCardReference);
  const router  = useRouter();
  const qc      = useQueryClient();
  const [category,    setCategory]    = useState('GENERAL');
  const [beneficiary, setBeneficiary] = useState('');
  const [amount,      setAmount]      = useState('');
  const [expiresAt,   setExpiresAt]   = useState('');

  const { data: beneficiaries } = useQuery({
    queryKey: ['sponsor-beneficiaries'],
    queryFn: () => api.get('/mobile/sponsor/beneficiaries').then(r => r.data ?? []),
  });

  const mutation = useMutation({
    mutationFn: () => api.post('/allocations', {
      beneficiaryId: beneficiary,
      category,
      limitAmount: Number(amount),
      expiresAt: expiresAt || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-allocations'] });
      if (typeof window !== 'undefined') { window.alert('✅ Allocation créée avec succès !'); router.back(); } else { Alert.alert('✅ Allocation créée', "L'allocation a été créée avec succès.", [{ text: 'OK', onPress: () => router.back() }]); }
    },
    onError: (err: any) => Alert.alert('Erreur', err.response?.data?.message ?? 'Erreur lors de la création'),
  });

  const canSubmit = beneficiary && amount && Number(amount) > 0 && !mutation.isPending;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Retour</Text></TouchableOpacity>
        <Text style={styles.title}>Nouvelle allocation</Text>
        <View style={{width:60}} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Catégorie */}
        <Text style={styles.label}>Catégorie *</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c.key} onPress={() => setCategory(c.key)} activeOpacity={0.8}
              style={[styles.catCard, category === c.key && styles.catCardActive]}>
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text style={[styles.catLabel, category === c.key && styles.catLabelActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bénéficiaire */}
        <Text style={styles.label}>Bénéficiaire *</Text>
        {!beneficiaries || beneficiaries.length === 0 ? (
          <Card style={styles.noBeneCard}>
            <Text style={styles.noBeneText}>Aucun bénéficiaire lié</Text>
            <Button label="🔗 Inviter par lien" onPress={() => router.push('/(sponsor)/invite' as any)}
              variant="outline" style={{marginTop:10}} />
            <Button label="➕ Créer un compte bénéficiaire" onPress={() => router.push('/(sponsor)/create-beneficiary' as any)}
              style={{marginTop:8}} />
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}} contentContainerStyle={{gap:10}}>
            {beneficiaries.map((b: any) => (
              <TouchableOpacity key={b.id} onPress={() => setBeneficiary(b.id)} activeOpacity={0.8}
                style={[styles.beneChip, beneficiary === b.id && styles.beneChipActive]}>
                <View style={styles.beneAvatar}>
                  <Text style={styles.beneAvatarText}>{b.user?.firstName?.charAt(0)??'?'}</Text>
                </View>
                <Text style={[styles.beneName, beneficiary === b.id && styles.beneNameActive]}>
                  {b.user?.firstName} {b.user?.lastName??''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Montant */}
        <Text style={styles.label}>Montant limite (MAD) *</Text>
        <View style={styles.inputWrap}>
          <TextInput style={styles.input} placeholder="ex: 500" keyboardType="numeric"
            value={amount} onChangeText={setAmount} placeholderTextColor={Colors.textMuted} />
          <Text style={styles.inputSuffix}>MAD</Text>
        </View>

        {/* Date expiration */}
        <Text style={styles.label}>Date d'expiration <Text style={styles.optional}>(optionnel)</Text></Text>
        <View style={styles.inputWrap}>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              style={{ flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#1a1a2e', padding: '2px 0' } as any}
              onChange={e => setExpiresAt(e.target.value)}
            />
          ) : (
            <TextInput style={styles.input} placeholder="AAAA-MM-JJ"
              value={expiresAt} onChangeText={setExpiresAt} placeholderTextColor={Colors.textMuted} />
          )}
        </View>

        <Button label="Créer l'allocation" onPress={() => mutation.mutate()}
          loading={mutation.isPending} disabled={!canSubmit} style={{marginTop:8}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:Colors.bg },
  topBar:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:20, paddingTop:56, backgroundColor:Colors.surface, borderBottomWidth:1, borderBottomColor:Colors.border },
  back:        { fontSize:15, color:Colors.primary, fontWeight:'600', width:60 },
  title:       { fontSize:17, fontWeight:'700', color:Colors.textPrimary },
  content:     { padding:20, gap:4, paddingBottom:40 },
  label:       { fontSize:13, fontWeight:'600', color:Colors.textSecondary, textTransform:'uppercase', letterSpacing:0.6, marginBottom:10, marginTop:16 },
  optional:    { fontWeight:'400', textTransform:'none' },
  catGrid:     { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:4 },
  catCard:     { width:'30%', backgroundColor:Colors.surface, borderRadius:Radius.md, padding:12, alignItems:'center', borderWidth:1.5, borderColor:Colors.border, ...Shadow.sm },
  catCardActive:{ borderColor:Colors.primary, backgroundColor:Colors.primaryLight },
  catIcon:     { fontSize:24, marginBottom:4 },
  catLabel:    { fontSize:11, fontWeight:'600', color:Colors.textSecondary, textAlign:'center' },
  catLabelActive:{ color:Colors.primary },
  noBeneCard:  { alignItems:'center', padding:20 },
  noBeneText:  { fontSize:14, color:Colors.textSecondary },
  beneChip:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:Colors.surface, borderRadius:Radius.full, paddingHorizontal:14, paddingVertical:10, borderWidth:1.5, borderColor:Colors.border, ...Shadow.sm },
  beneChipActive:{ borderColor:Colors.primary, backgroundColor:Colors.primaryLight },
  beneAvatar:  { width:28, height:28, borderRadius:14, backgroundColor:Colors.primary, justifyContent:'center', alignItems:'center' },
  beneAvatarText:{ color:'#fff', fontSize:12, fontWeight:'700' },
  beneName:    { fontSize:14, fontWeight:'600', color:Colors.textSecondary },
  beneNameActive:{ color:Colors.primary },
  inputWrap:   { flexDirection:'row', alignItems:'center', backgroundColor:Colors.surface, borderRadius:Radius.md, borderWidth:1.5, borderColor:Colors.border, paddingHorizontal:14, ...Shadow.sm, marginBottom:4 },
  input:       { flex:1, fontSize:16, paddingVertical:13, color:Colors.textPrimary },
  inputSuffix: { fontSize:14, fontWeight:'600', color:Colors.textSecondary },
});
