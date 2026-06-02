import { useState, useEffect } from 'react';
import { api } from '../api';
import { usePermissions } from '../contexts/PermissionsContext';
import { FileText, Plus, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Edit2, X, Package, Users, Store } from 'lucide-react';

interface SubscriptionPlan {
  id: string; name: string; description: string|null;
  price: string; durationMonths: number; features: string[]|null; isActive: boolean; createdAt: string;
}
interface Subscription {
  id: string; entityType: string; entityId: string;
  planId: string|null; subscriptionPlan: {name:string;price:string}|null;
  amount: string; startDate: string|null; endDate: string|null; status: string; createdAt: string;
}
interface PlanForm { name:string; description:string; price:string; durationMonths:string; features:string; }
const EMPTY: PlanForm = {name:'',description:'',price:'',durationMonths:'',features:''};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string;icon:any}> = {
  ACTIVE:    {label:'Actif',    color:'#16A34A',bg:'#DCFCE7',icon:CheckCircle2},
  SUSPENDED: {label:'Suspendu',color:'#D97706', bg:'#FEF3C7',icon:Clock},
  CANCELLED: {label:'Annulé',  color:'#DC2626', bg:'#FEE2E2',icon:XCircle},
  EXPIRED:   {label:'Expiré',  color:'#6B7280', bg:'#F3F4F6',icon:AlertCircle},
};

function StatusBadge({ status }: { status:string }) {
  const cfg = STATUS_CFG[status]||{label:status,color:'#6B7280',bg:'#F3F4F6',icon:Clock};
  const Icon = cfg.icon;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:cfg.color,background:cfg.bg}}><Icon className="w-3 h-3"/>{cfg.label}</span>;
}

function fmtDate(d:string|null) { return d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }

