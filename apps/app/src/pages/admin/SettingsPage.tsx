import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

interface Condition {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  order: number;
  isActive: boolean;
  createdAt: string;
}

const EMPTY: Omit<Condition, 'id' | 'createdAt'> = {
  title: '',
  description: '',
  isRequired: true,
  order: 0,
  isActive: true,
};

export function AdminSettingsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; editing: Condition | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ ...EMPTY });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Fetch conditions ──────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['admin-conditions'],
    queryFn: () => api.get('/api/admin/settings/conditions').then(r => r.data),
  });
  const conditions: Condition[] = data?.conditions ?? [];

  // ── Create ────────────────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: (body: typeof EMPTY) => api.post('/api/admin/settings/conditions', body),
    onSuccess: () => {
      toast.success('Condition créée ✅');
      qc.invalidateQueries({ queryKey: ['admin-conditions'] });
      closeModal();
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  // ── Update ────────────────────────────────────────────────────────────────
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<typeof EMPTY> }) =>
      api.patch(`/api/admin/settings/conditions/${id}`, body),
    onSuccess: () => {
      toast.success('Condition mise à jour ✅');
      qc.invalidateQueries({ queryKey: ['admin-conditions'] });
      closeModal();
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/settings/conditions/${id}`),
    onSuccess: () => {
      toast.success('Condition supprimée');
      qc.invalidateQueries({ queryKey: ['admin-conditions'] });
      setDeleteConfirm(null);
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  // ── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/admin/settings/conditions/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-conditions'] }),
    onError: () => toast.error('Erreur'),
  });

  function openCreate() {
    setForm({ ...EMPTY, order: conditions.length + 1 });
    setModal({ open: true, editing: null });
  }

  function openEdit(c: Condition) {
    setForm({ title: c.title, description: c.description, isRequired: c.isRequired, order: c.order, isActive: c.isActive });
    setModal({ open: true, editing: c });
  }

  function closeModal() {
    setModal({ open: false, editing: null });
    setForm({ ...EMPTY });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Titre et description requis');
      return;
    }
    if (modal.editing) {
      update.mutate({ id: modal.editing.id, body: form });
    } else {
      create.mutate(form);
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚙️ Paramètres</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez les conditions contractuelles du partenariat</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2"
        >
          <span>＋</span> Nouvelle condition
        </button>
      </div>

      {/* ── Conditions list ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400 animate-pulse">Chargement...</div>
      ) : conditions.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-medium">Aucune condition définie</p>
          <p className="text-sm mt-1">Créez les clauses contractuelles que les partenaires devront accepter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">{conditions.length} condition(s) configurée(s)</span>
            <span className="text-xs text-gray-400">Glissez pour réordonner (bientôt)</span>
          </div>
          <div className="divide-y divide-gray-50">
            {conditions.map((c, idx) => (
              <div key={c.id} className={`px-5 py-4 flex gap-4 ${!c.isActive ? 'opacity-50' : ''}`}>
                {/* Order badge */}
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-500">
                  {c.order || idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 truncate">{c.title}</p>
                    {c.isRequired && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        Obligatoire
                      </span>
                    )}
                    {!c.isActive && (
                      <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive.mutate({ id: c.id, isActive: !c.isActive })}
                    className={`text-xs px-2.5 py-1 rounded-lg transition ${
                      c.isActive
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {c.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(c.id)}
                    className="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2.5 py-1 rounded-lg transition"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Info block ──────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">💡 Comment ça fonctionne</p>
        <ul className="space-y-1 text-blue-600 list-disc list-inside">
          <li>Les conditions <strong>obligatoires</strong> doivent toutes être acceptées avant approbation.</li>
          <li>Les conditions <strong>optionnelles</strong> sont présentées au partenaire mais ne bloquent pas la validation.</li>
          <li>Seules les conditions <strong>actives</strong> apparaissent dans la checklist d'approbation.</li>
          <li>Toute modification s'applique aux nouveaux dossiers uniquement.</li>
        </ul>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">
                {modal.editing ? '✏️ Modifier la condition' : '➕ Nouvelle condition'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Ex : Commission de transaction"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  placeholder="Détail complet de la clause contractuelle…"
                  required
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
                  <input
                    type="number"
                    min={0}
                    value={form.order}
                    onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div className="flex flex-col gap-3 justify-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isRequired}
                      onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))}
                      className="w-4 h-4 accent-gray-900"
                    />
                    <span className="text-sm font-medium text-gray-700">Obligatoire</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                      className="w-4 h-4 accent-gray-900"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition"
                >
                  {isPending ? 'Enregistrement…' : modal.editing ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="font-bold text-gray-800 mb-2">Supprimer cette condition ?</h3>
            <p className="text-sm text-gray-500 mb-5">Cette action est irréversible. La condition sera définitivement supprimée.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => remove.mutate(deleteConfirm)}
                disabled={remove.isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition"
              >
                {remove.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
