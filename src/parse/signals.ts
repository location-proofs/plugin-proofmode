// Copyright © 2026 Sophia Systems Corporation

/**
 * Signal field extraction and typing
 *
 * Takes raw key-value pairs from CSV/JSON and produces typed ProofModeSignals.
 */

import type { ProofModeSignals } from '../types';

/** Fields that should be parsed as numbers. */
const NUMERIC_FIELDS = new Set([
  'Location.Latitude',
  'Location.Longitude',
  'Location.Accuracy',
  'Location.Altitude',
  'Location.Bearing',
  'Location.Speed',
  'Location.Time',
  'File.Size',
  'Timestamp',
]);

/**
 * Known field name aliases — normalizes variant names to canonical form.
 */
const ALIASES: Record<string, string> = {
  'location.latitude': 'Location.Latitude',
  'location.longitude': 'Location.Longitude',
  'location.provider': 'Location.Provider',
  'location.accuracy': 'Location.Accuracy',
  'location.altitude': 'Location.Altitude',
  'location.bearing': 'Location.Bearing',
  'location.speed': 'Location.Speed',
  'location.time': 'Location.Time',
  latitude: 'Location.Latitude',
  longitude: 'Location.Longitude',
  accuracy: 'Location.Accuracy',
  altitude: 'Location.Altitude',
  bearing: 'Location.Bearing',
  speed: 'Location.Speed',
  provider: 'Location.Provider',
  cellinfo: 'CellInfo',
  'wifi.mac': 'WiFi.MAC',
  'wifi mac': 'WiFi.MAC',
  wifimac: 'WiFi.MAC',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  network: 'Network',
  deviceid: 'DeviceID',
  'deviceid vendor': 'DeviceID.Vendor',
  'deviceid.vendor': 'DeviceID.Vendor',
  hardware: 'Hardware',
  manufacturer: 'Manufacturer',
  model: 'Model',
  proofhash: 'ProofHash',
  filehash: 'FileHash',
  'file.hash': 'FileHash',
  'file hash sha256': 'FileHash',
  mimetype: 'MimeType',
  'file.name': 'File.Name',
  filename: 'File.Name',
  'file path': 'File.Path',
  'file.path': 'File.Path',
  'file.size': 'File.Size',
  filesize: 'File.Size',
  'file modified': 'File.Modified',
  'file.modified': 'File.Modified',
  datecreated: 'DateCreated',
  timestamp: 'Timestamp',
  'proof generated': 'ProofGenerated',
  proofgenerated: 'ProofGenerated',

  // 2016-era ProofMode field names (sample-proof-1 format)
  currentdatetime0gmt: 'Timestamp',
  sha256: 'FileHash',
  file: 'File.Name',
  modified: 'File.Modified',
  language: 'Language',
  locale: 'Locale',
  datatype: 'DataType',
  networktype: 'Network',
  screensize: 'ScreenSize',
};

/**
 * Extract typed ProofMode signals from raw key-value pairs.
 */
export function extractSignals(raw: Record<string, string>): ProofModeSignals {
  const signals: ProofModeSignals = {};

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    // Normalize key
    const canonical = ALIASES[rawKey.toLowerCase()] || rawKey;
    const value = rawValue.trim();

    if (!value) continue;

    // Type conversion
    if (NUMERIC_FIELDS.has(canonical)) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        signals[canonical] = num;
      } else {
        signals[canonical] = value;
      }
    } else {
      signals[canonical] = value;
    }
  }

  return signals;
}
