import { usePermissions } from '../contexts/PermissionsContext';
import { useEffect, useState } from 'react';
import { api } from '../api';

interface Auth {
  id: string;
  amount: number;
  fraudScore: number;
  createdAt: string;
  rejectionReason: string | null;
  beneficiary: { user: { firstName: string; phone: string } };
  merchant: { businessName: string; city: string; category?: string };
  allocation: { category: string; remainingAmount: number };
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 70) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">🔴 Risque ÉLEVÉ</span>;
  if (score >= 40) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">🟠 Risque MOYEN</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">🟡 Risque FAIBLE</span>;
}

function RejectModal({ onConfirm, onClose }: { onConfirm: (r: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Rejeter l'autorisation</h3>
        <p className="text-sm text-gray-500 mb-4">Indiquez la raison du rejet (min. 5 caractères)</p>
        <textarea
          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          rows={4}
          placeholder="Ex: Montant anormal, marchand hors catégorie autorisée..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => reason.trim().length >= 5 && onConfirm(reason.trim())}
            disabled={reason.trim().length < 5}
            className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-40">
            Confirmer le rejet
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthCard({ auth, canApprove, canReject, onApprove, onReject }: {
  auth: Auth; canApprove: boolean; canReject: boolean; onApprove: () => void; onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const score = Math.min(auth.fraudScore, 100);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{auth.beneficiary.user.firstName} — {auth.beneficiary.user.phone}</p>
            <RiskBadge score={auth.fraudScore} />
          </div>
          <p className="text-sm text-gray-500">{auth.merchant.businessName} · {auth.merchant.city}</p>
          <div className="flex gap-4 text-sm flex-wrap">
            <span className="font-semibold text-gray-800">{Number(auth.amount).toLocaleString('fr-FR')} MAD</span>
            <span className="text-orange-600 font-medium">Score : {auth.fraudScore}/100</span>
            <span className="text-gray-400">{auth.allocation.category}</span>
            <span className="text-gray-400 text-xs">{new Date(auth.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <button onClick={() => setExpanded(e => !e)}
            className="px-3 py-2 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            {expanded ? 'Moins ▲' : 'Détails ▼'}
          </button>
          <button onClick={onApprove} disabled={!canApprove}
            className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 disabled:opacity-40">Approuver</button>
          <button onClick={onReject} disabled={!canReject}
            className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-40">Rejeter</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-gray-50 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-2">Score de risque</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all ${score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-orange-400' : 'bg-yellow-400'}`}
                    style={{ width: `${score}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-6">{auth.fraudScore}</span>
              </div>
              <p className="text-xs text-gray-500">
                {score >= 70 ? 'Probabilité élevée de fraude' : score >= 40 ? 'Transaction inhabituelle' : 'Transaction a priori normale'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Allocation</p>
              <p className="text-gray-700 font-medium">{auth.allocation.category}</p>
              <p className="text-xs text-gray-500 mt-0.5">Solde : <span className="font-semibold text-gray-700">{Number(auth.allocation.remainingAmount).toLocaleString('fr-FR')} MAD</span></p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Marchand</p>
              <p className="text-gray-700 font-medium">{auth.merchant.businessName}</p>
              <p className="text-xs text-gray-500">{auth.merchant.city}{auth.merchant.category ? ` · ${auth.merchant.category}` : ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Bénéficiaire</p>
              <p className="text-gray-700 font-medium">{auth.beneficiary.user.firstName}</p>
              <p className="text-xs text-gray-500">{auth.beneficiary.user.phone}</p>
            </div>
          </div>
          {auth.rejectionReason && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs text-red-500 uppercase font-medium mb-1">Raison du rejet précédent</p>
              <p className="text-sm text-red-700">{auth.rejectionReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FraudReview() {
  const { can, loading: permsLoading } = usePermissions();
  const [list, setList] = useState<Auth[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get('/admin/fraud-review').then(r => setList(r.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function approve(id: string) {
    await api.patch(`/admin/${id}/approve`);
    load();
  }

  async function reject(id: string, reason: string) {
    await api.patch(`/admin/${id}/reject`, { reason });
    setRejectTarget(null);
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {rejectTarget && (
        <RejectModal
          onConfirm={reason => reject(rejectTarget, reason)}
          onClose={() => setRejectTarget(null)}
        />
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revue fraude</h1>
          <p className="text-sm text-gray-500 mt-1">Autorisations en attente de décision manuelle</p>
        </div>
        {list.length > 0 && (
          <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-semibold">{list.length} en attente</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-500 shadow-sm">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-lg font-medium">Aucune autorisation en attente</p>
          <p className="text-sm text-gray-400 mt-1">Toutes les transactions ont été traitées.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map(auth => (
            <AuthCard key={auth.id} auth={auth}
              canApprove={!permsLoading && can('fraud','approve')}
              canReject={!permsLoading && can('fraud','reject')}
              onApprove={() => approve(auth.id)}
              onReject={() => setRejectTarget(auth.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
