import { promises as fs } from 'fs';
import path from 'path';
import type { TreeNode, BuildTreeOptions } from './types';
import { GitRepositoryError } from './types';
import { resolveRepoRoot } from './git';
import { createDirectoryNode, sortChildrenRecursively, aggregateDirectoryMetadata } from './tree-node';
import { buildTreeFromCommit, buildTreeFromWorkingTree } from './tree-builder';

const normalizeRepositoryPath = async (repoPath: string): Promise<string> => {
  const resolved = path.resolve(repoPath);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw new GitRepositoryError(`Provided path is not a directory: ${resolved}`);
  }
  return resolved;
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
  const childIdMap = new Map<string, TreeNode>();
  nodeMap.set(relativeRootPath, rootNode);
  childIdMap.set(rootNode.id, rootNode);

  let commitTimestampMs: number | null = null;
  try {
    commitTimestampMs = await buildTreeFromCommit(repoRoot, rootNode, nodeMap, childIdMap, targetRef);
  } catch (error) {
    if (
      !(error instanceof GitRepositoryError) ||
      !allowFallbackToWorkingTree ||
      targetRef !== 'HEAD'
    ) {
      throw error;
    }
    await buildTreeFromWorkingTree(repoRoot, rootNode, nodeMap, childIdMap);
  }

  sortChildrenRecursively(rootNode);
  aggregateDirectoryMetadata(rootNode);

  if (commitTimestampMs) {
    rootNode.mtimeMs = commitTimestampMs;
  }

  return rootNode;
};

// Re-export types and error for convenience
export type { TreeNode, BuildTreeOptions, NodeType } from './types';
export { GitRepositoryError } from './types';
