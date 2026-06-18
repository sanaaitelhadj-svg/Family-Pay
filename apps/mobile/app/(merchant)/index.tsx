import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Share, RefreshControl, Alert, Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Radius, Shadow } from '../../src/constants/theme';
import { useAuthStore } from '../../src/lib/auth-store';
import { apiClient } from '../../src/lib/api';

type MerchantStats = {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayCount: number;
  merchant: { id: string; businessName?: string; category: string; user: { firstName: string; lastName: string } };
};

export default function MerchantHomeScreen() {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [showQR, setShowQR] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery<MerchantStats>({
    queryKey: ['merchant-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/mobile/merchant/stats');
      return res.data;
    },
  });

  const merchantId = data?.merchant?.id ?? '';
  const businessName = data?.merchant?.businessName
    ?? `${data?.merchant?.user?.firstName ?? ''} ${data?.merchant?.user?.lastName ?? ''}`.trim();

  const qrData = JSON.stringify({
    type: 'FAMILYPAY_MERCHANT',
    merchantId,
    name: businessName,
    amount: amount ? parseFloat(amount) : undefined,
  });

  const [qrToken, setQrToken] = useState('');

  const handleGenerate = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return;
    try {
      const res = await apiClient.post('/mobile/merchant/qr/generate', {
        category: data?.merchant?.category ?? 'GENERAL',
        amount: parseFloat(amount),
      });
      setQrToken(res.data.token ?? JSON.stringify(res.data));
      setShowQR(true);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error ?? 'Impossible de générer le QR');
    }
  };

  const handleShare = async () => {
    await Share.share({ message: `FamilyPay Token: ${qrToken}` });
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Tableau de bord</Text>
          <Text style={styles.shopName}>{businessName || 'Mon commerce'}</Text>
        </View>
        <View style={styles.onlineDot} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{(data?.todayRevenue ?? 0).toLocaleString('fr-MA')}</Text>
          <Text style={styles.statLabel}>MAD aujourd'hui</Text>
          <Text style={styles.statSub}>{data?.todayCount ?? 0} transactions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{(data?.weekRevenue ?? 0).toLocaleString('fr-MA')}</Text>
          <Text style={styles.statLabel}>MAD cette semaine</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{(data?.monthRevenue ?? 0).toLocaleString('fr-MA')}</Text>
          <Text style={styles.statLabel}>MAD ce mois</Text>
        </View>
      </View>

      {/* QR Generator */}
      <View style={styles.qrSection}>
        <Text style={styles.qrTitle}>💳 Encaisser un paiement</Text>

        {!showQR ? (
          <>
            <Text style={styles.qrSub}>Saisissez le montant à encaisser</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleGenerate}
              />
              <Text style={styles.currency}>MAD</Text>
            </View>
            <TouchableOpacity
              style={[styles.generateBtn, (!amount || parseFloat(amount) <= 0) && styles.generateBtnDisabled]}
              onPress={handleGenerate}
              activeOpacity={0.85}
            >
              <Text style={styles.generateBtnText}>Générer le QR Code</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrToken || qrData}
                size={200}
                color={Colors.textPrimary}
                backgroundColor="#fff"
              />
            </View>
            <Text style={styles.qrAmount}>{parseFloat(amount).toLocaleString('fr-MA')} MAD</Text>
            <Text style={styles.qrHint}>Le bénéficiaire scanne ce code pour valider le paiement</Text>
            {Platform.OS === 'web' && (
              <View style={{ width: '100%', backgroundColor: Colors.bg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border }}>
                <Text selectable style={{ fontSize: 10, color: Colors.textMuted, fontFamily: 'monospace', textAlign: 'center' }}>
                  {qrToken}
                </Text>
              </View>
            )}

            <View style={styles.qrActions}>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Text style={styles.shareBtnText}>📤 Partager</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetBtn} onPress={() => { setShowQR(false); setAmount(''); }}>
                <Text style={styles.resetBtnText}>Nouveau montant</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Quick tip */}
      <View style={styles.tipBanner}>
        <Text style={styles.tipIcon}>💡</Text>
        <Text style={styles.tipText}>
          Seuls les bénéficiaires ayant une allocation dans votre catégorie peuvent payer ici.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: Colors.bg },
  center:              { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 },
  greeting:            { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  shopName:            { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5, marginTop: 2 },
  onlineDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success, marginTop: 10 },
  statsRow:            { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 },
  statCard:            { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statNum:             { fontSize: 16, fontWeight: '800', color: Colors.primary, letterSpacing: -0.3 },
  statLabel:           { fontSize: 10, color: Colors.textSecondary, marginTop: 3, textAlign: 'center', fontWeight: '500' },
  statSub:             { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  qrSection:           { marginHorizontal: 16, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  qrTitle:             { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.2 },
  qrSub:               { fontSize: 13, color: Colors.textSecondary },
  amountRow:           { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, overflow: 'hidden', width: '100%' },
  amountInput:         { flex: 1, fontSize: 32, fontWeight: '800', color: Colors.textPrimary, padding: 16, textAlign: 'center', letterSpacing: -0.5 },
  currency:            { paddingRight: 18, fontSize: 16, fontWeight: '700', color: Colors.primary },
  generateBtn:         { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  generateBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  generateBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  qrWrapper:           { backgroundColor: '#fff', padding: 20, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  qrAmount:            { fontSize: 30, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  qrHint:              { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  qrActions:           { flexDirection: 'row', gap: 10, width: '100%' },
  shareBtn:            { flex: 1, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(91,61,245,0.15)' },
  shareBtnText:        { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  resetBtn:            { flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  resetBtnText:        { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  tipBanner:           { marginHorizontal: 16, backgroundColor: Colors.warningBg, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.warningBorder },
  tipIcon:             { fontSize: 16 },
  tipText:             { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
