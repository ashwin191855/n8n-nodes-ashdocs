import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ show: { resource: ['invoice'], operation } });

export const invoiceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['invoice'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an invoice',
				description: 'Create an invoice, number it, and optionally email it to the customer',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an invoice',
				description: 'Get an invoice by ID or number',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many invoices',
				description: 'List invoices, filtered by status, customer email or date',
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send an invoice',
				description: 'Email an issued invoice to the customer',
			},
		],
		default: 'create',
	},
];

const dueTerms = [
	{ name: 'Due on Receipt', value: 'on_receipt' },
	{ name: 'Net 7', value: 'net_7' },
	{ name: 'Net 15', value: 'net_15' },
	{ name: 'Net 30', value: 'net_30' },
	{ name: 'Net 45', value: 'net_45' },
	{ name: 'Net 60', value: 'net_60' },
];

const statuses = [
	{ name: 'Draft', value: 'draft' },
	{ name: 'Issued', value: 'issued' },
	{ name: 'Overdue', value: 'overdue' },
	{ name: 'Paid', value: 'paid' },
	{ name: 'Partially Paid', value: 'partially_paid' },
	{ name: 'Sent', value: 'sent' },
	{ name: 'Viewed', value: 'viewed' },
	{ name: 'Void', value: 'void' },
];

export const customerAddressFields: INodeProperties[] = [
	{ displayName: 'Address Line 1', name: 'line1', type: 'string', default: '' },
	{ displayName: 'Address Line 2', name: 'line2', type: 'string', default: '' },
	{ displayName: 'City', name: 'city', type: 'string', default: '' },
	{
		displayName: 'Country',
		name: 'country',
		type: 'string',
		default: '',
		placeholder: 'e.g. US',
		description: 'Two-letter country code',
	},
	{
		displayName: 'Customer Phone (Optional, Needed for SMS Reminders)',
		name: 'phone',
		type: 'string',
		default: '',
		placeholder: 'e.g. +919876543210',
		description: 'International format with the country code, for example +919876543210',
	},
	{ displayName: 'Postal Code', name: 'postalCode', type: 'string', default: '' },
	{ displayName: 'State / Region', name: 'region', type: 'string', default: '' },
	{
		displayName: 'Tax ID',
		name: 'taxId',
		type: 'string',
		default: '',
		description: 'The customer’s VAT, GST or other tax number, printed on the invoice',
	},
];

