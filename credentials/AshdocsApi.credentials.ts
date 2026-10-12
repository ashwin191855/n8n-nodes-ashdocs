import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AshdocsApi implements ICredentialType {
	name = 'ashdocsApi';

	displayName = 'ASHDOCS API';

	icon: Icon = {
		light: 'file:../nodes/Ashdocs/ashdocs.svg',
		dark: 'file:../nodes/Ashdocs/ashdocs.dark.svg',
	};

	documentationUrl = 'https://www.ashdocs.com/integrations/n8n';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create a key on the API Keys page of your ASHDOCS dashboard. Test keys (ash_test_…) make watermarked test invoices and never use credits.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.ashdocs.com',
			description: 'Leave as is unless ASHDOCS support gave you a different address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/api/v1/keys/verify',
		},
	};
}
