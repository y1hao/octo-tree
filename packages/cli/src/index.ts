#!/usr/bin/env node
import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import { spawn } from 'child_process';
import { Command } from 'commander';
import path from 'path';
import process from 'process';
import puppeteer, { Browser, TimeoutError } from 'puppeteer';
import ffmpegStatic from 'ffmpeg-static';
import { startServer } from '@octotree/server';
import { GitRepositoryError } from '@octotree/core';

const program = new Command();

const DEFAULT_PORT = 3000;
const DEFAULT_WIDTH = 1440;
const DEFAULT_ASPECT_X = 4;
const DEFAULT_ASPECT_Y = 3;
const DEFAULT_DEVICE_SCALE = 2;
const VIDEO_NAVIGATION_TIMEOUT_MS = 120_000;
const VIDEO_WAIT_TIMEOUT_MS = 120_000;

export const ensurePngPath = (outputPath: string): `${string}.png` => {
  if (outputPath.toLowerCase().endsWith('.png')) {
    return outputPath as `${string}.png`;
  }
  return `${outputPath}.png` as `${string}.png`;
};

export const ensureMp4Path = (outputPath: string): `${string}.mp4` => {
  if (outputPath.toLowerCase().endsWith('.mp4')) {
    return outputPath as `${string}.mp4`;
  }
  return `${outputPath}.mp4` as `${string}.mp4`;
};

interface ServeOptions {
  repo?: string;
  port?: string;
  ref?: string;
  level?: string;
}

interface ScreenshotOptions {
  repo?: string;
  port?: string;
  output?: string;
  width?: string;
  aspect?: string;
  ref?: string;
  level?: string;
}

interface VideoOptions {
  repo?: string;
  port?: string;
  output?: string;
  width?: string;
  aspect?: string;
  fps?: string;
  maxSeconds?: string;
  from?: string;
  to?: string;
  level?: string;
}

interface ClientUrlOptions {
  ref?: string;
  level?: number;
}

export const buildClientUrl = (baseUrl: string, { ref, level }: ClientUrlOptions): string => {
  const targetUrl = new URL(baseUrl);
  if (ref) {
    targetUrl.searchParams.set('ref', ref);
  }
  if (typeof level === 'number') {
    targetUrl.searchParams.set('level', level.toString());
  }
  return targetUrl.toString();
};

