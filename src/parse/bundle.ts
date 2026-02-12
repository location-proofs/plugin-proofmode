// Copyright © 2026 Sophia Systems Corporation

/**
 * ProofMode proof bundle parser
 *
 * Extracts and categorizes files from a ProofMode proof bundle ZIP.
 */

import { unzipSync } from 'fflate';
import type { ParsedBundle, BundleFile } from '../types';
import { parseCSV } from './csv';
import { parseJSON } from './json';

/**
 * Parse a ProofMode proof bundle from a ZIP file.
 *
 * Expected bundle structure:
 * ```
 * <sha256>.proof.csv          — sensor metadata (CSV)
 * <sha256>.proof.csv.asc      — PGP signature of CSV
 * <sha256>.proof.json         — sensor metadata (JSON)
 * <sha256>.proof.json.asc     — PGP signature of JSON
 * <original-filename>.asc     — PGP detached signature of media
 * <sha256>.gst                — Google SafetyNet/Play Integrity JWT
 * <sha256>.ots                — OpenTimestamps proof
 * pubkey.asc                  — PGP public key
 * ```
 */
/** Known media file extensions (lowercase, with leading dot). */
const MEDIA_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif',
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp',
  '.mp3', '.wav', '.aac', '.ogg', '.m4a',
]);

function isMediaFile(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return false;
  return MEDIA_EXTENSIONS.has(name.substring(dot).toLowerCase());
}

export function parseBundle(zipData: Uint8Array): ParsedBundle {
  const entries = unzipSync(zipData);

  const files: BundleFile[] = [];
  let csvData: Uint8Array | undefined;
  let jsonData: Uint8Array | undefined;
  let publicKey: string | undefined;
  let metadataSignature: Uint8Array | undefined;
  let mediaSignature: Uint8Array | undefined;
  let safetyNetToken: string | undefined;
  let deviceCheckAttestation: string | undefined;
  let otsProof: Uint8Array | undefined;
  let mediaFile: Uint8Array | undefined;
  let mediaFileName: string | undefined;

  const decoder = new TextDecoder();

  for (const [name, data] of Object.entries(entries)) {
    files.push({ name, data });

    const lower = name.toLowerCase();
    const baseName = lower.split('/').pop() ?? lower;

    if (lower.endsWith('.proof.csv')) {
      csvData = data;
    } else if (lower.endsWith('.proof.json')) {
      jsonData = data;
    } else if (baseName === 'pubkey.asc') {
      publicKey = decoder.decode(data);
    } else if (lower.endsWith('.proof.csv.asc')) {
      metadataSignature = data;
    } else if (lower.endsWith('.proof.json.asc')) {
      // Prefer CSV signature but fall back to JSON
      if (!metadataSignature) {
        metadataSignature = data;
      }
    } else if (lower.endsWith('.gst')) {
      safetyNetToken = decoder.decode(data);
    } else if (lower.endsWith('.devicecheck')) {
      deviceCheckAttestation = decoder.decode(data);
    } else if (lower.endsWith('.ots')) {
      otsProof = data;
    } else if (lower.endsWith('.txt')) {
      // Documentation files (e.g. HowToVerifyProofData.txt) — skip
    } else if (lower.endsWith('.asc') && !lower.includes('proof') && baseName !== 'pubkey.asc') {
      mediaSignature = data;
    } else if (isMediaFile(name)) {
      mediaFile = data;
      mediaFileName = name;
    }
    // Unknown extensions are silently ignored — they're still in files[]
  }

  // Parse metadata from CSV or JSON
  let metadata;
  if (csvData) {
    const csvText = decoder.decode(csvData);
    metadata = parseCSV(csvText);
  } else if (jsonData) {
    const jsonText = decoder.decode(jsonData);
    metadata = parseJSON(jsonText);
  } else {
    throw new Error('ProofMode bundle missing metadata (no .proof.csv or .proof.json found)');
  }

  // Extract hash from filename pattern: <sha256>.proof.csv
  let expectedHash: string | undefined;
  if (csvData) {
    const csvFile = files.find(f => f.name.toLowerCase().endsWith('.proof.csv'));
    if (csvFile) {
      const hashPart = csvFile.name.split('/').pop()?.replace('.proof.csv', '');
      if (hashPart && /^[a-f0-9]{64}$/i.test(hashPart)) {
        expectedHash = hashPart;
      }
    }
  }

  return {
    metadata,
    publicKey,
    metadataSignature,
    mediaSignature,
    safetyNetToken,
    deviceCheckAttestation,
    otsProof,
    mediaFile,
    mediaFileName,
    expectedHash,
    files,
  };
}
