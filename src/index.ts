import { Bindings, MessagePayload } from './types';
import server from './server';

export default {
	// Our fetch handler is invoked on a HTTP request: we can send a message to a queue
	// during (or after) a request.
	// https://developers.cloudflare.com/queues/platform/javascript-apis/#producer
	// To send a message on a queue, we need to create the queue first
	// https://developers.cloudflare.com/queues/get-started/#3-create-a-queue
	fetch: server.fetch,
	// The queue handler is invoked when a batch of messages is ready to be delivered
	// https://developers.cloudflare.com/queues/platform/javascript-apis/#messagebatch
	async queue(batch: MessageBatch<MessagePayload>, env: Bindings): Promise<void> {
		for (const message of batch.messages) {
			try {
				const response = await fetch(env.VPS_WEBHOOK_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Worker-Auth': env.VPS_AUTH_TOKEN, // Garante que a requisição veio do seu Worker
					},
					body: JSON.stringify(message.body),
				});

				if (!response.ok) {
					// Lança erro se o VPS retornar 4xx ou 5xx
					throw new Error(`VPS respondeu com status HTTP ${response.status}`);
				}

				// Sucesso: confirma o processamento e remove da fila
				message.ack();
			} catch (error) {
				console.error(`Falha ao enviar mensagem ${message.id} para o VPS:`, error);

				// Solicita explicitamente o re-enfileiramento (retry com backoff)
				message.retry();
			}
		}
	},
};
// satisfies ExportedHandler<Env, Error>;
