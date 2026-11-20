import type { ServiceManifest, ServiceEndpoint } from '../types/service.js';

function quoteShellArgument(value: string): string {
  return "'" + value.replace(/'/g, "'\"'\"'") + "'";
}

/** Generate literal arguments for Bash and other POSIX-compatible shells. */
export function generateCurlSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const query = endpoint.example_request?.query;
  const url = `${service.base_url || 'https://your-host'}${endpoint.path}` +
    (query ? '?' + new URLSearchParams(query).toString() : '');
  const body = endpoint.method !== 'GET' && endpoint.example_request?.body !== undefined
    ? JSON.stringify(endpoint.example_request.body) : undefined;
  const bodyFlag = body !== undefined
    ? ` \\\n  -H "Content-Type: application/json" \\\n  -d ${quoteShellArgument(body)}` : '';
  const command = `curl --globoff -i -X ${quoteShellArgument(endpoint.method)} ${quoteShellArgument(url)}`;

  return `# 1. Step 1: Probe endpoint to trigger 402 Challenge
${command} \\
  -H "Accept: application/json"${bodyFlag}

# 2. Step 2: Sign EIP-3009 Authorization and send with PAYMENT-SIGNATURE
${command} \\
  -H "Accept: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-encoded-eip3009-authorization>"${bodyFlag}`;
}
