import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { ashdocsRequest } from '../Ashdocs/GenericFunctions';
import { flattenEvent, INVOICE_TRIGGER_EVENTS, signatureValid, type Json } from '../Ashdocs/shared';

const sameSet = (a: unknown, b: string[]) =>
	Array.isArray(a) && a.length === b.length && [...a].sort().join() === [...b].sort().join();

export class AshdocsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ASHDOCS Trigger',
		name: 'ashdocsTrigger',
		icon: { light: 'file:ashdocs.svg', dark: 'file:ashdocs.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{$parameter["events"].join(", ")}}',
		description:
			'Starts the workflow the moment an invoice is sent, viewed, paid or becomes overdue',
		defaults: { name: 'ASHDOCS Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'ashdocsApi', required: true }],
		webhooks: [
			{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
		],
		properties: [
			{
				displayName: 'Trigger On',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: INVOICE_TRIGGER_EVENTS,
				default: ['invoice.paid'],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Verify Signature',
						name: 'verifySignature',
						type: 'boolean',
						default: true,
						description:
							'Whether to ignore requests that are not signed by ASHDOCS with this subscription’s secret',
					},
				],
			},
			{
				displayName:
					'Webhooks need an ASHDOCS plan that includes them (Starter and up). Test keys deliver events for test invoices.',
				name: 'planNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				const url = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];
				const res = await ashdocsRequest.call(this, 'GET', '/api/v1/webhooks');
				for (const hook of (res.webhooks as IDataObject[]) ?? []) {
					if (hook.url !== url) continue;
					// Reuse only a subscription this node created (it holds the secret) for the same events.
					if (hook.id === data.webhookId && data.webhookSecret && sameSet(hook.events, events))
						return true;
					await ashdocsRequest.call(
						this,
						'DELETE',
						`/api/v1/webhooks/${encodeURIComponent(String(hook.id))}`,
					);
				}
				delete data.webhookId;
				delete data.webhookSecret;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				const res = await ashdocsRequest.call(this, 'POST', '/api/v1/webhooks', {
					url: this.getNodeWebhookUrl('default') as string,
					events: this.getNodeParameter('events') as string[],
					description: `n8n: ${this.getWorkflow().name ?? 'workflow'}`.slice(0, 200),
				});
				data.webhookId = res.id;
				data.webhookSecret = res.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.webhookId) {
					try {
						await ashdocsRequest.call(
							this,
							'DELETE',
							`/api/v1/webhooks/${encodeURIComponent(String(data.webhookId))}`,
						);
					} catch (error) {
						this.logger.warn(
							`ASHDOCS Trigger: could not delete webhook ${String(data.webhookId)}: ${(error as Error).message}`,
						);
						return false;
					}
				}
				delete data.webhookId;
				delete data.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as Json;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		if (options.verifySignature !== false) {
			const secret = this.getWorkflowStaticData('node').webhookSecret as string | undefined;
			const req = this.getRequestObject() as unknown as { rawBody?: Buffer };
			const raw = req.rawBody ?? Buffer.from(JSON.stringify(body));
			if (!secret || !signatureValid(raw, this.getHeaderData()['x-ashdocs-signature'], secret)) {
				const res = this.getResponseObject();
				res.status(401).json({ error: 'invalid signature' });
				return { noWebhookResponse: true };
			}
		}
		const events = this.getNodeParameter('events') as string[];
		const flat = flattenEvent(body);
		if (!events.includes(String(flat.event))) return { webhookResponse: { ignored: true } };
		return { workflowData: [this.helpers.returnJsonArray(flat as IDataObject)] };
	}
}
