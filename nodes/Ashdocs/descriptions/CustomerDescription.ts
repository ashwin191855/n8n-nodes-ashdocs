import type { INodeProperties } from 'n8n-workflow';

import { customerAddressFields } from './InvoiceDescription';

const show = (operation: string[]) => ({ show: { resource: ['customer'], operation } });

export const customerOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customer'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a customer',
				description: 'Save a customer for reuse on invoices',
			},
			{
				name: 'Find by Email',
				value: 'find',
				action: 'Find a customer by email',
				description: 'Find a saved customer by email address',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a customer',
				description: 'Get a saved customer by ID',
			},
		],
		default: 'create',
	},
];

export const customerFields: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Acme Inc',
		displayOptions: show(['create']),
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description: 'One customer per email address',
		displayOptions: show(['create']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: customerAddressFields,
	},
	{
		displayName: 'If Email Already Exists',
		name: 'onDuplicate',
		type: 'options',
		options: [
			{ name: 'Return the Existing Customer', value: 'existing' },
			{ name: 'Fail', value: 'error' },
		],
		default: 'existing',
		displayOptions: show(['create']),
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		required: true,
		placeholder: 'name@email.com',
		default: '',
		description:
			'Matched exactly, ignoring upper and lower case. Returns nothing when no customer has this email.',
		displayOptions: show(['find']),
	},
	{
		displayName: 'Customer ID',
		name: 'customerId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. cus_6d2eda71796e4e88b5d3',
		displayOptions: show(['get']),
	},
];
