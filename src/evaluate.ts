// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode stamp evaluation
 *
 * Assesses how well a ProofMode stamp supports a location claim.
 * Produces a CredibilityVector with spatial, temporal, and signal-quality scores.
 *
 * Key insight from threat model: ProofMode GPS is self-reported, so spatial
 * accuracy alone maxes at ~0.7 for ProofMode evidence.
 */

import type {
  LocationStamp,
  LocationClaim,
  CredibilityVector,
} from '@decentralized-geo/astral-sdk/plugins';

const EARTH_RADIUS_M = 6_371_000;
const MAX_PROOFMODE_SPATIAL = 0.7; // GPS is self-reported — cap confidence

/**
 * Haversine distance between two lat/lon points in meters.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Compute overlap ratio between two time intervals.
 */
function temporalOverlap(a: { start: number; end: number }, b: { start: number; end: number }): number {
  const overlapStart = Math.max(a.start, b.start);
  const overlapEnd = Math.min(a.end, b.end);
  if (overlapEnd <= overlapStart) return 0;
  const overlap = overlapEnd - overlapStart;
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  return shorter > 0 ? overlap / shorter : 0;
}

/**
 * Extract coordinates from a location (GeoJSON Point or similar).
 */
function extractCoords(location: unknown): { lat: number; lon: number } | null {
  if (typeof location === 'object' && location !== null && 'coordinates' in location) {
    const coords = (location as { coordinates: number[] }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lon: coords[0], lat: coords[1] }; // GeoJSON: [lon, lat]
    }
  }
  return null;
}

/**
 * Evaluate a ProofMode stamp against a location claim.
 */
export async function evaluateProofModeStamp(
  stamp: LocationStamp,
  claim: LocationClaim
): Promise<CredibilityVector> {
  const details: Record<string, unknown> = {};

  // Extract stamp coordinates
  const stampCoords = extractCoords(stamp.location);
  if (!stampCoords) {
    return {
      supportsClaim: false,
      score: 0,
      spatial: 0,
      temporal: 0,
      details: { error: 'Cannot extract coordinates from stamp' },
    };
  }

  // Extract claim coordinates
  const claimCoords = extractCoords(claim.location);
  if (!claimCoords) {
    return {
      supportsClaim: false,
      score: 0,
      spatial: 0,
      temporal: 0,
      details: { error: 'Cannot extract coordinates from claim' },
    };
  }

  // ---- Spatial scoring ----

  const distance = haversineDistance(stampCoords.lat, stampCoords.lon, claimCoords.lat, claimCoords.lon);
  const accuracy = (stamp.signals['Location.Accuracy'] as number) ?? 0;
  const effectiveRadius = claim.radius + accuracy;

  let spatial: number;
  if (distance <= effectiveRadius) {
    spatial = 1.0 - distance / effectiveRadius;
  } else {
    spatial = Math.max(0, 1.0 - distance / (effectiveRadius * 3));
  }

  // Cap at MAX_PROOFMODE_SPATIAL — GPS is self-reported
  spatial = Math.min(spatial, MAX_PROOFMODE_SPATIAL);

  details.distanceMeters = Math.round(distance);
  details.effectiveRadiusMeters = effectiveRadius;
  details.accuracyMeters = accuracy;

  // ---- Temporal scoring ----

  const temporal = temporalOverlap(stamp.temporalFootprint, claim.time);
  details.temporalOverlap = temporal;

  // ---- Signal quality bonuses/penalties ----

  let signalBonus = 0;

  // Bonus for SafetyNet/Play Integrity pass
  const safetyNetBasicIntegrity = stamp.signals['SafetyNet.BasicIntegrity'];
  if (safetyNetBasicIntegrity === true || safetyNetBasicIntegrity === 'true') {
    signalBonus += 0.05;
    details.safetyNetBonus = true;
  }

  // Bonus for OpenTimestamps proof present
  if (stamp.signals['HasOTS'] === true || stamp.signals['HasOTS'] === 'true') {
    signalBonus += 0.03;
    details.otsBonus = true;
  }

  // Penalty for missing GPS
  const provider = stamp.signals['Location.Provider'] as string | undefined;
  if (provider === 'network') {
    signalBonus -= 0.1; // Network-only is less precise
    details.networkOnlyPenalty = true;
  }

  // Penalty for missing signals
  const hasCell = stamp.signals['CellInfo'] !== undefined;
  const hasWifi = stamp.signals['WiFi.MAC'] !== undefined;
  if (!hasCell && !hasWifi) {
    signalBonus -= 0.05;
    details.missingNetworkContext = true;
  }

  details.signalBonus = signalBonus;

  // ---- Combined score ----

  const rawScore = spatial * 0.6 + temporal * 0.4 + signalBonus;
  const score = Math.max(0, Math.min(1, rawScore));
  const supportsClaim = score > 0.3 && spatial > 0.1 && temporal > 0;

  return { supportsClaim, score, spatial, temporal, details };
}
