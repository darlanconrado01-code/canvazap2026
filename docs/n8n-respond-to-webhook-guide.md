# Configuração N8N com "Respond to Webhook"

## 🔄 Fluxo Completo

```
1. CanvaZap → Envia webhook com lista de registros
2. N8N → Processa TODOS os disparos
3. N8N → Responde ao webhook inicial com resultados
4. CanvaZap → Atualiza registros com base na resposta
```

---

## 📥 Payload Recebido pelo N8N

```json
{
  "campaignId": "camp_abc123",
  "tipo": "vaccine",
  "campaign_name": "Campanha 09-02-2026",
  "total": 3,
  "records": [
    {
      "recordId": "rec_001",
      "data_convertida": "08/02/2026",
      "cliente": "Gleydson Moreira",
      "telefone_e164": "+5591981128051",
      "animal": "Luiz",
      "produto": "Vanguard (V10)"
    },
    {
      "recordId": "rec_002",
      "data_convertida": "08/02/2026",
      "cliente": "João Silva",
      "telefone_e164": "+5591999999999",
      "animal": "Rex",
      "produto": "Vanguard (V10)"
    }
  ],
  "companyId": "company_petville",
  "callbackUrl": "https://ecossistemad3.com.br/api/petville-webhook-callback",
  "generated_at": "2026-02-09T16:00:00.000Z"
}
```

---

## 📤 Resposta do N8N (Respond to Webhook)

### ✅ Estrutura da Resposta:

```json
{
  "success": true,
  "message": "Disparos processados com sucesso",
  "results": [
    {
      "recordId": "rec_001",
      "status": "success",
      "telefone_e164": "+5591981128051",
      "messageId": "wamid.HBgNNTU5MTk4MTI4MDUxFQIAERgSQzg5RjE2QzQwRjBBNzY4NTYAA==",
      "sentAt": "2026-02-09T16:30:00Z"
    },
    {
      "recordId": "rec_002",
      "status": "failed",
      "telefone_e164": "+5591999999999",
      "error": "Número não está no WhatsApp",
      "errorCode": "INVALID_WHATSAPP_NUMBER"
    }
  ],
  "stats": {
    "total": 2,
    "success": 1,
    "failed": 1
  }
}
```

### 📋 Campos Obrigatórios:

**Para cada item em `results`:**

**Sucesso:**
- `recordId` (string): ID do registro (vem do payload inicial)
- `status` (string): `"success"`
- `telefone_e164` (string): Número processado
- `messageId` (string): ID da mensagem do WhatsApp
- `sentAt` (string): Data/hora ISO 8601

**Falha:**
- `recordId` (string): ID do registro (vem do payload inicial)
- `status` (string): `"failed"`
- `telefone_e164` (string): Número processado
- `error` (string): Mensagem de erro
- `errorCode` (string): Código do erro

---

## 🛠️ Configuração no N8N

### 1. Nó "Webhook" (Trigger)
- **Webhook URLs**: Production
- **HTTP Method**: POST
- **Response Mode**: Using 'Respond to Webhook' Node

### 2. Nó "Loop Over Items" (Split In Batches)
- **Batch Size**: 1
- **Options**: Keep Input Data

### 3. Nó "WhatsApp API" (HTTP Request)
- **Method**: POST
- **URL**: Sua API do WhatsApp
- **Body**: Dados da mensagem

### 4. Nó "Function - Success" (Code)
```javascript
// Processa resultado de sucesso
const record = $item(0).$node["Loop Over Items"].json;
const whatsappResponse = $json;

return {
  json: {
    recordId: record.recordId,
    status: "success",
    telefone_e164: record.telefone_e164,
    messageId: whatsappResponse.messages[0].id,
    sentAt: new Date().toISOString()
  }
};
```

### 5. Nó "Function - Failed" (Code)
```javascript
// Processa resultado de falha
const record = $item(0).$node["Loop Over Items"].json;
const error = $json.error || {};

return {
  json: {
    recordId: record.recordId,
    status: "failed",
    telefone_e164: record.telefone_e164,
    error: error.message || "Erro ao enviar mensagem",
    errorCode: error.code || "UNKNOWN_ERROR"
  }
};
```

### 6. Nó "Aggregate" (Aggregate)
- **Aggregate**: All Items
- **Include**: All Fields

### 7. Nó "Function - Build Response" (Code)
```javascript
// Constrói resposta final
const results = $input.all().map(item => item.json);
const successCount = results.filter(r => r.status === 'success').length;
const failedCount = results.filter(r => r.status === 'failed').length;

return {
  json: {
    success: true,
    message: "Disparos processados com sucesso",
    results: results,
    stats: {
      total: results.length,
      success: successCount,
      failed: failedCount
    }
  }
};
```

### 8. Nó "Respond to Webhook"
- **Respond With**: JSON
- **Response Body**: `{{ $json }}`

---

## 🎯 Diagrama do Fluxo N8N

```
┌──────────────┐
│   Webhook    │ (Recebe do CanvaZap)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Loop Over    │ (Para cada registro)
│   Items      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ WhatsApp API │ (Tenta enviar)
└──────┬───────┘
       │
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
   [Sucesso]     [Falha]      [Timeout]
       │             │             │
       ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Function    │ │  Function    │ │  Function    │
│  Success     │ │  Failed      │ │  Timeout     │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │             │             │
       └─────────────┴─────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  Aggregate   │ (Junta todos)
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  Function    │ (Monta resposta)
              │Build Response│
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │  Respond to  │ (Responde ao CanvaZap)
              │   Webhook    │
              └──────────────┘
```

---

## 🧪 Testando

### cURL para testar o webhook:
```bash
curl -X POST "https://n8n.canvazap.com.br/webhook/SEU-ID-AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "test_123",
    "tipo": "vaccine",
    "campaign_name": "Teste",
    "total": 2,
    "records": [
      {
        "recordId": "rec_001",
        "data_convertida": "09/02/2026",
        "cliente": "Teste Cliente",
        "telefone_e164": "+5591981128051",
        "animal": "Rex",
        "produto": "Vanguard"
      }
    ],
    "companyId": "test",
    "callbackUrl": "https://ecossistemad3.com.br/api/petville-webhook-callback",
    "generated_at": "2026-02-09T16:00:00.000Z"
  }'
```

A resposta deve ser:
```json
{
  "success": true,
  "message": "Disparos processados com sucesso",
  "results": [...],
  "stats": {...}
}
```

---

## ⚠️ Importante

1. **Timeout**: Configure um timeout adequado no N8N (recomendado: 60 segundos)
2. **Retry**: Configure retry em caso de falha temporária
3. **Logging**: Ative logs para debug
4. **Validação**: Valide o `recordId` em cada resultado
5. **Error Handling**: Capture TODOS os erros possíveis

---

## 📊 Códigos de Erro Comuns

| Código | Descrição |
|--------|-----------|
| `INVALID_NUMBER` | Número de telefone inválido |
| `INVALID_WHATSAPP_NUMBER` | Número não está no WhatsApp |
| `RATE_LIMIT` | Limite de taxa excedido |
| `API_ERROR` | Erro na API do WhatsApp |
| `TIMEOUT` | Timeout na requisição |
| `BLOCKED` | Número bloqueou o bot |
| `UNKNOWN_ERROR` | Erro desconhecido |
