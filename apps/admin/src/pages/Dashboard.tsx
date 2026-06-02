import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Users, Gift, Store, CreditCard, TrendingUp, Shield, ArrowUpRight, RefreshCw, AlertTriangle, Activity, CheckCircle2, XCircle } from 'lucide-react';

interface LogEntry {
  id: string; action: string; entityType: string; entityId: string;
  result: string; actorRole: string | null; createdAt: string;
  previousData: Record<string,unknown>|null; newData: Record<string,unknown>|null;
  metadata: Record<string,unknown>|null;
  admin?: { firstName?: string; email?: string }|null;
}
interface Stats {
  sponsors: number; beneficiaries: number; activeMerchants: number;
  totalTransactions: number; totalVolume: number; pendingFraudReview: number;
  merchantsByStatus: Record<string,number>; merchantsByCategory: Record<string,number>;
  newSponsorsWeek: number; newMerchantsWeek: number;
  weekVolume: number; weekTransactions: number; pendingKyc: number;
  recentLogs: LogEntry[];
}

const CAT_LABELS: Record<string,string> = {
  FOOD:'Alimentation', PHARMACY:'Pharmacie', CLOTHING:'Habillement',
  EDUCATION:'Éducation', LEISURE:'Loisirs', GENERAL:'Général'
};

function fmt(n: number) { return new Intl.NumberFormat('fr-MA',{style:'currency',currency:'MAD',maximumFractionDigits:0}).format(n); }

function BarRow({ label, count, total, color }: { label:string; count:number; total:number; color:string }) {
  const pct = total > 0 ? Math.round((count/total)*100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 flex-shrink-0" style={{width:'96px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#F3F4F6'}}>
        <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:color}}/>
      </div>
      <span className="text-xs font-semibold text-gray-700 w-5 text-right">{count}</span>
    </div>
  );
}

