import type { ServiceManifest, ServiceEndpoint } from '../types/service.js';
import { exampleRequest } from './client-snippets.js';

function quoteShellArgument(value: string): string {
  return "'" + value.replace(/'/g, "'\"'\"'") + "'";
}

/** Generate literal arguments for Bash and other POSIX-compatible shells. */
export function generateCurlSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const query = endpoint.example_request?.query;
  const url = `${service.base_url || 'https://your-host'}${endpoint.path}` +
    (query ? '?' + new URLSearchParams(query).toString() : '');
  const { headers, body } = exampleRequest(endpoint);
  const requestFlags = [
    ...headers.map(([k, v]) => ` \\\n  -H ${quoteShellArgument(`${k}: ${v}`)}`),
    ...(body !== undefined ? [` \\\n  -d ${quoteShellArgument(body)}`] : []),
  ].join('');
  const command = `curl --globoff -i -X ${quoteShellArgument(endpoint.method)} ${quoteShellArgument(url)}`;

  return `# 1. Step 1: Probe endpoint to trigger 402 Challenge
${command} \\
  -H "Accept: application/json"${requestFlags}

# 2. Step 2: Sign EIP-3009 Authorization and send with PAYMENT-SIGNATURE
${command} \\
  -H "Accept: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-encoded-eip3009-authorization>"${requestFlags}`;
}
