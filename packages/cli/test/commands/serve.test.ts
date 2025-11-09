import path from 'path';
import process from 'process';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GitRepositoryError } from '@octotree/core';
import { serveAction } from '../../src/commands/serve';

vi.mock('@octotree/server');

const originalExitCode = process.exitCode;

beforeEach(() => {
  process.exitCode = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  process.exitCode = originalExitCode;
});

describe('serveAction', () => {
  it('starts server with default port when not specified', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue({} as any);

    await serveAction({});

    expect(startServer).toHaveBeenCalledWith({
      port: 3000,
      repoPath: expect.any(String),
      ref: undefined
    });
  });

  it('starts server with specified port', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue({} as any);

    await serveAction({ port: '8080' });

    expect(startServer).toHaveBeenCalledWith({
      port: 8080,
      repoPath: expect.any(String),
      ref: undefined
    });
  });

  it('starts server with specified repo path', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue({} as any);

    await serveAction({ repo: '/custom/path' });

    expect(startServer).toHaveBeenCalledWith({
      port: 3000,
      repoPath: path.resolve('/custom/path'),
      ref: undefined
    });
  });

  it('starts server with specified ref', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue({} as any);

    await serveAction({ ref: 'abc123' });

    expect(startServer).toHaveBeenCalledWith({
      port: 3000,
      repoPath: expect.any(String),
      ref: 'abc123'
    });
  });

  it('sets exit code to 1 when port is invalid', async () => {
    await serveAction({ port: 'invalid' });
    expect(process.exitCode).toBe(1);
  });

  it('sets exit code to 1 when level is invalid', async () => {
    await serveAction({ level: 'invalid' });
    expect(process.exitCode).toBe(1);
  });

  it('handles GitRepositoryError', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockRejectedValue(new GitRepositoryError('Not a git repo'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await serveAction({});

    expect(consoleSpy).toHaveBeenCalledWith('Not a git repo');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('handles other errors', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockRejectedValue(new Error('Server error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await serveAction({});

    expect(consoleSpy).toHaveBeenCalledWith('Failed to start server:', expect.any(Error));
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });
});

