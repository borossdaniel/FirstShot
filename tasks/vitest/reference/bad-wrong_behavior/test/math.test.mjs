import { describe, expect, it } from 'vitest';
import { clamp, sum } from '../math.mjs';

describe('sum', () => {
  it('adds', () => expect(sum(2, 3)).toBe(5));
});
describe('clamp', () => {
  it('keeps values inside the range', () => expect(clamp(5, 0, 10)).toBe(5));
  it('raises values below min', () => expect(clamp(-1, 0, 10)).toBe(0));
});
