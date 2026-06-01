import { useEffect, useState } from 'react';
import { Users, Search, Plus, X, Edit2, Trash2, Ban, Check, KeyRound, CreditCard, TrendingUp, RefreshCw, ChevronRight, Phone, Mail, Tag, CheckCircle2, ShieldOff, Baby } from 'lucide-react';
import { api } from '../api';
import { PasswordResetModal } from '../components/PasswordResetModal';
import { MOROCCAN_CITIES } from '../lib/moroccan-cities';
import { usePermissions } from '../contexts/PermissionsContext';

interface Beneficiary {
  id: string; isActive: boolean; isMinor: boolean; createdAt: string; relationship: string | null;
  user: { firstName: string; lastName: string | null; phone: string; email: string | null; createdAt: string };
  sponsor: { user: { firstName: string } };
  _count: { allocations: number };
}

const CAT_LABELS: Record<string,string> = { GENERAL:'Général', PHARMACY:'Pharmacie', FOOD:'Alimentation', CLOTHING:'Habillement', EDUCATION:'Éducation', LEISURE:'Loisirs' };

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span style={{ background:isActive?'#F0FDF4':'#FEF2F2', color:isActive?'#166534':'#991B1B' }}
    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
    <span style={{ background:isActive?'#22C55E':'#EF4444' }} className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" />
    {isActive ? 'Actif' : 'Suspendu'}
  </span>
);
const AllocBadge = ({ status }: { status: string }) => {
  const s: Record<string,{bg:string;color:string}> = { ACTIVE:{bg:'#F0FDF4',color:'#166534'}, PAUSED:{bg:'#FFF8E6',color:'#B45309'}, EXPIRED:{bg:'#F3F4F6',color:'#6B7280'}, EXHAUSTED:{bg:'#FEF2F2',color:'#991B1B'} };
  const st = s[status] ?? s.EXPIRED;
  return <span style={{background:st.bg,color:st.color}} className="text-xs px-2 py-0.5 rounded-full font-medium">{status}</span>;
};

