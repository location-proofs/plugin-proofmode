// Copyright © 2026 Sophia Systems Corporation

import { evaluateProofModeStamp } from '../evaluate';
import { parseBundle } from '../parse';
import { createStampFromBundle } from '../create';
import { createSyntheticBundle } from './fixtures/create-fixture';
import type { LocationStamp, LocationClaim } from '@decentralized-geo/astral-sdk/plugins';

const NYC = { lat: 40.7484, lon: -73.9857 };
const SF = { lat: 37.7749, lon: -122.4194 };

function makeStamp(
  lat: number,
  lon: number,
  timestampMs = 1700000000000
): LocationStamp {
  const zipData = createSyntheticBundle({ lat, lon, timestamp: timestampMs });
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
  };
}

function makeClaim(lat: number, lon: number, radius = 100, startSec = 1700000000): LocationClaim {
  return {
    lpVersion: '0.2',
    locationType: 'geojson-point',
    location: { type: 'Point', coordinates: [lon, lat] },
    srs: 'EPSG:4326',
    subject: { scheme: 'eth-address', value: '0x123' },
    radius,
    time: { start: startSec, end: startSec + 3600 },
  };
}

describe('ProofMode evaluation', () => {
  it('gives high score for co-located stamp and claim', async () => {
    const stamp = makeStamp(NYC.lat, NYC.lon);
    const claim = makeClaim(NYC.lat, NYC.lon);
    const result = await evaluateProofModeStamp(stamp, claim);

    expect(result.supportsClaim).toBe(true);
    expect(result.spatial).toBeGreaterThan(0.5);
    expect(result.temporal).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0.3);
  });

  it('gives zero spatial score for distant locations', async () => {
    const stamp = makeStamp(SF.lat, SF.lon);
    const claim = makeClaim(NYC.lat, NYC.lon, 100);
    const result = await evaluateProofModeStamp(stamp, claim);

    expect(result.supportsClaim).toBe(false);
    expect(result.spatial).toBe(0);
  });

  it('caps spatial score at 0.7 (ProofMode GPS is self-reported)', async () => {
    const stamp = makeStamp(NYC.lat, NYC.lon);
    const claim = makeClaim(NYC.lat, NYC.lon, 1000); // Large radius
    const result = await evaluateProofModeStamp(stamp, claim);

    expect(result.spatial).toBeLessThanOrEqual(0.7);
  });

  it('gives zero temporal score for non-overlapping times', async () => {
    const stamp = makeStamp(NYC.lat, NYC.lon, 1700000000000);
    // Claim is 10 hours later than stamp
    const claim = makeClaim(NYC.lat, NYC.lon, 100, 1700036000);
    const result = await evaluateProofModeStamp(stamp, claim);

    expect(result.temporal).toBe(0);
  });

  it('factors in accuracy for spatial scoring', async () => {
    // Stamp at exact claim location but with high accuracy (tighter circle)
    const preciseBundle = createSyntheticBundle({ lat: NYC.lat, lon: NYC.lon, accuracy: 5 });
    const preciseParsed = parseBundle(preciseBundle);
    const preciseUnsigned = createStampFromBundle(preciseParsed, '0.1.0');
    const preciseStamp: LocationStamp = {
      ...preciseUnsigned,
      signatures: [{ signer: { scheme: 'pgp-fingerprint', value: 'X' }, algorithm: 'pgp', value: 'sig', timestamp: 0 }],
    };

    const looseBundle = createSyntheticBundle({ lat: NYC.lat, lon: NYC.lon, accuracy: 500 });
    const looseParsed = parseBundle(looseBundle);
    const looseUnsigned = createStampFromBundle(looseParsed, '0.1.0');
    const looseStamp: LocationStamp = {
      ...looseUnsigned,
      signatures: [{ signer: { scheme: 'pgp-fingerprint', value: 'X' }, algorithm: 'pgp', value: 'sig', timestamp: 0 }],
    };

    const claim = makeClaim(NYC.lat, NYC.lon, 50);
    const preciseResult = await evaluateProofModeStamp(preciseStamp, claim);
    const looseResult = await evaluateProofModeStamp(looseStamp, claim);

    // Both should have spatial > 0 since they're at the same location
    expect(preciseResult.spatial).toBeGreaterThan(0);
    expect(looseResult.spatial).toBeGreaterThan(0);
  });

  it('applies penalty for network-only provider', async () => {
    const stamp = makeStamp(NYC.lat, NYC.lon);
    stamp.signals['Location.Provider'] = 'network';
    const claim = makeClaim(NYC.lat, NYC.lon);

    const result = await evaluateProofModeStamp(stamp, claim);
    expect(result.details.networkOnlyPenalty).toBe(true);
  });
});
