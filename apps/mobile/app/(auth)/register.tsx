import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '../../src/constants/theme';

const ROLES = [
  { key: 'sponsor',     label: 'Sponsor',       icon: '💼', desc: 'Je finance les dépenses de mes proches', color: Colors.primary },
  { key: 'beneficiary', label: 'Bénéficiaire',  icon: '👤', desc: 'Je reçois et utilise des allocations',   color: '#22C55E' },
  { key: 'merchant',    label: 'Marchand',       icon: '🏪', desc: "J'accepte les paiements FamilyPay",     color: '#F59E0B' },
] as const;

export default function RegisterScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Choisissez votre profil</Text>

        <View style={styles.cards}>
          {ROLES.map(r => (
            <TouchableOpacity
              key={r.key}
              style={[styles.card, { borderColor: r.color }]}
              onPress={() => router.push(`/(auth)/register-${r.key}` as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.cardIcon}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { color: r.color }]}>{r.label}</Text>
                <Text style={styles.cardDesc}>{r.desc}</Text>
              </View>
              <Text style={[styles.chevron, { color: r.color }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.legal}>
          En créant un compte vous acceptez les{' '}
          <Text style={styles.legalLink}>CGU FamilyPay</Text>
          {' '}et consentez au traitement de vos données conformément à la{' '}
          <Text style={styles.legalLink}>loi CNDP 09-08</Text>.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: 24, marginTop: 8 },
  backArrow: { fontSize: 18, color: Colors.textPrimary },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 28 },
  cards: { gap: 14 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5 },
  cardIcon: { fontSize: 32 },
  cardLabel: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  cardDesc: { fontSize: 12, color: Colors.textSecondary },
  chevron: { fontSize: 24, fontWeight: '300' },
  legal: { marginTop: 'auto', paddingTop: 24, fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 17 },
  legalLink: { color: Colors.primary, fontWeight: '600' },
});
