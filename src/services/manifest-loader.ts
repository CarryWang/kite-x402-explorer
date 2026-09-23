import yaml from 'js-yaml';
import type { ServiceManifest } from '../types/service.js';
import { validateServiceManifest, type ValidationResult } from './schema-validator.js';

export interface ParseManifestResult {
  success: boolean;
  manifest?: ServiceManifest;
  validation?: ValidationResult;
  error?: string;
}

/**
 * Parses raw YAML or JSON string and validates it against the official schema.
 */
export function parseAndValidateManifest(rawText: string): ParseManifestResult {
  try {
    const parsed = yaml.load(rawText);
    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        error: 'YAML did not evaluate to a valid object',
      };
    }

    const validation = validateServiceManifest(parsed);
    if (!validation.valid) {
      return {
        success: false,
        validation,
        error: `Schema validation failed: ${validation.errors.map((e) => `${e.path}: ${e.message}`).join(', ')}`,
      };
    }

    return {
      success: true,
      manifest: parsed as ServiceManifest,
      validation,
    };
  } catch (err) {
    return {
      success: false,
      error: `YAML parse error: ${String(err)}`,
    };
  }
}

/**
 * Converts a ServiceManifest object back to formatted YAML.
 */
export function dumpManifestToYaml(manifest: ServiceManifest): string {
  return yaml.dump(manifest, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });
}
