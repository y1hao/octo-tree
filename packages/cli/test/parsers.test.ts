import { describe, expect, it } from 'vitest';
import { parseAspect, parseCommitBound, parseLevel, parseWidth } from '../src/parsers';

describe('parseWidth', () => {
  it('returns default width when value is undefined', () => {
    expect(parseWidth(undefined)).toBe(1440);
  });

  it('returns default width when value is empty string', () => {
    expect(parseWidth('')).toBe(1440);
  });

  it('parses valid width values', () => {
    expect(parseWidth('1920')).toBe(1920);
    expect(parseWidth('800')).toBe(800);
  });

  it('rounds decimal values', () => {
    expect(parseWidth('1920.7')).toBe(1921);
    expect(parseWidth('800.3')).toBe(800);
  });

  it('rejects non-positive width values', () => {
    expect(parseWidth('0')).toBeNull();
    expect(parseWidth('-10')).toBeNull();
    expect(parseWidth('abc')).toBeNull();
  });
});

describe('parseAspect', () => {
  it('returns default aspect ratio when value is undefined', () => {
    expect(parseAspect(undefined)).toEqual({ x: 4, y: 3 });
  });

  it('returns default aspect ratio when value is empty string', () => {
    expect(parseAspect('')).toEqual({ x: 4, y: 3 });
  });

  it('parses valid aspect ratios', () => {
    expect(parseAspect('16:9')).toEqual({ x: 16, y: 9 });
    expect(parseAspect('1:1')).toEqual({ x: 1, y: 1 });
    expect(parseAspect('21:9')).toEqual({ x: 21, y: 9 });
  });

  it('rounds decimal components', () => {
    expect(parseAspect('1.2:3.4')).toEqual({ x: 1, y: 3 });
    expect(parseAspect('16.7:9.8')).toEqual({ x: 17, y: 10 });
  });

  it('rejects malformed aspect ratios', () => {
    expect(parseAspect('16-9')).toBeNull();
    expect(parseAspect('16:x')).toBeNull();
    expect(parseAspect('16')).toBeNull();
    expect(parseAspect('16:9:4')).toBeNull();
  });

  it('rejects non-positive values', () => {
    expect(parseAspect('0:4')).toBeNull();
    expect(parseAspect('4:0')).toBeNull();
    expect(parseAspect('-1:4')).toBeNull();
    expect(parseAspect('4:-1')).toBeNull();
  });
});

describe('parseCommitBound', () => {
  it('returns undefined value when input is undefined', () => {
    expect(parseCommitBound(undefined, '--from')).toEqual({ value: undefined });
    expect(parseCommitBound(undefined, '--to')).toEqual({ value: undefined });
  });

  it('parses valid positive integers', () => {
    expect(parseCommitBound('3', '--from')).toEqual({ value: 3 });
    expect(parseCommitBound('100', '--to')).toEqual({ value: 100 });
    expect(parseCommitBound('1', '--from')).toEqual({ value: 1 });
  });

  it('rejects zero', () => {
    expect(parseCommitBound('0', '--from')).toEqual({ error: '--from must be a positive integer' });
    expect(parseCommitBound('0', '--to')).toEqual({ error: '--to must be a positive integer' });
  });

  it('rejects negative numbers', () => {
    expect(parseCommitBound('-1', '--from')).toEqual({ error: '--from must be a positive integer' });
    expect(parseCommitBound('-10', '--to')).toEqual({ error: '--to must be a positive integer' });
  });

  it('rejects non-integers', () => {
    // Note: Number('3.5') is 3.5, but Number.isInteger(3.5) is false
    expect(parseCommitBound('3.5', '--from')).toEqual({ error: '--from must be a positive integer' });
    // Note: Number('1.0') is 1, and Number.isInteger(1) is true, so this passes
    expect(parseCommitBound('1.0', '--to')).toEqual({ value: 1 });
  });

  it('rejects non-numeric strings', () => {
    expect(parseCommitBound('abc', '--from')).toEqual({ error: '--from must be a positive integer' });
    expect(parseCommitBound('abc', '--to')).toEqual({ error: '--to must be a positive integer' });
  });

  it('includes flag name in error message', () => {
    expect(parseCommitBound('invalid', '--from')).toEqual({ error: '--from must be a positive integer' });
    expect(parseCommitBound('invalid', '--to')).toEqual({ error: '--to must be a positive integer' });
  });
});

describe('parseLevel', () => {
  it('returns empty object when value is undefined', () => {
    expect(parseLevel(undefined)).toEqual({});
  });

  it('returns error when value is empty string', () => {
    expect(parseLevel('')).toEqual({ error: '--level must be a positive integer' });
  });

  it('parses valid positive integers', () => {
    expect(parseLevel('4')).toEqual({ value: 4 });
    expect(parseLevel('1')).toEqual({ value: 1 });
    expect(parseLevel('10')).toEqual({ value: 10 });
  });

  it('rejects zero', () => {
    expect(parseLevel('0')).toEqual({ error: '--level must be a positive integer' });
  });

  it('rejects negative numbers', () => {
    expect(parseLevel('-1')).toEqual({ error: '--level must be a positive integer' });
    expect(parseLevel('-10')).toEqual({ error: '--level must be a positive integer' });
  });

  it('rejects non-integers', () => {
    expect(parseLevel('3.5')).toEqual({ error: '--level must be a positive integer' });
    // Note: Number('1.0') is 1, and Number.isInteger(1) is true, so this passes
    expect(parseLevel('1.0')).toEqual({ value: 1 });
  });

  it('rejects non-numeric strings', () => {
    expect(parseLevel('not-a-number')).toEqual({ error: '--level must be a positive integer' });
    expect(parseLevel('abc')).toEqual({ error: '--level must be a positive integer' });
  });
});

