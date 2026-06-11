import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator, Modal, TextInput,
  RefreshControl, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Radius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/lib/auth-store';
import { apiClient } from '../../src/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: '🍔 Alimentation', TRANSPORT: '🚌 Transport', HEALTH: '💊 Santé',
  EDUCATION: '📚 Éducation', CLOTHING: '👕 Habillement', OTHER: '📦 Autre', GENERAL: '🏪 Général',
};

const KYC_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_PSP: { label: 'En attente KYC', color: '#D97706', bg: '#FEF3C7' },
  APPROVED:    { label: 'KYC Approuvé',   color: '#059669', bg: '#D1FAE5' },
  REJECTED:    { label: 'KYC Rejeté',     color: '#DC2626', bg: '#FEE2E2' },
};

const ACTIVATION_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'En attente',  color: '#D97706', bg: '#FEF3C7' },
  ACTIVE:    { label: 'Actif',       color: '#059669', bg: '#D1FAE5' },
  INACTIVE:  { label: 'Inactif',     color: '#6B7280', bg: '#F3F4F6' },
  SUSPENDED: { label: 'Suspendu',    color: '#DC2626', bg: '#FEE2E2' },
};

type Contact = { firstName?: string; lastName?: string; name?: string; phone?: string; email?: string } | null;

type MerchantProfile = {
  id: string; businessName: string; category: string; city: string; address: string;
  phone: string; email?: string; kycStatus: string; activationStatus: string;
  registrationNumber?: string; iceNumber?: string; taxId?: string; fiscalId?: string; cinRepresentant?: string;
  rib?: string; iban?: string; contractUrl?: string; commissionType?: string; commissionRate?: number; cguSignedAt?: string;
  contactAdmin?: Contact; contactFinance?: Contact;
  user: { firstName: string; lastName: string; phone: string; email?: string; createdAt: string };
  _count: { transactions: number }; totalRevenue: number;
  pendingChangeRequest?: { id: string; status: string; createdAt: string } | null;
  lastChangeRequest?: { id: string; status: string; reason?: string; createdAt: string } | null;
};

type EditForm = {
  businessName: string; address: string; city: string; phone: string; email: string;
  registrationNumber: string; iceNumber: string; taxId: string; rib: string; iban: string;
  contactAdminFirstName: string; contactAdminLastName: string; contactAdminPhone: string; contactAdminEmail: string;
  contactFinanceFirstName: string; contactFinanceLastName: string; contactFinancePhone: string; contactFinanceEmail: string;
};

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

const ContactBlock = ({ label, contact }: { label: string; contact?: Contact }) => {
  if (!contact) return null;
  const name = (contact as any).firstName && (contact as any).lastName
    ? `${(contact as any).firstName} ${(contact as any).lastName}`
    : (contact as any).name;
  if (!name && !contact.phone && !contact.email) return null;
  return (
    <View style={styles.contactBlock}>
      <Text style={styles.contactRole}>{label}</Text>
      {name         && <Text style={styles.contactName}>{name}</Text>}
      {contact.phone && <Text style={styles.contactDetail}>📞 {contact.phone}</Text>}
      {contact.email && <Text style={styles.contactDetail}>✉️ {contact.email}</Text>}
    </View>
  );
};

