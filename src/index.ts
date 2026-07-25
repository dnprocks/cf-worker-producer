type Bindings = {
	// META_VERIFY_TOKEN: string;
	VPS_WEBHOOK_URL: string;
	VPS_AUTH_TOKEN: string;
	MSG_QUEUE: Queue;
};

type MessagePayload = {
	id: string;
	timestamp: number;
	body: any;
};

export default {
	// Our fetch handler is invoked on a HTTP request: we can send a message to a queue
	// during (or after) a request.
	// https://developers.cloudflare.com/queues/platform/javascript-apis/#producer
	async fetch(req, env, ctx): Promise<Response> {
		// To send a message on a queue, we need to create the queue first
		// https://developers.cloudflare.com/queues/get-started/#3-create-a-queue
		await env.MY_QUEUE.send({
			url: req.url,
			method: req.method,
			headers: Object.fromEntries(req.headers),
		});
		return new Response('Sent message to the queue');
	},
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
