# cf-worker-producer

Um projeto de Cloudflare Workers que atua como um produtor de mensagens para filas, desenhado para receber webhooks do WhatsApp Business (Meta) e encaminhar eventos de forma assíncrona para um servidor de backend.

## Objetivo

O `cf-worker-producer` foi criado para desacoplar o recebimento de eventos do WhatsApp Business da entrega de mensagens ao servidor de processamento final. Isto garante:

- resposta rápida e confiável ao endpoint do Meta,
- processamento assíncrono com retries e dead-letter queue,
- melhor controle de falhas e de escalabilidade,
- uso eficiente da infraestrutura de edge da Cloudflare.

## Motivação

Webhooks do WhatsApp Business exigem respostas rápidas para permanecerem validados pela Meta. Ao encaminhar cada evento diretamente para o backend, existe risco de timeouts, falhas de rede e sobrecarga no servidor de destino.

Este projeto resolve isso usando Cloudflare Queues:

- o Worker responde rapidamente à Meta,
- os eventos são enfileirados imediatamente,
- o processamento real é feito em background,
- falhas transitórias ganham retry automático,
- mensagens problemáticas podem ir para uma dead-letter queue.

## Como funciona

### 1. Recebimento de webhook

O Worker expõe um endpoint HTTP em `/webhook` com duas responsabilidades:

- `GET /webhook`: handshake de verificação do Meta usando `hub.mode`, `hub.verify_token` e `hub.challenge`.
- `POST /webhook`: recebe eventos do WhatsApp Business e enfileira um payload assíncrono.

Quando o evento contém `object === 'whatsapp_business_account'`, o Worker cria um payload com `id`, `timestamp` e `body` e envia para a fila `MSG_QUEUE`.

### 2. Produção de fila

O binding `MSG_QUEUE` está configurado como produtor para a fila `whatsapp-messages` no arquivo `wrangler.jsonc`.

### 3. Consumo de mensagens

O Worker define também um handler de fila que processa mensagens em lotes. Para cada mensagem:

- faz `POST` para `VPS_WEBHOOK_URL`,
- inclui `X-Worker-Auth: VPS_AUTH_TOKEN` para autenticação entre o Worker e o backend,
- faz `ack()` em caso de sucesso,
- faz `retry()` em caso de erro.

### 4. Retry e DLQ

A configuração da fila define:

- `max_batch_size: 1` para processar uma mensagem por vez e manter controle individual de retry,
- `max_batch_timeout: 5`,
- `max_retries: 3`,
- `dead_letter_queue: meta-messages-dlq`.

Isso ajuda a isolar falhas e evitar perda de eventos.

## Principais vantagens

- Arquitetura assíncrona e resiliente
- Redução de latência para o endpoint do Meta
- Retry automático em caso de erro de entrega
- Separação clara entre ingestão e entrega
- Aproveita a infraestrutura global da Cloudflare
- Fácil deploy com Wrangler

## Estrutura do projeto

- `src/index.ts` - exporta o handler principal do Worker, combinando o fetch handler e o queue handler.
- `src/server.ts` - define o servidor Hono que recebe webhooks e envia mensagens para a fila.
- `src/types.ts` - tipos TypeScript para bindings e payloads de mensagem.
- `wrangler.jsonc` - configuração do projeto Cloudflare Workers, filas, bindings e variáveis.

## Requisitos

- Cloudflare Workers com suporte a Cloudflare Queues
- Wrangler instalado
- Variáveis e secrets configurados no ambiente:
  - `META_VERIFY_TOKEN`
  - `VPS_WEBHOOK_URL`
  - `VPS_AUTH_TOKEN`

## Comandos úteis

- `npm run dev` - inicia o desenvolvimento local com `wrangler dev`
- `npm run deploy` - faz deploy do Worker para a Cloudflare
- `npm run cf-typegen` - gera tipos de bindings para o projeto

## Configuração

A configuração básica em `wrangler.jsonc` inclui:

- `name`: nome do Worker
- `compatibility_date`: data de compatibilidade do runtime
- filas `whatsapp-messages` e `meta-messages-dlq`
- `MSG_QUEUE` como binding de produtor
- `VPS_WEBHOOK_URL` como variável de ambiente

## Como usar

1. Configure os secrets `META_VERIFY_TOKEN` e `VPS_AUTH_TOKEN` no seu ambiente Cloudflare.
2. Ajuste `VPS_WEBHOOK_URL` para o endpoint do servidor final.
3. Faça deploy com `npm run deploy`.
4. Aponte o webhook do WhatsApp Business para o endpoint do Worker.

## Observações

- O projeto envia o payload da Meta “como está” para o backend.
- Para uso em produção, recomenda-se adicionar validação adicional do payload e monitoramento de filas.
- O endpoint aceita eventos do WhatsApp Business e responde rapidamente para manter a validação da Meta em dia.


