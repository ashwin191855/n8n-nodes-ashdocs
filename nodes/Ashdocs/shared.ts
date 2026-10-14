// Pure helpers shared by the ASHDOCS and ASHDOCS Trigger nodes (no n8n imports, so they are unit-tested
// directly from dist/ by test/shared.test.js).

import { createHmac, timingSafeEqual } from 'crypto';

export type Json = Record<string, unknown>;

/** Bad node input (shown to the user as a NodeOperationError). */
export class InputError extends Error {}

export interface LineItemInput {
	description?: string;
	quantity?: number | string;
	unitPrice?: number | string;
	taxRate?: number | string;
	unit?: string;
}

const isBlank = (v: unknown) =>
	v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Money and quantities go to the API as strings so 0.1 stays 0.1 (the API parses decimals exactly). */
export const decimal = (v: unknown): string | undefined =>
	isBlank(v) ? undefined : String(v).trim();

export const compact = <T extends Json>(obj: T): T => {
	const out: Json = {};
	for (const [k, v] of Object.entries(obj)) {
		if (isBlank(v)) continue;
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const inner = compact(v as Json);
			if (Object.keys(inner).length) out[k] = inner;
			continue;
		}
		out[k] = v;
	}
	return out as T;
};

/** Line items from the node's fields, or from mapped JSON (an array of objects using either the API's
 * names, `unit_price` / `tax_rate`, or the node's, `unitPrice` / `taxRate`). */
export function toLineItems(rows: LineItemInput[] | Json[]): Json[] {
	return (rows as Json[]).map((r, i) => {
		const description = (r.description ?? r.name ?? '') as string;
		const unitPrice = r.unit_price ?? r.unitPrice ?? r.price ?? r.rate;
		if (isBlank(description)) throw new InputError(`Line item ${i + 1} needs a description`);
		if (isBlank(unitPrice))
			throw new InputError(`Line item ${i + 1} ("${description}") needs a unit price`);
		return compact({
			description: String(description),
			quantity: decimal(r.quantity ?? r.qty) ?? '1',
			unit_price: decimal(unitPrice),
			tax_rate: decimal(r.tax_rate ?? r.taxRate),
			unit: isBlank(r.unit) ? undefined : String(r.unit),
		});
	});
}

export function parseLineItemsJson(value: unknown): Json[] {
	const BAD = Symbol('bad');
	let rows: unknown = value;
	if (typeof rows === 'string') {
		const text = rows;
		rows = (() => {
			try {
				return JSON.parse(text) as unknown;
			} catch {
				return BAD;
			}
		})();
	}
	if (rows === BAD) {
		throw new InputError(
			'Line Items (JSON) is not valid JSON. Use an array such as [{"description": "Design", "quantity": 2, "unit_price": "150.00"}]',
		);
	}
	if (rows && !Array.isArray(rows) && typeof rows === 'object') rows = [rows];
	if (!Array.isArray(rows) || rows.length === 0)
		throw new InputError('Line Items (JSON) must be a non-empty array');
	return toLineItems(rows as Json[]);
}

export const splitEmails = (v: unknown): string[] | undefined => {
	if (isBlank(v)) return undefined;
	const list = (Array.isArray(v) ? v : String(v).split(/[,;\s]+/))
		.map((s) => String(s).trim())
		.filter(Boolean);
	return list.length ? list : undefined;
};

export interface CustomerFields {
	name?: string;
	email?: string;
	phone?: string;
	taxId?: string;
	line1?: string;
	line2?: string;
	city?: string;
	region?: string;
	postalCode?: string;
	country?: string;
}

export function customerBody(c: CustomerFields): Json {
	return compact({
		name: c.name,
		email: c.email,
		phone: c.phone,
		tax_id: c.taxId,
		address: {
			line1: c.line1,
			line2: c.line2,
			city: c.city,
			region: c.region,
			postal_code: c.postalCode,
			country: c.country,
		},
	});
}

/** The `send` part of POST /api/v1/invoices and the body of POST /api/v1/invoices/{id}/send. */
export function emailChannel(o: {
	to?: unknown;
	cc?: unknown;
	subject?: string;
	message?: string;
}): Json {
	return {
		channels: [
			compact({
				type: 'email',
				to: splitEmails(o.to),
				cc: splitEmails(o.cc),
				subject: o.subject,
				body: o.message,
			}),
		],
	};
}

