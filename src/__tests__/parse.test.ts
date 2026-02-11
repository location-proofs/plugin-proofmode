// Copyright © 2026 Sophia Systems Corporation

import { parseBundle } from '../parse';
import { parseCSV } from '../parse/csv';
import { parseJSON } from '../parse/json';
import { createSyntheticBundle } from './fixtures/create-fixture';

describe('ProofMode parser', () => {
  describe('parseBundle', () => {
    it('parses a synthetic ProofMode ZIP bundle', () => {
      const zipData = createSyntheticBundle();
      const bundle = parseBundle(zipData);

      expect(bundle.metadata.format).toBe('csv');
      expect(bundle.metadata.signals['Location.Latitude']).toBe(40.7484);
      expect(bundle.metadata.signals['Location.Longitude']).toBe(-73.9857);
      expect(bundle.metadata.signals['Location.Accuracy']).toBe(10);
      expect(bundle.metadata.signals['Location.Provider']).toBe('gps');
    });

    it('extracts PGP public key', () => {
      const zipData = createSyntheticBundle({ includePublicKey: true });
      const bundle = parseBundle(zipData);
      expect(bundle.publicKey).toContain('BEGIN PGP PUBLIC KEY BLOCK');
    });

    it('extracts SafetyNet JWT', () => {
      const zipData = createSyntheticBundle({ includeSafetyNet: true });
      const bundle = parseBundle(zipData);
      expect(bundle.safetyNetToken).toBeTruthy();
      expect(bundle.safetyNetToken!.split('.')).toHaveLength(3);
    });

    it('extracts OTS proof', () => {
      const zipData = createSyntheticBundle({ includeOTS: true });
      const bundle = parseBundle(zipData);
      expect(bundle.otsProof).toBeTruthy();
    });

    it('extracts metadata signature', () => {
      const zipData = createSyntheticBundle();
      const bundle = parseBundle(zipData);
      expect(bundle.metadataSignature).toBeTruthy();
    });

    it('extracts expected hash from filename', () => {
      const zipData = createSyntheticBundle();
      const bundle = parseBundle(zipData);
      expect(bundle.expectedHash).toBe('a'.repeat(64));
    });

    it('extracts all 33+ signal fields', () => {
      const zipData = createSyntheticBundle();
      const bundle = parseBundle(zipData);
      const s = bundle.metadata.signals;

      // GPS fields
      expect(s['Location.Latitude']).toBeDefined();
      expect(s['Location.Longitude']).toBeDefined();
      expect(s['Location.Accuracy']).toBeDefined();
      expect(s['Location.Provider']).toBeDefined();
      expect(s['Location.Altitude']).toBeDefined();
      expect(s['Location.Bearing']).toBeDefined();
      expect(s['Location.Speed']).toBeDefined();
      expect(s['Location.Time']).toBeDefined();

      // Network context
      expect(s['CellInfo']).toBeDefined();
      expect(s['WiFi.MAC']).toBeDefined();
      expect(s['IPv4']).toBeDefined();
      expect(s['Network']).toBeDefined();

      // Device info
      expect(s['DeviceID']).toBeDefined();
      expect(s['Hardware']).toBeDefined();
      expect(s['Manufacturer']).toBeDefined();
      expect(s['Model']).toBeDefined();
    });
  });

  describe('parseCSV', () => {
    it('parses comma-separated format', () => {
      const csv = 'Location.Latitude,40.7484\nLocation.Longitude,-73.9857';
      const result = parseCSV(csv);
      expect(result.signals['Location.Latitude']).toBe(40.7484);
      expect(result.signals['Location.Longitude']).toBe(-73.9857);
    });

    it('skips header row', () => {
      const csv = 'key,value\nLocation.Latitude,40.7484';
      const result = parseCSV(csv);
      expect(result.signals['Location.Latitude']).toBe(40.7484);
      expect(result.signals['key']).toBeUndefined();
    });

    it('strips quotes from values', () => {
      const csv = 'Location.Provider,"gps"';
      const result = parseCSV(csv);
      expect(result.signals['Location.Provider']).toBe('gps');
    });

    it('skips empty lines and comments', () => {
      const csv = '# comment\n\nLocation.Latitude,40.7484\n\n';
      const result = parseCSV(csv);
      expect(result.signals['Location.Latitude']).toBe(40.7484);
    });
  });

  describe('parseJSON', () => {
    it('parses flat JSON', () => {
      const json = JSON.stringify({
        'Location.Latitude': 40.7484,
        'Location.Longitude': -73.9857,
      });
      const result = parseJSON(json);
      expect(result.signals['Location.Latitude']).toBe(40.7484);
    });

    it('flattens nested JSON', () => {
      const json = JSON.stringify({
        Location: {
          Latitude: 40.7484,
          Longitude: -73.9857,
        },
      });
      const result = parseJSON(json);
      expect(result.signals['Location.Latitude']).toBe(40.7484);
    });
  });
});
