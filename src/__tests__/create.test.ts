// Copyright © 2026 Sophia Systems Corporation

import { ProofModePlugin } from '../index';
import { parseBundle } from '../parse';
import { createStampFromBundle } from '../create';
import { createSyntheticBundle } from './fixtures/create-fixture';
import type { RawSignals } from '@decentralized-geo/astral-sdk/plugins';

describe('ProofModePlugin.create()', () => {
  const plugin = new ProofModePlugin();

  it('creates an UnsignedLocationStamp from signals with zipData', async () => {
    const zipData = createSyntheticBundle();
    const signals: RawSignals = {
      plugin: 'proofmode',
      timestamp: Math.floor(Date.now() / 1000),
      data: { zipData },
    };

    const stamp = await plugin.create(signals);

    expect(stamp.plugin).toBe('proofmode');
    expect(stamp.lpVersion).toBe('0.2');
    expect(stamp.locationType).toBe('geojson-point');
    expect(stamp.srs).toBe('EPSG:4326');
    expect(stamp.signals['Location.Latitude']).toBe(40.7484);
    expect(stamp.signals['Location.Longitude']).toBe(-73.9857);
  });

  it('matches output of parseBundle + createStampFromBundle', async () => {
    const zipData = createSyntheticBundle();

    // Standard interface
    const signals: RawSignals = {
      plugin: 'proofmode',
      timestamp: Math.floor(Date.now() / 1000),
      data: { zipData },
    };
    const viaCreate = await plugin.create(signals);

    // Direct convenience methods
    const bundle = parseBundle(zipData);
    const viaDirect = createStampFromBundle(bundle, plugin.version);

    expect(viaCreate).toEqual(viaDirect);
  });

  it('throws if zipData is missing', async () => {
    const signals: RawSignals = {
      plugin: 'proofmode',
      timestamp: Math.floor(Date.now() / 1000),
      data: {},
    };

    await expect(plugin.create(signals)).rejects.toThrow(
      'requires signals.data.zipData as Uint8Array'
    );
  });

  it('throws if zipData is not a Uint8Array', async () => {
    const signals: RawSignals = {
      plugin: 'proofmode',
      timestamp: Math.floor(Date.now() / 1000),
      data: { zipData: 'not-a-uint8array' },
    };

    await expect(plugin.create(signals)).rejects.toThrow(
      'requires signals.data.zipData as Uint8Array'
    );
  });
});
