# @octotree/web

React + Vite front-end package providing the radial D3 visualization for Octo Tree.

> See the [main README](../../README.md) for quick start instructions.

## Overview

This package provides:
- React-based user interface for the radial tree visualization
- D3-powered radial tree layout and rendering
- Interactive hover tooltips showing file/directory metadata
- Sidebar displaying repository statistics
- Responsive SVG visualization

## Development

Start the Vite development server:

```bash
npm run dev
```

The dev server runs on `http://localhost:5173` (or next available port) and proxies API requests to the Express server.

**Note:** For full functionality, you'll need the server running. Use `npm run dev --workspace @octotree/server` in parallel, or configure the Vite proxy to point to your server instance.

## Build

Build for production:

```bash
npm run build
```

This creates optimized static assets in `dist/` that are served by the Express server.

**Note:** Tests use Vitest with React Testing Library and jsdom for component testing.

## Components

### `App`

Main application component that:
- Fetches tree data from `/api/tree`
- Displays loading and error states
- Renders the sidebar with repository statistics
- Renders the `RadialTree` visualization component

**Query Parameters:**
- `ref` - Git ref to visualize (passed to API)
- `level` - Override number of levels to display

### `RadialTree`

Core visualization component that:
- Takes a `TreeNode` as input
- Uses D3 to create a radial tree layout
- Renders SVG paths for branches
- Shows interactive tooltips on hover
- Supports level limiting via props or query parameter

**Props:**
- `data: TreeNode` - Root tree node
- `level?: number | null` - Optional level limit

## Visualization Features

### Radial Layout
- Root node at the center
- Children arranged in concentric circles
- Branch thickness reflects number of files in directories
- Branch color lightens with largest descendant file size (capped at 90th percentile)

### Interactive Elements
- **Hover tooltips** - Show file/directory name, size, and path
- **Sidebar** - Displays repository name, latest commit date, total commits, file count, and directory count

### Styling
- Green color scheme (`#015625` to `#e2fef0`)
- Responsive SVG that scales to container
- Smooth transitions and hover effects

## API Integration

The app fetches data from:
- `GET /api/tree?ref=<git-ref>` - Get repository tree
- Automatically appends `ref` query parameter from URL if present

## Dependencies

- `react` & `react-dom` - UI framework
- `d3` - Data visualization (hierarchy, shape)
- `@octotree/core` - Shared types and selectors

## Development Dependencies

- `vite` - Build tool and dev server
- `@vitejs/plugin-react` - React support for Vite
- `vitest` - Test runner
- `@testing-library/react` - React component testing
- `@testing-library/jest-dom` - DOM matchers
- `jsdom` - DOM environment for tests

## Build Output

The build process:
1. Bundles React components and dependencies
2. Processes CSS with Vite
3. Outputs optimized assets to `dist/`
4. Creates `index.html` entry point

The built assets are served by the Express server at `packages/server`.

## CSS Selectors

The package uses CSS selectors exported from `@octotree/core` to ensure consistency with CLI screenshot/video capture:
- Container, link, level, and tooltip selectors
- Used for automated testing and screenshot generation

## Browser Support

Modern browsers with ES6+ support:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Uses SVG for rendering, ensuring scalability and crisp rendering at any size.

