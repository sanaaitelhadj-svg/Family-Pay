import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';

const ICONS: Record<string, string> = { FOOD:'🍕',HEALTH:'💊',CLOTHES:'👗',EDUCATION:'📚',LEISURE:'🎮',GENERAL:'💰' };

export function PayerDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['payer-dashboard'],
    queryFn: () => api.get('/api/dashboard/payer').then(r => r.data),
  });
  const { data: fundRequests } = useQuery({
    queryKey: ['fund-requests'],
    queryFn: () => api.get('/api/fund-requests').then(r => r.data),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/api/fund-requests/${id}/approve`),
    onSuccess: () => { toast.success('Approuvée !'); qc.invalidateQueries({ queryKey: ['fund-requests'] }); qc.invalidateQueries({ queryKey: ['payer-dashboard'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Erreur'),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/api/fund-requests/${id}/reject`),
    onSuccess: () => { toast.success('Refusée'); qc.invalidateQueries({ queryKey: ['fund-requests'] }); },
  });
  const pending = (fundRequests ?? []).filter((r: any) => r.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bonjour, {user?.firstName} 👋</h1>
          <p className="text-gray-500 text-sm">Tableau de bord Payeur</p>
        </div>
        <Link to="/payer/envelopes/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Nouvelle enveloppe
        </Link>
      </div>
      {dashboard && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-2xl p-6">
          <p className="text-sm opacity-80">Solde wallet principal</p>
          <p className="text-4xl font-bold mt-1">{Number(dashboard.payerWallet?.balance ?? 0).toFixed(2)} MAD</p>
        </div>
      )}
      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h2 className="font-semibold text-yellow-800 mb-3">🔔 {pending.length} demande(s) en attente</h2>
          {pending.map((req: any) => (
            <div key={req.id} className="bg-white rounded-lg p-3 flex items-center justify-between shadow-sm mb-2">
              <div>
                <p className="font-medium text-gray-800">{req.sender?.firstName} {req.sender?.lastName}</p>
                <p className="text-sm text-gray-500">{req.message}</p>
                <p className="text-indigo-600 font-bold">{Number(req.amount).toFixed(2)} MAD</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approve.mutate(req.id)} className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm">✓</button>
                <button onClick={() => reject.mutate(req.id)} className="bg-red-400 text-white px-3 py-1 rounded-lg text-sm">✗</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Mes bénéficiaires</h2>
        {isLoading ? <p className="text-gray-400 text-sm">Chargement...</p>
          : (dashboard?.beneficiaries ?? []).length === 0
            ? <div className="bg-white rounded-xl p-6 text-center text-gray-400 border border-dashed">Aucun bénéficiaire</div>
            : <div className="grid gap-4">
              {(dashboard?.beneficiaries ?? []).map((b: any) => (
                <div key={b.userId} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{b.email}</p>
                      <p className="text-sm text-gray-500">Solde : <span className="text-indigo-600 font-bold">{Number(b.walletBalance).toFixed(2)} MAD</span></p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-xl">👤</div>
                  </div>
                  {b.envelopes?.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {b.envelopes.filter((e: any) => e.isActive).map((env: any) => (
                        <div key={env.id} className="bg-gray-50 rounded-lg p-2 text-center">
                          <div className="text-lg">{ICONS[env.category] ?? '💰'}</div>
                          <div className="text-xs text-gray-500 truncate">{env.label}</div>
                          <div className="text-sm font-bold text-indigo-600">{Number(env.balance).toFixed(0)} MAD</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
