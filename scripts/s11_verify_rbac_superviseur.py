import re

ctx_path = 'apps/admin/src/contexts/PermissionsContext.tsx'
with open(ctx_path, 'r') as f:
    ctx = f.read()

issues = []
if 'admin_token' not in ctx:
    issues.append("TOKEN KEY: uses 'adminToken' instead of 'admin_token'")
if "if (!p) return false" not in ctx:
    issues.append("DENY-BY-DEFAULT: can() returns true when page not configured")
if "if (permissions === undefined) return false" not in ctx:
    issues.append("LOADING GUARD missing")

if issues:
    print("Issues found in PermissionsContext.tsx:")
    for i in issues: print(f"  x {i}")
    ctx = ctx.replace("localStorage.getItem('adminToken')", "localStorage.getItem('admin_token')")
    ctx = ctx.replace("if (!p) return true;", "if (!p) return false;")
    with open(ctx_path, 'w') as f:
        f.write(ctx)
    print("  -> Auto-fixed")
else:
    print("PermissionsContext.tsx: OK")

with open(ctx_path, 'r') as f:
    ctx = f.read()
print(f"  token 'admin_token': {'OK' if 'admin_token' in ctx else 'MISSING'}")
print(f"  deny-by-default:     {'OK' if 'if (!p) return false' in ctx else 'MISSING'}")
print(f"  loading guard:       {'OK' if 'if (permissions === undefined) return false' in ctx else 'MISSING'}")

merch_path = 'apps/admin/src/pages/Merchants.tsx'
with open(merch_path, 'r') as f:
    merch = f.read()

changed = False
if 'permsLoading' not in merch:
    merch = merch.replace("const { can }", "const { can, loading: permsLoading }")
    merch = merch.replace("const { can,", "const { can, loading: permsLoading,").replace("loading: permsLoading, loading: permsLoading,", "loading: permsLoading,")
    changed = True
for action in ['approve', 'reject', 'suspend']:
    old = f"!can('merchants', '{action}')"
    new = f"permsLoading || !can('merchants', '{action}')"
    if old in merch and new not in merch:
        merch = merch.replace(old, new)
        changed = True
if changed:
    with open(merch_path, 'w') as f:
        f.write(merch)
    print("Merchants.tsx: fixed")
else:
    print("Merchants.tsx: OK")
