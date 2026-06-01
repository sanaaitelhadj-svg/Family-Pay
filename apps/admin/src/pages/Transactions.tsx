import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { ArrowUpRight, Search, RefreshCw, CheckCircle2, XCircle, Clock, TrendingUp, CreditCard, Users, Store, AlertTriangle, X } from 'lucide-react';

interface Transaction {
  id: string; amount: number; status: string; pspTransactionId: string; createdAt: string;
  merchant: { businessName: string; category: string; city: string };
  authorization: { amount: number; fraudScore: number; beneficiary: { user: { firstName: string; phone: string } } };
}

const CAT_LABELS: Record<string,string> = {
  FOOD:'Alimentation', PHARMACY:'Pharmacie', CLOTHING:'Habillement',
  EDUCATION:'Éducation', LEISURE:'Loisirs', GENERAL:'Général'
};

const STATUS_CONFIG: Record<string,{label:string;color:string;bg:string;icon:any}> = {
  COMPLETED: { label:'Complétée', color:'#16A34A', bg:'#DCFCE7', icon:CheckCircle2 },
  FAILED:    { label:'Échouée',   color:'#DC2626', bg:'#FEE2E2', icon:XCircle },
  PENDING:   { label:'En attente',color:'#D97706', bg:'#FEF3C7', icon:Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label:status, color:'#6B7280', bg:'#F3F4F6', icon:Clock };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:cfg.color,background:cfg.bg}}>
      <Icon className="w-3 h-3"/>{cfg.label}
    </span>
  );
}

function FraudScore({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct < 30 ? '#16A34A' : pct < 60 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:color}}/>
      </div>
      <span className="text-xs font-semibold" style={{color}}>{pct}%</span>
    </div>
  );
}

