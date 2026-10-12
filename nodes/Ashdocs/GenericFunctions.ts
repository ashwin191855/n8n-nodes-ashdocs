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
		const response = (error as JsonObject).response as JsonObject | undefined;
		const data = (response?.body ?? (error as JsonObject).description) as JsonObject | undefined;
		const detail = (data && typeof data === 'object' ? data.detail : undefined) as
			| JsonObject
			| string
			| undefined;
		let message: string | undefined;
		let description: string | undefined;
		if (detail && typeof detail === 'object') {
			message = detail.message as string | undefined;
			const errors = detail.errors as Array<{ field?: string; message?: string }> | undefined;
			if (Array.isArray(errors) && errors.length) {
				description = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
			}
		} else if (typeof detail === 'string') {
			message = detail;
		}
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			...(message ? { message } : {}),
			...(description ? { description } : {}),
		});
	}
}
