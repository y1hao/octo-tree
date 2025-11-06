import { promises as fs } from 'fs';
import path from 'path';
import type { TreeNode } from './types';
import { listGitManagedFiles, resolveGitRef, listFilesAtTree, getCommitTimestampMs } from './git';
import {
  joinRelative,
  createDirectoryNode,
  createFileNode,
  ensureChild
} from './tree-node';

const insertFileNode = (
  rootNode: TreeNode,
  nodeMap: Map<string, TreeNode>,
  childIdMap: Map<string, TreeNode>,
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
      ensureChild(parentNode, fileNode, childIdMap);
    } else {
      let directoryNode = nodeMap.get(nextPath);
      if (!directoryNode) {
        directoryNode = createDirectoryNode(nextPath, segment, parentNode.depth + 1, mtimeMs);
        nodeMap.set(nextPath, directoryNode);
        ensureChild(parentNode, directoryNode, childIdMap);
      }
      parentNode = directoryNode;
      currentPath = nextPath;
    }
  }
};

export const buildTreeFromWorkingTree = async (
  repoRoot: string,
  rootNode: TreeNode,
  nodeMap: Map<string, TreeNode>,
  childIdMap: Map<string, TreeNode>
): Promise<void> => {
  const gitManagedFiles = await listGitManagedFiles(repoRoot);

  // Collect file stats first, then build tree structure
  const fileStats = await Promise.all(
    gitManagedFiles.map(async (gitPath) => {
      const absoluteFilePath = path.join(repoRoot, gitPath);
      try {
        const stats = await fs.stat(absoluteFilePath);
        return { gitPath, stats };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }
        throw error;
      }
    })
  );

  // Build tree structure synchronously after stats are collected
  for (const entry of fileStats) {
    if (!entry) continue;
    const { gitPath, stats } = entry;
    const segments = gitPath.split('/');
    let currentPath = '.';
    let parentNode = rootNode;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const isLeaf = index === segments.length - 1;
      const nextPath = joinRelative(currentPath, segment);

      if (isLeaf) {
        const fileNode = createFileNode(
          nextPath,
          segment,
          parentNode.depth + 1,
          stats.size,
          stats.mtimeMs
        );
        nodeMap.set(nextPath, fileNode);
        ensureChild(parentNode, fileNode, childIdMap);
      } else {
        let directoryNode = nodeMap.get(nextPath);
        if (!directoryNode) {
          directoryNode = createDirectoryNode(nextPath, segment, parentNode.depth + 1, stats.mtimeMs);
          nodeMap.set(nextPath, directoryNode);
          ensureChild(parentNode, directoryNode, childIdMap);
        }
        parentNode = directoryNode;
        currentPath = nextPath;
      }
    }
  }
};

export const buildTreeFromCommit = async (
  repoRoot: string,
  rootNode: TreeNode,
  nodeMap: Map<string, TreeNode>,
  childIdMap: Map<string, TreeNode>,
  ref: string
): Promise<number | null> => {
  const { treeHash, commitHash } = await resolveGitRef(repoRoot, ref);
  
  // Parallelize: get entries and commit timestamp simultaneously
  const [entries, commitTimestampMs] = await Promise.all([
    listFilesAtTree(repoRoot, treeHash),
    commitHash ? getCommitTimestampMs(repoRoot, commitHash).catch(() => null) : Promise.resolve(null)
  ]);
  
  const mtimeMs = commitTimestampMs ?? 0;

  for (const entry of entries) {
    insertFileNode(rootNode, nodeMap, childIdMap, entry.path, entry.size, mtimeMs);
  }
  return commitTimestampMs ?? null;
};

