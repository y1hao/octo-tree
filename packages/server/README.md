# @octotree/server

Express server package for serving the Octo Tree visualization API and static web assets.

> See the [main README](../../README.md) for quick start instructions.

## Overview

This package provides:
- Express server setup with API routes for tree data
- Static asset serving for the built web front-end
- Tree building and caching logic
- Git statistics collection integration

## API

### `startServer(options)`

Starts an HTTP server with the Express app configured for a specific repository.

```typescript
import { startServer } from '@octotree/server';

const server = await startServer({
  port: 3000,
  repoPath: '/path/to/repo',
  ref: 'HEAD', // optional
  silent: false // optional, suppresses startup message
});
```

**Options:**
- `port` (optional) - Port to listen on (defaults to `3000`)
- `repoPath` (required) - Path to the git repository to serve
- `ref` (optional) - Default git ref to use (defaults to `HEAD`)
- `silent` (optional) - If true, suppresses the startup message

**Returns:** `Promise<http.Server>`

### `createApp(repoPath, defaultRef, allowFallbackToWorkingTree, dependencies?)`

Creates an Express application instance with routes configured.

```typescript
import { createApp } from '@octotree/server';

const { app, getTree, refreshTree } = createApp(
  '/path/to/repo',
  'HEAD',
  true
);
```

**Parameters:**
- `repoPath` - Path to the git repository
- `defaultRef` - Default git ref to use when none is specified
- `allowFallbackToWorkingTree` - Whether to allow fallback to working tree for HEAD
- `dependencies` (optional) - Dependency injection for testing

**Returns:** `AppInstance` with:
- `app` - Express application
- `getTree` - Function to get tree for a ref
- `refreshTree` - Function to refresh tree for a ref

## API Endpoints

### `GET /api/tree`

Returns the repository tree structure.

**Query Parameters:**
- `ref` (optional) - Git ref to build tree from (defaults to server's default ref)

**Response:**
```json
{
  "tree": { /* TreeNode */ },
  "lastUpdated": 1234567890,
  "gitStats": {
    "totalCommits": 100,
    "latestCommitTimestamp": 1234567890000
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (e.g., invalid git ref)
- `500` - Server error

### `POST /api/tree/refresh`

Forces a refresh of the repository tree cache.

**Query Parameters:**
- `ref` (optional) - Git ref to refresh (defaults to server's default ref)

**Response:** Same as `GET /api/tree`

**Status Codes:**
- `200` - Success
- `400` - Bad request
- `500` - Server error

### `GET /*`

Serves static assets from the built web package. Falls back to `index.html` for client-side routing.

**Note:** The web package must be built (`npm run build:web`) for static assets to be available.

## Tree Caching

The server implements a simple in-memory cache for tree builds:
- Trees are cached per git ref
- Concurrent requests for the same ref share the same build promise
- The refresh endpoint clears the cache for a specific ref

## Static Assets

The server serves static assets from the built web package located at:
- `packages/web/dist/` - Static assets directory
- `packages/web/dist/index.html` - Main HTML file

If the build directory doesn't exist, the server returns a 503 error with instructions to build the web package.

## Development

Run the server in development mode:

```bash
npm run dev
```

This uses `ts-node-dev` to run the TypeScript source directly. Note that you'll need the web package built or running Vite in parallel for the front-end to work.

**Note:** Tests use dependency injection to mock tree building functions for isolated unit testing.

## Dependencies

- `@octotree/core` - Core tree building functionality
- `express` - Web framework

## Error Handling

The server handles errors gracefully:
- `GitRepositoryError` from core package returns 400 status
- Other errors are logged and return 500 status
- Error responses include JSON with an `error` message field

## Integration

This package is used by:
- `@octotree/cli` - Launches the server for the serve command
- E2E tests - Tests the full server API integration

