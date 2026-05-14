import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍕', HEALTH: '💊', CLOTHES: '👗',
  EDUCATION: '📚', LEISURE: '🎮', GENERAL: '💰',
};

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/api/wallets/me').then(r => r.data),
  });

  return (
    <div className="space-y-4 py-2">
      {/* Greeting */}
      <div className="bg-emerald-700 text-white rounded-2xl p-5 shadow">
        <p className="text-emerald-200 text-sm">Bonjour,</p>
        <h2 className="text-2xl font-bold">{user?.firstName} 👋</h2>
        <div className="mt-3">
          <p className="text-emerald-300 text-xs uppercase tracking-wide">Solde total</p>
          <p className="text-3xl font-bold">
            {isLoading ? '...' : `${Number(wallet?.balance ?? 0).toFixed(2)} MAD`}
          </p>
        </div>
      </div>

      {/* QR CTA */}
      <Link to="/qr"
        className="block bg-white border-2 border-emerald-500 rounded-2xl p-5 text-center shadow hover:shadow-md transition">
        <div className="text-4xl mb-2">📱</div>
        <p className="font-bold text-emerald-700 text-lg">Générer mon QR Code</p>
        <p className="text-gray-500 text-sm mt-1">Payer chez un partenaire</p>
      </Link>

      {/* Envelopes */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Mes enveloppes</h3>
        {isLoading ? (
          <div className="text-center text-gray-400 py-4">Chargement...</div>
        ) : wallet?.envelopes?.length === 0 ? (
          <div className="bg-white rounded-xl p-4 text-center text-gray-400 shadow">
            Aucune enveloppe — demande à ton payeur d'en créer une
          </div>
        ) : (
          <div className="space-y-2">
            {wallet?.envelopes?.map((env: any) => (
              <div key={env.id} className="bg-white rounded-xl p-4 shadow flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CATEGORY_ICONS[env.category] ?? '💰'}</span>
                  <div>
                    <p className="font-medium text-gray-800">{env.label}</p>
                    <p className="text-xs text-gray-500">Max {Number(env.maxPerTransaction).toFixed(0)} MAD/tx</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-700">{Number(env.balance).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">MAD</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/transactions" className="bg-white rounded-xl p-4 text-center shadow hover:shadow-md transition">
          <div className="text-2xl mb-1">📋</div>
          <p className="text-sm font-medium text-gray-700">Historique</p>
        </Link>
        <Link to="/fund-request" className="bg-white rounded-xl p-4 text-center shadow hover:shadow-md transition">
          <div className="text-2xl mb-1">💸</div>
          <p className="text-sm font-medium text-gray-700">Demander fonds</p>
        </Link>
      </div>
    </div>
  );
}
