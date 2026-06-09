import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { api } from '../../src/lib/api';

export default function InviteScreen() {
  const [loading, setLoading] = useState(false);
  const [token, setToken]   = useState('');
  const [link, setLink]     = useState('');

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await api.post('/auth/sponsor/invite');
      const inviteToken = res.data.invitationToken ?? res.data.token ?? res.data.invite?.token ?? '';
      const inviteLink  = res.data.inviteLink ?? `https://familypay.app/register?token=${inviteToken}`;
      setToken(inviteToken);
      setLink(inviteLink);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.message ?? 'Impossible de générer le lien');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(link);
      Alert.alert('Copié !', 'Lien copié dans le presse-papiers');
    } catch {
      Alert.alert("Token d'invitation", token);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inviter un bénéficiaire</Text>
      <Text style={styles.subtitle}>
        Générez un lien unique (valable 7 jours) pour inviter un membre de votre famille.
      </Text>

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleGenerate}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Génération...' : '🔗 Générer un lien d\'invitation'}</Text>
      </TouchableOpacity>

      {link ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Lien d'invitation :</Text>
          <TextInput
            style={styles.linkInput}
            value={link}
            editable={false}
            multiline
            selectTextOnFocus
          />
          <Text style={styles.tokenLabel}>Token : <Text style={styles.tokenValue}>{token}</Text></Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            <Text style={styles.copyBtnText}>📋 Copier le lien</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 24, backgroundColor: '#fff' },
  title:        { fontSize: 24, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 12, marginTop: 40 },
  subtitle:     { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  btn:          { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultBox:    { marginTop: 32, backgroundColor: '#f5f3ff', borderRadius: 12, padding: 16, gap: 12 },
  resultLabel:  { fontSize: 13, fontWeight: '600', color: '#6c47ff' },
  linkInput:    { backgroundColor: '#fff', borderRadius: 8, padding: 10, fontSize: 13, color: '#333', borderWidth: 1, borderColor: '#e0e0e0', minHeight: 60 },
  tokenLabel:   { fontSize: 13, color: '#666' },
  tokenValue:   { fontWeight: '700', color: '#1a1a2e', fontFamily: 'monospace' },
  copyBtn:      { backgroundColor: '#6c47ff', borderRadius: 8, padding: 12, alignItems: 'center' },
  copyBtnText:  { color: '#fff', fontWeight: '600', fontSize: 14 },
});
