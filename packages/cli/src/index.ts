#!/usr/bin/env node
import fs from 'fs/promises';
import http from 'http';
import { Command } from 'commander';
import path from 'path';
import process from 'process';
import puppeteer, { Browser } from 'puppeteer';
import { startServer } from '@octotree/server';
import { GitRepositoryError } from '@octotree/core';

const program = new Command();

const DEFAULT_PORT = 3000;
const DEFAULT_WIDTH = 1440;
const DEFAULT_ASPECT_X = 4;
const DEFAULT_ASPECT_Y = 3;

interface ServeOptions {
  repo?: string;
  port?: string;
}

interface ScreenshotOptions {
  repo?: string;
  port?: string;
  output?: string;
  width?: string;
  aspect?: string;
}

const serveAction = async (options: ServeOptions) => {
  const port = Number(options.port ?? DEFAULT_PORT.toString());
  if (Number.isNaN(port)) {
    console.error('Port must be a number');
    process.exitCode = 1;
    return;
  }

  const repoPath = path.resolve(options.repo ?? process.cwd());
  console.log(`Launching visualization for repo: ${repoPath}`);

  try {
    await startServer({ port, repoPath });
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    console.error('Failed to start server:', error);
    process.exitCode = 1;
  }
};

const closeServer = (server: http.Server | null): Promise<void> => {
  if (!server) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

const getServerPort = (server: http.Server): number => {
  const address = server.address();
  if (typeof address === 'object' && address && 'port' in address) {
    return address.port;
  }
  throw new Error('Failed to determine server port');
};

const parseWidth = (rawWidth: string | undefined): number | null => {
  if (!rawWidth) {
    return DEFAULT_WIDTH;
  }
  const width = Number(rawWidth);
  if (Number.isNaN(width) || width <= 0) {
    return null;
  }
  return Math.round(width);
};

const parseAspect = (rawAspect: string | undefined): { x: number; y: number } | null => {
  if (!rawAspect) {
    return { x: DEFAULT_ASPECT_X, y: DEFAULT_ASPECT_Y };
  }
  const parts = rawAspect.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const [xPart, yPart] = parts;
  const x = Number(xPart);
  const y = Number(yPart);
  if (Number.isNaN(x) || Number.isNaN(y) || x <= 0 || y <= 0) {
    return null;
  }
  return { x: Math.round(x), y: Math.round(y) };
};

const screenshotAction = async (options: ScreenshotOptions) => {
  const repoPath = path.resolve(options.repo ?? process.cwd());
  const outputPath = path.resolve(options.output ?? 'octo-tree.png');
  const parsedPort = Number(options.port ?? '0');

  if (Number.isNaN(parsedPort)) {
    console.error('Port must be a number');
    process.exitCode = 1;
    return;
  }

  const width = parseWidth(options.width);
  if (width == null) {
    console.error('Width must be a positive number');
    process.exitCode = 1;
    return;
  }

  const aspect = parseAspect(options.aspect);
  if (!aspect) {
    console.error('Aspect ratio must be provided in the form x:y with positive numbers');
    process.exitCode = 1;
    return;
  }

  const height = Math.round((width * aspect.y) / aspect.x);

  let server: http.Server | null = null;
  let browser: Browser | null = null;

  try {
    const requestedPort = parsedPort === 0 ? 0 : parsedPort || DEFAULT_PORT;
    server = await startServer({ port: requestedPort, repoPath });
    const port = requestedPort === 0 ? getServerPort(server) : requestedPort;
    const url = `http://localhost:${port}`;

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.radial-tree svg', { timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelectorAll('.radial-tree__link').length > 0,
      { timeout: 20000 }
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const finalOutputPath = outputPath.toLowerCase().endsWith('.png')
      ? outputPath
      : `${outputPath}.png`;
    const screenshotOptions = {
      path: finalOutputPath as `${string}.png`,
      type: 'png' as const,
      fullPage: false
    };
    await page.screenshot(screenshotOptions);
    console.log(
      `Saved ${width}x${height} (CSS px) screenshot to ${finalOutputPath} (device scale factor 2)`
    );
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    console.error('Failed to capture screenshot:', error);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([browser?.close(), closeServer(server)]);
  }
};

program
  .name('octo-tree')
  .description('Radial file tree visualization for git repositories');

program
  .command('serve', { isDefault: true })
  .description('Launch the radial file tree web server')
  .option('-r, --repo <path>', 'Path to the repository to visualize', process.cwd())
  .option('-p, --port <number>', 'Port to run the web server on', DEFAULT_PORT.toString())
  .action(async (options) => {
    await serveAction(options as ServeOptions);
  });

program
  .command('screenshot')
  .description('Generate a PNG screenshot of the radial file tree web UI')
  .option('-r, --repo <path>', 'Path to the repository to visualize', process.cwd())
  .option('-p, --port <number>', 'Port to run the web server on (0 selects a random open port)', '0')
  .option('-o, --output <path>', 'Output path for the PNG file', 'octo-tree.png')
  .option('-w, --width <number>', 'Horizontal side length in CSS pixels', DEFAULT_WIDTH.toString())
  .option(
    '-a, --aspect <ratio>',
    `Aspect ratio for width:height (format x:y)`,
    `${DEFAULT_ASPECT_X}:${DEFAULT_ASPECT_Y}`
  )
  .action(async (options) => {
    await screenshotAction(options as ScreenshotOptions);
  });

program.parseAsync(process.argv);
