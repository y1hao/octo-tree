import puppeteer, { type Browser, type Page } from 'puppeteer';
import { RADIAL_TREE_SVG_SELECTOR, RADIAL_TREE_LINK_SELECTOR } from '@octotree/core';
import { DEFAULT_DEVICE_SCALE } from './constants';

export interface CaptureFrameOptions {
  page: Page;
  url: string;
  outputPath: string;
  navigationTimeout?: number;
  waitTimeout?: number;
}

/**
 * Captures a single frame by navigating to a URL, waiting for the tree to render,
 * and taking a screenshot.
 */
export const captureFrame = async ({
  page,
  url,
  outputPath,
  navigationTimeout = 20000,
  waitTimeout = 20000
}: CaptureFrameOptions): Promise<void> => {
  await page.goto(url, {
    waitUntil: 'networkidle0',
    timeout: navigationTimeout
  });
  await page.waitForSelector(RADIAL_TREE_SVG_SELECTOR, { timeout: waitTimeout });
  await page.waitForFunction(
    () => document.querySelectorAll(RADIAL_TREE_LINK_SELECTOR).length > 0,
    { timeout: waitTimeout }
  );

  await page.screenshot({ path: outputPath as `${string}.png`, type: 'png', fullPage: false });
};

export interface SetupBrowserOptions {
  width: number;
  height: number;
  navigationTimeout?: number;
  waitTimeout?: number;
}

/**
 * Sets up a Puppeteer browser and page with the specified viewport and timeouts.
 */
export const setupBrowser = async ({
  width,
  height,
  navigationTimeout,
  waitTimeout
}: SetupBrowserOptions): Promise<{ browser: Browser; page: Page }> => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: DEFAULT_DEVICE_SCALE });
  
  if (navigationTimeout !== undefined) {
    page.setDefaultNavigationTimeout(navigationTimeout);
  }
  if (waitTimeout !== undefined) {
    page.setDefaultTimeout(waitTimeout);
  }

  return { browser, page };
};

