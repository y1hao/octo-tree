#!/usr/bin/env node
import { Command } from 'commander';
import process from 'process';
import {
  DEFAULT_PORT,
  DEFAULT_WIDTH,
  DEFAULT_ASPECT_X,
  DEFAULT_ASPECT_Y
} from './constants';
import { ServeOptions, ScreenshotOptions, VideoOptions } from './types';
import { serveAction, screenshotAction, videoAction } from './commands';

// Re-export functions used by tests and other modules
export { ensurePngPath, ensureMp4Path } from './utils';
export { parseWidth, parseAspect, parseCommitBound, parseLevel } from './parsers';
export { closeServer, getServerPort, buildClientUrl } from './server';
export { sampleCommits } from './git';
export { runProcess } from './ffmpeg';

const program = new Command();

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
