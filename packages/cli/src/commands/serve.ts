import path from 'path';
import process from 'process';
import { startServer } from '@octotree/server';
import { GitRepositoryError } from '@octotree/core';
import { DEFAULT_PORT } from '../constants';
import { ServeOptions } from '../types';
import { parseLevel } from '../parsers';

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

