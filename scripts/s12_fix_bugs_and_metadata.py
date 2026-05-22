"""
Fix 1: AuditLogs.tsx  — admin null → fallback email
Fix 2: Sponsors.tsx   — refresh état local après toggle status
Fix 3: Beneficiaries.tsx — idem
Fix 4: admin.routes.ts — metadata before/after dans les logs de statut
"""
import re

# ── 1. AuditLogs.tsx : admin null fix ─────────────────────────────────────────
path = 'apps/admin/src/pages/AuditLogs.tsx'
with open(path) as f: src = f.read()

# Remplace `${log.admin.firstName} ${log.admin.lastName}` → email si null
src = src.replace(
    '`${log.admin.firstName} ${log.admin.lastName}`',
    '(log.admin.firstName ? `${log.admin.firstName} ${log.admin.lastName ?? \'\'}` : log.admin.email)'
)
# Même chose dans le modal detail
src = src.replace(
    '{log.admin.firstName} {log.admin.lastName}',
    '{log.admin.firstName ? `${log.admin.firstName} ${log.admin.lastName ?? \'\'}` : log.admin.email}'
)
# Variante JSX avec expressions séparées
src = re.sub(
    r'\{log\.admin\.firstName\}\s*\{log\.admin\.lastName\}',
    '{log.admin.firstName ? `${log.admin.firstName} ${log.admin.lastName ?? \'\'}` : log.admin.email}',
    src
)
with open(path, 'w') as f: f.write(src)
print("AuditLogs.tsx: admin null fix applied")

# ── 2. Sponsors.tsx : refresh état après toggle + metadata ────────────────────
path = 'apps/admin/src/pages/Sponsors.tsx'
with open(path) as f: src = f.read()

# Après api.patch status, mettre à jour detail + liste
old = "await api.patch(`/admin/sponsors/${detail!.id}/status`);"
new = """\
const res = await api.patch(`/admin/sponsors/${detail!.id}/status`);
      const newActive: boolean = res.data?.isActive ?? !detail!.user.isActive;
      setDetail(d => d ? { ...d, user: { ...d.user, isActive: newActive } } : null);
      setList(l => l.map(s => s.id === detail!.id ? { ...s, user: { ...s.user, isActive: newActive } } : s));"""
if old in src:
    src = src.replace(old, new)
    print("Sponsors.tsx: status state refresh patched")
else:
    # Fallback: cherche le pattern sans !
    old2 = "await api.patch(`/admin/sponsors/${detail.id}/status`);"
    new2 = """\
const res = await api.patch(`/admin/sponsors/${detail.id}/status`);
      const newActive: boolean = res.data?.isActive ?? !detail.user.isActive;
      setDetail(d => d ? { ...d, user: { ...d.user, isActive: newActive } } : null);
      setList(l => l.map(s => s.id === detail.id ? { ...s, user: { ...s.user, isActive: newActive } } : s));"""
    if old2 in src:
        src = src.replace(old2, new2)
        print("Sponsors.tsx: status state refresh patched (fallback)")
    else:
        print("WARNING: Sponsors.tsx status patch not found — adding fetchDetail call instead")
        # Cherche fetchDetail ou loadDetail après le patch
        src = re.sub(
            r'(await api\.patch\(`/admin/sponsors/[^`]+/status`\))',
            r'\1;\n      const res2 = await api.get(`/admin/sponsors/${detail!.id}`);\n      if (res2.data) setDetail(res2.data);\n      setList(l => l.map(s => s.id === detail!.id ? { ...s, user: { ...s.user, isActive: res2.data.user.isActive } } : s));',
            src
        )
        print("Sponsors.tsx: injected fetchDetail after status toggle")

with open(path, 'w') as f: f.write(src)

# ── 3. Beneficiaries.tsx : idem ───────────────────────────────────────────────
path = 'apps/admin/src/pages/Beneficiaries.tsx'
with open(path) as f: src = f.read()

old = "await api.patch(`/admin/beneficiaries/${detail!.id}/status`);"
new = """\
const res = await api.patch(`/admin/beneficiaries/${detail!.id}/status`);
      const newActive: boolean = res.data?.isActive ?? !detail!.user.isActive;
      setDetail(d => d ? { ...d, user: { ...d.user, isActive: newActive } } : null);
      setList(l => l.map(b => b.id === detail!.id ? { ...b, user: { ...b.user, isActive: newActive } } : b));"""
