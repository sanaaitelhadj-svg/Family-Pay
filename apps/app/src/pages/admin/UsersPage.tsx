import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

const ROLE_BADGES: Record<string, string> = {
  PAYER:       'bg-indigo-100 text-indigo-700',
  BENEFICIARY: 'bg-emerald-100 text-emerald-700',
  PARTNER:     'bg-blue-100 text-blue-700',
  ADMIN:       'bg-yellow-100 text-yellow-700',
};

export function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, role, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (role)   params.set('role', role);
      return api.get(`/api/admin/users?${params}`).then(r => r.data);
    },
    placeholderData: prev => prev,
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/users/${id}/toggle`),
    onSuccess: (res) => {
      toast.success(res.data.message);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Erreur'),
  });

  const users = data?.users ?? [];

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">👥 Gestion des utilisateurs</h1>
        <p className="text-gray-500 text-sm mt-1">{data?.total ?? 0} utilisateurs au total</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher par email, prénom, nom..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white"
        />
        <select
          value={role}
          onChange={e => { setRole(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
        >
          <option value="">Tous les rôles</option>
          <option value="PAYER">Payeur</option>
          <option value="BENEFICIARY">Bénéficiaire</option>
          <option value="PARTNER">Partenaire</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400 animate-pulse">Chargement...</div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Aucun utilisateur trouvé</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {users.map((u: any) => (
              <div key={u.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800">{u.firstName} {u.lastName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGES[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                    {!u.isActive && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Suspendu</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-400">
                    Créé le {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    {u.lastLoginAt && ` · Dernière connexion ${new Date(u.lastLoginAt).toLocaleDateString('fr-FR')}`}
                    {u.wallet && ` · Wallet: ${Number(u.wallet.balance).toFixed(2)} ${u.wallet.currency}`}
                  </p>
                </div>
                {u.role !== 'ADMIN' && (
                  <button
                    onClick={() => toggle.mutate(u.id)}
                    disabled={toggle.isPending}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${
                      u.isActive
                        ? 'bg-red-100 hover:bg-red-200 text-red-700'
                        : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                    }`}
                  >
                    {u.isActive ? 'Suspendre' : 'Réactiver'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {(data?.pages ?? 1) > 1 && (
            <div className="flex justify-center gap-2 py-4 border-t border-gray-100">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-sm">← Préc.</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {data?.pages}</span>
              <button disabled={page === data?.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-sm">Suiv. →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
