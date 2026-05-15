import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { api } from '../../src/lib/api';

export default function InviteScreen() {
  const [loading, setLoading] = useState(false);

  async function handleInvite() {
    setLoading(true);
    try {
      const res = await api.post('/auth/invite');
      const link = res.data.inviteLink;
      await Share.share({ message: `Rejoignez FamilyPay : ${link}` });
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le lien');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inviter un bénéficiaire</Text>
      <Text style={styles.subtitle}>
        Générez un lien unique pour inviter un membre de votre famille à rejoindre FamilyPay.
      </Text>
      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleInvite} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Génération...' : 'Générer un lien d\'invitation'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 40, lineHeight: 22 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
