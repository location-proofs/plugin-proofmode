// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode CSV metadata parser
 *
 * Handles two CSV formats:
 * 1. Vertical key-value: each row is "key,value" (synthetic / older bundles)
 * 2. Horizontal header+data: first row is headers, second row is values
 *    (real ProofMode Android/iOS output from writeMapToCSV)
 */

import type { ProofModeMetadata } from '../types';
import { extractSignals } from './signals';

/**
 * Split a CSV line on commas, respecting that ProofMode replaces commas
 * inside values with spaces (MediaWatcher.java:186). Trailing commas
 * produce an empty final element which we drop.
 */
function splitCSVLine(line: string): string[] {
  const parts = line.split(',');
  // Drop trailing empty element from trailing comma
  if (parts.length > 0 && parts[parts.length - 1].trim() === '') {
    parts.pop();
  }
  return parts.map(p => p.trim());
}

/**
 * Detect whether the CSV uses horizontal (header+data) format.
 *
 * Heuristic: if the first non-empty/non-comment line has more than 2
 * comma-separated fields and the next non-empty line has a similar count,
 * it's horizontal. Vertical format has exactly 2 fields per line.
 */
function isHorizontalFormat(lines: string[]): boolean {
  const nonEmpty = lines
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  if (nonEmpty.length < 2) return false;

  const headerCount = splitCSVLine(nonEmpty[0]).length;
  const dataCount = splitCSVLine(nonEmpty[1]).length;

  // Vertical format: exactly 2 columns ("key,value" or "Field,40.7")
  // Horizontal format: many columns with similar counts on both rows
  return headerCount > 2 && dataCount > 2;
}

function parseHorizontal(lines: string[]): Record<string, string> {
  const nonEmpty = lines
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  if (nonEmpty.length < 2) return {};

  const headers = splitCSVLine(nonEmpty[0]);
  const raw: Record<string, string> = {};

  // Zip each data row with headers (usually just one data row)
  for (let row = 1; row < nonEmpty.length; row++) {
    const values = splitCSVLine(nonEmpty[row]);
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      const value = values[i] ?? '';
      if (key && value) {
        raw[key] = value;
      }
    }
  }

  return raw;
}

function parseVertical(lines: string[]): Record<string, string> {
  const raw: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    let key: string;
    let value: string;

    const commaIdx = trimmed.indexOf(',');
    const tabIdx = trimmed.indexOf('\t');
    const colonIdx = trimmed.indexOf(':');

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

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Skip header row
    if (key.toLowerCase() === 'key' && value.toLowerCase() === 'value') continue;

    raw[key] = value;
  }

  return raw;
}

/**
 * Parse ProofMode CSV metadata.
 *
 * Supports both vertical key-value format and horizontal header+data format.
 */
export function parseCSV(csvText: string): ProofModeMetadata {
  const lines = csvText.trim().split('\n');

  const raw = isHorizontalFormat(lines)
    ? parseHorizontal(lines)
    : parseVertical(lines);

  const signals = extractSignals(raw);
  return { signals, format: 'csv', fileHash: raw['FileHash'] || raw['File.Hash'] };
}
