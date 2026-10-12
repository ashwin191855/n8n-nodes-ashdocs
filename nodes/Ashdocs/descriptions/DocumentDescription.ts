import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ show: { resource: ['document'], operation } });

export const documentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['document'] } },
		options: [
			{
				name: 'Generate PDF',
				value: 'generatePdf',
				action: 'Generate a PDF',
				description: 'Turn HTML or a web page into a PDF',
			},
			{
				name: 'Redact',
				value: 'redact',
				action: 'Redact a document',
				description: 'Black out emails, card numbers and other sensitive text in a PDF',
			},
		],
		default: 'generatePdf',
	},
];

const downloadField = (operation: string): INodeProperties[] => [
	{
		displayName: 'Download File',
		name: 'download',
		type: 'boolean',
		default: false,
		description:
			'Whether to add the PDF to the item as binary data, as well as returning its link (which expires in 60 minutes)',
		displayOptions: show([operation]),
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		hint: 'The name of the output binary field to put the file in',
		displayOptions: { show: { resource: ['document'], operation: [operation], download: [true] } },
	},
];

export const documentFields: INodeProperties[] = [
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		options: [
			{ name: 'HTML', value: 'html' },
			{ name: 'Web Page URL', value: 'url' },
		],
		default: 'html',
		displayOptions: show(['generatePdf']),
	},
	{
		displayName: 'HTML',
		name: 'html',
		type: 'string',
		typeOptions: { rows: 8 },
		required: true,
		default: '',
		placeholder: 'e.g. <h1>Hello</h1>',
		description: 'The HTML document to render. Map fields from earlier nodes into it.',
		displayOptions: {
			show: { resource: ['document'], operation: ['generatePdf'], source: ['html'] },
		},
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com/report',
		description: 'A public web page to print to PDF',
		displayOptions: {
			show: { resource: ['document'], operation: ['generatePdf'], source: ['url'] },
		},
	},
	{
		displayName: 'Page Size',
		name: 'format',
		type: 'options',
		options: [
			{ name: 'A4', value: 'A4' },
			{ name: 'Letter', value: 'Letter' },
		],
		default: 'Letter',
		displayOptions: {
			show: { resource: ['document'], operation: ['generatePdf'], source: ['html'] },
		},
	},
	...downloadField('generatePdf'),
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com/statement.pdf',
		description: 'A public link to the PDF to redact',
		displayOptions: show(['redact']),
	},
	{
		displayName: 'Redact',
		name: 'types',
		type: 'multiOptions',
		options: [
			{ name: 'Credit Card Numbers', value: 'credit_card' },
			{ name: 'Dates', value: 'date' },
			{ name: 'Email Addresses', value: 'email' },
			{ name: 'IBANs', value: 'iban' },
			{ name: 'Phone Numbers', value: 'phone' },
			{ name: 'US Social Security Numbers', value: 'ssn' },
		],
		default: ['email', 'ssn', 'credit_card'],
		displayOptions: show(['redact']),
	},
	...downloadField('redact'),
];