const serveAction = async (options: ServeOptions) => {
  const port = Number(options.port ?? DEFAULT_PORT.toString());
  if (Number.isNaN(port)) {
    console.error('Port must be a number');
    process.exitCode = 1;
    return;
  }

  const repoPath = path.resolve(options.repo ?? process.cwd());
  const requestedRef = options.ref;
  const ref = requestedRef ?? 'HEAD';

  const levelResult = parseLevel(options.level);
  if (levelResult.error) {
    console.error(levelResult.error);
    process.exitCode = 1;
    return;
  }
  console.log(`Launching visualization for repo: ${repoPath} at ref ${ref}`);

  try {
    await startServer({ port, repoPath, ref: requestedRef, level: levelResult.value });
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

export const closeServer = (server: http.Server | null): Promise<void> => {
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

export const getServerPort = (server: http.Server): number => {
  const address = server.address();
  if (typeof address === 'object' && address && 'port' in address) {
    return address.port;
  }
  throw new Error('Failed to determine server port');
};

export const parseWidth = (rawWidth: string | undefined): number | null => {
  if (!rawWidth) {
    return DEFAULT_WIDTH;
  }
  const width = Number(rawWidth);
  if (Number.isNaN(width) || width <= 0) {
    return null;
  }
  return Math.round(width);
};

export const parseAspect = (rawAspect: string | undefined): { x: number; y: number } | null => {
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

export const parseCommitBound = (
  rawValue: string | undefined,
  flag: '--from' | '--to'
): { value?: number; error?: string } => {
  if (rawValue == null) {
    return { value: undefined };
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${flag} must be a positive integer` };
  }
  return { value: parsed };
};

export const parseLevel = (rawValue: string | undefined): { value?: number; error?: string } => {
  if (rawValue == null) {
    return {};
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: '--level must be a positive integer' };
  }

  return { value: parsed };
};

interface CaptureOptions {
  repoPath: string;
  ref?: string;
  width: number;
  height: number;
  requestedPort: number;
  outputPath: string;
  silent?: boolean;
  level?: number;
}

const captureScreenshot = async ({
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
    server = await startServer({ port: portPreference, repoPath, ref, silent: true, level });
    const port = portPreference === 0 ? getServerPort(server) : portPreference;
    const urlBase = `http://localhost:${port}`;
    const targetUrl = buildClientUrl(urlBase, { ref, level });

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: DEFAULT_DEVICE_SCALE });
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.radial-tree svg', { timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelectorAll('.radial-tree__link').length > 0,
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

export const runGit = async (repoPath: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: repoPath });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new GitRepositoryError(stderr.trim() || `git ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
};

export const listCommitsForBranch = async (repoPath: string): Promise<string[]> => {
  const output = await runGit(repoPath, ['rev-list', '--reverse', 'HEAD']);
  return output
    .split('\n')
    .map((commit) => commit.trim())
    .filter((commit) => commit.length > 0);
};

export const sampleCommits = (commits: string[], maxFrames: number): string[] => {
  if (commits.length <= maxFrames) {
    return commits;
  }

  const frameCount = Math.max(1, maxFrames);
  const lastIndex = commits.length - 1;
  const indices = new Set<number>();

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const index = Math.floor((frameIndex * lastIndex) / Math.max(frameCount - 1, 1));
    indices.add(Math.min(index, lastIndex));
  }
  indices.add(lastIndex);

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => commits[index]);
};

export const getFfmpegExecutable = (): string => {
  if (typeof ffmpegStatic === 'string' && ffmpegStatic.length > 0) {
    return ffmpegStatic;
  }
  return 'ffmpeg';
};

export const runProcess = async (
  command: string,
  args: string[],
  options: { cwd?: string }
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: 'inherit' });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
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

  const requestedRef = options.ref;
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

  const levelResult = parseLevel(options.level);
  if (levelResult.error) {
    console.error(levelResult.error);
    process.exitCode = 1;
    return;
  }

  const height = Math.round((width * aspect.y) / aspect.x);

  try {
    await captureScreenshot({
      repoPath,
      ref: requestedRef,
      width,
      height,
      requestedPort: parsedPort,
      outputPath,
      silent: false,
      level: levelResult.value
    });
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    console.error('Failed to capture screenshot:', error);
    process.exitCode = 1;
  }
};

const videoAction = async (options: VideoOptions) => {
  const repoPath = path.resolve(options.repo ?? process.cwd());
  const outputPath = path.resolve(options.output ?? 'octo-tree.mp4');
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

  const fpsValue = Number(options.fps ?? '10');
  if (Number.isNaN(fpsValue) || fpsValue <= 0) {
    console.error('FPS must be a positive number');
    process.exitCode = 1;
    return;
  }

  const maxSecondsValue = Number(options.maxSeconds ?? '60');
  if (Number.isNaN(maxSecondsValue) || maxSecondsValue <= 0) {
    console.error('max-seconds must be a positive number');
    process.exitCode = 1;
    return;
  }

  const frameBudget = Math.max(1, Math.round(fpsValue * maxSecondsValue));

  const fromResult = parseCommitBound(options.from, '--from');
  if (fromResult.error) {
    console.error(fromResult.error);
    process.exitCode = 1;
    return;
  }

  const toResult = parseCommitBound(options.to, '--to');
  if (toResult.error) {
    console.error(toResult.error);
    process.exitCode = 1;
    return;
  }

  const levelResult = parseLevel(options.level);
  if (levelResult.error) {
    console.error(levelResult.error);
    process.exitCode = 1;
    return;
  }

  try {
    const commits = await listCommitsForBranch(repoPath);
    if (commits.length === 0) {
      console.error('No commits found in repository history');
      process.exitCode = 1;
      return;
    }

    const fromIndex = fromResult.value ?? 1;
    const toIndex = toResult.value ?? commits.length;

    if (fromIndex > commits.length) {
      console.error(`--from (${fromIndex}) exceeds total number of commits (${commits.length})`);
      process.exitCode = 1;
      return;
    }

    if (toIndex > commits.length) {
      console.error(`--to (${toIndex}) exceeds total number of commits (${commits.length})`);
      process.exitCode = 1;
      return;
    }

    if (fromIndex > toIndex) {
      console.error('--from cannot be greater than --to');
      process.exitCode = 1;
      return;
    }

    const commitsInRange = commits.slice(fromIndex - 1, toIndex);
    if (commitsInRange.length === 0) {
      console.error('No commits found in the specified range');
      process.exitCode = 1;
      return;
    }

    const commitsToRender = sampleCommits(commitsInRange, frameBudget);
    const requestedFrames = commitsToRender.length;

    const rangeLabel = fromIndex === 1 && toIndex === commits.length
      ? `${commits.length} commits`
      : `${commitsInRange.length} commits (range ${fromIndex}-${toIndex} of ${commits.length})`;

    console.log(`Rendering up to ${requestedFrames} frames (${fpsValue} fps) sampled from ${rangeLabel}`);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'octo-tree-video-'));
    const videoPath = ensureMp4Path(outputPath);
    let success = false;

    const portPreference = parsedPort === 0 ? 0 : parsedPort || DEFAULT_PORT;
    let server: http.Server | null = null;
    let browser: Browser | null = null;

    try {
      await fs.mkdir(path.dirname(videoPath), { recursive: true });

    server = await startServer({ port: portPreference, repoPath, silent: true, level: levelResult.value });
      const port = portPreference === 0 ? getServerPort(server) : portPreference;
      const baseUrl = `http://localhost:${port}`;

      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: DEFAULT_DEVICE_SCALE });
      page.setDefaultNavigationTimeout(VIDEO_NAVIGATION_TIMEOUT_MS);
      page.setDefaultTimeout(VIDEO_WAIT_TIMEOUT_MS);

      let capturedFrames = 0;
      let skippedFrames = 0;

      for (let index = 0; index < requestedFrames; index += 1) {
        const commit = commitsToRender[index];
        const frameNumber = capturedFrames + 1;
        const frameFile = path.join(tempDir, `frame-${String(frameNumber).padStart(6, '0')}.png`);

        try {
          const frameUrl = buildClientUrl(baseUrl, { ref: commit, level: levelResult.value });
          await page.goto(frameUrl, {
            waitUntil: 'networkidle0',
            timeout: VIDEO_NAVIGATION_TIMEOUT_MS
          });
          await page.waitForSelector('.radial-tree svg', { timeout: VIDEO_WAIT_TIMEOUT_MS });
          await page.waitForFunction(
            () => document.querySelectorAll('.radial-tree__link').length > 0,
            { timeout: VIDEO_WAIT_TIMEOUT_MS }
          );

          await page.screenshot({ path: frameFile as `${string}.png`, type: 'png', fullPage: false });
          capturedFrames += 1;
          console.log(`Captured frame ${capturedFrames}/${requestedFrames} (${commit.slice(0, 7)})`);
        } catch (error) {
          if (error instanceof TimeoutError) {
            skippedFrames += 1;
            console.warn(
              `Skipped frame ${index + 1}/${requestedFrames} (${commit.slice(0, 7)}) due to timeout: ${error.message}`
            );
            continue;
          }
          throw error;
        }
      }

      if (capturedFrames === 0) {
        console.error('No frames were captured; aborting video generation');
        process.exitCode = 1;
        return;
      }

      if (skippedFrames > 0) {
        console.warn(`Skipped ${skippedFrames} frame(s) due to timeouts`);
      }

      const ffmpegExecutable = getFfmpegExecutable();
      const ffmpegArgs = [
        '-y',
        '-framerate', fpsValue.toString(),
        '-i', 'frame-%06d.png',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        videoPath
      ];

      await runProcess(ffmpegExecutable, ffmpegArgs, { cwd: tempDir });
      console.log(`Saved video (${capturedFrames} frames @ ${fpsValue} fps) to ${videoPath}`);
      success = true;
    } finally {
      await Promise.allSettled([browser?.close(), closeServer(server)]);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }

    if (!success) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      console.error(error.message);
    } else {
      console.error('Failed to generate video:', error);
    }
    process.exitCode = 1;
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
  .option('--ref <git-ref>', 'Git ref (commit SHA, tag, etc.) to visualize')
  .option('--level <number>', 'Number of levels to display in the visualization')
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
  .option('--ref <git-ref>', 'Git ref (commit SHA, tag, etc.) to visualize')
  .option('--level <number>', 'Number of levels to display in the visualization')
  .action(async (options) => {
    await screenshotAction(options as ScreenshotOptions);
  });

program
  .command('video')
  .description('Generate an MP4 video showing the visualization over repository history')
  .option('-r, --repo <path>', 'Path to the repository to visualize', process.cwd())
  .option('-p, --port <number>', 'Port to run the web server on (0 selects a random open port)', '0')
  .option('-o, --output <path>', 'Output path for the MP4 file', 'octo-tree.mp4')
  .option('-w, --width <number>', 'Horizontal side length in CSS pixels', DEFAULT_WIDTH.toString())
  .option(
    '-a, --aspect <ratio>',
    `Aspect ratio for width:height (format x:y)`,
    `${DEFAULT_ASPECT_X}:${DEFAULT_ASPECT_Y}`
  )
  .option('--fps <number>', 'Frames per second of the output video', '10')
  .option('--max-seconds <number>', 'Maximum length of the video in seconds', '60')
  .option('--from <number>', 'Start rendering from this commit index (1-indexed)')
  .option('--to <number>', 'Stop rendering at this commit index (1-indexed)')
  .option('--level <number>', 'Number of levels to display in the visualization')
  .action(async (options) => {
    await videoAction(options as VideoOptions);
  });

if (require.main === module) {
  void program.parseAsync(process.argv);
}
