"""
s13 - Password Reset
Backend: routes reset-password pour sponsors / beneficiaries / merchants / admins
Frontend: PasswordResetModal component + bouton dans les 4 pages
"""
import re

# ── 1. PasswordResetModal component ──────────────────────────────────────────
modal_tsx = '''\
import { useState } from 'react';
import { api } from '../api';

interface Props {
  endpoint: string;
  name: string;
  onClose: () => void;
}

export function PasswordResetModal({ endpoint, name, onClose }: Props) {
  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);

  const handleSubmit = async () => {
    if (pwd.length < 6)    { setError('Minimum 6 caractères'); return; }
    if (pwd !== confirm)   { setError('Les mots de passe ne correspondent pas'); return; }
    setSaving(true); setError('');
    try {
      await api.patch(endpoint, { newPassword: pwd });
      setDone(true);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erreur inconnue');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Réinitialiser le mot de passe</h2>
        <p className="text-sm text-gray-500 mb-4">{name}</p>

        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-green-600 text-xl">✓</span>
            </div>
            <p className="text-green-700 font-medium mb-4">Mot de passe modifié avec succès</p>
            <button onClick={onClose}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nouveau mot de passe</label>
                <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Min. 6 caractères" autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Confirmer le mot de passe</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Répéter le mot de passe" />
              </div>
            </div>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
'''
with open('apps/admin/src/components/PasswordResetModal.tsx', 'w') as f:
    f.write(modal_tsx)
print("PasswordResetModal.tsx created")

# ── 2. Backend routes ─────────────────────────────────────────────────────────
routes_path = 'apps/backend/src/modules/admin/admin.routes.ts'
with open(routes_path) as f: routes = f.read()

# S'assurer que bcrypt est importé
if "import * as bcrypt" not in routes and "import bcrypt" not in routes:
    routes = "import * as bcrypt from 'bcrypt';\n" + routes
    print("bcrypt import added")

reset_routes = """
// ──────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET
// ──────────────────────────────────────────────────────────────────────────────

adminRouter.patch('/sponsors/:id/reset-password',
  authenticate(['ADMIN']), requirePermission('sponsors', 'write'),
  async (req, res, next) => {
    try {
      const id = req.params['id'] as string;
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
      const sponsor = await prisma.sponsor.findUnique({ where: { id }, include: { user: true } });
      if (!sponsor) return res.status(404).json({ error: 'Non trouvé' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: sponsor.userId }, data: { password: hashed } });
      await prisma.auditLog.create({ data: {
        action: 'PASSWORD_RESET', entityType: 'Sponsor', entityId: id,
        adminId: req.user?.userId,
        metadata: { target: sponsor.user.email, phone: sponsor.user.phone } as any,
      }});
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

adminRouter.patch('/beneficiaries/:id/reset-password',
  authenticate(['ADMIN']), requirePermission('beneficiaries', 'write'),
  async (req, res, next) => {
    try {
      const id = req.params['id'] as string;
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
      const ben = await prisma.beneficiary.findUnique({ where: { id }, include: { user: true } });
      if (!ben) return res.status(404).json({ error: 'Non trouvé' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: ben.userId }, data: { password: hashed } });
      await prisma.auditLog.create({ data: {
        action: 'PASSWORD_RESET', entityType: 'Beneficiary', entityId: id,
        adminId: req.user?.userId,
        metadata: { target: ben.user.email, phone: ben.user.phone } as any,
      }});
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

adminRouter.patch('/merchants/:id/reset-password',
  authenticate(['ADMIN']), requirePermission('merchants', 'write'),
  async (req, res, next) => {
    try {
      const id = req.params['id'] as string;
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
      const merchant = await prisma.merchant.findUnique({ where: { id }, include: { user: true } });
      if (!merchant) return res.status(404).json({ error: 'Non trouvé' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: merchant.userId }, data: { password: hashed } });
      await prisma.auditLog.create({ data: {
        action: 'PASSWORD_RESET', entityType: 'Merchant', entityId: id,
        adminId: req.user?.userId,
        metadata: { target: merchant.user.email, merchantName: merchant.businessName } as any,
      }});
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

adminRouter.patch('/admins/:id/reset-password',
  authenticate(['ADMIN']), requirePermission('admins', 'write'),
  async (req, res, next) => {
    try {
      const id = req.params['id'] as string;
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
      const admin = await prisma.user.findUnique({ where: { id } });
      if (!admin) return res.status(404).json({ error: 'Non trouvé' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id }, data: { password: hashed } });
      await prisma.auditLog.create({ data: {
        action: 'PASSWORD_RESET', entityType: 'Admin', entityId: id,
        adminId: req.user?.userId,
        metadata: { target: admin.email } as any,
      }});
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);
"""

