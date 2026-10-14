import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { apiErrorDetails } from './shared';

type Ctx = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

export async function baseUrl(this: Ctx): Promise<string> {
	const creds = await this.getCredentials('ashdocsApi');
	return String(creds.baseUrl || 'https://api.ashdocs.com').replace(/\/+$/, '');
}

/** One call to the ASHDOCS API. Errors come back as {detail: {code, message, errors[]}}; the message
 * (with any field errors) becomes the n8n error so users see what to fix. */
export async function ashdocsRequest(
	this: Ctx,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
	headers?: IDataObject,
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${await baseUrl.call(this)}${path}`,
		json: true,
		headers: { 'User-Agent': 'n8n-nodes-ashdocs', ...(headers ?? {}) },
	};
	if (body !== undefined) options.body = body;
	if (qs !== undefined) options.qs = qs;
	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'ashdocsApi',
			options,
		)) as IDataObject;
	} catch (error) {
		const { message, description } = apiErrorDetails(error);
		// n8n 2.x already throws a NodeApiError here, and wrapping one in a new NodeApiError hands back
		// the original unchanged (options ignored), so set the API's message on it first.
		if (error instanceof NodeApiError) {
			if (message) error.message = message;
			if (description) error.description = description;
			throw new NodeApiError(this.getNode(), error as unknown as JsonObject);
		}
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			...(message ? { message } : {}),
			...(description ? { description } : {}),
		});
	}
}