if old in src:
    src = src.replace(old, new)
    print("Beneficiaries.tsx: status state refresh patched")
else:
    old2 = "await api.patch(`/admin/beneficiaries/${detail.id}/status`);"
    new2 = """\
const res = await api.patch(`/admin/beneficiaries/${detail.id}/status`);
      const newActive: boolean = res.data?.isActive ?? !detail.user.isActive;
      setDetail(d => d ? { ...d, user: { ...d.user, isActive: newActive } } : null);
      setList(l => l.map(b => b.id === detail.id ? { ...b, user: { ...b.user, isActive: newActive } } : b));"""
    if old2 in src:
        src = src.replace(old2, new2)
        print("Beneficiaries.tsx: status state refresh patched (fallback)")
    else:
        src = re.sub(
            r'(await api\.patch\(`/admin/beneficiaries/[^`]+/status`\))',
            r'\1;\n      const res2 = await api.get(`/admin/beneficiaries/${detail!.id}`);\n      if (res2.data) setDetail(res2.data);\n      setList(l => l.map(b => b.id === detail!.id ? { ...b, user: { ...b.user, isActive: res2.data.user.isActive } } : b));',
            src
        )
        print("Beneficiaries.tsx: injected fetchDetail after status toggle")

with open(path, 'w') as f: f.write(src)

# ── 4. admin.routes.ts : metadata before/after dans les logs de statut ────────
routes_path = 'apps/backend/src/modules/admin/admin.routes.ts'
with open(routes_path) as f: routes = f.read()

changed = False

# Sponsor status route : ajouter metadata
old_s = """    await prisma.auditLog.create({ data: {
      action: newStatus ? 'SPONSOR_ACTIVATED' : 'SPONSOR_SUSPENDED',
      entityType: 'User', entityId: sponsor.userId,
      adminId: req.user?.userId
    }});"""
new_s = """    await prisma.auditLog.create({ data: {
      action: newStatus ? 'SPONSOR_ACTIVATED' : 'SPONSOR_SUSPENDED',
      entityType: 'Sponsor', entityId: id,
      adminId: req.user?.userId,
      metadata: {
        before:      { isActive: sponsor.user.isActive },
        after:       { isActive: newStatus },
        sponsorName: `${sponsor.user.firstName} ${sponsor.user.lastName ?? ''}`.trim(),
        phone:       sponsor.user.phone,
      }
    }});"""
if old_s in routes:
    routes = routes.replace(old_s, new_s)
    changed = True
    print("admin.routes.ts: sponsor status metadata added")
else:
    print("WARNING: sponsor auditLog pattern not found — adding metadata via regex")
    routes = re.sub(
        r"(action: newStatus \? 'SPONSOR_ACTIVATED' : 'SPONSOR_SUSPENDED',\s*entityType: 'User', entityId: sponsor\.userId,\s*adminId: req\.user\?\.userId)",
        r"action: newStatus ? 'SPONSOR_ACTIVATED' : 'SPONSOR_SUSPENDED',\n      entityType: 'Sponsor', entityId: id,\n      adminId: req.user?.userId,\n      metadata: { before: { isActive: sponsor.user.isActive }, after: { isActive: newStatus }, sponsorName: `${sponsor.user.firstName} ${sponsor.user.lastName ?? ''}`.trim(), phone: sponsor.user.phone }",
        routes
    )
    changed = True

# Beneficiary status route : ajouter metadata
old_b = """    await prisma.auditLog.create({ data: {
      action: newStatus ? 'BENEFICIARY_ACTIVATED' : 'BENEFICIARY_SUSPENDED',
      entityType: 'User', entityId: beneficiary.userId,
      adminId: req.user?.userId
    }});"""
new_b = """    await prisma.auditLog.create({ data: {
      action: newStatus ? 'BENEFICIARY_ACTIVATED' : 'BENEFICIARY_SUSPENDED',
      entityType: 'Beneficiary', entityId: id,
      adminId: req.user?.userId,
      metadata: {
        before:           { isActive: beneficiary.user.isActive },
        after:            { isActive: newStatus },
        beneficiaryName:  `${beneficiary.user.firstName} ${beneficiary.user.lastName ?? ''}`.trim(),
        phone:            beneficiary.user.phone,
      }
    }});"""
if old_b in routes:
    routes = routes.replace(old_b, new_b)
    changed = True
    print("admin.routes.ts: beneficiary status metadata added")

if changed:
    with open(routes_path, 'w') as f: f.write(routes)

print("\nAll fixes done.")
