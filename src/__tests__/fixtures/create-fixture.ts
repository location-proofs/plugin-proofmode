// Copyright © 2026 Sophia Systems Corporation

/**
 * Creates synthetic ProofMode proof bundle fixtures for testing.
 * Not a test file — run with ts-node to generate fixtures.
 */

import { zipSync } from 'fflate';

const encoder = new TextEncoder();

/**
 * Create a minimal synthetic ProofMode proof bundle (CSV format).
 */
export function createSyntheticBundle(options: {
  lat?: number;
  lon?: number;
  accuracy?: number;
  provider?: string;
  timestamp?: number;
  includePublicKey?: boolean;
  includeSafetyNet?: boolean;
  includeOTS?: boolean;
} = {}): Uint8Array {
  const lat = options.lat ?? 40.7484;
  const lon = options.lon ?? -73.9857;
  const accuracy = options.accuracy ?? 10;
  const provider = options.provider ?? 'gps';
  const timestamp = options.timestamp ?? 1700000000000; // ms
  const fileHash = 'a'.repeat(64);

  // CSV metadata
  const csv = [
    'key,value',
    `Location.Latitude,${lat}`,
    `Location.Longitude,${lon}`,
    `Location.Accuracy,${accuracy}`,
    `Location.Provider,${provider}`,
    `Location.Altitude,50`,
    `Location.Bearing,180`,
    `Location.Speed,0`,
    `Location.Time,${timestamp}`,
    `CellInfo,310:260:12345:67890`,
    `WiFi.MAC,AA:BB:CC:DD:EE:FF`,
    `IPv4,192.168.1.1`,
    `Network,WiFi`,
    `DeviceID,test-device-001`,
    `Hardware,generic`,
    `Manufacturer,TestCo`,
    `Model,TestPhone`,
    `MimeType,image/jpeg`,
    `File.Name,test-photo.jpg`,
    `File.Size,1024`,
    `DateCreated,2023-11-14T12:00:00Z`,
  ].join('\n');

  // Fake PGP signature (not cryptographically valid, but structurally present)
  const fakeSignature = [
    '-----BEGIN PGP SIGNATURE-----',
    '',
    'iQEzBAABCAAdFiEE1234567890abcdef1234567890abcdef12345678',
    '=FAKE',
    '-----END PGP SIGNATURE-----',
  ].join('\n');

  const files: Record<string, Uint8Array> = {
    [`${fileHash}.proof.csv`]: encoder.encode(csv),
    [`${fileHash}.proof.csv.asc`]: encoder.encode(fakeSignature),
    [`test-photo.jpg.asc`]: encoder.encode(fakeSignature),
  };

  if (options.includePublicKey !== false) {
    files['pubkey.asc'] = encoder.encode([
      '-----BEGIN PGP PUBLIC KEY BLOCK-----',
      '',
      'mQENBFakeKeyBlockFakeKeyBlockFakeKeyBlock',
      '=FAKE',
      '-----END PGP PUBLIC KEY BLOCK-----',
    ].join('\n'));
  }

  if (options.includeSafetyNet) {
    // Create a fake JWT with valid base64url structure
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      basicIntegrity: true,
      ctsProfileMatch: true,
      evaluationType: 'BASIC',
      apkPackageName: 'org.witness.proofmode',
      timestampMs: timestamp,
    })).toString('base64url');
    const signature = 'fakesignature';
    files[`${fileHash}.gst`] = encoder.encode(`${header}.${payload}.${signature}`);
  }

  if (options.includeOTS) {
    files[`${fileHash}.ots`] = encoder.encode('fake-ots-proof');
  }

  return zipSync(files);
}
