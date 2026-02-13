// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode stamp verification
 *
 * Checks internal validity of a ProofMode-originated LocationStamp:
 * - Structure validity (required fields present)
 * - Signature presence (PGP signature exists)
 * - Signal consistency (location provider matches accuracy range)
 * - SafetyNet/Play Integrity JWT structure (if present)
 *
 * Note: Full PGP signature cryptographic verification requires openpgp.js
 * which is deferred to a later version. For v0 we validate structure,
 * format, and consistency.
 */

import type { LocationStamp, StampVerificationResult } from '@decentralized-geo/astral-sdk/plugins';
import type { SafetyNetResult } from './types';

/**
 * Parse a SafetyNet/Play Integrity JWT and extract relevant fields.
 * Validates structure but does NOT verify the certificate chain (documented v0 limitation).
 */
export function parseSafetyNetJWT(jwt: string): SafetyNetResult | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (middle part)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    return {
      basicIntegrity: !!payload.basicIntegrity,
      ctsProfileMatch: !!payload.ctsProfileMatch,
      evaluationType: payload.evaluationType,
      apkPackageName: payload.apkPackageName,
      timestampMs: payload.timestampMs,
      payload,
    };
  } catch {
    return null;
  }
}

/**
 * Verify a ProofMode LocationStamp's internal validity.
 */
export async function verifyProofModeStamp(
  stamp: LocationStamp
): Promise<StampVerificationResult> {
  const details: Record<string, unknown> = {};
  let structureValid = true;
  let signaturesValid = true;
  let signalsConsistent = true;

  // ---- Structure validation ----

  if (stamp.lpVersion !== '0.2') {
    structureValid = false;
    details.lpVersionError = `Expected '0.2', got '${stamp.lpVersion}'`;
  }

  if (stamp.plugin !== 'proofmode') {
    structureValid = false;
    details.pluginMismatch = `Expected 'proofmode', got '${stamp.plugin}'`;
  }

  if (!stamp.location) {
    structureValid = false;
    details.missingLocation = true;
  }

  if (!stamp.temporalFootprint || !stamp.temporalFootprint.start || !stamp.temporalFootprint.end) {
    structureValid = false;
    details.missingTemporalFootprint = true;
  }

  if (!stamp.signals || typeof stamp.signals !== 'object') {
    structureValid = false;
    details.missingSignals = true;
  }

  // ---- Signature validation ----
  // For v0: check that signatures exist and have valid format.
  // Full PGP cryptographic verification is deferred.

  if (!stamp.signatures || stamp.signatures.length === 0) {
    signaturesValid = false;
    details.noSignatures = true;
  } else {
    for (const sig of stamp.signatures) {
      if (!sig.value || typeof sig.value !== 'string') {
        signaturesValid = false;
        details.emptySignature = true;
      }
      if (!sig.signer || !sig.signer.value) {
        signaturesValid = false;
        details.missingSigner = true;
      }
    }
    details.signatureCount = stamp.signatures.length;
    details.signatureAlgorithms = stamp.signatures.map(s => s.algorithm);
  }

  // ---- Signal consistency ----

  if (stamp.signals) {
    const lat = stamp.signals['Location.Latitude'] as number | undefined;
    const lon = stamp.signals['Location.Longitude'] as number | undefined;
    const accuracy = stamp.signals['Location.Accuracy'] as number | undefined;
    const provider = stamp.signals['Location.Provider'] as string | undefined;

    // Validate coordinates are finite numbers in valid ranges
    if (lat !== undefined && (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90)) {
      signalsConsistent = false;
      details.invalidLatitude = lat;
    }
    if (lon !== undefined && (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180)) {
      signalsConsistent = false;
      details.invalidLongitude = lon;
    }

    // Provider-accuracy consistency
    if (provider && accuracy !== undefined) {
      if (provider === 'gps' && accuracy > 100) {
        details.suspiciousGPSAccuracy = accuracy;
        // Don't fail, but note it
      }
      if (provider === 'network' && accuracy < 5) {
        details.suspiciousNetworkAccuracy = accuracy;
      }
    }

    // SafetyNet/Play Integrity (if present in signals)
    const safetyNetJwt = stamp.signals['SafetyNet.JWT'] as string | undefined;
    if (safetyNetJwt) {
      const safetyNet = parseSafetyNetJWT(safetyNetJwt);
      if (safetyNet) {
        details.safetyNet = {
          basicIntegrity: safetyNet.basicIntegrity,
          ctsProfileMatch: safetyNet.ctsProfileMatch,
          evaluationType: safetyNet.evaluationType,
        };
      } else {
        details.safetyNetParseError = true;
      }
    }

    // Timestamp coherence
    const locationTime = stamp.signals['Location.Time'] as number | undefined;
    if (locationTime && stamp.temporalFootprint) {
      // Location.Time is in milliseconds, temporalFootprint in seconds
      const locationTimeSec = locationTime > 1e12 ? Math.floor(locationTime / 1000) : locationTime;
      const drift = Math.abs(locationTimeSec - stamp.temporalFootprint.start);
      if (drift > 3600) {
        signalsConsistent = false;
        details.timestampDrift = drift;
      }
    }
  }

  return {
    valid: structureValid && signaturesValid && signalsConsistent,
    structureValid,
    signaturesValid,
    signalsConsistent,
    details,
  };
}
