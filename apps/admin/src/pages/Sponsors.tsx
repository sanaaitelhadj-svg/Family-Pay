import { useEffect, useState } from 'react';
import { Users, Search, Plus, X, Edit2, Trash2, Ban, Check, KeyRound, CreditCard, TrendingUp, RefreshCw, ChevronRight, Phone, Mail, Tag, CheckCircle2, UserPlus, ShieldOff } from 'lucide-react';
import { api } from '../api';
import { PasswordResetModal } from '../components/PasswordResetModal';
import { MOROCCAN_CITIES } from '../lib/moroccan-cities';
import { usePermissions } from '../contexts/PermissionsContext';

interface Sponsor {
  id: string; createdAt: string;
  user: { firstName: string; lastName: string | null; phone: string; email: string | null; isActive: boolean; createdAt: string };
  _count: { allocations: number; beneficiaries: number };
}
interface SponsorDetail extends Sponsor {
  pspCustomerReference: string | null; maskedCardReference: string | null; phoneVerifiedAt: string | null;
  totalVolume: number; totalTransactions: number;
  allocations: any[]; beneficiaries: any[];
}

const CAT_LABELS: Record<string,string> = {
  GENERAL:'Général', PHARMACY:'Pharmacie', FOOD:'Alimentation',
  CLOTHING:'Habillement', EDUCATION:'Éducation', LEISURE:'Loisirs',
};
const ALLOC_CATS = Object.keys(CAT_LABELS);

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span style={{ background: isActive ? '#F0FDF4' : '#FEF2F2', color: isActive ? '#166534' : '#991B1B' }}
    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
    <span style={{ background: isActive ? '#22C55E' : '#EF4444' }} className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" />
    {isActive ? 'Actif' : 'Suspendu'}
  </span>
);

const AllocBadge = ({ status }: { status: string }) => {
  const s: Record<string,{bg:string;color:string}> = {
    ACTIVE:    { bg:'#F0FDF4', color:'#166534' },
    PAUSED:    { bg:'#FFF8E6', color:'#B45309' },
    EXPIRED:   { bg:'#F3F4F6', color:'#6B7280' },
    EXHAUSTED: { bg:'#FEF2F2', color:'#991B1B' },
  };
  const st = s[status] ?? s.EXPIRED;
  return <span style={{ background:st.bg, color:st.color }} className="text-xs px-2 py-0.5 rounded-full font-medium">{status}</span>;
};

