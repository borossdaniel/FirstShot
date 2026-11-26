import { describe, expect, it } from "vitest";
import { clamp, sum } from "../math.mjs";

describe("sum", () => {
  it("adds two positive numbers", () => {
    expect(sum(2, 3)).toBe(5);
  });

  it("adds negative numbers", () => {
    expect(sum(-2, -3)).toBe(-5);
  });

  it("adds a positive and a negative number", () => {
    expect(sum(5, -2)).toBe(3);
  });

  it("handles zero", () => {
    expect(sum(0, 0)).toBe(0);
  });
});

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns min when value is below range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("returns max when value is above range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns the value when equal to min", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("returns the value when equal to max", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("handles min and max being equal", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it("handles negative ranges", () => {
    expect(clamp(-15, -10, -5)).toBe(-10);
    expect(clamp(-1, -10, -5)).toBe(-5);
    expect(clamp(-7, -10, -5)).toBe(-7);
  });
});