function fmt(n: number) { return new Intl.NumberFormat('fr-MA',{style:'currency',currency:'MAD',maximumFractionDigits:0}).format(n); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

export default function Transactions() {
  const [list, setList]       = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail]   = useState<Transaction|null>(null);

  function load() {
    setLoading(true);
    const url = statusFilter ? `/admin/transactions?status=${statusFilter}` : '/admin/transactions';
    api.get(url).then(r => setList(r.data)).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(t =>
      t.merchant.businessName.toLowerCase().includes(q) ||
      t.authorization.beneficiary.user.firstName.toLowerCase().includes(q) ||
      t.authorization.beneficiary.user.phone.includes(q) ||
      t.pspTransactionId?.toLowerCase().includes(q)
    );
  }, [list, search]);

  const stats = useMemo(() => ({
    total:     list.length,
    volume:    list.reduce((s,t) => s + t.amount, 0),
    completed: list.filter(t => t.status === 'COMPLETED').length,
    failed:    list.filter(t => t.status === 'FAILED').length,
  }), [list]);

  return (
    <div className="h-full flex flex-col" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1A1040'}}>Transactions</h1>
          <p className="text-sm text-gray-400 mt-0.5">Historique des paiements</p>
        </div>
        <button onClick={load} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4"/><span>Actualiser</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total transactions', value: stats.total.toString(),            icon:CreditCard,  color:'#5B3DF5', bg:'#EDE9FF' },
          { label:'Volume total',        value: fmt(stats.volume),                icon:TrendingUp,  color:'#0EA5E9', bg:'#E0F2FE' },
          { label:'Complétées',          value: stats.completed.toString(),       icon:CheckCircle2,color:'#16A34A', bg:'#DCFCE7' },
          { label:'Échouées',            value: stats.failed.toString(),          icon:XCircle,     color:'#DC2626', bg:'#FEE2E2' },
        ].map(({ label, value, icon:Icon, color, bg }) => (
          <div key={label} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:bg}}>
              <Icon className="w-5 h-5" style={{color}}/>
            </div>
            <div><p className="text-xs text-gray-400 font-medium">{label}</p><p className="text-lg font-bold mt-0.5" style={{color:'#1A1040'}}>{value}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-3 mb-4 flex items-center gap-3 shadow-sm">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:'#F8F8FC'}}>
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher marchand, bénéficiaire, PSP ID…"
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"/>
          {search && <button onClick={()=>setSearch('')}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600"/></button>}
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none">
          <option value="">Tous les statuts</option>
          <option value="COMPLETED">Complétées</option>
          <option value="FAILED">Échouées</option>
          <option value="PENDING">En attente</option>
        </select>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* List */}
        <div style={{background:'#fff',border:'1px solid #ECECF2',flex: detail ? '0 0 55%' : '1'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Table header */}
          <div className="grid gap-3 px-4 py-3 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr',borderColor:'#ECECF2'}}>
            <span>Bénéficiaire</span><span>Marchand</span><span>Montant</span><span>Score fraude</span><span>Statut</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2"/>Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <CreditCard className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">Aucune transaction</p>
              </div>
            ) : filtered.map(t => (
              <button key={t.id} onClick={()=>setDetail(detail?.id===t.id?null:t)} className="w-full text-left transition-colors"
                style={{background: detail?.id===t.id ? '#F5F3FF' : undefined, borderBottom:'1px solid #ECECF2'}}>
                <div className="grid gap-3 px-4 py-3 items-center hover:bg-gray-50 transition-colors" style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr'}}>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.authorization.beneficiary.user.firstName}</p>
                    <p className="text-xs text-gray-400">{t.authorization.beneficiary.user.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.merchant.businessName}</p>
                    <p className="text-xs text-gray-400">{CAT_LABELS[t.merchant.category]||t.merchant.category} · {t.merchant.city}</p>
                  </div>
                  <p className="text-sm font-bold" style={{color:'#1A1040'}}>{fmt(t.amount)}</p>
                  <FraudScore score={t.authorization.fraudScore}/>
                  <StatusBadge status={t.status}/>
                </div>
              </button>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t text-xs text-gray-400" style={{borderColor:'#ECECF2'}}>
            {filtered.length} transaction{filtered.length!==1?'s':''} {list.length !== filtered.length ? `(${list.length} total)` : ''}
          </div>
        </div>

        {/* Detail panel */}
        {detail && (
          <div style={{background:'#fff',border:'1px solid #ECECF2',flex:'0 0 45%'}} className="rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b" style={{borderColor:'#ECECF2'}}>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Transaction</p>
                <h2 className="text-base font-bold" style={{color:'#1A1040'}}>{detail.merchant.businessName}</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{detail.pspTransactionId||detail.id.slice(0,16)+'…'}</p>
              </div>
              <button onClick={()=>setDetail(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Amount + status */}
              <div className="flex items-center justify-between p-4 rounded-2xl" style={{background:'#F8F8FC',border:'1px solid #ECECF2'}}>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Montant</p>
                  <p className="text-2xl font-bold" style={{color:'#1A1040'}}>{fmt(detail.amount)}</p>
                </div>
                <StatusBadge status={detail.status}/>
              </div>

              {/* Beneficiary */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5"/>Bénéficiaire
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{background:'#5B3DF5'}}>
                    {detail.authorization.beneficiary.user.firstName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{detail.authorization.beneficiary.user.firstName}</p>
                    <p className="text-xs text-gray-400">{detail.authorization.beneficiary.user.phone}</p>
                  </div>
                </div>
              </div>

              {/* Merchant */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5"/>Marchand
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Nom</span><span className="text-xs font-semibold text-gray-800">{detail.merchant.businessName}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Catégorie</span><span className="text-xs font-semibold text-gray-800">{CAT_LABELS[detail.merchant.category]||detail.merchant.category}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Ville</span><span className="text-xs font-semibold text-gray-800">{detail.merchant.city}</span></div>
                </div>
              </div>

              {/* Risk */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5"/>Analyse fraude
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-gray-400">Score de risque</span>
                      <span className="text-xs font-bold">{Math.round(detail.authorization.fraudScore*100)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width:`${Math.round(detail.authorization.fraudScore*100)}%`,
                        background: detail.authorization.fraudScore < 0.3 ? '#16A34A' : detail.authorization.fraudScore < 0.6 ? '#D97706' : '#DC2626'
                      }}/>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Montant autorisé</span><span className="text-xs font-semibold text-gray-800">{fmt(detail.authorization.amount)}</span></div>
                </div>
              </div>

              {/* Meta */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Détails</p>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Date</span><span className="text-xs font-semibold text-gray-800">{fmtDate(detail.createdAt)}</span></div>
                  <div className="flex justify-between items-center gap-2"><span className="text-xs text-gray-400 flex-shrink-0">PSP ID</span><span className="text-xs font-mono text-gray-600 truncate">{detail.pspTransactionId||'—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400">ID interne</span><span className="text-xs font-mono text-gray-600">{detail.id.slice(0,16)}…</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
