# Script para adicionar vÃ¡riáveis de ambiente restantes no Vercel
$envVars = @{
    "VITE_OPENAI_API_KEY"       = "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"
    "VITE_R2_ACCESS_KEY_ID"     = "9aff73ed155f6ad4c2d484963f56f4fc"
    "VITE_R2_SECRET_ACCESS_KEY" = "122eba6f89fcd4fa3c90b5f703d591b9aa9fd4803545321fb4418812ef2e98dc"
    "VITE_R2_ENDPOINT"          = "https://41280e273f8652c8792aff53c3fe09d4.r2.cloudflarestorage.com"
    "VITE_R2_BUCKET_NAME"       = "canvazap-anexos"
    "VITE_R2_PUBLIC_URL"        = "https://pub-919a684aa22a496da2d8ed41048dc3ed.r2.dev"
    "VITE_ELEVENLABS_API_KEY"   = "15b525d73f465a583760b30968b5786d6b078b268bb2fee992696d1308c2c125"
    "VITE_GEMINI_API_KEY"       = "AIzaSyCQweRtrk_IlS9uRnB76SFFUgZBP1NThHI"
}

foreach ($key in $envVars.Keys) {
    Write-Host "Adicionando $key..." -ForegroundColor Cyan
    echo $envVars[$key] | vercel env add $key production
}
