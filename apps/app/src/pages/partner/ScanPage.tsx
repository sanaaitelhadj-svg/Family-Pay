import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';

interface PaymentResult {
  transactionId: string;
  amount: number;
  newBalance: number;
  partnerName: string;
}

export function PartnerScanPage() {
  const qc = useQueryClient();
  const [token, setToken] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !amount) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/api/payments', {
        token: token.trim(),
        amount: parseFloat(amount),
      });
      setResult(data);
      setToken('');
      setAmount('');
      toast.success('Paiement accepté !');
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    } catch (err: any) {
      const code = err.response?.data?.error;
      const msg = err.response?.data?.message;
      if (code === 'QR_INVALID_OR_EXPIRED') toast.error('QR code expiré ou invalide');
      else if (code === 'QR_ALREADY_USED') toast.error('QR code déjà utilisé');
      else if (code === 'INSUFFICIENT_BALANCE') toast.error('Solde insuffisant');
      else toast.error(msg ?? 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Scanner un QR code</h1>
        <p className="text-sm text-gray-500 mt-1">
          Entrez le token QR et le montant pour accepter un paiement
        </p>
      </div>

      {/* Résultat du paiement */}
      {result && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 text-center">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-xl font-bold text-emerald-700">
            +{result.amount.toFixed(2)} MAD reçus
          </p>
          <p className="text-sm text-emerald-600 mt-1">
            Transaction : {result.transactionId.slice(0, 8)}…
          </p>
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handlePayment} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Token QR
          </label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Collez ici le token QR du bénéficiaire (JWT)…"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Le bénéficiaire vous montre son QR — copiez le contenu
          </p>
        </div>

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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="50.00"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || !token.trim() || !amount}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-base"
        >
          {loading ? 'Traitement…' : '💳 Valider le paiement'}
        </button>
      </form>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        <strong>ℹ️ Comment ça marche :</strong> Le bénéficiaire génère un QR code valable 60s.
        Copiez le token JWT et saisissez le montant pour encaisser.
      </div>
    </div>
  );
}
