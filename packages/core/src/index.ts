import { promises as fs } from 'fs';
import type { Stats } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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

const resolveRepoRoot = async (repoPath: string): Promise<string> => {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: repoPath
    });
    return stdout.trim();
  } catch (error) {
    throw new GitRepositoryError(`Failed to locate git repository at ${repoPath}`);
  }
};

const listGitManagedFiles = async (repoPath: string): Promise<string[]> => {
  const { stdout } = await execFileAsync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: repoPath }
  );
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const ensureChild = (parent: TreeNode, child: TreeNode): TreeNode => {
  const existing = parent.children.find((node) => node.id === child.id);
  if (existing) {
    return existing;
  }
  parent.children.push(child);
  return child;
};

const createDirectoryNode = (relativePath: string, name: string, depth: number): TreeNode => ({
  id: makeId(relativePath, 'directory'),
  name,
  relativePath,
  type: 'directory',
  size: 0,
  mtimeMs: 0,
  depth,
  children: []
});

const createFileNode = (
  relativePath: string,
  name: string,
  depth: number,
  stats: Stats
): TreeNode => ({
  id: makeId(relativePath, 'file'),
  name,
  relativePath,
  type: 'file',
  size: stats.size,
  mtimeMs: stats.mtimeMs,
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

export const buildRepositoryTree = async ({ repoPath }: BuildTreeOptions): Promise<TreeNode> => {
  const normalizedPath = await normalizeRepositoryPath(repoPath);
  const repoRoot = await resolveRepoRoot(normalizedPath);
  const repoName = path.basename(repoRoot);

  const relativeRootPath = '.';
  const rootNode = createDirectoryNode(relativeRootPath, repoName, 0);

  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set(relativeRootPath, rootNode);

  const gitManagedFiles = await listGitManagedFiles(repoRoot);

  await Promise.all(
    gitManagedFiles.map(async (gitPath) => {
      const segments = gitPath.split('/');
      let currentPath = relativeRootPath;
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

          const fileNode = createFileNode(nextPath, segment, parentNode.depth + 1, fileStats);
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

  sortChildrenRecursively(rootNode);
  aggregateDirectoryMetadata(rootNode);

  return rootNode;
};
