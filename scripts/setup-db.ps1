# ============================================================
# FamilyPay — Setup base de données (post-installation PostgreSQL)
# Lancer depuis un terminal ordinaire (pas admin requis)
# Usage : .\scripts\setup-db.ps1
# ============================================================

param(
    [string]$PgPassword = "postgres",
    [string]$DbName     = "familypay",
    [string]$PgPort     = "5432"
)

$env:PGPASSWORD = $PgPassword
$psql = $null

# Trouver psql
$pgPaths = @(
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe"
)
foreach ($p in $pgPaths) {
    if (Test-Path $p) { $psql = $p; break }
}
if (-not $psql) {
    $psql = (Get-Command psql -ErrorAction SilentlyContinue)?.Source
}
if (-not $psql) {
    Write-Error "psql introuvable. Installez PostgreSQL d'abord."
    exit 1
}
Write-Host "✅ psql trouvé : $psql"

# Vérifier la connexion
$test = & $psql -U postgres -p $PgPort -c "SELECT 1" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Impossible de se connecter à PostgreSQL. Vérifiez que le service est démarré et que le mot de passe est 'postgres'."
    Write-Host "Détail : $test"
    exit 1
}
Write-Host "✅ Connexion PostgreSQL OK"

# Créer la base de données
Write-Host "📦 Création de la base '$DbName'..."
& $psql -U postgres -p $PgPort -c "CREATE DATABASE $DbName;" 2>&1 | Out-Null
Write-Host "✅ Base '$DbName' prête (ou déjà existante)"

# Ajouter le PATH PostgreSQL pour Prisma
$pgBin = Split-Path $psql -Parent
if ($env:PATH -notlike "*$pgBin*") {
    $env:PATH = "$pgBin;$env:PATH"
    Write-Host "✅ $pgBin ajouté au PATH"
}

Write-Host ""
Write-Host "🚀 Lancement des migrations Prisma..."
Set-Location C:\Projects\FamilyPay\apps\backend
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Error "Migrations échouées"
    exit 1
}
Write-Host "✅ Migrations OK"

Write-Host ""
Write-Host "🌱 Seed des données de démo..."
npx tsx prisma/seed.ts
Write-Host "✅ Seed OK"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  Base de données FamilyPay prête !"
Write-Host "  Comptes de test :"
Write-Host "    papa@demo.familypay  / Demo1234!"
Write-Host "    adam@demo.familypay  / Demo1234!"
Write-Host "    mcdo-casa@demo.familypay / Demo1234!"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "Prochaine étape : lancer les tests critiques"
Write-Host "  cd C:\Projects\FamilyPay\apps\backend"
Write-Host "  npx vitest run src/tests/critical.rls.test.ts"
