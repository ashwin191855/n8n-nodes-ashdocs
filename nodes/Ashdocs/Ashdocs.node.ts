import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { customerFields, customerOperations } from './descriptions/CustomerDescription';
import { documentFields, documentOperations } from './descriptions/DocumentDescription';
import { invoiceFields, invoiceOperations } from './descriptions/InvoiceDescription';
import { ashdocsRequest, baseUrl } from './GenericFunctions';
import {
	compact,
	customerBody,
	emailChannel,
	parseLineItemsJson,
	resultFileUrl,
	sameEmail,
	simplifyInvoice,
	toLineItems,
	type CustomerFields,
	type LineItemInput,
} from './shared';

const day = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : undefined);
const PAGE = 100;

export class Ashdocs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ASHDOCS',
		name: 'ashdocs',
		icon: { light: 'file:ashdocs.svg', dark: 'file:ashdocs.dark.svg' },
		group: ['output'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Create, send and look up invoices, manage customers, and generate or redact PDFs with ASHDOCS',
		defaults: { name: 'ASHDOCS' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'ashdocsApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Customer', value: 'customer' },
					{ name: 'Document', value: 'document' },
					{ name: 'Invoice', value: 'invoice' },
				],
				default: 'invoice',
			},
			...invoiceOperations,
			...invoiceFields,
			...customerOperations,
			...customerFields,
			...documentOperations,
			...documentFields,
		],
	};

	methods = {
		loadOptions: {
			async getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const res = await ashdocsRequest.call(this, 'GET', '/api/v1/invoice-templates');
				const items = (res.items as IDataObject[]) ?? [];
				return [
					{ name: 'Default (From Settings)', value: '' },
					...items.map((t) => ({ name: String(t.name), value: String(t.id) })),
				];
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let results: INodeExecutionData[] = [];

				if (resource === 'invoice') results = await invoice.call(this, operation, i);
				else if (resource === 'customer') results = await customer.call(this, operation, i);
				else if (resource === 'document') results = [await document.call(this, operation, i)];

				for (const r of results) out.push({ ...r, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Both constructors hand back an error that is already theirs (with the API's message intact).
				if (error instanceof NodeApiError) {
					error.context.itemIndex = i;
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}

const wrap = (data: IDataObject | IDataObject[]): INodeExecutionData[] =>
	(Array.isArray(data) ? data : [data]).map((json) => ({ json }));

async function findCustomerByEmail(
	this: IExecuteFunctions,
	email: string,
): Promise<IDataObject | undefined> {
	const res = await ashdocsRequest.call(this, 'GET', '/api/v1/customers', undefined, {
		q: email.trim(),
	});
	return ((res.items as IDataObject[]) ?? []).find((c) => sameEmail(c.email, email));
}

async function invoice(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'create') {
		const add = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const customerType = this.getNodeParameter('customerType', i) as string;
		const details = (
			customerType === 'id' ? {} : this.getNodeParameter('customerDetails', i, {})
		) as CustomerFields;
		const customerRef =
			customerType === 'id'
				? { id: this.getNodeParameter('customerId', i) as string }
				: customerBody({
						name: this.getNodeParameter('customerName', i) as string,
						email: this.getNodeParameter('customerEmail', i, '') as string,
						...details,
						// Workflows saved before Customer Phone became its own field keep it under Customer Details.
						phone: (this.getNodeParameter('customerPhone', i, '') as string) || details.phone,
					});

		let lineItems: IDataObject[];
		const rows =
			(this.getNodeParameter('lineItems', i, {}) as { item?: LineItemInput[] }).item ?? [];
		const fromJson = this.getNodeParameter('lineItemsInput', i) === 'json';
		if (!fromJson && !rows.length) {
			throw new NodeOperationError(this.getNode(), 'Add at least one line item', { itemIndex: i });
		}
		try {
			lineItems = (
				fromJson
					? parseLineItemsJson(this.getNodeParameter('lineItemsJson', i))
					: toLineItems(rows.map((r) => ({ ...r, taxRate: r.taxRate ? r.taxRate : undefined })))
			) as IDataObject[];
		} catch (e) {
			throw new NodeOperationError(this.getNode(), (e as Error).message, { itemIndex: i });
		}

		const issue = this.getNodeParameter('issue', i) as boolean;
		const send = issue && (this.getNodeParameter('send', i, false) as boolean);
		const body = compact({
			kind: add.kind as string,
			customer: customerRef,
			line_items: lineItems,
			currency: add.currency ? String(add.currency).toUpperCase() : undefined,
			due_terms: add.dueDate ? undefined : (add.dueTerms as string),
			issue_date: day(add.issueDate),
			due_date: day(add.dueDate),
			reference: add.reference as string,
			po_number: add.poNumber as string,
			notes: add.notes as string,
			terms: add.terms as string,
			template: add.template as string,
			issue,
			send: send
				? emailChannel({
						cc: add.emailCc,
						subject: add.emailSubject as string,
						message: add.emailMessage as string,
					})
				: undefined,
		}) as IDataObject;
		const headers = add.idempotencyKey
			? { 'Idempotency-Key': String(add.idempotencyKey) }
			: undefined;
		return wrap(
			await ashdocsRequest.call(this, 'POST', '/api/v1/invoices', body, undefined, headers),
		);
	}

	if (operation === 'send') {
		const id = encodeURIComponent(this.getNodeParameter('invoiceId', i) as string);
		const o = this.getNodeParameter('sendOptions', i, {}) as IDataObject;
		const body = emailChannel({
			to: o.to,
			cc: o.cc,
			subject: o.subject as string,
			message: o.message as string,
		});
		return wrap(
			await ashdocsRequest.call(this, 'POST', `/api/v1/invoices/${id}/send`, body as IDataObject),
		);
	}

	const simple = (inv: IDataObject) =>
		this.getNodeParameter('simplify', i, true) ? (simplifyInvoice(inv) as IDataObject) : inv;

	if (operation === 'get') {
		if (this.getNodeParameter('getBy', i) === 'id') {
			const id = encodeURIComponent(this.getNodeParameter('invoiceId', i) as string);
			return wrap(simple(await ashdocsRequest.call(this, 'GET', `/api/v1/invoices/${id}`)));
		}
		const number = String(this.getNodeParameter('invoiceNumber', i)).trim();
		const res = await ashdocsRequest.call(this, 'GET', '/api/v1/invoices', undefined, {
			q: number,
			limit: PAGE,
		});
		const match = ((res.items as IDataObject[]) ?? []).find(
			(inv) => String(inv.number ?? '').toLowerCase() === number.toLowerCase(),
		);
		if (!match)
			throw new NodeOperationError(this.getNode(), `No invoice numbered ${number}`, {
				itemIndex: i,
			});
		return wrap(simple(match));
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? Infinity : (this.getNodeParameter('limit', i) as number);
		const f = this.getNodeParameter('filters', i, {}) as IDataObject;
		const qs: IDataObject = compact({
			status: f.status as string,
			q: f.q as string,
			due_after: day(f.dueAfter),
			due_before: day(f.dueBefore),
		});
		if (f.customerEmail) {
			const c = await findCustomerByEmail.call(this, String(f.customerEmail));
			if (!c) return [];
			qs.customer_id = c.id;
		}
		const after = day(f.issuedAfter);
		const before = day(f.issuedBefore);
		const keep = (inv: IDataObject) => {
			const d = day(inv.issue_date);
			if (!after && !before) return true;
			if (!d) return false;
			return (!after || d >= after) && (!before || d <= before);
		};

		const found: IDataObject[] = [];
		let cursor: string | undefined;
		do {
			const res = await ashdocsRequest.call(this, 'GET', '/api/v1/invoices', undefined, {
				...qs,
				limit: PAGE,
				...(cursor ? { cursor } : {}),
			});
			for (const inv of (res.items as IDataObject[]) ?? []) {
				if (keep(inv)) found.push(inv);
				if (found.length >= limit) break;
			}
			cursor = (res.next_cursor as string) || undefined;
		} while (cursor && found.length < limit);
		return wrap(found.map(simple));
	}

	throw new NodeOperationError(this.getNode(), `Unknown invoice operation: ${operation}`, {
		itemIndex: i,
	});
}

async function customer(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'create') {
		const email = this.getNodeParameter('email', i, '') as string;
		const body = customerBody({
			name: this.getNodeParameter('name', i) as string,
			email,
			...(this.getNodeParameter('additionalFields', i, {}) as CustomerFields),
		}) as IDataObject;
		// One customer per email: with "Return the Existing Customer", look first instead of failing.
		if (email && this.getNodeParameter('onDuplicate', i) === 'existing') {
			const existing = await findCustomerByEmail.call(this, email);
			if (existing) return wrap(existing);
		}
		return wrap(await ashdocsRequest.call(this, 'POST', '/api/v1/customers', body));
	}
	if (operation === 'find') {
		const found = await findCustomerByEmail.call(this, this.getNodeParameter('email', i) as string);
		return found ? wrap(found) : [];
	}
	if (operation === 'get') {
		const id = encodeURIComponent(this.getNodeParameter('customerId', i) as string);
		return wrap(await ashdocsRequest.call(this, 'GET', `/api/v1/customers/${id}`));
	}
	throw new NodeOperationError(this.getNode(), `Unknown customer operation: ${operation}`, {
		itemIndex: i,
	});
}

async function document(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<INodeExecutionData> {
	let res: IDataObject;
	let fileName: string;
	if (operation === 'generatePdf') {
		const source = this.getNodeParameter('source', i) as string;
		if (source === 'html') {
			res = await ashdocsRequest.call(this, 'POST', '/api/v1/tools/html-to-pdf', {
				html: this.getNodeParameter('html', i) as string,
				options: { format: this.getNodeParameter('format', i) as string, output: 'url' },
			});
		} else {
			res = await ashdocsRequest.call(this, 'POST', '/api/v1/tools/url-to-pdf', {
				url: this.getNodeParameter('url', i) as string,
				options: { output: 'url' },
			});
		}
		fileName = 'document.pdf';
	} else if (operation === 'redact') {
		res = await ashdocsRequest.call(this, 'POST', '/api/v1/tools/redact-pdf', {
			file_url: this.getNodeParameter('fileUrl', i) as string,
			options: { types: this.getNodeParameter('types', i) as string[], output: 'url' },
		});
		fileName = 'redacted.pdf';
	} else {
		throw new NodeOperationError(this.getNode(), `Unknown document operation: ${operation}`, {
			itemIndex: i,
		});
	}

	// URL to PDF answers with a job envelope (output_files[0].url), the others with file_url; local
	// storage gives a path on the API host. Expose one absolute `file_url` either way.
	const fileUrl = resultFileUrl(res, await baseUrl.call(this));
	const item: INodeExecutionData = { json: fileUrl ? { ...res, file_url: fileUrl } : res };
	if (this.getNodeParameter('download', i, false) && fileUrl) {
		const file = (await this.helpers.httpRequest({
			url: fileUrl,
			encoding: 'arraybuffer',
			json: false,
		})) as ArrayBuffer;
		const field = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
		item.binary = {
			[field]: await this.helpers.prepareBinaryData(Buffer.from(file), fileName, 'application/pdf'),
		};
	}
	return item;
}
