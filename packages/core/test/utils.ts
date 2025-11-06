import { mkdtempSync } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import type { TreeNode } from '../src/types';
import { createDirectoryNode } from '../src/tree-node';

export const initRepo = async (): Promise<string> => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'octotree-core-test-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Octo Tree Test"', { cwd: dir, stdio: 'ignore' });
  return dir;
};

export const cleanupRepo = async (repoPath: string): Promise<void> => {
  await fs.rm(repoPath, { recursive: true, force: true });
};

export const createCommit = async (repoPath: string, message: string): Promise<void> => {
  execSync('git add .', { cwd: repoPath, stdio: 'ignore' });
  execSync(`git commit -m "${message}"`, { cwd: repoPath, stdio: 'ignore' });
};

export const createTag = async (repoPath: string, tagName: string, message?: string): Promise<void> => {
  if (message) {
    execSync(`git tag -a ${tagName} -m "${message}"`, { cwd: repoPath, stdio: 'ignore' });
  } else {
    execSync(`git tag ${tagName}`, { cwd: repoPath, stdio: 'ignore' });
  }
};

/**
 * Helper to run a test with automatic repo cleanup
 */
export const withRepo = async <T>(
  testFn: (repoPath: string) => Promise<T>
): Promise<T> => {
  const repoPath = await initRepo();
  try {
    return await testFn(repoPath);
  } finally {
    await cleanupRepo(repoPath);
  }
};

/**
 * Creates test files in a repository
 */
export const createTestFiles = async (
  repoPath: string,
  files: Record<string, string>
): Promise<void> => {
  await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const fullPath = path.join(repoPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    })
  );
};

/**
 * Sets up a test tree node structure for tree-builder tests
 */
export const createTestTreeStructure = (): {
  rootNode: TreeNode;
  nodeMap: Map<string, TreeNode>;
  childIdMap: Map<string, TreeNode>;
} => {
  const rootNode = createDirectoryNode('.', 'repo', 0);
  const nodeMap = new Map<string, TreeNode>();
  const childIdMap = new Map<string, TreeNode>();
  nodeMap.set('.', rootNode);
  childIdMap.set(rootNode.id, rootNode);
  return { rootNode, nodeMap, childIdMap };
};

/**
 * Gets a git hash (commit or tree) from a ref
 */
export const getGitHash = (repoPath: string, ref: string): string => {
  return execSync(`git rev-parse ${ref}`, { cwd: repoPath, encoding: 'utf8' }).trim();
};

