# Análise do Sistema de Merchandising e Diagnóstico de Falhas

Este documento detalha o funcionamento atual dos endpoints de merchandising para identificar por que as requisições não estão sendo processadas corretamente.

## 1. Visão Geral da Arquitetura

Atualmente, existem **dois endpoints distintos** que lidam com entradas de merchandising. É crucial identificar qual deles está sendo alvo das requisições do n8n/HTTP Request.

| Endpoint | Arquivo | Propósito | Autenticação | Comportamento com Imagens |
|----------|---------|-----------|--------------|---------------------------|
| `/api/webhook-merchan` | `api/webhook-merchan.ts` | Webhook "Catch-all" (Depuração/Genérico) | **Pública** (Sem verificação de token explícita no código) | Salva URL ou Base64 **diretamente no Firestore** (Não usa R2). |
| `/api/merchandise` | `api/merchandise.ts` | API Oficial Estruturada | **Requer Token** (via header Authorization) | Faz upload de Base64 para o **Cloudflare R2** e salva URL no Firestore. |

---

## 2. Análise Detalhada dos Endpoints

### A. Endpoint `/api/webhook-merchan` (Provável alvo do n8n)

Este endpoint foi desenhado para ser resiliente e aceitar formatos variados de JSON (ex: Evolution API, Typebot).

**Fluxo de Execução:**
1.  **Inicialização do Banco**: Conecta ao Firestore.
2.  **Log de Entrada (Crucial)**: Tenta salvar **todo** payload recebido na coleção `webhook_logs` do Firestore.
    *   *Diagnóstico:* Se nada aparece nesta coleção, a requisição **não está chegando** na função (Erro de DNS, URL errada, bloqueio de firewall ou erro na Vercel antes da execução).
3.  **Processamento Flexível**: Tenta extrair dados de caminhos variados (`data.message`, `body.message`, `item['Nome da Instância']`, etc.).
4.  **Extração de Imagem**:
    *   Procura `imageMessage.url`, `message.base64`, etc.
    *   *Ponto de Atenção:* Se encontrar Base64, ele salva a string gigante no Firestore. Isso pode exceder o limite de tamanho de documento do Firestore (1MB) e falhar silenciosamente ou gerar timeout se a imagem for grande.
5.  **Gravação Final**: Salva em `merchandise_entries` com `companyId: 'ADMIN_GLOBAL'`.

### B. Endpoint `/api/merchandise`

Este endpoint é mais estrito e preparado para produção.

**Fluxo de Execução:**
1.  **Autenticação**: Verifica se a `ApiKey` é válida. Se falhar, retorna 401.
2.  **Validação de Payload**: Exige `sender`, `imageBase64` OU `imageUrl`.
3.  **Upload R2**: Se receber `imageBase64`, envia para o Cloudflare R2 e gera uma URL pública.
4.  **Gravação Final**: Salva em `merchandise_entries` vinculando à empresa dona do Token.

---

## 3. Diagnóstico do Problema ("Não estou recebendo entradas")

Se o sistema "está fora do ar" para receber dados, as causas prováveis em ordem de probabilidade são:

### Cenário 1: A requisição nem chega ao Vercel
*   **Sintoma:** Nenhum log no painel da Vercel, nada na coleção `webhook_logs`.
*   **Teste:**
    ```bash
    curl -X POST https://seu-projeto.vercel.app/api/webhook-merchan -H "Content-Type: application/json" -d '{"test": true}'
    ```
*   **Causa:** URL incorreta no n8n ou bloqueio de CORS se for chamado via browser (embora o código permita `*`).

### Cenário 2: Chega, mas falha na Inicialização do Firebase
*   **Sintoma:** Retorno 500 com mensagem "Firebase Initialization Failed".
*   **Causa:** As variáveis de ambiente (`VITE_FIREBASE_PRIVATE_KEY`, etc.) não estão acessíveis no ambiente de Serverless Function da Vercel.
*   **Verificação:** O arquivo `api/webhook-merchan.ts` tem um bloco `try/catch` específico para isso. Verifique a resposta HTTP exata que o n8n recebe.

### Cenário 3: Chega, mas o Payload não corresponde ao esperado
*   **Sintoma:** Retorno 200 OK ("Webhook received"), item salvo em `webhook_logs`, mas **nada** em `merchandise_entries`.
*   **Causa:** A lógica de extração ("parser") não está encontrando os campos de imagem onde espera.
    *   O código busca: `message.imageMessage.url`, `message.base64`, etc.
    *   Se o JSON do n8n vier diferente (ex: `data.imgUrl` em vez de `data.imageUrl`), o código ignora e não salva nada.

### Cenário 4: Estouro de Tamanho (Base64 no Firestore)
*   **Sintoma:** Timeout ou erro 500 intermitente.
*   **Causa:** No endpoint `webhook-merchan`, imagens Base64 são gravadas direto no banco. Se a imagem tiver > 700kb, pode falhar.

---

## 4. Plano de Ação Recomendado

1.  **Confirmação de URL**: Garanta que o n8n está apontando para `/api/webhook-merchan` (para testes) ou `/api/merchandise` (para produção com R2).
2.  **Verificar Logs do Firestore**:
    *   Abra a coleção `webhook_logs`. Existe algum documento recente?
        *   **NÃO**: O problema é rede/DNS/Vercel.
        *   **SIM**: O problema é o *Parser* (formato do JSON).
3.  **Teste de "Ping"**:
    Use o comando abaixo no terminal local para validar se a API responde (estando rodando localmente na porta 3000):
    ```bash
    curl -X POST http://localhost:3000/api/webhook-merchan \
    -H "Content-Type: application/json" \
    -d '{"message": {"senderName": "Teste", "caption": "Teste Ping", "imageUrl": "https://via.placeholder.com/150"}}'
    ```
    Se criar um registro, a API funciona e o erro está no formato enviado pelo n8n.

## 5. Estrutura de JSON Esperada (Para `webhook-merchan`)

Para garantir o sucesso, o JSON enviado deve ter uma destas estruturas:

**Opção A (URL Direta):**
```json
{
  "message": {
    "senderName": "Cliente",
    "imageMessage": {
      "url": "https://link-da-imagem.com/foto.jpg"
    },
    "caption": "Legenda aqui"
  }
}
```

**Opção B (Base64 na raiz ou mensagem):**
```json
{
  "message": {
    "base64": "iVBORw0KGgoAAAANSUhEUgAAAAE...",
    "senderName": "Cliente"
  }
}
```
