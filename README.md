# Octo Tree

Radial visualization tool for exploring git-tracked files in any repository. The CLI spins up a local web server that exposes the repository tree (gitignore-aware) and serves a D3-powered radial file tree in the browser.

## Workspace Layout
- `packages/core` — Git-aware tree builder and shared types.
- `packages/server` — Express server exposing `/api/tree` and hosting the built web assets.
- `packages/cli` — Command-line entry point that launches the server for a target repo.
- `packages/web` — React + Vite front-end (radial D3 visualization with hover interactions).

## Prerequisites
- Node.js 18+
- Git available on `PATH` (the tree builder shells out to `git`).

## Install Dependencies
```bash
npm install
```

## Build All Packages
```bash
npm run build         # builds TypeScript packages and the front-end bundle
# or run them individually
npm run build:backend # project-reference TypeScript build (core/server/cli)
npm run build:web     # Vite production build for the visualization
```

## Launch the CLI
```bash
node packages/cli/dist/index.js --repo /path/to/git/repo --port 3000
# or explicitly invoke the serve subcommand
node packages/cli/dist/index.js serve --repo /path/to/git/repo --ref HEAD
```

Options:
- `--repo` defaults to the current working directory.
- `--port` defaults to `3000`.
- `--ref` defaults to `HEAD` (any valid git ref/commit SHA).

When the CLI reports the server URL, open it in your browser to explore the radial tree. The visualization fetches `/api/tree` (gitignore-aware), displays hover tooltips for branch metadata, and you can trigger a rebuild any time with `POST /api/tree/refresh`.

## Capture a Screenshot
```bash
node packages/cli/dist/index.js screenshot --repo /path/to/git/repo --output octo-tree.png
```

Options:
- `--repo` defaults to the current working directory.
- `--output` defaults to `octo-tree.png` (auto-appends `.png` if missing).
- `--port` defaults to `0`, so an open port is allocated automatically.
- `--width` defaults to `1440` CSS pixels (3/4 of the serve viewport width).
- `--aspect` defaults to `4:3` (format `x:y`).
- `--ref` defaults to `HEAD` (any valid git ref/commit SHA).

The PNG is rendered at the requested CSS width/height with a device scale factor of `2`, so the output bitmap is twice as dense as the viewport dimensions.

## Generate a Video
```bash
node packages/cli/dist/index.js video --repo /path/to/git/repo --output octo-tree.mp4
```

Options:
- `--repo` defaults to the current working directory.
- `--output` defaults to `octo-tree.mp4` (auto-appends `.mp4` if missing).
- `--port` defaults to `0`, so an open port is allocated automatically for each frame.
- `--width` defaults to `1440` CSS pixels; `--aspect` defaults to `4:3`.
- `--fps` defaults to `10` frames per second.
- `--max-seconds` defaults to `60`; frames are uniformly sampled to keep within `fps × max-seconds`.

The command captures PNG frames for each sampled commit (oldest → newest) and stitches them into an MP4 using the bundled ffmpeg binary.

Large repositories are supported—the tree builder streams `git ls-files` output to avoid buffer limits.

Branch thickness reflects how many files live inside a directory, branch color lightens with the largest descendant file size (capped at the 90th percentile), and the sidebar highlights directories/files alongside latest commit time and commit count.

## Development Scripts
- `npm run dev --workspace @octotree/cli` — Run the CLI via `ts-node-dev` without rebuilding.
- `npm run dev --workspace @octotree/server` — Start the server entry directly (use a built web bundle or run Vite in parallel).
- `npm run dev --workspace @octotree/web` — Start the Vite dev server for the front-end; proxy API requests to the Express server when iterating on the UI.

## Next Steps
- Add filesystem watching to invalidate the cached tree automatically.
- Integrate search/filter controls for large repositories.
- Expose additional metadata overlays (e.g. file sizes, git history) in the visualization.
