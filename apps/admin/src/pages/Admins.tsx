import { useEffect, useState } from 'react';
import { api } from '../api';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, { read: boolean; write: boolean; actions: string[] }>;
  isActive: boolean;
}

interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  adminRole?: { id: string; name: string } | null;
}

const PAGES = ['dashboard','merchants','subscriptions','sponsors','beneficiaries','admins'];
const ACTIONS = ['approve','add','reject','delete','suspend'];

function PermMatrix({
  perms, onChange,
}: {
  perms: Record<string, { read: boolean; write: boolean; actions: string[] }>;
  onChange: (p: typeof perms) => void;
}) {
  const toggle = (page: string, field: 'read' | 'write') => {
    const cur = perms[page] ?? { read: false, write: false, actions: [] };
    onChange({ ...perms, [page]: { ...cur, [field]: !cur[field] } });
  };
  const toggleAction = (page: string, action: string) => {
    const cur = perms[page] ?? { read: false, write: false, actions: [] };
    const actions = cur.actions.includes(action)
      ? cur.actions.filter((a) => a !== action)
      : [...cur.actions, action];
    onChange({ ...perms, [page]: { ...cur, actions } });
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2 border border-gray-200">Page</th>
            <th className="p-2 border border-gray-200">Lecture</th>
            <th className="p-2 border border-gray-200">Ecriture</th>
            {ACTIONS.map((a) => (
              <th key={a} className="p-2 border border-gray-200 capitalize">{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PAGES.map((page) => {
            const cur = perms[page] ?? { read: false, write: false, actions: [] };
            return (
              <tr key={page} className="hover:bg-gray-50">
                <td className="p-2 border border-gray-200 font-medium capitalize">{page}</td>
                <td className="p-2 border border-gray-200 text-center">
                  <input type="checkbox" checked={cur.read} onChange={() => toggle(page, 'read')} />
                </td>
                <td className="p-2 border border-gray-200 text-center">
                  <input type="checkbox" checked={cur.write} onChange={() => toggle(page, 'write')} />
                </td>
                {ACTIONS.map((action) => (
                  <td key={action} className="p-2 border border-gray-200 text-center">
                    <input
                      type="checkbox"
                      checked={cur.actions.includes(action)}
                      onChange={() => toggleAction(page, action)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Admins() {
  const [tab, setTab] = useState<'admins' | 'roles'>('admins');
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '', roleId: '' });
  const [saving, setSaving] = useState(false);
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', email: '', roleId: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<{ name: string; description: string; permissions: Record<string, { read: boolean; write: boolean; actions: string[] }> }>({
    name: '', description: '', permissions: {},
  });
  const [savingRole, setSavingRole] = useState(false);

  const load = async () => {
    const [a, r] = await Promise.all([
      api.get('/admin/admins').then((d: any) => d.data).catch(() => []),
      api.get('/admin/roles').then((d: any) => d.data).catch(() => []),
    ]);
    setAdmins(a);
    setRoles(r);
  };

  useEffect(() => { load(); }, []);

  const createAdmin = async () => {
    if (!form.firstName || !form.email || !form.password) return;
    setSaving(true);
    try {
      await api.post('/admin/admins', {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        password: form.password,
        ...(form.roleId ? { roleId: form.roleId } : {}),
      });
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', phone: '', email: '', password: '', roleId: '' });
      load();
    } finally { setSaving(false); }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await api.patch(`/admin/admins/${id}/status`, { isActive: !current });
    load();
  };

  const assignRole = async (adminId: string, roleId: string) => {
    await api.patch(`/admin/admins/${adminId}/role`, { roleId: roleId || null });
    load();
  };

  const openEditAdmin = (a: Admin) => {
    setEditAdmin(a);
    setEditForm({
      firstName: a.firstName,
      lastName: a.lastName,
      phone: a.phone,
      email: a.email,
      roleId: a.adminRole?.id ?? '',
    });
  };

  const saveEditAdmin = async () => {
    if (!editAdmin) return;
    setSavingEdit(true);
    try {
      await api.patch(`/admin/admins/${editAdmin.id}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        email: editForm.email,
        roleId: editForm.roleId || null,
      });
      setEditAdmin(null);
      load();
    } finally { setSavingEdit(false); }
  };

  const deleteAdmin = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'admin ${name} ? Cette action est irréversible.`)) return;
    await api.delete(`/admin/admins/${id}`);
    load();
  };

  const openCreateRole = () => {
    setEditRole(null);
    setRoleForm({ name: '', description: '', permissions: {} });
    setShowCreateRole(true);
  };

  const openEditRole = (r: Role) => {
    setEditRole(r);
    setRoleForm({ name: r.name, description: r.description ?? '', permissions: r.permissions });
    setShowCreateRole(true);
  };

  const saveRole = async () => {
    if (!roleForm.name) return;
    setSavingRole(true);
    try {
      if (editRole) {
        await api.patch(`/admin/roles/${editRole.id}`, roleForm);
      } else {
        await api.post('/admin/roles', roleForm);
      }
      setShowCreateRole(false);
      load();
    } finally { setSavingRole(false); }
  };

  const deactivateRole = async (id: string) => {
    if (!confirm('Desactiver ce role ?')) return;
    await api.delete(`/admin/roles/${id}`);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {tab === 'admins' ? `Administrateurs (${admins.length})` : `Roles (${roles.length})`}
        </h1>
        <button
          onClick={tab === 'admins' ? () => setShowCreate(true) : openCreateRole}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600"
        >
          {tab === 'admins' ? '+ Nouvel admin' : '+ Nouveau role'}
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['admins', 'roles'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'admins' ? 'Administrateurs' : 'Roles & Permissions'}
          </button>
        ))}
      </div>

      {tab === 'admins' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Nom</th>
                <th className="text-left p-4 font-medium text-gray-600">Email</th>
                <th className="text-left p-4 font-medium text-gray-600">Telephone</th>
                <th className="text-left p-4 font-medium text-gray-600">Role</th>
                <th className="text-left p-4 font-medium text-gray-600">Statut</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Aucun administrateur</td></tr>
              )}
              {admins.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">{a.firstName} {a.lastName}</td>
                  <td className="p-4 text-gray-600">{a.email}</td>
                  <td className="p-4 text-gray-600">{a.phone}</td>
                  <td className="p-4">
                    <select
                      value={a.adminRole?.id ?? ''}
                      onChange={(e) => assignRole(a.id, e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-sm"
                    >
                      <option value="">- Aucun role -</option>
                      {roles.filter((r) => r.isActive).map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      a.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {a.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2">
                    <button
                      onClick={() => openEditAdmin(a)}
                      className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                    >
                      Editer
                    </button>
                    <button
                      onClick={() => toggleStatus(a.id, a.isActive)}
                      className={`text-sm px-2 py-1 rounded ${a.isActive ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                    >
                      {a.isActive ? 'Suspendre' : 'Activer'}
                    </button>
                    <button
                      onClick={() => deleteAdmin(a.id, a.firstName)}
                      className="text-sm bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-4">
          {roles.length === 0 && (
            <p className="text-gray-400 text-center py-8">Aucun role cree</p>
          )}
          {roles.map((r) => (
            <div key={r.id} className={`bg-white rounded-xl border p-4 ${!r.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.name}</h3>
                  {r.description && <p className="text-sm text-gray-500">{r.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditRole(r)} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded hover:bg-blue-100">
                    Editer
                  </button>
                  {r.isActive && (
                    <button onClick={() => deactivateRole(r.id)} className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded hover:bg-red-100">
                      Desactiver
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {PAGES.map((page) => {
                  const p = r.permissions[page];
                  if (!p) return null;
                  return (
                    <span key={page} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                      {page}: {p.read ? 'R' : ''}{p.write ? 'W' : ''}{p.actions?.length ? ` +${p.actions.join(',')}` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h2 className="text-lg font-bold">Nouvel administrateur</h2>
            {[
              { label: 'Prenom *', key: 'firstName', type: 'text' },
              { label: 'Nom', key: 'lastName', type: 'text' },
              { label: 'Telephone', key: 'phone', type: 'text' },
              { label: 'Email *', key: 'email', type: 'email' },
              { label: 'Mot de passe *', key: 'password', type: 'password' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">- Aucun role -</option>
                {roles.filter((r) => r.isActive).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={createAdmin} disabled={saving} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                {saving ? 'Creation...' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h2 className="text-lg font-bold">Modifier l'administrateur</h2>
            {[
              { label: 'Prenom', key: 'firstName', type: 'text' },
              { label: 'Nom', key: 'lastName', type: 'text' },
              { label: 'Telephone', key: 'phone', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={(editForm as any)[key]}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={editForm.roleId}
                onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">- Aucun role -</option>
                {roles.filter((r) => r.isActive).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditAdmin(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={saveEditAdmin} disabled={savingEdit} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateRole && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{editRole ? 'Modifier le role' : 'Nouveau role'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Permissions par page</label>
              <PermMatrix perms={roleForm.permissions} onChange={(p) => setRoleForm({ ...roleForm, permissions: p })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreateRole(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={saveRole} disabled={savingRole} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                {savingRole ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
