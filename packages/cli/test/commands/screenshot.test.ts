import process from 'process';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GitRepositoryError } from '@octotree/core';
import { screenshotAction } from '../../src/commands/screenshot';

vi.mock('../../src/screenshot');

const originalExitCode = process.exitCode;

beforeEach(() => {
  process.exitCode = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  process.exitCode = originalExitCode;
});

describe('screenshotAction', () => {
  it('captures screenshot with default options', async () => {
    const { captureScreenshot } = await import('../../src/screenshot');
    vi.mocked(captureScreenshot).mockResolvedValue('octo-tree.png');

    await screenshotAction({});

    expect(captureScreenshot).toHaveBeenCalledWith({
      repoPath: expect.any(String),
      ref: undefined,
      width: 1440,
      height: 1080,
      requestedPort: 0,
      outputPath: expect.stringContaining('octo-tree.png'),
      silent: false,
      level: undefined
    });
  });

  it('validates port', async () => {
    const { captureScreenshot } = await import('../../src/screenshot');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await screenshotAction({ port: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('Port must be a number');
    expect(process.exitCode).toBe(1);
    expect(captureScreenshot).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('validates width', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await screenshotAction({ width: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('Width must be a positive number');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates aspect ratio', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await screenshotAction({ aspect: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('Aspect ratio must be provided in the form x:y with positive numbers');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates level', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await screenshotAction({ level: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('--level must be a positive integer');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('calculates height from width and aspect ratio', async () => {
    const { captureScreenshot } = await import('../../src/screenshot');
    vi.mocked(captureScreenshot).mockResolvedValue('output.png');

    await screenshotAction({ width: '1920', aspect: '16:9' });

    expect(captureScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 1920,
        height: 1080 // 1920 * 9 / 16 = 1080
      })
    );
  });

  it('handles GitRepositoryError', async () => {
    const { captureScreenshot } = await import('../../src/screenshot');
    vi.mocked(captureScreenshot).mockRejectedValue(new GitRepositoryError('Not a git repo'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await screenshotAction({});

    expect(consoleSpy).toHaveBeenCalledWith('Not a git repo');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('handles other errors', async () => {
    const { captureScreenshot } = await import('../../src/screenshot');
    vi.mocked(captureScreenshot).mockRejectedValue(new Error('Screenshot failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await screenshotAction({});

    expect(consoleSpy).toHaveBeenCalledWith('Failed to capture screenshot:', expect.any(Error));
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });
});

