import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

interface FundRequest {
  id: string;
  amount: string;
  currency: string;
  status: string;
  message: string | null;
  createdAt: string;
}

export function FundRequestPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  const { data: requests } = useQuery<FundRequest[]>({
    queryKey: ['fund-requests'],
    queryFn: () => api.get('/api/fund-requests').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/fund-requests', { amount: parseFloat(amount), message }),
    onSuccess: () => {
      toast.success('Demande envoyée !');
      setAmount('');
      setMessage('');
      qc.invalidateQueries({ queryKey: ['fund-requests'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Erreur lors de l\'envoi');
    },
  });

  const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'En attente', color: 'text-orange-600 bg-orange-50' },
    APPROVED: { label: 'Approuvée', color: 'text-emerald-600 bg-emerald-50' },
    REJECTED: { label: 'Refusée', color: 'text-red-600 bg-red-50' },
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Demande de fonds</h1>

      {/* New request form */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-700 mb-4">Nouvelle demande</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant (MAD)
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="100.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message (optionnel)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Pour les cours de soutien scolaire…"
            />
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={!amount || create.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {create.isPending ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </div>

      {/* Existing requests */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3">Mes demandes</h2>
        {!requests || requests.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm border border-gray-100">
            Aucune demande envoyée
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const s = STATUS_LABEL[req.status] ?? {
                label: req.status,
                color: 'text-gray-500 bg-gray-100',
              };
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-800">
                      {parseFloat(req.amount).toFixed(2)} {req.currency}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                  {req.message && (
                    <p className="text-sm text-gray-500 mt-1">{req.message}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">
                    {format(new Date(req.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
