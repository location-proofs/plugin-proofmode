# ProofMode Plugin

Location proof plugin using [ProofMode](https://proofmode.org/) zipfiles as stamps — mobile device-based location proofs with PGP signatures and hardware attestation.

[![npm version](https://img.shields.io/npm/v/@location-proofs/plugin-proofmode.svg)](https://www.npmjs.com/package/@location-proofs/plugin-proofmode)

## What is ProofMode?

[ProofMode](https://proofmode.org/) is a [Guardian Project](https://guardianproject.info/) mobile app that captures cryptographically verifiable location and sensor data when photos or videos are taken. It signs everything with PGP, adds SafetyNet/Play Integrity attestation, and optionally includes OpenTimestamps proofs.

## How collection works

ProofMode handles evidence collection on-device. The plugin picks up where the app leaves off — it parses, structures, and verifies the proof bundles that ProofMode produces.

**The full workflow:**

```
┌─────────────────────────────────────────────────────────┐
│  1. COLLECT (manual — on the mobile device)             │
│                                                         │
│  Open the ProofMode app with location services enabled. │
│  Take a photo or video. ProofMode automatically:        │
│  • Records GPS coordinates, accuracy, altitude, speed   │
│  • Captures cell tower and WiFi network context         │
│  • Logs device hardware identifiers                     │
│  • Signs metadata with a device-local PGP key           │
│  • Requests SafetyNet/Play Integrity attestation        │
│  • Optionally timestamps via OpenTimestamps             │
│  • Packages everything into a ZIP proof bundle          │
|  • NOTE: location services must be ON!                  |
│                                                         │
│  Export the ZIP bundle from the device.                 │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. PARSE + CREATE (this plugin)                        │
│                                                         │
│  parseBundle(zipData) → ParsedBundle                    │
│  createStampFromBundle(bundle) → UnsignedLocationStamp  │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. VERIFY (this plugin)                                │
│                                                         │
│  plugin.verify(stamp) → StampVerificationResult         │
│  Checks PGP signatures, SafetyNet JWT, signal           │
│  consistency, timestamp coherence, structure validity   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. EVALUATE (Astral SDK ProofsModule)                  │
│                                                         │
│  Bundle stamps into a proof, then evaluate credibility  │
│  across spatial, temporal, validity, and independence   │
│  dimensions.                                            │
└─────────────────────────────────────────────────────────┘
```

> **Future:** A React Native bridge will allow custom-built location-based apps to trigger ProofMode collection programmatically through the SDK's standard `collect()` method, removing the manual export step. For now, collection is manual.

## Installation

```bash
npm install @location-proofs/plugin-proofmode
# or
pnpm add @location-proofs/plugin-proofmode
```

## Quickstart

```typescript
import { ProofModePlugin } from '@location-proofs/plugin-proofmode';
import fs from 'fs';

// Initialize plugin
const plugin = new ProofModePlugin();

// Parse a ProofMode ZIP bundle exported from the app
const zipData = fs.readFileSync('proof-bundle.zip');
const bundle = plugin.parseBundle(new Uint8Array(zipData));

// Create a stamp from the parsed bundle
const unsigned = plugin.createStampFromBundle(bundle);

// Add the PGP signature from the bundle as the stamp's signature
const stamp = {
  ...unsigned,
  signatures: [{
    algorithm: 'pgp',
    value: bundle.metadataSignature
      ? Buffer.from(bundle.metadataSignature).toString('base64')
      : '',
    signer: {
      type: 'pgp-public-key' as const,
      value: bundle.publicKey ?? '',
    },
  }],
};

// Verify the stamp's internal validity
const result = await plugin.verify(stamp);
console.log(result.valid);              // true/false
console.log(result.structureValid);     // required fields present?
console.log(result.signaturesValid);    // PGP signature present and well-formed?
console.log(result.signalsConsistent);  // coordinates, timestamps, accuracy coherent?
```

## Integration with Astral SDK

```typescript
import { AstralSDK } from '@decentralized-geo/astral-sdk';
import { ProofModePlugin } from '@location-proofs/plugin-proofmode';

const astral = new AstralSDK({ chainId: 84532 });

// Register the plugin
astral.plugins.register(new ProofModePlugin());

// ... parse and create stamp as above ...

// Bundle a claim with one or more stamps
const claim = {
  lpVersion: '0.2',
  locationType: 'geojson-point',
  location: { type: 'Point', coordinates: [-73.9857, 40.7484] },
  srs: 'EPSG:4326',
  subject: { type: 'ethereum-address', value: '0x...' },
  radius: 100,
  time: { start: timestamp, end: timestamp + 3600 },
};

const proof = astral.proofs.create(claim, [stamp]);

// Evaluate multidimensional credibility
const credibility = await astral.proofs.verify(proof);
// credibility.dimensions.spatial   — distance between stamp and claim
// credibility.dimensions.temporal  — time overlap
// credibility.dimensions.validity  — signature and structure checks
// credibility.dimensions.independence — source diversity
```

## What the plugin verifies

The `verify()` method checks internal stamp validity:

- **Structure** — required fields present, correct `lpVersion` and `plugin` values
- **Signatures** — PGP signature exists with valid format and signer info
- **Signal consistency** — coordinate ranges, provider-accuracy coherence, timestamp drift
- **SafetyNet/Play Integrity** — JWT structure and integrity claims (if present)

Spatial and temporal evaluation (how well does this stamp support a given claim?) is handled by the SDK's `ProofsModule.verify()`, not by the plugin directly.

## What's in a ProofMode bundle

ProofMode ZIP bundles contain:

| Component | Size | Purpose |
|-----------|------|---------|
| Metadata (CSV/JSON) | ~5KB | GPS, WiFi, cell towers, device sensors |
| PGP signatures | ~1KB | Device-signed cryptographic proofs of metadata and media |
| PGP public key | ~2KB | The device's signing key |
| SafetyNet JWT | ~2KB | Android hardware attestation (optional) |
| OpenTimestamps proof | ~1KB | Blockchain timestamping (optional) |
| Media files | variable | Photos/videos (not needed for verification) |

The plugin extracts the cryptographic proof materials (~15-20KB) and wraps them in a `LocationStamp` for SDK interoperability. Media files can be discarded for verification purposes.

## Supported runtimes

| Runtime | Status |
|---------|--------|
| Node.js | Supported |
| Browser | Supported |
| React Native | Not yet — planned for a future release with a native bridge to the ProofMode SDK |

## API reference

### `parseBundle(zipData: Uint8Array): ParsedBundle`

Parse a ProofMode ZIP bundle into structured components.

### `createStampFromBundle(bundle: ParsedBundle): UnsignedLocationStamp`

Create an `UnsignedLocationStamp` from a parsed bundle. Extracts location, temporal footprint, and all signal fields. Discards media.

### `verify(stamp: LocationStamp): Promise<StampVerificationResult>`

Verify a stamp's internal validity — structure, signatures, and signal consistency.

### `parseSafetyNetJWT(jwt: string): SafetyNetResult | null`

Parse a SafetyNet/Play Integrity JWT and extract integrity claims. Validates structure but does not verify the certificate chain (documented v0 limitation).

## Documentation

- [Astral SDK](https://github.com/DecentralizedGeo/astral-sdk)
- [ProofMode](https://proofmode.org/)
- [Guardian Project](https://guardianproject.info/)

## Contributing

See [CONTRIBUTING.md](https://github.com/location-proofs/.github/blob/main/CONTRIBUTING.md)
