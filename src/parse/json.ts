// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode JSON metadata parser
 *
 * ProofMode v1 can output metadata as JSON.
 */

import type { ProofModeMetadata } from '../types';
import { extractSignals } from './signals';

/**
 * Parse ProofMode JSON metadata.
 */
export function parseJSON(jsonText: string): ProofModeMetadata {
  const parsed = JSON.parse(jsonText);

  // ProofMode JSON can be a flat object or nested
  const raw: Record<string, string> = {};

  if (typeof parsed === 'object' && parsed !== null) {
    flattenObject(parsed, '', raw);
  }

  const signals = extractSignals(raw);
  return { signals, format: 'json', fileHash: raw['FileHash'] || raw['File.Hash'] };
}

/**
 * Flatten a nested object into dot-separated key-value pairs.
 */
function flattenObject(obj: Record<string, unknown>, prefix: string, result: Record<string, string>): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      flattenObject(value as Record<string, unknown>, fullKey, result);
    } else {
      result[fullKey] = String(value);
    }
  }
}