export default function Beneficiaries() {
  const { can, loading: permsLoading } = usePermissions();
  const [list, setList]     = useState<Beneficiary[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm]   = useState({ firstName:'', lastName:'', phone:'', password:'', sponsorId:'', relationship:'', city:'', dateOfBirth:'' });
  const [sponsors, setSponsors]       = useState<{ id:string; user:{firstName:string;phone:string} }[]>([]);
  const [createSaving, setCreateSaving] = useState(false);

  const [resetPwdModal, setResetPwdModal]     = useState(false);
  const [editAllocTarget, setEditAllocTarget] = useState<any>(null);
  const [allocForm, setAllocForm]             = useState({ limitAmount:'', status:'ACTIVE', expiresAt:'' });
  const [allocSaving, setAllocSaving]         = useState(false);
  const [editModal, setEditModal]   = useState(false);
  const [editForm, setEditForm]     = useState({ firstName:'', lastName:'', email:'', relationship:'' });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionSaving, setActionSaving]   = useState(false);

  const load = () => { setLoading(true); api.get(`/admin/beneficiaries?_t=${Date.now()}`).then(r => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const loadSponsors = async () => { try { const r = await api.get('/admin/sponsors'); setSponsors(r.data); } catch { setSponsors([]); } };
  const openDetail = async (id: string) => { const r = await api.get(`/admin/beneficiaries/${id}`); setDetail(r.data); };

  const submitCreate = async () => {
    if (!createForm.firstName||!createForm.phone||!createForm.password||!createForm.sponsorId) return;
    setCreateSaving(true);
    try { await api.post('/admin/beneficiaries',{firstName:createForm.firstName,lastName:createForm.lastName||undefined,phone:createForm.phone,password:createForm.password,sponsorId:createForm.sponsorId,relationship:createForm.relationship||undefined,dateOfBirth:createForm.dateOfBirth||undefined}); setCreateModal(false); setCreateForm({firstName:'',lastName:'',phone:'',password:'',sponsorId:'',relationship:'',city:'',dateOfBirth:''}); load(); }
    catch (err:any) { alert(err.response?.data?.message??'Erreur'); }
    finally { setCreateSaving(false); }
  };

  const submitEdit = async () => {
    if (!detail) return; setEditSaving(true);
    try { await api.patch(`/admin/beneficiaries/${detail.id}`,{firstName:editForm.firstName,lastName:editForm.lastName||undefined,email:editForm.email||undefined}); setEditModal(false); const r = await api.get(`/admin/beneficiaries/${detail.id}`); setDetail(r.data); load(); }
    catch (err:any) { alert(err.response?.data?.message??'Erreur'); }
    finally { setEditSaving(false); }
  };

  const toggleStatus = async () => {
    if (!detail) return; setActionSaving(true);
    try { const r = await api.patch(`/admin/beneficiaries/${detail.id}/status`); const v:boolean=r.data?.isActive??!detail.isActive; setDetail((d:any)=>d?{...d,isActive:v}:null); setList(l=>l.map(b=>b.id===detail.id?{...b,isActive:v}:b)); }
    catch (err:any) { alert(err.response?.data?.message??'Erreur'); }
    finally { setActionSaving(false); }
  };

  const saveEditAlloc = async () => {
    if (!editAllocTarget) return; setAllocSaving(true);
    try { const r = await api.patch(`/admin/sponsors/${editAllocTarget.sponsorId}/allocations/${editAllocTarget.id}`,{limitAmount:Number(allocForm.limitAmount),status:allocForm.status,expiresAt:allocForm.expiresAt||null}); setDetail((d:any)=>d?{...d,allocations:d.allocations.map((a:any)=>a.id===editAllocTarget.id?{...a,...r.data}:a)}:null); setEditAllocTarget(null); }
    catch (err:any) { alert(err.response?.data?.message??'Erreur'); }
    finally { setAllocSaving(false); }
  };

  const deleteAlloc = async (a: any) => {
    if (!window.confirm('Supprimer cette allocation ?')) return;
    try { await api.delete(`/admin/sponsors/${a.sponsorId}/allocations/${a.id}`); setDetail((d:any)=>d?{...d,allocations:d.allocations.filter((al:any)=>al.id!==a.id)}:null); }
    catch (err:any) { alert(err.response?.data?.message??'Erreur'); }
  };

  const deleteBeneficiary = async () => {
    if (!detail) return; setActionSaving(true);
    try { await api.delete(`/admin/beneficiaries/${detail.id}`); setDeleteConfirm(false); setDetail(null); load(); }
    catch (err:any) { alert(err.response?.data?.message??'Erreur'); }
    finally { setActionSaving(false); }
  };

  const filtered = list.filter(b => !search || `${b.user.firstName} ${b.user.lastName??''} ${b.user.phone}`.toLowerCase().includes(search.toLowerCase()));
  const stats = { total:list.length, actifs:list.filter(b=>b.isActive).length, mineurs:list.filter(b=>b.isMinor).length };

  return (
    <>
    <div style={{background:'#F8F8FC'}} className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Bénéficiaires</h1><p className="text-sm text-gray-500 mt-0.5">{list.length} bénéficiaires enregistrés</p></div>
        <button onClick={()=>{loadSponsors();setCreateModal(true);}} disabled={permsLoading||!can('beneficiaries','add')}
          style={{background:'#5B3DF5'}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4"/>Nouveau bénéficiaire
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{label:'Total',value:stats.total,Icon:Users,color:'#5B3DF5',bg:'rgba(91,61,245,0.08)'},{label:'Actifs',value:stats.actifs,Icon:CheckCircle2,color:'#22C55E',bg:'#F0FDF4'},{label:'Mineurs',value:stats.mineurs,Icon:Baby,color:'#F59E0B',bg:'#FFF8E6'}].map(({label,value,Icon,color,bg})=>(
          <div key={label} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div style={{background:bg}} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" style={{color}}/></div>
            <div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input type="text" placeholder="Rechercher un bénéficiaire..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{border:'1px solid #ECECF2'}} className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-gray-50 focus:outline-none focus:bg-white"
              onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
          </div>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 p-1.5"><RefreshCw className="w-4 h-4"/></button>
          <span className="text-xs text-gray-400">{filtered.length} résultat{filtered.length!==1?'s':''}</span>
        </div>
      </div>

      <div className="flex gap-4" style={{minHeight:480}}>
        <div style={{width:detail?'40%':'100%',background:'#fff',border:'1px solid #ECECF2',transition:'width 0.2s ease'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div style={{borderBottom:'1px solid #ECECF2'}} className="px-4 py-3"><span className="text-sm font-semibold text-gray-700">Liste des bénéficiaires</span></div>
          <div className="overflow-y-auto flex-1" style={{maxHeight:600}}>
            {loading ? <div className="flex items-center justify-center h-32"><div style={{borderColor:'#5B3DF5',borderTopColor:'transparent'}} className="w-6 h-6 border-2 rounded-full animate-spin"/></div>
            : filtered.length===0 ? <div className="flex flex-col items-center justify-center h-32 text-gray-400"><Users className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">Aucun bénéficiaire</p></div>
            : filtered.map(b=>(
              <div key={b.id} onClick={()=>openDetail(b.id)}
                style={{background:detail?.id===b.id?'rgba(91,61,245,0.04)':'transparent',borderLeft:detail?.id===b.id?'3px solid #5B3DF5':'3px solid transparent',borderBottom:'1px solid #F3F4F6'}}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <div style={{color:'#5B3DF5',background:'rgba(91,61,245,0.08)'}} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold">
                  {b.user.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.user.firstName} {b.user.lastName??''}</p>
                    {b.isMinor && <span style={{background:'#FFF8E6',color:'#B45309'}} className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">Mineur</span>}
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3"/>{b.user.phone} · {b.sponsor.user.firstName}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <StatusBadge isActive={b.isActive}/>
                  <span className="text-xs text-gray-400">{b._count.allocations} alloc.</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0"/>
              </div>
            ))}
          </div>
        </div>

        {detail && (
          <div style={{width:'60%',background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div style={{borderBottom:'1px solid #ECECF2'}} className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div style={{background:'rgba(91,61,245,0.08)',color:'#5B3DF5'}} className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0">{detail.user.firstName.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900">{detail.user.firstName} {detail.user.lastName??''}</h2>
                      {detail.isMinor && <span style={{background:'#FFF8E6',color:'#B45309'}} className="text-xs px-2 py-0.5 rounded-full font-medium">Mineur</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3"/>{detail.user.phone}</span>
                      {detail.user.email&&<><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3"/>{detail.user.email}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2"><StatusBadge isActive={detail.isActive}/><button onClick={()=>setDetail(null)} className="ml-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={()=>{setEditForm({firstName:detail.user.firstName,lastName:detail.user.lastName??'',email:detail.user.email??'',relationship:detail.relationship??''});setEditModal(true);}}
                  disabled={permsLoading||!can('beneficiaries','write')} style={{border:'1px solid #ECECF2'}}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <Edit2 className="w-3.5 h-3.5"/>Modifier
                </button>
                <button onClick={toggleStatus} disabled={permsLoading||!can('beneficiaries','suspend')||actionSaving}
                  style={{background:detail.isActive?'#FEF2F2':'#F0FDF4',color:detail.isActive?'#EF4444':'#22C55E'}}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40">
                  {detail.isActive?<><Ban className="w-3.5 h-3.5"/>Suspendre</>:<><Check className="w-3.5 h-3.5"/>Activer</>}
                </button>
                <button onClick={()=>setResetPwdModal(true)} disabled={permsLoading||!can('beneficiaries','reset-password')} style={{border:'1px solid #ECECF2'}}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <KeyRound className="w-3.5 h-3.5"/>MDP
                </button>
                <button onClick={()=>setDeleteConfirm(true)} disabled={permsLoading||!can('beneficiaries','delete')||actionSaving}
                  style={{background:'#EF4444'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40">
                  <Trash2 className="w-3.5 h-3.5"/>Supprimer
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4 grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400 mb-0.5">Sponsor</p><p className="text-sm font-medium text-gray-800">{detail.sponsor?.user?.firstName}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Lien familial</p><p className="text-sm font-medium text-gray-800">{detail.relationship||'Non renseigné'}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Inscrit le</p><p className="text-sm font-medium text-gray-800">{new Date(detail.createdAt).toLocaleDateString('fr-FR')}</p></div>
              </div>
              <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div style={{background:'rgba(91,61,245,0.08)'}} className="w-7 h-7 rounded-lg flex items-center justify-center"><Tag className="w-4 h-4" style={{color:'#5B3DF5'}}/></div>
                  <h3 className="text-sm font-semibold text-gray-700">Allocations ({detail.allocations?.length??0})</h3>
                </div>
                <div className="space-y-2">
                  {detail.allocations?.map((a:any)=>(
                    <div key={a.id} style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-800">{CAT_LABELS[a.category]??a.category}</span><AllocBadge status={a.status}/></div>
                        <div className="flex items-center gap-2">
                          {can('beneficiaries','write')&&<button onClick={()=>{setEditAllocTarget(a);setAllocForm({limitAmount:String(Number(a.limitAmount)),status:a.status,expiresAt:a.expiresAt?a.expiresAt.slice(0,10):''});}} className="text-gray-400 hover:text-indigo-500"><Edit2 className="w-3.5 h-3.5"/></button>}
                          {can('beneficiaries','delete')&&<button onClick={()=>deleteAlloc(a)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>}
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{Number(a.remainingAmount).toFixed(0)} MAD restant</span><span>{Number(a.limitAmount).toFixed(0)} MAD limite</span></div>
                        <div style={{background:'#ECECF2'}} className="h-1.5 rounded-full overflow-hidden"><div style={{background:'#5B3DF5',width:`${Math.min(100,(Number(a.remainingAmount)/Number(a.limitAmount))*100)}%`}} className="h-full rounded-full"/></div>
                      </div>
                    </div>
                  ))}
                  {!detail.allocations?.length&&<p className="text-xs text-gray-400 text-center py-3">Aucune allocation</p>}
                </div>
              </div>
              {detail.transactions?.length>0&&(
                <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div style={{background:'rgba(91,61,245,0.08)'}} className="w-7 h-7 rounded-lg flex items-center justify-center"><CreditCard className="w-4 h-4" style={{color:'#5B3DF5'}}/></div>
                    <h3 className="text-sm font-semibold text-gray-700">Transactions récentes</h3>
                  </div>
                  <div className="space-y-2">
                    {detail.transactions.slice(0,10).map((t:any)=>(
                      <div key={t.id} style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2 flex justify-between items-center">
                        <div><p className="text-sm font-medium text-gray-800">{t.merchant?.businessName}</p><p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString('fr-FR')}</p></div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{Number(t.amount).toFixed(0)} MAD</p>
                          <span className={`text-xs ${t.status==='COMPLETED'?'text-green-600':'text-red-500'}`}>{t.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {resetPwdModal&&detail&&<PasswordResetModal endpoint={`/admin/beneficiaries/${detail.id}/reset-password`} name={`${detail.user.firstName} ${detail.user.lastName??''}`.trim()} onClose={()=>setResetPwdModal(false)}/>}

    {editModal&&(
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-start justify-between"><h2 className="text-base font-bold text-gray-900">Modifier le bénéficiaire</h2><button onClick={()=>setEditModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
          {([['Prénom *','firstName'],['Nom','lastName'],['Email','email'],['Relation','relationship']] as const).map(([label,key])=>(
            <div key={key}><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
              <input type={key==='email'?'email':'text'} value={editForm[key]} onChange={e=>setEditForm(f=>({...f,[key]:e.target.value}))}
                style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
            </div>
          ))}
          <div className="flex justify-end gap-3">
            <button onClick={()=>setEditModal(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button onClick={submitEdit} disabled={editSaving||!editForm.firstName} style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{editSaving?'Enregistrement...':'Enregistrer'}</button>
          </div>
        </div>
      </div>
    )}

    {deleteConfirm&&(
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-2">Confirmer la suppression</h2>
          <p className="text-sm text-gray-500 mb-6">Le compte sera désactivé. Cette action est réversible.</p>
          <div className="flex justify-end gap-3">
            <button onClick={()=>setDeleteConfirm(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button onClick={deleteBeneficiary} disabled={actionSaving} style={{background:'#EF4444'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{actionSaving?'...':'Confirmer'}</button>
          </div>
        </div>
      </div>
    )}

    {createModal&&(
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-gray-900">Nouveau bénéficiaire</h2><p className="text-sm text-gray-500 mt-0.5">Créer un compte bénéficiaire</p></div><button onClick={()=>setCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
          <div className="grid grid-cols-2 gap-3">
            {([['Prénom *','firstName','text'],['Nom','lastName','text'],['Téléphone *','phone','text'],['Relation','relationship','text']] as const).map(([label,key,type])=>(
              <div key={key}><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
                <input type={type} value={createForm[key]} onChange={e=>setCreateForm(f=>({...f,[key]:e.target.value}))}
                  style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
              </div>
            ))}
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date de naissance <span className="normal-case font-normal text-gray-400">(détermine si mineur)</span></label><input type="date" value={createForm.dateOfBirth} onChange={e=>setCreateForm(f=>({...f,dateOfBirth:e.target.value}))} max={new Date().toISOString().split('T')[0]} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/></div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sponsor *</label>
              <select value={createForm.sponsorId} onChange={e=>setCreateForm(f=>({...f,sponsorId:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="">— Sélectionner un sponsor —</option>{sponsors.map(s=><option key={s.id} value={s.id}>{s.user.firstName} ({s.user.phone})</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ville</label>
              <select value={createForm.city} onChange={e=>setCreateForm(f=>({...f,city:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="">Sélectionner...</option>{MOROCCAN_CITIES.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mot de passe * <span className="normal-case font-normal text-gray-400">(8 car. min)</span></label>
              <input type="password" value={createForm.password} onChange={e=>setCreateForm(f=>({...f,password:e.target.value}))}
                style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={()=>setCreateModal(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button onClick={submitCreate} disabled={createSaving||!createForm.firstName||!createForm.phone||createForm.password.length<8||!createForm.sponsorId}
              style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{createSaving?'Création...':'Créer le bénéficiaire'}</button>
          </div>
        </div>
      </div>
    )}

    {editAllocTarget&&(
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-gray-900">Modifier l'allocation</h2><p className="text-sm text-gray-500 mt-0.5">{CAT_LABELS[editAllocTarget.category]??editAllocTarget.category} — {detail?.user?.firstName}</p></div><button onClick={()=>setEditAllocTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Montant limite (MAD)</label>
            <input type="number" min="0" value={allocForm.limitAmount} onChange={e=>setAllocForm(f=>({...f,limitAmount:e.target.value}))}
              style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
          </div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Statut</label>
            <select value={allocForm.status} onChange={e=>setAllocForm(f=>({...f,status:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
              {['ACTIVE','PAUSED','EXPIRED','EXHAUSTED'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expiration (optionnel)</label>
            <input type="date" value={allocForm.expiresAt} onChange={e=>setAllocForm(f=>({...f,expiresAt:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"/>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={()=>setEditAllocTarget(null)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button onClick={saveEditAlloc} disabled={allocSaving||!allocForm.limitAmount} style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{allocSaving?'Enregistrement...':'Modifier'}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
