# ProofMode Plugin

Location proof plugin for [ProofMode](https://proofmode.org/) - device-based location proofs with PGP signatures and hardware attestation.

[![npm version](https://img.shields.io/npm/v/@location-proofs/plugin-proofmode.svg)](https://www.npmjs.com/package/@location-proofs/plugin-proofmode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is ProofMode?

[ProofMode](https://proofmode.org/) is a Guardian Project mobile app that captures cryptographically verifiable location and sensor data when photos or videos are taken. It signs everything with PGP, adds SafetyNet attestation, and optionally includes OpenTimestamps proofs.

This plugin parses and verifies ProofMode bundles exported from the mobile app.

## Installation

```bash
npm install @location-proofs/plugin-proofmode
# or
pnpm add @location-proofs/plugin-proofmode
```

## Quick Start

```typescript
import { ProofModePlugin } from '@location-proofs/plugin-proofmode';
import { AstralSDK } from '@decentralized-geo/astral-sdk';
import fs from 'fs';

// Initialize plugin
const plugin = new ProofModePlugin();

// Parse a ProofMode ZIP bundle
const zipData = fs.readFileSync('proof-bundle.zip');
const bundle = plugin.parseBundle(new Uint8Array(zipData));

// Create a stamp from the bundle
const unsigned = plugin.createStampFromBundle(bundle);

// Sign with your wallet (Ethereum, etc.)
const stamp = await plugin.sign(unsigned, ethersSigner);

// Verify the stamp
const verification = await plugin.verify(stamp);
console.log(verification.isValid); // true/false
```

## Integration with Astral SDK

```typescript
const astral = new AstralSDK({ chainId: 84532, signer: wallet });

// Register the plugin
astral.plugins.register(new ProofModePlugin());

// Create a location claim
const claim = {
  location: { type: 'Point', coordinates: [-73.9857, 40.7484] },
  radius: 100,
  time: { start: timestamp, end: timestamp + 3600 }
};

// Create proof with ProofMode stamp
const proof = astral.proofs.create(claim, [stamp]);

// SDK evaluates spatial/temporal credibility
const credibility = await astral.proofs.verify(proof);
console.log(credibility.score); // 0.0 - 1.0
```

## What the Plugin Does

**Internal validation** (the `verify()` method checks):
- ✅ PGP signature of metadata
- ✅ SafetyNet JWT structure and claims
- ✅ Signal consistency (coordinate ranges, timestamp coherence)
- ✅ Bundle structure and required fields

**Evaluation** (handled by SDK's `ProofsModule.verify()`):
- Spatial distance measurements (haversine)
- Temporal overlap calculations
- Multidimensional credibility scoring

## Architecture

ProofMode bundles contain:
- **Metadata** (CSV/JSON) - GPS, WiFi, cell towers, device sensors (~5KB)
- **PGP signatures** - Device-signed cryptographic proofs
- **SafetyNet JWT** - Android hardware attestation (optional)
- **OpenTimestamps proof** - Blockchain timestamping (optional)
- **Media files** - Photos/videos (discarded during verification)

The plugin extracts the cryptographic proof materials (~15-20KB) and wraps them in a `LocationStamp` for SDK interoperability.

## API Reference

### `parseBundle(zipData: Uint8Array): ParsedBundle`

Parse a ProofMode ZIP bundle into structured components.

### `createStampFromBundle(bundle: ParsedBundle): UnsignedLocationStamp`

Create a LocationStamp from parsed bundle (extracts essentials, discards media).

### `verify(stamp: LocationStamp): Promise<StampVerificationResult>`

Verify stamp's internal validity (PGP signatures, SafetyNet, signal consistency).

## Documentation

- [Full Plugin Documentation](https://docs.astral.global/plugins/proofmode)
- [Plugin Development Guide](https://docs.astral.global/plugins/development)
- [Astral SDK](https://github.com/DecentralizedGeo/astral-sdk)

## Contributing

See [CONTRIBUTING.md](https://github.com/location-proofs/.github/blob/main/CONTRIBUTING.md)

## License

MIT © Astral Protocol
