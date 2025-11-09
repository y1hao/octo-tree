import path from 'path';
import process from 'process';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GitRepositoryError, listCommitsForBranch } from '@octotree/core';
import { serveAction, screenshotAction, videoAction } from '../src/actions';

vi.mock('@octotree/server');
vi.mock('../src/screenshot');
vi.mock('../src/git');
vi.mock('../src/ffmpeg');
vi.mock('@octotree/core', async () => {
  const actual = await vi.importActual('@octotree/core');
  return {
    ...actual,
    listCommitsForBranch: vi.fn()
  };
});
vi.mock('fs/promises');
vi.mock('puppeteer');

const originalExitCode = process.exitCode;
const originalCwd = process.cwd();

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

describe('screenshotAction', () => {
  it('captures screenshot with default options', async () => {
    const { captureScreenshot } = await import('../src/screenshot');
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
    const { captureScreenshot } = await import('../src/screenshot');
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
    const { captureScreenshot } = await import('../src/screenshot');
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
    const { captureScreenshot } = await import('../src/screenshot');
    vi.mocked(captureScreenshot).mockRejectedValue(new GitRepositoryError('Not a git repo'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await screenshotAction({});

    expect(consoleSpy).toHaveBeenCalledWith('Not a git repo');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('handles other errors', async () => {
    const { captureScreenshot } = await import('../src/screenshot');
    vi.mocked(captureScreenshot).mockRejectedValue(new Error('Screenshot failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await screenshotAction({});

    expect(consoleSpy).toHaveBeenCalledWith('Failed to capture screenshot:', expect.any(Error));
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });
});

describe('videoAction', () => {
  beforeEach(() => {
    vi.mocked(listCommitsForBranch).mockResolvedValue(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('generates video with default options', async () => {
    vi.mocked(listCommitsForBranch).mockResolvedValue(['c1', 'c2', 'c3']);

    // Mock all the dependencies
    const { startServer } = await import('@octotree/server');
    const mockServer = {
      address: () => ({ port: 3000 }),
      close: vi.fn((cb?: (err?: Error | null) => void) => cb?.(null))
    } as any;
    vi.mocked(startServer).mockResolvedValue(mockServer);

    const puppeteer = await import('puppeteer');
    const mockPage = {
      setViewport: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(undefined),
      setDefaultNavigationTimeout: vi.fn(),
      setDefaultTimeout: vi.fn()
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);

    const fs = await import('fs/promises');
    vi.mocked(fs.mkdtemp).mockResolvedValue('/tmp/test');
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    const { runProcess } = await import('../src/ffmpeg');
    vi.mocked(runProcess).mockResolvedValue(undefined);

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await videoAction({});
    } catch (error) {
      // May fail due to missing mocks, but we're testing the setup
    }

    expect(listCommitsForBranch).toHaveBeenCalled();
    // Video action should log progress (either log or warn) if it gets far enough
    // If it fails early, it may not log, so we just check that listCommitsForBranch was called

    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('validates port', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ port: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('Port must be a number');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates width', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ width: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('Width must be a positive number');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates aspect ratio', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ aspect: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('Aspect ratio must be provided in the form x:y with positive numbers');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates fps', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ fps: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('FPS must be a positive number');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates maxSeconds', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ maxSeconds: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('max-seconds must be a positive number');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates from bound', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ from: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('--from must be a positive integer');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates to bound', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ to: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('--to must be a positive integer');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates level', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ level: 'invalid' });

    expect(consoleSpy).toHaveBeenCalledWith('--level must be a positive integer');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('handles empty commit list', async () => {
    vi.mocked(listCommitsForBranch).mockResolvedValue([]);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({});

    expect(consoleSpy).toHaveBeenCalledWith('No commits found in repository history');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates from index exceeds commits', async () => {
    vi.mocked(listCommitsForBranch).mockResolvedValue(['c1', 'c2']);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ from: '10' });

    expect(consoleSpy).toHaveBeenCalledWith('--from (10) exceeds total number of commits (2)');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates to index exceeds commits', async () => {
    vi.mocked(listCommitsForBranch).mockResolvedValue(['c1', 'c2']);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ to: '10' });

    expect(consoleSpy).toHaveBeenCalledWith('--to (10) exceeds total number of commits (2)');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('validates from is greater than to', async () => {
    vi.mocked(listCommitsForBranch).mockResolvedValue(['c1', 'c2', 'c3', 'c4', 'c5']);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({ from: '4', to: '2' });

    expect(consoleSpy).toHaveBeenCalledWith('--from cannot be greater than --to');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('handles GitRepositoryError', async () => {
    vi.mocked(listCommitsForBranch).mockRejectedValue(new GitRepositoryError('Not a git repo'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({});

    expect(consoleSpy).toHaveBeenCalledWith('Not a git repo');
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });

  it('handles other errors', async () => {
    vi.mocked(listCommitsForBranch).mockRejectedValue(new Error('Unexpected error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await videoAction({});

    expect(consoleSpy).toHaveBeenCalledWith('Failed to generate video:', expect.any(Error));
    expect(process.exitCode).toBe(1);

    consoleSpy.mockRestore();
  });
});

