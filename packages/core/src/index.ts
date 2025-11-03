import { promises as fs } from 'fs';
import type { Stats } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export type NodeType = 'file' | 'directory';

export interface TreeNode {
  id: string;
  name: string;
  relativePath: string;
  type: NodeType;
  size: number;
  mtimeMs: number;
  depth: number;
  children: TreeNode[];
}

export interface PolarLayout {
  radius: number;
  angle: number;
  span: number;
}

export interface TreeNodeWithLayout extends TreeNode {
  layout?: PolarLayout;
}

export interface BuildTreeOptions {
  repoPath: string;
  ref?: string;
  allowFallbackToWorkingTree?: boolean;
}

export class GitRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitRepositoryError';
  }
}

const joinRelative = (parent: string, segment: string): string => {
  return parent === '.' ? segment : `${parent}/${segment}`;
};

const makeId = (relativePath: string, type: NodeType): string => {
  return `${type}:${relativePath}`;
};

const normalizeRepositoryPath = async (repoPath: string): Promise<string> => {
  const resolved = path.resolve(repoPath);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw new GitRepositoryError(`Provided path is not a directory: ${resolved}`);
  }
  return resolved;
};

const runGitCommand = async (repoPath: string, args: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: repoPath });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const error = new GitRepositoryError(
          `Git command failed (git ${args.join(' ')}): ${stderr.trim()}`
        );
        reject(error);
      }
    });
  });
};

const resolveRepoRoot = async (repoPath: string): Promise<string> => {
  try {
    const stdout = await runGitCommand(repoPath, ['rev-parse', '--show-toplevel']);
    return stdout.trim();
  } catch (error) {
    throw new GitRepositoryError(`Failed to locate git repository at ${repoPath}`);
  }
};

const listGitManagedFiles = async (repoPath: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['ls-files', '--cached', '--exclude-standard'], {
      cwd: repoPath
    });

    const files: string[] = [];
    let buffer = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          files.push(trimmed);
        }
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (buffer.length > 0) {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) {
          files.push(trimmed);
        }
      }

      if (code === 0) {
        resolve(files);
      } else {
        reject(
          new GitRepositoryError(
            `Git command failed (git ls-files --cached --exclude-standard): ${stderr.trim()}`
          )
        );
      }
    });
  });
};

const ensureChild = (parent: TreeNode, child: TreeNode): TreeNode => {
  const existing = parent.children.find((node) => node.id === child.id);
  if (existing) {
    return existing;
  }
  parent.children.push(child);
  return child;
};

const createDirectoryNode = (
  relativePath: string,
  name: string,
  depth: number,
  mtimeMs = 0
): TreeNode => ({
  id: makeId(relativePath, 'directory'),
  name,
  relativePath,
  type: 'directory',
  size: 0,
  mtimeMs,
  depth,
  children: []
});

const createFileNode = (
  relativePath: string,
  name: string,
  depth: number,
  size: number,
  mtimeMs: number
): TreeNode => ({
  id: makeId(relativePath, 'file'),
  name,
  relativePath,
  type: 'file',
  size,
  mtimeMs,
  depth,
  children: []
});

const sortChildrenRecursively = (node: TreeNode): void => {
  node.children.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  });
  node.children.forEach(sortChildrenRecursively);
};

const aggregateDirectoryMetadata = (node: TreeNode): { size: number; mtimeMs: number } => {
  if (node.type === 'file') {
    return { size: node.size, mtimeMs: node.mtimeMs };
  }

  let totalSize = 0;
  let latestMtime = node.mtimeMs;

  for (const child of node.children) {
    const childMetrics = aggregateDirectoryMetadata(child);
    totalSize += childMetrics.size;
    latestMtime = Math.max(latestMtime, childMetrics.mtimeMs);
  }

  node.size = totalSize;
  node.mtimeMs = latestMtime;
  return { size: totalSize, mtimeMs: latestMtime };
};

interface GitTreeEntry {
  path: string;
  size: number;
}

interface ResolvedRef {
  treeHash: string;
  commitHash: string | null;
}

const resolveGitRef = async (repoPath: string, ref: string): Promise<ResolvedRef> => {
  const resolvedRef = (await runGitCommand(repoPath, ['rev-parse', '--verify', ref])).trim();
  let objectType: string;
  try {
    objectType = (await runGitCommand(repoPath, ['cat-file', '-t', resolvedRef])).trim();
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      throw new GitRepositoryError(`Failed to resolve git ref: ${ref}`);
    }
    throw error;
  }

  if (objectType === 'commit') {
    const treeHash = (
      await runGitCommand(repoPath, ['rev-parse', '--verify', `${resolvedRef}^{tree}`])
    ).trim();
    return { treeHash, commitHash: resolvedRef };
  }

  if (objectType === 'tag') {
    const commitHash = (
      await runGitCommand(repoPath, ['rev-parse', '--verify', `${resolvedRef}^{commit}`])
    ).trim();
    const treeHash = (
      await runGitCommand(repoPath, ['rev-parse', '--verify', `${commitHash}^{tree}`])
    ).trim();
    return { treeHash, commitHash };
  }

  if (objectType === 'tree') {
    return { treeHash: resolvedRef, commitHash: null };
  }

  throw new GitRepositoryError(`Unsupported git object type for ref ${ref}: ${objectType}`);
};

