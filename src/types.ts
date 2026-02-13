// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode-specific types
 *
 * Based on the 33 signal fields documented in the ProofMode research.
 */

/**
 * All signal fields extractable from a ProofMode proof bundle.
 */
export interface ProofModeSignals {
  // GPS location
  'Location.Latitude'?: number;
  'Location.Longitude'?: number;
  'Location.Provider'?: string; // "gps", "network", "fused"
  'Location.Accuracy'?: number; // Horizontal accuracy in meters
  'Location.Altitude'?: number; // Meters above WGS84 ellipsoid
  'Location.Bearing'?: number; // Direction of travel (degrees)
  'Location.Speed'?: number; // Speed in m/s
  'Location.Time'?: number; // Timestamp of GPS fix (milliseconds)

  // Network context
  CellInfo?: string; // Cell tower ID + signal strength
  'WiFi.MAC'?: string; // Access point MAC address
  IPv4?: string;
  IPv6?: string;
  Network?: string; // Connection type (WiFi/mobile)

  // Device info
  DeviceID?: string;
  Hardware?: string;
  Manufacturer?: string;
  Model?: string;

  // ProofMode metadata
  ProofHash?: string; // SHA-256 hash of the proof bundle
  FileHash?: string; // SHA-256 hash of the media file
  MimeType?: string;
  'File.Name'?: string;
  'File.Size'?: number;

  // Timestamps
  DateCreated?: string; // ISO 8601
  Timestamp?: number; // Unix timestamp

  // Catch-all for additional fields
  [key: string]: unknown;
}

/**
 * Parsed ProofMode metadata (from CSV or JSON format).
 */
export interface ProofModeMetadata {
  /** All signal fields */
  signals: ProofModeSignals;
  /** The raw format (csv or json) */
  format: 'csv' | 'json';
  /** SHA-256 hash of the associated media file */
  fileHash?: string;
}

/**
 * Represents a file within a ProofMode proof bundle ZIP.
 */
export interface BundleFile {
  name: string;
  data: Uint8Array;
}

/**
 * Parsed ProofMode proof bundle.
 */
export interface ParsedBundle {
  /** Metadata extracted from CSV or JSON */
  metadata: ProofModeMetadata;
  /** PGP public key (ASCII-armored) */
  publicKey?: string;
  /** PGP detached signature of the metadata file */
  metadataSignature?: Uint8Array;
  /** PGP detached signature of the media file */
  mediaSignature?: Uint8Array;
  /** Google SafetyNet/Play Integrity JWT */
  safetyNetToken?: string;
  /** Apple DeviceCheck attestation (iOS) */
  deviceCheckAttestation?: string;
  /** OpenTimestamps proof */
  otsProof?: Uint8Array;
  /** The media file data */
  mediaFile?: Uint8Array;
  /** Media file name */
  mediaFileName?: string;
  /** SHA-256 hash from the bundle (pre-computed) */
  expectedHash?: string;
  /** All raw files in the bundle */
  files: BundleFile[];
}

/**
 * Result of SafetyNet/Play Integrity JWT parsing.
 * We validate structure but skip certificate chain verification for v0.
 */
export interface SafetyNetResult {
  basicIntegrity: boolean;
  ctsProfileMatch: boolean;
  evaluationType?: string;
  apkPackageName?: string;
  timestampMs?: number;
  /** Raw JWT payload for reference */
  payload: Record<string, unknown>;
}
