import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

const REASONS = ['Alimentation', 'Transport', 'Santé', 'Études', 'Loisirs', 'Autre'];
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export function FundRequestPage() {
  const [form, setForm] = useState({ amount: '', reason: REASONS[0], message: '' });
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['fund-requests'],
    queryFn: () => api.get('/api/fund-requests').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: () => api.post('/api/fund-requests', {
      amount: Number(form.amount),
      reason: form.reason,
      message: form.message,
    }),
    onSuccess: () => {
      toast.success('Demande envoyée !');
      setForm({ amount: '', reason: REASONS[0], message: '' });
      queryClient.invalidateQueries({ queryKey: ['fund-requests'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Erreur'),
  });

  return (
    <div className="space-y-4 py-2">
      <h2 className="text-xl font-bold text-gray-800">Demande de fonds</h2>

      {/* Form */}
      <div className="bg-white rounded-2xl shadow p-5 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Montant (MAD)</label>
          <input type="number" min="1" value={form.amount}
            onChange={e => setForm({...form, amount: e.target.value})}
            placeholder="Ex: 100"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
          <select value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {REASONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message (optionnel)</label>
          <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})}
            rows={2} placeholder="Explique ta demande..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={() => mutation.mutate()} disabled={!form.amount || mutation.isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl transition disabled:opacity-50">
          {mutation.isPending ? 'Envoi...' : '💸 Envoyer la demande'}
        </button>
      </div>

      {/* Existing requests */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Mes demandes</h3>
        {isLoading ? (
          <div className="text-center text-gray-400 py-4">Chargement...</div>
        ) : (requests ?? []).length === 0 ? (
          <div className="bg-white rounded-xl p-4 text-center text-gray-400 shadow">Aucune demande</div>
        ) : (
          <div className="space-y-2">
            {(requests ?? []).map((req: any) => (
              <div key={req.id} className="bg-white rounded-xl p-3 shadow flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{Number(req.amount).toFixed(2)} MAD</p>
                  <p className="text-xs text-gray-500">{req.reason}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
