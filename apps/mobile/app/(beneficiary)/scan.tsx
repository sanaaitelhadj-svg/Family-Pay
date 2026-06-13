import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Platform, Dimensions,
} from 'react-native';
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

const W = Dimensions.get('window').width;
const FRAME = Math.min(W * 0.65, 260);

export default function ScanScreen() {
  const qc = useQueryClient();
  const [mode, setMode]           = useState<'camera' | 'manual'>(Platform.OS === 'web' ? 'camera' : 'camera');
  const [token, setToken]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [preview, setPreview]     = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult]       = useState<{ ok: boolean; message: string } | null>(null);
  const [scanned, setScanned]     = useState(false);

  const handlePreview = async (tok: string) => {
    if (!tok.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/mobile/beneficiary/pay/preview', { token: tok.trim() });
      setPreview(res.data);
    } catch (e: any) {
      setResult({ ok: false, message: e.response?.data?.message ?? 'QR code invalide ou expiré' });
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await api.post('/mobile/beneficiary/pay/confirm', { token: token.trim() });
      qc.invalidateQueries({ queryKey: ['beneficiary-allocations'] });
      setPreview(null);
      setResult({ ok: true, message: res.data.message ?? 'Paiement effectué ✅' });
      setToken(''); setScanned(false);
    } catch (e: any) {
      setPreview(null);
      setResult({ ok: false, message: e.response?.data?.message ?? 'Paiement refusé' });
    } finally { setConfirming(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💳 Payer chez un marchand</Text>

      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity style={[styles.toggleBtn, mode === 'camera' && styles.toggleActive]} onPress={() => { setMode('camera'); setScanned(false); }}>
          <Text style={[styles.toggleText, mode === 'camera' && styles.toggleTextActive]}>📷 Scanner</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, mode === 'manual' && styles.toggleActive]} onPress={() => setMode('manual')}>
          <Text style={[styles.toggleText, mode === 'manual' && styles.toggleTextActive]}>⌨️ Token manuel</Text>
        </TouchableOpacity>
      </View>

      {/* ── Mode Caméra ── */}
      {mode === 'camera' && (
        Platform.OS === 'web'
          ? <WebQRScanner onScan={(tok) => { setToken(tok); setScanned(true); handlePreview(tok); }} scanned={scanned} />
          : <NativeQRScanner onScan={(tok) => { setToken(tok); setScanned(true); handlePreview(tok); }} scanned={scanned} setScanned={setScanned} />
      )}

      {/* ── Mode Manuel ── */}
      {mode === 'manual' && (
        <View style={styles.manualSection}>
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
          <Text style={styles.hint}>Copiez le token affiché sous le QR du marchand</Text>
        </View>
      )}

      {/* Modal preview */}
      <Modal visible={!!preview} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Confirmer le paiement</Text>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Marchand</Text><Text style={styles.detailValue}>{preview?.merchantName}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Catégorie</Text><Text style={styles.detailValue}>{CATEGORY_LABELS[preview?.category ?? ''] ?? preview?.category}</Text></View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}><Text style={styles.detailLabel}>Montant</Text><Text style={styles.amountText}>{preview?.amount?.toFixed(2)} MAD</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Solde après</Text><Text style={[styles.detailValue, (preview?.remainingAfter ?? 0) < 50 && { color: '#ef4444' }]}>{preview?.remainingAfter?.toFixed(2)} MAD</Text></View>
            {preview?.requiresApproval && (
              <View style={styles.approvalBanner}><Text style={styles.approvalText}>⏳ Ce paiement nécessite l'approbation de votre sponsor</Text></View>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setPreview(null); setScanned(false); }}><Text style={styles.cancelBtnText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={confirming}>
                {confirming ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Confirmer</Text>}
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
            <TouchableOpacity style={styles.confirmBtn} onPress={() => { setResult(null); setScanned(false); }}><Text style={styles.confirmBtnText}>OK</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Scanner Web (HTML5 BarcodeDetector / video) ───────────────────────────
function WebQRScanner({ onScan, scanned }: { onScan: (t: string) => void; scanned: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError]     = useState('');
  const [active, setActive]   = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf: number;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); setActive(true); }

        // @ts-ignore
        if ('BarcodeDetector' in window) {
          // @ts-ignore
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const scan = async () => {
            if (scanned || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) { onScan(codes[0].rawValue); return; }
            } catch {}
            raf = requestAnimationFrame(scan);
          };
          raf = requestAnimationFrame(scan);
        } else {
          setError('Votre navigateur ne supporte pas le scan QR. Utilisez le mode Token manuel.');
        }
      } catch {
        setError('Accès caméra refusé. Autorisez la caméra ou utilisez le mode Token manuel.');
      }
    };

    start();
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [scanned]);

  if (error) return (
    <View style={styles.cameraBox}>
      <Text style={{ color: Colors.textSecondary, textAlign: 'center', padding: 24 }}>{error}</Text>
    </View>
  );

  return (
    <View style={styles.cameraBox}>
      {/* @ts-ignore */}
      <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} muted playsInline />
      {/* Cadre style WhatsApp */}
      <View style={styles.frameOverlay}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        {scanned
          ? <Text style={styles.scanHint}>✅ QR détecté</Text>
          : <Text style={styles.scanHint}>Pointez vers le QR code du marchand</Text>
        }
      </View>
    </View>
  );
}

