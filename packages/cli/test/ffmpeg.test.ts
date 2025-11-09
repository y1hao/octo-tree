import { EventEmitter } from 'events';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { ChildProcess } from 'child_process';
import { getFfmpegExecutable, runProcess } from '../src/ffmpeg';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}));

vi.mock('child_process', () => ({
  spawn: spawnMock
}));

afterEach(() => {
  spawnMock.mockReset();
});

describe('getFfmpegExecutable', () => {
  it('returns a string', () => {
    const result = getFfmpegExecutable();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
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

  it('passes cwd option to spawn', async () => {
    spawnMock.mockImplementation(() => {
      const emitter = new EventEmitter() as ChildProcess;
      process.nextTick(() => {
        emitter.emit('close', 0);
      });
      return emitter;
    });

    await expect(runProcess('command', ['arg'], { cwd: '/tmp' })).resolves.toBeUndefined();
    expect(spawnMock).toHaveBeenCalledWith('command', ['arg'], { cwd: '/tmp', stdio: 'inherit' });
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

  it('rejects when spawn fails', async () => {
    spawnMock.mockImplementation(() => {
      const emitter = new EventEmitter() as ChildProcess;
      process.nextTick(() => {
        emitter.emit('error', new Error('command not found'));
      });
      return emitter;
    });

    await expect(runProcess('nonexistent', [], {})).rejects.toThrow('command not found');
  });
});

