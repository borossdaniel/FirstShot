import { describe, it, expect } from 'vitest';
import { sum, clamp } from '../math.mjs';

describe('sum', () => {
  it('adds two positive numbers', () => {
    expect(sum(2, 3)).toBe(5);
  });

  it('adds negative numbers', () => {
    expect(sum(-2, -3)).toBe(-5);
  });

  it('adds zero', () => {
    expect(sum(5, 0)).toBe(5);
  });

  it('handles floating point numbers', () => {
    expect(sum(0.1, 0.2)).toBeCloseTo(0.3);
  });
});

describe('clamp', () => {
  it('returns n when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns min when n is below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('returns max when n is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min when n equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when n equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('handles min equal to max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it('handles negative ranges', () => {
    expect(clamp(-15, -10, -5)).toBe(-10);
  });

  it('handles n within a negative range', () => {
    expect(clamp(-7, -10, -5)).toBe(-7);
  });
});
