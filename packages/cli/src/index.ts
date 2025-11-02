#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import process from 'process';
import { startServer } from '@octotree/server';
import { GitRepositoryError } from '@octotree/core';

const program = new Command();

program
  .name('octo-tree')
  .description('Radial file tree visualization for git repositories')
  .option('-r, --repo <path>', 'Path to the repository to visualize', process.cwd())
  .option('-p, --port <number>', 'Port to run the web server on', '3000')
  .action(async (options) => {
    const port = Number(options.port);
    if (Number.isNaN(port)) {
      console.error('Port must be a number');
      process.exitCode = 1;
      return;
    }

    const repoPath = path.resolve(options.repo);
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
  });

program.parseAsync(process.argv);
