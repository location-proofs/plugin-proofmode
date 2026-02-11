// Copyright © 2026 Sophia Systems Corporation

import { verifyProofModeStamp, parseSafetyNetJWT } from '../verify';
import { parseBundle } from '../parse';
import { createStampFromBundle } from '../create';
import { createSyntheticBundle } from './fixtures/create-fixture';
import type { LocationStamp } from '@decentralized-geo/astral-sdk/plugins';

function makeStamp(overrides: Partial<LocationStamp> = {}): LocationStamp {
  const zipData = createSyntheticBundle();
  const bundle = parseBundle(zipData);
  const unsigned = createStampFromBundle(bundle, '0.1.0');

  return {
    ...unsigned,
    signatures: [
      {
        signer: { scheme: 'pgp-fingerprint', value: 'ABCD1234' },
        algorithm: 'pgp',
        value: 'fake-pgp-signature',
        timestamp: 1700000000,
      },
    ],
    ...overrides,
  };
}

describe('ProofMode verification', () => {
  describe('verifyProofModeStamp', () => {
    it('validates a well-formed stamp', async () => {
      const stamp = makeStamp();
      const result = await verifyProofModeStamp(stamp);
      expect(result.structureValid).toBe(true);
      expect(result.signaturesValid).toBe(true);
      expect(result.signalsConsistent).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('rejects stamp with wrong plugin', async () => {
      const stamp = makeStamp({ plugin: 'witnesschain' });
      const result = await verifyProofModeStamp(stamp);
      expect(result.structureValid).toBe(false);
    });

    it('rejects stamp with no signatures', async () => {
      const stamp = makeStamp({ signatures: [] });
      const result = await verifyProofModeStamp(stamp);
      expect(result.signaturesValid).toBe(false);
      expect(result.valid).toBe(false);
    });

    it('detects invalid latitude', async () => {
      const stamp = makeStamp({
        signals: { 'Location.Latitude': 999, 'Location.Longitude': -73.9857 },
      });
      const result = await verifyProofModeStamp(stamp);
      expect(result.signalsConsistent).toBe(false);
      expect(result.details.invalidLatitude).toBe(999);
    });

    it('detects timestamp drift', async () => {
      const stamp = makeStamp();
      // Set Location.Time far from temporalFootprint
      stamp.signals['Location.Time'] = 1800000000000; // Way different
      const result = await verifyProofModeStamp(stamp);
      expect(result.signalsConsistent).toBe(false);
      expect(result.details.timestampDrift).toBeGreaterThan(3600);
    });
  });

  describe('parseSafetyNetJWT', () => {
    it('parses a valid SafetyNet JWT', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          basicIntegrity: true,
          ctsProfileMatch: true,
          evaluationType: 'BASIC',
        })
      ).toString('base64url');
      const jwt = `${header}.${payload}.fakesig`;

      const result = parseSafetyNetJWT(jwt);
      expect(result).not.toBeNull();
      expect(result!.basicIntegrity).toBe(true);
      expect(result!.ctsProfileMatch).toBe(true);
    });

    it('returns null for malformed JWT', () => {
      expect(parseSafetyNetJWT('not-a-jwt')).toBeNull();
      expect(parseSafetyNetJWT('')).toBeNull();
    });
  });
});
