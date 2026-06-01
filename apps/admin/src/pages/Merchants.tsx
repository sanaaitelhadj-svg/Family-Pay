import React, { useEffect, useState } from 'react';
import { Store, Search, Plus, X, Check, Ban, Edit2, Save, ChevronRight, MapPin, Phone, Mail, Tag, CreditCard, FileText, CheckCircle2, Clock, AlertCircle, KeyRound, Users, Landmark, Shield, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { PasswordResetModal } from '../components/PasswordResetModal';

interface Contact { name?: string; phone?: string; email?: string; }
interface Merchant {
  id: string; businessName: string; category: string; city: string; phone: string; email?: string; address?: string;
  kycStatus: 'PENDING_PSP' | 'APPROVED' | 'REJECTED'; activationStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  registrationNumber?: string; iceNumber?: string; taxId?: string; legalForm?: string;
  bankName?: string; iban?: string; rib?: string;
  contactAdmin?: Contact; contactFinance?: Contact; contactOps?: Contact; contactLegal?: Contact;
  contractUrl?: string; billingType?: 'commission' | 'subscription'; commissionType?: string; commissionRate?: number;
  planId?: string; planName?: string; subscriptionStart?: string; subscriptionEnd?: string;
  cguVersion?: string; cguSignedAt?: string; createdAt: string;
}
interface Plan { id: string; name: string; price: number; durationMonths: number; isActive: boolean; }
interface ApprovalForm { contractUrl: string; billingType: 'commission' | 'subscription'; commissionType: string; commissionRate: string; planId: string; startDate: string; endDate: string; }
interface CreateForm { businessName: string; category: string; city: string; phone: string; registrationNumber: string; iceNumber: string; address: string; password: string; }

const CATEGORY_OPTIONS = [
  { value:'FOOD',      label:'Alimentation / Restauration' },
  { value:'PHARMACY',  label:'Pharmacie & Santé' },
  { value:'CLOTHING',  label:'Habillement' },
  { value:'EDUCATION', label:'Éducation' },
  { value:'LEISURE',   label:'Loisirs & Culture' },
  { value:'GENERAL',   label:'Général / Autres' },
];
const CATEGORIES = CATEGORY_OPTIONS.map(o => o.value);
const catLabel = (v: string) => CATEGORY_OPTIONS.find(o => o.value === v)?.label ?? v;
const MOROCCAN_CITIES = ['Casablanca','Rabat','Marrakech','Fès','Tanger','Agadir','Meknès','Oujda','Kénitra','Tétouan','Safi','Mohammedia','El Jadida','Beni Mellal','Nador','Settat','Khémisset','Laâyoune','Taza','Berrechid'];
const defaultApprovalForm: ApprovalForm = { contractUrl:'', billingType:'commission', commissionType:'TRANSACTION_PERCENTAGE', commissionRate:'', planId:'', startDate:'', endDate:'' };
const defaultCreateForm: CreateForm = { businessName:'', category:CATEGORY_OPTIONS[0].value, city:'', phone:'', registrationNumber:'', iceNumber:'', address:'', password:'' };

const KycBadge = ({ status }: { status: Merchant['kycStatus'] }) => {
  const s = { PENDING_PSP:{label:'En attente KYC',bg:'#FFF8E6',color:'#B45309',dot:'#F59E0B'}, APPROVED:{label:'KYC Approuvé',bg:'#F0FDF4',color:'#166534',dot:'#22C55E'}, REJECTED:{label:'KYC Rejeté',bg:'#FEF2F2',color:'#991B1B',dot:'#EF4444'} }[status] ?? {label:status,bg:'#F3F4F6',color:'#6B7280',dot:'#9CA3AF'};
  return <span style={{background:s.bg,color:s.color}} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"><span style={{background:s.dot}} className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" />{s.label}</span>;
};
const ActiveBadge = ({ status }: { status: Merchant['activationStatus'] }) => {
  const s = { PENDING:{label:'Inactif',bg:'#F3F4F6',color:'#6B7280',dot:'#9CA3AF'}, ACTIVE:{label:'Actif',bg:'#F0FDF4',color:'#166534',dot:'#22C55E'}, SUSPENDED:{label:'Suspendu',bg:'#FEF2F2',color:'#991B1B',dot:'#EF4444'} }[status] ?? {label:status,bg:'#F3F4F6',color:'#6B7280',dot:'#9CA3AF'};
  return <span style={{background:s.bg,color:s.color}} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"><span style={{background:s.dot}} className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" />{s.label}</span>;
};
const InfoRow = ({ label, value }: { label: string; value?: string | null }) =>
  value ? <div><p className="text-xs text-gray-400 mb-0.5">{label}</p><p className="text-sm text-gray-800 font-medium break-all">{value}</p></div> : null;

const EditField = ({ label, field, value, draft, onChange }: { label: string; field: string; value?: string | null; draft: Partial<Merchant>; onChange: (f: string, v: any) => void }) => (
  <div><p className="text-xs text-gray-400 mb-0.5">{label}</p>
    <input type="text" value={String((draft as any)[field] ?? value ?? '')} onChange={e => onChange(field, e.target.value)}
      style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
      onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')} /></div>
);
const ContactCard = ({ label, contact }: { label: string; contact?: Contact }) => (
  <div style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl p-3">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
    {contact?.name ? <div className="space-y-1"><p className="text-sm font-medium text-gray-800">{contact.name}</p>
      {contact.phone && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Phone className="w-3 h-3 flex-shrink-0"/>{contact.phone}</p>}
      {contact.email && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Mail className="w-3 h-3 flex-shrink-0"/>{contact.email}</p>}</div>
    : <p className="text-xs text-gray-400 italic">Non renseigné</p>}
  </div>
);
const ContactEditFields = ({ label, prefix, draft, onChange }: { label: string; prefix: string; draft: Partial<Merchant>; onChange: (f: string, v: any) => void }) => {
  const key = ('contact' + prefix.charAt(0).toUpperCase() + prefix.slice(1)) as keyof Merchant;
  const contact = ((draft[key] || {}) as Contact);
  const update = (f: keyof Contact, v: string) => onChange(key as string, { ...contact, [f]: v });
  return (
    <div style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <input type="text" placeholder="Nom" value={contact.name??''} onChange={e=>update('name',e.target.value)} style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"/>
      <input type="text" placeholder="Téléphone" value={contact.phone??''} onChange={e=>update('phone',e.target.value)} style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"/>
      <input type="email" placeholder="Email" value={contact.email??''} onChange={e=>update('email',e.target.value)} style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"/>
    </div>
  );
};
const SectionHeader = ({ icon: Icon, title }: { icon: React.ComponentType<{className?: string; style?: React.CSSProperties}>; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <div style={{background:'rgba(91,61,245,0.08)'}} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" style={{color:'#5B3DF5'}}/>
    </div>
    <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
  </div>
);

export default function Merchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Merchant>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterKyc, setFilterKyc] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [approvalModal, setApprovalModal] = useState<{id:string;name:string;isEdit:boolean}|null>(null);
  const [approvalForm, setApprovalForm] = useState<ApprovalForm>(defaultApprovalForm);
  const [rejectModal, setRejectModal] = useState<{id:string;name:string}|null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(defaultCreateForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [resetPwdModal, setResetPwdModal] = useState<string|null>(null);

  useEffect(() => { fetchMerchants(); fetchPlans(); }, []);
  const fetchMerchants = async () => { setLoading(true); try { const d = await api.get('/admin/merchants'); setMerchants(d.data); } catch(e){console.error(e);} finally{setLoading(false);} };
  const fetchPlans = async () => { try { const d = await api.get('/admin/plans'); setPlans(d.data); } catch(e){console.error(e);} };
  const updateDraft = (field: string, value: any) => setDraft(d => ({ ...d, [field]: value }));
  const save = async () => {
    if (!selected) return; setSaving(true);
    try { const res = await api.put(`/admin/merchants/${selected.id}`, draft); const u = res.data; setMerchants(m=>m.map(x=>x.id===selected.id?{...x,...u}:x)); setSelected(s=>s?{...s,...u}:s); setEditing(false); setDraft({}); }
    catch(e){console.error(e);} finally{setSaving(false);}
  };
  const openApprovalModal = (m: Merchant) => {
    const isEdit = m.activationStatus === 'ACTIVE';
    setApprovalForm({ ...defaultApprovalForm, contractUrl:m.contractUrl??'', billingType:m.billingType??'commission', commissionType:m.commissionType??'TRANSACTION_PERCENTAGE', commissionRate:m.commissionRate!=null?String(m.commissionRate):'', planId:m.planId??'', startDate:m.subscriptionStart?m.subscriptionStart.slice(0,10):'', endDate:m.subscriptionEnd?m.subscriptionEnd.slice(0,10):'' });
    setApprovalModal({ id:m.id, name:m.businessName, isEdit });
  };
  const handlePlanChange = (planId: string) => { const p=plans.find(x=>x.id===planId); const patch:Partial<ApprovalForm>={planId}; if(p&&approvalForm.startDate){const e=new Date(approvalForm.startDate);e.setMonth(e.getMonth()+p.durationMonths);patch.endDate=e.toISOString().slice(0,10);} setApprovalForm(f=>({...f,...patch})); };
  const handleStartDateChange = (date: string) => { const p=plans.find(x=>x.id===approvalForm.planId); const patch:Partial<ApprovalForm>={startDate:date}; if(p&&date){const e=new Date(date);e.setMonth(e.getMonth()+p.durationMonths);patch.endDate=e.toISOString().slice(0,10);} setApprovalForm(f=>({...f,...patch})); };
  const submitApproval = async () => {
    if(!approvalModal) return; setSaving(true);
    try {
      const payload:any={contractUrl:approvalForm.contractUrl||undefined,billingType:approvalForm.billingType};
      if(approvalForm.billingType==='commission'){payload.commissionType=approvalForm.commissionType;payload.commissionRate=approvalForm.commissionRate?Number(approvalForm.commissionRate):undefined;}
      else{payload.planId=approvalForm.planId||undefined;payload.subscriptionStart=approvalForm.startDate||undefined;payload.subscriptionEnd=approvalForm.endDate||undefined;}
      const ep=approvalModal.isEdit?`/admin/merchants/${approvalModal.id}/billing`:`/admin/merchants/${approvalModal.id}/approve`;
      await api.post(ep,payload); await fetchMerchants(); setApprovalModal(null); setApprovalForm(defaultApprovalForm);
    } catch(e){console.error(e);} finally{setSaving(false);}
  };
  const reject = async () => { if(!rejectModal||!rejectReason.trim()) return; setSaving(true); try { await api.post(`/admin/merchants/${rejectModal.id}/reject`,{reason:rejectReason}); await fetchMerchants(); if(selected?.id===rejectModal.id)setSelected(null); setRejectModal(null); setRejectReason(''); } catch(e){console.error(e);} finally{setSaving(false);} };
  const toggleActive = async (m: Merchant) => { try { await api.post(m.activationStatus==='ACTIVE'?`/admin/merchants/${m.id}/suspend`:`/admin/merchants/${m.id}/activate`,{}); await fetchMerchants(); } catch(e){console.error(e);} };
  const submitCreate = async () => { if(!createForm.businessName||!createForm.phone||!createForm.password||!createForm.city) return; setCreateSaving(true); try { await api.post('/admin/merchants/create',createForm); await fetchMerchants(); setCreateModal(false); setCreateForm(defaultCreateForm); } catch(e){console.error(e);} finally{setCreateSaving(false);} };

  const filtered = merchants.filter(m => {
    const q=search.toLowerCase();
    return (!q||m.businessName.toLowerCase().includes(q)||m.city.toLowerCase().includes(q)||(m.phone&&m.phone.includes(q))||(m.email&&m.email.toLowerCase().includes(q)))&&(!filterCategory||m.category===filterCategory)&&(!filterKyc||m.kycStatus===filterKyc)&&(!filterActive||m.activationStatus===filterActive);
  });
  const stats = { total:merchants.length, active:merchants.filter(m=>m.activationStatus==='ACTIVE').length, pending:merchants.filter(m=>m.kycStatus==='PENDING_PSP').length, rejected:merchants.filter(m=>m.kycStatus==='REJECTED').length };
  const uniqueCategories = [...new Set(merchants.map(m=>m.category).filter(Boolean))];

  return (
    <div style={{background:'#F8F8FC'}} className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Marchands</h1><p className="text-sm text-gray-500 mt-0.5">{merchants.length} marchands enregistrés</p></div>
        <button onClick={()=>setCreateModal(true)} style={{background:'#5B3DF5'}} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"><Plus className="w-4 h-4"/>Nouveau marchand</button>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[{label:'Total',value:stats.total,Icon:Store,color:'#5B3DF5',bg:'rgba(91,61,245,0.08)'},{label:'Actifs',value:stats.active,Icon:CheckCircle2,color:'#22C55E',bg:'#F0FDF4'},{label:'En attente KYC',value:stats.pending,Icon:Clock,color:'#F59E0B',bg:'#FFF8E6'},{label:'Rejetés',value:stats.rejected,Icon:AlertCircle,color:'#EF4444',bg:'#FEF2F2'}].map(({label,value,Icon,color,bg})=>(
          <div key={label} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div style={{background:bg}} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" style={{color}}/></div>
            <div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>
      <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input type="text" placeholder="Rechercher un marchand..." value={search} onChange={e=>setSearch(e.target.value)} style={{border:'1px solid #ECECF2'}} className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-gray-50 focus:outline-none focus:bg-white" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
          </div>
          <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} style={{border:'1px solid #ECECF2'}} className="px-3 py-2 rounded-xl text-sm bg-gray-50 text-gray-600 focus:outline-none"><option value="">Toutes catégories</option>{uniqueCategories.map(c=><option key={c} value={c}>{catLabel(c)}</option>)}</select>
          <select value={filterKyc} onChange={e=>setFilterKyc(e.target.value)} style={{border:'1px solid #ECECF2'}} className="px-3 py-2 rounded-xl text-sm bg-gray-50 text-gray-600 focus:outline-none"><option value="">Statut KYC</option><option value="PENDING_PSP">En attente</option><option value="APPROVED">Approuvé</option><option value="REJECTED">Rejeté</option></select>
          <select value={filterActive} onChange={e=>setFilterActive(e.target.value)} style={{border:'1px solid #ECECF2'}} className="px-3 py-2 rounded-xl text-sm bg-gray-50 text-gray-600 focus:outline-none"><option value="">Statut activation</option><option value="PENDING">Inactif</option><option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option></select>
          {(search||filterCategory||filterKyc||filterActive)&&<button onClick={()=>{setSearch('');setFilterCategory('');setFilterKyc('');setFilterActive('');}} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100"><X className="w-3.5 h-3.5"/>Effacer</button>}
          <button onClick={fetchMerchants} className="ml-auto text-gray-400 hover:text-gray-600 p-1.5"><RefreshCw className="w-4 h-4"/></button>
          <span className="text-xs text-gray-400">{filtered.length} résultat{filtered.length!==1?'s':''}</span>
        </div>
      </div>
      <div className="flex gap-4" style={{minHeight:480}}>
        <div style={{width:selected?'40%':'100%',background:'#fff',border:'1px solid #ECECF2',transition:'width 0.2s ease'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div style={{borderBottom:'1px solid #ECECF2'}} className="px-4 py-3"><span className="text-sm font-semibold text-gray-700">Liste des marchands</span></div>
          <div className="overflow-y-auto flex-1" style={{maxHeight:600}}>
            {loading ? <div className="flex items-center justify-center h-32"><div style={{borderColor:'#5B3DF5',borderTopColor:'transparent'}} className="w-6 h-6 border-2 rounded-full animate-spin"/></div>
            : filtered.length===0 ? <div className="flex flex-col items-center justify-center h-32 text-gray-400"><Store className="w-8 h-8 mb-2 opacity-40"/><p className="text-sm">Aucun marchand trouvé</p></div>
            : filtered.map(m=>(
              <div key={m.id} onClick={()=>{setSelected(m);setEditing(false);setDraft({});}}
                style={{background:selected?.id===m.id?'rgba(91,61,245,0.04)':'transparent',borderLeft:selected?.id===m.id?'3px solid #5B3DF5':'3px solid transparent',borderBottom:'1px solid #F3F4F6'}}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <div style={{color:'#5B3DF5',background:'rgba(91,61,245,0.08)'}} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold">{m.businessName.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.businessName}</p>
                  <div className="flex items-center gap-2 mt-0.5"><span className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3"/>{m.city}</span><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-400 truncate">{catLabel(m.category)}</span></div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0"><KycBadge status={m.kycStatus}/><ActiveBadge status={m.activationStatus}/></div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0"/>
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div style={{width:'60%',background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div style={{borderBottom:'1px solid #ECECF2'}} className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div style={{background:'rgba(91,61,245,0.08)',color:'#5B3DF5'}} className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0">{selected.businessName.charAt(0)}</div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{selected.businessName}</h2>
                    <div className="flex items-center gap-2 mt-0.5"><span className="text-xs text-gray-500 flex items-center gap-1"><Tag className="w-3 h-3"/>{catLabel(selected.category)}</span><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3"/>{selected.city}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0"><KycBadge status={selected.kycStatus}/><ActiveBadge status={selected.activationStatus}/><button onClick={()=>setSelected(null)} className="ml-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {editing ? (
                  <>
                    <button onClick={save} disabled={saving} style={{background:'#5B3DF5'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"><Save className="w-3.5 h-3.5"/>{saving?'Enregistrement...':'Enregistrer'}</button>
                    <button onClick={()=>{setEditing(false);setDraft({});}} style={{border:'1px solid #ECECF2'}} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50">Annuler</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>{setEditing(true);setDraft({});}} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50"><Edit2 className="w-3.5 h-3.5"/>Modifier</button>
                    {selected.kycStatus==='PENDING_PSP' && <>
                      <button onClick={()=>openApprovalModal(selected)} style={{background:'#22C55E'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"><Check className="w-3.5 h-3.5"/>Approuver</button>
                      <button onClick={()=>setRejectModal({id:selected.id,name:selected.businessName})} style={{background:'#EF4444'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"><X className="w-3.5 h-3.5"/>Rejeter</button>
                    </>}
                    {selected.kycStatus==='APPROVED' && <>
                      {selected.activationStatus!=='ACTIVE' && <button onClick={()=>openApprovalModal(selected)} style={{background:'#22C55E'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"><Check className="w-3.5 h-3.5"/>Activer</button>}
                      {selected.activationStatus==='ACTIVE' && <button onClick={()=>openApprovalModal(selected)} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50"><CreditCard className="w-3.5 h-3.5"/>Facturation</button>}
                      <button onClick={()=>toggleActive(selected)} style={{background:selected.activationStatus==='ACTIVE'?'#FEF2F2':'#F0FDF4',color:selected.activationStatus==='ACTIVE'?'#EF4444':'#22C55E'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90"><Ban className="w-3.5 h-3.5"/>{selected.activationStatus==='ACTIVE'?'Suspendre':'Réactiver'}</button>
                    </>}
                    <button onClick={()=>setResetPwdModal(selected.id)} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50"><KeyRound className="w-3.5 h-3.5"/>Mot de passe</button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {(selected.contractUrl||selected.billingType) && (
                <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                  <SectionHeader icon={CreditCard} title="Contrat & Facturation"/>
                  <div className="grid grid-cols-2 gap-3">
                    {selected.contractUrl && <div className="col-span-2"><p className="text-xs text-gray-400 mb-0.5">Contrat</p><a href={selected.contractUrl} target="_blank" rel="noreferrer" className="text-sm font-medium truncate block" style={{color:'#5B3DF5'}}>{selected.contractUrl}</a></div>}
                    {selected.billingType==='commission' && <><InfoRow label="Facturation" value="Commission / transaction"/><InfoRow label="Taux" value={selected.commissionRate!=null?`${selected.commissionRate}${selected.commissionType==='TRANSACTION_PERCENTAGE'?'%':' MAD'}`:undefined}/></>}
                    {selected.billingType==='subscription' && <><InfoRow label="Facturation" value="Abonnement"/><InfoRow label="Offre" value={selected.planName}/><InfoRow label="Début" value={selected.subscriptionStart?new Date(selected.subscriptionStart).toLocaleDateString('fr-FR'):undefined}/><InfoRow label="Fin" value={selected.subscriptionEnd?new Date(selected.subscriptionEnd).toLocaleDateString('fr-FR'):undefined}/></>}
                  </div>
                </div>
              )}
              <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                <SectionHeader icon={Store} title="Informations générales"/>
                <div className="grid grid-cols-2 gap-3">
                  {editing ? <>
                    <EditField label="Nom du commerce" field="businessName" value={selected.businessName} draft={draft} onChange={updateDraft}/>
                    <EditField label="Catégorie" field="category" value={selected.category} draft={draft} onChange={updateDraft}/>
                    <EditField label="Ville" field="city" value={selected.city} draft={draft} onChange={updateDraft}/>
                    <EditField label="Téléphone" field="phone" value={selected.phone} draft={draft} onChange={updateDraft}/>
                    <EditField label="Email" field="email" value={selected.email} draft={draft} onChange={updateDraft}/>
                    <div className="col-span-2"><EditField label="Adresse" field="address" value={selected.address} draft={draft} onChange={updateDraft}/></div>
                  </> : <>
                    <InfoRow label="Nom du commerce" value={selected.businessName}/>
                    <InfoRow label="Catégorie" value={selected.category}/>
                    <InfoRow label="Ville" value={selected.city}/>
                    <InfoRow label="Téléphone" value={selected.phone}/>
                    <InfoRow label="Email" value={selected.email}/>
                    <div className="col-span-2"><InfoRow label="Adresse" value={selected.address}/></div>
                  </>}
                </div>
              </div>
              <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                <SectionHeader icon={FileText} title="Informations légales"/>
                <div className="grid grid-cols-2 gap-3">
                  {editing ? <>
                    <EditField label="Forme juridique" field="legalForm" value={selected.legalForm} draft={draft} onChange={updateDraft}/>
                    <EditField label="N° RC" field="registrationNumber" value={selected.registrationNumber} draft={draft} onChange={updateDraft}/>
                    <EditField label="ICE" field="iceNumber" value={selected.iceNumber} draft={draft} onChange={updateDraft}/>
                    <EditField label="Identifiant fiscal" field="taxId" value={selected.taxId} draft={draft} onChange={updateDraft}/>
                  </> : <>
                    <InfoRow label="Forme juridique" value={selected.legalForm}/>
                    <InfoRow label="N° RC" value={selected.registrationNumber}/>
                    <InfoRow label="ICE" value={selected.iceNumber}/>
                    <InfoRow label="Identifiant fiscal" value={selected.taxId}/>
                  </>}
                </div>
              </div>
              <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                <SectionHeader icon={Landmark} title="Informations bancaires"/>
                <div className="grid grid-cols-2 gap-3">
                  {editing ? <>
                    <EditField label="Banque" field="bankName" value={selected.bankName} draft={draft} onChange={updateDraft}/>
                    <EditField label="IBAN" field="iban" value={selected.iban} draft={draft} onChange={updateDraft}/>
                    <EditField label="RIB" field="rib" value={selected.rib} draft={draft} onChange={updateDraft}/>
                  </> : <>
                    <InfoRow label="Banque" value={selected.bankName}/>
                    <InfoRow label="IBAN" value={selected.iban}/>
                    <InfoRow label="RIB" value={selected.rib}/>
                  </>}
                </div>
              </div>
              <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                <SectionHeader icon={Users} title="Contacts"/>
                {editing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <ContactEditFields label="Administratif" prefix="admin" draft={draft} onChange={updateDraft}/>
                    <ContactEditFields label="Finance" prefix="finance" draft={draft} onChange={updateDraft}/>
                    <ContactEditFields label="Opérations" prefix="ops" draft={draft} onChange={updateDraft}/>
                    <ContactEditFields label="Juridique" prefix="legal" draft={draft} onChange={updateDraft}/>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <ContactCard label="Administratif" contact={selected.contactAdmin}/>
                    <ContactCard label="Finance" contact={selected.contactFinance}/>
                    <ContactCard label="Opérations" contact={selected.contactOps}/>
                    <ContactCard label="Juridique" contact={selected.contactLegal}/>
                  </div>
                )}
              </div>
              {selected.cguSignedAt && (
                <div style={{border:'1px solid #ECECF2'}} className="rounded-xl p-4">
                  <SectionHeader icon={Shield} title="CGU"/>
                  <div className="grid grid-cols-2 gap-3"><InfoRow label="Version signée" value={selected.cguVersion}/><InfoRow label="Signé le" value={new Date(selected.cguSignedAt).toLocaleDateString('fr-FR')}/></div>
                </div>
              )}
              <p className="text-xs text-gray-400 text-center pb-2">Créé le {new Date(selected.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        )}
      </div>

      {approvalModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between">
              <div><h2 className="text-base font-bold text-gray-900">{approvalModal.isEdit?'Modifier la facturation':'Activer le marchand'}</h2><p className="text-sm text-gray-500 mt-0.5">{approvalModal.name}</p></div>
              <button onClick={()=>setApprovalModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">URL du contrat <span className="normal-case font-normal text-gray-400">(optionnel)</span></label>
              <input type="url" placeholder="https://..." value={approvalForm.contractUrl} onChange={e=>setApprovalForm(f=>({...f,contractUrl:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
            </div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type de facturation</label>
              <div className="flex gap-3">
                {(['commission','subscription'] as const).map(val=>(
                  <label key={val} onClick={()=>setApprovalForm(f=>({...f,billingType:val}))} style={{border:approvalForm.billingType===val?'2px solid #5B3DF5':'1px solid #ECECF2',background:approvalForm.billingType===val?'rgba(91,61,245,0.05)':'#F8F8FC'}} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all">
                    <div style={{width:16,height:16,borderRadius:'50%',flexShrink:0,border:approvalForm.billingType===val?'5px solid #5B3DF5':'2px solid #D1D5DB',background:'#fff'}}/>
                    <span className="text-sm font-medium text-gray-700">{val==='commission'?'Commission / transaction':'Abonnement'}</span>
                  </label>
                ))}
              </div>
            </div>
            {approvalForm.billingType==='commission' && (
              <div style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl p-4 grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Type</label><select value={approvalForm.commissionType} onChange={e=>setApprovalForm(f=>({...f,commissionType:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"><option value="TRANSACTION_PERCENTAGE">% par transaction</option><option value="FLAT_FEE">Frais fixe (MAD)</option></select></div>
                <div><label className="block text-xs text-gray-500 mb-1">{approvalForm.commissionType==='TRANSACTION_PERCENTAGE'?'Taux (%)':'Montant (MAD)'}</label><input type="number" step="0.01" min="0" placeholder={approvalForm.commissionType==='TRANSACTION_PERCENTAGE'?'1.5':'5'} value={approvalForm.commissionRate} onChange={e=>setApprovalForm(f=>({...f,commissionRate:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"/></div>
              </div>
            )}
            {approvalForm.billingType==='subscription' && (
              <div style={{background:'#F8F8FC',border:'1px solid #ECECF2'}} className="rounded-xl p-4 space-y-3">
                <div><label className="block text-xs text-gray-500 mb-1">Offre choisie</label><select value={approvalForm.planId} onChange={e=>handlePlanChange(e.target.value)} style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"><option value="">— Sélectionner une offre —</option>{plans.filter(p=>p.isActive).map(p=><option key={p.id} value={p.id}>{p.name} — {p.price} MAD / {p.durationMonths} mois</option>)}</select>{plans.filter(p=>p.isActive).length===0&&<p className="text-xs text-amber-500 mt-1">Aucune offre active disponible</p>}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Date de début</label><input type="date" value={approvalForm.startDate} onChange={e=>handleStartDateChange(e.target.value)} style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"/></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Date de fin {approvalForm.planId&&<span style={{color:'#22C55E'}}>(auto)</span>}</label><input type="date" value={approvalForm.endDate} onChange={e=>setApprovalForm(f=>({...f,endDate:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"/></div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={()=>setApprovalModal(null)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium">Annuler</button>
              <button onClick={submitApproval} disabled={saving||(approvalForm.billingType==='subscription'&&!approvalForm.planId)} style={{background:'#22C55E'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{saving?'Enregistrement...':approvalModal.isEdit?'Enregistrer':'Confirmer & Activer'}</button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-gray-900">Rejeter le marchand</h2><p className="text-sm text-gray-500 mt-0.5">{rejectModal.name}</p></div><button onClick={()=>{setRejectModal(null);setRejectReason('');}} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Motif du rejet</label><textarea rows={3} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Documents incomplets, informations incorrectes..." style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(239,68,68,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/></div>
            <div className="flex justify-end gap-3"><button onClick={()=>{setRejectModal(null);setRejectReason('');}} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium">Annuler</button><button onClick={reject} disabled={!rejectReason.trim()||saving} style={{background:'#EF4444'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{saving?'Rejet...':'Rejeter'}</button></div>
          </div>
        </div>
      )}

      {createModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-gray-900">Nouveau marchand</h2><p className="text-sm text-gray-500 mt-0.5">Créer un compte marchand</p></div><button onClick={()=>setCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nom du commerce <span className="text-red-400">*</span></label><input type="text" value={createForm.businessName} onChange={e=>setCreateForm(f=>({...f,businessName:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Catégorie <span className="text-red-400">*</span></label><select value={createForm.category} onChange={e=>setCreateForm(f=>({...f,category:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">{CATEGORY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ville <span className="text-red-400">*</span></label><select value={createForm.city} onChange={e=>setCreateForm(f=>({...f,city:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"><option value="">Sélectionner...</option>{MOROCCAN_CITIES.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Téléphone <span className="text-red-400">*</span></label><input type="text" value={createForm.phone} onChange={e=>setCreateForm(f=>({...f,phone:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">N° RC</label><input type="text" value={createForm.registrationNumber} onChange={e=>setCreateForm(f=>({...f,registrationNumber:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"/></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">ICE</label><input type="text" value={createForm.iceNumber} onChange={e=>setCreateForm(f=>({...f,iceNumber:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"/></div>
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Adresse</label><input type="text" value={createForm.address} onChange={e=>setCreateForm(f=>({...f,address:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"/></div>
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mot de passe <span className="text-red-400">*</span></label><input type="password" value={createForm.password} onChange={e=>setCreateForm(f=>({...f,password:e.target.value}))} style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none" onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/></div>
            </div>
            <div className="flex justify-end gap-3"><button onClick={()=>setCreateModal(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium">Annuler</button><button onClick={submitCreate} disabled={createSaving||!createForm.businessName||!createForm.phone||createForm.password.length<8||!createForm.city} style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">{createSaving?'Création...':'Créer le marchand'}</button></div>
          </div>
        </div>
      )}

      {resetPwdModal && (
        <PasswordResetModal endpoint={`/admin/merchants/${resetPwdModal}/reset-password`} name={merchants.find(m=>m.id===resetPwdModal)?.businessName??'Marchand'} onClose={()=>setResetPwdModal(null)}/>
      )}
    </div>
  );
}
