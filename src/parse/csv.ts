// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode CSV metadata parser
 *
 * ProofMode v1 outputs metadata as CSV with key-value pairs.
 */

import type { ProofModeMetadata, ProofModeSignals } from '../types';
import { extractSignals } from './signals';

/**
 * Parse ProofMode CSV metadata.
 *
 * Format is typically:
 * ```
 * key,value
 * Location.Latitude,40.7484
 * Location.Longitude,-73.9857
 * ...
 * ```
 *
 * Some bundles use colon-separated or tab-separated formats.
 */
export function parseCSV(csvText: string): ProofModeMetadata {
  const raw: Record<string, string> = {};
  const lines = csvText.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Try comma, then colon, then tab
    let key: string;
    let value: string;

    const commaIdx = trimmed.indexOf(',');
    const colonIdx = trimmed.indexOf(':');
    const tabIdx = trimmed.indexOf('\t');

    if (commaIdx > 0) {
      key = trimmed.substring(0, commaIdx).trim();
      value = trimmed.substring(commaIdx + 1).trim();
    } else if (tabIdx > 0) {
      key = trimmed.substring(0, tabIdx).trim();
      value = trimmed.substring(tabIdx + 1).trim();
    } else if (colonIdx > 0) {
      key = trimmed.substring(0, colonIdx).trim();
      value = trimmed.substring(colonIdx + 1).trim();
    } else {
      continue;
    }

    // Strip quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Skip header row
    if (key.toLowerCase() === 'key' && value.toLowerCase() === 'value') continue;

    raw[key] = value;
  }

  const signals = extractSignals(raw);
  return { signals, format: 'csv', fileHash: raw['FileHash'] || raw['File.Hash'] };
}
