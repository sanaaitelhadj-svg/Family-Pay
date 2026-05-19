import { useState, useEffect } from 'react';
import { api } from '../api';

interface Admin {
  id: string; firstName: string; lastName: string | null;
  phone: string; email: string | null; isVerified: boolean; createdAt: string;
}
interface AdminForm { firstName: string; lastName: string; phone: string; email: string; password: string; }
const EMPTY: AdminForm = { firstName: '', lastName: '', phone: '', email: '', password: '' };

export default function Admins() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<AdminForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get('/admin/admins'); setAdmins(res.data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.firstName || !form.phone || !form.password) return;
    setSaving(true);
    try {
      await api.post('/admin/admins', {
        firstName: form.firstName, lastName: form.lastName || undefined,
        phone: form.phone, email: form.email || undefined, password: form.password,
      });
      setModal(false); setForm(EMPTY); await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? 'Erreur');
    } finally { setSaving(false); }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await api.patch(`/admin/admins/${id}/status`, { isActive: !current });
    await load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administrateurs</h1>
          <p className="text-sm text-gray-500">{admins.length} compte{admins.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setModal(true); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Nouvel administrateur
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Chargement...</div>
          : admins.length === 0 ? <div className="p-8 text-center text-gray-400">Aucun administrateur</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Nom', 'Téléphone', 'Email', 'Statut', 'Créé le', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admins.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.firstName}{a.lastName ? ` ${a.lastName}` : ''}</td>
                    <td className="px-4 py-3 text-gray-600">{a.phone}</td>
                    <td className="px-4 py-3 text-gray-600">{a.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.isVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {a.isVerified ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(a.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleStatus(a.id, a.isVerified)}
                        className={`text-xs px-3 py-1 rounded font-medium ${a.isVerified ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {a.isVerified ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Nouvel administrateur</h2>
            <div className="grid grid-cols-2 gap-3">
              {[['Prénom *', 'firstName'], ['Nom', 'lastName'], ['Téléphone *', 'phone'], ['Email', 'email']].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={key === 'email' ? 'email' : 'text'}
                    value={form[key as keyof AdminForm]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                <input type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={submit} disabled={saving || !form.firstName || !form.phone || !form.password}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
