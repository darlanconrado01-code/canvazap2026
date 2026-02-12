# 🚀 Como Importar o Workflow N8N Corrigido

## 📋 Mudanças Principais

### ❌ Problema no Workflow Antigo:
- Múltiplos nós "Respond to Webhook" (ERRO!)
- N8N só permite responder UMA vez ao webhook
- Resultados não eram agregados

### ✅ Solução no Workflow Novo:
- **UM único** "Respond to Webhook" no final
- Todos os resultados são agregados antes de responder
- Estrutura de resposta correta com array de resultados

---

## 📥 Como Importar

### 1. Copie o arquivo JSON
Arquivo: `docs/n8n-workflow-complete.json`

### 2. No N8N:
1. Clique em **"+"** (Novo Workflow)
2. Clique nos **3 pontos** (⋮) no canto superior direito
3. Selecione **"Import from File"** ou **"Import from URL"**
4. Cole o conteúdo do JSON ou faça upload do arquivo
5. Clique em **"Import"**

### 3. Configure suas credenciais:
- Nó **"Send WhatsApp"**: Configure suas credenciais da Evolution API
- Webhook ID já está configurado: `2ad84985-7c33-48b3-8651-4ea46d49bce3`

### 4. Ative o Workflow:
- Clique em **"Active"** no canto superior direito

---

## 🔄 Fluxo do Workflow

```
┌─────────────────┐
│   1. Webhook    │ ← Recebe do CanvaZap
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Extract      │ ← Extrai array de registros
│    Records      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Check Type   │ ← Verifica se é vaccine/antiparasitic
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Loop Over    │ ← Processa cada registro
│    Items        │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼ (quando termina loop)
┌─────────────────┐   ┌─────────────────┐
│ 5. Send         │   │ 8. Aggregate    │
│    WhatsApp     │   │    Results      │
└────────┬────────┘   └────────┬────────┘
         │                     │
    ┌────┴────┐                ▼
    ▼         ▼         ┌─────────────────┐
[Sucesso] [Falha]      │ 9. Build        │
    │         │         │    Response     │
    ▼         ▼         └────────┬────────┘
┌─────────────────┐             │
│ 6. Format       │             ▼
│ Success/Failed  │      ┌─────────────────┐
└────────┬────────┘      │ 10. Respond to  │
         │               │     Webhook     │
         ▼               └─────────────────┘
┌─────────────────┐             ↓
│ 7. Wait         │      Retorna para CanvaZap
└────────┬────────┘
         │
         └─→ Volta para Loop (próximo item)
```

---

## 📊 Estrutura da Resposta

O workflow retorna:

```json
{
  "success": true,
  "message": "Disparos processados com sucesso",
  "results": [
    {
      "recordId": "D3yUB5TQfSmDvtzvFSes",
      "status": "success",
      "telefone_e164": "+5591984034863",
      "messageId": "msg_12345",
      "sentAt": "2026-02-09T16:30:00.000Z"
    },
    {
      "recordId": "2McKLYgrG89VOZ5BEbfU",
      "status": "failed",
      "telefone_e164": "+559193216560",
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

---

## 🎯 Nós Importantes

### 1. **Webhook** (Trigger)
- Recebe POST do CanvaZap
- Response Mode: **"Using 'Respond to Webhook' Node"**

### 2. **Extract Records** (Code)
- Extrai `body.records` do payload
- Retorna array de registros individuais

### 3. **Check Type** (IF)
- Verifica se `tipo === "vaccine"`
- Pode adicionar lógica para antiparasitários

### 4. **Loop Over Items** (Split In Batches)
- Processa cada registro individualmente
- Batch Size: 1

### 5. **Send WhatsApp** (Evolution API)
- Envia mensagem via WhatsApp
- Tem 2 saídas: Sucesso e Erro

### 6. **Format Success/Failed** (Code)
- Formata resultado em estrutura padrão
- Inclui `recordId`, `status`, `telefone_e164`, etc.

### 7. **Wait** (Wait)
- Aguarda antes de processar próximo item
- Volta para o Loop

### 8. **Aggregate Results** (Aggregate)
- Junta TODOS os resultados em um array
- Só executa quando o loop termina

### 9. **Build Response** (Code)
- Monta resposta final com:
  - Array de `results`
  - Estatísticas (`stats`)
  - Mensagem de sucesso

### 10. **Respond to Webhook** (Respond to Webhook)
- **ÚNICO** nó de resposta
- Retorna JSON para o CanvaZap

---

## ⚙️ Configurações Importantes

### No nó "Send WhatsApp":
```
Resource: messages-api
Instance Name: petville
Remote JID: {{ $json.telefone_e164 }}
Message Text: 
  Comunicado importante! 🚨🚨 
  
  🐶🐱  Passamos para lembrar que {{ $json.animal }} precisa tomar vacina esta semana.   
  
  💉 Vacina: {{ $json.produto }}
  
  Vamos agendar?
