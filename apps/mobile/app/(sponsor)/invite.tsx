import * as ExpoClipboard from 'expo-clipboard';
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Linking, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '../../src/lib/api';
import { Colors, Radius, Shadow } from '../../src/constants/theme';

const APP_SCHEME = 'familypay';

export default function InviteScreen() {
  const [loading, setLoading] = useState(false);
  const [token, setToken]     = useState('');
  const [link, setLink]       = useState('');
  const [copied, setCopied]   = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await api.post('/auth/sponsor/invite');
      const inviteToken = res.data.invitationToken ?? res.data.token ?? '';
      const inviteLink  = `${APP_SCHEME}://register-beneficiary?token=${inviteToken}`;
      setToken(inviteToken);
      setLink(inviteLink);
      setCopied(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function shareWhatsApp() {
    const message =
      `👋 Bonjour !\n\nJe vous invite à rejoindre *FamilyPay* pour gérer vos dépenses facilement.\n\n` +
      `📲 Cliquez sur ce lien pour créer votre compte :\n${link}\n\n` +
      `⏰ Ce lien est valable 7 jours.`;

    const waUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(waUrl);
    if (canOpen) {
      await Linking.openURL(waUrl);
    } else {
      // Fallback: partage natif
      await Share.share({ message });
    }
  }

  async function handleCopy() {
    try {
      await ExpoClipboard.setStringAsync(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await Share.share({ message: link });
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.icon}>👤</Text>
          <Text style={styles.title}>Inviter un bénéficiaire</Text>
          <Text style={styles.subtitle}>
            Générez un lien unique (valable 7 jours) et partagez-le via WhatsApp avec votre bénéficiaire.
          </Text>
        </View>

        {/* Étapes */}
        <View style={styles.stepsCard}>
          {[
            { num: '1', text: 'Générez le lien d\'invitation' },
            { num: '2', text: 'Partagez via WhatsApp' },
            { num: '3', text: 'Le bénéficiaire crée son compte' },
            { num: '4', text: 'Créez une allocation pour lui' },
          ].map(s => (
            <View key={s.num} style={styles.step}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.num}</Text></View>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>

        {/* Bouton générer */}
        <TouchableOpacity
          style={[styles.generateBtn, loading && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.generateBtnText}>🔗 Générer le lien d'invitation</Text>
          }
        </TouchableOpacity>

        {/* Résultat */}
        {link ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>✅ Lien prêt à partager</Text>

            {/* WhatsApp — action principale */}
            <TouchableOpacity style={styles.waBtn} onPress={shareWhatsApp} activeOpacity={0.85}>
              <Text style={styles.waBtnText}>💬 Partager via WhatsApp</Text>
            </TouchableOpacity>

            {/* Copier */}
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.85}>
              <Text style={styles.copyBtnText}>{copied ? '✅ Copié !' : '📋 Copier le lien'}</Text>
            </TouchableOpacity>

            {/* Token affiché discrètement */}
            <View style={styles.tokenBox}>
              <Text style={styles.tokenLabel}>Token :</Text>
              <Text style={styles.tokenValue} numberOfLines={1} ellipsizeMode="middle">{token}</Text>
            </View>

            {/* Nouveau lien */}
            <TouchableOpacity onPress={handleGenerate} style={styles.renewLink}>
              <Text style={styles.renewLinkText}>🔄 Générer un nouveau lien</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  scroll:         { padding: 20, paddingBottom: 40 },
  header:         { alignItems: 'center', marginBottom: 24, marginTop: 12 },
  icon:           { fontSize: 48, marginBottom: 12 },
  title:          { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle:       { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  stepsCard:      { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20, gap: 12 },
  step:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum:        { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepNumText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  stepText:       { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  generateBtn:    { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', ...Shadow.sm },
  btnDisabled:    { opacity: 0.6 },
  generateBtnText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  resultCard:     { marginTop: 20, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  resultTitle:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  waBtn:          { backgroundColor: '#25D366', borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  waBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  copyBtn:        { backgroundColor: Colors.bg, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  copyBtnText:    { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  tokenBox:       { flexDirection: 'row', gap: 6, backgroundColor: Colors.bg, borderRadius: Radius.sm, padding: 8, borderWidth: 1, borderColor: Colors.border },
  tokenLabel:     { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  tokenValue:     { flex: 1, fontSize: 11, color: Colors.textSecondary, fontFamily: 'monospace' },
  renewLink:      { alignItems: 'center', paddingVertical: 4 },
  renewLinkText:  { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
