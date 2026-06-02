import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { DollarSign, TrendingUp, Clock, CheckCircle2, AlertCircle, RefreshCw, Search, X, Store } from 'lucide-react';

interface Commission {
  id: string; amount: number; rate: number; commissionType: string; status: string; createdAt: string;
  merchant: { businessName: string; city: string; category: string };
  transaction: { amount: number; createdAt: string; pspTransactionId: string };
  sponsor: { user: { firstName: string; phone: string } };
}
interface CommStats {
  total: { _sum: { amount: number|null }; _count: number };
  byMerchant: { merchantId: string; _sum: { amount: number }; _count: number }[];
  byStatus: { status: string; _sum: { amount: number }; _count: number }[];
}

const CAT_LABELS: Record<string,string> = {
  FOOD:'Alimentation', PHARMACY:'Pharmacie', CLOTHING:'Habillement',
  EDUCATION:'Éducation', LEISURE:'Loisirs', GENERAL:'Général'
};
const STATUS_CFG: Record<string,{label:string;color:string;bg:string;icon:any}> = {
  PENDING:   {label:'En attente', color:'#D97706', bg:'#FEF3C7', icon:Clock},
  COLLECTED: {label:'Collectée',  color:'#16A34A', bg:'#DCFCE7', icon:CheckCircle2},
  DISPUTED:  {label:'Contestée', color:'#DC2626', bg:'#FEE2E2', icon:AlertCircle},
};

function fmt(n: number) { return new Intl.NumberFormat('fr-MA',{style:'currency',currency:'MAD',maximumFractionDigits:2}).format(n); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); }

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status]||{label:status,color:'#6B7280',bg:'#F3F4F6',icon:Clock};
  const Icon = cfg.icon;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:cfg.color,background:cfg.bg}}><Icon className="w-3 h-3"/>{cfg.label}</span>;
}

