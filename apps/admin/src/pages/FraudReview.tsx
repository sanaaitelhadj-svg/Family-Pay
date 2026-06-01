import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Shield, TrendingUp, Eye, X, Clock } from 'lucide-react';

interface Auth {
  id: string; amount: number; fraudScore: number; createdAt: string; rejectionReason: string | null;
  beneficiary: { user: { firstName: string; phone: string } };
  merchant: { businessName: string; city: string; category: string };
  allocation: { category: string; remainingAmount: number };
}

const CAT_LABELS: Record<string,string> = {
  FOOD:'Alimentation', PHARMACY:'Pharmacie', CLOTHING:'Habillement',
  EDUCATION:'Éducation', LEISURE:'Loisirs', GENERAL:'Général'
};

function fmt(n: number) { return new Intl.NumberFormat('fr-MA',{style:'currency',currency:'MAD',maximumFractionDigits:0}).format(n); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

function RiskBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  if (pct >= 70) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#DC2626',background:'#FEE2E2'}}><AlertTriangle className="w-3 h-3"/>Risque élevé</span>;
  if (pct >= 40) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#D97706',background:'#FEF3C7'}}><AlertTriangle className="w-3 h-3"/>Risque moyen</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#CA8A04',background:'#FEF9C3'}}><Eye className="w-3 h-3"/>Risque faible</span>;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? '#DC2626' : pct >= 40 ? '#D97706' : '#CA8A04';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{width:`${pct}%`,background:color}}/>
      </div>
      <span className="text-xs font-bold" style={{color}}>{pct}%</span>
    </div>
  );
}

