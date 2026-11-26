import { describe, it, expect } from "vitest";
import { sum, clamp } from "../math.mjs";

describe("sum", () => {
  it("adds two positive numbers", () => {
    expect(sum(2, 3)).toBe(5);
  });

  it("adds negative numbers", () => {
    expect(sum(-2, -3)).toBe(-5);
  });

  it("adds a positive and a negative number", () => {
    expect(sum(5, -3)).toBe(2);
  });

  it("treats zero as identity", () => {
    expect(sum(0, 7)).toBe(7);
  });
});

describe("clamp", () => {
  it("returns the value when inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min when below the range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps to max when above the range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns min when value equals min boundary", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("returns max when value equals max boundary", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("handles min equal to max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it("handles negative ranges", () => {
    expect(clamp(-7, -10, -5)).toBe(-7);
    expect(clamp(-20, -10, -5)).toBe(-10);
    expect(clamp(0, -10, -5)).toBe(-5);
  });
});
