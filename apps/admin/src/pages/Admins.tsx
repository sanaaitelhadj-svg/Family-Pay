import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Users, Shield, Plus, RefreshCw, CheckCircle2, XCircle, X, ChevronRight, Key, Trash2, Edit2, UserCheck, UserX } from 'lucide-react';

interface Role {
  id: string; name: string; description?: string;
  permissions: Record<string,{read:boolean;write:boolean}>;
  isActive: boolean;
}
interface Admin {
  id: string; firstName: string; lastName: string; email: string; phone: string;
  isActive: boolean; adminRole?: {id:string;name:string}|null;
}

const PAGES = ['dashboard','merchants','subscriptions','commissions','transactions','fraud','sponsors','beneficiaries','admins'];
const PAGE_LABELS: Record<string,string> = {
  dashboard:'Dashboard', merchants:'Marchands', subscriptions:'Abonnements',
  commissions:'Commissions', transactions:'Transactions', fraud:'Revue de fraude',
  sponsors:'Sponsors', beneficiaries:'Bénéficiaires', admins:'Administrateurs',
};


function emptyPerms(): Record<string,{read:boolean;write:boolean}> {
  return Object.fromEntries(PAGES.map(p=>[p,{read:false,write:false}]));
}

function PermMatrix({ perms, onChange, disabled }: {
  perms: Record<string,{read:boolean;write:boolean}>;
  onChange: (p: typeof perms) => void; disabled?: boolean;
}) {
  const toggle = (page:string, field:'read'|'write') => {
    if(disabled) return;
    const cur = perms[page]??{read:false,write:false};
    onChange({...perms,[page]:{...cur,[field]:!cur[field]}});
  };
  const allRead  = PAGES.every(p=>(perms[p]??{read:false}).read);
  const allWrite = PAGES.every(p=>(perms[p]??{write:false}).write);
  const toggleAll = (field:'read'|'write', val:boolean) => {
    if(disabled) return;
    const next = {...perms};
    PAGES.forEach(p=>{ next[p]={...(next[p]??{read:false,write:false}),[field]:val}; });
    onChange(next);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{background:'#F8F8FC'}}>
            <th className="text-left px-3 py-2 font-semibold text-gray-500">Page</th>
            <th className="px-6 py-2 font-semibold text-gray-500 text-center">Lecture</th>
            <th className="px-6 py-2 font-semibold text-gray-500 text-center">Écriture</th>
          </tr>
          <tr style={{background:'#F0EDFF',borderBottom:'2px solid #ECECF2'}}>
            <td className="px-3 py-2 text-xs font-bold" style={{color:'#5B3DF5'}}>Tout sélectionner</td>
            <td className="px-6 py-2 text-center">
              <input type="checkbox" checked={allRead} onChange={e=>toggleAll('read',e.target.checked)} disabled={disabled}
                className="w-4 h-4 rounded cursor-pointer" style={{accentColor:'#5B3DF5'}}/>
            </td>
            <td className="px-6 py-2 text-center">
              <input type="checkbox" checked={allWrite} onChange={e=>toggleAll('write',e.target.checked)} disabled={disabled}
                className="w-4 h-4 rounded cursor-pointer" style={{accentColor:'#5B3DF5'}}/>
            </td>
          </tr>
        </thead>
        <tbody>
          {PAGES.map((page,i)=>{
            const p = perms[page]??{read:false,write:false};
            return (
              <tr key={page} style={{background:i%2===0?'#fff':'#FAFAFA',borderBottom:'1px solid #ECECF2'}}>
                <td className="px-3 py-2 font-medium text-gray-700">{PAGE_LABELS[page]}</td>
                <td className="px-6 py-2 text-center">
                  <input type="checkbox" checked={p.read} onChange={()=>toggle(page,'read')} disabled={disabled}
                    className="w-4 h-4 rounded cursor-pointer" style={{accentColor:'#5B3DF5'}}/>
                </td>
                <td className="px-6 py-2 text-center">
                  <input type="checkbox" checked={p.write} onChange={()=>toggle(page,'write')} disabled={disabled}
                    className="w-4 h-4 rounded cursor-pointer" style={{accentColor:'#5B3DF5'}}/>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Admins() {
  const [tab, setTab]           = useState<'admins'|'roles'>('admins');
  const [admins, setAdmins]     = useState<Admin[]>([]);
  const [roles, setRoles]       = useState<Role[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [detail, setDetail]     = useState<Admin|null>(null);

  // Modals
  const [createAdminModal, setCreateAdminModal] = useState(false);
  const [createRoleModal,  setCreateRoleModal]  = useState(false);
  const [editRoleModal,    setEditRoleModal]     = useState<Role|null>(null);
  const [resetPwdModal,    setResetPwdModal]     = useState<Admin|null>(null);

  // Forms
  const [adminForm, setAdminForm] = useState({firstName:'',lastName:'',phone:'',email:'',password:''});
  const [roleForm,  setRoleForm]  = useState<{name:string;description:string;permissions:Record<string,{read:boolean;write:boolean}>}>({name:'',description:'',permissions:emptyPerms()});
  const [newPwd,    setNewPwd]    = useState('');

  const loadAll = useCallback(()=>{
    setLoading(true);
    Promise.all([api.get('/admin/admins'), api.get('/admin/roles')])
      .then(([a,r])=>{ setAdmins(a.data); setRoles(r.data); })
      .finally(()=>setLoading(false));
  },[]);
  useEffect(loadAll,[loadAll]);

  async function createAdmin() {
    setSaving(true);
    try { await api.post('/admin/admins',{...adminForm,lastName:adminForm.lastName||undefined,email:adminForm.email||undefined}); setCreateAdminModal(false); setAdminForm({firstName:'',lastName:'',phone:'',email:'',password:''}); loadAll(); }
    catch(e:any){ alert(e.response?.data?.message||'Erreur'); }
    finally{ setSaving(false); }
  }

  async function toggleStatus(a: Admin) {
    setSaving(true);
    try { await api.patch(`/admin/admins/${a.id}/status`,{isActive:!a.isActive}); loadAll(); if(detail?.id===a.id) setDetail({...a,isActive:!a.isActive}); }
    catch(e:any){ alert(e.response?.data?.message||'Erreur'); }
    finally{ setSaving(false); }
  }

  async function deleteAdmin(id: string) {
    if(!confirm('Supprimer cet admin ?')) return;
    setSaving(true);
    try { await api.delete(`/admin/admins/${id}`); setDetail(null); loadAll(); }
    catch(e:any){ alert(e.response?.data?.message||'Erreur'); }
    finally{ setSaving(false); }
  }

  async function assignRole(adminId:string, roleId:string|null) {
    setSaving(true);
    try { await api.patch(`/admin/admins/${adminId}/role`,{roleId}); loadAll(); }
    catch(e:any){ alert(e.response?.data?.message||'Erreur'); }
    finally{ setSaving(false); }
  }

  async function resetPassword(adminId:string, password:string) {
    setSaving(true);
    try { await api.patch(`/admin/admins/${adminId}/reset-password`,{newPassword:password}); setResetPwdModal(null); setNewPwd(''); alert('Mot de passe réinitialisé'); }
    catch(e:any){ alert(e.response?.data?.message||'Erreur'); }
    finally{ setSaving(false); }
  }

  async function createRole() {
    setSaving(true);
    try { await api.post('/admin/roles',roleForm); setCreateRoleModal(false); setRoleForm({name:'',description:'',permissions:emptyPerms()}); loadAll(); }
    catch(e:any){ alert(e.response?.data?.message||'Erreur'); }
    finally{ setSaving(false); }
  }

  async function updateRole(id:string, data:Partial<typeof roleForm>) {
    setSaving(true);
    try { await api.patch(`/admin/roles/${id}`,data); setEditRoleModal(null); loadAll(); }
    catch(e:any){ alert(e.response?.data?.message||'Erreur'); }
    finally{ setSaving(false); }
  }

  async function deleteRole(id:string) {
    if(!confirm('Désactiver ce rôle ?')) return;
    setSaving(true);
    try { await api.delete(`/admin/roles/${id}`); loadAll(); }
    catch(e:any){ alert(e.response?.data?.message||'Erreur'); }
    finally{ setSaving(false); }
  }

  const activeAdmins = admins.filter(a=>a.isActive).length;

  return (
    <div className="h-full flex flex-col" style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'#1A1040'}}>Administrateurs</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestion des accès et des rôles</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4"/>
          </button>
          {tab==='admins'
            ? <button onClick={()=>setCreateAdminModal(true)} style={{background:'#5B3DF5'}} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white font-semibold hover:opacity-90 shadow-sm"><Plus className="w-4 h-4"/>Nouvel admin</button>
            : <button onClick={()=>setCreateRoleModal(true)} style={{background:'#5B3DF5'}} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white font-semibold hover:opacity-90 shadow-sm"><Plus className="w-4 h-4"/>Nouveau rôle</button>
          }
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{background:'#F8F8FC',border:'1px solid #ECECF2'}}>
        {([['admins','Administrateurs',Users],['roles','Rôles & permissions',Shield]] as const).map(([key,label,Icon])=>(
          <button key={key} onClick={()=>setTab(key)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab===key?{background:'#fff',color:'#5B3DF5',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}:{color:'#6B7280'}}>
            <Icon className="w-4 h-4"/>{label}
          </button>
        ))}
      </div>

      {tab === 'admins' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              {label:'Total admins', value:admins.length.toString(), icon:Users, color:'#5B3DF5', bg:'#EDE9FF'},
              {label:'Actifs',        value:activeAdmins.toString(),  icon:UserCheck, color:'#16A34A', bg:'#DCFCE7'},
              {label:'Rôles actifs',  value:roles.filter(r=>r.isActive).length.toString(), icon:Shield, color:'#0EA5E9', bg:'#E0F2FE'},
            ].map(({label,value,icon:Icon,color,bg})=>(
              <div key={label} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:bg}}>
                  <Icon className="w-5 h-5" style={{color}}/>
                </div>
                <div><p className="text-xs text-gray-400 font-medium">{label}</p><p className="text-xl font-bold mt-0.5" style={{color:'#1A1040'}}>{value}</p></div>
              </div>
            ))}
          </div>

          {/* Admin list + detail */}
          <div className="flex-1 flex gap-4 min-h-0">
            <div style={{background:'#fff',border:'1px solid #ECECF2',flex:detail?'0 0 50%':'1'}} className="rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="grid px-4 py-3 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr',borderColor:'#ECECF2',gap:'12px'}}>
                <span>Admin</span><span>Email / Tél</span><span>Rôle</span><span>Statut</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-32 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Chargement…</div>
                ) : admins.map(a=>(
                  <button key={a.id} onClick={()=>setDetail(detail?.id===a.id?null:a)} className="w-full text-left border-b hover:bg-gray-50 transition-colors"
                    style={{borderColor:'#ECECF2',background:detail?.id===a.id?'#F5F3FF':undefined}}>
                    <div className="grid px-4 py-3 items-center" style={{gridTemplateColumns:'2fr 1.5fr 1fr 1fr',gap:'12px'}}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:'#5B3DF5'}}>
                          {a.firstName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{a.firstName} {a.lastName||''}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 truncate">{a.email||'—'}</p>
                        <p className="text-xs text-gray-400">{a.phone}</p>
                      </div>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold truncate" style={{color:'#5B3DF5',background:'#EDE9FF'}}>
                        {a.adminRole?.name||'Aucun'}
                      </span>
                      {a.isActive
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit" style={{color:'#16A34A',background:'#DCFCE7'}}><CheckCircle2 className="w-3 h-3"/>Actif</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit" style={{color:'#DC2626',background:'#FEE2E2'}}><XCircle className="w-3 h-3"/>Inactif</span>
                      }
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t text-xs text-gray-400" style={{borderColor:'#ECECF2'}}>{admins.length} admin{admins.length!==1?'s':''}</div>
            </div>

            {detail && (
              <div style={{background:'#fff',border:'1px solid #ECECF2',flex:'0 0 50%'}} className="rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-start justify-between p-5 border-b" style={{borderColor:'#ECECF2'}}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{background:'#5B3DF5'}}>
                      {detail.firstName[0]}
                    </div>
                    <div>
                      <h2 className="text-base font-bold" style={{color:'#1A1040'}}>{detail.firstName} {detail.lastName||''}</h2>
                      <p className="text-xs text-gray-400">{detail.email||detail.phone}</p>
                    </div>
                  </div>
                  <button onClick={()=>setDetail(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Informations</p>
                    <div className="flex justify-between"><span className="text-xs text-gray-400">Téléphone</span><span className="text-xs font-semibold text-gray-800">{detail.phone}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-gray-400">Email</span><span className="text-xs font-semibold text-gray-800">{detail.email||'—'}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-gray-400">Statut</span>
                      {detail.isActive
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{color:'#16A34A'}}><CheckCircle2 className="w-3.5 h-3.5"/>Actif</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{color:'#DC2626'}}><XCircle className="w-3.5 h-3.5"/>Inactif</span>
                      }
                    </div>
                  </div>

                  <div style={{border:'1px solid #ECECF2'}} className="rounded-2xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Rôle assigné</p>
                    <select value={detail.adminRole?.id||''} onChange={e=>assignRole(detail.id,e.target.value||null)}
                      style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                      <option value="">— Aucun rôle —</option>
                      {roles.filter(r=>r.isActive).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={()=>toggleStatus(detail)} disabled={saving}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                      style={detail.isActive?{background:'#FEF3C7',color:'#D97706'}:{background:'#DCFCE7',color:'#16A34A'}}>
                      {detail.isActive?<><UserX className="w-4 h-4"/>Suspendre</>:<><UserCheck className="w-4 h-4"/>Activer</>}
                    </button>
                    <button onClick={()=>{setResetPwdModal(detail);setNewPwd('');}} disabled={saving}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                      style={{background:'#EDE9FF',color:'#5B3DF5'}}>
                      <Key className="w-4 h-4"/>Réinit. MDP
                    </button>
                  </div>
                  <button onClick={()=>deleteAdmin(detail.id)} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                    style={{background:'#FEE2E2',color:'#DC2626'}}>
                    <Trash2 className="w-4 h-4"/>Supprimer l'admin
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'roles' && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2"/>Chargement…</div>
          ) : roles.length === 0 ? (
            <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl p-12 text-center text-gray-400 shadow-sm">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30"/><p className="text-sm">Aucun rôle créé</p>
            </div>
          ) : roles.map(role=>(
            <div key={role.id} style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:'#ECECF2'}}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'#EDE9FF'}}>
                    <Shield className="w-5 h-5" style={{color:'#5B3DF5'}}/>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{role.name}</p>
                    {role.description && <p className="text-xs text-gray-400">{role.description}</p>}
                  </div>
                  {!role.isActive && <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{color:'#DC2626',background:'#FEE2E2'}}>Inactif</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setEditRoleModal(role)} style={{border:'1px solid #ECECF2'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
                    <Edit2 className="w-3.5 h-3.5"/>Modifier
                  </button>
                  <button onClick={()=>deleteRole(role.id)} style={{border:'1px solid #FEE2E2',color:'#DC2626'}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5"/>Désactiver
                  </button>
                </div>
              </div>
              <div className="p-4">
                <PermMatrix perms={role.permissions} onChange={()=>{}} disabled={true}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Admin Modal */}
      {createAdminModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div><h2 className="text-base font-bold text-gray-900">Nouvel administrateur</h2><p className="text-sm text-gray-400 mt-0.5">Créer un compte admin</p></div>
              <button onClick={()=>setCreateAdminModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([['Prénom *','firstName','text'],['Nom','lastName','text'],['Téléphone *','phone','text'],['Email','email','email']] as const).map(([label,key,type])=>(
                <div key={key}><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type={type} value={adminForm[key]} onChange={e=>setAdminForm(f=>({...f,[key]:e.target.value}))}
                    style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                    onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
                </div>
              ))}
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mot de passe * <span className="normal-case font-normal text-gray-400">(8 car. min)</span></label>
                <input type="password" value={adminForm.password} onChange={e=>setAdminForm(f=>({...f,password:e.target.value}))}
                  style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setCreateAdminModal(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={createAdmin} disabled={saving||!adminForm.firstName||!adminForm.phone||adminForm.password.length<8}
                style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">
                {saving?'Création...':'Créer l\'admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {createRoleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-4xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div><h2 className="text-base font-bold text-gray-900">Nouveau rôle</h2><p className="text-sm text-gray-400 mt-0.5">Définir les permissions</p></div>
              <button onClick={()=>setCreateRoleModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nom du rôle *</label>
                <input value={roleForm.name} onChange={e=>setRoleForm(f=>({...f,name:e.target.value}))}
                  style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                <input value={roleForm.description} onChange={e=>setRoleForm(f=>({...f,description:e.target.value}))}
                  style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
              </div>
            </div>
            <div style={{border:'1px solid #ECECF2'}} className="rounded-xl overflow-hidden">
              <PermMatrix perms={roleForm.permissions} onChange={p=>setRoleForm(f=>({...f,permissions:p}))}/>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setCreateRoleModal(false)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={createRole} disabled={saving||!roleForm.name}
                style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">
                {saving?'Création...':'Créer le rôle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editRoleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-4xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div><h2 className="text-base font-bold text-gray-900">Modifier le rôle</h2><p className="text-sm text-gray-400 mt-0.5">{editRoleModal.name}</p></div>
              <button onClick={()=>setEditRoleModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div style={{border:'1px solid #ECECF2'}} className="rounded-xl overflow-hidden">
              <PermMatrix perms={editRoleModal.permissions}
                onChange={p=>setEditRoleModal(r=>r?{...r,permissions:p}:r)}/>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setEditRoleModal(null)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={()=>updateRole(editRoleModal.id,{permissions:editRoleModal.permissions})} disabled={saving}
                style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">
                {saving?'Enregistrement...':'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwdModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div style={{background:'#fff',border:'1px solid #ECECF2'}} className="rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div><h2 className="text-base font-bold text-gray-900">Réinitialiser le mot de passe</h2><p className="text-sm text-gray-400 mt-0.5">{resetPwdModal.firstName}</p></div>
              <button onClick={()=>setResetPwdModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nouveau mot de passe *</label>
              <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} autoFocus
                style={{border:'1px solid #ECECF2'}} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                onFocus={e=>(e.currentTarget.style.boxShadow='0 0 0 2px rgba(91,61,245,0.2)')} onBlur={e=>(e.currentTarget.style.boxShadow='')}/>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setResetPwdModal(null)} style={{border:'1px solid #ECECF2'}} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={()=>resetPassword(resetPwdModal.id,newPwd)} disabled={saving||newPwd.length<8}
                style={{background:'#5B3DF5'}} className="px-4 py-2.5 rounded-xl text-sm text-white font-semibold hover:opacity-90 disabled:opacity-50">
                {saving?'...':'Réinitialiser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
