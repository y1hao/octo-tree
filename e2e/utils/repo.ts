import { mkdtempSync } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Initialize a temporary git repository for testing
 */
export const initRepo = (): string => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'octotree-integration-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Octo Tree Test"', { cwd: dir, stdio: 'ignore' });
  return dir;
};

/**
 * Clean up a temporary repository
 */
export const cleanupRepo = async (repoPath: string): Promise<void> => {
  await fs.rm(repoPath, { recursive: true, force: true });
};

/**
 * Execute a test function with a temporary repository, cleaning up afterward
 */
export const withRepo = async <T>(testFn: (repoPath: string) => Promise<T>): Promise<T> => {
  const repoPath = initRepo();
  try {
    return await testFn(repoPath);
  } finally {
    await cleanupRepo(repoPath);
  }
};

/**
 * Create test files in the repository
 */
export const createTestFiles = async (repoPath: string, files: Record<string, string>): Promise<void> => {
  await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const fullPath = path.join(repoPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    })
  );
};

/**
 * Create a git commit with the given message
 */
export const createCommit = (repoPath: string, message: string): void => {
  execSync('git add .', { cwd: repoPath, stdio: 'ignore' });
  execSync(`git commit -m "${message}"`, { cwd: repoPath, stdio: 'ignore' });
};

/**
 * Get the commit SHA for HEAD
 */
export const getHeadCommit = (repoPath: string): string => {
  return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
};

/**
 * Get all commit SHAs in reverse chronological order
 */
export const getAllCommits = (repoPath: string): string[] => {
  return execSync('git log --format=%H', { cwd: repoPath, encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(Boolean);
};