function LogModal({ log, onClose }: { log:LogEntry; onClose:()=>void }) {
  const meta = log.metadata as Record<string,unknown>|null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(2px)'}} onClick={onClose}>
      <div style={{background:'#fff',border:'1px solid #ECECF2',maxHeight:'80vh',overflowY:'auto'}} className="w-full max-w-lg rounded-2xl shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b" style={{borderColor:'#ECECF2'}}>
          <div>
            <p className="text-sm font-bold text-gray-900">{log.action.replace(/_/g,' ')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{new Date(log.createdAt).toLocaleString('fr-FR',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            {log.result==='SUCCESS'
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#16A34A',background:'#DCFCE7'}}><CheckCircle2 className="w-3 h-3"/>Succès</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#DC2626',background:'#FEE2E2'}}><XCircle className="w-3 h-3"/>Échec</span>
            }
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{log.entityType}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Entité</p>
              <p className="text-sm font-semibold text-gray-900">{log.entityType}{meta?.entityName?` — ${String(meta.entityName)}`:''}</p>
              <p className="text-xs font-mono text-gray-300 truncate mt-0.5">{log.entityId}</p>
            </div>
            <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Admin</p>
              <p className="text-sm font-semibold text-gray-900">{log.admin?.firstName??log.admin?.email??'Système'}</p>
            </div>
          </div>
          {meta && Object.entries(meta).filter(([k,v])=>k!=='entityName'&&typeof v!=='object').length>0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(meta).filter(([k,v])=>k!=='entityName'&&typeof v!=='object').map(([k,v])=>(
                <div key={k} className="rounded-xl px-3 py-2.5" style={{background:'#F5F3FF',border:'1px solid #EDE9FF'}}>
                  <p className="text-xs mb-0.5" style={{color:'#7C3AED'}}>{k}</p>
                  <p className="text-xs font-semibold" style={{color:'#4C1D95'}}>{String(v)}</p>
                </div>
              ))}
            </div>
          )}
          {(log.previousData||log.newData) && (
            <div style={{border:'1px solid #ECECF2'}} className="rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 divide-x" style={{borderColor:'#ECECF2'}}>
                <div className="px-3 py-2.5" style={{background:'rgba(239,68,68,0.04)'}}>
                  <p className="text-xs font-semibold mb-2" style={{color:'#EF4444'}}>Avant</p>
                  {log.previousData && Object.entries(log.previousData).map(([k,v])=>(
                    <div key={k} className="mb-1"><p className="text-xs text-gray-400">{k}</p><p className="text-xs font-semibold text-red-600">{String(v)}</p></div>
                  ))}
                </div>
                <div className="px-3 py-2.5" style={{background:'rgba(34,197,94,0.04)'}}>
                  <p className="text-xs font-semibold mb-2" style={{color:'#22C55E'}}>Après</p>
                  {log.newData && Object.entries(log.newData).map(([k,v])=>(
                    <div key={k} className="mb-1"><p className="text-xs text-gray-400">{k}</p><p className="text-xs font-semibold text-green-600">{String(v)}</p></div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]         = useState<Stats|null>(null);
  const [loading, setLoading]     = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry|null>(null);
  const navigate = useNavigate();

  const fetchStats = useCallback(()=>{
    api.get(`/admin/stats?_t=${Date.now()}`).then(r=>setStats(r.data)).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{ fetchStats(); const iv=setInterval(fetchStats,30000); return ()=>clearInterval(iv); },[fetchStats]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{borderColor:'#5B3DF5',borderTopColor:'transparent'}}/>
    </div>
  );
  if (!stats) return <p className="p-6 text-sm text-gray-400">Erreur de chargement</p>;

  const totalMerchants = Object.values(stats.merchantsByStatus).reduce((a,b)=>a+b,0);
  const totalCat = Object.values(stats.merchantsByCategory).reduce((a,b)=>a+b,0);

  return (
    <div className="space-y-6" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {selectedLog && <LogModal log={selectedLog} onClose={()=>setSelectedLog(null)}/>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1A1040'}}>Tableau de bord</h1>
          <p className="text-sm text-gray-400 mt-0.5">{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <button onClick={fetchStats} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4"/>Actualiser
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          {label:'Sponsors',        value:stats.sponsors,                          sub:`+${stats.newSponsorsWeek} cette semaine`, icon:Users,      color:'#5B3DF5', bg:'#EDE9FF', path:'/sponsors'},
          {label:'Bénéficiaires',   value:stats.beneficiaries,                     sub:'',                                         icon:Gift,       color:'#0EA5E9', bg:'#E0F2FE', path:'/beneficiaries'},
          {label:'Marchands actifs',value:stats.activeMerchants,                   sub:`${stats.pendingKyc} KYC en attente`,       icon:Store,      color:'#16A34A', bg:'#DCFCE7', path:'/merchants'},
          {label:'Transactions',    value:stats.totalTransactions.toLocaleString('fr-FR'), sub:`${stats.weekTransactions} cette semaine`, icon:CreditCard, color:'#7C3AED', bg:'#F5F3FF', path:'/transactions'},
          {label:'Volume total',    value:fmt(stats.totalVolume),                  sub:fmt(stats.weekVolume)+' / 7j',              icon:TrendingUp, color:'#D97706', bg:'#FEF3C7', path:'/transactions'},
          {label:'Fraude en attente',value:stats.pendingFraudReview,               sub:'',                                         icon:Shield,     color:stats.pendingFraudReview>0?'#DC2626':'#16A34A', bg:stats.pendingFraudReview>0?'#FEE2E2':'#DCFCE7', path:'/fraud'},
        ].map(({label,value,sub,icon:Icon,color,bg,path})=>(
          <button key={label} onClick={()=>navigate(path)}
            style={{background:'#fff',border:`1px solid #ECECF2`}} className="rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:bg}}>
                <Icon className="w-4.5 h-4.5" style={{color,width:'18px',height:'18px'}}/>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors"/>
            </div>
            <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
            <p className="text-xl font-bold" style={{color:'#1A1040'}}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </button>
        ))}
      </div>

      {/* KYC Alert */}
      {stats.pendingKyc > 0 && (
        <div className="flex items-center justify-between px-5 py-4 rounded-2xl" style={{background:'#FFFBEB',border:'1px solid #FDE68A'}}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(245,158,11,0.12)'}}>
              <AlertTriangle className="w-5 h-5" style={{color:'#F59E0B'}}/>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{color:'#92400E'}}>{stats.pendingKyc} marchand{stats.pendingKyc>1?'s':''} en attente de validation KYC</p>
              <p className="text-xs mt-0.5" style={{color:'#B45309'}}>Des dossiers ont été soumis et attendent une décision.</p>
            </div>
          </div>
          <button onClick={()=>navigate('/merchants')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{background:'#F59E0B'}}>
            Voir <ArrowUpRight className="w-3.5 h-3.5"/>
          </button>
        </div>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Merchants by status */}
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{color:'#1A1040'}}>Marchands par statut</h2>
            <span className="text-xs text-gray-400">Total {totalMerchants}</span>
          </div>
          <div className="space-y-3">
            {[
              {s:'ACTIVE',    label:'Actif',    color:'#16A34A'},
              {s:'INACTIVE',  label:'Inactif',  color:'#D1D5DB'},
              {s:'SUSPENDED', label:'Suspendu', color:'#F59E0B'},
              {s:'REJECTED',  label:'Rejeté',   color:'#EF4444'},
            ].map(({s,label,color})=>(
              <BarRow key={s} label={label} count={stats.merchantsByStatus[s]??0} total={totalMerchants} color={color}/>
            ))}
          </div>
          <div className="pt-3 border-t space-y-2" style={{borderColor:'#ECECF2'}}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Par catégorie</h3>
            {Object.entries(stats.merchantsByCategory).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([cat,count])=>(
              <BarRow key={cat} label={CAT_LABELS[cat]||cat} count={count} total={totalCat} color="#5B3DF5"/>
            ))}
            {Object.keys(stats.merchantsByCategory).length===0 && <p className="text-xs text-gray-400 text-center py-3">Aucun marchand</p>}
          </div>
        </div>

        {/* Week stats */}
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold mb-4" style={{color:'#1A1040'}}>Cette semaine</h2>
          <div className="space-y-4">
            {[
              {label:'Nouveaux sponsors',    value:stats.newSponsorsWeek,   icon:Users,      color:'#5B3DF5', bg:'#EDE9FF'},
              {label:'Nouveaux marchands',   value:stats.newMerchantsWeek,  icon:Store,      color:'#16A34A', bg:'#DCFCE7'},
              {label:'Transactions',         value:stats.weekTransactions,  icon:CreditCard, color:'#7C3AED', bg:'#F5F3FF'},
              {label:'Volume',               value:fmt(stats.weekVolume),   icon:TrendingUp, color:'#D97706', bg:'#FEF3C7'},
            ].map(({label,value,icon:Icon,color,bg})=>(
              <div key={label} className="flex items-center justify-between p-3 rounded-xl" style={{background:'#F8F8FC',border:'1px solid #ECECF2'}}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:bg}}>
                    <Icon className="w-4 h-4" style={{color}}/>
                  </div>
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
                <span className="text-sm font-bold" style={{color:'#1A1040'}}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{color:'#1A1040'}}>Activité récente</h2>
            <button onClick={()=>navigate('/audit-logs')} className="text-xs font-medium flex items-center gap-1 hover:opacity-70" style={{color:'#5B3DF5'}}>
              Tout voir <ArrowUpRight className="w-3 h-3"/>
            </button>
          </div>
          <div className="space-y-0">
            {stats.recentLogs.length===0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <Activity className="w-7 h-7 mb-2 opacity-30"/><p className="text-xs">Aucune activité</p>
              </div>
            ) : stats.recentLogs.map((log,i)=>(
              <button key={log.id} onClick={()=>setSelectedLog(log)}
                className="w-full flex items-start gap-3 py-3 text-left hover:bg-gray-50 rounded-xl px-2 transition-colors group"
                style={{borderBottom:i<stats.recentLogs.length-1?'1px solid #F3F4F6':'none'}}>
                <div className="mt-1.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{background:log.result==='SUCCESS'?'#16A34A':'#DC2626'}}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{log.action.replace(/_/g,' ')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {log.admin?.firstName??log.admin?.email??'Système'} · {new Date(log.createdAt).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                  </p>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors"/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
