import { EventEmitter } from 'events';
import http from 'http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'child_process';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}));

vi.mock('child_process', () => ({
  spawn: spawnMock
}));
import {
  closeServer,
  ensureMp4Path,
  ensurePngPath,
  getServerPort,
  parseAspect,
  parseCommitBound,
  parseWidth,
  runProcess,
  sampleCommits
} from '../src';

afterEach(() => {
  spawnMock.mockReset();
});

describe('path helpers', () => {
  it('appends .png when missing', () => {
    expect(ensurePngPath('output')).toBe('output.png');
  });

  it('preserves existing .png extension', () => {
    expect(ensurePngPath('snapshot.PNG')).toBe('snapshot.PNG');
  });

  it('appends .mp4 when missing', () => {
    expect(ensureMp4Path('video')).toBe('video.mp4');
  });

  it('preserves existing .mp4 extension', () => {
    expect(ensureMp4Path('demo.MP4')).toBe('demo.MP4');
  });
});

describe('parse helpers', () => {
  it('returns default width when value is undefined', () => {
    expect(parseWidth(undefined)).toBe(1440);
  });

  it('rejects non-positive width values', () => {
    expect(parseWidth('0')).toBeNull();
    expect(parseWidth('-10')).toBeNull();
    expect(parseWidth('abc')).toBeNull();
  });

  it('parses aspect ratios and rounds components', () => {
    expect(parseAspect(undefined)).toEqual({ x: 4, y: 3 });
    expect(parseAspect('16:9')).toEqual({ x: 16, y: 9 });
    expect(parseAspect('1.2:3.4')).toEqual({ x: 1, y: 3 });
  });

  it('rejects malformed aspect ratios', () => {
    expect(parseAspect('16-9')).toBeNull();
    expect(parseAspect('16:x')).toBeNull();
    expect(parseAspect('0:4')).toBeNull();
  });

  it('validates commit bounds', () => {
    expect(parseCommitBound(undefined, '--from')).toEqual({ value: undefined });
    expect(parseCommitBound('3', '--from')).toEqual({ value: 3 });
    expect(parseCommitBound('0', '--from')).toEqual({ error: '--from must be a positive integer' });
    expect(parseCommitBound('abc', '--to')).toEqual({ error: '--to must be a positive integer' });
  });
});

describe('commit sampling', () => {
  it('returns all commits when below frame budget', () => {
    const commits = ['a', 'b', 'c'];
    expect(sampleCommits(commits, 5)).toEqual(commits);
  });

  it('samples commits evenly across history', () => {
    const commits = Array.from({ length: 10 }, (_, index) => `c${index}`);
    const sampled = sampleCommits(commits, 4);
    expect(sampled[0]).toBe('c0');
    expect(sampled[sampled.length - 1]).toBe('c9');
    expect(new Set(sampled).size).toBe(sampled.length);
  });
});

describe('server helpers', () => {
  it('resolves immediately when server is null', async () => {
    await expect(closeServer(null)).resolves.toBeUndefined();
  });

  it('closes server successfully', async () => {
    const close = vi.fn((callback?: (error?: Error | null) => void) => {
      callback?.(null);
      return {} as http.Server;
    });
    const server = { close } as unknown as http.Server;

    await expect(closeServer(server)).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('propagates close errors', async () => {
    const close = vi.fn((callback?: (error?: Error | null) => void) => {
      callback?.(new Error('boom'));
      return {} as http.Server;
    });
    const server = { close } as unknown as http.Server;

    await expect(closeServer(server)).rejects.toThrow('boom');
  });

  it('extracts dynamic ports from address objects', () => {
    const server = {
      address: () => ({ port: 4321 })
    } as unknown as http.Server;
    expect(getServerPort(server)).toBe(4321);
  });

  it('throws when port cannot be determined', () => {
    const server = {
      address: () => null
    } as unknown as http.Server;
    expect(() => getServerPort(server)).toThrow('Failed to determine server port');
  });
});

describe('runProcess', () => {
  it('resolves when the child exits with code 0', async () => {
    spawnMock.mockImplementation(() => {
      const emitter = new EventEmitter() as ChildProcess;
      process.nextTick(() => {
        emitter.emit('close', 0);
      });
      return emitter;
    });

    await expect(runProcess('echo', ['ok'], {})).resolves.toBeUndefined();
    expect(spawnMock).toHaveBeenCalledWith('echo', ['ok'], { cwd: undefined, stdio: 'inherit' });
  });

  it('rejects when the child exits with a non-zero code', async () => {
    spawnMock.mockImplementation(() => {
      const emitter = new EventEmitter() as ChildProcess;
      process.nextTick(() => {
        emitter.emit('close', 2);
      });
      return emitter;
    });

    await expect(runProcess('echo', ['fail'], {})).rejects.toThrow('echo exited with code 2');
  });
});