// ── Scanner Natif (expo-camera) ───────────────────────────────────────────
function NativeQRScanner({ onScan, scanned, setScanned }: { onScan: (t: string) => void; scanned: boolean; setScanned: (v: boolean) => void }) {
  try {
    const { CameraView, useCameraPermissions } = require('expo-camera');
    const [permission, requestPermission] = useCameraPermissions();

    if (!permission) return <View />;
    if (!permission.granted) return (
      <View style={styles.cameraBox}>
        <Text style={{ color: Colors.textSecondary, marginBottom: 16 }}>Accès caméra requis</Text>
        <TouchableOpacity style={styles.confirmBtn} onPress={requestPermission}><Text style={styles.confirmBtnText}>Autoriser</Text></TouchableOpacity>
      </View>
    );

    return (
      <View style={styles.cameraBox}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanned ? undefined : ({ data }: { data: string }) => { setScanned(true); onScan(data); }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.frameOverlay}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          {scanned
            ? <Text style={styles.scanHintDark}>✅ QR détecté</Text>
            : <Text style={styles.scanHintDark}>Pointez vers le QR code du marchand</Text>
          }
        </View>
        {scanned && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText}>🔄 Scanner à nouveau</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  } catch { return null; }
}

const CORNER = 20;
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg, padding: 16 },
  title:          { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16, marginTop: 48 },
  toggleRow:      { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.full, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  toggleBtn:      { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: Radius.full },
  toggleActive:   { backgroundColor: Colors.primary },
  toggleText:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  cameraBox:      { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  frameOverlay:   { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  frame:          { width: FRAME, height: FRAME, position: 'relative' },
  corner:         { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff', borderWidth: 3 },
  cornerTL:       { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR:       { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL:       { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR:       { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHint:       { color: '#fff', marginTop: FRAME / 2 + 24, fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  scanHintDark:   { color: '#fff', marginTop: FRAME / 2 + 24, fontSize: 13, fontWeight: '600' },
  rescanBtn:      { position: 'absolute', bottom: 24, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10 },
  rescanText:     { color: '#fff', fontWeight: '700' },
  manualSection:  { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 20, borderWidth: 1, borderColor: Colors.border },
  label:          { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  inputRow:       { flexDirection: 'row', gap: 8 },
  input:          { flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary },
  scanBtn:        { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 16, justifyContent: 'center' },
  scanBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint:           { fontSize: 11, color: Colors.textMuted, marginTop: 8 },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal:          { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle:     { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  detailRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel:    { fontSize: 13, color: Colors.textSecondary },
  detailValue:    { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  amountText:     { fontSize: 24, fontWeight: '800', color: Colors.primary },
  approvalBanner: { backgroundColor: '#fef3c7', borderRadius: Radius.md, padding: 12 },
  approvalText:   { fontSize: 13, color: '#92400e', textAlign: 'center' },
  modalBtns:      { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:      { flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelBtnText:  { color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn:     { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resultIcon:     { fontSize: 52, textAlign: 'center', marginBottom: 8 },
  resultMsg:      { fontSize: 16, color: Colors.textPrimary, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
});