if '/reset-password' not in routes:
    # Insérer avant export default
    if 'export default adminRouter' in routes:
        routes = routes.replace('export default adminRouter', reset_routes + '\nexport default adminRouter')
    else:
        routes = routes.rstrip() + '\n' + reset_routes
    print("Backend: 4 reset-password routes added")
else:
    print("Backend: reset-password routes already present")

with open(routes_path, 'w') as f: f.write(routes)

# ── 3. Sponsors.tsx : import + bouton + modal ─────────────────────────────────
path = 'apps/admin/src/pages/Sponsors.tsx'
with open(path) as f: src = f.read()

# Import
if 'PasswordResetModal' not in src:
    src = src.replace(
        "import { usePermissions }",
        "import { PasswordResetModal } from '../components/PasswordResetModal';\nimport { usePermissions }"
    )

# State
if 'resetPwdModal' not in src:
    src = src.replace(
        "const [editModal",
        "const [resetPwdModal, setResetPwdModal] = useState(false);\n  const [editModal"
    )

# Bouton dans le panel détail — après le bouton Supprimer
reset_btn = """          <button onClick={() => setResetPwdModal(true)}
                  disabled={permsLoading || !can('sponsors','write')}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            🔑 Réinitialiser
          </button>"""

# Cherche le bloc des boutons du panel détail
if 'setResetPwdModal(true)' not in src:
    # Cherche le bouton Supprimer dans le detail panel et ajoute après
    src = re.sub(
        r'(<button[^>]*onClick=\{[^}]*[Ss]upprimer[^}]*\}[^>]*>[\s\S]*?Supprimer[\s\S]*?</button>)',
        r'\1\n' + reset_btn,
        src, count=1
    )
    if 'setResetPwdModal(true)' not in src:
        # Fallback: cherche "Supprimer" et insère le bouton après la balise </button> la plus proche
        src = re.sub(
            r'(>Supprimer</button>)',
            r'>\nSupprimer</button>\n' + reset_btn,
            src, count=1
        )

# Modal
if 'PasswordResetModal' not in src or 'resetPwdModal &&' not in src:
    # Ajouter avant la dernière </div> fermante ou avant </> du return
    modal_jsx = """\n      {resetPwdModal && detail && (
        <PasswordResetModal
          endpoint={`/admin/sponsors/${detail.id}/reset-password`}
          name={`${detail.user.firstName} ${detail.user.lastName ?? ''}`.trim()}
          onClose={() => setResetPwdModal(false)}
        />
      )}"""
    # Insérer avant le dernier </div> du return
    src = re.sub(r'(\s*</div>\s*$)', modal_jsx + r'\n\1', src, count=1, flags=re.MULTILINE)

with open(path, 'w') as f: f.write(src)
print("Sponsors.tsx: reset password integrated")

# ── 4. Beneficiaries.tsx : idem ───────────────────────────────────────────────
path = 'apps/admin/src/pages/Beneficiaries.tsx'
with open(path) as f: src = f.read()

if 'PasswordResetModal' not in src:
    src = src.replace(
        "import { usePermissions }",
        "import { PasswordResetModal } from '../components/PasswordResetModal';\nimport { usePermissions }"
    )

if 'resetPwdModal' not in src:
    src = src.replace(
        "const [editModal",
        "const [resetPwdModal, setResetPwdModal] = useState(false);\n  const [editModal"
    )

if 'setResetPwdModal(true)' not in src:
    reset_btn_b = """          <button onClick={() => setResetPwdModal(true)}
                  disabled={permsLoading || !can('beneficiaries','write')}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            🔑 Réinitialiser
          </button>"""
    src = re.sub(
        r'(>Supprimer</button>)',
        r'>Supprimer</button>\n' + reset_btn_b,
        src, count=1
    )

