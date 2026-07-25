import { Hono } from 'hono';
import { Bindings, MessagePayload } from './types';

const app = new Hono<{ Bindings: Bindings }>();

// 1. HANDSHAKE COM A META (GET)
app.get('/webhook', (c) => {
	const mode = c.req.query('hub.mode');
	const token = c.req.query('hub.verify_token');
	const challenge = c.req.query('hub.challenge');

	if (mode === 'subscribe' && token === c.env.META_VERIFY_TOKEN) {
		return c.text(challenge, 200);
	}
	return c.text('Forbidden', 403);
});

// 2. PRODUTOR: RECEBE DA META E ENFILEIRA (POST)
app.post('/webhook', async (c) => {
	const body = await c.req.json();

	console.log('Recebido da Meta:', JSON.stringify(body));

	if (body.object === 'whatsapp_business_account') {
		const payload: MessagePayload = {
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			body,
		};

		// Enfileira de forma assíncrona para responder à Meta o mais rápido possível
		c.executionCtx.waitUntil(c.env.MSG_QUEUE.send(payload));
	}

	// Resposta rápida (<50ms total, ~1ms CPU)
	return c.text('EVENT_RECEIVED', 200);
});

export default app
