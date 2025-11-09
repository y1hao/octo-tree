import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';
import process from 'process';
import type { Browser } from 'puppeteer';
import { TimeoutError } from 'puppeteer';
import { startServer } from '@octotree/server';
import { GitRepositoryError, listCommitsForBranch } from '@octotree/core';
import {
  DEFAULT_PORT,
  VIDEO_NAVIGATION_TIMEOUT_MS,
  VIDEO_WAIT_TIMEOUT_MS
} from '../constants';
import { ensureMp4Path } from '../utils';
import { parseWidth, parseAspect, parseCommitBound, parseLevel } from '../parsers';
import { getServerPort, buildClientUrl, closeServer } from '../server';
import { sampleCommits } from '../git';
import { getFfmpegExecutable, runProcess } from '../ffmpeg';
import { captureFrame, setupBrowser } from '../capture';

export interface VideoOptions {
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

    const commitsInRange: string[] = commits.slice(fromIndex - 1, toIndex);
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
    const portPreference = parsedPort === 0 ? 0 : parsedPort || DEFAULT_PORT;
    let server: http.Server | null = null;
    let browser: Browser | null = null;

    try {
      await fs.mkdir(path.dirname(videoPath), { recursive: true });

      server = await startServer({ port: portPreference, repoPath, silent: true });
      const port = portPreference === 0 ? getServerPort(server) : portPreference;
      const baseUrl = `http://localhost:${port}`;

      const browserSetup = await setupBrowser({
        width,
        height,
        navigationTimeout: VIDEO_NAVIGATION_TIMEOUT_MS,
        waitTimeout: VIDEO_WAIT_TIMEOUT_MS
      });
      browser = browserSetup.browser;
      const { page } = browserSetup;

      let capturedFrames = 0;
      let skippedFrames = 0;

      for (let index = 0; index < requestedFrames; index += 1) {
        const commit = commitsToRender[index];
        const frameNumber = capturedFrames + 1;
        const frameFile = path.join(tempDir, `frame-${String(frameNumber).padStart(6, '0')}.png`);

        try {
          const frameUrl = buildClientUrl(baseUrl, { ref: commit, level: levelResult.value });
          await captureFrame({
            page,
            url: frameUrl,
            outputPath: frameFile,
            navigationTimeout: VIDEO_NAVIGATION_TIMEOUT_MS,
            waitTimeout: VIDEO_WAIT_TIMEOUT_MS
          });
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
    } finally {
      await Promise.allSettled([browser?.close(), closeServer(server)]);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
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

