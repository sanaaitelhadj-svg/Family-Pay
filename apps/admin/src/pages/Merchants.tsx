import { useState, useEffect } from 'react';
import { api } from '../api';
import { PasswordResetModal } from '../components/PasswordResetModal';
import { MOROCCAN_CITIES } from '../lib/moroccan-cities';
import { usePermissions } from '../contexts/PermissionsContext';

interface ContactInfo { nom?: string; phone?: string; email?: string }
interface SubscriptionInfo {
  id: string; planId: string | null;
  subscriptionPlan: { name: string; price: string; durationMonths: number } | null;
  startDate: string | null; endDate: string | null; status: string;
}
interface Merchant {
  id: string; businessName: string; category: string; city: string | null;
  activationStatus: string; pspMerchantReference: string | null;
  contractUrl: string | null; commissionType: string | null; commissionRate: string | null;
  registrationNumber: string | null; iceNumber: string | null; taxId: string | null;
  fiscalId: string | null; cinRepresentant: string | null;
  rib: string | null; attestationBancaire: string | null;
  address: string | null; gpsLat: string | null; gpsLng: string | null;
  contactAdmin: ContactInfo | null; contactFinance: ContactInfo | null;
  contactOps: ContactInfo | null; contactLegal: ContactInfo | null;
  riskLevel: string | null; cguSignedAt: string | null; cguVersion: string | null;
  subscriptions?: SubscriptionInfo[]; createdAt: string;
}
interface SubscriptionPlan {
  id: string; name: string; description: string | null;
  price: string; durationMonths: number; isActive: boolean;
}
interface ApprovalForm {
  contractUrl: string; billingType: 'commission' | 'subscription';
  commissionType: string; commissionRate: string;
  planId: string; startDate: string; endDate: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800', REJECTED: 'bg-gray-100 text-gray-700',
  INACTIVE: 'bg-gray-100 text-gray-700',
};

// ── Section wrapper with edit toggle ─────────────────────────────────────────
function Section({ title, editing, onEdit, onSave, onCancel, saving, canEdit = true, children }: {
  title: string; editing: boolean; onEdit: () => void;
  onSave: () => void; onCancel: () => void; saving: boolean; canEdit?: boolean; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Annuler</button>
            <button onClick={onSave} disabled={saving}
              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
              {saving ? '...' : 'Enregistrer'}
            </button>

          </div>
        ) : (
          <button onClick={onEdit} disabled={!canEdit}
            className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            ✏️ Éditer
          </button>
        )}
</div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="bg-gray-50 p-3 rounded">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-all">{value ?? '—'}</p>
</div>
  );
}