export default function Commissions() {
  const [list, setList]       = useState<Commission[]>([]);
  const [stats, setStats]     = useState<CommStats|null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');
  const [search, setSearch]   = useState('');
  const [detail, setDetail]   = useState<Commission|null>(null);

  function load() {
    setLoading(true);
    const url = filter ? `/admin/commissions?status=${filter}` : '/admin/commissions';
    Promise.all([api.get(url), api.get('/admin/commissions/stats')])
      .then(([r1,r2])=>{ setList(r1.data); setStats(r2.data); })
      .finally(()=>setLoading(false));
  }
  useEffect(load, [filter]);

  const filtered = useMemo(()=>{
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      c.merchant.businessName.toLowerCase().includes(q) ||
      c.sponsor.user.firstName.toLowerCase().includes(q) ||
      c.sponsor.user.phone.includes(q)
    );
  },[list,search]);

  const totalAmount = Number(stats?.total._sum.amount??0);
  const totalCount  = stats?.total._count??0;
  const pending   = stats?.byStatus.find(s=>s.status==='PENDING')?._sum.amount??0;
  const collected = stats?.byStatus.find(s=>s.status==='COLLECTED')?._sum.amount??0;

  return (
    <div className="h-full flex flex-col" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1A1040'}}>Commissions</h1>
          <p className="text-sm text-gray-400 mt-0.5">Suivi des commissions marchand</p>
        </div>
        <button onClick={load} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4"/>Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {label:'Total commissions', value:fmt(totalAmount), sub:`${totalCount} entrées`,   icon:DollarSign,  color:'#5B3DF5', bg:'#EDE9FF'},
          {label:'Collectées',        value:fmt(Number(collected)), sub:'',                  icon:CheckCircle2,color:'#16A34A', bg:'#DCFCE7'},
          {label:'En attente',        value:fmt(Number(pending)),   sub:'',                  icon:Clock,       color:'#D97706', bg:'#FEF3C7'},
          {label:'Taux moyen',        value:list.length?`${(list.reduce((s,c)=>s+c.rate,0)/list.length*100).toFixed(1)}%`:'—', sub:'',icon:TrendingUp,color:'#0EA5E9',bg:'#E0F2FE'},
        ].map(({label,value,sub,icon:Icon,color,bg})=>(
          <div key={label} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:bg}}>
              <Icon className="w-5 h-5" style={{color}}/>
            </div>
            <div><p className="text-xs text-gray-400 font-medium">{label}</p><p className="text-lg font-bold mt-0.5" style={{color:'#1A1040'}}>{value}</p>{sub&&<p className="text-xs text-gray-400">{sub}</p>}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-3 mb-4 flex items-center gap-3 shadow-sm">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:'#F8F8FC'}}>
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher marchand, sponsor…"
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"/>
          {search&&<button onClick={()=>setSearch('')}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600"/></button>}
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none">
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="COLLECTED">Collectée</option>
          <option value="DISPUTED">Contestée</option>
        </select>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* List */}
        <div style={{background:'#fff',border:'1px solid #ECECF2',flex:detail?'0 0 58%':'1'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="grid gap-3 px-4 py-3 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr',borderColor:'#ECECF2'}}>
            <span>Marchand</span><span>Sponsor</span><span>Tx montant</span><span>Commission</span><span>Statut</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Chargement…</div>
            ) : filtered.length===0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400"><DollarSign className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">Aucune commission</p></div>
            ) : filtered.map(c=>(
              <button key={c.id} onClick={()=>setDetail(detail?.id===c.id?null:c)} className="w-full text-left border-b hover:bg-gray-50 transition-colors"
                style={{borderColor:'#ECECF2',background:detail?.id===c.id?'#F5F3FF':undefined}}>
                <div className="grid gap-3 px-4 py-3 items-center" style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr'}}>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.merchant.businessName}</p>
                    <p className="text-xs text-gray-400">{CAT_LABELS[c.merchant.category]||c.merchant.category} · {c.merchant.city}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.sponsor.user.firstName}</p>
                    <p className="text-xs text-gray-400">{c.sponsor.user.phone}</p>
                  </div>
                  <p className="text-sm text-gray-700">{fmt(c.transaction.amount)}</p>
                  <p className="text-sm font-bold" style={{color:'#1A1040'}}>{fmt(c.amount)}</p>
                  <StatusBadge status={c.status}/>
                </div>
              </button>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t text-xs text-gray-400" style={{borderColor:'#ECECF2'}}>{filtered.length} commission{filtered.length!==1?'s':''}</div>
        </div>

        {/* Detail */}
        {detail && (
          <div style={{background:'#fff',border:'1px solid #ECECF2',flex:'0 0 42%'}} className="rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b" style={{borderColor:'#ECECF2'}}>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Détail commission</p>
                <h2 className="text-base font-bold" style={{color:'#1A1040'}}>{detail.merchant.businessName}</h2>
                <StatusBadge status={detail.status}/>
              </div>
              <button onClick={()=>setDetail(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Amounts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl" style={{background:'#F8F8FC',border:'1px solid #ECECF2'}}>
                  <p className="text-xs text-gray-400 mb-1">Commission</p>
                  <p className="text-xl font-bold" style={{color:'#1A1040'}}>{fmt(detail.amount)}</p>
                  <p className="text-xs text-gray-400 mt-1">Taux : {(detail.rate*100).toFixed(1)}%</p>
                </div>
                <div className="p-4 rounded-2xl" style={{background:'#F8F8FC',border:'1px solid #ECECF2'}}>
                  <p className="text-xs text-gray-400 mb-1">Transaction</p>
                  <p className="text-xl font-bold" style={{color:'#1A1040'}}>{fmt(detail.transaction.amount)}</p>
                  <p className="text-xs text-gray-400 mt-1">{fmtDate(detail.transaction.createdAt)}</p>
                </div>
              </div>

              {/* Merchant */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Store className="w-3.5 h-3.5"/>Marchand</p>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Nom</span><span className="text-xs font-semibold text-gray-800">{detail.merchant.businessName}</span></div>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Catégorie</span><span className="text-xs font-semibold text-gray-800">{CAT_LABELS[detail.merchant.category]||detail.merchant.category}</span></div>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Ville</span><span className="text-xs font-semibold text-gray-800">{detail.merchant.city}</span></div>
              </div>

              {/* Sponsor */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sponsor</p>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Nom</span><span className="text-xs font-semibold text-gray-800">{detail.sponsor.user.firstName}</span></div>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Téléphone</span><span className="text-xs font-semibold text-gray-800">{detail.sponsor.user.phone}</span></div>
              </div>

              {/* Meta */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Détails</p>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Type</span><span className="text-xs font-semibold text-gray-800">{detail.commissionType}</span></div>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Date</span><span className="text-xs font-semibold text-gray-800">{fmtDate(detail.createdAt)}</span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-gray-400">PSP ID</span><span className="text-xs font-mono text-gray-500 truncate ml-4">{detail.transaction.pspTransactionId||'—'}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
