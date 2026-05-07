import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { value: 'all',     label: 'Tous' },
  { value: 'pending', label: '⏳ En attente' },
  { value: 'verified', label: '✅ Vérifiés' },
];

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: '🍕', pharmacie: '💊', epicerie: '🛒',
  vetements: '👗', education: '📚', loisirs: '🎮', general: '🏪',
};

export function AdminPartnersPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-partners', status, page],
    queryFn: () => api.get(`/api/admin/partners?status=${status}&page=${page}&limit=20`).then(r => r.data),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/partners/${id}/approve`),
    onSuccess: () => {
      toast.success('Partenaire approuvé ✅');
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Erreur lors de l\'approbation'),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/partners/${id}/reject`),
    onSuccess: () => {
      toast.success('Partenaire refusé');
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Erreur lors du refus'),
  });

  const partners = data?.partners ?? [];

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🏪 Gestion des partenaires</h1>
        <p className="text-gray-500 text-sm mt-1">Validation et suivi des partenaires marchands</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-1 shadow-sm w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              status === tab.value
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400 animate-pulse">Chargement...</div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
          Aucun partenaire {status === 'pending' ? 'en attente' : status === 'verified' ? 'vérifié' : ''}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 text-sm text-gray-500">
            {data?.total ?? 0} partenaire(s) trouvé(s)
          </div>
          <div className="divide-y divide-gray-50">
            {partners.map((p: any) => (
              <div key={p.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{CATEGORY_ICONS[p.category] ?? '🏪'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">{p.businessName}</p>
                      {p.isVerified
                        ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Vérifié</span>
                        : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">En attente</span>
                      }
                      {!p.isActive && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Suspendu</span>}
                    </div>
                    <p className="text-sm text-gray-500">{p.user?.email} · {p.category}</p>
                    {p.city && <p className="text-xs text-gray-400">📍 {p.city}</p>}
                    <p className="text-xs text-gray-400">
                      Inscrit le {new Date(p.createdAt).toLocaleDateString('fr-FR')} ·{' '}
                      {p._count?.transactions ?? 0} transaction(s) ·{' '}
                      Wallet : {Number(p.wallet?.balance ?? 0).toFixed(2)} MAD
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  {!p.isVerified && (
                    <button
                      onClick={() => approve.mutate(p.id)}
                      disabled={approve.isPending}
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      ✅ Approuver
                    </button>
                  )}
                  {p.isActive && p.isVerified && (
                    <button
                      onClick={() => reject.mutate(p.id)}
                      disabled={reject.isPending}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Suspendre
                    </button>
                  )}
                  {!p.isActive && (
                    <button
                      onClick={() => approve.mutate(p.id)}
                      disabled={approve.isPending}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Réactiver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(data?.pages ?? 1) > 1 && (
            <div className="flex justify-center gap-2 py-4 border-t border-gray-100">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-sm"
              >← Préc.</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {data?.pages}</span>
              <button
                disabled={page === data?.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-sm"
              >Suiv. →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
