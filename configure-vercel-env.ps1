# Script para configurar variáveis de ambiente no Vercel
# Execute este script manualmente no PowerShell

Write-Host "Configurando variáveis de ambiente do Firebase no Vercel..." -ForegroundColor Green

# Remover variáveis antigas (se existirem)
$vars = @(
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
    "VITE_FIREBASE_MEASUREMENT_ID"
)

foreach ($var in $vars) {
    Write-Host "Removendo $var..." -ForegroundColor Yellow
    vercel env rm $var production --yes 2>$null
}

# Adicionar variáveis novas (sem quebras de linha)
Write-Host "`nAdicionando variáveis limpas..." -ForegroundColor Green

# VITE_FIREBASE_API_KEY
Write-Host "Adicionando VITE_FIREBASE_API_KEY..." -ForegroundColor Cyan
echo "AIzaSyA2uy9DeMwXxtVkbRFQiwTZfyWltFI2dj0" | vercel env add VITE_FIREBASE_API_KEY production

# VITE_FIREBASE_AUTH_DOMAIN
Write-Host "Adicionando VITE_FIREBASE_AUTH_DOMAIN..." -ForegroundColor Cyan
echo "canvazap2026.firebaseapp.com" | vercel env add VITE_FIREBASE_AUTH_DOMAIN production

# VITE_FIREBASE_PROJECT_ID
Write-Host "Adicionando VITE_FIREBASE_PROJECT_ID..." -ForegroundColor Cyan
echo "canvazap2026" | vercel env add VITE_FIREBASE_PROJECT_ID production

# VITE_FIREBASE_STORAGE_BUCKET
Write-Host "Adicionando VITE_FIREBASE_STORAGE_BUCKET..." -ForegroundColor Cyan
echo "canvazap2026.firebasestorage.app" | vercel env add VITE_FIREBASE_STORAGE_BUCKET production

# VITE_FIREBASE_MESSAGING_SENDER_ID
Write-Host "Adicionando VITE_FIREBASE_MESSAGING_SENDER_ID..." -ForegroundColor Cyan
echo "882526801447" | vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production

# VITE_FIREBASE_APP_ID
Write-Host "Adicionando VITE_FIREBASE_APP_ID..." -ForegroundColor Cyan
echo "1:882526801447:web:f4467eef55728b53f10802" | vercel env add VITE_FIREBASE_APP_ID production

# VITE_FIREBASE_MEASUREMENT_ID
Write-Host "Adicionando VITE_FIREBASE_MEASUREMENT_ID..." -ForegroundColor Cyan
echo "G-G0BV7CC6HY" | vercel env add VITE_FIREBASE_MEASUREMENT_ID production

Write-Host "`n✅ Configuração concluída!" -ForegroundColor Green
Write-Host "Execute 'vercel --prod' para fazer o redeploy com as novas variáveis." -ForegroundColor Yellow