const listFilesAtTree = async (repoPath: string, treeHash: string): Promise<GitTreeEntry[]> => {
  const output = await runGitCommand(repoPath, [
    'ls-tree',
    '--full-tree',
    '--long',
    '-r',
    treeHash
  ]);

  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entries: GitTreeEntry[] = [];

  for (const line of lines) {
    const [meta, filePath] = line.split('\t');
    if (!meta || !filePath) {
      continue;
    }
    const parts = meta.split(/\s+/);
    if (parts.length < 4) {
      continue;
    }
    const type = parts[1];
    if (type !== 'blob') {
      continue;
    }
    const sizeValue = parts[3];
    const size = sizeValue === '-' ? 0 : Number.parseInt(sizeValue, 10);
    entries.push({ path: filePath, size: Number.isNaN(size) ? 0 : size });
  }

  return entries;
};

const getCommitTimestampMs = async (repoPath: string, commitHash: string): Promise<number | null> => {
  try {
    const output = await runGitCommand(repoPath, ['show', '-s', '--format=%ct', commitHash]);
    const numeric = Number.parseInt(output.trim(), 10);
    if (Number.isNaN(numeric)) {
      return null;
    }
    return numeric * 1000;
  } catch (error) {
    if (error instanceof GitRepositoryError) {
      throw error;
    }
    return null;
  }
};

const insertFileNode = (
  rootNode: TreeNode,
  nodeMap: Map<string, TreeNode>,
  gitPath: string,
  size: number,
  mtimeMs: number
): void => {
  const segments = gitPath.split('/');
  let currentPath = '.';
  let parentNode = rootNode;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLeaf = index === segments.length - 1;
    const nextPath = joinRelative(currentPath, segment);

    if (isLeaf) {
      const fileNode = createFileNode(nextPath, segment, parentNode.depth + 1, size, mtimeMs);
      nodeMap.set(nextPath, fileNode);
      ensureChild(parentNode, fileNode);
    } else {
      let directoryNode = nodeMap.get(nextPath);
      if (!directoryNode) {
        directoryNode = createDirectoryNode(nextPath, segment, parentNode.depth + 1, mtimeMs);
        nodeMap.set(nextPath, directoryNode);
        ensureChild(parentNode, directoryNode);
      }
      parentNode = directoryNode;
      currentPath = nextPath;
    }
  }
};

const buildTreeFromWorkingTree = async (
  repoRoot: string,
  rootNode: TreeNode,
  nodeMap: Map<string, TreeNode>
): Promise<void> => {
  const gitManagedFiles = await listGitManagedFiles(repoRoot);

  await Promise.all(
    gitManagedFiles.map(async (gitPath) => {
      const segments = gitPath.split('/');
      let currentPath = '.';
      let parentNode = rootNode;

      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        const isLeaf = index === segments.length - 1;
        const nextPath = joinRelative(currentPath, segment);

        if (isLeaf) {
          const absoluteFilePath = path.join(repoRoot, gitPath);
          let fileStats: Stats;
          try {
            fileStats = await fs.stat(absoluteFilePath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              return;
            }
            throw error;
          }

          const fileNode = createFileNode(
            nextPath,
            segment,
            parentNode.depth + 1,
            fileStats.size,
            fileStats.mtimeMs
          );
          nodeMap.set(nextPath, fileNode);
          ensureChild(parentNode, fileNode);
        } else {
          let directoryNode = nodeMap.get(nextPath);
          if (!directoryNode) {
            directoryNode = createDirectoryNode(nextPath, segment, parentNode.depth + 1);
            nodeMap.set(nextPath, directoryNode);
            ensureChild(parentNode, directoryNode);
          }
          parentNode = directoryNode;
          currentPath = nextPath;
        }
      }
    })
  );
};

const buildTreeFromCommit = async (
  repoRoot: string,
  rootNode: TreeNode,
  nodeMap: Map<string, TreeNode>,
  ref: string
): Promise<number | null> => {
  const { treeHash, commitHash } = await resolveGitRef(repoRoot, ref);
  const entries = await listFilesAtTree(repoRoot, treeHash);
  const commitTimestampMs = commitHash
    ? await getCommitTimestampMs(repoRoot, commitHash).catch(() => null)
    : null;
  const mtimeMs = commitTimestampMs ?? 0;

  for (const entry of entries) {
    insertFileNode(rootNode, nodeMap, entry.path, entry.size, mtimeMs);
  }
  return commitTimestampMs ?? null;
};

export const buildRepositoryTree = async ({
  repoPath,
  ref,
  allowFallbackToWorkingTree = false
}: BuildTreeOptions): Promise<TreeNode> => {
  const normalizedPath = await normalizeRepositoryPath(repoPath);
  const repoRoot = await resolveRepoRoot(normalizedPath);
  const repoName = path.basename(repoRoot);
  const targetRef = ref ?? 'HEAD';

  const relativeRootPath = '.';
  const rootNode = createDirectoryNode(relativeRootPath, repoName, 0);

  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set(relativeRootPath, rootNode);

  let commitTimestampMs: number | null = null;
  try {
    commitTimestampMs = await buildTreeFromCommit(repoRoot, rootNode, nodeMap, targetRef);
  } catch (error) {
    if (
      !(error instanceof GitRepositoryError) ||
      !allowFallbackToWorkingTree ||
      targetRef !== 'HEAD'
    ) {
      throw error;
    }
    await buildTreeFromWorkingTree(repoRoot, rootNode, nodeMap);
  }

  sortChildrenRecursively(rootNode);
  aggregateDirectoryMetadata(rootNode);

  if (commitTimestampMs) {
    rootNode.mtimeMs = commitTimestampMs;
  }

  return rootNode;
};
