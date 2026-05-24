import { useEffect, useState } from 'react';
import { api } from '../api';
import { PasswordResetModal } from '../components/PasswordResetModal';
import { usePermissions } from '../contexts/PermissionsContext';

interface Sponsor {
  id: string; createdAt: string;
  user: { firstName: string; lastName: string | null; phone: string; email: string | null; isActive: boolean; createdAt: string };
  _count: { allocations: number; beneficiaries: number };
}

interface SponsorDetail extends Sponsor {
  pspCustomerReference: string | null;
  maskedCardReference: string | null;
  user: { firstName: string; lastName: string | null; phone: string; email: string | null; isActive: boolean; createdAt: string };
  totalVolume: number; totalTransactions: number;
  allocations: any[]; beneficiaries: any[];
}

export default function Sponsors() {
  const { can, loading: permsLoading } = usePermissions();
  const [list, setList]     = useState<Sponsor[]>([]);
  const [detail, setDetail] = useState<SponsorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm]   = useState({ firstName: '', lastName: '', phone: '', email: '', password: '' });
  const [createSaving, setCreateSaving] = useState(false);

  const [resetPwdModal, setResetPwdModal] = useState(false);
  const [allocModal, setAllocModal]             = useState(false);
  const [editAllocTarget, setEditAllocTarget]   = useState<any>(null);
  const [addBeneModal, setAddBeneModal]         = useState(false);
  const [allocForm, setAllocForm]               = useState({ beneficiaryId: '', category: 'GENERAL', limitAmount: '', expiresAt: '', status: 'ACTIVE' });
  const [addBeneForm, setAddBeneForm]           = useState({ firstName: '', lastName: '', phone: '', password: '', relationship: '' });
  const [modalSaving, setModalSaving]           = useState(false);
  const [editModal, setEditModal]   = useState(false);
  const [editForm, setEditForm]     = useState({ firstName: '', lastName: '', email: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionSaving, setActionSaving]   = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/admin/sponsors?_t=${Date.now()}`).then(r => setList(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function openDetail(id: string) {
    const res = await api.get(`/admin/sponsors/${id}`);
    setDetail(res.data);
  }

  const submitCreate = async () => {
    if (!createForm.firstName || !createForm.phone || !createForm.password) return;
    setCreateSaving(true);
    try {
      await api.post('/admin/sponsors', {
        firstName: createForm.firstName, lastName: createForm.lastName || undefined,
        phone: createForm.phone, email: createForm.email || undefined, password: createForm.password,
      });
      setCreateModal(false);
      setCreateForm({ firstName: '', lastName: '', phone: '', email: '', password: '' });
      load();
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setCreateSaving(false); }
  };

  const submitEdit = async () => {
    if (!detail) return;
    setEditSaving(true);
    try {
      await api.patch(`/admin/sponsors/${detail.id}`, editForm);
      setEditModal(false);
      const res = await api.get(`/admin/sponsors/${detail.id}`);
      setDetail(res.data);
      load();
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setEditSaving(false); }
  };

  const toggleStatus = async () => {
    if (!detail) return;
    setActionSaving(true);
    try {
      const patchRes = await api.patch(`/admin/sponsors/${detail.id}/status`);
      const newIsActive: boolean = patchRes.data?.isActive ?? !detail.user.isActive;
      setDetail(d => d ? { ...d, user: { ...d.user, isActive: newIsActive } } : null);
      setList(l => l.map(s => s.id === detail.id ? { ...s, user: { ...s.user, isActive: newIsActive } } : s));
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setActionSaving(false); }
  };


  const saveAlloc = async () => {
    if (!detail) return;
    setModalSaving(true);
    try {
      if (editAllocTarget) {
        const r = await api.patch(`/admin/sponsors/${detail.id}/allocations/${editAllocTarget.id}`, { limitAmount: Number(allocForm.limitAmount), status: allocForm.status, expiresAt: allocForm.expiresAt || null });
        setDetail(d => d ? { ...d, allocations: d.allocations.map((a: any) => a.id === editAllocTarget.id ? { ...a, ...r.data } : a) } : null);
      } else {
        const r = await api.post(`/admin/sponsors/${detail.id}/allocations`, { beneficiaryId: allocForm.beneficiaryId, category: allocForm.category, limitAmount: Number(allocForm.limitAmount), expiresAt: allocForm.expiresAt || null });
        setDetail(d => d ? { ...d, allocations: [...d.allocations, r.data] } : null);
      }
      setAllocModal(false); setEditAllocTarget(null);
      setAllocForm({ beneficiaryId: '', category: 'GENERAL', limitAmount: '', expiresAt: '', status: 'ACTIVE' });
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setModalSaving(false); }
  };

  const deleteAlloc = async (allocId: string) => {
    if (!detail || !window.confirm('Supprimer cette allocation ?')) return;
    try {
      await api.delete(`/admin/sponsors/${detail.id}/allocations/${allocId}`);
      setDetail(d => d ? { ...d, allocations: d.allocations.filter((a: any) => a.id !== allocId) } : null);
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
  };

  const saveBene = async () => {
    if (!detail) return;
    setModalSaving(true);
    try {
      const r = await api.post('/admin/beneficiaries', { ...addBeneForm, sponsorId: detail.id });
      setDetail(d => d ? { ...d, beneficiaries: [...d.beneficiaries, r.data] } : null);
      setAddBeneModal(false);
      setAddBeneForm({ firstName: '', lastName: '', phone: '', password: '', relationship: '' });
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setModalSaving(false); }
  };

  const deleteSponsor = async () => {
    if (!detail) return;
    setActionSaving(true);
    try {
      await api.delete(`/admin/sponsors/${detail.id}`);
      setDeleteConfirm(false);
      setDetail(null);
      load();
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setActionSaving(false); }
  };

  if (loading) return <p className="text-gray-500 p-6">Chargement...</p>;

  return (
    <>
    <div className="flex gap-6 p-6">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sponsors ({list.length})</h1>
          <button onClick={() => setCreateModal(true)} disabled={permsLoading || !can('sponsors','add')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Nouveau sponsor
          </button>
      {resetPwdModal && detail && (
        <PasswordResetModal
          endpoint={`/admin/sponsors/${detail.id}/reset-password`}
          name={`${detail.user.firstName} ${detail.user.lastName ?? ''}`.trim()}
          onClose={() => setResetPwdModal(false)}
        />
      )}

        </div>
        <div className="space-y-3">
          {list.map(s => (
            <button key={s.id} onClick={() => openDetail(s.id)}
              className={`w-full bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow border-2 ${detail?.id === s.id ? 'border-indigo-500' : 'border-transparent'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{s.user.firstName} {s.user.lastName ?? ''}</p>
                    {!s.user.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Suspendu</span>}
                  </div>
                  <p className="text-sm text-gray-500">{s.user.phone}</p>
                  {s.user.email && <p className="text-sm text-gray-400">{s.user.email}</p>}
                </div>
                <div className="text-right text-sm">
                  <span className="text-indigo-600 font-medium">{s._count.allocations} alloc.</span>
                  <span className="text-gray-400 ml-3">{s._count.beneficiaries} bénéf.</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Inscrit le {new Date(s.createdAt).toLocaleDateString('fr-FR')}</p>
            </button>
          ))}
          {list.length === 0 && <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">Aucun sponsor</div>}
        </div>
      </div>

      {detail && (
        <div className="w-96 bg-white rounded-2xl p-6 shadow-sm h-fit sticky top-0 max-h-screen overflow-y-auto">
          <div className="flex justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900">{detail.user.firstName} {detail.user.lastName ?? ''}</h2>
            <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <p className="text-sm text-gray-500 mb-1">{detail.user.phone}</p>
          {detail.user.email && <p className="text-sm text-gray-400 mb-1">{detail.user.email}</p>}
          <div className="mb-4">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${detail.user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {detail.user.isActive ? 'Actif' : 'Suspendu'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button onClick={() => { setEditForm({ firstName: detail.user.firstName, lastName: detail.user.lastName ?? '', email: detail.user.email ?? '' }); setEditModal(true); }}
              disabled={permsLoading || !can('sponsors','write')}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              ✏️ Modifier
            </button>
            <button onClick={toggleStatus} disabled={permsLoading || !can('sponsors','suspend') || actionSaving}
              className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium ${detail.user.isActive ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
              {detail.user.isActive ? '⏸ Suspendre' : '▶ Activer'}
            </button>
            <button onClick={() => setDeleteConfirm(true)} disabled={permsLoading || !can('sponsors','delete') || actionSaving}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200">
              🗑 Supprimer
            </button>
            <button onClick={() => setResetPwdModal(true)} disabled={permsLoading || !can('sponsors','reset-password')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium ${can('sponsors','reset-password') ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              🔑 MDP
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-700">{detail.totalTransactions}</p>
              <p className="text-xs text-indigo-500">Transactions</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{detail.totalVolume.toFixed(0)} MAD</p>
              <p className="text-xs text-green-500">Volume total</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Bénéficiaires ({detail.beneficiaries.length})</p>
            {can('beneficiaries','add') && (
              <button onClick={() => setAddBeneModal(true)} className="text-xs bg-orange-50 text-orange-600 hover:bg-orange-100 px-2 py-1 rounded-lg font-medium">+ Ajouter</button>
            )}
          </div>
          <div className="space-y-2 mb-4">
            {detail.beneficiaries.map((b: any) => (
              <div key={b.id} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span>{b.user.firstName}</span>
                <span className="text-gray-400">{b.user.phone}</span>
              </div>
            ))}
            {detail.beneficiaries.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Aucun bénéficiaire</p>}
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Allocations ({detail.allocations.length})</p>
            {can('sponsors','write') && detail.beneficiaries.length > 0 && (
              <button onClick={() => { setEditAllocTarget(null); setAllocForm({ beneficiaryId: '', category: 'GENERAL', limitAmount: '', expiresAt: '', status: 'ACTIVE' }); setAllocModal(true); }}
                className="text-xs bg-orange-50 text-orange-600 hover:bg-orange-100 px-2 py-1 rounded-lg font-medium">+ Ajouter</button>
            )}
          </div>
          <div className="space-y-2">
            {detail.allocations.map((a: any) => (
              <div key={a.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{a.category}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
                  </div>
                  <div className="flex gap-2">
                    {can('sponsors','write') && (
                      <button onClick={() => { setEditAllocTarget(a); setAllocForm({ beneficiaryId: a.beneficiaryId, category: a.category, limitAmount: String(Number(a.limitAmount)), expiresAt: a.expiresAt ? a.expiresAt.slice(0,10) : '', status: a.status }); setAllocModal(true); }}
                        className="text-blue-500 hover:text-blue-700 text-xs">✏️</button>
                    )}
                    {can('sponsors','delete') && (
                      <button onClick={() => deleteAlloc(a.id)} className="text-red-400 hover:text-red-600 text-xs">🗑</button>
                    )}
                  </div>
                </div>
                <div className="text-gray-500 mt-1">{Number(a.remainingAmount).toFixed(0)} / {Number(a.limitAmount).toFixed(0)} MAD</div>
              </div>
            ))}
            {detail.allocations.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Aucune allocation</p>}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Modifier le sponsor</h2>
            {([['Prénom *', 'firstName'], ['Nom', 'lastName'], ['Email', 'email']] as const).map(([label, key]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="text" value={editForm[key]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
              <button onClick={submitEdit} disabled={editSaving || !editForm.firstName}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {editSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Confirmer la suppression</h2>
            <p className="text-sm text-gray-600 mb-6">Le compte sera désactivé. Cette action est réversible.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
              <button onClick={deleteSponsor} disabled={actionSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {actionSaving ? '...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Nouveau sponsor</h2>
            <div className="grid grid-cols-2 gap-3">
              {([['Prénom *', 'firstName'], ['Nom', 'lastName'], ['Téléphone *', 'phone'], ['Email', 'email']] as const).map(([label, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={key === 'email' ? 'email' : 'text'} value={createForm[key]}
                    onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                <input type="password" value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
              <button onClick={submitCreate} disabled={createSaving || !createForm.firstName || !createForm.phone || !createForm.password}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {createSaving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Allocation modal */}
      {allocModal && detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{editAllocTarget ? 'Modifier l\'allocation' : 'Nouvelle allocation'}</h2>
            {!editAllocTarget && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bénéficiaire *</label>
                <select value={allocForm.beneficiaryId} onChange={e => setAllocForm(f => ({...f, beneficiaryId: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sélectionner…</option>
                  {detail.beneficiaries.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.user.firstName} — {b.user.phone}</option>
                  ))}
                </select>
              </div>
            )}
            {!editAllocTarget && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                <select value={allocForm.category} onChange={e => setAllocForm(f => ({...f, category: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['GENERAL','PHARMACY','FOOD','CLOTHING','EDUCATION','LEISURE'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}
            {editAllocTarget && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select value={allocForm.status} onChange={e => setAllocForm(f => ({...f, status: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['ACTIVE','PAUSED','EXPIRED','EXHAUSTED'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant limite (MAD) *</label>
              <input type="number" min="0" value={allocForm.limitAmount} onChange={e => setAllocForm(f => ({...f, limitAmount: e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ex: 500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration (optionnel)</label>
              <input type="date" value={allocForm.expiresAt} onChange={e => setAllocForm(f => ({...f, expiresAt: e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setAllocModal(false); setEditAllocTarget(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={saveAlloc} disabled={modalSaving || !allocForm.limitAmount || (!editAllocTarget && !allocForm.beneficiaryId)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {modalSaving ? 'Enregistrement…' : editAllocTarget ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add beneficiary modal */}
      {addBeneModal && detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Nouveau bénéficiaire</h2>
            <p className="text-sm text-gray-500">Sponsor : {detail.user.firstName}</p>
            {[
              { label: 'Prénom *', key: 'firstName', type: 'text', placeholder: 'Prénom' },
              { label: 'Nom', key: 'lastName', type: 'text', placeholder: 'Nom (optionnel)' },
              { label: 'Téléphone *', key: 'phone', type: 'tel', placeholder: '06XXXXXXXX' },
              { label: 'Mot de passe *', key: 'password', type: 'password', placeholder: '8 caractères min' },
              { label: 'Lien', key: 'relationship', type: 'text', placeholder: 'ex: Fils, Épouse…' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type={type} placeholder={placeholder}
                  value={(addBeneForm as any)[key]}
                  onChange={e => setAddBeneForm(f => ({...f, [key]: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setAddBeneModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={saveBene} disabled={modalSaving || !addBeneForm.firstName || !addBeneForm.phone || !addBeneForm.password}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {modalSaving ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
