import { describe, expect, it } from 'vitest';
import { sampleCommits } from '../src/git';


describe('sampleCommits', () => {
  it('returns all commits when below frame budget', () => {
    const commits = ['a', 'b', 'c'];
    expect(sampleCommits(commits, 5)).toEqual(commits);
  });

  it('returns all commits when exactly at frame budget', () => {
    const commits = ['a', 'b', 'c'];
    expect(sampleCommits(commits, 3)).toEqual(commits);
  });

  it('samples commits evenly across history', () => {
    const commits = Array.from({ length: 10 }, (_, index) => `c${index}`);
    const sampled = sampleCommits(commits, 4);
    expect(sampled[0]).toBe('c0');
    expect(sampled[sampled.length - 1]).toBe('c9');
    expect(new Set(sampled).size).toBe(sampled.length);
    expect(sampled.length).toBeLessThanOrEqual(4);
  });

  it('always includes the last commit', () => {
    const commits = Array.from({ length: 100 }, (_, index) => `c${index}`);
    const sampled = sampleCommits(commits, 5);
    expect(sampled[sampled.length - 1]).toBe('c99');
  });

  it('handles single commit', () => {
    const commits = ['a'];
    expect(sampleCommits(commits, 5)).toEqual(['a']);
  });

  it('handles zero maxFrames by using 1', () => {
    const commits = Array.from({ length: 10 }, (_, index) => `c${index}`);
    const sampled = sampleCommits(commits, 0);
    expect(sampled.length).toBeGreaterThan(0);
    expect(sampled[sampled.length - 1]).toBe('c9');
  });

  it('handles negative maxFrames by using 1', () => {
    const commits = Array.from({ length: 10 }, (_, index) => `c${index}`);
    const sampled = sampleCommits(commits, -5);
    expect(sampled.length).toBeGreaterThan(0);
    expect(sampled[sampled.length - 1]).toBe('c9');
  });
});
