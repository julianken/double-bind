/**
 * Unit tests for Hybrid Logical Clock utilities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initHLC,
  generateHLC,
  updateHLC,
  serializeHLC,
  deserializeHLC,
  compareHLC,
  happenedBefore,
  maxHLC,
  createVersionVector,
  updateVersionVector,
  mergeVersionVectors,
  compareVersionVectors,
  vectorPrecedes,
  areConcurrent,
} from '../../src/sync/hlc';
import type { HybridLogicalClock, VersionVector } from '@double-bind/types';

describe('Hybrid Logical Clock (HLC)', () => {
  describe('generateHLC', () => {
    it('should generate HLC with physical time and zero logical counter', () => {
      const nodeId = 'test-node-1';
      const physical = Date.now();
      const hlc = generateHLC(nodeId, physical);

      expect(hlc.physical).toBe(physical);
      expect(hlc.logical).toBe(0);
      expect(hlc.nodeId).toBe(nodeId);
    });

    it('should increment logical counter for same physical time', () => {
      const nodeId = 'test-node-2';
      const physical = Date.now();

      const hlc1 = generateHLC(nodeId, physical);
      const hlc2 = generateHLC(nodeId, physical);

      expect(hlc1.logical).toBe(0);
      expect(hlc2.logical).toBe(1);
    });

    it('should reset logical counter when physical time advances', () => {
      const nodeId = 'test-node-3';
      const physical1 = Date.now();
      const physical2 = physical1 + 1000;

      const hlc1 = generateHLC(nodeId, physical1);
      const hlc2 = generateHLC(nodeId, physical2);

      expect(hlc1.logical).toBe(0);
      expect(hlc2.logical).toBe(0);
      expect(hlc2.physical).toBeGreaterThan(hlc1.physical);
    });

    it('should handle clock going backwards', () => {
      const nodeId = 'test-node-4';
      const physical1 = Date.now();
      const physical2 = physical1 - 1000; // Clock went backwards

      const hlc1 = generateHLC(nodeId, physical1);
      const hlc2 = generateHLC(nodeId, physical2);

      // Should keep physical time from hlc1 and increment logical
      expect(hlc2.physical).toBe(hlc1.physical);
      expect(hlc2.logical).toBe(hlc1.logical + 1);
    });

    it('should maintain monotonicity', () => {
      const nodeId = 'test-node-5';
      const hlcs: HybridLogicalClock[] = [];

      for (let i = 0; i < 10; i++) {
        hlcs.push(generateHLC(nodeId));
      }

      // Each HLC should be greater than or equal to previous
      for (let i = 1; i < hlcs.length; i++) {
        const cmp = compareHLC(hlcs[i], hlcs[i - 1]);
        expect(cmp).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('updateHLC', () => {
    beforeEach(() => {
      // Reset HLC state between tests
      initHLC('local-node');
    });

    it('should advance local clock when receiving newer timestamp', () => {
      const localNode = 'local-node';
      const remoteNode = 'remote-node';

      const localTime = Date.now();
      const remoteTime = localTime + 5000;

      generateHLC(localNode, localTime);
      const remoteHLC: HybridLogicalClock = {
        physical: remoteTime,
        logical: 0,
        nodeId: remoteNode,
      };

      const updated = updateHLC(localNode, remoteHLC);

      expect(updated.physical).toBe(remoteTime);
      expect(updated.logical).toBe(1);
      expect(updated.nodeId).toBe(localNode);
    });

    it('should increment logical counter when physical times match', () => {
      const localNode = 'local-node-2';
      const time = Date.now();

      generateHLC(localNode, time); // logical = 0
      const remoteHLC: HybridLogicalClock = {
        physical: time,
        logical: 0,
        nodeId: 'remote-node',
      };

      const updated = updateHLC(localNode, remoteHLC);

      // Physical should be at least the time used
      expect(updated.physical).toBeGreaterThanOrEqual(time);
      expect(updated.logical).toBeGreaterThan(0);
    });

    it('should maintain causality across multiple updates', () => {
      const localNode = 'local-node';

      const hlc1 = generateHLC(localNode);
      const hlc2 = updateHLC(localNode, hlc1);
      const hlc3 = updateHLC(localNode, hlc2);

      expect(compareHLC(hlc2, hlc1)).toBeGreaterThan(0);
      expect(compareHLC(hlc3, hlc2)).toBeGreaterThan(0);
    });
  });

  describe('serializeHLC / deserializeHLC', () => {
    it('should serialize HLC to string format', () => {
      const hlc: HybridLogicalClock = {
        physical: 1707456123456,
        logical: 5,
        nodeId: 'device-123',
      };

      const serialized = serializeHLC(hlc);
      expect(serialized).toBe('1707456123456-5-device-123');
    });

    it('should deserialize HLC from string format', () => {
      const hlcString = '1707456123456-5-device-123';
      const hlc = deserializeHLC(hlcString);

      expect(hlc.physical).toBe(1707456123456);
      expect(hlc.logical).toBe(5);
      expect(hlc.nodeId).toBe('device-123');
    });

    it('should handle node IDs with dashes', () => {
      const hlc: HybridLogicalClock = {
        physical: 1707456123456,
        logical: 0,
        nodeId: 'device-mobile-123-abc',
      };

      const serialized = serializeHLC(hlc);
      const deserialized = deserializeHLC(serialized);

      expect(deserialized).toEqual(hlc);
    });

    it('should round-trip correctly', () => {
      const original: HybridLogicalClock = {
        physical: Date.now(),
        logical: 42,
        nodeId: 'test-node',
      };

      const serialized = serializeHLC(original);
      const deserialized = deserializeHLC(serialized);

      expect(deserialized).toEqual(original);
    });

    it('should throw on invalid format', () => {
      expect(() => deserializeHLC('invalid')).toThrow();
      expect(() => deserializeHLC('abc-def-ghi')).toThrow();
      expect(() => deserializeHLC('123-abc-node')).toThrow();
    });
  });

  describe('compareHLC', () => {
    it('should compare by physical time first', () => {
      const hlc1: HybridLogicalClock = {
        physical: 1000,
        logical: 5,
        nodeId: 'a',
      };
      const hlc2: HybridLogicalClock = {
        physical: 2000,
        logical: 0,
        nodeId: 'b',
      };

      expect(compareHLC(hlc1, hlc2)).toBe(-1);
      expect(compareHLC(hlc2, hlc1)).toBe(1);
    });

    it('should compare by logical counter if physical times equal', () => {
      const hlc1: HybridLogicalClock = {
        physical: 1000,
        logical: 3,
        nodeId: 'a',
      };
      const hlc2: HybridLogicalClock = {
        physical: 1000,
        logical: 7,
        nodeId: 'b',
      };

      expect(compareHLC(hlc1, hlc2)).toBe(-1);
      expect(compareHLC(hlc2, hlc1)).toBe(1);
    });

    it('should compare by node ID if both physical and logical equal', () => {
      const hlc1: HybridLogicalClock = {
        physical: 1000,
        logical: 5,
        nodeId: 'aaa',
      };
      const hlc2: HybridLogicalClock = {
        physical: 1000,
        logical: 5,
        nodeId: 'bbb',
      };

      expect(compareHLC(hlc1, hlc2)).toBe(-1);
      expect(compareHLC(hlc2, hlc1)).toBe(1);
    });

    it('should return 0 for identical HLCs', () => {
      const hlc: HybridLogicalClock = {
        physical: 1000,
        logical: 5,
        nodeId: 'test',
      };

      expect(compareHLC(hlc, hlc)).toBe(0);
    });
  });

  describe('happenedBefore', () => {
    it('should return true when first HLC is older', () => {
      const hlc1: HybridLogicalClock = {
        physical: 1000,
        logical: 0,
        nodeId: 'a',
      };
      const hlc2: HybridLogicalClock = {
        physical: 2000,
        logical: 0,
        nodeId: 'b',
      };

      expect(happenedBefore(hlc1, hlc2)).toBe(true);
      expect(happenedBefore(hlc2, hlc1)).toBe(false);
    });

    it('should return false for identical timestamps', () => {
      const hlc: HybridLogicalClock = {
        physical: 1000,
        logical: 5,
        nodeId: 'test',
      };

      expect(happenedBefore(hlc, hlc)).toBe(false);
    });
  });

  describe('maxHLC', () => {
    it('should return maximum HLC from array', () => {
      const hlcs: HybridLogicalClock[] = [
        { physical: 1000, logical: 0, nodeId: 'a' },
        { physical: 3000, logical: 0, nodeId: 'b' },
        { physical: 2000, logical: 5, nodeId: 'c' },
      ];

      const max = maxHLC(hlcs);
      expect(max.physical).toBe(3000);
    });

    it('should throw on empty array', () => {
      expect(() => maxHLC([])).toThrow();
    });
  });

  describe('Version Vectors', () => {
    describe('createVersionVector', () => {
      it('should create version vector with single entry', () => {
        const vv = createVersionVector('node-a', '1000-0-node-a');

        expect(vv).toEqual({
          'node-a': '1000-0-node-a',
        });
      });
    });

    describe('updateVersionVector', () => {
      it('should add new node to version vector', () => {
        const vv1 = createVersionVector('node-a', '1000-0-node-a');
        const vv2 = updateVersionVector(vv1, 'node-b', '2000-0-node-b');

        expect(vv2).toEqual({
          'node-a': '1000-0-node-a',
          'node-b': '2000-0-node-b',
        });
      });

      it('should update existing node timestamp', () => {
        const vv1 = createVersionVector('node-a', '1000-0-node-a');
        const vv2 = updateVersionVector(vv1, 'node-a', '2000-0-node-a');

        expect(vv2['node-a']).toBe('2000-0-node-a');
      });

      it('should be immutable', () => {
        const vv1 = createVersionVector('node-a', '1000-0-node-a');
        const vv2 = updateVersionVector(vv1, 'node-b', '2000-0-node-b');

        expect(vv1).not.toHaveProperty('node-b');
        expect(vv2).toHaveProperty('node-b');
      });
    });

    describe('mergeVersionVectors', () => {
      it('should merge two version vectors taking max timestamps', () => {
        const vv1: VersionVector = {
          'node-a': '1000-0-node-a',
          'node-b': '2000-0-node-b',
        };
        const vv2: VersionVector = {
          'node-b': '1500-0-node-b', // Older than vv1
          'node-c': '3000-0-node-c',
        };

        const merged = mergeVersionVectors(vv1, vv2);

        expect(merged).toEqual({
          'node-a': '1000-0-node-a',
          'node-b': '2000-0-node-b', // Kept newer timestamp
          'node-c': '3000-0-node-c',
        });
      });

      it('should handle empty vectors', () => {
        const vv1: VersionVector = { 'node-a': '1000-0-node-a' };
        const vv2: VersionVector = {};

        const merged = mergeVersionVectors(vv1, vv2);
        expect(merged).toEqual(vv1);
      });
    });

    describe('compareVersionVectors', () => {
      it('should detect equal vectors', () => {
        const vv1: VersionVector = {
          'node-a': '1000-0-node-a',
          'node-b': '2000-0-node-b',
        };
        const vv2: VersionVector = {
          'node-a': '1000-0-node-a',
          'node-b': '2000-0-node-b',
        };

        expect(compareVersionVectors(vv1, vv2)).toBe('equal');
      });

      it('should detect when first vector is before second', () => {
        const vv1: VersionVector = {
          'node-a': '1000-0-node-a',
          'node-b': '2000-0-node-b',
        };
        const vv2: VersionVector = {
          'node-a': '1500-0-node-a', // Newer
          'node-b': '2500-0-node-b', // Newer
        };

        expect(compareVersionVectors(vv1, vv2)).toBe('before');
      });

      it('should detect when first vector is after second', () => {
        const vv1: VersionVector = {
          'node-a': '2000-0-node-a',
          'node-b': '3000-0-node-b',
        };
        const vv2: VersionVector = {
          'node-a': '1000-0-node-a', // Older
          'node-b': '2000-0-node-b', // Older
        };

        expect(compareVersionVectors(vv1, vv2)).toBe('after');
      });

      it('should detect concurrent vectors', () => {
        const vv1: VersionVector = {
          'node-a': '2000-0-node-a', // Newer
          'node-b': '1000-0-node-b', // Older
        };
        const vv2: VersionVector = {
          'node-a': '1000-0-node-a', // Older
          'node-b': '2000-0-node-b', // Newer
        };

        expect(compareVersionVectors(vv1, vv2)).toBe('concurrent');
      });

      it('should handle missing nodes in vectors', () => {
        const vv1: VersionVector = {
          'node-a': '1000-0-node-a',
        };
        const vv2: VersionVector = {
          'node-a': '2000-0-node-a',
          'node-b': '3000-0-node-b', // New node
        };

        expect(compareVersionVectors(vv1, vv2)).toBe('before');
      });
    });

    describe('vectorPrecedes', () => {
      it('should return true when first vector precedes second', () => {
        const vv1: VersionVector = { 'node-a': '1000-0-node-a' };
        const vv2: VersionVector = { 'node-a': '2000-0-node-a' };

        expect(vectorPrecedes(vv1, vv2)).toBe(true);
        expect(vectorPrecedes(vv2, vv1)).toBe(false);
      });

      it('should return false for concurrent vectors', () => {
        const vv1: VersionVector = {
          'node-a': '2000-0-node-a',
          'node-b': '1000-0-node-b',
        };
        const vv2: VersionVector = {
          'node-a': '1000-0-node-a',
          'node-b': '2000-0-node-b',
        };

        expect(vectorPrecedes(vv1, vv2)).toBe(false);
        expect(vectorPrecedes(vv2, vv1)).toBe(false);
      });
    });

    describe('areConcurrent', () => {
      it('should return true for concurrent vectors', () => {
        const vv1: VersionVector = {
          'node-a': '2000-0-node-a',
          'node-b': '1000-0-node-b',
        };
        const vv2: VersionVector = {
          'node-a': '1000-0-node-a',
          'node-b': '2000-0-node-b',
        };

        expect(areConcurrent(vv1, vv2)).toBe(true);
      });

      it('should return false for causally ordered vectors', () => {
        const vv1: VersionVector = { 'node-a': '1000-0-node-a' };
        const vv2: VersionVector = { 'node-a': '2000-0-node-a' };

        expect(areConcurrent(vv1, vv2)).toBe(false);
      });

      it('should return false for equal vectors', () => {
        const vv: VersionVector = { 'node-a': '1000-0-node-a' };

        expect(areConcurrent(vv, vv)).toBe(false);
      });
    });
  });
});