function EditField({ label, name, value, onChange, placeholder }: {
  label: string; name: string; value: string; onChange: (k: string, v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type="text" value={value} placeholder={placeholder ?? ''}
        onChange={e => onChange(name, e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500" />
</div>
  );
}

function ContactCard({ label, contact }: { label: string; contact: ContactInfo | null | undefined }) {
  return (
    <div className="bg-gray-50 p-3 rounded">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {contact ? (
        <><p className="text-sm font-medium">{contact.nom ?? '—'}</p>
          {contact.phone && <p className="text-xs text-gray-500">{contact.phone}</p>}
          {contact.email && <p className="text-xs text-gray-500">{contact.email}</p>}</>
      ) : <p className="text-sm text-gray-400">—</p>}
</div>
  );
}

function ContactEditFields({ label, prefix, draft, onChange }: {
  label: string; prefix: string; draft: Record<string, string>; onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="bg-gray-50 p-3 rounded space-y-2">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <input type="text" placeholder="Nom" value={draft[`${prefix}_nom`] ?? ''}
        onChange={e => onChange(`${prefix}_nom`, e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
      <input type="text" placeholder="Téléphone" value={draft[`${prefix}_phone`] ?? ''}
        onChange={e => onChange(`${prefix}_phone`, e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
      <input type="email" placeholder="Email" value={draft[`${prefix}_email`] ?? ''}
        onChange={e => onChange(`${prefix}_email`, e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
</div>
  );
}

export default function Merchants() {
  const [resetPwdModal, setResetPwdModal] = useState<string | null>(null);
  const { can, loading: permsLoading } = usePermissions();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]       = useState('ALL');
  const [catFilter, setCatFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const DEFAULT_CATS = ['PHARMACY','FOOD','GENERAL','EDUCATION','HEALTH','OTHER'];
  const [categories, setCategories] = useState<string[]>(() => {
    try { const s = localStorage.getItem('fp_merchant_cats'); return s ? JSON.parse(s) : ['PHARMACY','FOOD','GENERAL','EDUCATION','HEALTH','OTHER']; }
    catch { return ['PHARMACY','FOOD','GENERAL','EDUCATION','HEALTH','OTHER']; }
  });
  const [newCatInput, setNewCatInput] = useState('');
  const [showNewCat, setShowNewCat]   = useState(false);
  const addCategory = (name: string) => {
    const n = name.trim().toUpperCase();
    if (!n || categories.includes(n)) return;
    const updated = [...categories, n];
    setCategories(updated);
    localStorage.setItem('fp_merchant_cats', JSON.stringify(updated));
    setNewCatInput(''); setShowNewCat(false);
  };

  // Section inline editing
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sectionSaving, setSectionSaving] = useState(false);

  // Billing modal
  const [approvalModal, setApprovalModal] = useState<{ id: string; name: string; isEdit?: boolean } | null>(null);
  const [approvalForm, setApprovalForm] = useState<ApprovalForm>({
    contractUrl: '', billingType: 'commission', commissionType: 'TRANSACTION_PERCENTAGE',
    commissionRate: '', planId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '',
  });
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [saving, setSaving] = useState(false);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ businessName: '', category: 'PHARMACY', city: '', phone: '', password: '', address: '', registrationNumber: '', iceNumber: '' });
  const [createSaving, setCreateSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/merchants');
      setMerchants(res.data);
      if (selected) {
        const updated = res.data.find((m: Merchant) => m.id === selected.id);
        if (updated) setSelected(updated);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const loadPlans = async () => {
    try { const res = await api.get('/admin/subscription-plans'); setPlans(res.data); }
    catch { setPlans([]); }
  };

  // ── Section editing helpers ──────────────────────────────────────────────
  const startEdit = (section: string, values: Record<string, string>) => {
    setEditingSection(section);
    setDraft(values);
  };
  const cancelEdit = () => { setEditingSection(null); setDraft({}); };
  const updateDraft = (key: string, value: string) => setDraft(d => ({ ...d, [key]: value }));

  const saveSection = async (section: string) => {
    if (!selected) return;
    setSectionSaving(true);
    try {
      let body: Record<string, unknown> = {};

      if (section === 'general') {
        body = { businessName: draft.businessName, city: draft.city, pspMerchantReference: draft.pspMerchantReference };
      } else if (section === 'legal') {
        body = { registrationNumber: draft.registrationNumber, iceNumber: draft.iceNumber, taxId: draft.taxId, fiscalId: draft.fiscalId, cinRepresentant: draft.cinRepresentant };
      } else if (section === 'banking') {
        body = { rib: draft.rib, attestationBancaire: draft.attestationBancaire };
      } else if (section === 'location') {
        body = { address: draft.address, gpsLat: draft.gpsLat, gpsLng: draft.gpsLng };
      } else if (section === 'contacts') {
        body = {
          contactAdmin:   { nom: draft.admin_nom,    phone: draft.admin_phone,    email: draft.admin_email },
          contactFinance: { nom: draft.finance_nom,  phone: draft.finance_phone,  email: draft.finance_email },
          contactOps:     { nom: draft.ops_nom,      phone: draft.ops_phone,      email: draft.ops_email },
          contactLegal:   { nom: draft.legal_nom,    phone: draft.legal_phone,    email: draft.legal_email },
        };
      }

      // Remove empty values
      Object.keys(body).forEach(k => { if (body[k] === '' || body[k] === undefined) delete body[k]; });

      await api.patch(`/admin/merchants/${selected.id}/info`, body);
      setEditingSection(null);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erreur');
    } finally { setSectionSaving(false); }
  };

  // ── Billing modal helpers ────────────────────────────────────────────────
  const openApprovalModal = (m: Merchant) => {
    loadPlans();
    setApprovalForm({
      contractUrl: m.contractUrl ?? '',
      billingType: m.subscriptions?.length ? 'subscription' : 'commission',
      commissionType: m.commissionType && m.commissionType !== 'NONE' ? m.commissionType : 'TRANSACTION_PERCENTAGE',
      commissionRate: m.commissionRate && m.commissionType === 'TRANSACTION_PERCENTAGE'
        ? (parseFloat(m.commissionRate) * 100).toFixed(2) : m.commissionRate ?? '',
      planId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '',
    });
    setApprovalModal({ id: m.id, name: m.businessName, isEdit: false });
  };

  const openBillingEdit = (m: Merchant) => {
    loadPlans();
    const sub = m.subscriptions?.[0];
    setApprovalForm({
      contractUrl: m.contractUrl ?? '',
      billingType: sub ? 'subscription' : 'commission',
      commissionType: m.commissionType && m.commissionType !== 'NONE' ? m.commissionType : 'TRANSACTION_PERCENTAGE',
      commissionRate: m.commissionRate && m.commissionType === 'TRANSACTION_PERCENTAGE'
        ? (parseFloat(m.commissionRate) * 100).toFixed(2) : m.commissionRate ?? '',
      planId: sub?.planId ?? '',
      startDate: sub?.startDate ? sub.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      endDate: sub?.endDate ? sub.endDate.slice(0, 10) : '',
    });
    setApprovalModal({ id: m.id, name: m.businessName, isEdit: true });
  };

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      const d = new Date(approvalForm.startDate || new Date().toISOString().slice(0, 10));
      d.setMonth(d.getMonth() + plan.durationMonths);
      setApprovalForm(f => ({ ...f, planId, endDate: d.toISOString().slice(0, 10) }));
    } else { setApprovalForm(f => ({ ...f, planId, endDate: '' })); }
  };

  const handleStartDateChange = (startDate: string) => {
    const plan = plans.find(p => p.id === approvalForm.planId);
    if (plan) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + plan.durationMonths);
      setApprovalForm(f => ({ ...f, startDate, endDate: d.toISOString().slice(0, 10) }));
    } else { setApprovalForm(f => ({ ...f, startDate })); }
  };

  const submitApproval = async () => {
    if (!approvalModal) return;
    setSaving(true);
    try {
      const endpoint = approvalModal.isEdit
        ? `/admin/merchants/${approvalModal.id}/billing`
        : `/admin/merchants/${approvalModal.id}/activate`;
      await api.patch(endpoint, {
        contractUrl: approvalForm.contractUrl || undefined,
        billingType: approvalForm.billingType,
        ...(approvalForm.billingType === 'commission' ? {
          commissionType: approvalForm.commissionType,
          commissionRate: approvalForm.commissionRate ? parseFloat(approvalForm.commissionRate) / 100 : undefined,
        } : {
          planId: approvalForm.planId || undefined,
          startDate: approvalForm.startDate,
          endDate: approvalForm.endDate || undefined,
        }),
      });
      setApprovalModal(null);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erreur');
    } finally { setSaving(false); }
  };

  const reject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    try {
      await api.patch(`/admin/merchants/${rejectModal.id}/reject`, { reason: rejectReason });
      setRejectModal(null); setRejectReason('');
      if (selected?.id === rejectModal.id) setSelected(null);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erreur');
    }
  };

  const suspend = async (id: string, current: string) => {
    try {
      await api.patch(`/admin/merchants/${id}/status`, { status: current === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' });
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erreur lors de la suspension');
    }
  };

  const filtered = merchants
    .filter(m => filter === 'ALL' || m.activationStatus === filter)
    .filter(m => catFilter === 'ALL' || m.category === catFilter)
    .filter(m => cityFilter === 'ALL' || m.city === cityFilter);
  const cities = Array.from(new Set(merchants.map(m => m.city).filter(Boolean))) as string[];
  const grouped: [string, typeof merchants][] = catFilter === 'ALL'
    ? Object.entries(filtered.reduce((acc, m) => {
        const k = m.category || 'OTHER';
        if (!acc[k]) acc[k] = [];
        acc[k].push(m);
        return acc;
      }, {} as Record<string, typeof merchants>))
    : [['', filtered]];


  const submitCreate = async () => {
    if (!createForm.businessName || !createForm.phone || !createForm.password || !createForm.city) return;
    setCreateSaving(true);
    try {
      await api.post('/admin/merchants/create', {
        businessName: createForm.businessName, category: createForm.category,
        city: createForm.city, phone: createForm.phone, password: createForm.password,
        address: createForm.address || undefined,
        registrationNumber: createForm.registrationNumber || undefined,
        iceNumber: createForm.iceNumber || undefined,
        activationStatus: 'INACTIVE',
      });
      setCreateModal(false);
      setCreateForm({ businessName: '', category: 'PHARMACY', city: '', phone: '', password: '', address: '', registrationNumber: '', iceNumber: '' });
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erreur');
    } finally { setCreateSaving(false); }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Marchands</h1>
        <button onClick={() => setCreateModal(true)} disabled={permsLoading || !can('merchants', 'add')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouveau marchand
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Statut :</span>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="ALL">Tous les statuts</option>
            {['INACTIVE','PENDING','ACTIVE','SUSPENDED','REJECTED'].map(s => (
              <option key={s} value={s}>{s} ({merchants.filter(m => m.activationStatus === s).length})</option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500 font-medium">Catégorie :</span>
          {['ALL', ...categories].map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className={`px-3 py-1 rounded text-xs font-medium ${catFilter === cat ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {cat === 'ALL' ? 'Toutes' : cat}
              {cat !== 'ALL' && <span className="ml-1 opacity-60">({merchants.filter(m => m.category === cat).length})</span>}
            </button>
          ))}
          {showNewCat ? (
            <div className="flex gap-1 items-center">
              <input autoFocus type="text" value={newCatInput} onChange={e => setNewCatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCategory(newCatInput); if (e.key === 'Escape') { setShowNewCat(false); setNewCatInput(''); } }}
                placeholder="Nom…" className="border border-orange-300 rounded-full px-3 py-1 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <button onClick={() => addCategory(newCatInput)} className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full hover:bg-orange-600">✓</button>
              <button onClick={() => { setShowNewCat(false); setNewCatInput(''); }} className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full hover:bg-gray-300">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowNewCat(true)}
              className="px-3 py-1 rounded text-xs font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50">
              +
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Ville :</span>
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="ALL">Toutes les villes</option>
            {cities.map(city => (
              <option key={city} value={city}>{city} ({merchants.filter(m => m.city === city).length})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {categories.map(cat => {
          const count = merchants.filter(m => m.category === cat).length;
          return (
            <button key={cat} onClick={() => setCatFilter(catFilter === cat ? 'ALL' : cat)}
              className={`rounded-xl p-3 text-left transition-all border-2 ${catFilter === cat ? 'border-orange-500 bg-orange-50' : 'border-transparent bg-white hover:bg-gray-50 shadow-sm'}`}>
              <p className="text-2xl font-bold text-gray-800">{count}</p>
              <p className="text-xs font-medium text-gray-500 uppercase mt-1 truncate">{cat}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400">Chargement...</div>
            : filtered.length === 0 ? <div className="p-8 text-center text-gray-400">Aucun marchand</div>
            : <div className="divide-y divide-gray-100">
                {grouped.map(([cat, items]) => (
                  <div key={cat}>
                    {catFilter === 'ALL' && cat && (
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat}</span>
                        <span className="ml-2 text-xs text-gray-400">({items.length})</span>
                      </div>
                    )}
                    {items.map(m => (
                      <div key={m.id} onClick={() => { setSelected(m); setEditingSection(null); }}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${selected?.id === m.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{m.businessName}</p>
                            <p className="text-xs text-gray-500">{m.city ?? '—'}</p>
                          </div>
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.activationStatus] ?? 'bg-gray-100'}`}>
                            {m.activationStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-6 space-y-6 overflow-y-auto" style={{ maxHeight: '82vh' }}>

            {/* Header actions */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selected.businessName}</h2>
                <p className="text-sm text-gray-500">{selected.category}{selected.city ? ` · ${selected.city}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                {(selected.activationStatus === 'PENDING' || selected.activationStatus === 'INACTIVE') && (<>
                  <button onClick={() => openApprovalModal(selected)}
                    disabled={permsLoading || !can('merchants', 'approve')}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${can('merchants', 'approve') ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>Approuver</button>
                  <button onClick={() => can('merchants', 'reject') && setRejectModal({ id: selected.id, name: selected.businessName })}
                    disabled={permsLoading || !can('merchants', 'reject')}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${can('merchants', 'reject') ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>Rejeter</button>
                </>)}
                {(selected.activationStatus === 'ACTIVE' || selected.activationStatus === 'SUSPENDED') && (
                  <button onClick={() => suspend(selected.id, selected.activationStatus)} disabled={permsLoading || !can('merchants', 'suspend')}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${selected.activationStatus === 'SUSPENDED' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-orange-500 text-white hover:bg-orange-600'} ${permsLoading || !can('merchants', 'suspend') ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {selected.activationStatus === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}
                  </button>
                )}
                {(selected.activationStatus === 'ACTIVE' || selected.activationStatus === 'SUSPENDED') && (
                  <button onClick={() => setResetPwdModal(selected.id)}
                    disabled={permsLoading || !can('merchants','reset-password')}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${can('merchants','reset-password') ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                    🔑 MDP
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.activationStatus] ?? ''}`}>{selected.activationStatus}</span>
              <span className="text-gray-500">Inscrit le {new Date(selected.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>

            {/* Contrat & Facturation — top, active only */}
            {selected.activationStatus === 'ACTIVE' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider">Contrat & Facturation</h3>
                  <button onClick={() => openBillingEdit(selected)} disabled={permsLoading || !can('merchants', 'write')}
                    className={`text-xs px-2 py-1 bg-white border border-green-300 text-green-700 rounded hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed`}>✏️ Modifier</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Contrat</p>
                    {selected.contractUrl
                      ? <a href={selected.contractUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline break-all">Voir le contrat ↗</a>
                      : <p className="text-sm text-gray-400">Non défini</p>}
                  </div>
                  <div className="bg-white p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Facturation</p>
                    {selected.subscriptions?.length ? (<>
                      <p className="text-sm font-medium">Abonnement — {selected.subscriptions[0].subscriptionPlan?.name ?? '—'}</p>
                      {selected.subscriptions[0].subscriptionPlan && <p className="text-xs text-gray-600">{selected.subscriptions[0].subscriptionPlan.price} MAD / {selected.subscriptions[0].subscriptionPlan.durationMonths} mois</p>}
                      {selected.subscriptions[0].endDate && <p className="text-xs text-gray-500">Expire le {new Date(selected.subscriptions[0].endDate).toLocaleDateString('fr-FR')}</p>}
                    </>) : selected.commissionRate && selected.commissionType !== 'NONE' ? (<>
                      <p className="text-sm font-medium">{selected.commissionType === 'TRANSACTION_PERCENTAGE' ? '% / transaction' : 'Frais fixe'}</p>
                      <p className="text-xs text-gray-600">{selected.commissionType === 'TRANSACTION_PERCENTAGE' ? `${(parseFloat(selected.commissionRate) * 100).toFixed(2)}%` : `${selected.commissionRate} MAD`}</p>
                    </>) : <p className="text-sm text-gray-400">Non défini</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Général */}
            <Section title="Général" editing={editingSection === 'general'}
              onEdit={() => startEdit('general', { businessName: selected.businessName, city: selected.city ?? '', pspMerchantReference: selected.pspMerchantReference ?? '' })}
              onSave={() => saveSection('general')} onCancel={cancelEdit} saving={sectionSaving}
              canEdit={!permsLoading && can('merchants', 'write')}>
              {editingSection === 'general' ? (
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="Nom du commerce" name="businessName" value={draft.businessName ?? ''} onChange={updateDraft} />
                  <EditField label="Ville" name="city" value={draft.city ?? ''} onChange={updateDraft} />
                  <div className="col-span-2">
                    <EditField label="Référence PSP" name="pspMerchantReference" value={draft.pspMerchantReference ?? ''} onChange={updateDraft} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Nom du commerce" value={selected.businessName} />
                  <Field label="Ville" value={selected.city} />
                  <Field label="Référence PSP" value={selected.pspMerchantReference} />
                </div>
              )}
            </Section>

            {/* Légal */}
            <Section title="Informations légales" editing={editingSection === 'legal'}
              onEdit={() => startEdit('legal', { registrationNumber: selected.registrationNumber ?? '', iceNumber: selected.iceNumber ?? '', taxId: selected.taxId ?? '', fiscalId: selected.fiscalId ?? '', cinRepresentant: selected.cinRepresentant ?? '' })}
              onSave={() => saveSection('legal')} onCancel={cancelEdit} saving={sectionSaving}
              canEdit={!permsLoading && can('merchants', 'write')}>
              {editingSection === 'legal' ? (
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="RC / Reg. Number" name="registrationNumber" value={draft.registrationNumber ?? ''} onChange={updateDraft} />
                  <EditField label="ICE" name="iceNumber" value={draft.iceNumber ?? ''} onChange={updateDraft} />
                  <EditField label="Tax ID" name="taxId" value={draft.taxId ?? ''} onChange={updateDraft} />
                  <EditField label="Fiscal ID" name="fiscalId" value={draft.fiscalId ?? ''} onChange={updateDraft} />
                  <div className="col-span-2">
                    <EditField label="CIN Représentant" name="cinRepresentant" value={draft.cinRepresentant ?? ''} onChange={updateDraft} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="RC / Reg. Number" value={selected.registrationNumber} />
                  <Field label="ICE" value={selected.iceNumber} />
                  <Field label="Tax ID" value={selected.taxId} />
                  <Field label="Fiscal ID" value={selected.fiscalId} />
                  <Field label="CIN Représentant" value={selected.cinRepresentant} />
                </div>
              )}
            </Section>

            {/* Bancaire */}
            <Section title="Informations bancaires" editing={editingSection === 'banking'}
              onEdit={() => startEdit('banking', { rib: selected.rib ?? '', attestationBancaire: selected.attestationBancaire ?? '' })}
              onSave={() => saveSection('banking')} onCancel={cancelEdit} saving={sectionSaving}
              canEdit={!permsLoading && can('merchants', 'write')}>
              {editingSection === 'banking' ? (
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="RIB" name="rib" value={draft.rib ?? ''} onChange={updateDraft} />
                  <EditField label="Attestation bancaire" name="attestationBancaire" value={draft.attestationBancaire ?? ''} onChange={updateDraft} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="RIB" value={selected.rib} />
                  <Field label="Attestation bancaire" value={selected.attestationBancaire} />
                </div>
              )}
            </Section>

            {/* Localisation */}
            <Section title="Localisation" editing={editingSection === 'location'}
              onEdit={() => startEdit('location', { address: selected.address ?? '', gpsLat: selected.gpsLat ?? '', gpsLng: selected.gpsLng ?? '' })}
              onSave={() => saveSection('location')} onCancel={cancelEdit} saving={sectionSaving}
              canEdit={!permsLoading && can('merchants', 'write')}>
              {editingSection === 'location' ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3"><EditField label="Adresse" name="address" value={draft.address ?? ''} onChange={updateDraft} /></div>
                  <EditField label="Latitude" name="gpsLat" value={draft.gpsLat ?? ''} onChange={updateDraft} />
                  <EditField label="Longitude" name="gpsLng" value={draft.gpsLng ?? ''} onChange={updateDraft} />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3"><Field label="Adresse" value={selected.address} /></div>
                  <Field label="Latitude" value={selected.gpsLat} />
                  <Field label="Longitude" value={selected.gpsLng} />
                </div>
              )}
            </Section>

            {/* Contacts */}
            <Section title="Contacts" editing={editingSection === 'contacts'}
              onEdit={() => startEdit('contacts', {
                admin_nom: selected.contactAdmin?.nom ?? '', admin_phone: selected.contactAdmin?.phone ?? '', admin_email: selected.contactAdmin?.email ?? '',
                finance_nom: selected.contactFinance?.nom ?? '', finance_phone: selected.contactFinance?.phone ?? '', finance_email: selected.contactFinance?.email ?? '',
                ops_nom: selected.contactOps?.nom ?? '', ops_phone: selected.contactOps?.phone ?? '', ops_email: selected.contactOps?.email ?? '',
                legal_nom: selected.contactLegal?.nom ?? '', legal_phone: selected.contactLegal?.phone ?? '', legal_email: selected.contactLegal?.email ?? '',
              })}
              onSave={() => saveSection('contacts')} onCancel={cancelEdit} saving={sectionSaving}
              canEdit={!permsLoading && can('merchants', 'write')}>
              {editingSection === 'contacts' ? (
                <div className="grid grid-cols-2 gap-3">
                  <ContactEditFields label="Administratif" prefix="admin" draft={draft} onChange={updateDraft} />
                  <ContactEditFields label="Finance" prefix="finance" draft={draft} onChange={updateDraft} />
                  <ContactEditFields label="Opérations" prefix="ops" draft={draft} onChange={updateDraft} />
                  <ContactEditFields label="Juridique" prefix="legal" draft={draft} onChange={updateDraft} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <ContactCard label="Administratif" contact={selected.contactAdmin} />
                  <ContactCard label="Finance" contact={selected.contactFinance} />
                  <ContactCard label="Opérations" contact={selected.contactOps} />
                  <ContactCard label="Juridique" contact={selected.contactLegal} />
                </div>
              )}
            </Section>

            {/* CGU */}
            {selected.cguSignedAt && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">CGU</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Version signée" value={selected.cguVersion} />
                  <Field label="Signé le" value={new Date(selected.cguSignedAt).toLocaleDateString('fr-FR')} />
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Billing Modal */}
      {approvalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{approvalModal.isEdit ? 'Modifier la facturation' : 'Activer le marchand'}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{approvalModal.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL du contrat <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <input type="url" placeholder="https://..." value={approvalForm.contractUrl}
                onChange={e => setApprovalForm(f => ({ ...f, contractUrl: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type de facturation</label>
              <div className="flex gap-4">
                {([['commission', 'Commission / transaction'], ['subscription', 'Abonnement']] as const).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="billingType" value={val}
                      checked={approvalForm.billingType === val}
                      onChange={() => setApprovalForm(f => ({ ...f, billingType: val }))} />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            {approvalForm.billingType === 'commission' && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={approvalForm.commissionType}
                    onChange={e => setApprovalForm(f => ({ ...f, commissionType: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="TRANSACTION_PERCENTAGE">% par transaction</option>
                    <option value="FLAT_FEE">Frais fixe (MAD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {approvalForm.commissionType === 'TRANSACTION_PERCENTAGE' ? 'Taux (%)' : 'Montant (MAD)'}
                  </label>
                  <input type="number" step="0.01" min="0"
                    placeholder={approvalForm.commissionType === 'TRANSACTION_PERCENTAGE' ? '1.5' : '5'}
                    value={approvalForm.commissionRate}
                    onChange={e => setApprovalForm(f => ({ ...f, commissionRate: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
              </div>
            )}
            {approvalForm.billingType === 'subscription' && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Offre choisie</label>
                  <select value={approvalForm.planId} onChange={e => handlePlanChange(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="">— Sélectionner une offre —</option>
                    {plans.filter(p => p.isActive).map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {p.price} MAD / {p.durationMonths} mois</option>
                    ))}
                  </select>
                  {plans.filter(p => p.isActive).length === 0 && (
                    <p className="text-xs text-orange-500 mt-1">Aucune offre active — créez des offres dans l'onglet Abonnements</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date de début</label>
                    <input type="date" value={approvalForm.startDate}
                      onChange={e => handleStartDateChange(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Date de fin {approvalForm.planId && <span className="text-green-600">(auto)</span>}
                    </label>
                    <input type="date" value={approvalForm.endDate}
                      onChange={e => setApprovalForm(f => ({ ...f, endDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setApprovalModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={submitApproval}
                disabled={saving || (approvalForm.billingType === 'subscription' && !approvalForm.planId)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Enregistrement...' : approvalModal.isEdit ? 'Enregistrer' : 'Confirmer & Activer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Rejeter le marchand</h2>
            <p className="text-sm text-gray-500">{rejectModal.name}</p>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Documents incomplets, informations incorrectes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={reject} disabled={!rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">Rejeter</button>
            </div>
          </div>
        </div>
      )}
      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Nouveau marchand</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du commerce *</label>
                <input type="text" value={createForm.businessName}
                  onChange={e => setCreateForm(f => ({ ...f, businessName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                <select value={createForm.category}
                  onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
                <select value={createForm.city} onChange={e => setCreateForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sélectionner une ville…</option>
                  {MOROCCAN_CITIES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                <input type="text" value={createForm.phone}
                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RC</label>
                <input type="text" value={createForm.registrationNumber}
                  onChange={e => setCreateForm(f => ({ ...f, registrationNumber: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ICE</label>
                <input type="text" value={createForm.iceNumber}
                  onChange={e => setCreateForm(f => ({ ...f, iceNumber: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input type="text" value={createForm.address}
                  onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                <input type="password" value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={submitCreate}
                disabled={createSaving || !createForm.businessName || !createForm.phone || !createForm.password || !createForm.city}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {createSaving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetPwdModal && (
        <PasswordResetModal
          endpoint={`/admin/merchants/${resetPwdModal}/reset-password`}
          name={merchants.find(m => m.id === resetPwdModal)?.businessName ?? 'Marchand'}
          onClose={() => setResetPwdModal(null)}
        />
      )}
</div>
  );
}