export const sameEmail = (a: unknown, b: unknown) =>
	typeof a === 'string' &&
	typeof b === 'string' &&
	a.trim().toLowerCase() === b.trim().toLowerCase();

/** The API's error message and field errors from a failed request. The ASHDOCS API answers
 * {"detail": {"code", "message", "errors": [{"field", "message"}]}} (or {"detail": "text"}). Where that
 * body sits depends on the n8n version: `context.data` on the NodeApiError n8n 2.x throws,
 * `response.body` or `response.data` on older request errors, or `description`. */
export function apiErrorDetails(error: unknown): { message?: string; description?: string } {
	const e = (error ?? {}) as Json;
	const response = (e.response ?? {}) as Json;
	const context = (e.context ?? {}) as Json;
	const candidates = [context.data, response.body, response.data, e.description];
	for (const c of candidates) {
		let data = c;
		if (typeof data === 'string') {
			try {
				data = JSON.parse(data);
			} catch {
				continue;
			}
		}
		if (!data || typeof data !== 'object' || !('detail' in data)) continue;
		const detail = (data as Json).detail;
		if (typeof detail === 'string') return { message: detail };
		if (detail && typeof detail === 'object') {
			const d = detail as Json;
			const errors = Array.isArray(d.errors) ? (d.errors as Array<{ field?: unknown; message?: unknown }>) : [];
			const description = errors.length
				? errors.map((x) => (x.field ? `${String(x.field)}: ${String(x.message)}` : String(x.message))).join('; ')
				: undefined;
			const message = typeof d.message === 'string' ? d.message : undefined;
			return { ...(message ? { message } : {}), ...(description ? { description } : {}) };
		}
	}
	return {};
}

/** The ten most-used invoice fields, flattened (the node's Simplify option). */
export function simplifyInvoice(inv: Json): Json {
	const customer = (inv.customer ?? {}) as Json;
	const totals = (inv.totals ?? {}) as Json;
	return {
		id: inv.id,
		number: inv.number,
		status: inv.status,
		customer_name: customer.name,
		customer_email: customer.email,
		total: totals.total_formatted,
		balance_due: totals.balance_formatted,
		due_date: inv.due_date,
		hosted_url: inv.hosted_url,
		pdf_url: inv.pdf_url,
	};
}

/** The signed link to a generated file: `file_url` (output "url"), or `output_files[0].url` (the job
 * envelope URL to PDF returns). Local storage returns a path on the API host, so it is joined to `base`. */
export function resultFileUrl(res: Json, base: string): string | undefined {
	const files = res.output_files as Array<{ url?: unknown }> | undefined;
	const raw = res.file_url ?? (Array.isArray(files) ? files[0]?.url : undefined);
	if (typeof raw !== 'string' || !raw) return undefined;
	return raw.startsWith('/') ? `${base.replace(/\/+$/, '')}${raw}` : raw;
}

/** A webhook delivery, flattened: the event fields plus the invoice at the top level.
 * Delivered body: {"event", "data": {"event_id", "type", "occurred_at", "data": <invoice>}, "delivered_at"}. */
export function flattenEvent(body: Json): Json {
	const envelope = (body.data ?? {}) as Json;
	const nested = envelope.data;
	const invoice = (nested && typeof nested === 'object' ? nested : envelope) as Json;
	return {
		event: body.event ?? envelope.type,
		event_id: envelope.event_id,
		occurred_at: envelope.occurred_at,
		delivered_at: body.delivered_at,
		...invoice,
	};
}

/** X-ASHDOCS-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed with the subscription secret>. */
export function signatureValid(rawBody: Buffer | string, header: unknown, secret: string): boolean {
	if (typeof header !== 'string' || !header.startsWith('sha256=') || !secret) return false;
	const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
	const given = header.slice('sha256='.length);
	if (given.length !== expected.length) return false;
	return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export const INVOICE_TRIGGER_EVENTS = [
	{
		name: 'Invoice Sent',
		value: 'invoice.sent',
		description: 'An invoice was delivered to the customer',
	},
	{
		name: 'Invoice Viewed',
		value: 'invoice.viewed',
		description: 'The customer opened the hosted invoice page',
	},
	{ name: 'Invoice Paid', value: 'invoice.paid', description: 'An invoice was paid in full' },
	{
		name: 'Invoice Overdue',
		value: 'invoice.overdue',
		description: 'An invoice passed its due date with a balance left',
	},
];
