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
const SCREENSHOT_WIDTH = 1920;
const SCREENSHOT_HEIGHT = Math.round((SCREENSHOT_WIDTH * 3) / 4); // 4:3 aspect ratio

interface ServeOptions {
  repo?: string;
  port?: string;
}

interface ScreenshotOptions {
  repo?: string;
  port?: string;
  output?: string;
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

const screenshotAction = async (options: ScreenshotOptions) => {
  const repoPath = path.resolve(options.repo ?? process.cwd());
  const outputPath = path.resolve(options.output ?? 'octo-tree.png');
  const parsedPort = Number(options.port ?? '0');

  if (Number.isNaN(parsedPort)) {
    console.error('Port must be a number');
    process.exitCode = 1;
    return;
  }

  let server: http.Server | null = null;
  let browser: Browser | null = null;

  try {
    const requestedPort = parsedPort === 0 ? 0 : parsedPort || DEFAULT_PORT;
    server = await startServer({ port: requestedPort, repoPath });
    const port = requestedPort === 0 ? getServerPort(server) : requestedPort;
    const url = `http://localhost:${port}`;

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT, deviceScaleFactor: 1 });
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
    await page.screenshot({
      path: finalOutputPath as `${string}.png`,
      type: 'png',
      fullPage: false
    });
    console.log(`Saved screenshot to ${finalOutputPath}`);
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
  .action(async (options) => {
    await screenshotAction(options as { repo?: string; port?: string; output?: string });
  });

program.parseAsync(process.argv);
