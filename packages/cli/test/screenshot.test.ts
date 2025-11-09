import fs from 'fs/promises';
import http from 'http';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { captureScreenshot } from '../src/screenshot';

vi.mock('fs/promises');
vi.mock('@octotree/server');
vi.mock('../src/capture');

describe('captureScreenshot', () => {
  let mockServer: http.Server;
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    mockPage = {
      setViewport: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(undefined)
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined)
    };

    mockServer = {
      address: () => ({ port: 3000 }),
      close: vi.fn((callback?: (error?: Error | null) => void) => {
        callback?.(null);
        return {} as http.Server;
      })
    } as unknown as http.Server;

    // Mock the shared capture functions
    const { setupBrowser, captureFrame } = await import('../src/capture');
    vi.mocked(setupBrowser).mockResolvedValue({
      browser: mockBrowser,
      page: mockPage
    });
    vi.mocked(captureFrame).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures screenshot successfully', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue(mockServer);

    const { setupBrowser, captureFrame } = await import('../src/capture');

    const result = await captureScreenshot({
      repoPath: '/path/to/repo',
      width: 1920,
      height: 1080,
      requestedPort: 3000,
      outputPath: 'output.png',
      silent: false,
      level: 3
    });

    expect(result).toBe('output.png');
    expect(startServer).toHaveBeenCalledWith({
      port: 3000,
      repoPath: '/path/to/repo',
      ref: undefined,
      silent: true
    });
    expect(setupBrowser).toHaveBeenCalledWith({
      width: 1920,
      height: 1080
    });
    expect(captureFrame).toHaveBeenCalledWith({
      page: mockPage,
      url: expect.stringContaining('localhost:3000'),
      outputPath: 'output.png',
      navigationTimeout: undefined,
      waitTimeout: undefined
    });
    expect(vi.mocked(fs.mkdir)).toHaveBeenCalled();
  });

  it('uses default port when requestedPort is 0', async () => {
    const { startServer } = await import('@octotree/server');
    const mockServerWithDynamicPort = {
      address: () => ({ port: 5432 }),
      close: vi.fn((callback?: (error?: Error | null) => void) => {
        callback?.(null);
        return {} as http.Server;
      })
    } as unknown as http.Server;
    vi.mocked(startServer).mockResolvedValue(mockServerWithDynamicPort);

    const { captureFrame } = await import('../src/capture');

    await captureScreenshot({
      repoPath: '/path/to/repo',
      width: 1920,
      height: 1080,
      requestedPort: 0,
      outputPath: 'output.png',
      silent: true
    });

    expect(startServer).toHaveBeenCalledWith({
      port: 0,
      repoPath: '/path/to/repo',
      ref: undefined,
      silent: true
    });
    expect(captureFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('localhost:5432')
      })
    );
  });

  it('appends .png extension when missing', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue(mockServer);

    const { captureFrame } = await import('../src/capture');

    await captureScreenshot({
      repoPath: '/path/to/repo',
      width: 1920,
      height: 1080,
      requestedPort: 3000,
      outputPath: 'output',
      silent: true
    });

    expect(captureFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        outputPath: 'output.png'
      })
    );
  });

  it('closes browser and server in finally block', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue(mockServer);

    const { captureFrame } = await import('../src/capture');
    vi.mocked(captureFrame).mockRejectedValue(new Error('Screenshot failed'));

    await expect(
      captureScreenshot({
        repoPath: '/path/to/repo',
        width: 1920,
        height: 1080,
        requestedPort: 3000,
        outputPath: 'output.png',
        silent: true
      })
    ).rejects.toThrow('Screenshot failed');

    expect(mockBrowser.close).toHaveBeenCalled();
    expect(mockServer.close).toHaveBeenCalled();
  });

  it('handles ref parameter in URL', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue(mockServer);

    const { captureFrame } = await import('../src/capture');

    await captureScreenshot({
      repoPath: '/path/to/repo',
      ref: 'abc123',
      width: 1920,
      height: 1080,
      requestedPort: 3000,
      outputPath: 'output.png',
      silent: true
    });

    expect(startServer).toHaveBeenCalledWith({
      port: 3000,
      repoPath: '/path/to/repo',
      ref: 'abc123',
      silent: true
    });
    expect(captureFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('ref=abc123')
      })
    );
  });
});

