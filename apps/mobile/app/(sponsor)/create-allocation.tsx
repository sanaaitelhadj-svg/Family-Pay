import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { CATEGORIES } from '../../src/constants/categories';

export default function CreateAllocationScreen() {
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleCreate() {
    if (!category || !amount || !beneficiaryId) {
      Alert.alert('Champs manquants');
      return;
    }
    setLoading(true);
    try {
      await api.post('/allocations', {
        category,
        amount: parseFloat(amount),
        beneficiaryId,
      });
      queryClient.invalidateQueries({ queryKey: ['sponsor-allocations'] });
      Alert.alert('Succès', 'Allocation créée', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.error ?? 'Création échouée');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.title}>Nouvelle allocation</Text>
      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.grid}>
        {Object.entries(CATEGORIES).map(([value, cat]) => (
          <TouchableOpacity
            key={value}
            style={[styles.catBtn, category === value && styles.catBtnActive]}
            onPress={() => setCategory(value)}
          >
            <Text style={styles.catIcon}>{cat.icon}</Text>
            <Text style={[styles.catLabel, category === value && styles.catLabelActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Montant (MAD)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />
      <Text style={styles.label}>ID du bénéficiaire</Text>
      <TextInput
        style={styles.input}
        placeholder="Identifiant bénéficiaire"
        value={beneficiaryId}
        onChangeText={setBeneficiaryId}
        autoCapitalize="none"
      />
      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleCreate} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Création...' : 'Créer l\'allocation'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { width: '30%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  catBtnActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  catIcon: { fontSize: 24 },
  catLabel: { fontSize: 11, color: '#666', marginTop: 4 },
  catLabelActive: { color: '#4f46e5', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 16 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
