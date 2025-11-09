import fs from 'fs/promises';
import http from 'http';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { captureScreenshot } from '../src/screenshot';

vi.mock('fs/promises');
vi.mock('@octotree/server');
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn()
  }
}));

describe('captureScreenshot', () => {
  let mockServer: http.Server;
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures screenshot successfully', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue(mockServer);

    const puppeteer = await import('puppeteer');
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);

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
    expect(puppeteer.default.launch).toHaveBeenCalledWith({ headless: true });
    expect(mockPage.setViewport).toHaveBeenCalledWith({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    });
    expect(mockPage.goto).toHaveBeenCalled();
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('.radial-tree svg', { timeout: 20000 });
    expect(mockPage.waitForFunction).toHaveBeenCalled();
    expect(vi.mocked(fs.mkdir)).toHaveBeenCalled();
    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: 'output.png',
      type: 'png',
      fullPage: false
    });
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

    const puppeteer = await import('puppeteer');
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);

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
    expect(mockPage.setViewport).toHaveBeenCalled();
  });

  it('appends .png extension when missing', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue(mockServer);

    const puppeteer = await import('puppeteer');
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);

    await captureScreenshot({
      repoPath: '/path/to/repo',
      width: 1920,
      height: 1080,
      requestedPort: 3000,
      outputPath: 'output',
      silent: true
    });

    expect(mockPage.setViewport).toHaveBeenCalled();
    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: 'output.png',
      type: 'png',
      fullPage: false
    });
  });

  it('closes browser and server in finally block', async () => {
    const { startServer } = await import('@octotree/server');
    vi.mocked(startServer).mockResolvedValue(mockServer);

    const puppeteer = await import('puppeteer');
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);
    vi.mocked(mockPage.screenshot).mockRejectedValue(new Error('Screenshot failed'));

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

    const puppeteer = await import('puppeteer');
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);

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
    expect(mockPage.setViewport).toHaveBeenCalled();
  });
});

