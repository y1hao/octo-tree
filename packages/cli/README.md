# @octotree/cli

Command-line interface for Octo Tree. Provides commands for serving, screenshot capture, and video generation.

> See the [main README](../../README.md) for quick start instructions and examples.

## Overview

The CLI package provides three main commands:
- **serve** - Launch a local web server to visualize a repository tree
- **screenshot** - Generate PNG screenshots of the visualization
- **video** - Generate MP4 videos showing the visualization over repository history

## Commands

### serve

Launch the radial file tree web server. This is the default command.

```bash
octo-tree serve --repo /path/to/repo --port 3000 --ref HEAD --level 5
```

**Options:**
- `-r, --repo <path>` - Path to the repository to visualize (defaults to current working directory)
- `-p, --port <number>` - Port to run the web server on (defaults to `3000`)
- `--ref <git-ref>` - Git ref (commit SHA, tag, branch, etc.) to visualize (defaults to `HEAD`)
- `--level <number>` - Number of concentric levels to display in the visualization

**Example:**
```bash
octo-tree serve --repo ~/my-project --port 8080 --ref main
```

### screenshot

Generate a PNG screenshot of the radial file tree visualization.

```bash
octo-tree screenshot --repo /path/to/repo --output octo-tree.png --width 1440 --aspect 4:3
```

**Options:**
- `-r, --repo <path>` - Path to the repository to visualize (defaults to current working directory)
- `-p, --port <number>` - Port to run the web server on (defaults to `0` for auto-selection)
- `-o, --output <path>` - Output path for the PNG file (defaults to `octo-tree.png`, auto-appends `.png` if missing)
- `-w, --width <number>` - Horizontal side length in CSS pixels (defaults to `1440`)
- `-a, --aspect <ratio>` - Aspect ratio for width:height in format `x:y` (defaults to `4:3`)
- `--ref <git-ref>` - Git ref to visualize (defaults to `HEAD`)
- `--level <number>` - Number of concentric levels to display

**Example:**
```bash
octo-tree screenshot --repo ~/my-project --output my-tree.png --width 1920 --aspect 16:9
```

**Note:** The PNG is rendered at the requested CSS width/height with a device scale factor of `2`, so the output bitmap is twice as dense as the viewport dimensions.

### video

Generate an MP4 video showing the visualization over repository history.

```bash
octo-tree video --repo /path/to/repo --output octo-tree.mp4 --fps 10 --max-seconds 60
```

**Options:**
- `-r, --repo <path>` - Path to the repository to visualize (defaults to current working directory)
- `-p, --port <number>` - Port to run the web server on (defaults to `0` for auto-selection)
- `-o, --output <path>` - Output path for the MP4 file (defaults to `octo-tree.mp4`, auto-appends `.mp4` if missing)
- `-w, --width <number>` - Horizontal side length in CSS pixels (defaults to `1440`)
- `-a, --aspect <ratio>` - Aspect ratio for width:height in format `x:y` (defaults to `4:3`)
- `--fps <number>` - Frames per second of the output video (defaults to `10`)
- `--max-seconds <number>` - Maximum length of the video in seconds (defaults to `60`)
- `--from <number>` - Start rendering from this commit index (1-indexed, inclusive)
- `--to <number>` - Stop rendering at this commit index (1-indexed, inclusive)
- `--ref <git-ref>` - Git ref to visualize (defaults to `HEAD`)
- `--level <number>` - Number of concentric levels to display

**Example:**
```bash
octo-tree video --repo ~/my-project --output evolution.mp4 --fps 15 --max-seconds 120 --from 1 --to 100
```

**Note:** The command captures PNG frames for each sampled commit (oldest → newest) and stitches them into an MP4 using the bundled ffmpeg binary. Frames are uniformly sampled to keep within `fps × max-seconds`.

## Development

Run the CLI in development mode without rebuilding:

```bash
npm run dev
```

This uses `ts-node-dev` to run the TypeScript source directly.

## Testing

Run tests:

```bash
npm test
```

## Dependencies

- `@octotree/core` - Core tree building functionality
- `@octotree/server` - Express server for serving the visualization
- `commander` - CLI argument parsing
- `ffmpeg-static` - Bundled ffmpeg binary for video generation
- `puppeteer` - Browser automation for screenshots and video capture

## Exports

The package exports several utilities for use in tests and other modules:

- `ensurePngPath`, `ensureMp4Path` - Path utilities
- `parseWidth`, `parseAspect`, `parseCommitBound`, `parseLevel` - Parsers for CLI options
- `closeServer`, `getServerPort`, `buildClientUrl` - Server utilities
- `sampleCommits` - Git commit sampling
- `runProcess` - FFmpeg process execution
- `captureScreenshot` - Screenshot capture functionality

