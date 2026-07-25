export type Bindings = {
	META_VERIFY_TOKEN: string;
	VPS_WEBHOOK_URL: string;
	VPS_AUTH_TOKEN: string;
	MSG_QUEUE: Queue;
};

export type MessagePayload = {
	id: string;
	timestamp: number;
	body: any;
};
