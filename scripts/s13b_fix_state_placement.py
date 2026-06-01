import re

# ── Admins.tsx ─────────────────────────────────────────────────────────────────
path = 'apps/admin/src/pages/Admins.tsx'
with open(path) as f: src = f.read()

# 1. Supprimer le modal mal placé (avant export default)
src = re.sub(
    r'\s*\{resetPwdTarget && \(\s*<PasswordResetModal[\s\S]*?/>\s*\)\s*\}(?=\s*\n\s*export default)',
    '',
    src
)

# 2. Supprimer l'ancien état mal injecté si présent
src = re.sub(
    r'\s*const \[resetPwdTarget, setResetPwdTarget\][^\n]+\n',
    '\n',
    src
)

# 3. Trouver export default function Admins et injecter le state + modal correctement
# Injecter le state juste après le premier { de la fonction principale
src = re.sub(
    r'(export default function Admins\(\)[^{]*\{)',
    r'\1\n  const [resetPwdTarget, setResetPwdTarget] = React.useState<{id:string;name:string} | null>(null);',
    src
)

# S'assurer que React est importé (pour React.useState)
if 'import React' not in src and "from 'react'" in src:
    src = re.sub(
        r"(import \{[^}]+\} from 'react')",
        r"import React, { useState, useEffect, useCallback } from 'react'",
        src, count=1
    )
    # Remplacer React.useState par useState
    src = src.replace(
        'React.useState<{id:string;name:string} | null>(null)',
        'useState<{id:string;name:string} | null>(null)'
    )
elif 'import React' not in src:
    src = "import React from 'react';\n" + src

# 4. Injecter le modal juste avant la dernière } de la fonction Admins
# Chercher le return principal et ajouter le modal avant la fermeture
src = re.sub(
    r'(return \([\s\S]*?</div>\s*\)\s*;\s*\}\s*$)',
    lambda m: m.group(0).replace(
        m.group(0)[-50:],
        '\n      {resetPwdTarget && (\n        <PasswordResetModal\n          endpoint={`/admin/admins/${resetPwdTarget.id}/reset-password`}\n          name={resetPwdTarget.name}\n          onClose={() => setResetPwdTarget(null)}\n        />\n      )}\n' + m.group(0)[-50:]
    ),
    src
)

with open(path, 'w') as f: f.write(src)
print("Admins.tsx: fixed")

# ── Merchants.tsx ──────────────────────────────────────────────────────────────
path = 'apps/admin/src/pages/Merchants.tsx'
with open(path) as f: src = f.read()

# 1. Supprimer le modal mal placé (dans sous-composant)
src = re.sub(
    r'\s*\{resetPwdModal && \(\s*<PasswordResetModal[\s\S]*?/>\s*\)\s*\}',
    '',
    src
)

# 2. Supprimer l'ancien état mal injecté
src = re.sub(
    r'\s*const \[resetPwdModal, setResetPwdModal\][^\n]+\n',
    '\n',
    src
)

# 3. Injecter le state dans export default function Merchants
src = re.sub(
    r'(export default function Merchants\(\)[^{]*\{)',
    r'\1\n  const [resetPwdModal, setResetPwdModal] = useState<string | null>(null);',
    src
)

# 4. Ajouter le modal dans le return principal de Merchants
# On cherche le dernier </div> avant le ); final du return
pattern = r'(  return \([\s\S]*?)(  \);\n\}?\s*$)'
def inject_modal(m):
    body = m.group(1)
    closing = m.group(2)
    modal = """\n      {resetPwdModal && (
        <PasswordResetModal
          endpoint={`/admin/merchants/${resetPwdModal}/reset-password`}
          name="Marchand"
          onClose={() => setResetPwdModal(null)}
        />
      )}\n"""
    # Insérer juste avant le dernier </div> du body
    last_div = body.rfind('</div>')
    if last_div > -1:
        body = body[:last_div] + modal + body[last_div:]
    return body + closing

src = re.sub(pattern, inject_modal, src, flags=re.MULTILINE)

with open(path, 'w') as f: f.write(src)
print("Merchants.tsx: fixed")

print("\nDone — commit & push")