export const invoiceFields: INodeProperties[] = [
	// ----------------------------------------------------------------- create
	{
		displayName: 'Customer',
		name: 'customerType',
		type: 'options',
		displayOptions: show(['create']),
		options: [
			{ name: 'Enter Customer Details', value: 'details' },
			{ name: 'Use a Saved Customer ID', value: 'id' },
		],
		default: 'details',
	},
	{
		displayName: 'Customer Name',
		name: 'customerName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Acme Inc',
		displayOptions: {
			show: { resource: ['invoice'], operation: ['create'], customerType: ['details'] },
		},
	},
	{
		displayName: 'Customer Email',
		name: 'customerEmail',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description: 'Where the invoice is emailed. Needed when Email to Customer is on.',
		displayOptions: {
			show: { resource: ['invoice'], operation: ['create'], customerType: ['details'] },
		},
	},
	{
		displayName: 'Customer Phone (Optional, Needed for SMS Reminders)',
		name: 'customerPhone',
		type: 'string',
		default: '',
		placeholder: 'e.g. +919876543210',
		description: 'International format with the country code, for example +919876543210',
		displayOptions: {
			show: { resource: ['invoice'], operation: ['create'], customerType: ['details'] },
		},
	},
	{
		displayName: 'Customer ID',
		name: 'customerId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. cus_6d2eda71796e4e88b5d3',
		description: 'The ID of a saved customer (from Customer → Create or Find by Email)',
		displayOptions: {
			show: { resource: ['invoice'], operation: ['create'], customerType: ['id'] },
		},
	},
	{
		displayName: 'Customer Details',
		name: 'customerDetails',
		type: 'collection',
		placeholder: 'Add Detail',
		default: {},
		displayOptions: {
			show: { resource: ['invoice'], operation: ['create'], customerType: ['details'] },
		},
		// Phone is its own field above (Customer Phone), so it is left out of this collection.
		options: customerAddressFields.filter((f) => f.name !== 'phone'),
	},
	{
		displayName: 'Line Items Input',
		name: 'lineItemsInput',
		type: 'options',
		displayOptions: show(['create']),
		options: [
			{
				name: 'Define Below',
				value: 'fields',
				description: 'Add each line item in the fields below',
			},
			{
				name: 'Using JSON',
				value: 'json',
				description:
					'Map an array of line items from a previous node (for example, rows aggregated from a sheet)',
			},
		],
		default: 'fields',
	},
	{
		displayName: 'Line Items',
		name: 'lineItems',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, sortable: true },
		placeholder: 'Add Line Item',
		default: {},
		displayOptions: {
			show: { resource: ['invoice'], operation: ['create'], lineItemsInput: ['fields'] },
		},
		options: [
			{
				displayName: 'Line Item',
				name: 'item',
				values: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						placeholder: 'e.g. Website design',
						required: true,
					},
					{
						displayName: 'Quantity',
						name: 'quantity',
						type: 'number',
						default: 1,
					},
					{
						displayName: 'Tax Rate (%)',
						name: 'taxRate',
						type: 'number',
						default: 0,
						description: 'Leave at 0 for no tax on this line',
					},
					{
						displayName: 'Unit',
						name: 'unit',
						type: 'string',
						default: '',
						placeholder: 'e.g. hours',
					},
					{
						displayName: 'Unit Price',
						name: 'unitPrice',
						type: 'number',
						default: 0,
						description:
							'Price of one unit, before tax, in the invoice currency (150.00, not 15000)',
					},
				],
			},
		],
	},
	{
		displayName: 'Line Items (JSON)',
		name: 'lineItemsJson',
		type: 'json',
		default:
			'[\n  {"description": "Website design", "quantity": 2, "unit_price": "150.00", "tax_rate": "10"}\n]',
		required: true,
		description:
			'An array of line items. Each needs description and unit_price; quantity (default 1), tax_rate (%) and unit are optional.',
		displayOptions: {
			show: { resource: ['invoice'], operation: ['create'], lineItemsInput: ['json'] },
		},
	},
	{
		displayName: 'Issue Invoice',
		name: 'issue',
		type: 'boolean',
		default: true,
		description:
			'Whether to number the invoice and create its PDF and payment page now (1 credit; free with a test key). Off saves a draft.',
		displayOptions: show(['create']),
	},
	{
		displayName: 'Email to Customer',
		name: 'send',
		type: 'boolean',
		default: false,
		description: 'Whether to email the invoice to the customer as soon as it is issued',
		displayOptions: { show: { resource: ['invoice'], operation: ['create'], issue: [true] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: [
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'string',
				default: '',
				placeholder: 'e.g. USD',
				description:
					'Three-letter currency code. Defaults to the currency in your invoicing settings.',
			},
			{
				displayName: 'Document Type',
				name: 'kind',
				type: 'options',
				options: [
					{ name: 'Invoice', value: 'invoice' },
					{ name: 'Quote', value: 'quote' },
				],
				default: 'invoice',
			},
			{
				displayName: 'Due Date',
				name: 'dueDate',
				type: 'dateTime',
				default: '',
				description: 'Overrides Due Terms',
			},
			{
				displayName: 'Due Terms',
				name: 'dueTerms',
				type: 'options',
				options: dueTerms,
				default: 'net_30',
				description: 'When payment is due, counted from the issue date',
			},
			{
				displayName: 'Email CC',
				name: 'emailCc',
				type: 'string',
				default: '',
				placeholder: 'e.g. accounts@example.com',
				description: 'Comma-separated addresses copied on the email (when Email to Customer is on)',
			},
			{
				displayName: 'Email Message',
				name: 'emailMessage',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Replaces the default email text (when Email to Customer is on)',
			},
			{
				displayName: 'Email Subject',
				name: 'emailSubject',
				type: 'string',
				default: '',
				description: 'Replaces the default subject (when Email to Customer is on)',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'A unique value (for example, the source row ID). Retrying with the same key returns the first invoice instead of creating a duplicate.',
			},
			{
				displayName: 'Issue Date',
				name: 'issueDate',
				type: 'dateTime',
				default: '',
				description: 'Defaults to today',
			},
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Shown on the invoice, for example a thank-you note',
			},
			{
				displayName: 'PO Number',
				name: 'poNumber',
				type: 'string',
				default: '',
				description: 'The customer’s purchase order number',
			},
			{
				displayName: 'Reference',
				name: 'reference',
				type: 'string',
				default: '',
				description: 'Your own reference, such as a project or order ID',
			},
			{
				displayName: 'Template Name or ID',
				name: 'template',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getTemplates' },
				default: '',
				description:
					'The invoice design. Defaults to the design in your invoicing settings. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Terms',
				name: 'terms',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Payment terms printed on the invoice',
			},
		],
	},

	// ---------------------------------------------------------- send / get
	{
		displayName: 'Invoice ID',
		name: 'invoiceId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. inv_8b9457fd6f9347ca8d17',
		displayOptions: show(['send']),
	},
	{
		displayName: 'Options',
		name: 'sendOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['send']),
		options: [
			{
				displayName: 'CC',
				name: 'cc',
				type: 'string',
				default: '',
				description: 'Comma-separated addresses copied on the email',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Replaces the default email text',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				description: 'Replaces the default subject',
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				default: '',
				description: 'Comma-separated recipients. Defaults to the customer’s email.',
			},
		],
	},
	{
		displayName: 'Get By',
		name: 'getBy',
		type: 'options',
		displayOptions: show(['get']),
		options: [
			{ name: 'Invoice ID', value: 'id' },
			{ name: 'Invoice Number', value: 'number' },
		],
		default: 'id',
	},
	{
		displayName: 'Invoice ID',
		name: 'invoiceId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. inv_8b9457fd6f9347ca8d17',
		displayOptions: { show: { resource: ['invoice'], operation: ['get'], getBy: ['id'] } },
	},
	{
		displayName: 'Invoice Number',
		name: 'invoiceNumber',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. INV-0042',
		displayOptions: { show: { resource: ['invoice'], operation: ['get'], getBy: ['number'] } },
	},
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		description: 'Whether to return a simplified version of the response instead of the raw data',
		displayOptions: show(['get', 'getAll']),
	},

	// ----------------------------------------------------------------- getAll
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: show(['getAll']),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['invoice'], operation: ['getAll'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			{
				displayName: 'Customer Email',
				name: 'customerEmail',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'Only invoices for the saved customer with this email',
			},
			{ displayName: 'Due After', name: 'dueAfter', type: 'dateTime', default: '' },
			{ displayName: 'Due Before', name: 'dueBefore', type: 'dateTime', default: '' },
			{ displayName: 'Issued After', name: 'issuedAfter', type: 'dateTime', default: '' },
			{ displayName: 'Issued Before', name: 'issuedBefore', type: 'dateTime', default: '' },
			{
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Matches the invoice number, customer name, reference or PO number',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: statuses,
				default: 'sent',
			},
		],
	},
];
