import path from 'path';
import process from 'process';
import { GitRepositoryError } from '@octotree/core';
import { parseWidth, parseAspect, parseLevel } from '../parsers';
import { captureScreenshot } from '../screenshot';

export interface ScreenshotOptions {
  repo?: string;
  port?: string;
  output?: string;
  width?: string;
  aspect?: string;
  ref?: string;
  level?: string;
}

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

