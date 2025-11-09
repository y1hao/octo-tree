# @octotree/core

Core package providing git-aware tree building functionality and shared types for the Octo Tree visualization tool.

> See the [main README](../../README.md) for project overview and usage.

## Overview

This package is the foundation of Octo Tree, providing:
- Git repository tree building from commits or working tree
- Tree node data structures and metadata aggregation
- Git statistics collection
- Shared types and error classes
- CSS selectors for integration with the web package

## API

### `buildRepositoryTree(options)`

Builds a tree structure representing the file hierarchy of a git repository.

```typescript
import { buildRepositoryTree } from '@octotree/core';

const tree = await buildRepositoryTree({
  repoPath: '/path/to/repo',
  ref: 'HEAD', // optional, defaults to 'HEAD'
  allowFallbackToWorkingTree: false // optional, defaults to false
});
```

**Options:**
- `repoPath` (required) - Path to the git repository
- `ref` (optional) - Git ref (commit SHA, tag, branch) to build tree from. Defaults to `HEAD`
- `allowFallbackToWorkingTree` (optional) - If true and ref is `HEAD`, falls back to working tree if commit checkout fails

**Returns:** `Promise<TreeNode>` - Root node of the repository tree

### `collectGitStats(repoPath, ref)`

Collects git statistics for a repository at a specific ref.

```typescript
import { collectGitStats } from '@octotree/core';

const stats = await collectGitStats('/path/to/repo', 'HEAD');
// Returns: { totalCommits: number | null, latestCommitTimestamp: number | null }
```

### `listCommitsForBranch(repoPath, ref)`

Lists commits for a branch/ref.

```typescript
import { listCommitsForBranch } from '@octotree/core';

const commits = await listCommitsForBranch('/path/to/repo', 'main');
```

## Types

### `TreeNode`

Represents a file or directory node in the tree:

```typescript
interface TreeNode {
  id: string;                    // Unique identifier
  name: string;                  // File or directory name
  relativePath: string;          // Path relative to repository root
  type: 'file' | 'directory';    // Node type
  size: number;                   // File size in bytes (0 for directories)
  mtimeMs: number;                // Modification time in milliseconds
  depth: number;                  // Depth from root (0 = root)
  children: TreeNode[];           // Child nodes (empty for files)
}
```

### `RepositoryTree`

Complete repository tree response:

```typescript
interface RepositoryTree {
  tree: TreeNode;                // Root tree node
  lastUpdated: number;            // Timestamp when tree was built
  gitStats: GitStats | null;     // Git statistics
}
```

### `GitStats`

Git repository statistics:

```typescript
interface GitStats {
  totalCommits: number | null;           // Total number of commits
  latestCommitTimestamp: number | null;  // Latest commit timestamp in ms
}
```

### `GitRepositoryError`

Error class for git-related errors:

```typescript
class GitRepositoryError extends Error {
  constructor(message: string);
}
```

## Tree Building

The package supports two modes of tree building:

1. **From Commit** - Builds tree from a specific git commit/tag/ref
   - Uses `git ls-tree` to get file list
   - Respects `.gitignore` rules
   - Gets commit timestamp for metadata

2. **From Working Tree** - Builds tree from the current working directory
   - Uses `git ls-files` to get tracked files
   - Respects `.gitignore` rules
   - Uses filesystem stats for file sizes and modification times

The tree builder:
- Streams git output to avoid buffer limits for large repositories
- Creates directory nodes automatically as files are inserted
- Sorts children recursively (directories before files, then alphabetically)
- Aggregates directory metadata (file counts, total sizes)

## CSS Selectors

The package exports CSS selectors for integration with the web visualization:

- `RADIAL_TREE_CONTAINER` - Main container selector
- `RADIAL_TREE_LINK_CLASS` - Link element class
- `RADIAL_TREE_LEVELS_CLASS` - Levels container class
- `RADIAL_TREE_LINKS_CLASS` - Links container class
- `RADIAL_TREE_TOOLTIP_CLASS` - Tooltip element class
- `RADIAL_TREE_SVG_SELECTOR` - SVG element selector
- `RADIAL_TREE_LINK_SELECTOR` - Link element selector

These selectors ensure consistency between the CLI (for screenshots/video) and the web package.

## Key Features

- **Git-aware**: Respects `.gitignore` and only includes tracked files
- **Efficient**: Streams git output for large repositories
- **Flexible**: Supports both commit-based and working tree building
- **Metadata-rich**: Includes file sizes, modification times, and git statistics
- **Type-safe**: Full TypeScript support with exported types

## Dependencies

This package has no external dependencies (only Node.js built-ins). It shells out to `git` commands for repository operations.

