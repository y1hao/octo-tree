import { describe, expect, it, vi, beforeEach } from 'vitest';
import { captureFrame, setupBrowser } from '../src/capture';
import type { Page } from 'puppeteer';

vi.mock('puppeteer');
vi.mock('@octotree/core', () => ({
  RADIAL_TREE_SVG_SELECTOR: 'svg.radial-tree',
  RADIAL_TREE_LINK_SELECTOR: '.radial-tree-link'
}));

describe('captureFrame', () => {
  let mockPage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForFunction: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('captures frame successfully', async () => {
    await captureFrame({
      page: mockPage as Page,
      url: 'http://localhost:3000',
      outputPath: 'output.png'
    });

    expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000', {
      waitUntil: 'load',
      timeout: 20000
    });
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('svg.radial-tree', {
      timeout: 20000
    });
    expect(mockPage.waitForFunction).toHaveBeenCalled();
    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: 'output.png',
      type: 'png',
      fullPage: false
    });
  });

  it('uses custom timeouts', async () => {
    await captureFrame({
      page: mockPage as Page,
      url: 'http://localhost:3000',
      outputPath: 'output.png',
      navigationTimeout: 60000,
      waitTimeout: 30000
    });

    expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000', {
      waitUntil: 'load',
      timeout: 60000
    });
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('svg.radial-tree', {
      timeout: 30000
    });
    expect(mockPage.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 30000 },
      '.radial-tree-link'
    );
  });

  it('waits for links to render', async () => {
    await captureFrame({
      page: mockPage as Page,
      url: 'http://localhost:3000',
      outputPath: 'output.png'
    });

    expect(mockPage.waitForFunction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 20000 },
      '.radial-tree-link'
    );

    // Verify the function checks for links
    const waitFunction = vi.mocked(mockPage.waitForFunction).mock.calls[0][0];
    // The function will be executed in browser context, so we just verify it was called
    // with a function that checks for links
    expect(typeof waitFunction).toBe('function');
  });
});

describe('setupBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets up browser with default viewport', async () => {
    const puppeteer = await import('puppeteer');
    const mockPage = {
      setViewport: vi.fn().mockResolvedValue(undefined),
      setDefaultNavigationTimeout: vi.fn(),
      setDefaultTimeout: vi.fn()
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);

    const result = await setupBrowser({
      width: 1920,
      height: 1080
    });

    expect(puppeteer.default.launch).toHaveBeenCalledWith({ headless: true });
    expect(mockBrowser.newPage).toHaveBeenCalled();
    expect(mockPage.setViewport).toHaveBeenCalledWith({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    });
    expect(result.browser).toBe(mockBrowser);
    expect(result.page).toBe(mockPage);
  });

  it('sets custom timeouts when provided', async () => {
    const puppeteer = await import('puppeteer');
    const mockPage = {
      setViewport: vi.fn().mockResolvedValue(undefined),
      setDefaultNavigationTimeout: vi.fn(),
      setDefaultTimeout: vi.fn()
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);

    await setupBrowser({
      width: 1920,
      height: 1080,
      navigationTimeout: 60000,
      waitTimeout: 30000
    });

    expect(mockPage.setDefaultNavigationTimeout).toHaveBeenCalledWith(60000);
    expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(30000);
  });

  it('does not set timeouts when not provided', async () => {
    const puppeteer = await import('puppeteer');
    const mockPage = {
      setViewport: vi.fn().mockResolvedValue(undefined),
      setDefaultNavigationTimeout: vi.fn(),
      setDefaultTimeout: vi.fn()
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined)
    };
    vi.mocked(puppeteer.default.launch).mockResolvedValue(mockBrowser as any);

    await setupBrowser({
      width: 1920,
      height: 1080
    });

    expect(mockPage.setDefaultNavigationTimeout).not.toHaveBeenCalled();
    expect(mockPage.setDefaultTimeout).not.toHaveBeenCalled();
  });
});

