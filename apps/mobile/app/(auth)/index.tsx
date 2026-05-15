import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSend() {
    if (!phone.match(/^\+?[0-9]{9,15}$/)) {
      Alert.alert('Numéro invalide');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/otp/send', { phone });
      router.push({ pathname: '/(auth)/otp', params: { phone } });
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FamilyPay</Text>
      <Text style={styles.subtitle}>Entrez votre numéro de téléphone</Text>
      <TextInput
        style={styles.input}
        placeholder="+212 6XX XXX XXX"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        autoFocus
      />
      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSend} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Envoi...' : 'Continuer'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, fontSize: 18, marginBottom: 16 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
