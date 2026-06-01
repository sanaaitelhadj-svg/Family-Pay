import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Search, RefreshCw, FileText, CheckCircle2, XCircle, ChevronLeft, ChevronRight, X, User, Clock, Shield, AlertTriangle } from 'lucide-react';

interface AdminInfo { id: string; firstName: string; lastName: string; email: string; adminRole?: { name: string } | null; }
interface AuditLog {
  id: string; action: string; result: string; entityType: string; entityId: string;
  actorId: string | null; actorRole: string | null; admin?: AdminInfo | null;
  previousData: Record<string,unknown> | null; newData: Record<string,unknown> | null;
  metadata: Record<string,unknown> | null; ipAddress: string | null; deviceInfo: string | null; createdAt: string;
}

const ACTION_COLOR: Record<string,{color:string;bg:string}> = {
  MERCHANT_ACTIVATED:     {color:'#16A34A',bg:'#DCFCE7'},
  MERCHANT_KYC_APPROVED:  {color:'#16A34A',bg:'#DCFCE7'},
  MERCHANT_SUSPENDED:     {color:'#D97706',bg:'#FEF3C7'},
  MERCHANT_REJECTED:      {color:'#DC2626',bg:'#FEE2E2'},
  MERCHANT_KYC_REJECTED:  {color:'#DC2626',bg:'#FEE2E2'},
  SPONSOR_ACTIVATED:      {color:'#16A34A',bg:'#DCFCE7'},
  SPONSOR_SUSPENDED:      {color:'#D97706',bg:'#FEF3C7'},
  SPONSOR_DELETED:        {color:'#DC2626',bg:'#FEE2E2'},
  SPONSOR_UPDATED:        {color:'#0EA5E9',bg:'#E0F2FE'},
  BENEFICIARY_ACTIVATED:  {color:'#16A34A',bg:'#DCFCE7'},
  BENEFICIARY_SUSPENDED:  {color:'#D97706',bg:'#FEF3C7'},
  BENEFICIARY_DELETED:    {color:'#DC2626',bg:'#FEE2E2'},
  BENEFICIARY_UPDATED:    {color:'#0EA5E9',bg:'#E0F2FE'},
  FRAUD_REVIEW_APPROVED:  {color:'#16A34A',bg:'#DCFCE7'},
  FRAUD_REVIEW_REJECTED:  {color:'#DC2626',bg:'#FEE2E2'},
  ADMIN_CREATED:          {color:'#7C3AED',bg:'#EDE9FF'},
  ADMIN_DELETED:          {color:'#DC2626',bg:'#FEE2E2'},
  USER_LOGGED_IN:         {color:'#6B7280',bg:'#F3F4F6'},
};

const ENTITY_TYPES = ['Merchant','Sponsor','Beneficiary','Authorization','Transaction','Admin','User'];

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_COLOR[action] || {color:'#5B3DF5',bg:'#EDE9FF'};
  const label = action.replace(/_/g,' ').toLowerCase().replace(/^\w/,c=>c.toUpperCase());
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold truncate max-w-[180px]" style={{color:cfg.color,background:cfg.bg}} title={label}>{label}</span>;
}

function ResultBadge({ result }: { result: string }) {
  if (result === 'SUCCESS') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#16A34A',background:'#DCFCE7'}}><CheckCircle2 className="w-3 h-3"/>OK</span>;
  if (result === 'FAILURE') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#DC2626',background:'#FEE2E2'}}><XCircle className="w-3 h-3"/>Échec</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{result}</span>;
}

