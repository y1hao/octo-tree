import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';
import process from 'process';
import puppeteer, { Browser, TimeoutError } from 'puppeteer';
import { startServer } from '@octotree/server';
import { GitRepositoryError } from '@octotree/core';
import {
  DEFAULT_PORT,
  DEFAULT_WIDTH,
  DEFAULT_ASPECT_X,
  DEFAULT_ASPECT_Y,
  DEFAULT_DEVICE_SCALE,
  VIDEO_NAVIGATION_TIMEOUT_MS,
  VIDEO_WAIT_TIMEOUT_MS
} from './constants';
import { ServeOptions, ScreenshotOptions, VideoOptions } from './types';
import { ensureMp4Path } from './utils';
import { parseWidth, parseAspect, parseCommitBound, parseLevel } from './parsers';
import { getServerPort, buildClientUrl, closeServer } from './server';
import { listCommitsForBranch, sampleCommits } from './git';
import { getFfmpegExecutable, runProcess } from './ffmpeg';
import { captureScreenshot } from './screenshot';

export const serveAction = async (options: ServeOptions) => {
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
    await startServer({ port, repoPath, ref: requestedRef });
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

export const screenshotAction = async (options: ScreenshotOptions) => {
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

export const videoAction = async (options: VideoOptions) => {
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

      server = await startServer({ port: portPreference, repoPath, silent: true });
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

