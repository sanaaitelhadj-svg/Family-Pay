#!/usr/bin/env bash
# ============================================================
# ALTIVAX FamilyPay — Script de sauvegarde
# Usage : bash scripts/backup.sh [sprint-label]
# Exemple : bash scripts/backup.sh sprint-0a
# ============================================================
set -euo pipefail

LABEL=${1:-"manual"}
DATE=$(date +%Y%m%d-%H%M%S)
TAG="familypay-${LABEL}-${DATE}"
BACKUP_DIR="./backups"

echo "🔒 FamilyPay Backup — Démarrage"
echo "   Label : ${LABEL}"
echo "   Tag   : ${TAG}"
echo "   Date  : ${DATE}"
echo ""

# ── 1. SAUVEGARDE GIT ────────────────────────────────────────────────────────
echo "📦 1/3 — Sauvegarde Git..."
git add -A
git commit -m "chore: sauvegarde avant ${LABEL}" --allow-empty
git tag "${TAG}"
echo "   ✅ Tag créé : ${TAG}"

# ── 2. SAUVEGARDE POSTGRESQL ─────────────────────────────────────────────────
echo ""
echo "🗄️  2/3 — Sauvegarde PostgreSQL..."

mkdir -p "${BACKUP_DIR}"

# Charger les variables d'environnement
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

DUMP_FILE="${BACKUP_DIR}/familypay_${DATE}.dump"

if command -v pg_dump &> /dev/null; then
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${POSTGRES_HOST:-localhost}" \
    -p "${POSTGRES_PORT:-5432}" \
    -U "${POSTGRES_USER:-familypay}" \
    -d "${POSTGRES_DB:-familypay}" \
    -Fc \
    -f "${DUMP_FILE}"
  echo "   ✅ Dump créé : ${DUMP_FILE}"
  echo "   📊 Taille : $(du -sh ${DUMP_FILE} | cut -f1)"
elif docker compose ps postgres &> /dev/null 2>&1; then
  # Fallback via Docker si pg_dump pas installé localement
  docker compose exec -T postgres pg_dump \
    -U "${POSTGRES_USER:-familypay}" \
    -d "${POSTGRES_DB:-familypay}" \
    -Fc > "${DUMP_FILE}"
  echo "   ✅ Dump créé via Docker : ${DUMP_FILE}"
else
  echo "   ⚠️  pg_dump non disponible — sauvegarde DB ignorée"
  echo "   → Installe PostgreSQL client ou lance Docker Compose"
fi

# ── 3. RAPPORT FINAL ─────────────────────────────────────────────────────────
echo ""
echo "📋 3/3 — Rapport de sauvegarde..."
echo ""
echo "┌─────────────────────────────────────────────────────────┐"
echo "│  ✅ Sauvegarde FamilyPay terminée avec succès           │"
echo "├─────────────────────────────────────────────────────────┤"
echo "│  Git tag  : ${TAG}"
echo "│  DB dump  : ${DUMP_FILE:-N/A}"
echo "│  Date     : ${DATE}"
echo "└─────────────────────────────────────────────────────────┘"
echo ""
echo "Pour restaurer la DB :"
echo "  pg_restore -h localhost -U familypay -d familypay ${DUMP_FILE:-<fichier.dump>}"