```

### No nó "Format Success":
```javascript
const record = $input.item(0).json;
const whatsappResponse = $input.item(0).json;

return {
  json: {
    recordId: record.recordId,
    status: "success",
    telefone_e164: record.telefone_e164,
    messageId: whatsappResponse.key?.id || "msg_" + Date.now(),
    sentAt: new Date().toISOString()
  }
};
```

### No nó "Format Failed":
```javascript
const record = $input.item(0).json;
const errorData = $input.item(0).json.error || {};

return {
  json: {
    recordId: record.recordId,
    status: "failed",
    telefone_e164: record.telefone_e164,
    error: errorData.message || "Erro ao enviar mensagem",
    errorCode: errorData.code || "UNKNOWN_ERROR"
  }
};
```

### No nó "Build Response":
```javascript
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

---

## 🧪 Testando

### 1. Teste Manual no N8N:
1. Clique em **"Execute Workflow"**
2. O nó Webhook mostrará a URL
3. Use cURL ou Postman para enviar:

```bash
curl -X POST "https://n8n.canvazap.com.br/webhook/2ad84985-7c33-48b3-8651-4ea46d49bce3" \
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
        "cliente": "Teste",
        "telefone_e164": "+5591984034863",
        "animal": "Rex",
        "produto": "Vanguard"
      }
    ],
    "companyId": "test"
  }'
```

### 2. Teste pelo CanvaZap:
1. Acesse: https://ecossistemad3.com.br
2. Vá em "Disparos PetVille"
3. Processe alguns dados
4. Clique em "Disparar no WhatsApp"
5. Verifique o histórico

---

## ⚠️ Troubleshooting

### Erro: "Webhook already responded"
**Causa:** Múltiplos nós "Respond to Webhook"
**Solução:** Use o workflow corrigido (só 1 resposta no final)

### Erro: "Cannot read property 'recordId'"
**Causa:** Estrutura de dados incorreta
**Solução:** Verifique o nó "Extract Records"

### Erro: "Evolution API timeout"
**Causa:** Muitos disparos simultâneos
**Solução:** Adicione delay no nó "Wait"

### Resultados não aparecem no CanvaZap
**Causa:** Estrutura de resposta incorreta
**Solução:** Verifique o nó "Build Response"

---

## 📝 Checklist de Importação

- [ ] Importar workflow JSON
- [ ] Configurar credenciais Evolution API
- [ ] Verificar webhook ID
- [ ] Ativar workflow
- [ ] Testar com cURL
- [ ] Testar pelo CanvaZap
- [ ] Verificar histórico de disparos
- [ ] Confirmar status individual (✓ Enviado / ✗ Falhou)

---

## 🎉 Pronto!

Agora você tem um workflow N8N completo e funcional que:
- ✅ Recebe disparos do CanvaZap
- ✅ Processa cada registro individualmente
- ✅ Captura sucesso E falha
- ✅ Agrega todos os resultados
- ✅ Responde UMA vez com array completo
- ✅ CanvaZap atualiza status individual automaticamente