export default function Subscriptions() {
  const { can, loading: permsLoading } = usePermissions();
  const [plans, setPlans]           = useState<SubscriptionPlan[]>([]);
  const [subs, setSubs]             = useState<Subscription[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [subsLoading, setSubsLoading]   = useState(true);
  const [planModal, setPlanModal]   = useState<'create'|'edit'|null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan|null>(null);
  const [planForm, setPlanForm]     = useState<PlanForm>(EMPTY);
  const [planSaving, setPlanSaving] = useState(false);
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadPlans = async () => {
    setPlansLoading(true);
    try { const r = await api.get('/admin/subscription-plans'); setPlans(r.data); }
    finally { setPlansLoading(false); }
  };
  const loadSubs = async () => {
    setSubsLoading(true);
    try { const r = await api.get('/admin/subscriptions'); setSubs(r.data); }
    finally { setSubsLoading(false); }
  };
  useEffect(()=>{ loadPlans(); loadSubs(); },[]);

  const openCreate = () => { setPlanForm(EMPTY); setEditingPlan(null); setPlanModal('create'); };
  const openEdit = (plan: SubscriptionPlan) => {
    setPlanForm({ name:plan.name, description:plan.description??'', price:plan.price,
      durationMonths:String(plan.durationMonths), features:Array.isArray(plan.features)?plan.features.join(', '):'',
    });
    setEditingPlan(plan); setPlanModal('edit');
  };

  const savePlan = async () => {
    if(!planForm.name||!planForm.price||!planForm.durationMonths) return;
    setPlanSaving(true);
    try {
      const body = { name:planForm.name, description:planForm.description||undefined,
        price:parseFloat(planForm.price), durationMonths:parseInt(planForm.durationMonths),
        features:planForm.features?planForm.features.split(',').map(s=>s.trim()).filter(Boolean):undefined,
      };
      if(planModal==='create') await api.post('/admin/subscription-plans',body);
      else if(editingPlan) await api.patch(`/admin/subscription-plans/${editingPlan.id}`,body);
      setPlanModal(null); await loadPlans();
    } catch(e:any){ alert(e.response?.data?.message??'Erreur'); }
    finally{ setPlanSaving(false); }
  };

  const togglePlan = async (plan: SubscriptionPlan) => {
    await api.patch(`/admin/subscription-plans/${plan.id}`,{isActive:!plan.isActive});
    await loadPlans();
  };

  const updateSub = async (id:string, status:string) => {
    await api.patch(`/admin/subscriptions/${id}`,{status});
    await loadSubs();
  };

  const filteredSubs = subs.filter(s=>{
    if(entityFilter!=='ALL'&&s.entityType!==entityFilter) return false;
    if(statusFilter!=='ALL'&&s.status!==statusFilter) return false;
    return true;
  });

  const activePlans = plans.filter(p=>p.isActive).length;
  const activeSubs  = subs.filter(s=>s.status==='ACTIVE').length;

  return (
    <div className="space-y-8" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1A1040'}}>Abonnements</h1>
          <p className="text-sm text-gray-400 mt-0.5">Plans et souscriptions actives</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>{loadPlans();loadSubs();}} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4"/>
          </button>
          <button onClick={openCreate} disabled={permsLoading||!can('subscriptions','add')}
            style={{background:'#5B3DF5'}} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white font-semibold hover:opacity-90 shadow-sm disabled:opacity-40">
            <Plus className="w-4 h-4"/>Nouvelle offre
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Plans actifs',       value:activePlans.toString(),  icon:Package, color:'#5B3DF5', bg:'#EDE9FF'},
          {label:'Abonnements actifs', value:activeSubs.toString(),   icon:FileText,color:'#16A34A', bg:'#DCFCE7'},
          {label:'Total abonnements',  value:subs.length.toString(),  icon:Users,   color:'#0EA5E9', bg:'#E0F2FE'},
        ].map(({label,value,icon:Icon,color,bg})=>(
          <div key={label} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:bg}}>
              <Icon className="w-5 h-5" style={{color}}/>
            </div>
            <div><p className="text-xs text-gray-400 font-medium">{label}</p><p className="text-xl font-bold mt-0.5" style={{color:'#1A1040'}}>{value}</p></div>
          </div>
        ))}
      </div>

      {/* Plans catalogue */}
      <div>
        <h2 className="text-base font-bold mb-4" style={{color:'#1A1040'}}>Catalogue des offres</h2>
        {plansLoading ? (
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-8 text-center text-gray-400 shadow-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2"/>Chargement…
          </div>
        ) : plans.length===0 ? (
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-10 text-center shadow-sm">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300"/>
            <p className="text-sm text-gray-400 mb-3">Aucun plan créé</p>
            <button onClick={openCreate} style={{color:'#5B3DF5'}} className="text-sm font-semibold hover:opacity-70">Créer le premier plan →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan=>(
              <div key={plan.id} style={{background:'#fff',border:'1px solid #ECECF2',opacity:plan.isActive?1:0.6}} className="rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{plan.name}</h3>
                    {plan.description&&<p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>}
                  </div>
                  {plan.isActive
                    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#16A34A',background:'#DCFCE7'}}>Actif</span>
                    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#6B7280',background:'#F3F4F6'}}>Inactif</span>
                  }
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold" style={{color:'#1A1040'}}>{plan.price}</span>
                  <span className="text-xs text-gray-400">MAD / {plan.durationMonths} mois</span>
                </div>
                {Array.isArray(plan.features)&&plan.features.length>0&&(
                  <ul className="space-y-1">
                    {(plan.features as string[]).map((f,i)=>(
                      <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{color:'#16A34A'}}/>{f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={()=>openEdit(plan)} disabled={permsLoading||!can('subscriptions','write')}
                    style={{border:'1px solid #ECECF2'}} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <Edit2 className="w-3.5 h-3.5"/>Modifier
                  </button>
                  <button onClick={()=>togglePlan(plan)} disabled={permsLoading||!can('subscriptions','write')}
                    className="flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
                    style={plan.isActive?{background:'#FEF3C7',color:'#D97706'}:{background:'#DCFCE7',color:'#16A34A'}}>
                    {plan.isActive?'Désactiver':'Activer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscriptions list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{color:'#1A1040'}}>Abonnements <span className="text-gray-400 font-normal text-sm">({filteredSubs.length})</span></h2>
          <div className="flex gap-2">
            <select value={entityFilter} onChange={e=>setEntityFilter(e.target.value)} style={{border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none">
              <option value="ALL">Tous les types</option>
              <option value="MERCHANT">Marchands</option>
              <option value="SPONSOR">Sponsors</option>
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none">
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="CANCELLED">Annulé</option>
              <option value="EXPIRED">Expiré</option>
            </select>
          </div>
        </div>
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-sm overflow-hidden">
          <div className="grid px-4 py-3 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{gridTemplateColumns:'1fr 2fr 1.5fr 1fr 1fr 1.5fr',gap:'12px',borderColor:'#ECECF2'}}>
            <span>Type</span><span>Offre</span><span>Début → Fin</span><span>Montant</span><span>Statut</span><span>Actions</span>
          </div>
          {subsLoading ? (
            <div className="flex items-center justify-center h-24 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Chargement…</div>
          ) : filteredSubs.length===0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-gray-400">
              <FileText className="w-7 h-7 mb-2 opacity-30"/><p className="text-sm">Aucun abonnement</p>
            </div>
          ) : filteredSubs.map(sub=>(
            <div key={sub.id} className="grid px-4 py-3 items-center border-b hover:bg-gray-50 transition-colors" style={{gridTemplateColumns:'1fr 2fr 1.5fr 1fr 1fr 1.5fr',gap:'12px',borderColor:'#ECECF2'}}>
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold w-fit"
                style={sub.entityType==='MERCHANT'?{color:'#0EA5E9',background:'#E0F2FE'}:{color:'#7C3AED',background:'#F5F3FF'}}>
                {sub.entityType==='MERCHANT'?<><Store className="w-3 h-3 mr-1 inline"/>Marchand</>:<><Users className="w-3 h-3 mr-1 inline"/>Sponsor</>}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{sub.subscriptionPlan?.name??'—'}</p>
                {sub.subscriptionPlan?.price&&<p className="text-xs text-gray-400">{sub.subscriptionPlan.price} MAD</p>}
              </div>
              <div>
                <p className="text-xs text-gray-600">{fmtDate(sub.startDate)}</p>
                {sub.endDate&&<p className="text-xs text-gray-400">→ {fmtDate(sub.endDate)}</p>}
              </div>
              <p className="text-sm font-semibold text-gray-800">{sub.amount} MAD</p>
              <StatusBadge status={sub.status}/>
              <div className="flex items-center gap-1.5">
                {sub.status==='ACTIVE'&&(
                  <button onClick={()=>updateSub(sub.id,'SUSPENDED')} disabled={permsLoading||!can('subscriptions','write')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-40" style={{background:'#FEF3C7',color:'#D97706'}}>
                    Suspendre
                  </button>
                )}
                {sub.status==='SUSPENDED'&&(
                  <button onClick={()=>updateSub(sub.id,'ACTIVE')} disabled={permsLoading||!can('subscriptions','write')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-40" style={{background:'#DCFCE7',color:'#16A34A'}}>
                    Réactiver
                  </button>
                )}
                {(sub.status==='ACTIVE'||sub.status==='SUSPENDED')&&(
                  <button onClick={()=>updateSub(sub.id,'CANCELLED')} disabled={permsLoading||!can('subscriptions','write')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-40" style={{background:'#FEE2E2',color:'#DC2626'}}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Modal */}
      {planModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">{planModal==='create'?'Nouvelle offre':`Modifier — ${editingPlan?.name}`}</h2>
                <p className="text-sm text-gray-400 mt-0.5">Plan d'abonnement</p>
              </div>
              <button onClick={()=>setPlanModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-3">
              {([['Nom *','name','text'],['Description','description','text']] as const).map(([label,key,type])=>(
                <div key={key}><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type={type} value={planForm[key]} onChange={e=>setPlanForm(f=>({...f,[key]:e.target.value}))}
                    style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                    onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prix (MAD) *</label>
                  <input type="number" min="0" step="0.01" placeholder="299" value={planForm.price} onChange={e=>setPlanForm(f=>({...f,price:e.target.value}))}
                    style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                    onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
                </div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Durée (mois) *</label>
                  <input type="number" min="1" placeholder="12" value={planForm.durationMonths} onChange={e=>setPlanForm(f=>({...f,durationMonths:e.target.value}))}
                    style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                    onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
                </div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Inclus <span className="normal-case font-normal text-gray-400">(séparés par virgule)</span></label>
                <input type="text" placeholder="Support prioritaire, Accès API…" value={planForm.features} onChange={e=>setPlanForm(f=>({...f,features:e.target.value}))}
                  style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setPlanModal(null)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={savePlan} disabled={planSaving||!planForm.name||!planForm.price||!planForm.durationMonths}
                style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">
                {planSaving?'Enregistrement…':planModal==='create'?'Créer':'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
