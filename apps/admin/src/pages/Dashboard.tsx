import { useEffect, useState } from 'react';
import { api } from '../api';

interface Stats {
  sponsors: number;
  beneficiaries: number;
  activeMerchants: number;
  totalTransactions: number;
  totalVolume: number;
  pendingFraudReview: number;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border-l-4 ${color}`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (!stats) return <p className="text-red-500">Erreur de chargement</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tableau de bord</h1>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard label="Sponsors" value={stats.sponsors} color="border-indigo-500" />
        <StatCard label="Bénéficiaires" value={stats.beneficiaries} color="border-purple-500" />
        <StatCard label="Marchands actifs" value={stats.activeMerchants} color="border-green-500" />
        <StatCard label="Transactions" value={stats.totalTransactions} color="border-blue-500" />
        <StatCard label="Volume (MAD)" value={stats.totalVolume.toFixed(2)} color="border-yellow-500" />
        <StatCard label="Fraude en attente" value={stats.pendingFraudReview} color="border-red-500" />
      </div>
    </div>
  );
}
