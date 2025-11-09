import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import type { Browser } from 'puppeteer';
import { startServer } from '@octotree/server';
import { DEFAULT_PORT, DEFAULT_DEVICE_SCALE } from './constants';
import { ensurePngPath } from './utils';
import { getServerPort, buildClientUrl, closeServer } from './server';
import { captureFrame, setupBrowser } from './capture';

export interface CaptureOptions {
  repoPath: string;
  ref?: string;
  width: number;
  height: number;
  requestedPort: number;
  outputPath: string;
  silent?: boolean;
  level?: number;
}

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

    const browserSetup = await setupBrowser({ width, height });
    browser = browserSetup.browser;
    const { page } = browserSetup;

    await fs.mkdir(path.dirname(pngPath), { recursive: true });
    await captureFrame({ page, url: targetUrl, outputPath: pngPath });

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

