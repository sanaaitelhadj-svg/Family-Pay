import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '../../src/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const queryClient = useQueryClient();

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Accès à la caméra requis</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Autoriser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleScan({ data: token }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    try {
      const res = await api.post('/transactions/pay', { token });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-allocations'] });
      Alert.alert('Paiement accepté', `${res.data.amount} MAD`, [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
    } catch (e: any) {
      const reason = e.response?.data?.error ?? 'Paiement refusé';
      Alert.alert('Refusé', reason, [{ text: 'Réessayer', onPress: () => setScanned(false) }]);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" onBarcodeScanned={scanned ? undefined : handleScan} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}>
        <View style={styles.overlay}>
          <View style={styles.frame} />
          <Text style={styles.hint}>Pointez vers le QR code du marchand</Text>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frame: { width: 240, height: 240, borderWidth: 2, borderColor: '#fff', borderRadius: 16 },
  hint: { color: '#fff', marginTop: 24, fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permText: { fontSize: 16, marginBottom: 16 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 14, paddingHorizontal: 28 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
