import re

# ── Admins.tsx ─────────────────────────────────────────────────────────────────
path = 'apps/admin/src/pages/Admins.tsx'
with open(path) as f: src = f.read()

# 1. Supprimer le bloc modal dans PermMatrix
src = re.sub(
    r'\s*\{resetPwdTarget && \(\s*<PasswordResetModal\s+endpoint=\{`[^`]+`\}\s+name=\{resetPwdTarget\.name\}\s+onClose=\{[^}]+\}\s*/>\s*\)\s*\}',
    '',
    src
)

# 2. Ajouter le modal juste avant la dernière ligne du return de la fn Admins
# On cherche le dernier </div> suivi de ); et de } (fin de la fonction)
src = re.sub(
    r'(    </div>\s*\n\s*\);\s*\n\})',
    r"""      {resetPwdTarget && (
        <PasswordResetModal
          endpoint={`/admin/admins/${resetPwdTarget.id}/reset-password`}
          name={resetPwdTarget.name}
          onClose={() => setResetPwdTarget(null)}
        />
      )}
    </div>
  );
}""",
    src
)

with open(path, 'w') as f: f.write(src)
print("Admins.tsx: modal moved to correct scope")

# ── Merchants.tsx ──────────────────────────────────────────────────────────────
path = 'apps/admin/src/pages/Merchants.tsx'
with open(path) as f: src = f.read()

# Supprimer TOUS les blocs modal resetPwdModal mal placés (dans sous-composants)
src = re.sub(
    r'\s*\{resetPwdModal && \(\s*<PasswordResetModal\s+endpoint=\{`[^`]+`\}\s+name="[^"]+"\s+onClose=\{[^}]+\}\s*/>\s*\)\s*\}',
    '',
    src
)

# Compter combien il en reste
count_remaining = src.count('resetPwdModal &&')
print(f"Merchants.tsx: {count_remaining} modal bloc(s) remaining after cleanup")

# Ajouter le modal au bon endroit (dans la fonction principale Merchants)
# Cherche le dernier return ( ... ); } de la fonction principale
src = re.sub(
    r'(    </div>\s*\n\s*\);\s*\n\}(?:\s*$))',
    r"""      {resetPwdModal && (
        <PasswordResetModal
          endpoint={`/admin/merchants/${resetPwdModal}/reset-password`}
          name="Marchand"
          onClose={() => setResetPwdModal(null)}
        />
      )}
    </div>
  );
}""",
    src
)

# Vérifier que le state est bien dans la fn principale
if 'const [resetPwdModal' not in src:
    src = re.sub(
        r'(export default function Merchants\(\)[^{]*\{)',
        r'\1\n  const [resetPwdModal, setResetPwdModal] = useState<string | null>(null);',
        src
    )
    print("Merchants.tsx: state re-injected")

with open(path, 'w') as f: f.write(src)
print("Merchants.tsx: modal fixed")

print("\nDone.")
