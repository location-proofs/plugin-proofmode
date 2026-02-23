// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode Location Proof Plugin
 *
 * Parses and verifies ProofMode proof bundles (ZIP archives from ProofMode mobile app).
 * Supports two verification paths:
 * - Destructured: Extract essentials only (~15-20KB), discard media files
 * - Un-destructured: Preserve full original bundle for forensic integrity
 *
 * The plugin implements verify and create. It does NOT implement
 * collect or sign because ProofMode handles those internally on the device.
 *
 * Evaluation (spatial/temporal scoring) is handled by the SDK's ProofsModule.verify().
 */

import type {
  LocationProofPlugin,
  Runtime,
  RawSignals,
  UnsignedLocationStamp,
  LocationStamp,
  StampVerificationResult,
} from '@decentralized-geo/astral-sdk/plugins';

import { parseBundle } from './parse';
import { createStampFromBundle } from './create';
import { verifyProofModeStamp } from './verify';
import type { ParsedBundle } from './types';

export class ProofModePlugin implements LocationProofPlugin {
  readonly name = 'proofmode';
  readonly version = '0.1.0';
  readonly runtimes: Runtime[] = ['node', 'browser'];
  readonly requiredCapabilities: string[] = [];
  readonly description =
    'ProofMode device-based location proofs with PGP signatures and hardware attestation';

  /**
   * Create an UnsignedLocationStamp from raw signals.
   *
   * Expects signals.data.zipData to be a Uint8Array containing
   * a ProofMode proof bundle ZIP exported from the mobile app.
   */
  async create(signals: RawSignals): Promise<UnsignedLocationStamp> {
    const zipData = signals.data?.zipData;
    if (!(zipData instanceof Uint8Array)) {
      throw new Error(
        'ProofModePlugin.create() requires signals.data.zipData as Uint8Array'
      );
    }
    const bundle = this.parseBundle(zipData);
    return this.createStampFromBundle(bundle);
  }

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
}

// Re-export types and utilities for direct use
export type { ParsedBundle, ProofModeSignals, ProofModeMetadata, SafetyNetResult } from './types';
export { parseBundle } from './parse';
export { createStampFromBundle } from './create';
export { verifyProofModeStamp, parseSafetyNetJWT } from './verify';
