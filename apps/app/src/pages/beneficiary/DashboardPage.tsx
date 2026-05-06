import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export function BeneficiaryDashboard() {
  const user = useAuthStore(s => s.user);
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => api.get('/api/wallets/me').then(r => r.data) });
  const envelopes = wallet?.envelopes ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-lg">
        <p className="text-emerald-200 text-sm mb-1">Solde disponible</p>
        <p className="text-4xl font-bold">{parseFloat(wallet?.balance ?? '0').toFixed(2)} <span className="text-2xl font-normal">{wallet?.currency ?? 'MAD'}</span></p>
        <p className="text-emerald-300 text-sm mt-2">Bonjour, {user?.firstName} 👋</p>
      </div>
      <Link to="/beneficiary/qr" className="block bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 text-center hover:bg-emerald-100 transition">
        <div className="text-4xl mb-2">📱</div>
        <p className="font-semibold text-emerald-800">Générer mon QR code</p>
        <p className="text-sm text-emerald-600 mt-1">Pour recevoir un paiement</p>
      </Link>
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Mes enveloppes</h2>
        {envelopes.length === 0
          ? <div className="bg-white rounded-xl p-4 text-center text-gray-400 text-sm border border-gray-100">Aucune enveloppe</div>
          : <div className="space-y-3">
            {envelopes.map((env: any) => (
              <div key={env.id} className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-100">
                <div><p className="font-medium text-gray-800">{env.label}</p><p className="text-xs text-gray-500">{env.category}</p></div>
                <div className="text-right"><p className="font-semibold text-emerald-700">{parseFloat(env.balance).toFixed(2)}</p><p className="text-xs text-gray-400">MAD</p></div>
              </div>
            ))}
          </div>
        }
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/beneficiary/transactions" className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100 hover:border-emerald-300 transition">
          <div className="text-2xl mb-1">📋</div><p className="text-sm font-medium text-gray-700">Historique</p>
        </Link>
        <Link to="/beneficiary/fund-request" className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100 hover:border-emerald-300 transition">
          <div className="text-2xl mb-1">💰</div><p className="text-sm font-medium text-gray-700">Demande de fonds</p>
        </Link>
      </div>
    </div>
  );
}