export default function MerchantProfileScreen() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const [notif, setNotif] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    businessName: '', address: '', city: '', phone: '', email: '',
    registrationNumber: '', iceNumber: '', taxId: '', rib: '', iban: '',
    contactAdminFirstName: '', contactAdminLastName: '', contactAdminPhone: '', contactAdminEmail: '',
    contactFinanceFirstName: '', contactFinanceLastName: '', contactFinancePhone: '', contactFinanceEmail: '',
  });

  const { data, isLoading, refetch, isRefetching } = useQuery<MerchantProfile>({
    queryKey: ['merchant-profile'],
    queryFn: async () => { const res = await apiClient.get('/mobile/merchant/profile'); return res.data; },
  });

  const openEdit = () => {
    if (!data) return;
    setEditForm({
      businessName: data.businessName ?? '', address: data.address ?? '', city: data.city ?? '',
      phone: data.phone ?? '', email: data.email ?? '',
      registrationNumber: data.registrationNumber ?? '', iceNumber: data.iceNumber ?? '', taxId: data.taxId ?? '',
      rib: data.rib ?? '', iban: data.iban ?? '',
      contactAdminFirstName: (data.contactAdmin as any)?.firstName ?? (data.contactAdmin as any)?.name ?? '',
      contactAdminLastName:  (data.contactAdmin as any)?.lastName ?? '',
      contactAdminPhone:     (data.contactAdmin as any)?.phone ?? '',
      contactAdminEmail:     (data.contactAdmin as any)?.email ?? '',
      contactFinanceFirstName: (data.contactFinance as any)?.firstName ?? (data.contactFinance as any)?.name ?? '',
      contactFinanceLastName:  (data.contactFinance as any)?.lastName ?? '',
      contactFinancePhone:     (data.contactFinance as any)?.phone ?? '',
      contactFinanceEmail:     (data.contactFinance as any)?.email ?? '',
    });
    setShowEdit(true);
  };

  const submitRequest = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      if (!data) return;
      if (editForm.businessName !== data.businessName) payload.businessName = editForm.businessName;
      if (editForm.address !== data.address) payload.address = editForm.address;
      if (editForm.city !== data.city) payload.city = editForm.city;
      if (editForm.phone !== data.phone) payload.phone = editForm.phone;
      if (editForm.email !== (data.email ?? '')) payload.email = editForm.email;
      if (editForm.registrationNumber !== (data.registrationNumber ?? '')) payload.registrationNumber = editForm.registrationNumber;
      if (editForm.iceNumber !== (data.iceNumber ?? '')) payload.iceNumber = editForm.iceNumber;
      if (editForm.taxId !== (data.taxId ?? '')) payload.taxId = editForm.taxId;
      if (editForm.rib !== (data.rib ?? '')) payload.rib = editForm.rib;
      if (editForm.iban !== (data.iban ?? '')) payload.iban = editForm.iban;
      const adminChanged = editForm.contactAdminFirstName !== ((data.contactAdmin as any)?.firstName ?? '') ||
        editForm.contactAdminLastName !== ((data.contactAdmin as any)?.lastName ?? '') ||
        editForm.contactAdminPhone !== ((data.contactAdmin as any)?.phone ?? '') ||
        editForm.contactAdminEmail !== ((data.contactAdmin as any)?.email ?? '');
      if (adminChanged) payload.contactAdmin = { firstName: editForm.contactAdminFirstName, lastName: editForm.contactAdminLastName, phone: editForm.contactAdminPhone, email: editForm.contactAdminEmail };
      const financeChanged = editForm.contactFinanceFirstName !== ((data.contactFinance as any)?.firstName ?? '') ||
        editForm.contactFinanceLastName !== ((data.contactFinance as any)?.lastName ?? '') ||
        editForm.contactFinancePhone !== ((data.contactFinance as any)?.phone ?? '') ||
        editForm.contactFinanceEmail !== ((data.contactFinance as any)?.email ?? '');
      if (financeChanged) payload.contactFinance = { firstName: editForm.contactFinanceFirstName, lastName: editForm.contactFinanceLastName, phone: editForm.contactFinancePhone, email: editForm.contactFinanceEmail };
      if (Object.keys(payload).length === 0) throw new Error('Aucune modification détectée.');
      const res = await apiClient.post('/mobile/merchant/change-request', payload);
      return res.data;
    },
    onSuccess: () => {
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ['merchant-profile'] });
      if (Platform.OS === 'web') window.alert("Demande envoyée. En attente de validation par l'administrateur.");
      else Alert.alert('✅ Demande envoyée', "Vos modifications sont en attente de validation par l'administrateur.");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erreur';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Erreur', msg);
    },
  });

  const handleLogout = async () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Voulez-vous vraiment vous déconnecter ?')
      : await new Promise<boolean>(resolve => Alert.alert('Déconnexion', 'Confirmation', [
          { text: 'Annuler', onPress: () => resolve(false) },
          { text: 'Déconnecter', style: 'destructive', onPress: () => resolve(true) }]));
    if (!confirmed) return;
    await clearAuth();
    if (Platform.OS === 'web') (window as any).location.href = '/'; else router.replace('/(auth)');
  };

  if (isLoading || !data) return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  const kyc = KYC_STATUS[data.kycStatus] ?? KYC_STATUS['PENDING_PSP'];
  const act = ACTIVATION_STATUS[data.activationStatus] ?? ACTIVATION_STATUS['INACTIVE'];
  const initials = `${data.user.firstName[0] ?? ''}`.toUpperCase();
  const memberSince = new Date(data.user.createdAt).toLocaleDateString('fr-MA', { year: 'numeric', month: 'long' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}>

      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <Text style={styles.name}>{data.businessName}</Text>
        <Text style={styles.sub}>{CATEGORY_LABELS[data.category] ?? data.category}</Text>
        <Text style={styles.sub}>{data.city}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: kyc.bg }]}><Text style={[styles.badgeText, { color: kyc.color }]}>{kyc.label}</Text></View>
          <View style={[styles.badge, { backgroundColor: act.bg }]}><Text style={[styles.badgeText, { color: act.color }]}>{act.label}</Text></View>
        </View>
        <View style={styles.memberBadge}><Text style={styles.memberText}>Membre depuis {memberSince}</Text></View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data.totalRevenue.toLocaleString('fr-MA')}</Text>
          <Text style={styles.statLabel}>MAD encaissés</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#F59E0B', borderWidth: 1.5 }]}>
          <Text style={[styles.statNum, { color: '#F59E0B' }]}>{data._count.transactions}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
      </View>

      {data.lastChangeRequest && data.lastChangeRequest.status === 'PENDING' && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingIcon}>⏳</Text>
          <Text style={styles.pendingText}>Une demande de modification est en attente de validation par l'administrateur.</Text>
        </View>
      )}
      {data.lastChangeRequest && data.lastChangeRequest.status === 'APPROVED' && (
        <View style={[styles.pendingBanner, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
          <Text style={styles.pendingIcon}>✅</Text>
          <Text style={[styles.pendingText, { color: '#065F46' }]}>Votre demande de modification a été approuvée et appliquée.</Text>
        </View>
      )}
      {data.lastChangeRequest && data.lastChangeRequest.status === 'REJECTED' && (
        <View style={[styles.pendingBanner, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
          <Text style={styles.pendingIcon}>❌</Text>
          <Text style={[styles.pendingText, { color: '#991B1B' }]}>
            Votre demande de modification a été refusée.{data.lastChangeRequest.reason ? ` Motif : ${data.lastChangeRequest.reason}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏪 Informations générales</Text>
        <InfoRow label="Nom du commerce" value={data.businessName} />
        <InfoRow label="Catégorie" value={CATEGORY_LABELS[data.category] ?? data.category} />
        <InfoRow label="Ville" value={data.city} />
        <InfoRow label="Adresse" value={data.address} />
        <InfoRow label="Téléphone" value={data.phone} />
        <InfoRow label="Email" value={data.email} />
      </View>

      {(data.registrationNumber || data.iceNumber || data.taxId || data.fiscalId || data.cinRepresentant) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Informations légales</Text>
          <InfoRow label="N° RC" value={data.registrationNumber} />
          <InfoRow label="ICE" value={data.iceNumber} />
          <InfoRow label="Identifiant fiscal" value={data.taxId} />
          <InfoRow label="Fiscal ID" value={data.fiscalId} />
          <InfoRow label="CIN Représentant" value={data.cinRepresentant} />
        </View>
      )}

      {(data.rib || data.iban) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏦 Informations bancaires</Text>
          <InfoRow label="RIB" value={data.rib} />
          <InfoRow label="IBAN" value={data.iban} />
        </View>
      )}

      {(data.contactAdmin || data.contactFinance) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Contacts</Text>
          <ContactBlock label="Administratif" contact={data.contactAdmin} />
          <ContactBlock label="Finance" contact={data.contactFinance} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📄 Contrat & Conformité</Text>
        <InfoRow label="Statut KYC" value={kyc.label} />
        <InfoRow label="Statut compte" value={act.label} />
        {data.commissionType && <InfoRow label="Type commission" value={data.commissionType} />}
        {data.commissionRate != null && <InfoRow label="Taux" value={`${data.commissionRate}%`} />}
        {data.contractUrl && <InfoRow label="Contrat" value="✅ Signé" />}
        {data.cguSignedAt && <InfoRow label="CGU signées le" value={new Date(data.cguSignedAt).toLocaleDateString('fr-MA')} />}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Alertes de paiement</Text>
            <Text style={styles.switchSub}>Recevoir les confirmations de transaction</Text>
          </View>
          <Switch value={notif} onValueChange={setNotif} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="#fff" />
        </View>
      </View>

      <TouchableOpacity style={[styles.editBtn, !!data.pendingChangeRequest && styles.editBtnDisabled]}
        onPress={openEdit} disabled={!!data.pendingChangeRequest} activeOpacity={0.85}>
        <Text style={styles.editBtnText}>
          {data.pendingChangeRequest ? '⏳ Modification en cours de validation' : '✏️ Demander une modification'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>
      <Text style={styles.version}>FamilyPay v1.0.0 — © ALTIVAX 2026</Text>

      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Demande de modification</Text>
            <TouchableOpacity onPress={() => setShowEdit(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.modalWarn}>
              <Text style={styles.modalWarnText}>Les modifications seront soumises à l'approbation de l'administrateur avant d'être appliquées.</Text>
            </View>

            <Text style={styles.groupLabel}>🏪 Informations générales</Text>
            <Text style={styles.fieldLabel}>Nom du commerce</Text>
            <TextInput style={styles.fieldInput} value={editForm.businessName} onChangeText={v => setEditForm(f => ({ ...f, businessName: v }))} />
            <Text style={styles.fieldLabel}>Adresse</Text>
            <TextInput style={styles.fieldInput} value={editForm.address} onChangeText={v => setEditForm(f => ({ ...f, address: v }))} />
            <Text style={styles.fieldLabel}>Ville</Text>
            <TextInput style={styles.fieldInput} value={editForm.city} onChangeText={v => setEditForm(f => ({ ...f, city: v }))} />
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <TextInput style={styles.fieldInput} value={editForm.phone} onChangeText={v => setEditForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.fieldInput} value={editForm.email} onChangeText={v => setEditForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.groupLabel}>📋 Informations légales</Text>
            <Text style={styles.fieldLabel}>N° RC</Text>
            <TextInput style={styles.fieldInput} value={editForm.registrationNumber} onChangeText={v => setEditForm(f => ({ ...f, registrationNumber: v }))} />
            <Text style={styles.fieldLabel}>ICE</Text>
            <TextInput style={styles.fieldInput} value={editForm.iceNumber} onChangeText={v => setEditForm(f => ({ ...f, iceNumber: v }))} />
            <Text style={styles.fieldLabel}>Identifiant fiscal</Text>
            <TextInput style={styles.fieldInput} value={editForm.taxId} onChangeText={v => setEditForm(f => ({ ...f, taxId: v }))} />

            <Text style={styles.groupLabel}>🏦 Informations bancaires</Text>
            <Text style={styles.fieldLabel}>RIB</Text>
            <TextInput style={styles.fieldInput} value={editForm.rib} onChangeText={v => setEditForm(f => ({ ...f, rib: v }))} />
            <Text style={styles.fieldLabel}>IBAN</Text>
            <TextInput style={styles.fieldInput} value={editForm.iban} onChangeText={v => setEditForm(f => ({ ...f, iban: v }))} />

            <Text style={styles.groupLabel}>👤 Contact Administratif</Text>
            <TextInput style={styles.fieldInput} placeholder="Prénom" value={editForm.contactAdminFirstName} onChangeText={v => setEditForm(f => ({ ...f, contactAdminFirstName: v }))} />
            <TextInput style={[styles.fieldInput, { marginTop: 6 }]} placeholder="Nom" value={editForm.contactAdminLastName} onChangeText={v => setEditForm(f => ({ ...f, contactAdminLastName: v }))} />
            <TextInput style={[styles.fieldInput, { marginTop: 6 }]} placeholder="Téléphone" value={editForm.contactAdminPhone} onChangeText={v => setEditForm(f => ({ ...f, contactAdminPhone: v }))} keyboardType="phone-pad" />
            <TextInput style={[styles.fieldInput, { marginTop: 6 }]} placeholder="Email" value={editForm.contactAdminEmail} onChangeText={v => setEditForm(f => ({ ...f, contactAdminEmail: v }))} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.groupLabel}>💰 Contact Finance</Text>
            <TextInput style={styles.fieldInput} placeholder="Prénom" value={editForm.contactFinanceFirstName} onChangeText={v => setEditForm(f => ({ ...f, contactFinanceFirstName: v }))} />
            <TextInput style={[styles.fieldInput, { marginTop: 6 }]} placeholder="Nom" value={editForm.contactFinanceLastName} onChangeText={v => setEditForm(f => ({ ...f, contactFinanceLastName: v }))} />
            <TextInput style={[styles.fieldInput, { marginTop: 6 }]} placeholder="Téléphone" value={editForm.contactFinancePhone} onChangeText={v => setEditForm(f => ({ ...f, contactFinancePhone: v }))} keyboardType="phone-pad" />
            <TextInput style={[styles.fieldInput, { marginTop: 6 }]} placeholder="Email" value={editForm.contactFinanceEmail} onChangeText={v => setEditForm(f => ({ ...f, contactFinanceEmail: v }))} keyboardType="email-address" autoCapitalize="none" />

            <TouchableOpacity style={[styles.submitBtn, submitRequest.isPending && { opacity: 0.6 }]}
              onPress={() => submitRequest.mutate()} disabled={submitRequest.isPending}>
              <Text style={styles.submitBtnText}>{submitRequest.isPending ? 'Envoi en cours...' : '📤 Soumettre la demande'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: '#5B3DF5' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 26 },
  name: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  memberBadge: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  memberText: { color: '#fff', fontSize: 12 },
  statsRow: { flexDirection: 'row', margin: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statNum: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  pendingBanner: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FEF3C7', borderRadius: Radius.md, padding: 12, flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: '#FDE68A' },
  pendingIcon: { fontSize: 16 },
  pendingText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  section: { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500', flex: 2, textAlign: 'right' },
  contactBlock: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: Colors.border, gap: 3, marginBottom: 6 },
  contactRole: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  contactName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  contactDetail: { fontSize: 12, color: Colors.textSecondary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  switchSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  editBtn: { marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  editBtnDisabled: { backgroundColor: '#9CA3AF' },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logoutBtn: { marginHorizontal: 16, marginTop: 4, backgroundColor: Colors.errorBg, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, marginTop: 16 },
  modalContainer: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  modalClose: { fontSize: 20, color: Colors.textMuted, padding: 4 },
  modalWarn: { backgroundColor: '#FEF3C7', borderRadius: Radius.md, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  modalWarnText: { fontSize: 13, color: '#92400E', lineHeight: 18 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginTop: 14, marginBottom: 8 },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, backgroundColor: '#fff', marginBottom: 8 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
