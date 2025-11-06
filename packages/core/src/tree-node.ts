import type { NodeType, TreeNode } from './types';

export const joinRelative = (parent: string, segment: string): string => {
  return parent === '.' ? segment : `${parent}/${segment}`;
};

export const makeId = (relativePath: string, type: NodeType): string => {
  return `${type}:${relativePath}`;
};

export const ensureChild = (parent: TreeNode, child: TreeNode, childIdMap: Map<string, TreeNode>): TreeNode => {
  const existing = childIdMap.get(child.id);
  if (existing) {
    return existing;
  }
  parent.children.push(child);
  childIdMap.set(child.id, child);
  return child;
};

export const createDirectoryNode = (
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

export const createFileNode = (
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

export const sortChildrenRecursively = (node: TreeNode): void => {
  node.children.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === 'directory' ? -1 : 1;
  });
  node.children.forEach(sortChildrenRecursively);
};

export const aggregateDirectoryMetadata = (node: TreeNode): { size: number; mtimeMs: number } => {
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

