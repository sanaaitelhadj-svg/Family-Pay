import { useEffect, useState } from 'react';
import { api } from '../api';
import { usePermissions } from '../contexts/PermissionsContext';

interface Beneficiary {
  id: string; isActive: boolean; isMinor: boolean; createdAt: string;
  relationship: string | null;
  user: { firstName: string; lastName: string | null; phone: string; email: string | null; createdAt: string };
  sponsor: { user: { firstName: string } };
  _count: { allocations: number };
}

export default function Beneficiaries() {
  const { can, loading: permsLoading } = usePermissions();
  const [list, setList]     = useState<Beneficiary[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm]   = useState({ firstName: '', lastName: '', phone: '', password: '', sponsorId: '', relationship: '' });
  const [sponsors, setSponsors]       = useState<{ id: string; user: { firstName: string; phone: string } }[]>([]);
  const [createSaving, setCreateSaving] = useState(false);

  const [editModal, setEditModal]   = useState(false);
  const [editForm, setEditForm]     = useState({ firstName: '', lastName: '', email: '', relationship: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionSaving, setActionSaving]   = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/admin/beneficiaries').then(r => setList(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const loadSponsors = async () => {
    try { const res = await api.get('/admin/sponsors'); setSponsors(res.data); } catch { setSponsors([]); }
  };

  async function openDetail(id: string) {
    const res = await api.get(`/admin/beneficiaries/${id}`);
    setDetail(res.data);
  }

  const submitCreate = async () => {
    if (!createForm.firstName || !createForm.phone || !createForm.password || !createForm.sponsorId) return;
    setCreateSaving(true);
    try {
      await api.post('/admin/beneficiaries', {
        firstName: createForm.firstName, lastName: createForm.lastName || undefined,
        phone: createForm.phone, password: createForm.password,
        sponsorId: createForm.sponsorId, relationship: createForm.relationship || undefined,
      });
      setCreateModal(false);
      setCreateForm({ firstName: '', lastName: '', phone: '', password: '', sponsorId: '', relationship: '' });
      load();
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setCreateSaving(false); }
  };

  const submitEdit = async () => {
    if (!detail) return;
    setEditSaving(true);
    try {
      await api.patch(`/admin/beneficiaries/${detail.id}`, {
        firstName: editForm.firstName, lastName: editForm.lastName || undefined, email: editForm.email || undefined,
      });
      setEditModal(false);
      const res = await api.get(`/admin/beneficiaries/${detail.id}`);
      setDetail(res.data);
      load();
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setEditSaving(false); }
  };

  const toggleStatus = async () => {
    if (!detail) return;
    setActionSaving(true);
    try {
      await api.patch(`/admin/beneficiaries/${detail.id}/status`, { isActive: !detail.isActive });
      const res = await api.get(`/admin/beneficiaries/${detail.id}`);
      setDetail(res.data);
      load();
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setActionSaving(false); }
  };

  const deleteBeneficiary = async () => {
    if (!detail) return;
    setActionSaving(true);
    try {
      await api.delete(`/admin/beneficiaries/${detail.id}`);
      setDeleteConfirm(false);
      setDetail(null);
      load();
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setActionSaving(false); }
  };

  if (loading) return <p className="text-gray-500 p-6">Chargement...</p>;

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Bénéficiaires ({list.length})</h1>
          <button onClick={() => { loadSponsors(); setCreateModal(true); }} disabled={permsLoading || !can("beneficiaries","add")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Nouveau bénéficiaire
          </button>
        </div>
        <div className="space-y-3">
          {list.map(b => (
            <button key={b.id} onClick={() => openDetail(b.id)}
              className={"w-full bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-shadow border-2 " + (detail?.id === b.id ? "border-indigo-500" : "border-transparent")}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{b.user.firstName} {b.user.lastName ?? ""}</p>
                    {b.isMinor && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Mineur</span>}
                  </div>
                  <p className="text-sm text-gray-500">{b.user.phone}</p>
                  <p className="text-xs text-gray-400">Sponsor : {b.sponsor.user.firstName}{b.relationship ? " · " + b.relationship : ""}</p>
                </div>
                <div className="text-right">
                  <span className={"text-xs px-2 py-1 rounded-full font-medium " + (b.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
                    {b.isActive ? "Actif" : "Inactif"}
                  </span>
                  <p className="text-sm text-gray-400 mt-1">{b._count.allocations} alloc.</p>
                </div>
              </div>
            </button>
          ))}
          {list.length === 0 && <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-sm">Aucun bénéficiaire</div>}
        </div>
      </div>

      {detail && (
        <div className="w-96 bg-white rounded-2xl p-6 shadow-sm h-fit sticky top-0 max-h-screen overflow-y-auto">
          <div className="flex justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                {detail.user.firstName?.[0] ?? "?"}
              </div>
              <div>
                <h2 className="text-lg font-bold">{detail.user.firstName} {detail.user.lastName ?? ""}</h2>
                {detail.isMinor && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Mineur</span>}
              </div>
            </div>
            <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
          </div>
          <p className="text-sm text-gray-500 mb-1">{detail.user.phone}</p>
          {detail.user.email && <p className="text-sm text-gray-400 mb-1">{detail.user.email}</p>}
          <div className="mb-4">
            <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (detail.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
              {detail.isActive ? "Actif" : "Suspendu"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button onClick={() => { setEditForm({ firstName: detail.user.firstName, lastName: detail.user.lastName ?? "", email: detail.user.email ?? "", relationship: detail.relationship ?? "" }); setEditModal(true); }}
              disabled={permsLoading || !can("beneficiaries","write")}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              Modifier
            </button>
            <button onClick={toggleStatus} disabled={permsLoading || !can("beneficiaries","suspend") || actionSaving}
              className={"flex-1 px-3 py-1.5 text-sm rounded-lg font-medium " + (detail.isActive ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : "bg-green-100 text-green-700 hover:bg-green-200")}>
              {detail.isActive ? "Suspendre" : "Activer"}
            </button>
            <button onClick={() => setDeleteConfirm(true)} disabled={permsLoading || !can("beneficiaries","delete") || actionSaving}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200">
              Supprimer
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
            <div><p className="text-xs text-gray-400">Sponsor</p><p className="text-sm font-medium">{detail.sponsor?.user?.firstName}</p></div>
            <div><p className="text-xs text-gray-400">Lien</p><p className="text-sm font-medium text-gray-900">{detail.relationship || "Non renseigné"}</p></div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Allocations</p>
          <div className="space-y-2 mb-4">
            {detail.allocations?.map((a: any) => (
              <div key={a.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex justify-between">
                  <span className="font-medium">{a.category}</span>
                  <span className={"text-xs px-2 py-0.5 rounded-full " + (a.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{a.status}</span>
                </div>
                <div className="text-gray-500 mt-1">{Number(a.remainingAmount).toFixed(0)} / {Number(a.limitAmount).toFixed(0)} MAD</div>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Transactions récentes</p>
          <div className="space-y-2">
            {detail.transactions?.slice(0,10).map((t: any) => (
              <div key={t.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2 flex justify-between">
                <div>
                  <p className="font-medium">{t.merchant?.businessName}</p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString("fr-FR")}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{Number(t.amount).toFixed(0)} MAD</p>
                  <span className={"text-xs " + (t.status === "COMPLETED" ? "text-green-600" : "text-red-500")}>{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Modifier le bénéficiaire</h2>
            {([["Prénom *", "firstName"], ["Nom", "lastName"], ["Email", "email"], ["Relation", "relationship"]] as const).map(([label, key]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="text" value={editForm[key]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
              <button onClick={submitEdit} disabled={editSaving || !editForm.firstName}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {editSaving ? "Enregistrement..." : "Enregistrer"}
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
              <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
              <button onClick={deleteBeneficiary} disabled={actionSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {actionSaving ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Nouveau bénéficiaire</h2>
            <div className="grid grid-cols-2 gap-3">
              {([["Prénom *", "firstName", "text"], ["Nom", "lastName", "text"], ["Téléphone *", "phone", "text"], ["Relation", "relationship", "text"]] as const).map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={createForm[key]}
                    onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sponsor *</label>
                <select value={createForm.sponsorId} onChange={e => setCreateForm(f => ({ ...f, sponsorId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">— Sélectionner un sponsor —</option>
                  {sponsors.map(s => <option key={s.id} value={s.id}>{s.user.firstName} ({s.user.phone})</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                <input type="password" value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
              <button onClick={submitCreate} disabled={createSaving || !createForm.firstName || !createForm.phone || !createForm.password || !createForm.sponsorId}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {createSaving ? "Création..." : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
