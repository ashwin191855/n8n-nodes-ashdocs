// Unit tests for the pure helpers (run after `npm run build`: `npm test`).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const s = require('../dist/nodes/Ashdocs/shared.js');

test('line items keep decimals as strings and accept both naming styles', () => {
	assert.deepEqual(
		s.toLineItems([{ description: 'Design', quantity: 2, unitPrice: 150.1, taxRate: 10 }]),
		[{ description: 'Design', quantity: '2', unit_price: '150.1', tax_rate: '10' }],
	);
	assert.deepEqual(s.toLineItems([{ description: 'Hosting', unit_price: '0.10' }]), [
		{ description: 'Hosting', quantity: '1', unit_price: '0.10' },
	]);
});

test('line items JSON: string, single object, and clear errors', () => {
	assert.equal(s.parseLineItemsJson('[{"description":"A","unit_price":"5"}]').length, 1);
	assert.equal(s.parseLineItemsJson({ description: 'A', unit_price: 5 }).length, 1);
	assert.throws(() => s.parseLineItemsJson('not json'), /not valid JSON/);
	assert.throws(() => s.parseLineItemsJson('[]'), /non-empty array/);
	assert.throws(() => s.parseLineItemsJson([{ description: 'A' }]), /needs a unit price/);
	assert.throws(() => s.parseLineItemsJson([{ unit_price: 1 }]), /needs a description/);
});

test('customer body maps address fields and drops blanks', () => {
	assert.deepEqual(
		s.customerBody({ name: 'Acme', email: '', taxId: 'T1', city: 'Austin', country: 'US' }),
		{
			name: 'Acme',
			tax_id: 'T1',
			address: { city: 'Austin', country: 'US' },
		},
	);
});

test('email channel splits recipient lists', () => {
	assert.deepEqual(s.emailChannel({ cc: 'a@x.com, b@x.com', message: 'Hi' }), {
		channels: [{ type: 'email', cc: ['a@x.com', 'b@x.com'], body: 'Hi' }],
	});
});

test('webhook deliveries flatten to event fields plus the invoice', () => {
	const flat = s.flattenEvent({
		event: 'invoice.paid',
		data: {
			event_id: 'evt_1',
			type: 'invoice.paid',
			occurred_at: '2026-10-06T10:00:00Z',
			data: { id: 'inv_1', number: 'INV-0001', status: 'paid' },
		},
		delivered_at: '2026-10-06T10:00:01Z',
	});
	assert.deepEqual(flat, {
		event: 'invoice.paid',
		event_id: 'evt_1',
		occurred_at: '2026-10-06T10:00:00Z',
		delivered_at: '2026-10-06T10:00:01Z',
		id: 'inv_1',
		number: 'INV-0001',
		status: 'paid',
	});
});

test('signature check matches the backend scheme', () => {
	const body = '{"event":"invoice.paid"}';
	const sig = 'sha256=' + createHmac('sha256', 'whsec_x').update(body).digest('hex');
	assert.equal(s.signatureValid(body, sig, 'whsec_x'), true);
	assert.equal(s.signatureValid(body, sig, 'whsec_y'), false);
	assert.equal(s.signatureValid(body, undefined, 'whsec_x'), false);
	assert.equal(s.signatureValid(body, 'sha256=abc', 'whsec_x'), false);
});

test('simplify keeps ten flat invoice fields', () => {
	const simple = s.simplifyInvoice({
		id: 'inv_1',
		number: 'INV-0042',
		status: 'sent',
		currency: 'USD',
		due_date: '2026-10-21',
		customer: { name: 'Globex LLC', email: 'billing@globex.example', address: { city: 'SF' } },
		totals: { total_formatted: '$355.00', balance_formatted: '$355.00', total_minor: 35500 },
		hosted_url: 'https://api.ashdocs.com/i/abc',
		pdf_url: 'https://api.ashdocs.com/api/v1/invoices/inv_1/pdf',
		line_items: [{ description: 'Design' }],
	});
	assert.deepEqual(simple, {
		id: 'inv_1',
		number: 'INV-0042',
		status: 'sent',
		customer_name: 'Globex LLC',
		customer_email: 'billing@globex.example',
		total: '$355.00',
		balance_due: '$355.00',
		due_date: '2026-10-21',
		hosted_url: 'https://api.ashdocs.com/i/abc',
		pdf_url: 'https://api.ashdocs.com/api/v1/invoices/inv_1/pdf',
	});
	assert.equal(Object.keys(simple).length, 10);
});

test('file links: file_url, URL-to-PDF job envelope, and local storage paths', () => {
	const base = 'https://api.ashdocs.com/';
	assert.equal(
		s.resultFileUrl({ file_url: 'https://r2.example/out.pdf?sig=a' }, base),
		'https://r2.example/out.pdf?sig=a',
	);
	assert.equal(
		s.resultFileUrl(
			{
				job_id: 'job_url',
				status: 'completed',
				output_files: [{ filename: 'output.pdf', url: 'https://r2.example/web.pdf' }],
			},
			base,
		),
		'https://r2.example/web.pdf',
	);
	assert.equal(
		s.resultFileUrl({ file_url: '/api/files/user_1/job_red/output.pdf?exp=1&sig=x' }, base),
		'https://api.ashdocs.com/api/files/user_1/job_red/output.pdf?exp=1&sig=x',
	);
	assert.equal(s.resultFileUrl({ job_id: 'job_x' }, base), undefined);
});

test('API error details: n8n 2.x NodeApiError context, older response bodies, plain detail', () => {
	const body = {
		detail: {
			code: 'validation_failed',
			message: 'The request failed validation.',
			errors: [{ field: 'line_items.0.unit_price', message: 'Input should be a valid decimal' }],
		},
	};
	const want = {
		message: 'The request failed validation.',
		description: 'line_items.0.unit_price: Input should be a valid decimal',
	};
	// n8n 2.x: httpRequestWithAuthentication throws a NodeApiError with the body in context.data.
	assert.deepEqual(s.apiErrorDetails({ message: 'Your request is invalid', context: { data: body } }), want);
	// Older request errors.
	assert.deepEqual(s.apiErrorDetails({ response: { body } }), want);
	assert.deepEqual(s.apiErrorDetails({ response: { data: body } }), want);
	assert.deepEqual(s.apiErrorDetails({ description: JSON.stringify(body) }), want);
	assert.deepEqual(s.apiErrorDetails({ context: { data: { detail: 'Invoice not found.' } } }), {
		message: 'Invoice not found.',
	});
	assert.deepEqual(s.apiErrorDetails({ context: { data: { detail: { message: 'Only a draft can be deleted.' } } } }), {
		message: 'Only a draft can be deleted.',
	});
	assert.deepEqual(s.apiErrorDetails(new Error('socket hang up')), {});
	assert.deepEqual(s.apiErrorDetails(undefined), {});
});
