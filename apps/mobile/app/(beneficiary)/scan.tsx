import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, Platform } from 'react-native';
import { api } from '../../src/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'Général', PHARMACY: 'Pharmacie', FOOD: 'Alimentation',
  CLOTHING: 'Habillement', EDUCATION: 'Éducation', LEISURE: 'Loisirs',
};

type Preview = {
  merchantName: string;
  category: string;
  amount: number;
  remainingAfter: number;
  requiresApproval: boolean;
};

export default function ScanScreen() {
  const qc = useQueryClient();
  const [token, setToken]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [preview, setPreview]     = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult]       = useState<{ ok: boolean; message: string } | null>(null);
  const [scanned, setScanned]     = useState(false);

  // ── Preview (valider le QR sans débiter) ─────────────────────────────
  const handlePreview = async (tok: string) => {
    if (!tok.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/mobile/beneficiary/pay/preview', { token: tok.trim() });
      setPreview(res.data);
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'QR code invalide ou expiré';
      setResult({ ok: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  // ── Confirmer le paiement ─────────────────────────────────────────────
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await api.post('/mobile/beneficiary/pay/confirm', { token: token.trim() });
      qc.invalidateQueries({ queryKey: ['beneficiary-allocations'] });
      setPreview(null);
      setResult({ ok: true, message: res.data.message ?? 'Paiement effectué ✅' });
      setToken('');
      setScanned(false);
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Paiement refusé';
      setPreview(null);
      setResult({ ok: false, message: msg });
    } finally {
      setConfirming(false);
    }
  };

  // ── Caméra (native seulement) ─────────────────────────────────────────
  const renderCamera = () => {
    if (Platform.OS === 'web') return null;
    try {
      const { CameraView, useCameraPermissions } = require('expo-camera');
      return <CameraHook
        onScan={(tok: string) => { setToken(tok); handlePreview(tok); }}
        scanned={scanned}
        setScanned={setScanned}
      />;
    } catch { return null; }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💳 Payer chez un marchand</Text>

      {/* Sur web ou en fallback : saisie manuelle du token */}
      {Platform.OS === 'web' && (
        <View style={styles.webSection}>
          <Text style={styles.label}>Token du QR marchand</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Coller le token ici..."
              value={token}
              onChangeText={setToken}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.scanBtn, (!token.trim() || loading) && { opacity: 0.4 }]}
              onPress={() => handlePreview(token)}
              disabled={!token.trim() || loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.scanBtnText}>Valider</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Récupérez le token depuis l'écran du marchand</Text>
        </View>
      )}

      {/* Caméra native */}
      {Platform.OS !== 'web' && renderCamera()}

      {/* Modal aperçu paiement */}
      <Modal visible={!!preview} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Confirmer le paiement</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Marchand</Text>
              <Text style={styles.detailValue}>{preview?.merchantName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Catégorie</Text>
              <Text style={styles.detailValue}>{CATEGORY_LABELS[preview?.category ?? ''] ?? preview?.category}</Text>
            </View>
            <View style={[styles.detailRow, styles.amountRow]}>
              <Text style={styles.detailLabel}>Montant</Text>
              <Text style={styles.amountText}>{preview?.amount?.toFixed(2)} MAD</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Solde après</Text>
              <Text style={[styles.detailValue, (preview?.remainingAfter ?? 0) < 50 && { color: '#ef4444' }]}>
                {preview?.remainingAfter?.toFixed(2)} MAD
              </Text>
            </View>

            {preview?.requiresApproval && (
              <View style={styles.approvalBanner}>
                <Text style={styles.approvalText}>⏳ Ce paiement nécessite l'approbation de votre sponsor</Text>
              </View>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setPreview(null); setScanned(false); }}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={confirming}>
                {confirming
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal résultat */}
      <Modal visible={!!result} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.resultIcon}>{result?.ok ? '✅' : '❌'}</Text>
            <Text style={styles.resultMsg}>{result?.message}</Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setResult(null)}>
              <Text style={styles.confirmBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Composant caméra séparé pour éviter les erreurs web
function CameraHook({ onScan, scanned, setScanned }: { onScan: (t: string) => void; scanned: boolean; setScanned: (v: boolean) => void }) {
  const { CameraView, useCameraPermissions } = require('expo-camera');
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Accès caméra requis</Text>
        <TouchableOpacity style={styles.confirmBtn} onPress={requestPermission}>
          <Text style={styles.confirmBtnText}>Autoriser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <CameraView
      style={styles.camera}
      facing="back"
      onBarcodeScanned={scanned ? undefined : ({ data }: { data: string }) => { setScanned(true); onScan(data); }}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
    >
      <View style={styles.cameraOverlay}>
        <View style={styles.frame} />
        <Text style={styles.cameraHint}>Pointez vers le QR code du marchand</Text>
      </View>
    </CameraView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bg, padding: 20 },
  title:         { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 24, marginTop: 48 },
  label:         { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  webSection:    { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 20, borderWidth: 1, borderColor: Colors.border },
  inputRow:      { flexDirection: 'row', gap: 8 },
  input:         { flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary },
  scanBtn:       { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 16, justifyContent: 'center' },
  scanBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint:          { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
  camera:        { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frame:         { width: 240, height: 240, borderWidth: 2, borderColor: '#fff', borderRadius: 16 },
  cameraHint:    { color: '#fff', marginTop: 24, fontSize: 14 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permText:      { fontSize: 16, marginBottom: 16, color: Colors.textPrimary },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:         { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  amountRow:     { borderBottomWidth: 0 },
  detailLabel:   { fontSize: 13, color: Colors.textSecondary },
  detailValue:   { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  amountText:    { fontSize: 24, fontWeight: '800', color: Colors.primary },
  approvalBanner:{ backgroundColor: '#fef3c7', borderRadius: Radius.md, padding: 12, marginTop: 4 },
  approvalText:  { fontSize: 13, color: '#92400e', textAlign: 'center' },
  modalBtns:     { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:     { flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn:    { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  resultIcon:    { fontSize: 52, textAlign: 'center', marginBottom: 8 },
  resultMsg:     { fontSize: 16, color: Colors.textPrimary, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
});
