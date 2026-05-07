import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { value: 'all',      label: 'Tous' },
  { value: 'pending',  label: '⏳ En attente' },
  { value: 'verified', label: '✅ Vérifiés' },
];

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: '🍕', pharmacie: '💊', epicerie: '🛒',
  vetements: '👗', education: '📚', loisirs: '🎮', general: '🏪',
};

interface Condition { id: string; title: string; description: string; isRequired: boolean; order: number; }
interface Partner {
  id: string; businessName: string; category: string; city?: string;
  isVerified: boolean; isActive: boolean; createdAt: string;
  rejectionReason?: string; approvedAt?: string; contractGeneratedAt?: string;
  user?: { email?: string; firstName?: string; lastName?: string };
  wallet?: { balance: number; currency: string };
  _count?: { transactions: number };
}

// ── Contract preview modal ───────────────────────────────────────────────────
function ContractModal({ contract, onClose }: { contract: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">📄 Contrat de Partenariat FamilyPay</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5 text-sm text-gray-700">
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-400 text-xs">Partenaire</span><p className="font-semibold">{contract.businessName}</p></div>
              <div><span className="text-gray-400 text-xs">Représentant</span><p className="font-semibold">{contract.partnerName || '—'}</p></div>
              <div><span className="text-gray-400 text-xs">Email</span><p>{contract.email}</p></div>
              <div><span className="text-gray-400 text-xs">Catégorie</span><p className="capitalize">{contract.category}</p></div>
              {contract.city && <div><span className="text-gray-400 text-xs">Ville</span><p>{contract.city}</p></div>}
              <div><span className="text-gray-400 text-xs">Date d'approbation</span><p>{contract.approvedDate}</p></div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-800 mb-3">Conditions contractuelles</h3>
            <div className="space-y-3">
              {contract.conditions.map((c: Condition, i: number) => (
                <div key={c.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 flex items-center gap-2">
                      {c.title}
                      {c.isRequired && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Obligatoire</span>}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-800">
            <p className="font-semibold mb-1">⚠️ Document généré le {new Date(contract.generatedAt).toLocaleString('fr-FR')}</p>
            <p>Ce document est généré automatiquement par la plateforme ALTIVAX FamilyPay. Il vaut accord contractuel entre ALTIVAX et le partenaire à compter de la date d'approbation.</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={() => window.print()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            🖨️ Imprimer
          </button>
          <button
            onClick={onClose}
            className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export function AdminPartnersPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  // Modals
  const [approveModal, setApproveModal] = useState<Partner | null>(null);
  const [rejectModal, setRejectModal] = useState<Partner | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [contractData, setContractData] = useState<any>(null);

  // Conditions checklist state
  const [checkedConditions, setCheckedConditions] = useState<Record<string, boolean>>({});

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['admin-partners', status, page],
    queryFn: () => api.get(`/api/admin/partners?status=${status}&page=${page}&limit=20`).then(r => r.data),
  });

  const { data: condData } = useQuery({
    queryKey: ['admin-conditions'],
    queryFn: () => api.get('/api/admin/settings/conditions').then(r => r.data),
  });
  const conditions: Condition[] = (condData?.conditions ?? []).filter((c: any) => c.isActive);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/partners/${id}/approve`),
    onSuccess: () => {
      toast.success('Partenaire approuvé ✅');
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setApproveModal(null);
      setCheckedConditions({});
    },
    onError: () => toast.error('Erreur lors de l\'approbation'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/api/admin/partners/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Partenaire refusé');
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setRejectModal(null);
      setRejectReason('');
    },
    onError: () => toast.error('Erreur lors du refus'),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/partners/${id}/approve`),
    onSuccess: () => {
      toast.success('Partenaire réactivé ✅');
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Erreur'),
  });

  const generateContract = useMutation({
    mutationFn: (id: string) => api.get(`/api/admin/partners/${id}/contract`).then(r => r.data),
    onSuccess: (data: any) => {
      setContractData(data.contract);
      toast.success('Contrat généré 📄');
      qc.invalidateQueries({ queryKey: ['admin-partners'] });
    },
    onError: () => toast.error('Erreur lors de la génération du contrat'),
  });

  // ── Checklist helpers ─────────────────────────────────────────────────────
  function openApproveModal(p: Partner) {
    setApproveModal(p);
    // Init all optional conditions as checked, required ones unchecked
    const init: Record<string, boolean> = {};
    conditions.forEach(c => { init[c.id] = !c.isRequired; });
    setCheckedConditions(init);
  }

  const requiredAll = conditions.filter(c => c.isRequired).every(c => checkedConditions[c.id]);
  const canApprove = conditions.filter(c => c.isRequired).length === 0 || requiredAll;

  function handleApproveSubmit() {
    if (!canApprove) {
      toast.error('Toutes les conditions obligatoires doivent être cochées');
      return;
    }
    if (approveModal) approve.mutate(approveModal.id);
  }

  const partners: Partner[] = data?.partners ?? [];

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🏪 Gestion des partenaires</h1>
        <p className="text-gray-500 text-sm mt-1">Validation et suivi des partenaires marchands</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-1 shadow-sm w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              status === tab.value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400 animate-pulse">Chargement...</div>
      ) : partners.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
          Aucun partenaire {status === 'pending' ? 'en attente' : status === 'verified' ? 'vérifié' : ''}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 text-sm text-gray-500">
            {data?.total ?? 0} partenaire(s) trouvé(s)
          </div>
          <div className="divide-y divide-gray-50">
            {partners.map((p: Partner) => (
              <div key={p.id} className="px-5 py-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-3xl mt-1">{CATEGORY_ICONS[p.category] ?? '🏪'}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{p.businessName}</p>
                      {p.isVerified
                        ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Vérifié</span>
                        : p.isActive
                          ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">En attente</span>
                          : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Refusé / Suspendu</span>
                      }
                      {p.contractGeneratedAt && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">📄 Contrat émis</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{p.user?.email} · {p.category}</p>
                    {p.city && <p className="text-xs text-gray-400">📍 {p.city}</p>}
                    <p className="text-xs text-gray-400">
                      Inscrit le {new Date(p.createdAt).toLocaleDateString('fr-FR')} ·{' '}
                      {p._count?.transactions ?? 0} transaction(s) ·{' '}
                      Wallet : {Number(p.wallet?.balance ?? 0).toFixed(2)} MAD
                    </p>
                    {p.rejectionReason && (
                      <p className="text-xs text-red-500 mt-1 bg-red-50 px-2 py-1 rounded-lg">
                        🚫 Motif : {p.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  {/* Pending partner → Approve + Reject */}
                  {!p.isVerified && p.isActive && (
                    <>
                      <button
                        onClick={() => openApproveModal(p)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        ✅ Approuver
                      </button>
                      <button
                        onClick={() => { setRejectModal(p); setRejectReason(''); }}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        🚫 Refuser
                      </button>
                    </>
                  )}
                  {/* Verified partner → Contract + Suspend */}
                  {p.isVerified && p.isActive && (
                    <>
                      <button
                        onClick={() => generateContract.mutate(p.id)}
                        disabled={generateContract.isPending}
                        className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        {generateContract.isPending ? '…' : '📄 Contrat'}
                      </button>
                      <button
                        onClick={() => { setRejectModal(p); setRejectReason(''); }}
                        className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Suspendre
                      </button>
                    </>
                  )}
                  {/* Rejected / suspended → Reactivate */}
                  {!p.isActive && (
                    <button
                      onClick={() => reactivate.mutate(p.id)}
                      disabled={reactivate.isPending}
                      className="bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Réactiver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(data?.pages ?? 1) > 1 && (
            <div className="flex justify-center gap-2 py-4 border-t border-gray-100">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-sm">← Préc.</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {data?.pages}</span>
              <button disabled={page === data?.pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 disabled:opacity-40 text-sm">Suiv. →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Approve Modal ─────────────────────────────────────────────────── */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800">✅ Approuver le partenaire</h2>
                <p className="text-sm text-gray-500">{approveModal.businessName}</p>
              </div>
              <button onClick={() => { setApproveModal(null); setCheckedConditions({}); }}
                className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {conditions.length === 0 ? (
                <div className="text-center text-gray-400 py-6">
                  <p className="text-sm">Aucune condition active configurée.</p>
                  <p className="text-xs mt-1">Configurez les conditions dans l'onglet Paramètres.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Cochez toutes les conditions <span className="font-semibold text-red-600">obligatoires</span> pour valider l'approbation.
                  </p>
                  {conditions.map(c => (
                    <label key={c.id} className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      checkedConditions[c.id] ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={!!checkedConditions[c.id]}
                        onChange={e => setCheckedConditions(prev => ({ ...prev, [c.id]: e.target.checked }))}
                        className="w-4 h-4 accent-emerald-600 mt-0.5 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                          {c.title}
                          {c.isRequired && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Obligatoire</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {!canApprove && conditions.some(c => c.isRequired) && (
                <p className="text-xs text-red-500 mt-3 flex items-center gap-1">
                  ⚠️ Toutes les conditions obligatoires doivent être cochées
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setApproveModal(null); setCheckedConditions({}); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleApproveSubmit}
                disabled={approve.isPending || !canApprove}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition"
              >
                {approve.isPending ? 'Approbation…' : '✅ Confirmer l\'approbation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800">
                  {rejectModal.isVerified ? '⏸️ Suspendre le partenaire' : '🚫 Refuser le partenaire'}
                </h2>
                <p className="text-sm text-gray-500">{rejectModal.businessName}</p>
              </div>
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Motif <span className="text-gray-400 font-normal">(optionnel — transmis au partenaire)</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={4}
                  placeholder={rejectModal.isVerified
                    ? "Ex : Activité suspendue suite à un contrôle de conformité…"
                    : "Ex : Dossier incomplet — merci de fournir votre registre de commerce…"}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-700">
                Une notification sera automatiquement envoyée au partenaire avec ce motif.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => reject.mutate({ id: rejectModal.id, reason: rejectReason })}
                disabled={reject.isPending}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition"
              >
                {reject.isPending ? 'Envoi…' : rejectModal.isVerified ? '⏸️ Suspendre' : '🚫 Refuser & notifier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contract Modal ─────────────────────────────────────────────────── */}
      {contractData && <ContractModal contract={contractData} onClose={() => setContractData(null)} />}
    </div>
  );
}
