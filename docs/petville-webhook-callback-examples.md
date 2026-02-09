# Exemplos de JSON para Callback do N8N

## 📍 URL do Callback
```
POST https://seu-dominio.vercel.app/api/petville-webhook-callback
```

---

## ✅ Exemplo 1: SUCESSO no Disparo

```json
{
  "campaignId": "abc123xyz789",
  "recordId": "rec_001",
  "status": "success",
  "telefone_e164": "+5591981128051",
  "messageId": "wamid.HBgNNTU5MTk4MTI4MDUxFQIAERgSQzg5RjE2QzQwRjBBNzY4NTYAA==",
  "sentAt": "2026-02-09T15:30:45.123Z"
}
```

### Campos:
- **campaignId**: ID da campanha (recebido no webhook inicial)
- **recordId**: ID do registro individual (recebido no webhook inicial)
- **status**: `"success"` para sucesso
- **telefone_e164**: Número no formato E.164 (para validação)
- **messageId**: ID da mensagem retornado pela API do WhatsApp
- **sentAt**: Data/hora do envio bem-sucedido (ISO 8601)

---

## ❌ Exemplo 2: FALHA no Disparo

```json
{
  "campaignId": "abc123xyz789",
  "recordId": "rec_002",
  "status": "failed",
  "telefone_e164": "+5591999999999",
  "error": "Número não está registrado no WhatsApp",
  "errorCode": "INVALID_WHATSAPP_NUMBER"
}
```

### Campos:
- **campaignId**: ID da campanha (recebido no webhook inicial)
- **recordId**: ID do registro individual (recebido no webhook inicial)
- **status**: `"failed"` para falha
- **telefone_e164**: Número no formato E.164 (para validação)
- **error**: Mensagem de erro descritiva
- **errorCode**: Código do erro (ex: `INVALID_NUMBER`, `RATE_LIMIT`, `API_ERROR`)

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

---

## 🔄 Fluxo Completo no N8N

### 1. Receber Webhook Inicial
O CanvaZap envia:
```json
{
  "campaignId": "abc123xyz789",
  "tipo": "vaccine",
  "campaign_name": "Campanha 09-02-2026",
  "total": 19,
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
      "cliente": "Gleydson Moreira",
      "telefone_e164": "+5591982117363",
      "animal": "Luiz",
      "produto": "Vanguard (V10)"
    }
  ],
  "companyId": "company_petville",
  "callbackUrl": "https://seu-dominio.vercel.app/api/petville-webhook-callback"
}
```

### 2. Para Cada Registro
O N8N deve:
1. Tentar enviar a mensagem via WhatsApp
2. Capturar o resultado (sucesso ou falha)
3. Enviar callback para a URL fornecida

### 3. Exemplo de Nó HTTP Request no N8N

**Para SUCESSO:**
```javascript
// No nó "Function" antes do HTTP Request
const record = $input.item.json;

return {
  json: {
    campaignId: $node["Webhook"].json.campaignId,
    recordId: record.recordId,
    status: "success",
    telefone_e164: record.telefone_e164,
    messageId: $node["WhatsApp API"].json.messages[0].id,
    sentAt: new Date().toISOString()
  }
};
```

**Para FALHA:**
```javascript
// No nó "Function" para tratamento de erro
const record = $input.item.json;
const error = $node["WhatsApp API"].json.error;

return {
  json: {
    campaignId: $node["Webhook"].json.campaignId,
    recordId: record.recordId,
    status: "failed",
    telefone_e164: record.telefone_e164,
    error: error.message || "Erro ao enviar mensagem",
    errorCode: error.code || "UNKNOWN_ERROR"
  }
};
```

---

## 🧪 Testando o Callback

### cURL para Sucesso:
```bash
curl -X POST https://seu-dominio.vercel.app/api/petville-webhook-callback \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "test_campaign_123",
    "recordId": "test_record_001",
    "status": "success",
    "telefone_e164": "+5591981128051",
    "messageId": "wamid.test123",
    "sentAt": "2026-02-09T15:30:00Z"
  }'
```

### cURL para Falha:
```bash
curl -X POST https://seu-dominio.vercel.app/api/petville-webhook-callback \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "test_campaign_123",
    "recordId": "test_record_002",
    "status": "failed",
    "telefone_e164": "+5591999999999",
    "error": "Número não registrado no WhatsApp",
    "errorCode": "INVALID_WHATSAPP_NUMBER"
  }'
```

---

## 📈 Resposta do Callback

O endpoint retorna:
```json
{
  "success": true,
  "message": "Callback processado com sucesso",
  "recordId": "rec_001",
  "status": "success",
  "campaignStatus": "processando",
  "stats": {
    "total": 19,
    "success": 5,
    "failed": 2,
    "pending": 12
  }
}
```

Quando todos os registros forem processados, `campaignStatus` muda para `"concluido"`.
