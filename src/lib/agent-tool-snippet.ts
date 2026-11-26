import type { ServiceManifest, ServiceEndpoint } from '../types/service.js';
import { snippetContext } from './client-snippets.js';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The tool arguments go in the request body for POST/PUT/PATCH endpoints whose
 * example body is a JSON object, and in the query string otherwise.
 */
function argumentShape(endpoint: ServiceEndpoint): { keys: string[]; inBody: boolean } {
  const body = endpoint.example_request?.body;
  if (BODY_METHODS.has(endpoint.method.toUpperCase()) && isPlainObject(body)) {
    return { keys: Object.keys(body), inBody: true };
  }
  return { keys: Object.keys(endpoint.example_request?.query ?? {}), inBody: false };
}

/**
 * A self-contained agent tool definition. execute() calls the endpoint and,
 * on HTTP 402, returns the decoded PAYMENT-REQUIRED terms. Like the other
 * generated snippets it never signs or pays.
 */
export function buildAgentToolSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const { fullUrl, tokenSymbol } = snippetContext(service, endpoint);
  const { keys, inBody } = argumentShape(endpoint);
  const method = endpoint.method.toUpperCase();
  const properties = keys.length
    ? `{\n${keys.map((k) => `      ${JSON.stringify(k)}: { type: "string" },`).join('\n')}\n    }`
    : '{}';
  const request = inBody
    ? `  const res = await fetch(${JSON.stringify(fullUrl)}, {
    method: "${method}",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    redirect: "error",
  });`
    : `  const url = new URL(${JSON.stringify(fullUrl)});
  for (const [key, value] of Object.entries(args)) url.searchParams.set(key, String(value));
  const res = await fetch(url, { method: "${method}", redirect: "error" });`;

  return `// Agent tool definition (OpenAI / LangChain function-calling shape).
// execute() does not sign or pay. On HTTP 402 it returns the decoded x402 terms;
// approve them in your own wallet code, then retry with a PAYMENT-SIGNATURE header.
function decodePaymentRequired(header: string): unknown {
  const bytes = Uint8Array.from(atob(header.trim()), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const kite${service.name.replace(/[^a-zA-Z0-9]/g, '')}Tool = {
  name: ${JSON.stringify(service.name.replace(/-/g, '_'))},
  description: ${JSON.stringify(`${service.description} Listed price: $${endpoint.price_usd} (${tokenSymbol}).`)},
  parameters: {
    type: "object",
    properties: ${properties},
    additionalProperties: false,
  },
  execute: async (args: Record<string, string>) => {
${request.replace(/^/gm, '  ')}
    if (res.status === 402) {
      const header = res.headers.get("PAYMENT-REQUIRED");
      if (!header) return { status: 402, error: "402 response without a PAYMENT-REQUIRED header" };
      try {
        return { status: 402, paymentRequired: decodePaymentRequired(header) };
      } catch {
        return { status: 402, error: "PAYMENT-REQUIRED header is not base64 JSON", raw: header };
      }
    }
    return { status: res.status, body: await res.text() };
  },
};`;
}
