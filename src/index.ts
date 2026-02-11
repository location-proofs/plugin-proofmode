// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode Location Proof Plugin
 *
 * Adapter layer for ProofMode proof bundles. Accepts proof bundles
 * (however they arrive — app export, file share, API upload), extracts
 * location evidence, verifies structure, and evaluates against claims.
 *
 * The plugin implements verify, evaluate, and create. It does NOT implement
 * collect or sign because ProofMode handles those internally on the device.
 * The React Native bridge (Phase 3) will add collect/sign support.
 */

import type {
  LocationProofPlugin,
  Runtime,
  LocationStamp,
  LocationClaim,
  StampVerificationResult,
  CredibilityVector,
} from '@decentralized-geo/astral-sdk/plugins';

import { parseBundle } from './parse';
import { createStampFromBundle } from './create';
import { verifyProofModeStamp } from './verify';
import { evaluateProofModeStamp } from './evaluate';
import type { ParsedBundle } from './types';

export class ProofModePlugin implements LocationProofPlugin {
  readonly name = 'proofmode';
  readonly version = '0.1.0';
  readonly runtimes: Runtime[] = ['node', 'browser'];
  readonly requiredCapabilities: string[] = [];
  readonly description =
    'ProofMode device-based location proofs with PGP signatures and hardware attestation';

  /**
   * Parse a ProofMode proof bundle ZIP and create an UnsignedLocationStamp.
   *
   * This is a convenience method — not part of the standard plugin interface.
   * Use it when you have a raw proof bundle ZIP to process.
   */
  parseBundle(zipData: Uint8Array): ParsedBundle {
    return parseBundle(zipData);
  }

  /**
   * Create an UnsignedLocationStamp from a parsed ProofMode bundle.
   *
   * This is a convenience method for working with parsed bundles directly.
   */
  createStampFromBundle(bundle: ParsedBundle) {
    return createStampFromBundle(bundle, this.version);
  }

  /**
   * Verify a ProofMode stamp's internal validity.
   */
  async verify(stamp: LocationStamp): Promise<StampVerificationResult> {
    return verifyProofModeStamp(stamp);
  }

  /**
   * Evaluate how well a ProofMode stamp supports a location claim.
   */
  async evaluate(stamp: LocationStamp, claim: LocationClaim): Promise<CredibilityVector> {
    return evaluateProofModeStamp(stamp, claim);
  }
}

// Re-export types and utilities for direct use
export type { ParsedBundle, ProofModeSignals, ProofModeMetadata, SafetyNetResult } from './types';
export { parseBundle } from './parse';
export { createStampFromBundle } from './create';
export { verifyProofModeStamp, parseSafetyNetJWT } from './verify';
export { evaluateProofModeStamp } from './evaluate';
