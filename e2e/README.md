# @octotree/e2e

End-to-end integration tests for Octo Tree that verify cross-package functionality and workflows.

> See the [main README](../README.md) for project overview and running tests.

## Overview

This package contains comprehensive integration tests that verify:
- Server API endpoints (`/api/tree`, `/api/tree/refresh`)
- Git repository handling (single commit, multiple commits, nested structures)
- Parameter handling (ref, level)
- Selector compatibility between CLI and web package
- End-to-end screenshot capture workflows
- Cross-package integration

These tests ensure that changes to one package don't break integration with others, and that the CLI screenshot/video functionality works correctly with the rendered web UI.

## Prerequisites

- Node.js 18+
- Git available on `PATH`
- Web package must be built (`npm run build:web` from root)

## Running Tests

Run all e2e tests:

```bash
npm test
```

Or from the root directory:

```bash
npm run test:e2e
```

## Test Structure

### Test Files

- **`api.test.ts`** - Server API endpoint tests
  - `GET /api/tree` returns tree structure
  - `GET /api/tree` with ref parameter
  - `POST /api/tree/refresh` refreshes tree cache
  - Error handling for invalid refs

- **`git-scenarios.test.ts`** - Git repository scenario tests
  - Single commit repositories
  - Multiple commits
  - Nested directory structures
  - Empty commits

- **`selectors.test.ts`** - CSS selector compatibility tests
  - Verifies selectors used by CLI match web package DOM
  - Tests selector functionality with level parameter
  - Ensures screenshot/video capture won't silently fail

- **`ref-level.test.ts`** - Parameter integration tests
  - Ref parameter rendering
  - Level parameter rendering
  - Combined ref and level parameters

- **`screenshot.test.ts`** - Screenshot capture end-to-end tests
  - Full screenshot capture workflow
  - Screenshot with specific ref
  - Screenshot with level parameter

### Test Utilities

#### `utils/repo.ts`

Utilities for managing temporary git repositories:

- `withRepo(testFn)` - Execute test with temporary repo, auto-cleanup
- `initRepo()` - Initialize temporary git repository
- `cleanupRepo(repoPath)` - Clean up temporary repository
- `createTestFiles(repoPath, files)` - Create test files in repository
- `createCommit(repoPath, message)` - Create git commit
- `getHeadCommit(repoPath)` - Get HEAD commit SHA
- `getAllCommits(repoPath)` - Get all commit SHAs

#### `utils/server.ts`

Utilities for managing test servers:

- `startTestServer(repoPath, options?)` - Start test server, returns server instance and URL
- `closeTestServer(server)` - Close server and wait for cleanup

## Test Timeouts

Tests use extended timeouts (30-60 seconds) because they:
- Create temporary git repositories
- Start HTTP servers
- Launch browser instances (for screenshot/selector tests)
- Perform file I/O operations

## Key Test Scenarios

### API Integration

Tests verify that:
- Tree structure is correctly built and returned
- Git statistics are included
- Different git refs produce different trees
- Tree refresh updates timestamps
- Invalid refs return appropriate errors

### Git Repository Handling

Tests cover:
- Repositories with varying commit counts
- Complex nested directory structures
- Edge cases like empty commits
- File and directory counting accuracy

### Selector Compatibility

Critical tests that ensure:
- CSS selectors exported from `@octotree/core` match actual DOM
- CLI screenshot/video capture can find SVG elements
- Selectors work with different level parameters
- Changes to web package CSS won't break CLI silently

### Parameter Handling

Tests verify:
- `ref` query parameter correctly filters commits
- `level` query parameter limits visualization depth
- Combined parameters work together
- Parameters are passed through to API correctly

### Screenshot Workflow

End-to-end tests that:
- Verify complete screenshot capture pipeline
- Test with different refs and levels
- Ensure output files are created correctly
- Validate that screenshots can be generated for various scenarios

## Dependencies

- `@octotree/cli` - CLI functionality for screenshot tests
- `@octotree/core` - Core types and selectors
- `@octotree/server` - Server for API tests
- `puppeteer` - Browser automation for selector and screenshot tests
- `vitest` - Test runner

## Writing New Tests

When adding new e2e tests:

1. **Use test utilities** - Leverage `withRepo()` and `startTestServer()` for setup/teardown
2. **Set appropriate timeouts** - Use 30-60 second timeouts for integration tests
3. **Clean up resources** - Always close servers and browsers in `finally` blocks
4. **Test cross-package integration** - Focus on workflows that span multiple packages
5. **Verify error cases** - Test both success and failure scenarios

Example test structure:

```typescript
import { describe, expect, it } from 'vitest';
import { withRepo, createTestFiles, createCommit } from './utils/repo';
import { startTestServer, closeTestServer } from './utils/server';

describe('my feature', () => {
  it('tests the feature', async () => {
    await withRepo(async (repoPath) => {
      await createTestFiles(repoPath, {
        'file.txt': 'content'
      });
      createCommit(repoPath, 'initial commit');

      const { server, url } = await startTestServer(repoPath);

      try {
        // Your test code here
        const response = await fetch(`${url}/api/tree`);
        expect(response.ok).toBe(true);
      } finally {
        await closeTestServer(server);
      }
    });
  }, 30000);
});
```

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:
- Tests are isolated (use temporary directories)
- Tests clean up after themselves
- Tests can run in parallel (each uses its own server port)
- Tests don't require external services

## Troubleshooting

### Tests fail with "web package not built"

Build the web package before running e2e tests:

```bash
npm run build:web
```

### Tests timeout

- Check that git is available on PATH
- Verify no other processes are using test ports
- Increase timeout if testing very large repositories

### Selector tests fail

- Verify web package CSS classes match selectors in `@octotree/core`
- Check that web package is built and up to date
- Ensure browser can render the page correctly

## Related Documentation

- [Main README](../README.md) - Overall project documentation
- [CLI README](../packages/cli/README.md) - CLI functionality
- [Server README](../packages/server/README.md) - API details
- [Web README](../packages/web/README.md) - Front-end implementation

