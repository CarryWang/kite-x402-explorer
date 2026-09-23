import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { ServiceManifest } from '../types/service.js';

export const SERVICE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://github.com/gokite-ai/kite-x402-services/schema/service.schema.json',
  title: 'Kite x402 service manifest (services/<name>/service.yaml)',
  type: 'object',
  additionalProperties: false,
  required: [
    'schema',
    'name',
    'display_name',
    'description',
    'maintainer',
    'status',
    'network',
    'pay_to',
    'upstream',
    'endpoints',
    'categories',
  ],
  properties: {
    schema: { const: 1 },
    name: {
      type: 'string',
      pattern: '^[a-z0-9][a-z0-9-]{1,63}$',
      description: 'Must equal the directory name under services/.',
    },
    display_name: {
      type: 'string',
      minLength: 2,
      maxLength: 80,
    },
    description: {
      type: 'string',
      minLength: 20,
      maxLength: 500,
    },
    maintainer: {
      type: 'object',
      additionalProperties: false,
      required: ['github'],
      properties: {
        github: {
          type: 'string',
          pattern: '^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$',
        },
        contact: {
          type: 'string',
          format: 'email',
        },
      },
    },
    status: {
      type: 'string',
      enum: ['draft', 'testnet', 'live'],
    },
    base_url: {
      type: 'string',
      pattern: '^https://[^/\\s]+$',
    },
    network: {
      type: 'string',
      enum: ['eip155:2366', 'eip155:2368'],
    },
    pay_to: {
      type: 'string',
      pattern: '^0x[0-9a-fA-F]{40}$',
    },
    upstream: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'url'],
      properties: {
        name: { type: 'string' },
        url: {
          type: 'string',
          pattern: '^https://',
        },
        requires_api_key: { type: 'boolean' },
        terms_url: {
          type: 'string',
          pattern: '^https://',
        },
      },
    },
    endpoints: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['method', 'path', 'summary', 'price_usd'],
        properties: {
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          },
          path: {
            type: 'string',
            pattern: '^/v1/[^\\s?#]*$',
          },
          summary: {
            type: 'string',
            minLength: 10,
            maxLength: 200,
          },
          price_usd: {
            type: 'string',
            pattern: '^(0|[1-9][0-9]*)(\\.[0-9]{1,6})?$',
          },
          example_request: {
            type: 'object',
            additionalProperties: false,
            properties: {
              query: { type: 'object' },
              headers: { type: 'object' },
              body: {},
            },
          },
          pitfalls: {
            type: 'array',
            items: {
              type: 'string',
              maxLength: 200,
            },
          },
        },
      },
    },
    categories: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'string',
        enum: [
          'ai',
          'data',
          'finance',
          'geo',
          'media',
          'messaging',
          'search',
          'shopping',
          'weather',
          'web',
          'other',
        ],
      },
    },
    tags: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'string',
        pattern: '^[a-z0-9-]{2,30}$',
      },
    },
    source: {
      type: 'string',
      enum: ['go-gin', 'typescript-express', 'custom'],
    },
  },
  allOf: [
    {
      if: {
        properties: {
          status: { const: 'live' },
        },
      },
      then: {
        required: ['base_url'],
        properties: {
          network: { const: 'eip155:2366' },
        },
      },
    },
    {
      if: {
        properties: {
          status: { const: 'testnet' },
        },
      },
      then: {
        required: ['base_url'],
        properties: {
          network: { const: 'eip155:2368' },
        },
      },
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvClass: any = (Ajv as any).default || Ajv;
const ajv = new AjvClass({
  allErrors: true,
  strict: false,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addFormatsFn: any = (addFormats as any).default || addFormats;
addFormatsFn(ajv);

const validateFn = ajv.compile(SERVICE_SCHEMA);

export interface ValidationResult {
  valid: boolean;
  errors: {
    path: string;
    message: string;
  }[];
}

/**
 * Validates any JSON / object against the official Kite service.schema.json
 */
export function validateServiceManifest(manifest: unknown): ValidationResult {
  const isValid = validateFn(manifest);
  if (isValid) {
    return { valid: true, errors: [] };
  }

  const errors = (validateFn.errors as ErrorObject[] || []).map((err) => ({
    path: err.instancePath || '/',
    message: `${err.message || 'invalid field'} (${JSON.stringify(err.params)})`,
  }));

  return { valid: false, errors };
}

/**
 * Helper to check whether an object is a strictly valid ServiceManifest
 */
export function isServiceManifest(manifest: unknown): manifest is ServiceManifest {
  return validateFn(manifest);
}
