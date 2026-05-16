import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Stats {
  sponsors: number; beneficiaries: number; activeMerchants: number;
  totalTransactions: number; totalVolume: number; pendingFraudReview: number;
}

const CARDS = [
  { key: 'sponsors', label: 'Sponsors', color: 'border-indigo-500', link: '/sponsors' },
  { key: 'beneficiaries', label: 'Bénéficiaires', color: 'border-purple-500', link: '/beneficiaries' },
  { key: 'activeMerchants', label: 'Marchands actifs', color: 'border-green-500', link: '/merchants' },
  { key: 'totalTransactions', label: 'Transactions', color: 'border-blue-500', link: '/transactions' },
  { key: 'totalVolume', label: 'Volume (MAD)', color: 'border-yellow-500', link: '/transactions', format: (v: number) => v.toFixed(2) },
  { key: 'pendingFraudReview', label: 'Fraude en attente', color: 'border-red-500', link: '/fraud' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const navigate = useNavigate();

  useEffect(() => { api.get('/admin/stats').then(r => setStats(r.data)); }, []);

  if (!stats) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h1>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {CARDS.map(({ key, label, color, link, format }) => {
          const raw = stats[key as keyof Stats] as number;
          const value = format ? format(raw) : raw;
          return (
            <button key={key} onClick={() => navigate(link)}
              className={`bg-white rounded-2xl p-6 shadow-sm border-l-4 ${color} text-left hover:shadow-md transition-shadow cursor-pointer`}>
              <p className="text-sm text-gray-500 mb-1">{label}</p>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-indigo-500 mt-2">Voir détails →</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
