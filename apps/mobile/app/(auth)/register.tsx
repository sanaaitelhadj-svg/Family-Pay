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
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: 24 },
  backBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: 28, marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  backArrow: { fontSize: 18, color: Colors.textPrimary, fontWeight: '600' },
  title:     { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6, letterSpacing: -0.5 },
  subtitle:  { fontSize: 15, color: Colors.textSecondary, marginBottom: 32, lineHeight: 22 },
  cards:     { gap: 14 },
  card:      { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardIcon:  { fontSize: 34 },
  cardLabel: { fontSize: 17, fontWeight: '700', marginBottom: 3 },
  cardDesc:  { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  chevron:   { fontSize: 26, fontWeight: '300', color: Colors.textMuted },
  legal:     { marginTop: 'auto', paddingTop: 24, fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  legalLink: { color: Colors.primary, fontWeight: '600' },
});