function JsonBlock({ data, label }: { data: Record<string,unknown>|null; label: string }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <pre className="text-xs rounded-xl p-3 overflow-x-auto" style={{background:'#F8F8FC',border:'1px solid #ECECF2',color:'#374151',fontFamily:'monospace'}}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

export default function AuditLogs() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail]   = useState<AuditLog|null>(null);
  const [search, setSearch]   = useState('');
  const [entity, setEntity]   = useState('');
  const [result, setResult]   = useState('');
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) params.set('action', search);
    if (entity) params.set('entity', entity);
    if (result) params.set('result', result);
    api.get(`/admin/audit-logs?${params}`).then(r => {
      setLogs(r.data.logs); setTotal(r.data.total);
    }).finally(() => setLoading(false));
  }, [page, search, entity, result]);

  useEffect(() => { setPage(1); }, [search, entity, result]);
  useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="h-full flex flex-col" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1A1040'}}>Logs d'audit</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total.toLocaleString('fr-FR')} entrées enregistrées</p>
        </div>
        <button onClick={load} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4"/><span>Actualiser</span>
        </button>
      </div>

      {/* Filters */}
      <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-3 mb-4 flex items-center gap-3 shadow-sm">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:'#F8F8FC'}}>
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une action (ex: MERCHANT, FRAUD…)"
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"/>
          {search && <button onClick={()=>setSearch('')}><X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600"/></button>}
        </div>
        <select value={entity} onChange={e=>setEntity(e.target.value)} style={{border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none">
          <option value="">Toutes entités</option>
          {ENTITY_TYPES.map(e=><option key={e} value={e}>{e}</option>)}
        </select>
        <select value={result} onChange={e=>setResult(e.target.value)} style={{border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none">
          <option value="">Tous résultats</option>
          <option value="SUCCESS">Succès</option>
          <option value="FAILURE">Échec</option>
        </select>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* List */}
        <div style={{background:'#fff',border:'1px solid #ECECF2',flex:detail?'0 0 55%':'1'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="grid gap-3 px-4 py-3 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr',borderColor:'#ECECF2'}}>
            <span>Action</span><span>Entité</span><span>Résultat</span><span>Date</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Chargement…</div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <FileText className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">Aucun log trouvé</p>
              </div>
            ) : logs.map(log => (
              <button key={log.id} onClick={()=>setDetail(detail?.id===log.id?null:log)} className="w-full text-left border-b hover:bg-gray-50 transition-colors"
                style={{borderColor:'#ECECF2',background:detail?.id===log.id?'#F5F3FF':undefined}}>
                <div className="grid gap-3 px-4 py-3 items-center" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr'}}>
                  <div className="flex flex-col gap-1">
                    <ActionBadge action={log.action}/>
                    {log.admin && <span className="text-xs text-gray-400">{log.admin.firstName} {log.admin.lastName||''}</span>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{log.entityType}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{log.entityId.slice(0,8)}…</p>
                  </div>
                  <ResultBadge result={log.result}/>
                  <div>
                    <p className="text-xs text-gray-600">{new Date(log.createdAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</p>
                    <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{borderColor:'#ECECF2'}}>
            <span className="text-xs text-gray-400">{total.toLocaleString('fr-FR')} entrées · page {page}/{pages||1}</span>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}
                style={{border:'1px solid #ECECF2'}} className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4 text-gray-600"/>
              </button>
              <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page>=pages}
                style={{border:'1px solid #ECECF2'}} className="p-1.5 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight className="w-4 h-4 text-gray-600"/>
              </button>
            </div>
          </div>
        </div>

        {/* Detail */}
        {detail && (
          <div style={{background:'#fff',border:'1px solid #ECECF2',flex:'0 0 45%'}} className="rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b" style={{borderColor:'#ECECF2'}}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Détail entrée</p>
                <ActionBadge action={detail.action}/>
              </div>
              <button onClick={()=>setDetail(null)} className="text-gray-400 hover:text-gray-600 p-1 ml-2"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3">
                <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Résultat</p>
                  <ResultBadge result={detail.result}/>
                </div>
                <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Entité</p>
                  <p className="text-sm font-semibold text-gray-800">{detail.entityType}</p>
                </div>
              </div>

              {/* Actor */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><User className="w-3.5 h-3.5"/>Acteur</p>
                {detail.admin ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:'#5B3DF5'}}>
                      {detail.admin.firstName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{detail.admin.firstName} {detail.admin.lastName||''}</p>
                      <p className="text-xs text-gray-400">{detail.admin.email} {detail.admin.adminRole?`· ${detail.admin.adminRole.name}`:''}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Système {detail.actorRole ? `(${detail.actorRole})` : ''}</p>
                )}
              </div>

              {/* Date + IP */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/>Contexte</p>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Date</span><span className="text-xs font-semibold text-gray-800">{fmtDate(detail.createdAt)}</span></div>
                <div className="flex justify-between"><span className="text-xs text-gray-400">Entity ID</span><span className="text-xs font-mono text-gray-600">{detail.entityId.slice(0,20)}…</span></div>
                {detail.ipAddress && <div className="flex justify-between"><span className="text-xs text-gray-400">IP</span><span className="text-xs font-mono text-gray-600">{detail.ipAddress}</span></div>}
              </div>

              {/* JSON data */}
              <JsonBlock data={detail.metadata} label="Métadonnées"/>
              <JsonBlock data={detail.previousData} label="Données précédentes"/>
              <JsonBlock data={detail.newData} label="Nouvelles données"/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
