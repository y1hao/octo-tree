import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import puppeteer, { Browser } from 'puppeteer';
import { startServer } from '@octotree/server';
import { RADIAL_TREE_SVG_SELECTOR, RADIAL_TREE_LINK_SELECTOR } from '@octotree/core';
import { DEFAULT_PORT, DEFAULT_DEVICE_SCALE } from './constants';
import { CaptureOptions } from './types';
import { ensurePngPath } from './utils';
import { getServerPort, buildClientUrl, closeServer } from './server';

export const captureScreenshot = async ({
  repoPath,
  ref,
  width,
  height,
  requestedPort,
  outputPath,
  silent = false,
  level
}: CaptureOptions): Promise<string> => {
  const pngPath = ensurePngPath(outputPath);

  let server: http.Server | null = null;
  let browser: Browser | null = null;

  try {
    const portPreference = requestedPort === 0 ? 0 : requestedPort || DEFAULT_PORT;
    server = await startServer({ port: portPreference, repoPath, ref, silent: true });
    const port = portPreference === 0 ? getServerPort(server) : portPreference;
    const urlBase = `http://localhost:${port}`;
    const targetUrl = buildClientUrl(urlBase, { ref, level });

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: DEFAULT_DEVICE_SCALE });
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector(RADIAL_TREE_SVG_SELECTOR, { timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelectorAll(RADIAL_TREE_LINK_SELECTOR).length > 0,
      { timeout: 20000 }
    );

    await fs.mkdir(path.dirname(pngPath), { recursive: true });
    await page.screenshot({ path: pngPath, type: 'png', fullPage: false });

    if (!silent) {
      console.log(
        `Saved ${width}x${height} (CSS px) screenshot${ref ? ` at ref ${ref}` : ''} to ${pngPath} (device scale factor ${DEFAULT_DEVICE_SCALE})`
      );
    }

    return pngPath;
  } finally {
    await Promise.allSettled([browser?.close(), closeServer(server)]);
  }
};