function RejectModal({ onConfirm, onClose, saving }: { onConfirm:(r:string)=>void; onClose:()=>void; saving:boolean }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Rejeter l'autorisation</h2>
            <p className="text-sm text-gray-400 mt-0.5">Minimum 5 caractères requis</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>
        <textarea rows={4} value={reason} onChange={e=>setReason(e.target.value)} autoFocus
          placeholder="Ex: Montant anormal, marchand hors catégorie autorisée…"
          style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
          onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(220,38,38,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
          <button onClick={()=>reason.trim().length>=5&&onConfirm(reason.trim())} disabled={saving||reason.trim().length<5}
            style={{background:'#DC2626'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">
            {saving?'Rejet…':'Confirmer le rejet'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FraudReview() {
  const [list, setList]         = useState<Auth[]>([]);
  const [loading, setLoading]   = useState(true);
  const [detail, setDetail]     = useState<Auth|null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [saving, setSaving]     = useState(false);

  function load() {
    setLoading(true);
    api.get('/admin/fraud-review').then(r => setList(r.data)).finally(()=>setLoading(false));
  }
  useEffect(load, []);

  async function approve(id: string) {
    setSaving(true);
    try { await api.patch(`/admin/${id}/approve`); setDetail(null); load(); }
    catch(e:any) { alert(e.response?.data?.message||'Erreur'); }
    finally { setSaving(false); }
  }

  async function reject(id: string, reason: string) {
    setSaving(true);
    try { await api.patch(`/admin/${id}/reject`, { reason }); setRejectModal(false); setDetail(null); load(); }
    catch(e:any) { alert(e.response?.data?.message||'Erreur'); }
    finally { setSaving(false); }
  }

  const stats = useMemo(()=>({
    total:  list.length,
    volume: list.reduce((s,a)=>s+a.amount,0),
    high:   list.filter(a=>a.fraudScore>=0.7).length,
    medium: list.filter(a=>a.fraudScore>=0.4&&a.fraudScore<0.7).length,
  }),[list]);

  return (
    <div className="h-full flex flex-col" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1A1040'}}>Revue de fraude</h1>
          <p className="text-sm text-gray-400 mt-0.5">Autorisations en attente de validation manuelle</p>
        </div>
        <button onClick={load} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4"/><span>Actualiser</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label:'En attente',      value:stats.total.toString(),    icon:Clock,         color:'#5B3DF5', bg:'#EDE9FF' },
          { label:'Volume à risque', value:fmt(stats.volume),         icon:TrendingUp,    color:'#0EA5E9', bg:'#E0F2FE' },
          { label:'Risque élevé',    value:stats.high.toString(),     icon:AlertTriangle, color:'#DC2626', bg:'#FEE2E2' },
          { label:'Risque moyen',    value:stats.medium.toString(),   icon:Shield,        color:'#D97706', bg:'#FEF3C7' },
        ].map(({label,value,icon:Icon,color,bg})=>(
          <div key={label} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:bg}}>
              <Icon className="w-5 h-5" style={{color}}/>
            </div>
            <div><p className="text-xs text-gray-400 font-medium">{label}</p><p className="text-lg font-bold mt-0.5" style={{color:'#1A1040'}}>{value}</p></div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* List */}
        <div style={{background:'#fff',border:'1px solid #ECECF2',flex:detail?'0 0 55%':'1'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="grid gap-3 px-4 py-3 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1.2fr',borderColor:'#ECECF2'}}>
            <span>Bénéficiaire</span><span>Marchand</span><span>Montant</span><span>Score fraude</span><span>Actions</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Chargement…</div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{background:'#F5F3FF'}}>
                  <Shield className="w-7 h-7" style={{color:'#5B3DF5'}}/>
                </div>
                <p className="text-sm font-semibold text-gray-600">Aucune autorisation en attente</p>
                <p className="text-xs text-gray-400 mt-1">Toutes les transactions ont été traitées</p>
              </div>
            ) : list.map(a=>(
              <div key={a.id} className="grid gap-3 px-4 py-3 items-center border-b hover:bg-gray-50 transition-colors cursor-pointer"
                style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1.2fr',borderColor:'#ECECF2',background:detail?.id===a.id?'#F5F3FF':undefined}}
                onClick={()=>setDetail(detail?.id===a.id?null:a)}>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{a.beneficiary.user.firstName}</p>
                  <p className="text-xs text-gray-400">{a.beneficiary.user.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.merchant.businessName}</p>
                  <p className="text-xs text-gray-400">{a.merchant.city}</p>
                </div>
                <p className="text-sm font-bold" style={{color:'#1A1040'}}>{fmt(a.amount)}</p>
                <ScoreBar score={a.fraudScore}/>
                <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>approve(a.id)} disabled={saving}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                    style={{background:'#16A34A'}}>
                    <CheckCircle2 className="w-3.5 h-3.5"/>OK
                  </button>
                  <button onClick={()=>{setDetail(a);setRejectModal(true);}} disabled={saving}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                    style={{background:'#DC2626'}}>
                    <XCircle className="w-3.5 h-3.5"/>KO
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t text-xs text-gray-400" style={{borderColor:'#ECECF2'}}>
            {list.length} autorisation{list.length!==1?'s':''} en attente
          </div>
        </div>

        {/* Detail */}
        {detail && (
          <div style={{background:'#fff',border:'1px solid #ECECF2',flex:'0 0 45%'}} className="rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b" style={{borderColor:'#ECECF2'}}>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Détail autorisation</p>
                <h2 className="text-base font-bold" style={{color:'#1A1040'}}>{detail.merchant.businessName}</h2>
                <RiskBadge score={detail.fraudScore}/>
              </div>
              <button onClick={()=>setDetail(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Amount */}
              <div className="p-4 rounded-2xl flex items-center justify-between" style={{background:'#F8F8FC',border:'1px solid #ECECF2'}}>
                <div><p className="text-xs text-gray-400 mb-1">Montant demandé</p><p className="text-2xl font-bold" style={{color:'#1A1040'}}>{fmt(detail.amount)}</p></div>
                <div className="text-right"><p className="text-xs text-gray-400 mb-1">Solde allocation</p><p className="text-sm font-semibold text-gray-700">{fmt(detail.allocation.remainingAmount)}</p></div>
              </div>

              {/* Risk */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/>Score de fraude</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Risque détecté</span>
                  <span className="text-sm font-bold" style={{color: detail.fraudScore>=0.7?'#DC2626':detail.fraudScore>=0.4?'#D97706':'#CA8A04'}}>
                    {Math.round(detail.fraudScore*100)}%
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width:`${Math.round(detail.fraudScore*100)}%`,
                    background: detail.fraudScore>=0.7?'#DC2626':detail.fraudScore>=0.4?'#D97706':'#CA8A04'
                  }}/>
                </div>
              </div>

              {/* Bene + Merchant */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Parties impliquées</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:'#5B3DF5'}}>
                    {detail.beneficiary.user.firstName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{detail.beneficiary.user.firstName}</p>
                    <p className="text-xs text-gray-400">{detail.beneficiary.user.phone}</p>
                  </div>
                </div>
                <div className="pt-2 border-t space-y-1.5" style={{borderColor:'#ECECF2'}}>
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Marchand</span><span className="text-xs font-semibold text-gray-800">{detail.merchant.businessName}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Ville</span><span className="text-xs font-semibold text-gray-800">{detail.merchant.city}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Catégorie</span><span className="text-xs font-semibold text-gray-800">{CAT_LABELS[detail.merchant.category]||detail.merchant.category}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400">Allocation</span><span className="text-xs font-semibold text-gray-800">{CAT_LABELS[detail.allocation.category]||detail.allocation.category}</span></div>
                </div>
              </div>

              {/* Date */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4">
                <div className="flex justify-between"><span className="text-xs text-gray-400">Date de la demande</span><span className="text-xs font-semibold text-gray-800">{fmtDate(detail.createdAt)}</span></div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={()=>approve(detail.id)} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  style={{background:'#16A34A'}}>
                  <CheckCircle2 className="w-4 h-4"/>Approuver
                </button>
                <button onClick={()=>setRejectModal(true)} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  style={{background:'#DC2626'}}>
                  <XCircle className="w-4 h-4"/>Rejeter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {rejectModal && detail && (
        <RejectModal saving={saving} onClose={()=>setRejectModal(false)} onConfirm={reason=>reject(detail.id, reason)}/>
      )}
    </div>
  );
}