export default function Sponsors() {
  const { can, loading: permsLoading } = usePermissions();
  const [list, setList]     = useState<Sponsor[]>([]);
  const [detail, setDetail] = useState<SponsorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [createModal, setCreateModal]   = useState(false);
  const [createForm, setCreateForm]     = useState({ firstName:'', lastName:'', phone:'', email:'', password:'', city:'' });
  const [createSaving, setCreateSaving] = useState(false);
  const [phoneOtpModal, setPhoneOtpModal] = useState(false);
  const [otpCode, setOtpCode]             = useState('');
  const [otpStep, setOtpStep]             = useState<'send'|'verify'>('send');
  const [otpLoading, setOtpLoading]       = useState(false);
  const [otpPhone, setOtpPhone]           = useState('');

  const [resetPwdModal, setResetPwdModal]         = useState(false);
  const [allocModal, setAllocModal]               = useState(false);
  const [editAllocTarget, setEditAllocTarget]     = useState<any>(null);
  const [addBeneModal, setAddBeneModal]           = useState(false);
  const [beneModalTab, setBeneModalTab]           = useState<'create'|'select'>('create');
  const [allBeneficiaries, setAllBeneficiaries]   = useState<any[]>([]);
  const [beneSearch, setBeneSearch]               = useState('');
  const [allocForm, setAllocForm]                 = useState({ beneficiaryId:'', category:'GENERAL', limitAmount:'', expiresAt:'', status:'ACTIVE' });
  const [addBeneForm, setAddBeneForm]             = useState({ firstName:'', lastName:'', phone:'', password:'', relationship:'' });
  const [modalSaving, setModalSaving]             = useState(false);
  const [editModal, setEditModal]     = useState(false);
  const [editForm, setEditForm]       = useState({ firstName:'', lastName:'', email:'' });
  const [editSaving, setEditSaving]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionSaving, setActionSaving]   = useState(false);

  const load = () => { setLoading(true); api.get(`/admin/sponsors?_t=${Date.now()}`).then(r => setList(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => { const r = await api.get(`/admin/sponsors/${id}`); setDetail(r.data); };

  const submitCreate = async () => {
    if (!createForm.firstName || !createForm.lastName || !createForm.phone || !createForm.email || createForm.password.length < 8) return;
    if (!/^(\+212|00212|0)[5-7]\d{8}$/.test(createForm.phone)) { alert('Téléphone marocain invalide (ex: 0612345678)'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) { alert('Format email invalide'); return; }
    setCreateSaving(true);
    try {
      await api.post('/admin/sponsors', { firstName:createForm.firstName, lastName:createForm.lastName, phone:createForm.phone, email:createForm.email, password:createForm.password });
      setCreateModal(false); setCreateForm({ firstName:'', lastName:'', phone:'', email:'', password:'', city:'' }); load();
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setCreateSaving(false); }
  };

  const sendPhoneOtp = async () => {
    if (!detail) return; setOtpLoading(true);
    try {
      const r = await api.post(`/admin/sponsors/${detail.id}/send-phone-otp`);
      setOtpPhone(r.data.phone); setOtpStep('verify'); setOtpCode(''); setPhoneOtpModal(true);
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setOtpLoading(false); }
  };

  const verifyPhoneOtp = async () => {
    if (!detail) return; setOtpLoading(true);
    try {
      await api.post(`/admin/sponsors/${detail.id}/verify-phone-otp`, { code: otpCode });
      setPhoneOtpModal(false); setOtpCode(''); setOtpStep('send');
      const r = await api.get(`/admin/sponsors/${detail.id}`); setDetail(r.data);
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setOtpLoading(false); }
  };

  const submitEdit = async () => {
    if (!detail) return; setEditSaving(true);
    try { await api.patch(`/admin/sponsors/${detail.id}`, editForm); setEditModal(false); const r = await api.get(`/admin/sponsors/${detail.id}`); setDetail(r.data); load(); }
    catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setEditSaving(false); }
  };

  const toggleStatus = async () => {
    if (!detail) return; setActionSaving(true);
    try {
      const r = await api.patch(`/admin/sponsors/${detail.id}/status`);
      const newIsActive: boolean = r.data?.isActive ?? !detail.user.isActive;
      setDetail(d => d ? { ...d, user: { ...d.user, isActive: newIsActive } } : null);
      setList(l => l.map(s => s.id === detail.id ? { ...s, user: { ...s.user, isActive: newIsActive } } : s));
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setActionSaving(false); }
  };

  const saveAlloc = async () => {
    if (!detail) return; setModalSaving(true);
    try {
      if (editAllocTarget) {
        const r = await api.patch(`/admin/sponsors/${detail.id}/allocations/${editAllocTarget.id}`, { limitAmount:Number(allocForm.limitAmount), status:allocForm.status, expiresAt:allocForm.expiresAt||null });
        setDetail(d => d ? { ...d, allocations: d.allocations.map((a:any) => a.id===editAllocTarget.id ? {...a,...r.data} : a) } : null);
      } else {
        const r = await api.post(`/admin/sponsors/${detail.id}/allocations`, { beneficiaryId:allocForm.beneficiaryId, category:allocForm.category, limitAmount:Number(allocForm.limitAmount), expiresAt:allocForm.expiresAt||null });
        setDetail(d => d ? { ...d, allocations:[...d.allocations, r.data] } : null);
      }
      setAllocModal(false); setEditAllocTarget(null);
      setAllocForm({ beneficiaryId:'', category:'GENERAL', limitAmount:'', expiresAt:'', status:'ACTIVE' });
    } catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setModalSaving(false); }
  };

  const deleteAlloc = async (allocId: string) => {
    if (!detail || !window.confirm('Supprimer cette allocation ?')) return;
    try { await api.delete(`/admin/sponsors/${detail.id}/allocations/${allocId}`); setDetail(d => d ? { ...d, allocations: d.allocations.filter((a:any) => a.id !== allocId) } : null); }
    catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
  };

  const linkBene = async (beneId: string) => {
    if (!detail) return; setModalSaving(true);
    try { await api.patch(`/admin/beneficiaries/${beneId}/link-sponsor`, { sponsorId: detail.id }); const r = await api.get(`/admin/sponsors/${detail.id}?_t=${Date.now()}`); setDetail(r.data); setAddBeneModal(false); setBeneSearch(''); }
    catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setModalSaving(false); }
  };

  const saveBene = async () => {
    if (!detail) return; setModalSaving(true);
    try { await api.post('/admin/beneficiaries', { ...addBeneForm, sponsorId: detail.id }); setAddBeneModal(false); setAddBeneForm({ firstName:'', lastName:'', phone:'', password:'', relationship:'' }); const r = await api.get(`/admin/sponsors/${detail.id}?_t=${Date.now()}`); setDetail(r.data); }
    catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setModalSaving(false); }
  };

  const deleteSponsor = async () => {
    if (!detail) return; setActionSaving(true);
    try { await api.delete(`/admin/sponsors/${detail.id}`); setDeleteConfirm(false); setDetail(null); load(); }
    catch (err: any) { alert(err.response?.data?.message ?? 'Erreur'); }
    finally { setActionSaving(false); }
  };

  const filtered = list.filter(s => !search || `${s.user.firstName} ${s.user.lastName??''} ${s.user.phone}`.toLowerCase().includes(search.toLowerCase()));
  const stats = { total:list.length, actifs:list.filter(s=>s.user.isActive).length, suspendus:list.filter(s=>!s.user.isActive).length };

  return (
    <>
    <div style={{background:'#F8F8FC'}} className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Sponsors</h1><p className="text-sm text-gray-500 mt-0.5">{list.length} sponsors enregistrés</p></div>
        <button onClick={()=>setCreateModal(true)} disabled={permsLoading||!can('sponsors','add')}
          style={{background:'#5B3DF5'}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 shadow-sm">
          <Plus className="w-4 h-4"/>Nouveau sponsor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'Total', value:stats.total, Icon:Users, color:'#5B3DF5', bg:'rgba(91,61,245,0.08)' },
          { label:'Actifs', value:stats.actifs, Icon:CheckCircle2, color:'#22C55E', bg:'#F0FDF4' },
          { label:'Suspendus', value:stats.suspendus, Icon:ShieldOff, color:'#EF4444', bg:'#FEF2F2' },
        ].map(({label,value,Icon,color,bg})=>(
          <div key={label} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div style={{background:bg}} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" style={{color}}/></div>
            <div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input type="text" placeholder="Rechercher un sponsor..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{border:'1px solid #ECECF2'}} className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-gray-50 focus:outline-none focus:bg-white"
              onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
          </div>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 p-1.5"><RefreshCw className="w-4 h-4"/></button>
          <span className="text-xs text-gray-400">{filtered.length} résultat{filtered.length!==1?'s':''}</span>
        </div>
      </div>

      {/* List + Detail */}
      <div className="flex gap-4" style={{minHeight:480}}>
        {/* List */}
        <div style={{width:detail?'40%':'100%',background:'#fff',border:'1px solid #ECECF2',transition:'width 0.2s ease'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div style={{borderBottom:'1px solid #ECECF2'}} className="px-4 py-3"><span className="text-sm font-semibold text-gray-700">Liste des sponsors</span></div>
          <div className="overflow-y-auto flex-1" style={{maxHeight:600}}>
            {loading ? <div className="flex items-center justify-center h-32"><div style={{borderColor:'#5B3DF5',borderTopColor:'transparent'}} className="w-6 h-6 border-2 rounded-full animate-spin"/></div>
            : filtered.length===0 ? <div className="flex flex-col items-center justify-center h-32 text-gray-400"><Users className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">Aucun sponsor trouvé</p></div>
            : filtered.map(s=>(
              <div key={s.id} onClick={()=>openDetail(s.id)}
                style={{background:detail?.id===s.id?'rgba(91,61,245,0.04)':'transparent',borderLeft:detail?.id===s.id?'3px solid #5B3DF5':'3px solid transparent',borderBottom:'1px solid #F3F4F6'}}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <div style={{color:'#5B3DF5',background:'rgba(91,61,245,0.08)'}} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold">
                  {s.user.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.user.firstName} {s.user.lastName??''}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3"/>{s.user.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <StatusBadge isActive={s.user.isActive}/>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{s._count.allocations} alloc.</span>
                    <span>·</span>
                    <span>{s._count.beneficiaries} bénéf.</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0"/>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        {detail && (
          <div style={{width:'60%',background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div style={{borderBottom:'1px solid #ECECF2'}} className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div style={{background:'rgba(91,61,245,0.08)',color:'#5B3DF5'}} className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {detail.user.firstName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{detail.user.firstName} {detail.user.lastName??''}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3"/>{detail.user.phone}</span>
                      {detail.user.email && <><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3"/>{detail.user.email}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge isActive={detail.user.isActive}/>
                  <button onClick={()=>setDetail(null)} className="ml-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={()=>{setEditForm({firstName:detail.user.firstName,lastName:detail.user.lastName??'',email:detail.user.email??''});setEditModal(true);}}
                  disabled={permsLoading||!can('sponsors','write')} style={{border:'1px solid #ECECF2'}}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <Edit2 className="w-3.5 h-3.5"/>Modifier
                </button>
                <button onClick={toggleStatus} disabled={permsLoading||!can('sponsors','suspend')||actionSaving}
                  style={{background:detail.user.isActive?'#FEF2F2':'#F0FDF4',color:detail.user.isActive?'#EF4444':'#22C55E'}}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40">
                  {detail.user.isActive ? <><Ban className="w-3.5 h-3.5"/>Suspendre</> : <><Check className="w-3.5 h-3.5"/>Activer</>}
                </button>
                <button onClick={()=>setResetPwdModal(true)} disabled={permsLoading||!can('sponsors','reset-password')} style={{border:'1px solid #ECECF2'}}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <KeyRound className="w-3.5 h-3.5"/>MDP
                </button>
                <button onClick={sendPhoneOtp} disabled={otpLoading||!!detail.phoneVerifiedAt}
                  style={{background:detail.phoneVerifiedAt?'#F0FDF4':'#FFF8E6',color:detail.phoneVerifiedAt?'#166534':'#B45309'}}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">
                  <Phone className="w-3.5 h-3.5"/>{detail.phoneVerifiedAt?'Tél. vérifié':'Vérifier par SMS'}
                </button>
                <button onClick={()=>setDeleteConfirm(true)} disabled={permsLoading||!can('sponsors','delete')||actionSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40" style={{background:'#EF4444'}}>
                  <Trash2 className="w-3.5 h-3.5"/>Supprimer
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div style={{background:'rgba(91,61,245,0.05)',border:'1px solid rgba(91,61,245,0.1)'}} className="rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold" style={{color:'#5B3DF5'}}>{detail.totalTransactions}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1"><CreditCard className="w-3 h-3"/>Transactions</p>
                </div>
                <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0'}} className="rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{Number(detail.totalVolume).toFixed(0)}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3"/>MAD volume</p>
                </div>
              </div>

                {/* PSP / Carte */}
                <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div style={{background:'rgba(91,61,245,0.08)'}} className="w-7 h-7 rounded-lg flex items-center justify-center"><CreditCard className="w-4 h-4" style={{color:'#5B3DF5'}}/></div>
                    <h3 className="text-sm font-semibold text-gray-700">Paiement &amp; PSP</h3>
                  </div>
                  <div className="space-y-2.5">
                    <div style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400"/>
                        <span className="text-xs text-gray-500">Téléphone vérifié</span>
                      </div>
                      {detail.phoneVerifiedAt
                        ? <span style={{background:'#F0FDF4',color:'#166534'}} className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"><Check className="w-3 h-3"/>Vérifié le {new Date(detail.phoneVerifiedAt).toLocaleDateString('fr-FR')}</span>
                        : <span style={{background:'#FEF2F2',color:'#991B1B'}} className="text-xs font-medium px-2 py-0.5 rounded-full">Non vérifié</span>
                      }
                    </div>
                    <div style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-gray-400"/>
                        <span className="text-xs text-gray-500">Référence PSP client</span>
                      </div>
                      {detail.pspCustomerReference
                        ? <span className="text-xs font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg">{detail.pspCustomerReference}</span>
                        : <span className="text-xs text-gray-400 italic">Non renseigné</span>
                      }
                    </div>
                    <div style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-gray-400"/>
                        <span className="text-xs text-gray-500">Référence carte (masquée)</span>
                      </div>
                      {detail.maskedCardReference
                        ? <span className="text-xs font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg tracking-widest">{detail.maskedCardReference}</span>
                        : <span className="text-xs text-gray-400 italic">Aucune carte enregistrée</span>
                      }
                    </div>
                    <div style={{background:'rgba(91,61,245,0.04)',border:'1px solid rgba(91,61,245,0.15)'}} className="rounded-xl px-3 py-2.5 flex items-start gap-2">
                      <span className="text-sm flex-shrink-0">🔒</span>
                      <p className="text-xs text-gray-500 leading-relaxed"><span className="font-semibold text-gray-700">Sécurité :</span> Les cartes sont tokenisées par le PSP. La plateforme FamilyPay ne stocke <span className="font-semibold text-red-600">JAMAIS</span> les données carte complètes.</p>
                    </div>
                  </div>
                </div>

              {/* Bénéficiaires */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div style={{background:'rgba(91,61,245,0.08)'}} className="w-7 h-7 rounded-lg flex items-center justify-center"><Users className="w-4 h-4" style={{color:'#5B3DF5'}}/></div>
                    <h3 className="text-sm font-semibold text-gray-700">Bénéficiaires ({detail.beneficiaries.length})</h3>
                  </div>
                  {can('beneficiaries','add') && (
                    <button onClick={()=>{setBeneModalTab('create');setAddBeneModal(true);api.get(`/admin/beneficiaries?_t=${Date.now()}`).then(r=>setAllBeneficiaries(r.data));}}
                      style={{background:'rgba(91,61,245,0.08)',color:'#5B3DF5'}} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80">
                      <UserPlus className="w-3.5 h-3.5"/>Ajouter
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {detail.beneficiaries.map((b:any)=>(
                    <div key={b.id} style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="flex items-center justify-between px-3 py-2 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div style={{color:'#5B3DF5',background:'rgba(91,61,245,0.08)'}} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">{b.user.firstName.charAt(0)}</div>
                        <span className="text-sm font-medium text-gray-800">{b.user.firstName} {b.user.lastName??''}</span>
                      </div>
                      <span className="text-xs text-gray-400">{b.user.phone}</span>
                    </div>
                  ))}
                  {detail.beneficiaries.length===0 && <p className="text-xs text-gray-400 text-center py-3">Aucun bénéficiaire</p>}
                </div>
              </div>

              {/* Allocations */}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div style={{background:'rgba(91,61,245,0.08)'}} className="w-7 h-7 rounded-lg flex items-center justify-center"><Tag className="w-4 h-4" style={{color:'#5B3DF5'}}/></div>
                    <h3 className="text-sm font-semibold text-gray-700">Allocations ({detail.allocations.length})</h3>
                  </div>
                  {can('sponsors','write') && detail.beneficiaries.length>0 && (
                    <button onClick={()=>{setEditAllocTarget(null);setAllocForm({beneficiaryId:'',category:'GENERAL',limitAmount:'',expiresAt:'',status:'ACTIVE'});setAllocModal(true);}}
                      style={{background:'rgba(91,61,245,0.08)',color:'#5B3DF5'}} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80">
                      <Plus className="w-3.5 h-3.5"/>Ajouter
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {detail.allocations.map((a:any)=>(
                    <div key={a.id} style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{CAT_LABELS[a.category]??a.category}</span>
                          <AllocBadge status={a.status}/>
                        </div>
                        <div className="flex items-center gap-2">
                          {can('sponsors','write') && <button onClick={()=>{setEditAllocTarget(a);setAllocForm({beneficiaryId:a.beneficiaryId,category:a.category,limitAmount:String(Number(a.limitAmount)),expiresAt:a.expiresAt?a.expiresAt.slice(0,10):'',status:a.status});setAllocModal(true);}} className="text-gray-400 hover:text-indigo-500"><Edit2 className="w-3.5 h-3.5"/></button>}
                          {can('sponsors','delete') && <button onClick={()=>deleteAlloc(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>}
                        </div>
                      </div>
                      <div className="mt-1.5">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{Number(a.remainingAmount).toFixed(0)} MAD restant</span>
                          <span>{Number(a.limitAmount).toFixed(0)} MAD limite</span>
                        </div>
                        <div style={{background:'#ECECF2'}} className="h-1.5 rounded-full overflow-hidden">
                          <div style={{background:'#5B3DF5',width:`${Math.min(100,(Number(a.remainingAmount)/Number(a.limitAmount))*100)}%`}} className="h-full rounded-full transition-all"/>
                        </div>
                      </div>
                    </div>
                  ))}
                  {detail.allocations.length===0 && <p className="text-xs text-gray-400 text-center py-3">Aucune allocation</p>}
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center pb-2">Inscrit le {new Date(detail.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Password Reset */}
    {resetPwdModal && detail && (
      <PasswordResetModal endpoint={`/admin/sponsors/${detail.id}/reset-password`} name={`${detail.user.firstName} ${detail.user.lastName??''}`.trim()} onClose={()=>setResetPwdModal(false)}/>
    )}

    {/* Edit Modal */}
    {editModal && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-start justify-between"><h2 className="text-base font-bold text-gray-900">Modifier le sponsor</h2><button onClick={()=>setEditModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
          {([['Prénom *','firstName'],['Nom *','lastName'],['Email *','email']] as const).map(([label,key])=>(
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

    {/* Delete Confirm */}
    {deleteConfirm && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-2">Confirmer la suppression</h2>
          <p className="text-sm text-gray-500 mb-6">Le compte sera désactivé. Cette action est réversible.</p>
          <div className="flex justify-end gap-3">
            <button onClick={()=>setDeleteConfirm(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button onClick={deleteSponsor} disabled={actionSaving} style={{background:'#EF4444'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{actionSaving?'...':'Confirmer'}</button>
          </div>
        </div>
      </div>
    )}

    {/* Create Modal */}
    {createModal && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-gray-900">Nouveau sponsor</h2><p className="text-sm text-gray-500 mt-0.5">Créer un compte sponsor</p></div><button onClick={()=>setCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
          <div className="grid grid-cols-2 gap-3">
            {([['Prénom *','firstName','text'],['Nom *','lastName','text'],['Téléphone *','phone','text'],['Email *','email','email']] as const).map(([label,key,type])=>(
              <div key={key}><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
                <input type={type} value={createForm[key]} onChange={e=>setCreateForm(f=>({...f,[key]:e.target.value}))}
                  style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
              </div>
            ))}
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mot de passe * <span className="normal-case font-normal text-gray-400">(8 car. min)</span></label>
              <input type="password" value={createForm.password} onChange={e=>setCreateForm(f=>({...f,password:e.target.value}))}
                style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
            </div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ville</label>
              <select value={createForm.city} onChange={e=>setCreateForm(f=>({...f,city:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="">Sélectionner...</option>{MOROCCAN_CITIES.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={()=>setCreateModal(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button onClick={submitCreate} disabled={createSaving||!createForm.firstName||!createForm.lastName||!createForm.phone||!createForm.email||createForm.password.length<8}
              style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{createSaving?'Création...':'Créer le sponsor'}</button>
          </div>
        </div>
      </div>
    )}

    {/* Allocation Modal */}
    {allocModal && detail && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-start justify-between"><h2 className="text-base font-bold text-gray-900">{editAllocTarget?'Modifier l\'allocation':'Nouvelle allocation'}</h2><button onClick={()=>{setAllocModal(false);setEditAllocTarget(null);}} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
          {!editAllocTarget && <>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Bénéficiaire *</label>
              <select value={allocForm.beneficiaryId} onChange={e=>setAllocForm(f=>({...f,beneficiaryId:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="">Sélectionner...</option>{detail.beneficiaries.map((b:any)=><option key={b.id} value={b.id}>{b.user.firstName} — {b.user.phone}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Catégorie *</label>
              <select value={allocForm.category} onChange={e=>setAllocForm(f=>({...f,category:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                {ALLOC_CATS.map(cat=><option key={cat} value={cat}>{CAT_LABELS[cat]}</option>)}
              </select>
            </div>
          </>}
          {editAllocTarget && <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Statut</label>
            <select value={allocForm.status} onChange={e=>setAllocForm(f=>({...f,status:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
              {['ACTIVE','PAUSED','EXPIRED','EXHAUSTED'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>}
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Montant limite (MAD) *</label>
            <input type="number" min="0" value={allocForm.limitAmount} onChange={e=>setAllocForm(f=>({...f,limitAmount:e.target.value}))} placeholder="ex: 500"
              style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
          </div>
          <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Expiration (optionnel)</label>
            <input type="date" value={allocForm.expiresAt} onChange={e=>setAllocForm(f=>({...f,expiresAt:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"/>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={()=>{setAllocModal(false);setEditAllocTarget(null);}} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            <button onClick={saveAlloc} disabled={modalSaving||!allocForm.limitAmount||(!editAllocTarget&&!allocForm.beneficiaryId)}
              style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{modalSaving?'Enregistrement...':editAllocTarget?'Modifier':'Créer'}</button>
          </div>
        </div>
      </div>
    )}

    {/* Add Beneficiary Modal */}
    {addBeneModal && detail && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-gray-900">Ajouter un bénéficiaire</h2><p className="text-sm text-gray-500 mt-0.5">Sponsor : {detail.user.firstName}</p></div><button onClick={()=>setAddBeneModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
          <div style={{borderBottom:'1px solid #ECECF2'}} className="flex">
            {(['select','create'] as const).map(tab=>(
              <button key={tab} onClick={()=>setBeneModalTab(tab)}
                style={{borderBottom:beneModalTab===tab?'2px solid #5B3DF5':'2px solid transparent',color:beneModalTab===tab?'#5B3DF5':'#6B7280'}}
                className="px-4 py-2 text-sm font-medium -mb-px">
                {tab==='select'?'Sélectionner existant':'Créer nouveau'}
              </button>
            ))}
          </div>
          {beneModalTab==='select' ? (
            <div className="space-y-3">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input type="text" placeholder="Rechercher par nom ou téléphone..." value={beneSearch} onChange={e=>setBeneSearch(e.target.value)}
                  style={{border:'1px solid #ECECF2'}} className="w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none bg-gray-50"/>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {allBeneficiaries.filter(b=>!detail.beneficiaries.some((db:any)=>db.id===b.id)).filter(b=>!beneSearch||`${b.user.firstName} ${b.user.phone}`.toLowerCase().includes(beneSearch.toLowerCase())).map(b=>(
                  <button key={b.id} onClick={()=>linkBene(b.id)} disabled={modalSaving}
                    style={{border:'1px solid #ECECF2'}} className="w-full text-left px-3 py-2 rounded-xl bg-gray-50 hover:bg-indigo-50 transition-colors">
                    <p className="text-sm font-medium text-gray-900">{b.user.firstName} {b.user.lastName??''}</p>
                    <p className="text-xs text-gray-400">{b.user.phone}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[{label:'Prénom *',key:'firstName',type:'text'},{label:'Nom',key:'lastName',type:'text'},{label:'Téléphone *',key:'phone',type:'tel'},{label:'Mot de passe *',key:'password',type:'password'},{label:'Lien',key:'relationship',type:'text'}].map(({label,key,type})=>(
                <div key={key}><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
                  <input type={type} value={(addBeneForm as any)[key]} onChange={e=>setAddBeneForm(f=>({...f,[key]:e.target.value}))}
                    style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"/>
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={()=>setAddBeneModal(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                <button onClick={saveBene} disabled={modalSaving||!addBeneForm.firstName||!addBeneForm.phone||!addBeneForm.password}
                  style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{modalSaving?'Création...':'Créer'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
