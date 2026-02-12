// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode stamp creation
 *
 * Transforms a parsed ProofMode proof bundle into an UnsignedLocationStamp.
 */

import type { UnsignedLocationStamp } from '@decentralized-geo/astral-sdk/plugins';
import type { ParsedBundle } from './types';

/**
 * Create an UnsignedLocationStamp from a parsed ProofMode bundle.
 */
export function createStampFromBundle(bundle: ParsedBundle, pluginVersion: string): UnsignedLocationStamp {
  const signals = bundle.metadata.signals;

  const lat = signals['Location.Latitude'] as number | undefined;
  const lon = signals['Location.Longitude'] as number | undefined;

  if (lat === undefined || lon === undefined) {
    throw new Error('ProofMode bundle missing Location.Latitude or Location.Longitude');
  }

  // Build temporal footprint from available timestamps
  const locationTimeMs = signals['Location.Time'] as number | undefined;
  const timestamp = signals['Timestamp'] as number | undefined;
  const dateCreated = signals['DateCreated'] as string | undefined;

  let startTime: number;
  if (locationTimeMs) {
    startTime = locationTimeMs > 1e12 ? Math.floor(locationTimeMs / 1000) : locationTimeMs;
  } else if (timestamp) {
    startTime = timestamp;
  } else if (dateCreated) {
    startTime = Math.floor(new Date(dateCreated).getTime() / 1000);
  } else {
    startTime = Math.floor(Date.now() / 1000);
  }

  // ProofMode is a snapshot — temporal footprint is brief
  const endTime = startTime + 1;

  // Copy all signals and add bundle metadata
  const allSignals: Record<string, unknown> = { ...signals };

  // Add SafetyNet info if present
  if (bundle.safetyNetToken) {
    allSignals['SafetyNet.JWT'] = bundle.safetyNetToken;
  }

  // Add DeviceCheck info if present (iOS)
  if (bundle.deviceCheckAttestation) {
    allSignals['DeviceCheck.Attestation'] = bundle.deviceCheckAttestation;
  }

  // Note presence of OTS proof
  if (bundle.otsProof) {
    allSignals['HasOTS'] = true;
  }

  // Note presence of PGP key
  if (bundle.publicKey) {
    allSignals['HasPGPKey'] = true;
  }

  // File hash for integrity
  if (bundle.expectedHash) {
    allSignals['FileHash'] = bundle.expectedHash;
  }

  return {
    lpVersion: '0.2',
    locationType: 'geojson-point',
    location: {
      type: 'Point',
      coordinates: [lon, lat], // GeoJSON: [lon, lat]
    },
    srs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
    temporalFootprint: {
      start: startTime,
      end: endTime,
    },
    plugin: 'proofmode',
    pluginVersion,
    signals: allSignals,
  };
}
