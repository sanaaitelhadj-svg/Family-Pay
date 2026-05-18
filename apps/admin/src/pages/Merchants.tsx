import { useState, useEffect } from 'react';
import { api } from '../api';

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
  address: string | null; gpsLat: string | null; gpsLng: string | null; photos: unknown;
  contactAdmin: ContactInfo | null; contactFinance: ContactInfo | null;
  contactOps: ContactInfo | null; contactLegal: ContactInfo | null;
  riskLevel: string | null; allowedProducts: unknown; businessHours: unknown;
  cguSignedAt: string | null; cguVersion: string | null;
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
};
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="bg-gray-50 p-3 rounded">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-all">{value ?? '—'}</p>
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
export default function Merchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [approvalModal, setApprovalModal] = useState<{ id: string; name: string } | null>(null);
  const [approvalForm, setApprovalForm] = useState<ApprovalForm>({
    contractUrl: '', billingType: 'commission', commissionType: 'TRANSACTION_PERCENTAGE',
    commissionRate: '', planId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '',
  });
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/admin/merchants'); setMerchants(res.data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const loadPlans = async () => {
    try { const res = await api.get('/admin/subscription-plans'); setPlans(res.data); }
    catch { setPlans([]); }
  };

  const openApprovalModal = (m: Merchant) => {
    loadPlans();
    setApprovalForm({
      contractUrl: m.contractUrl ?? '',
      billingType: m.subscriptions?.length ? 'subscription' : 'commission',
      commissionType: m.commissionType ?? 'TRANSACTION_PERCENTAGE',
      commissionRate: m.commissionRate && m.commissionType === 'TRANSACTION_PERCENTAGE'
        ? (parseFloat(m.commissionRate) * 100).toFixed(2) : m.commissionRate ?? '',
      planId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '',
    });
    setApprovalModal({ id: m.id, name: m.businessName });
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
      await api.patch(`/admin/merchants/${approvalModal.id}/activate`, {
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
      setApprovalModal(null); await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erreur activation');
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
    await api.patch(`/admin/merchants/${id}/status`, { status: current === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' });
    await load();
  };

  const filtered = filter === 'ALL' ? merchants : merchants.filter(m => m.activationStatus === filter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Marchands</h1>
        <div className="flex gap-2 flex-wrap">
          {['ALL','PENDING','ACTIVE','SUSPENDED','REJECTED'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              {s === 'ALL' ? 'Tous' : s}
              {s !== 'ALL' && <span className="ml-1 text-xs opacity-60">({merchants.filter(m => m.activationStatus === s).length})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 bg-white rounded-xl shadow overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400">Chargement...</div>
            : filtered.length === 0 ? <div className="p-8 text-center text-gray-400">Aucun marchand</div>
            : <ul className="divide-y divide-gray-100">
                {filtered.map(m => (
                  <li key={m.id} onClick={() => setSelected(m)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${selected?.id === m.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{m.businessName}</p>
                        <p className="text-xs text-gray-500">{m.category}{m.city ? ` · ${m.city}` : ''}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.activationStatus] ?? 'bg-gray-100'}`}>
                        {m.activationStatus}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>}
        </div>

        {selected && (
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-6 space-y-6 overflow-y-auto" style={{ maxHeight: '80vh' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selected.businessName}</h2>
                <p className="text-sm text-gray-500">{selected.category}{selected.city ? ` · ${selected.city}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {selected.activationStatus === 'PENDING' && (<>
                  <button onClick={() => openApprovalModal(selected)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">Approuver</button>
                  <button onClick={() => setRejectModal({ id: selected.id, name: selected.businessName })}
                    className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700">Rejeter</button>
                </>)}
                {(selected.activationStatus === 'ACTIVE' || selected.activationStatus === 'SUSPENDED') && (
                  <button onClick={() => suspend(selected.id, selected.activationStatus)}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${selected.activationStatus === 'SUSPENDED' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                    {selected.activationStatus === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.activationStatus] ?? ''}`}>{selected.activationStatus}</span>
              <span className="text-gray-500">Inscrit le {new Date(selected.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations légales</h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="RC / Reg. Number" value={selected.registrationNumber} />
                <Field label="ICE" value={selected.iceNumber} />
                <Field label="Tax ID" value={selected.taxId} />
                <Field label="Fiscal ID" value={selected.fiscalId} />
                <Field label="CIN Représentant" value={selected.cinRepresentant} />
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations bancaires</h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="RIB" value={selected.rib} />
                <Field label="Attestation bancaire" value={selected.attestationBancaire} />
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Localisation</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3"><Field label="Adresse" value={selected.address} /></div>
                <Field label="Latitude" value={selected.gpsLat} />
                <Field label="Longitude" value={selected.gpsLng} />
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contacts</h3>
              <div className="grid grid-cols-2 gap-2">
                <ContactCard label="Administratif" contact={selected.contactAdmin} />
                <ContactCard label="Finance" contact={selected.contactFinance} />
                <ContactCard label="Opérations" contact={selected.contactOps} />
                <ContactCard label="Juridique" contact={selected.contactLegal} />
              </div>
            </section>

            {selected.cguSignedAt && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">CGU</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Version signée" value={selected.cguVersion} />
                  <Field label="Signé le" value={new Date(selected.cguSignedAt).toLocaleDateString('fr-FR')} />
                </div>
              </section>
            )}

            {selected.activationStatus === 'ACTIVE' && (
              <section className="border-t border-gray-200 pt-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contrat & Facturation</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Contrat</p>
                    {selected.contractUrl
                      ? <a href={selected.contractUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline break-all">Voir le contrat ↗</a>
                      : <p className="text-sm text-gray-400">Non défini</p>}
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Facturation</p>
                    {selected.commissionType ? (<>
                      <p className="text-sm font-medium">{selected.commissionType === 'TRANSACTION_PERCENTAGE' ? '% / transaction' : 'Frais fixe'}</p>
                      {selected.commissionRate && <p className="text-xs text-gray-600">
                        {selected.commissionType === 'TRANSACTION_PERCENTAGE'
                          ? `${(parseFloat(selected.commissionRate) * 100).toFixed(2)}%`
                          : `${selected.commissionRate} MAD`}
                      </p>}
                    </>) : selected.subscriptions?.length ? (<>
                      <p className="text-sm font-medium">Abonnement — {selected.subscriptions[0].subscriptionPlan?.name ?? '—'}</p>
                      {selected.subscriptions[0].subscriptionPlan && <p className="text-xs text-gray-600">{selected.subscriptions[0].subscriptionPlan.price} MAD / {selected.subscriptions[0].subscriptionPlan.durationMonths} mois</p>}
                      {selected.subscriptions[0].endDate && <p className="text-xs text-gray-500">Expire le {new Date(selected.subscriptions[0].endDate).toLocaleDateString('fr-FR')}</p>}
                    </>) : <p className="text-sm text-gray-400">Non défini</p>}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {approvalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Activer le marchand</h2>
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
                {saving ? 'Activation...' : 'Confirmer & Activer'}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