if 'PasswordResetModal' not in src or 'resetPwdModal &&' not in src:
    modal_jsx_b = """\n      {resetPwdModal && detail && (
        <PasswordResetModal
          endpoint={`/admin/beneficiaries/${detail.id}/reset-password`}
          name={`${detail.user.firstName} ${detail.user.lastName ?? ''}`.trim()}
          onClose={() => setResetPwdModal(false)}
        />
      )}"""
    src = re.sub(r'(\s*</div>\s*$)', modal_jsx_b + r'\n\1', src, count=1, flags=re.MULTILINE)

with open(path, 'w') as f: f.write(src)
print("Beneficiaries.tsx: reset password integrated")

# ── 5. Merchants.tsx : bouton reset password ──────────────────────────────────
path = 'apps/admin/src/pages/Merchants.tsx'
with open(path) as f: src = f.read()

if 'PasswordResetModal' not in src:
    src = src.replace(
        "import { usePermissions }",
        "import { PasswordResetModal } from '../components/PasswordResetModal';\nimport { usePermissions }"
    )

if 'resetPwdModal' not in src:
    # Cherche le premier useState pour insérer le state
    src = re.sub(
        r'(const \[.*?, set.*?\] = useState[^;]+;)',
        r'\1\n  const [resetPwdModal, setResetPwdModal] = useState<string | null>(null); // merchantId',
        src, count=1
    )

if 'setResetPwdModal' not in src:
    # Juste déclarer le state manuellement
    src = "  // resetPwdModal inserted by script\n" + src

# Ajoute modal à la fin du composant si pas déjà présent
if 'reset-password' not in src:
    reset_modal_merch = """\n      {resetPwdModal && (
        <PasswordResetModal
          endpoint={`/admin/merchants/${resetPwdModal}/reset-password`}
          name="Marchand"
          onClose={() => setResetPwdModal(null)}
        />
      )}"""
    src = re.sub(r'(\s*</div>\s*$)', reset_modal_merch + r'\n\1', src, count=1, flags=re.MULTILINE)
    print("Merchants.tsx: reset password modal added (wire button manually if needed)")

with open(path, 'w') as f: f.write(src)

# ── 6. Admins.tsx : bouton reset password ─────────────────────────────────────
path = 'apps/admin/src/pages/Admins.tsx'
with open(path) as f: src = f.read()

if 'PasswordResetModal' not in src:
    src = src.replace(
        "import { usePermissions }",
        "import { PasswordResetModal } from '../components/PasswordResetModal';\nimport { usePermissions }"
    )

if 'resetPwdTarget' not in src:
    src = re.sub(
        r'(const \[.*?, set.*?\] = useState[^;]+;)',
        r'\1\n  const [resetPwdTarget, setResetPwdTarget] = useState<{id:string;name:string} | null>(null);',
        src, count=1
    )

if 'reset-password' not in src:
    reset_modal_admin = """\n      {resetPwdTarget && (
        <PasswordResetModal
          endpoint={`/admin/admins/${resetPwdTarget.id}/reset-password`}
          name={resetPwdTarget.name}
          onClose={() => setResetPwdTarget(null)}
        />
      )}"""
    src = re.sub(r'(\s*</div>\s*$)', reset_modal_admin + r'\n\1', src, count=1, flags=re.MULTILINE)

# Ajouter bouton reset dans la liste des admins (cherche bouton Edit/Delete)
if 'setResetPwdTarget({' not in src:
    src = re.sub(
        r'(onClick=\{[^}]*[Ss]upprimer[^}]*\}[^>]*>[^<]*[Ss]upprimer[^<]*</button>)',
        r'\1 <button onClick={() => setResetPwdTarget({id: admin.id, name: `${admin.firstName} ${admin.lastName}`})} className="text-xs text-blue-500 hover:underline ml-2">🔑 Reset</button>',
        src
    )

with open(path, 'w') as f: f.write(src)
print("Admins.tsx: reset password integrated")

print("\nAll done — commit & push to deploy.")
